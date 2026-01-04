/**
 * Stage 1: Normalization
 *
 * Normalizes input text:
 * - Detects language
 * - Applies glossary-based canonicalization
 * - Preserves protected tokens
 *
 * MUST be deterministic.
 */

import type {
  NormalizationResult,
  NormalizationTrace,
  ProtectedToken,
  GlossaryHit,
  Glossary,
} from "../domain/index.js";
import type { PipelineState, StageResult } from "./types.js";

/**
 * Execute normalization stage
 */
export async function executeNormalization(
  text: string,
  state: PipelineState
): Promise<StageResult<NormalizationResult>> {
  const startTime = Date.now();

  try {
    const glossary = state.context.glossary;
    const result = normalizeText(text, glossary);
    const durationMs = Date.now() - startTime;

    return {
      success: true,
      data: result,
      durationMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Normalize text with optional glossary
 */
function normalizeText(
  text: string,
  glossary?: Glossary
): NormalizationResult {
  // Detect language (best effort)
  const language = detectLanguage(text);

  // Extract and protect tokens
  const { tokens, textWithPlaceholders } = extractProtectedTokens(text);

  // Apply glossary normalization
  const { canonical, glossaryHits } = applyGlossary(
    textWithPlaceholders,
    glossary,
    language
  );

  // Restore protected tokens in the canonical form
  const finalCanonical = restoreProtectedTokens(canonical, tokens);

  return {
    canonical: finalCanonical.trim(),
    language,
    tokens,
    glossaryHits,
  };
}

/**
 * Detect language (best effort, heuristic-based)
 */
function detectLanguage(text: string): string {
  // Simple heuristic based on character ranges
  const sample = text.slice(0, 1000);

  // Korean
  if (/[\uAC00-\uD7AF]/.test(sample)) {
    return "ko";
  }

  // Japanese (Hiragana, Katakana, CJK)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) {
    return "ja";
  }

  // Chinese (CJK Unified Ideographs)
  if (/[\u4E00-\u9FFF]/.test(sample) && !/[\uAC00-\uD7AF]/.test(sample)) {
    return "zh";
  }

  // Russian (Cyrillic)
  if (/[\u0400-\u04FF]/.test(sample)) {
    return "ru";
  }

  // Arabic
  if (/[\u0600-\u06FF]/.test(sample)) {
    return "ar";
  }

  // Hebrew
  if (/[\u0590-\u05FF]/.test(sample)) {
    return "he";
  }

  // Thai
  if (/[\u0E00-\u0E7F]/.test(sample)) {
    return "th";
  }

  // Default to English
  return "en";
}

/**
 * Extract protected tokens (identifiers, numbers, quoted strings)
 */
function extractProtectedTokens(text: string): {
  tokens: ProtectedToken[];
  textWithPlaceholders: string;
} {
  const tokens: ProtectedToken[] = [];
  let result = text;
  let offset = 0;

  // Pattern for protected tokens
  const patterns: { regex: RegExp; kind: ProtectedToken["kind"] }[] = [
    // Quoted strings (double quotes)
    { regex: /"[^"]*"/g, kind: "quoted" },
    // Quoted strings (single quotes)
    { regex: /'[^']*'/g, kind: "quoted" },
    // Backtick strings
    { regex: /`[^`]*`/g, kind: "quoted" },
    // Numbers with units
    { regex: /\d+(?:\.\d+)?(?:\s*(?:ms|s|m|h|d|%|px|em|rem|vh|vw))?/g, kind: "number" },
    // Identifiers (camelCase, snake_case, CONST_CASE)
    { regex: /\$?[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*/g, kind: "identifier" },
    // Symbols and operators
    { regex: /[<>=!]+|&&|\|\||\?\?/g, kind: "symbol" },
  ];

  for (const { regex, kind } of patterns) {
    const matches = [...text.matchAll(regex)];
    for (const match of matches) {
      if (match.index === undefined) continue;

      const original = match[0];
      const start = match.index;
      const end = start + original.length;

      // Check if this position overlaps with existing tokens
      const overlaps = tokens.some(
        (t) =>
          (start >= t.position.start && start < t.position.end) ||
          (end > t.position.start && end <= t.position.end)
      );

      if (!overlaps) {
        tokens.push({
          original,
          position: { start, end },
          kind,
        });
      }
    }
  }

  // Sort tokens by position
  tokens.sort((a, b) => a.position.start - b.position.start);

  // Replace tokens with placeholders
  let placeholderResult = "";
  let lastEnd = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    placeholderResult += text.slice(lastEnd, token.position.start);
    placeholderResult += `__TOKEN_${i}__`;
    lastEnd = token.position.end;
  }
  placeholderResult += text.slice(lastEnd);

  return {
    tokens,
    textWithPlaceholders: placeholderResult,
  };
}

/**
 * Apply glossary-based canonicalization
 */
function applyGlossary(
  text: string,
  glossary: Glossary | undefined,
  language: string
): { canonical: string; glossaryHits: GlossaryHit[] } {
  if (!glossary) {
    return { canonical: text, glossaryHits: [] };
  }

  const hits: GlossaryHit[] = [];
  let result = text;

  // Check each entry in the glossary
  for (const entry of Object.values(glossary.entries)) {
    // Get aliases for the detected language and English
    const aliases = [
      ...(entry.aliases[language] ?? []),
      ...(language !== "en" ? entry.aliases.en ?? [] : []),
    ];

    for (const alias of aliases) {
      const aliasLower = alias.toLowerCase();
      const regex = new RegExp(`\\b${escapeRegex(alias)}\\b`, "gi");

      if (regex.test(result)) {
        // Record hit
        hits.push({
          semanticId: entry.semanticId,
          canonical: entry.canonical,
          originalTerm: alias,
          confidence: 1.0,
        });

        // Replace with canonical form
        result = result.replace(regex, entry.canonical);
      }
    }
  }

  return { canonical: result, glossaryHits: hits };
}

/**
 * Restore protected tokens from placeholders
 */
function restoreProtectedTokens(
  text: string,
  tokens: ProtectedToken[]
): string {
  let result = text;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const placeholder = `__TOKEN_${i}__`;
    result = result.replace(placeholder, tokens[i].original);
  }

  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Create normalization trace
 */
export function createNormalizationTrace(
  result: NormalizationResult,
  durationMs: number
): NormalizationTrace {
  return {
    detectedLanguage: result.language,
    glossaryHitCount: result.glossaryHits.length,
    protectedTokenCount: result.tokens.length,
    durationMs,
  };
}
