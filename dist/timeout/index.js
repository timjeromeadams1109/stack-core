/**
 * Timeout Utilities - @stack/core
 *
 * Wrap async operations with configurable timeouts.
 */
export class TimeoutError extends Error {
    timeoutMs;
    constructor(message, timeoutMs) {
        super(message);
        this.timeoutMs = timeoutMs;
        this.name = 'TimeoutError';
    }
}
/**
 * Wrap a promise with a timeout
 */
export async function withTimeout(promise, config) {
    const { ms, message, onTimeout } = typeof config === 'number'
        ? { ms: config, message: undefined, onTimeout: undefined }
        : config;
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            onTimeout?.();
            reject(new TimeoutError(message ?? `Operation timed out after ${ms}ms`, ms));
        }, ms);
    });
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    }
    catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
/**
 * Create a timeout wrapper for repeated use
 */
export function createTimeout(defaultMs) {
    return (promise, ms) => {
        return withTimeout(promise, ms ?? defaultMs);
    };
}
/**
 * Deadline - absolute time limit
 */
export class Deadline {
    endTime;
    constructor(ms) {
        this.endTime = Date.now() + ms;
    }
    /**
     * Remaining time until deadline
     */
    remaining() {
        return Math.max(0, this.endTime - Date.now());
    }
    /**
     * Check if deadline has passed
     */
    exceeded() {
        return Date.now() >= this.endTime;
    }
    /**
     * Wrap a promise with remaining deadline time
     */
    async wrap(promise) {
        const remaining = this.remaining();
        if (remaining <= 0) {
            throw new TimeoutError('Deadline exceeded', 0);
        }
        return withTimeout(promise, remaining);
    }
}
/**
 * Create a deadline from now
 */
export function deadline(ms) {
    return new Deadline(ms);
}
//# sourceMappingURL=index.js.map