/**
 * OpenTelemetry tracing utilities
 *
 * Usage:
 *   import { initTracing, trace, withSpan } from '@stack/core'
 *
 *   // Initialize at app startup
 *   initTracing({ serviceName: 'my-app', jaegerEndpoint: 'http://localhost:4318' })
 *
 *   // Create spans
 *   const result = await withSpan('process-request', async (span) => {
 *     span.setAttribute('user.id', userId)
 *     return await processRequest()
 *   })
 */
import { trace, context, SpanStatusCode, Span, Tracer } from '@opentelemetry/api';
export interface TracingConfig {
    serviceName: string;
    serviceVersion?: string;
    jaegerEndpoint?: string;
    enabled?: boolean;
}
/**
 * Initialize OpenTelemetry tracing
 */
export declare function initTracing(config: TracingConfig): void;
/**
 * Get the active tracer
 */
export declare function getTracer(): Tracer;
/**
 * Execute a function within a new span
 */
export declare function withSpan<T>(name: string, fn: (span: Span) => Promise<T>, attributes?: Record<string, string | number | boolean>): Promise<T>;
/**
 * Add an event to the current span
 */
export declare function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void;
/**
 * Set attributes on the current span
 */
export declare function setSpanAttributes(attributes: Record<string, string | number | boolean>): void;
/**
 * Record an error on the current span
 */
export declare function recordSpanError(error: Error): void;
export { Span, SpanStatusCode, trace, context };
//# sourceMappingURL=index.d.ts.map