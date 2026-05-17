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
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
let sdk = null;
let tracer = null;
/**
 * Initialize OpenTelemetry tracing
 */
export function initTracing(config) {
    if (config.enabled === false) {
        console.log('[Tracing] Disabled by config');
        return;
    }
    const endpoint = config.jaegerEndpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
    const exporter = new OTLPTraceExporter({
        url: `${endpoint}/v1/traces`,
    });
    sdk = new NodeSDK({
        resource: new Resource({
            [ATTR_SERVICE_NAME]: config.serviceName,
            [ATTR_SERVICE_VERSION]: config.serviceVersion || '1.0.0',
        }),
        traceExporter: exporter,
        instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
    tracer = trace.getTracer(config.serviceName);
    console.log(`[Tracing] Initialized for ${config.serviceName} → ${endpoint}`);
    // Graceful shutdown
    process.on('SIGTERM', () => {
        sdk?.shutdown()
            .then(() => console.log('[Tracing] Shutdown complete'))
            .catch((err) => console.error('[Tracing] Shutdown error:', err));
    });
}
/**
 * Get the active tracer
 */
export function getTracer() {
    if (!tracer) {
        tracer = trace.getTracer('default');
    }
    return tracer;
}
/**
 * Execute a function within a new span
 */
export async function withSpan(name, fn, attributes) {
    const t = getTracer();
    return t.startActiveSpan(name, async (span) => {
        try {
            // Add initial attributes
            if (attributes) {
                for (const [key, value] of Object.entries(attributes)) {
                    span.setAttribute(key, value);
                }
            }
            const result = await fn(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        }
        catch (error) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            span.recordException(error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
        finally {
            span.end();
        }
    });
}
/**
 * Add an event to the current span
 */
export function addSpanEvent(name, attributes) {
    const span = trace.getActiveSpan();
    if (span) {
        span.addEvent(name, attributes);
    }
}
/**
 * Set attributes on the current span
 */
export function setSpanAttributes(attributes) {
    const span = trace.getActiveSpan();
    if (span) {
        for (const [key, value] of Object.entries(attributes)) {
            span.setAttribute(key, value);
        }
    }
}
/**
 * Record an error on the current span
 */
export function recordSpanError(error) {
    const span = trace.getActiveSpan();
    if (span) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    }
}
// Re-export OpenTelemetry types for convenience
export { SpanStatusCode, trace, context };
//# sourceMappingURL=index.js.map