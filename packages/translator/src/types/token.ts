/**
 * Token types for normalization
 */

/** Token from NL tokenization */
export interface Token {
  /** Original text from input */
  readonly original: string;
  /** Normalized form (canonical) */
  readonly normalized: string;
  /** Part of speech tag */
  readonly pos: string;
  /** Start offset in original text */
  readonly start: number;
  /** End offset in original text */
  readonly end: number;
}
