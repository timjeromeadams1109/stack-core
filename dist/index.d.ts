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
export * from './queue/index.js';
export * from './circuit-breaker/index.js';
export * from './timeout/index.js';
export * from './depth-guard/index.js';
export * from './idempotency/index.js';
export * from './tracing/index.js';
import { ResilientQueue, type QueueConfig } from './queue/index.js';
import { type CircuitBreakerConfig } from './circuit-breaker/index.js';
import { DepthGuard } from './depth-guard/index.js';
import { type IdempotencyConfig } from './idempotency/index.js';
export interface StackConfig {
    redis: {
        url?: string;
        host?: string;
        port?: number;
    };
    defaults?: {
        queueRetries?: number;
        timeoutMs?: number;
        circuitThreshold?: number;
        maxDepth?: number;
        idempotencyTtl?: number;
    };
}
/**
 * The Stack - unified access to all resilience patterns
 */
export declare class Stack {
    private redis;
    private config;
    private queues;
    constructor(config: StackConfig);
    /**
     * Create or get a resilient queue
     */
    queue<T = unknown, R = unknown>(name: string, options?: Partial<QueueConfig>): ResilientQueue<T, R>;
    /**
     * Create a circuit breaker for a service
     */
    circuitBreaker<T extends unknown[], R>(name: string, action: (...args: T) => Promise<R>, options?: Partial<CircuitBreakerConfig>): import("./index.js").ServiceCircuitBreaker<T, R>;
    /**
     * Create a depth guard
     */
    depthGuard(maxDepth?: number): DepthGuard;
    /**
     * Create an idempotency manager
     */
    idempotency(options?: Partial<IdempotencyConfig>): import("./index.js").IdempotencyManager;
    /**
     * Wrap a promise with timeout
     */
    timeout<T>(promise: Promise<T>, ms?: number): Promise<T>;
    /**
     * Create a deadline
     */
    deadline(ms: number): import("./index.js").Deadline;
    /**
     * Get the Redis connection (for advanced use)
     */
    getRedis(): IORedis;
    /**
     * Close all connections
     */
    close(): Promise<void>;
}
/**
 * Create a new Stack instance
 */
export declare function createStack(config: StackConfig): Stack;
/**
 * Create a resilient queue with defaults
 * (For when you don't need the full Stack)
 */
export declare function createResilientQueue<T = unknown, R = unknown>(config: QueueConfig, redis?: IORedis): ResilientQueue<T, R>;
//# sourceMappingURL=index.d.ts.map