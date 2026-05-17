/**
 * Queue Types for @stack/core
 */
export interface QueueConfig {
    name: string;
    redis?: {
        host?: string;
        port?: number;
        url?: string;
    };
    dlq?: {
        enabled?: boolean;
        maxRetries?: number;
        retryDelay?: number;
        backoffType?: 'fixed' | 'exponential';
    };
    timeout?: {
        job?: number;
        connection?: number;
    };
    idempotency?: {
        enabled?: boolean;
        ttl?: number;
        keyPrefix?: string;
    };
    defaultJobOptions?: {
        priority?: number;
        delay?: number;
        attempts?: number;
    };
}
export interface JobResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    cached?: boolean;
    duration?: number;
    attempts?: number;
}
export interface DLQJob<T = unknown> {
    id: string;
    name: string;
    data: T;
    failedReason: string;
    attemptsMade: number;
    timestamp: Date;
    stacktrace?: string[];
    originalQueue: string;
}
export interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    dlq: number;
}
export type JobProcessor<T = unknown, R = unknown> = (job: {
    id: string;
    name: string;
    data: T;
    attemptsMade: number;
}) => Promise<R>;
//# sourceMappingURL=types.d.ts.map