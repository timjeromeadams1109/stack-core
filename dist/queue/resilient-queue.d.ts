/**
 * Resilient Queue with DLQ, Idempotency, and Timeout
 *
 * The core queue implementation that wraps BullMQ with production patterns.
 */
import type IORedis from 'ioredis';
import type { QueueConfig, DLQJob, QueueStats, JobProcessor } from './types.js';
export declare class ResilientQueue<T = unknown, R = unknown> {
    private queue;
    private dlqQueue;
    private worker;
    private events;
    private config;
    private redis;
    constructor(config: QueueConfig, redis: IORedis);
    /**
     * Add a job to the queue
     */
    add(name: string, data: T, options?: {
        priority?: number;
        delay?: number;
        idempotencyKey?: string;
    }): Promise<{
        jobId: string;
        cached: boolean;
    }>;
    /**
     * Process jobs with the given handler
     */
    process(processor: JobProcessor<T, R>): void;
    /**
     * Move a failed job to the Dead Letter Queue
     */
    private moveToDLQ;
    /**
     * Get jobs from the Dead Letter Queue
     */
    getDLQJobs(limit?: number): Promise<DLQJob<T>[]>;
    /**
     * Replay a job from the DLQ
     */
    replayDLQJob(dlqJobId: string): Promise<string>;
    /**
     * Clear all DLQ jobs
     */
    clearDLQ(): Promise<number>;
    /**
     * Get queue statistics
     */
    getStats(): Promise<QueueStats>;
    /**
     * Generate idempotency key from job data
     */
    private generateIdempotencyKey;
    /**
     * Check if job was already processed
     */
    private checkIdempotency;
    /**
     * Mark job as processed for idempotency
     */
    private markProcessed;
    /**
     * Clear idempotency for a job (allows reprocessing)
     */
    private clearIdempotency;
    /**
     * Wrap a promise with timeout
     */
    private withTimeout;
    /**
     * Graceful shutdown
     */
    close(): Promise<void>;
}
//# sourceMappingURL=resilient-queue.d.ts.map