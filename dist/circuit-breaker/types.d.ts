/**
 * Circuit Breaker Types
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export interface CircuitBreakerConfig {
    name: string;
    timeout?: number;
    errorThreshold?: number;
    volumeThreshold?: number;
    resetTimeout?: number;
    fallback?: <T>() => T | Promise<T>;
}
export interface CircuitStats {
    state: CircuitState;
    failures: number;
    successes: number;
    rejects: number;
    fallbacks: number;
    latencyMean: number;
    lastFailure?: Date;
    lastSuccess?: Date;
}
//# sourceMappingURL=types.d.ts.map