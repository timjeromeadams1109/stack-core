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
import IORedis from 'ioredis';
// Re-export all modules
export * from './queue/index.js';
export * from './circuit-breaker/index.js';
export * from './timeout/index.js';
export * from './depth-guard/index.js';
export * from './idempotency/index.js';
export * from './tracing/index.js';
// Import for unified API
import { ResilientQueue } from './queue/index.js';
import { createCircuitBreaker } from './circuit-breaker/index.js';
import { createDepthGuard } from './depth-guard/index.js';
import { createIdempotency } from './idempotency/index.js';
import { withTimeout, deadline } from './timeout/index.js';
/**
 * The Stack - unified access to all resilience patterns
 */
export class Stack {
    redis;
    config;
    queues = new Map();
    constructor(config) {
        this.config = config;
        if (config.redis.url) {
            this.redis = new IORedis(config.redis.url);
        }
        else {
            this.redis = new IORedis({
                host: config.redis.host ?? 'localhost',
                port: config.redis.port ?? 6379,
            });
        }
    }
    /**
     * Create or get a resilient queue
     */
    queue(name, options) {
        const existing = this.queues.get(name);
        if (existing)
            return existing;
        const queue = new ResilientQueue({
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
        }, this.redis);
        this.queues.set(name, queue);
        return queue;
    }
    /**
     * Create a circuit breaker for a service
     */
    circuitBreaker(name, action, options) {
        return createCircuitBreaker(name, action, {
            errorThreshold: this.config.defaults?.circuitThreshold ?? 50,
            ...options,
        });
    }
    /**
     * Create a depth guard
     */
    depthGuard(maxDepth) {
        return createDepthGuard(maxDepth ?? this.config.defaults?.maxDepth ?? 10);
    }
    /**
     * Create an idempotency manager
     */
    idempotency(options) {
        return createIdempotency({
            redis: this.redis,
            ttl: this.config.defaults?.idempotencyTtl ?? 86400,
            ...options,
        });
    }
    /**
     * Wrap a promise with timeout
     */
    timeout(promise, ms) {
        return withTimeout(promise, ms ?? this.config.defaults?.timeoutMs ?? 30000);
    }
    /**
     * Create a deadline
     */
    deadline(ms) {
        return deadline(ms);
    }
    /**
     * Get the Redis connection (for advanced use)
     */
    getRedis() {
        return this.redis;
    }
    /**
     * Close all connections
     */
    async close() {
        for (const queue of this.queues.values()) {
            await queue.close();
        }
        await this.redis.quit();
    }
}
/**
 * Create a new Stack instance
 */
export function createStack(config) {
    return new Stack(config);
}
// ============================================================================
// CONVENIENCE: Create queue directly without full Stack
// ============================================================================
let defaultRedis = null;
function getDefaultRedis() {
    if (!defaultRedis) {
        defaultRedis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    }
    return defaultRedis;
}
/**
 * Create a resilient queue with defaults
 * (For when you don't need the full Stack)
 */
export function createResilientQueue(config, redis) {
    return new ResilientQueue(config, redis ?? getDefaultRedis());
}
//# sourceMappingURL=index.js.map