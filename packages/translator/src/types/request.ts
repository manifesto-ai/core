/**
 * Translation request types
 */

import type { FallbackBehavior, LanguageCode } from "./common.js";

/** Translation options */
export interface TranslationOptions {
  /** Language hint for normalization (ISO 639-1) */
  readonly language: LanguageCode | null;
  /** Maximum anchor candidates to retrieve */
  readonly maxCandidates: number;
  /** Resolution timeout in milliseconds */
  readonly timeoutMs: number;
  /** Fallback behavior when resolution times out */
  readonly fallbackBehavior: FallbackBehavior;
}

/** Default translation options */
export const DEFAULT_TRANSLATION_OPTIONS: TranslationOptions = {
  language: null,
  maxCandidates: 5,
  timeoutMs: 300000,
  fallbackBehavior: "guess",
};

/** Translation request */
export interface TranslationRequest {
  /** Natural language input */
  readonly input: string;
  /** Target schema ID to translate against */
  readonly targetSchemaId: string;
  /** Intent ID for tracking */
  readonly intentId: string;
  /** Optional translation options */
  readonly options: TranslationOptions | null;
}
