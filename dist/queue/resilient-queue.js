/**
 * Resilient Queue with DLQ, Idempotency, and Timeout
 *
 * The core queue implementation that wraps BullMQ with production patterns.
 */
import { Queue, Worker, QueueEvents } from 'bullmq';
import { createHash } from 'crypto';
const DEFAULT_CONFIG = {
    dlq: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000,
        backoffType: 'exponential',
    },
    timeout: {
        job: 300000, // 5 minutes
        connection: 5000,
    },
    idempotency: {
        enabled: true,
        ttl: 86400, // 24 hours
        keyPrefix: 'idem:',
    },
};
export class ResilientQueue {
    queue;
    dlqQueue;
    worker = null;
    events;
    config;
    redis;
    constructor(config, redis) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.redis = redis;
        const connection = redis;
        // Main queue
        this.queue = new Queue(config.name, {
            connection,
            defaultJobOptions: {
                attempts: this.config.dlq?.maxRetries ?? 3,
                backoff: {
                    type: this.config.dlq?.backoffType ?? 'exponential',
                    delay: this.config.dlq?.retryDelay ?? 1000,
                },
                removeOnComplete: { count: 1000 },
                removeOnFail: false, // Keep failed jobs for DLQ
            },
        });
        // Dead Letter Queue
        this.dlqQueue = new Queue(`${config.name}:dlq`, { connection });
        // Queue events for monitoring
        this.events = new QueueEvents(config.name, { connection });
    }
    /**
     * Add a job to the queue
     */
    async add(name, data, options) {
        // Generate idempotency key
        const idempotencyKey = options?.idempotencyKey ?? this.generateIdempotencyKey(name, data);
        // Check idempotency
        if (this.config.idempotency?.enabled) {
            const cached = await this.checkIdempotency(idempotencyKey);
            if (cached) {
                console.log(`[Queue:${this.config.name}] Idempotent hit for ${idempotencyKey.slice(0, 16)}...`);
                return { jobId: cached, cached: true };
            }
        }
        // Add job
        const job = await this.queue.add(name, data, {
            priority: options?.priority,
            delay: options?.delay,
            jobId: idempotencyKey, // Use idempotency key as job ID for dedup
        });
        console.log(`[Queue:${this.config.name}] Added job ${job.id}`);
        return { jobId: job.id, cached: false };
    }
    /**
     * Process jobs with the given handler
     */
    process(processor) {
        this.worker = new Worker(this.config.name, async (job) => {
            const startTime = Date.now();
            const timeoutMs = this.config.timeout?.job ?? 300000;
            console.log(`[Queue:${this.config.name}] Processing job ${job.id} (attempt ${job.attemptsMade + 1})`);
            try {
                // Wrap with timeout
                const result = await this.withTimeout(processor({
                    id: job.id,
                    name: job.name,
                    data: job.data,
                    attemptsMade: job.attemptsMade,
                }), timeoutMs);
                // Mark as processed for idempotency
                if (this.config.idempotency?.enabled) {
                    await this.markProcessed(job.id, result);
                }
                const duration = Date.now() - startTime;
                console.log(`[Queue:${this.config.name}] Job ${job.id} completed in ${duration}ms`);
                return result;
            }
            catch (error) {
                const duration = Date.now() - startTime;
                console.error(`[Queue:${this.config.name}] Job ${job.id} failed after ${duration}ms:`, error);
                throw error;
            }
        }, {
            connection: this.redis,
            concurrency: 5,
        });
        // Handle failed jobs → DLQ
        this.worker.on('failed', async (job, err) => {
            if (!job)
                return;
            const maxRetries = this.config.dlq?.maxRetries ?? 3;
            if (job.attemptsMade >= maxRetries && this.config.dlq?.enabled) {
                await this.moveToDLQ(job, err);
            }
        });
        this.worker.on('error', (err) => {
            console.error(`[Queue:${this.config.name}] Worker error:`, err);
        });
    }
    /**
     * Move a failed job to the Dead Letter Queue
     */
    async moveToDLQ(job, error) {
        const dlqJob = {
            id: job.id,
            name: job.name,
            data: job.data,
            failedReason: error.message,
            attemptsMade: job.attemptsMade,
            timestamp: new Date(),
            stacktrace: job.stacktrace,
            originalQueue: this.config.name,
        };
        await this.dlqQueue.add('failed', dlqJob, {
            removeOnComplete: false, // Keep DLQ jobs for inspection
        });
        console.log(`[Queue:${this.config.name}] Job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`);
    }
    /**
     * Get jobs from the Dead Letter Queue
     */
    async getDLQJobs(limit = 100) {
        const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed'], 0, limit);
        return jobs.map((job) => job.data);
    }
    /**
     * Replay a job from the DLQ
     */
    async replayDLQJob(dlqJobId) {
        const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed']);
        const dlqJob = jobs.find((j) => j.data.id === dlqJobId);
        if (!dlqJob) {
            throw new Error(`DLQ job ${dlqJobId} not found`);
        }
        const data = dlqJob.data;
        // Clear idempotency so it can be reprocessed
        await this.clearIdempotency(data.id);
        // Add back to main queue
        const job = await this.queue.add(data.name, data.data);
        // Remove from DLQ
        await dlqJob.remove();
        console.log(`[Queue:${this.config.name}] Replayed DLQ job ${dlqJobId} as ${job.id}`);
        return job.id;
    }
    /**
     * Clear all DLQ jobs
     */
    async clearDLQ() {
        const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed']);
        await Promise.all(jobs.map((j) => j.remove()));
        return jobs.length;
    }
    /**
     * Get queue statistics
     */
    async getStats() {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getCompletedCount(),
            this.queue.getFailedCount(),
            this.queue.getDelayedCount(),
        ]);
        const dlqJobs = await this.dlqQueue.getWaitingCount();
        return { waiting, active, completed, failed, delayed, dlq: dlqJobs };
    }
    /**
     * Generate idempotency key from job data
     */
    generateIdempotencyKey(name, data) {
        const content = JSON.stringify({ name, data });
        const hash = createHash('sha256').update(content).digest('hex');
        return `${this.config.idempotency?.keyPrefix ?? 'idem:'}${hash}`;
    }
    /**
     * Check if job was already processed
     */
    async checkIdempotency(key) {
        const result = await this.redis.get(key);
        return result;
    }
    /**
     * Mark job as processed for idempotency
     */
    async markProcessed(jobId, result) {
        const key = jobId.startsWith('idem:') ? jobId : `idem:${jobId}`;
        const ttl = this.config.idempotency?.ttl ?? 86400;
        await this.redis.setex(key, ttl, jobId);
    }
    /**
     * Clear idempotency for a job (allows reprocessing)
     */
    async clearIdempotency(jobId) {
        const key = jobId.startsWith('idem:') ? jobId : `idem:${jobId}`;
        await this.redis.del(key);
    }
    /**
     * Wrap a promise with timeout
     */
    async withTimeout(promise, ms) {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Job timeout after ${ms}ms`));
            }, ms);
        });
        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timeoutId);
            return result;
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    /**
     * Graceful shutdown
     */
    async close() {
        await this.worker?.close();
        await this.queue.close();
        await this.dlqQueue.close();
        await this.events.close();
    }
}
//# sourceMappingURL=resilient-queue.js.map