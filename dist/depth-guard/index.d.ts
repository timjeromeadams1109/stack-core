/**
 * Depth Guard - @stack/core
 *
 * Prevents infinite recursion in agent/workflow systems.
 * Tracks call depth and enforces limits.
 */
export interface DepthGuardConfig {
    maxDepth: number;
    onMaxDepth?: (depth: number, context?: string) => void;
}
export declare class DepthExceededError extends Error {
    readonly currentDepth: number;
    readonly maxDepth: number;
    readonly context?: string | undefined;
    constructor(currentDepth: number, maxDepth: number, context?: string | undefined);
}
/**
 * Depth Guard for tracking recursive calls
 */
export declare class DepthGuard {
    private depth;
    private maxDepth;
    private onMaxDepth?;
    constructor(config: DepthGuardConfig);
    /**
     * Current depth level
     */
    current(): number;
    /**
     * Remaining depth before limit
     */
    remaining(): number;
    /**
     * Check if we can go deeper
     */
    canDescend(): boolean;
    /**
     * Enter a new depth level
     * Throws if max depth exceeded
     */
    enter(context?: string): void;
    /**
     * Exit current depth level
     */
    exit(): void;
    /**
     * Execute a function with depth tracking
     */
    wrap<T>(fn: () => Promise<T>, context?: string): Promise<T>;
    /**
     * Reset depth to zero
     */
    reset(): void;
    /**
     * Create a child guard with reduced remaining depth
     * Useful for passing to sub-agents
     */
    child(): DepthGuard;
}
/**
 * Create a depth guard with default settings
 */
export declare function createDepthGuard(maxDepth?: number): DepthGuard;
/**
 * Header name for passing depth in HTTP requests
 */
export declare const DEPTH_HEADER = "X-Call-Depth";
/**
 * Extract depth from headers and create guard
 */
export declare function depthFromHeaders(headers: Record<string, string | undefined>, maxDepth?: number): DepthGuard;
//# sourceMappingURL=index.d.ts.map