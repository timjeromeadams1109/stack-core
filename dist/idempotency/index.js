/**
 * Idempotency Module - @stack/core
 *
 * Standalone idempotency for any operation, not just queues.
 */
import { createHash } from 'crypto';
/**
 * Idempotency manager for deduplicating operations
 */
export class IdempotencyManager {
    redis;
    ttl;
    prefix;
    constructor(config) {
        this.redis = config.redis;
        this.ttl = config.ttl ?? 86400;
        this.prefix = config.prefix ?? 'idempotent:';
    }
    /**
     * Generate a key from any inputs
     */
    generateKey(...inputs) {
        const content = JSON.stringify(inputs);
        const hash = createHash('sha256').update(content).digest('hex');
        return `${this.prefix}${hash}`;
    }
    /**
     * Execute an operation idempotently
     *
     * If the same key was processed before (within TTL), returns cached result.
     * Otherwise, executes the operation and caches the result.
     */
    async execute(key, operation) {
        // Check if already processed
        const cached = await this.redis.get(key);
        if (cached) {
            console.log(`[Idempotency] Cache hit: ${key.slice(0, 24)}...`);
            return {
                executed: false,
                cached: true,
                result: JSON.parse(cached),
            };
        }
        // Execute operation
        console.log(`[Idempotency] Executing: ${key.slice(0, 24)}...`);
        const result = await operation();
        // Cache result
        await this.redis.setex(key, this.ttl, JSON.stringify(result));
        return {
            executed: true,
            cached: false,
            result,
        };
    }
    /**
     * Check if a key exists without executing
     */
    async exists(key) {
        const result = await this.redis.exists(key);
        return result === 1;
    }
    /**
     * Get cached result for a key
     */
    async get(key) {
        const cached = await this.redis.get(key);
        return cached ? JSON.parse(cached) : null;
    }
    /**
     * Clear a specific key (allow re-execution)
     */
    async clear(key) {
        await this.redis.del(key);
    }
    /**
     * Clear all idempotency keys
     */
    async clearAll() {
        const keys = await this.redis.keys(`${this.prefix}*`);
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
        return keys.length;
    }
}
/**
 * Create an idempotency manager
 */
export function createIdempotency(config) {
    return new IdempotencyManager(config);
}
//# sourceMappingURL=index.js.map