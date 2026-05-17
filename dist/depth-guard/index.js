/**
 * Depth Guard - @stack/core
 *
 * Prevents infinite recursion in agent/workflow systems.
 * Tracks call depth and enforces limits.
 */
export class DepthExceededError extends Error {
    currentDepth;
    maxDepth;
    context;
    constructor(currentDepth, maxDepth, context) {
        super(`Maximum depth exceeded: ${currentDepth}/${maxDepth}${context ? ` (${context})` : ''}`);
        this.currentDepth = currentDepth;
        this.maxDepth = maxDepth;
        this.context = context;
        this.name = 'DepthExceededError';
    }
}
/**
 * Depth Guard for tracking recursive calls
 */
export class DepthGuard {
    depth = 0;
    maxDepth;
    onMaxDepth;
    constructor(config) {
        this.maxDepth = config.maxDepth;
        this.onMaxDepth = config.onMaxDepth;
    }
    /**
     * Current depth level
     */
    current() {
        return this.depth;
    }
    /**
     * Remaining depth before limit
     */
    remaining() {
        return this.maxDepth - this.depth;
    }
    /**
     * Check if we can go deeper
     */
    canDescend() {
        return this.depth < this.maxDepth;
    }
    /**
     * Enter a new depth level
     * Throws if max depth exceeded
     */
    enter(context) {
        if (!this.canDescend()) {
            this.onMaxDepth?.(this.depth, context);
            throw new DepthExceededError(this.depth, this.maxDepth, context);
        }
        this.depth++;
        console.log(`[DepthGuard] Entered level ${this.depth}/${this.maxDepth}${context ? ` (${context})` : ''}`);
    }
    /**
     * Exit current depth level
     */
    exit() {
        if (this.depth > 0) {
            this.depth--;
            console.log(`[DepthGuard] Exited to level ${this.depth}/${this.maxDepth}`);
        }
    }
    /**
     * Execute a function with depth tracking
     */
    async wrap(fn, context) {
        this.enter(context);
        try {
            return await fn();
        }
        finally {
            this.exit();
        }
    }
    /**
     * Reset depth to zero
     */
    reset() {
        this.depth = 0;
    }
    /**
     * Create a child guard with reduced remaining depth
     * Useful for passing to sub-agents
     */
    child() {
        return new DepthGuard({
            maxDepth: this.remaining(),
            onMaxDepth: this.onMaxDepth,
        });
    }
}
/**
 * Create a depth guard with default settings
 */
export function createDepthGuard(maxDepth = 10) {
    return new DepthGuard({ maxDepth });
}
/**
 * Header name for passing depth in HTTP requests
 */
export const DEPTH_HEADER = 'X-Call-Depth';
/**
 * Extract depth from headers and create guard
 */
export function depthFromHeaders(headers, maxDepth = 10) {
    const currentDepth = parseInt(headers[DEPTH_HEADER] ?? '0', 10);
    const guard = new DepthGuard({ maxDepth });
    // Set to current depth (simulate previous enters)
    for (let i = 0; i < currentDepth; i++) {
        guard.enter('from-header');
    }
    // Exit them so the guard is at the right level but can still enter
    for (let i = 0; i < currentDepth; i++) {
        guard.exit();
    }
    return guard;
}
//# sourceMappingURL=index.js.map