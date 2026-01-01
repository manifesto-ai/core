/**
 * Effect Handlers for Translator
 *
 * Implements the four translator effects:
 * - createNormalizeHandler: llm.normalize effect
 * - createFastPathHandler: translator.fastPath effect
 * - createRetrieveHandler: translator.retrieve effect
 * - createProposeHandler: llm.propose effect
 *
 * All handlers:
 * - NEVER throw (return error patches instead)
 * - Return Patch[] following effect-utils pattern
 * - Are type-safe via Zod validation
 */

import type { Patch } from "@manifesto-ai/core";
import type { EffectContext } from "@manifesto-ai/host";
import { createHandler } from "@manifesto-ai/effect-utils";

import {
  normalizeSchema,
  fastPathSchema,
  retrieveSchema,
  proposeSchema,
} from "./schemas.js";

import type { LLMAdapter, SchemaRegistry } from "./types.js";
import type { GlossaryEntry, Token } from "../types/index.js";
import { matchFastPath } from "../fast-path/index.js";
import { buildIndex, search, type SchemaInfo } from "../retrieval/index.js";

// =============================================================================
// Type Aliases
// =============================================================================

type EffectHandler = (
  type: string,
  params: Record<string, unknown>,
  context: EffectContext
) => Promise<Patch[]>;

// =============================================================================
// Normalize Handler
// =============================================================================

/**
 * Creates the llm.normalize effect handler
 *
 * Normalizes raw NL text to canonical English with tokenization.
 * Uses LLM for:
 * - Language detection
 * - Translation to canonical English
 * - Tokenization
 * - Glossary matching
 *
 * @param llmAdapter - LLM adapter for API calls
 */
export function createNormalizeHandler(llmAdapter: LLMAdapter): EffectHandler {
  return createHandler(normalizeSchema, async (input, _context) => {
    // Call LLM adapter with translator.normalize protocol
    const result = await llmAdapter.call("translator.normalize", {
      text: input.text,
      languageHint: input.languageHint ?? null,
    });

    // LLM returns NormalizationResult directly
    return result as {
      canonical: string;
      language: string;
      tokens: Array<{
        original: string;
        normalized: string;
        pos: string;
        start: number;
        end: number;
      }>;
      glossaryHits: Array<{
        semanticId: string;
        canonical: string;
        matchedAlias: string;
        language: string;
        confidence: number;
      }>;
      protected: Array<{
        start: number;
        end: number;
        kind: "identifier" | "number" | "literal" | "operator";
        value: string;
      }>;
    };
  });
}

// =============================================================================
// FastPath Handler
// =============================================================================

/**
 * Creates the translator.fastPath effect handler
 *
 * Attempts fast-path pattern matching without LLM.
 * Uses local pattern matching for:
 * - Comparator patterns (gte, lte, eq, etc.)
 * - Range patterns (between X and Y)
 * - Length patterns (minLen, maxLen)
 * - Inclusion patterns (in, notIn)
 * - Required patterns
 * - Boolean patterns
 *
 * @param schemaRegistry - Schema registry for type information
 */
export function createFastPathHandler(schemaRegistry: SchemaRegistry): EffectHandler {
  return createHandler(fastPathSchema, async (input, _context) => {
    // Get type index for pattern matching
    const typeIndex = schemaRegistry.getTypeIndex(input.schemaId);

    // Convert input tokens to Token[]
    const tokens: Token[] = input.tokens.map((t) => ({
      original: t.original,
      normalized: t.normalized,
      pos: t.pos,
      start: t.start,
      end: t.end,
    }));

    // Attempt fast path matching
    const result = matchFastPath(input.canonical, tokens, typeIndex);

    return {
      matched: result.matched,
      pattern: result.pattern,
      fragment: result.fragment,
      confidence: result.confidence,
    };
  });
}

// =============================================================================
// Retrieve Handler
// =============================================================================

