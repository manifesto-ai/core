/**
 * @manifesto-ai/translator
 *
 * Manifesto Translator - Natural language to PatchFragment translation domain
 *
 * Translator is a Manifesto Domain that converts natural language intent
 * into structured PatchFragment changes through a 5-stage pipeline:
 *
 * 1. Normalize - Raw NL text to canonical English (LLM effect)
 * 2. Fast Path - Pattern matching for common cases (zero-LLM)
 * 3. Retrieve - Token to anchor candidates (BM25 with lunr.js)
 * 4. Propose - Canonical + candidates to PatchFragment (LLM effect)
 * 5. Result - Final TranslationResult
 *
 * @packageDocumentation
 */

// Re-export all types
export * from "./types/index.js";

// Fast Path module
export {
  matchFastPath,
  FAST_PATH_PATTERNS,
  type FastPathPatternDef,
} from "./fast-path/index.js";

// Retrieval module
export {
  buildIndex,
  buildAliasTable,
  search,
  type SchemaInfo,
  type FieldInfo,
  type RetrievalIndex,
  type SearchOptions,
} from "./retrieval/index.js";

// Effects module
export {
  // Schemas
  normalizeSchema,
  fastPathSchema,
  retrieveSchema,
  proposeSchema,
  schemas,
  // Handlers
  createNormalizeHandler,
  createFastPathHandler,
  createRetrieveHandler,
  createProposeHandler,
  createTranslatorHandlers,
  // Types
  type LLMAdapter,
  type SchemaRegistry,
  type SchemaFieldInfo,
  type DomainSchemaInfo,
  type TranslatorHostConfig,
} from "./effects/index.js";
