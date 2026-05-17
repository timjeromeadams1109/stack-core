/**
 * Circuit Breaker Implementation
 *
 * Prevents cascading failures by failing fast when a service is down.
 *
 * States:
 * - CLOSED: Normal operation, requests go through
 * - OPEN: Service is down, requests fail immediately
 * - HALF_OPEN: Testing if service recovered
 */
import type { CircuitBreakerConfig, CircuitStats, CircuitState } from './types.js';
export declare class ServiceCircuitBreaker<T extends unknown[], R> {
    private breaker;
    private config;
    private stats;
    constructor(action: (...args: T) => Promise<R>, config: CircuitBreakerConfig);
    /**
     * Execute the protected action
     */
    fire(...args: T): Promise<R>;
    /**
     * Get the current circuit state
     */
    getState(): CircuitState;
    /**
     * Get circuit statistics
     */
    getStats(): CircuitStats;
    /**
     * Manually open the circuit
     */
    open(): void;
    /**
     * Manually close the circuit
     */
    close(): void;
    /**
     * Check if circuit is healthy
     */
    isHealthy(): boolean;
}
/**
 * Create a circuit breaker for a service call
 */
export declare function createCircuitBreaker<T extends unknown[], R>(name: string, action: (...args: T) => Promise<R>, options?: Partial<CircuitBreakerConfig>): ServiceCircuitBreaker<T, R>;
//# sourceMappingURL=circuit-breaker.d.ts.map