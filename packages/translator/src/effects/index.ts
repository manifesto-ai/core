/**
 * Effects Module
 *
 * Provides effect handlers for Translator:
 * - llm.normalize: Normalizes NL text to canonical English
 * - translator.fastPath: Pattern matching without LLM
 * - translator.retrieve: BM25 anchor candidate search
 * - llm.propose: LLM-based proposal generation
 */

// Schemas
export {
  normalizeSchema,
  fastPathSchema,
  retrieveSchema,
  proposeSchema,
  schemas,
  // Zod schemas for validation
  TokenSchema,
  GlossaryHitSchema,
  ProtectedSpanSchema,
  TypeExprSchema,
  ExprNodeSchema,
  FragmentChangeSchema,
  PatchFragmentSchema,
  AnchorCandidateSchema,
  ResolutionOptionSchema,
  AmbiguityReportSchema,
  NormalizationResultSchema,
  FastPathResultSchema,
  RetrievalResultSchema,
  ProposalResultSchema,
} from "./schemas.js";

// Types
export type {
  LLMAdapter,
  SchemaRegistry,
  SchemaFieldInfo,
  DomainSchemaInfo,
  TranslatorHostConfig,
} from "./types.js";

// Handlers
export {
  createNormalizeHandler,
  createFastPathHandler,
  createRetrieveHandler,
  createProposeHandler,
  createTranslatorHandlers,
} from "./handlers.js";
