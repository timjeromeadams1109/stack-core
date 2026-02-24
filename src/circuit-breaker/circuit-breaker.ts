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

import CircuitBreaker from 'opossum'
import type { CircuitBreakerConfig, CircuitStats, CircuitState } from './types.js'

const DEFAULT_CONFIG = {
  timeout: 10000,        // 10 seconds
  errorThreshold: 50,    // 50% failure rate trips the breaker
  volumeThreshold: 5,    // Need at least 5 requests to trip
  resetTimeout: 30000,   // Try again after 30 seconds
}

export class ServiceCircuitBreaker<T extends unknown[], R> {
  private breaker: CircuitBreaker<T, R>
  private config: CircuitBreakerConfig
  private stats = {
    failures: 0,
    successes: 0,
    rejects: 0,
    fallbacks: 0,
    lastFailure: undefined as Date | undefined,
    lastSuccess: undefined as Date | undefined,
  }

  constructor(
    action: (...args: T) => Promise<R>,
    config: CircuitBreakerConfig
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }

    this.breaker = new CircuitBreaker(action, {
      timeout: this.config.timeout,
      errorThresholdPercentage: this.config.errorThreshold,
      volumeThreshold: this.config.volumeThreshold,
      resetTimeout: this.config.resetTimeout,
      name: this.config.name,
    })

    // Set up fallback if provided
    if (this.config.fallback) {
      this.breaker.fallback(this.config.fallback)
    }

    // Track events
    this.breaker.on('success', () => {
      this.stats.successes++
      this.stats.lastSuccess = new Date()
      console.log(`[Circuit:${this.config.name}] Success`)
    })

    this.breaker.on('failure', () => {
      this.stats.failures++
      this.stats.lastFailure = new Date()
      console.log(`[Circuit:${this.config.name}] Failure`)
    })

    this.breaker.on('reject', () => {
      this.stats.rejects++
      console.log(`[Circuit:${this.config.name}] Rejected (circuit open)`)
    })

    this.breaker.on('fallback', () => {
      this.stats.fallbacks++
      console.log(`[Circuit:${this.config.name}] Fallback used`)
    })

    this.breaker.on('open', () => {
      console.log(`[Circuit:${this.config.name}] OPENED - failing fast for ${this.config.resetTimeout}ms`)
    })

    this.breaker.on('halfOpen', () => {
      console.log(`[Circuit:${this.config.name}] HALF-OPEN - testing recovery`)
    })

    this.breaker.on('close', () => {
      console.log(`[Circuit:${this.config.name}] CLOSED - service recovered`)
    })
  }

  /**
   * Execute the protected action
   */
  async fire(...args: T): Promise<R> {
    return this.breaker.fire(...args)
  }

  /**
   * Get the current circuit state
   */
  getState(): CircuitState {
    if (this.breaker.opened) return 'OPEN'
    if (this.breaker.halfOpen) return 'HALF_OPEN'
    return 'CLOSED'
  }

  /**
   * Get circuit statistics
   */
  getStats(): CircuitStats {
    const opossumStats = this.breaker.stats

    return {
      state: this.getState(),
      failures: this.stats.failures,
      successes: this.stats.successes,
      rejects: this.stats.rejects,
      fallbacks: this.stats.fallbacks,
      latencyMean: opossumStats.latencyMean ?? 0,
      lastFailure: this.stats.lastFailure,
      lastSuccess: this.stats.lastSuccess,
    }
  }

  /**
   * Manually open the circuit
   */
  open(): void {
    this.breaker.open()
  }

  /**
   * Manually close the circuit
   */
  close(): void {
    this.breaker.close()
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy(): boolean {
    return this.getState() === 'CLOSED'
  }
}

/**
 * Create a circuit breaker for a service call
 */
export function createCircuitBreaker<T extends unknown[], R>(
  name: string,
  action: (...args: T) => Promise<R>,
  options?: Partial<CircuitBreakerConfig>
): ServiceCircuitBreaker<T, R> {
  return new ServiceCircuitBreaker(action, { name, ...options })
}
