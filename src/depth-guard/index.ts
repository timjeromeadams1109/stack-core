/**
 * Depth Guard - @stack/core
 *
 * Prevents infinite recursion in agent/workflow systems.
 * Tracks call depth and enforces limits.
 */

export interface DepthGuardConfig {
  maxDepth: number
  onMaxDepth?: (depth: number, context?: string) => void
}

export class DepthExceededError extends Error {
  constructor(
    public readonly currentDepth: number,
    public readonly maxDepth: number,
    public readonly context?: string
  ) {
    super(
      `Maximum depth exceeded: ${currentDepth}/${maxDepth}${context ? ` (${context})` : ''}`
    )
    this.name = 'DepthExceededError'
  }
}

/**
 * Depth Guard for tracking recursive calls
 */
export class DepthGuard {
  private depth = 0
  private maxDepth: number
  private onMaxDepth?: (depth: number, context?: string) => void

  constructor(config: DepthGuardConfig) {
    this.maxDepth = config.maxDepth
    this.onMaxDepth = config.onMaxDepth
  }

  /**
   * Current depth level
   */
  current(): number {
    return this.depth
  }

  /**
   * Remaining depth before limit
   */
  remaining(): number {
    return this.maxDepth - this.depth
  }

  /**
   * Check if we can go deeper
   */
  canDescend(): boolean {
    return this.depth < this.maxDepth
  }

  /**
   * Enter a new depth level
   * Throws if max depth exceeded
   */
  enter(context?: string): void {
    if (!this.canDescend()) {
      this.onMaxDepth?.(this.depth, context)
      throw new DepthExceededError(this.depth, this.maxDepth, context)
    }
    this.depth++
    console.log(`[DepthGuard] Entered level ${this.depth}/${this.maxDepth}${context ? ` (${context})` : ''}`)
  }

  /**
   * Exit current depth level
   */
  exit(): void {
    if (this.depth > 0) {
      this.depth--
      console.log(`[DepthGuard] Exited to level ${this.depth}/${this.maxDepth}`)
    }
  }

  /**
   * Execute a function with depth tracking
   */
  async wrap<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    this.enter(context)
    try {
      return await fn()
    } finally {
      this.exit()
    }
  }

  /**
   * Reset depth to zero
   */
  reset(): void {
    this.depth = 0
  }

  /**
   * Create a child guard with reduced remaining depth
   * Useful for passing to sub-agents
   */
  child(): DepthGuard {
    return new DepthGuard({
      maxDepth: this.remaining(),
      onMaxDepth: this.onMaxDepth,
    })
  }
}

/**
 * Create a depth guard with default settings
 */
export function createDepthGuard(maxDepth = 10): DepthGuard {
  return new DepthGuard({ maxDepth })
}

/**
 * Header name for passing depth in HTTP requests
 */
export const DEPTH_HEADER = 'X-Call-Depth'

/**
 * Extract depth from headers and create guard
 */
export function depthFromHeaders(
  headers: Record<string, string | undefined>,
  maxDepth = 10
): DepthGuard {
  const currentDepth = parseInt(headers[DEPTH_HEADER] ?? '0', 10)
  const guard = new DepthGuard({ maxDepth })

  // Set to current depth (simulate previous enters)
  for (let i = 0; i < currentDepth; i++) {
    guard.enter('from-header')
  }
  // Exit them so the guard is at the right level but can still enter
  for (let i = 0; i < currentDepth; i++) {
    guard.exit()
  }

  return guard
}
