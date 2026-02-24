/**
 * Timeout Utilities - @stack/core
 *
 * Wrap async operations with configurable timeouts.
 */

export interface TimeoutConfig {
  ms: number
  message?: string
  onTimeout?: () => void
}

export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Wrap a promise with a timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  config: TimeoutConfig | number
): Promise<T> {
  const { ms, message, onTimeout } =
    typeof config === 'number'
      ? { ms: config, message: undefined, onTimeout: undefined }
      : config

  let timeoutId: NodeJS.Timeout

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout?.()
      reject(new TimeoutError(message ?? `Operation timed out after ${ms}ms`, ms))
    }, ms)
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    clearTimeout(timeoutId!)
    return result
  } catch (error) {
    clearTimeout(timeoutId!)
    throw error
  }
}

/**
 * Create a timeout wrapper for repeated use
 */
export function createTimeout(defaultMs: number) {
  return <T>(promise: Promise<T>, ms?: number): Promise<T> => {
    return withTimeout(promise, ms ?? defaultMs)
  }
}

/**
 * Deadline - absolute time limit
 */
export class Deadline {
  private endTime: number

  constructor(ms: number) {
    this.endTime = Date.now() + ms
  }

  /**
   * Remaining time until deadline
   */
  remaining(): number {
    return Math.max(0, this.endTime - Date.now())
  }

  /**
   * Check if deadline has passed
   */
  exceeded(): boolean {
    return Date.now() >= this.endTime
  }

  /**
   * Wrap a promise with remaining deadline time
   */
  async wrap<T>(promise: Promise<T>): Promise<T> {
    const remaining = this.remaining()
    if (remaining <= 0) {
      throw new TimeoutError('Deadline exceeded', 0)
    }
    return withTimeout(promise, remaining)
  }
}

/**
 * Create a deadline from now
 */
export function deadline(ms: number): Deadline {
  return new Deadline(ms)
}
