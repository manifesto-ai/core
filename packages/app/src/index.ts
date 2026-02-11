/**
 * @manifesto-ai/app
 *
 * Compatibility wrapper. Re-exports everything from @manifesto-ai/sdk.
 *
 * @deprecated Import from `@manifesto-ai/sdk` directly.
 * @packageDocumentation
 * @module @manifesto-ai/app
 */

export * from "@manifesto-ai/sdk";

// Backward-compat alias (v2.2.0 name)
export type { EffectHandler as AppEffectHandler } from "@manifesto-ai/shared";