/**
 * Creates the translator.retrieve effect handler
 *
 * Retrieves anchor candidates using BM25 search.
 * Uses lunr.js for:
 * - Field name indexing
 * - Description indexing
 * - Glossary alias indexing
 * - Weighted scoring
 *
 * @param schemaRegistry - Schema registry for schema access
 * @param glossary - Glossary entries for alias matching
 */
export function createRetrieveHandler(
  schemaRegistry: SchemaRegistry,
  glossary: GlossaryEntry[]
): EffectHandler {
  return createHandler(retrieveSchema, async (input, _context) => {
    // Get schema info for indexing
    const schema = schemaRegistry.getSchema(input.schemaId);

    // Build schema info for retrieval
    const schemaInfo: SchemaInfo = {
      fields: Object.fromEntries(
        Object.entries(schema.state.fields).map(([path, field]) => [
          path,
          {
            name: field.name,
            description: field.description,
            type: field.type,
          },
        ])
      ),
    };

    // Build index
    const index = buildIndex(schemaInfo, glossary);

    // Extract query terms from tokens
    const queryTerms = input.terms.map((t: Token) => t.normalized);

    // Add glossary hit canonicals as query terms
    for (const hit of input.glossaryHits) {
      if (!queryTerms.includes(hit.canonical)) {
        queryTerms.push(hit.canonical);
      }
    }

    // Search
    const candidates = search(index, queryTerms, {
      maxCandidates: input.maxCandidates,
    });

    return {
      tier: 0, // Tier 0 = lunr.js
      candidates: candidates.map((c) => ({
        path: c.path,
        score: c.score,
        matchType: c.matchType,
        typeHint: c.typeHint ?? null,
      })),
      queryTerms,
    };
  });
}

// =============================================================================
// Propose Handler
// =============================================================================

/**
 * Creates the llm.propose effect handler
 *
 * Proposes PatchFragment from candidates using LLM.
 * Uses LLM for:
 * - Anchor selection
 * - Constraint generation
 * - Ambiguity detection
 * - Confidence estimation
 *
 * @param llmAdapter - LLM adapter for API calls
 * @param schemaRegistry - Schema registry for type validation
 */
export function createProposeHandler(
  llmAdapter: LLMAdapter,
  schemaRegistry: SchemaRegistry
): EffectHandler {
  return createHandler(proposeSchema, async (input, _context) => {
    // Call LLM adapter with translator.propose protocol
    const result = await llmAdapter.call("translator.propose", {
      canonical: input.canonical,
      tokens: input.tokens,
      candidates: input.candidates,
      schemaId: input.schemaId,
      timeoutMs: input.timeoutMs,
      fallbackBehavior: input.fallbackBehavior,
    });

    // LLM returns ProposalResult directly
    return result as {
      fragment: {
        id: string;
        description: string;
        changes: unknown[];
        metadata?: {
          source?: string;
          confidence?: number;
          createdAt?: number;
        };
      } | null;
      ambiguity: {
        kind: "anchor" | "intent" | "value" | "conflict";
        question: string;
        options: Array<{
          id: string;
          label: string;
          fragment: {
            id: string;
            description: string;
            changes: unknown[];
          };
          confidence: number;
        }>;
        fallbackBehavior: "guess" | "discard";
        expiresAt: number | null;
      } | null;
      confidence: number;
      reasoning: string | null;
    };
  });
}

// =============================================================================
// Handler Registry
// =============================================================================

/**
 * Creates all translator effect handlers
 *
 * @param config - Translator host configuration
 * @returns Map of effect type to handler
 */
export function createTranslatorHandlers(config: {
  llmAdapter: LLMAdapter;
  schemaRegistry: SchemaRegistry;
  glossary?: GlossaryEntry[];
}): Record<string, EffectHandler> {
  const glossary = config.glossary ?? [];

  return {
    "llm.normalize": createNormalizeHandler(config.llmAdapter),
    "translator.fastPath": createFastPathHandler(config.schemaRegistry),
    "translator.retrieve": createRetrieveHandler(config.schemaRegistry, glossary),
    "llm.propose": createProposeHandler(config.llmAdapter, config.schemaRegistry),
  };
}
