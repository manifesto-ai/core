/**
 * @manifesto-ai/effect-utils
 *
 * DX layer for building Effect Handlers in Manifesto.
 * Provides combinators, transforms, and schema-driven handler factory.
 *
 * @packageDocumentation
 */
// ═══════════════════════════════════════════════════════════
// Combinators
// ═══════════════════════════════════════════════════════════
export { withTimeout } from "./combinators/timeout.js";
export { withRetry } from "./combinators/retry.js";
export { withFallback } from "./combinators/fallback.js";
export { parallel } from "./combinators/parallel.js";
export { race } from "./combinators/race.js";
export { sequential } from "./combinators/sequential.js";
// ═══════════════════════════════════════════════════════════
// Transforms
// ═══════════════════════════════════════════════════════════
export { toPatch, toPatches } from "./transforms/patch.js";
export { toErrorPatch, toErrorPatches } from "./transforms/error.js";
export { collectErrors, collectFulfilled } from "./transforms/collect.js";
// ═══════════════════════════════════════════════════════════
// Schema & Handler Factory
// ═══════════════════════════════════════════════════════════
export { defineEffectSchema } from "./schema/define.js";
export { createHandler } from "./schema/handler.js";
// ═══════════════════════════════════════════════════════════
// Errors
// ═══════════════════════════════════════════════════════════
export { EffectUtilsError, TimeoutError, RetryError, ValidationError, isTimeoutError, isRetryError, isValidationError, isEffectUtilsError, } from "./errors/index.js";
// Type guards
export { isFulfilled, isRejected, isErrorValue } from "./types/index.js";
//# sourceMappingURL=index.js.map