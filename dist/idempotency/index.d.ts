/**
 * Idempotency Module - @stack/core
 *
 * Standalone idempotency for any operation, not just queues.
 */
import type IORedis from 'ioredis';
export interface IdempotencyConfig {
    redis: IORedis;
    ttl?: number;
    prefix?: string;
}
export interface IdempotencyResult<T> {
    executed: boolean;
    cached: boolean;
    result: T;
}
/**
 * Idempotency manager for deduplicating operations
 */
export declare class IdempotencyManager {
    private redis;
    private ttl;
    private prefix;
    constructor(config: IdempotencyConfig);
    /**
     * Generate a key from any inputs
     */
    generateKey(...inputs: unknown[]): string;
    /**
     * Execute an operation idempotently
     *
     * If the same key was processed before (within TTL), returns cached result.
     * Otherwise, executes the operation and caches the result.
     */
    execute<T>(key: string, operation: () => Promise<T>): Promise<IdempotencyResult<T>>;
    /**
     * Check if a key exists without executing
     */
    exists(key: string): Promise<boolean>;
    /**
     * Get cached result for a key
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Clear a specific key (allow re-execution)
     */
    clear(key: string): Promise<void>;
    /**
     * Clear all idempotency keys
     */
    clearAll(): Promise<number>;
}
/**
 * Create an idempotency manager
 */
export declare function createIdempotency(config: IdempotencyConfig): IdempotencyManager;
//# sourceMappingURL=index.d.ts.map