/**
 * @fileoverview S1: Normalize Stage
 *
 * Normalizes PF (Phonetic Form / natural language text).
 * Deterministic stage.
 * Aligned with SPEC §5.1 S1.
 */

import { createError, type TranslatorError } from "../types/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Normalize stage result
 */
export type NormalizeResult =
  | { readonly ok: true; readonly normalized: string; readonly detectedLang: string }
  | { readonly ok: false; readonly error: TranslatorError };

/**
 * Normalize trace output
 */
export type NormalizeTrace = {
  readonly original: string;
  readonly normalized: string;
  readonly detectedLang: string;
};

// =============================================================================
// Language Detection
// =============================================================================

/**
 * Simple language detection based on character ranges
 * Heuristic for v0.1
 */
function detectLang(text: string): string {
  // Korean characters
  if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/.test(text)) {
    return "ko";
  }

  // Japanese characters (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
    return "ja";
  }

  // Chinese characters (CJK Unified Ideographs)
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return "zh";
  }

  // Default to English
  return "en";
}

// =============================================================================
// Normalization
// =============================================================================

/**
 * Normalize text
 *
 * 1. Unicode NFKC normalization
 * 2. Trim whitespace
 * 3. Collapse multiple spaces
 *
 * @param text - Raw input text
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

// =============================================================================
// Stage Implementation
// =============================================================================

/**
 * S1: Normalize PF text
 *
 * TAPP-PIPE-1: This stage is deterministic.
 *
 * @param text - Natural language input
 * @returns NormalizeResult - Normalized text or error
 */
export function normalize(text: string): NormalizeResult {
  // Validate input
  if (text === null || text === undefined) {
    return {
      ok: false,
      error: createError(
        "NORMALIZE_FAILED",
        "Input text is null or undefined",
        { stage: "normalize", recoverable: true }
      ),
    };
  }

  if (typeof text !== "string") {
    return {
      ok: false,
      error: createError(
        "NORMALIZE_FAILED",
        "Input text must be a string",
        { stage: "normalize", recoverable: true }
      ),
    };
  }

  // Normalize
  const normalized = normalizeText(text);

  // Check if empty after normalization
  if (normalized.length === 0) {
    return {
      ok: false,
      error: createError(
        "NORMALIZE_FAILED",
        "Input text is empty after normalization",
        { stage: "normalize", recoverable: true }
      ),
    };
  }

  // Detect language
  const detectedLang = detectLang(normalized);

  return {
    ok: true,
    normalized,
    detectedLang,
  };
}

/**
 * Create normalize trace from result
 */
export function createNormalizeTrace(
  original: string,
  result: NormalizeResult
): NormalizeTrace | undefined {
  if (!result.ok) {
    return undefined;
  }

  return {
    original,
    normalized: result.normalized,
    detectedLang: result.detectedLang,
  };
}
