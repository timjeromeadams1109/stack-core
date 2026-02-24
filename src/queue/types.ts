/**
 * Queue Types for @stack/core
 */

export interface QueueConfig {
  name: string
  redis?: {
    host?: string
    port?: number
    url?: string
  }
  // DLQ settings
  dlq?: {
    enabled?: boolean
    maxRetries?: number        // Move to DLQ after this many failures
    retryDelay?: number        // Base delay between retries (ms)
    backoffType?: 'fixed' | 'exponential'
  }
  // Timeout settings
  timeout?: {
    job?: number              // Max time per job (ms)
    connection?: number       // Redis connection timeout
  }
  // Idempotency settings
  idempotency?: {
    enabled?: boolean
    ttl?: number              // How long to remember processed jobs (seconds)
    keyPrefix?: string
  }
  // Default job options
  defaultJobOptions?: {
    priority?: number
    delay?: number
    attempts?: number
  }
}

export interface JobResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  cached?: boolean           // True if idempotent hit
  duration?: number          // Processing time in ms
  attempts?: number          // How many attempts it took
}

export interface DLQJob<T = unknown> {
  id: string
  name: string
  data: T
  failedReason: string
  attemptsMade: number
  timestamp: Date
  stacktrace?: string[]
  originalQueue: string
}

export interface QueueStats {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  dlq: number
}

export type JobProcessor<T = unknown, R = unknown> = (
  job: { id: string; name: string; data: T; attemptsMade: number }
) => Promise<R>
