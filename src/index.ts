/**
 * @stack/core - Resilient patterns for production-grade applications
 *
 * This package provides battle-tested patterns that every production system needs:
 *
 * - Dead Letter Queue (DLQ): Never lose a failed job
 * - Idempotency: Prevent duplicate processing
 * - Circuit Breaker: Fail fast when services are down
 * - Timeout: Kill runaway operations
 * - Depth Guard: Prevent infinite recursion
 *
 * Usage:
 *
 * ```typescript
 * import { createResilientQueue, createCircuitBreaker, createDepthGuard } from '@stack/core'
 *
 * // Create a queue with all patterns built-in
 * const queue = createResilientQueue({ name: 'jobs' }, redis)
 *
 * // Wrap external service calls
 * const aiService = createCircuitBreaker('claude', callClaude)
 *
 * // Prevent infinite agent loops
 * const depth = createDepthGuard(5)
 * await depth.wrap(() => agentCall())
 * ```
 */

import IORedis from 'ioredis'

// Re-export all modules
export * from './queue/index.js'
export * from './circuit-breaker/index.js'
export * from './timeout/index.js'
export * from './depth-guard/index.js'
export * from './idempotency/index.js'
export * from './tracing/index.js'

// Import for unified API
import { ResilientQueue, type QueueConfig } from './queue/index.js'
import { createCircuitBreaker, type CircuitBreakerConfig } from './circuit-breaker/index.js'
import { createDepthGuard, DepthGuard } from './depth-guard/index.js'
import { createIdempotency, type IdempotencyConfig } from './idempotency/index.js'
import { withTimeout, deadline } from './timeout/index.js'

// ============================================================================
// UNIFIED STACK INTERFACE
// ============================================================================

export interface StackConfig {
  redis: {
    url?: string
    host?: string
    port?: number
  }
  defaults?: {
    queueRetries?: number
    timeoutMs?: number
    circuitThreshold?: number
    maxDepth?: number
    idempotencyTtl?: number
  }
}

/**
 * The Stack - unified access to all resilience patterns
 */
export class Stack {
  private redis: IORedis
  private config: StackConfig
  private queues = new Map<string, ResilientQueue>()

  constructor(config: StackConfig) {
    this.config = config
    if (config.redis.url) {
      this.redis = new IORedis(config.redis.url)
    } else {
      this.redis = new IORedis({
        host: config.redis.host ?? 'localhost',
        port: config.redis.port ?? 6379,
      })
    }
  }

  /**
   * Create or get a resilient queue
   */
  queue<T = unknown, R = unknown>(
    name: string,
    options?: Partial<QueueConfig>
  ): ResilientQueue<T, R> {
    const existing = this.queues.get(name)
    if (existing) return existing as ResilientQueue<T, R>

    const queue = new ResilientQueue<T, R>(
      {
        name,
        dlq: {
          enabled: true,
          maxRetries: this.config.defaults?.queueRetries ?? 3,
        },
        timeout: {
          job: this.config.defaults?.timeoutMs ?? 300000,
        },
        idempotency: {
          enabled: true,
          ttl: this.config.defaults?.idempotencyTtl ?? 86400,
        },
        ...options,
      },
      this.redis
    )

    this.queues.set(name, queue as ResilientQueue)
    return queue
  }

  /**
   * Create a circuit breaker for a service
   */
  circuitBreaker<T extends unknown[], R>(
    name: string,
    action: (...args: T) => Promise<R>,
    options?: Partial<CircuitBreakerConfig>
  ) {
    return createCircuitBreaker(name, action, {
      errorThreshold: this.config.defaults?.circuitThreshold ?? 50,
      ...options,
    })
  }

  /**
   * Create a depth guard
   */
  depthGuard(maxDepth?: number): DepthGuard {
    return createDepthGuard(maxDepth ?? this.config.defaults?.maxDepth ?? 10)
  }

  /**
   * Create an idempotency manager
   */
  idempotency(options?: Partial<IdempotencyConfig>) {
    return createIdempotency({
      redis: this.redis,
      ttl: this.config.defaults?.idempotencyTtl ?? 86400,
      ...options,
    })
  }

  /**
   * Wrap a promise with timeout
   */
  timeout<T>(promise: Promise<T>, ms?: number): Promise<T> {
    return withTimeout(promise, ms ?? this.config.defaults?.timeoutMs ?? 30000)
  }

  /**
   * Create a deadline
   */
  deadline(ms: number) {
    return deadline(ms)
  }

  /**
   * Get the Redis connection (for advanced use)
   */
  getRedis(): IORedis {
    return this.redis
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.close()
    }
    await this.redis.quit()
  }
}

/**
 * Create a new Stack instance
 */
export function createStack(config: StackConfig): Stack {
  return new Stack(config)
}

// ============================================================================
// CONVENIENCE: Create queue directly without full Stack
// ============================================================================

let defaultRedis: IORedis | null = null

function getDefaultRedis(): IORedis {
  if (!defaultRedis) {
    defaultRedis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379')
  }
  return defaultRedis
}

/**
 * Create a resilient queue with defaults
 * (For when you don't need the full Stack)
 */
export function createResilientQueue<T = unknown, R = unknown>(
  config: QueueConfig,
  redis?: IORedis
): ResilientQueue<T, R> {
  return new ResilientQueue(config, redis ?? getDefaultRedis())
}
