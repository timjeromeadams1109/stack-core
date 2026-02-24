# @stack/core

Resilient patterns for production-grade applications. Never lose a job, prevent duplicates, fail fast, and stop runaway processes.

## Installation

```bash
npm install @stack/core
# or link locally
npm link
```

## Quick Start

```typescript
import { createStack } from '@stack/core'

// Initialize the stack
const stack = createStack({
  redis: { url: 'redis://localhost:6379' },
  defaults: {
    queueRetries: 3,
    timeoutMs: 300000,    // 5 minutes
    maxDepth: 10,
  }
})

// Create a queue with DLQ, idempotency, and timeouts built-in
const jobQueue = stack.queue('jobs')

// Add a job (duplicates are automatically ignored)
await jobQueue.add('process-pdf', { fileId: '123' })

// Process jobs
jobQueue.process(async (job) => {
  console.log('Processing:', job.data)
  return { success: true }
})
```

## The 4 Pillars

### 1. Dead Letter Queue (DLQ)

Failed jobs are automatically moved to a DLQ after max retries. Inspect, fix, and replay them.

```typescript
// Jobs automatically go to DLQ after 3 failures
const queue = stack.queue('jobs', {
  dlq: { maxRetries: 3, enabled: true }
})

// View failed jobs
const failedJobs = await queue.getDLQJobs()

// Replay a failed job
await queue.replayDLQJob(failedJobs[0].id)

// Clear all failed jobs
await queue.clearDLQ()
```

### 2. Idempotency

Prevent duplicate processing. Same input = same output (from cache).

```typescript
// Built into queues automatically
await queue.add('process', { id: '123' })  // Runs
await queue.add('process', { id: '123' })  // Skipped (cache hit)

// Standalone idempotency for any operation
const idem = stack.idempotency()
const key = idem.generateKey('user-123', 'action-signup')

const result = await idem.execute(key, async () => {
  // This only runs once per key (within TTL)
  return await createUser('user-123')
})

console.log(result.cached)  // true if from cache
```

### 3. Circuit Breaker

Fail fast when services are down. Prevent cascade failures.

```typescript
// Wrap external service calls
const claudeService = stack.circuitBreaker(
  'claude',
  async (prompt: string) => {
    return await anthropic.messages.create({ ... })
  },
  {
    timeout: 30000,        // 30s timeout
    errorThreshold: 50,    // Trip after 50% failure rate
    resetTimeout: 30000,   // Try again after 30s
  }
)

// Use it - automatically fails fast when Claude is down
try {
  const response = await claudeService.fire('Hello')
} catch (error) {
  // Circuit open - Claude is down, we failed fast
}

// Check circuit health
claudeService.getState()  // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
```

### 4. Timeout & Depth Guard

Kill runaway processes. Prevent infinite loops.

```typescript
// Timeout any operation
const result = await stack.timeout(
  fetchFromSlowAPI(),
  30000  // 30 second timeout
)

// Deadline - absolute time limit across multiple operations
const dl = stack.deadline(60000)  // 1 minute total

await dl.wrap(step1())  // Uses remaining time
await dl.wrap(step2())  // Uses remaining time
await dl.wrap(step3())  // Fails if deadline exceeded

// Depth guard - prevent infinite agent recursion
const depth = stack.depthGuard(5)

async function agentCall() {
  await depth.wrap(async () => {
    // This can only go 5 levels deep
    if (needsSubAgent) {
      await agentCall()  // Throws at depth 6
    }
  }, 'agent-task')
}
```

## Full API

### Stack

```typescript
const stack = createStack({
  redis: { url: 'redis://localhost:6379' },
  defaults: {
    queueRetries: 3,
    timeoutMs: 300000,
    circuitThreshold: 50,
    maxDepth: 10,
    idempotencyTtl: 86400,
  }
})

stack.queue(name, options)           // Create/get a resilient queue
stack.circuitBreaker(name, fn, opts) // Wrap a service call
stack.depthGuard(maxDepth)           // Create a depth limiter
stack.idempotency(options)           // Create idempotency manager
stack.timeout(promise, ms)           // Wrap with timeout
stack.deadline(ms)                   // Create a deadline
stack.getRedis()                     // Get Redis connection
stack.close()                        // Cleanup all resources
```

### Queue

```typescript
const queue = stack.queue<InputType, ResultType>('name')

await queue.add(jobName, data, options)  // Add a job
queue.process(async (job) => result)     // Process jobs

await queue.getStats()      // { waiting, active, completed, failed, dlq }
await queue.getDLQJobs()    // Get failed jobs
await queue.replayDLQJob(id)// Replay a failed job
await queue.clearDLQ()      // Clear all failed jobs
await queue.close()         // Shutdown
```

### Circuit Breaker

```typescript
const breaker = stack.circuitBreaker('name', asyncFn, {
  timeout: 10000,
  errorThreshold: 50,
  volumeThreshold: 5,
  resetTimeout: 30000,
})

await breaker.fire(...args)  // Execute with protection
breaker.getState()           // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
breaker.getStats()           // { failures, successes, rejects, ... }
breaker.isHealthy()          // true if CLOSED
```

## Integration with detailer.ai

```typescript
// src/lib/stack.ts
import { createStack } from '@stack/core'

export const stack = createStack({
  redis: { url: process.env.REDIS_URL },
})

// In your pipeline worker
import { stack } from '@/lib/stack'

const pipelineQueue = stack.queue('pipeline')
const claudeService = stack.circuitBreaker('claude', callClaude)

pipelineQueue.process(async (job) => {
  const depth = stack.depthGuard(5)

  // AI calls are protected by circuit breaker
  const extraction = await claudeService.fire(job.data.text)

  return extraction
})
```

## Environment Variables

```bash
REDIS_URL=redis://localhost:6379
```

## License

MIT
