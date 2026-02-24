/**
 * Idempotency Module - @stack/core
 *
 * Standalone idempotency for any operation, not just queues.
 */

import type IORedis from 'ioredis'
import { createHash } from 'crypto'

export interface IdempotencyConfig {
  redis: IORedis
  ttl?: number           // Seconds to remember (default: 86400 = 24h)
  prefix?: string        // Key prefix (default: 'idempotent:')
}

export interface IdempotencyResult<T> {
  executed: boolean      // True if we ran the operation
  cached: boolean        // True if result was from cache
  result: T
}

/**
 * Idempotency manager for deduplicating operations
 */
export class IdempotencyManager {
  private redis: IORedis
  private ttl: number
  private prefix: string

  constructor(config: IdempotencyConfig) {
    this.redis = config.redis
    this.ttl = config.ttl ?? 86400
    this.prefix = config.prefix ?? 'idempotent:'
  }

  /**
   * Generate a key from any inputs
   */
  generateKey(...inputs: unknown[]): string {
    const content = JSON.stringify(inputs)
    const hash = createHash('sha256').update(content).digest('hex')
    return `${this.prefix}${hash}`
  }

  /**
   * Execute an operation idempotently
   *
   * If the same key was processed before (within TTL), returns cached result.
   * Otherwise, executes the operation and caches the result.
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<IdempotencyResult<T>> {
    // Check if already processed
    const cached = await this.redis.get(key)
    if (cached) {
      console.log(`[Idempotency] Cache hit: ${key.slice(0, 24)}...`)
      return {
        executed: false,
        cached: true,
        result: JSON.parse(cached) as T,
      }
    }

    // Execute operation
    console.log(`[Idempotency] Executing: ${key.slice(0, 24)}...`)
    const result = await operation()

    // Cache result
    await this.redis.setex(key, this.ttl, JSON.stringify(result))

    return {
      executed: true,
      cached: false,
      result,
    }
  }

  /**
   * Check if a key exists without executing
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key)
    return result === 1
  }

  /**
   * Get cached result for a key
   */
  async get<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key)
    return cached ? (JSON.parse(cached) as T) : null
  }

  /**
   * Clear a specific key (allow re-execution)
   */
  async clear(key: string): Promise<void> {
    await this.redis.del(key)
  }

  /**
   * Clear all idempotency keys
   */
  async clearAll(): Promise<number> {
    const keys = await this.redis.keys(`${this.prefix}*`)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
    return keys.length
  }
}

/**
 * Create an idempotency manager
 */
export function createIdempotency(config: IdempotencyConfig): IdempotencyManager {
  return new IdempotencyManager(config)
}
