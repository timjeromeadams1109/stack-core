/**
 * Circuit Breaker Types
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  name: string
  timeout?: number              // Request timeout in ms (default: 10000)
  errorThreshold?: number       // Percent of failures to trip (default: 50)
  volumeThreshold?: number      // Min requests before tripping (default: 5)
  resetTimeout?: number         // Time before trying again (default: 30000)
  fallback?: <T>() => T | Promise<T>
}

export interface CircuitStats {
  state: CircuitState
  failures: number
  successes: number
  rejects: number              // Requests rejected while open
  fallbacks: number
  latencyMean: number
  lastFailure?: Date
  lastSuccess?: Date
}
