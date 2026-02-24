/**
 * Resilient Queue with DLQ, Idempotency, and Timeout
 *
 * The core queue implementation that wraps BullMQ with production patterns.
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq'
import type IORedis from 'ioredis'
import { createHash } from 'crypto'
import type { QueueConfig, JobResult, DLQJob, QueueStats, JobProcessor } from './types.js'

const DEFAULT_CONFIG: Partial<QueueConfig> = {
  dlq: {
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000,
    backoffType: 'exponential',
  },
  timeout: {
    job: 300000,      // 5 minutes
    connection: 5000,
  },
  idempotency: {
    enabled: true,
    ttl: 86400,       // 24 hours
    keyPrefix: 'idem:',
  },
}

export class ResilientQueue<T = unknown, R = unknown> {
  private queue: Queue
  private dlqQueue: Queue
  private worker: Worker | null = null
  private events: QueueEvents
  private config: QueueConfig
  private redis: IORedis

  constructor(config: QueueConfig, redis: IORedis) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.redis = redis

    const connection = redis

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
    })

    // Dead Letter Queue
    this.dlqQueue = new Queue(`${config.name}:dlq`, { connection })

    // Queue events for monitoring
    this.events = new QueueEvents(config.name, { connection })
  }

  /**
   * Add a job to the queue
   */
  async add(
    name: string,
    data: T,
    options?: { priority?: number; delay?: number; idempotencyKey?: string }
  ): Promise<{ jobId: string; cached: boolean }> {
    // Generate idempotency key
    const idempotencyKey = options?.idempotencyKey ?? this.generateIdempotencyKey(name, data)

    // Check idempotency
    if (this.config.idempotency?.enabled) {
      const cached = await this.checkIdempotency(idempotencyKey)
      if (cached) {
        console.log(`[Queue:${this.config.name}] Idempotent hit for ${idempotencyKey.slice(0, 16)}...`)
        return { jobId: cached, cached: true }
      }
    }

    // Add job
    const job = await this.queue.add(name, data, {
      priority: options?.priority,
      delay: options?.delay,
      jobId: idempotencyKey, // Use idempotency key as job ID for dedup
    })

    console.log(`[Queue:${this.config.name}] Added job ${job.id}`)
    return { jobId: job.id!, cached: false }
  }

  /**
   * Process jobs with the given handler
   */
  process(processor: JobProcessor<T, R>): void {
    this.worker = new Worker<T, R>(
      this.config.name,
      async (job: Job<T, R>) => {
        const startTime = Date.now()
        const timeoutMs = this.config.timeout?.job ?? 300000

        console.log(`[Queue:${this.config.name}] Processing job ${job.id} (attempt ${job.attemptsMade + 1})`)

        try {
          // Wrap with timeout
          const result = await this.withTimeout(
            processor({
              id: job.id!,
              name: job.name,
              data: job.data,
              attemptsMade: job.attemptsMade,
            }),
            timeoutMs
          )

          // Mark as processed for idempotency
          if (this.config.idempotency?.enabled) {
            await this.markProcessed(job.id!, result)
          }

          const duration = Date.now() - startTime
          console.log(`[Queue:${this.config.name}] Job ${job.id} completed in ${duration}ms`)

          return result
        } catch (error) {
          const duration = Date.now() - startTime
          console.error(`[Queue:${this.config.name}] Job ${job.id} failed after ${duration}ms:`, error)
          throw error
        }
      },
      {
        connection: this.redis,
        concurrency: 5,
      }
    )

    // Handle failed jobs → DLQ
    this.worker.on('failed', async (job, err) => {
      if (!job) return

      const maxRetries = this.config.dlq?.maxRetries ?? 3

      if (job.attemptsMade >= maxRetries && this.config.dlq?.enabled) {
        await this.moveToDLQ(job, err)
      }
    })

    this.worker.on('error', (err) => {
      console.error(`[Queue:${this.config.name}] Worker error:`, err)
    })
  }

  /**
   * Move a failed job to the Dead Letter Queue
   */
  private async moveToDLQ(job: Job<T>, error: Error): Promise<void> {
    const dlqJob: DLQJob<T> = {
      id: job.id!,
      name: job.name,
      data: job.data,
      failedReason: error.message,
      attemptsMade: job.attemptsMade,
      timestamp: new Date(),
      stacktrace: job.stacktrace,
      originalQueue: this.config.name,
    }

    await this.dlqQueue.add('failed', dlqJob, {
      removeOnComplete: false, // Keep DLQ jobs for inspection
    })

    console.log(`[Queue:${this.config.name}] Job ${job.id} moved to DLQ after ${job.attemptsMade} attempts`)
  }

  /**
   * Get jobs from the Dead Letter Queue
   */
  async getDLQJobs(limit = 100): Promise<DLQJob<T>[]> {
    const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed'], 0, limit)
    return jobs.map((job) => job.data as DLQJob<T>)
  }

  /**
   * Replay a job from the DLQ
   */
  async replayDLQJob(dlqJobId: string): Promise<string> {
    const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed'])
    const dlqJob = jobs.find((j) => j.data.id === dlqJobId)

    if (!dlqJob) {
      throw new Error(`DLQ job ${dlqJobId} not found`)
    }

    const data = dlqJob.data as DLQJob<T>

    // Clear idempotency so it can be reprocessed
    await this.clearIdempotency(data.id)

    // Add back to main queue
    const job = await this.queue.add(data.name, data.data)

    // Remove from DLQ
    await dlqJob.remove()

    console.log(`[Queue:${this.config.name}] Replayed DLQ job ${dlqJobId} as ${job.id}`)
    return job.id!
  }

  /**
   * Clear all DLQ jobs
   */
  async clearDLQ(): Promise<number> {
    const jobs = await this.dlqQueue.getJobs(['waiting', 'delayed'])
    await Promise.all(jobs.map((j) => j.remove()))
    return jobs.length
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ])

    const dlqJobs = await this.dlqQueue.getWaitingCount()

    return { waiting, active, completed, failed, delayed, dlq: dlqJobs }
  }

  /**
   * Generate idempotency key from job data
   */
  private generateIdempotencyKey(name: string, data: T): string {
    const content = JSON.stringify({ name, data })
    const hash = createHash('sha256').update(content).digest('hex')
    return `${this.config.idempotency?.keyPrefix ?? 'idem:'}${hash}`
  }

  /**
   * Check if job was already processed
   */
  private async checkIdempotency(key: string): Promise<string | null> {
    const result = await this.redis.get(key)
    return result
  }

  /**
   * Mark job as processed for idempotency
   */
  private async markProcessed(jobId: string, result: R): Promise<void> {
    const key = jobId.startsWith('idem:') ? jobId : `idem:${jobId}`
    const ttl = this.config.idempotency?.ttl ?? 86400
    await this.redis.setex(key, ttl, jobId)
  }

  /**
   * Clear idempotency for a job (allows reprocessing)
   */
  private async clearIdempotency(jobId: string): Promise<void> {
    const key = jobId.startsWith('idem:') ? jobId : `idem:${jobId}`
    await this.redis.del(key)
  }

  /**
   * Wrap a promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timeoutId: NodeJS.Timeout

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Job timeout after ${ms}ms`))
      }, ms)
    })

    try {
      const result = await Promise.race([promise, timeoutPromise])
      clearTimeout(timeoutId!)
      return result
    } catch (error) {
      clearTimeout(timeoutId!)
      throw error
    }
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    await this.worker?.close()
    await this.queue.close()
    await this.dlqQueue.close()
    await this.events.close()
  }
}
