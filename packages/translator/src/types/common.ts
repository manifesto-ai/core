/**
 * Common types for Translator
 */

/** Semantic path in schema (e.g., "User.age", "Order.items[0].price") */
export type SemanticPath = string;

/** ISO 639-1 language code (e.g., "en", "ko", "fr") */
export type LanguageCode = string;

/** Fallback behavior when ambiguity resolution times out */
export type FallbackBehavior = "guess" | "discard";
