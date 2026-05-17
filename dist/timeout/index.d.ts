/**
 * Timeout Utilities - @stack/core
 *
 * Wrap async operations with configurable timeouts.
 */
export interface TimeoutConfig {
    ms: number;
    message?: string;
    onTimeout?: () => void;
}
export declare class TimeoutError extends Error {
    readonly timeoutMs: number;
    constructor(message: string, timeoutMs: number);
}
/**
 * Wrap a promise with a timeout
 */
export declare function withTimeout<T>(promise: Promise<T>, config: TimeoutConfig | number): Promise<T>;
/**
 * Create a timeout wrapper for repeated use
 */
export declare function createTimeout(defaultMs: number): <T>(promise: Promise<T>, ms?: number) => Promise<T>;
/**
 * Deadline - absolute time limit
 */
export declare class Deadline {
    private endTime;
    constructor(ms: number);
    /**
     * Remaining time until deadline
     */
    remaining(): number;
    /**
     * Check if deadline has passed
     */
    exceeded(): boolean;
    /**
     * Wrap a promise with remaining deadline time
     */
    wrap<T>(promise: Promise<T>): Promise<T>;
}
/**
 * Create a deadline from now
 */
export declare function deadline(ms: number): Deadline;
//# sourceMappingURL=index.d.ts.map