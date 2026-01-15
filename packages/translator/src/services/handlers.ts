/**
 * @fileoverview Translator Service Handlers
 *
 * ServiceMap handlers for 7-stage translation pipeline.
 * Each handler receives effect parameters and returns Patch[] to apply to state.
 *
 * @see SPEC-0.2.0v.md
 * @see FDR-0.2.0v.md
 */

import type { Patch } from "@manifesto-ai/core";
import type { ServiceMap } from "@manifesto-ai/app";
import type { IntentIR, Lexicon } from "@manifesto-ai/intent-ir";
import {
  canonicalizeSemantic,
  deriveSimKey,
  checkFeatures,
  deriveIntentKeySync,
  createLexicon,
} from "@manifesto-ai/intent-ir";
import { serializeSimKey } from "../keys/index.js";
import {
  createCompositeLexicon,
  createBuiltinLexicon,
  deriveProjectLexicon,
  createLearnedLexicon,
  determineLexiconSource,
  type DomainSchemaLike,
} from "../lexicon/index.js";
import type { LLMClient } from "../pipeline/llm-client.js";
import type {
  LoweringResult,
  ResolvedResult,
  UnresolvedResult,
  LoweringEvidence,
  LearnedEntry,
  FieldMapping,
} from "../types/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Handler context for accessing external dependencies
 */
export type HandlerContext = {
  /** LLM client for S2 Propose stage */
  llmClient?: LLMClient;
  /** Schema for project lexicon derivation */
  schema?: unknown;
  /** Schema hash for intentKey derivation */
  schemaHash?: string;
};

/**
 * Handler factory creates ServiceMap with context
 */
export type HandlerFactory = (context: HandlerContext) => ServiceMap;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create an empty lexicon
 */
function createEmptyLexicon(): Lexicon {
  return createLexicon({
    events: {},
    entities: {},
  });
}

// =============================================================================
// S1: Normalize
// =============================================================================

/**
 * Normalize PF (Phonetic Form / natural language text)
 * Deterministic stage.
 */
async function normalize(params: Record<string, unknown>): Promise<Patch[]> {
  const text = params.text as string;
  const lang = params.lang as string | null;

  // Validate input
  if (text === null || text === undefined || typeof text !== "string") {
    return [
      { op: "set", path: "error", value: { code: "NORMALIZE_FAILED", message: "Input text must be a string" } },
      { op: "set", path: "currentStage", value: "failed" },
    ];
  }

  // Normalize: NFKC + trim + collapse spaces
  const normalized = text.normalize("NFKC").trim().replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return [
      { op: "set", path: "error", value: { code: "NORMALIZE_FAILED", message: "Input text is empty after normalization" } },
      { op: "set", path: "currentStage", value: "failed" },
    ];
  }

  // Detect language if not provided
  const detectedLang = lang ?? detectLang(normalized);

  return [
    { op: "set", path: "normalized", value: normalized },
  ];
}

/**
 * Simple language detection based on character ranges
 */
function detectLang(text: string): string {
  if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/.test(text)) {
    return "ko";
  }
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
    return "ja";
  }
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return "zh";
  }
  return "en";
}

// =============================================================================
// S2: Propose (LLM)
// =============================================================================

/**
 * Create propose handler with LLM client
 * Non-deterministic stage (LLM dependency).
 */
function createProposeHandler(context: HandlerContext) {
  return async function propose(params: Record<string, unknown>): Promise<Patch[]> {
    const normalizedText = params.normalizedText as string;
    const lang = params.lang as string | null;

    const client = context.llmClient;
    if (!client) {
      return [
        { op: "set", path: "error", value: { code: "IR_PROPOSAL_FAILED", message: "LLM client not configured" } },
        { op: "set", path: "currentStage", value: "failed" },
      ];
    }

    if (!client.isReady()) {
      return [
        { op: "set", path: "error", value: { code: "IR_PROPOSAL_FAILED", message: `LLM client (${client.getProvider()}) is not ready` } },
        { op: "set", path: "currentStage", value: "failed" },
      ];
    }

    try {
      const response = await client.propose({
        text: normalizedText,
        lang: lang ?? "en",
      });

      // Validate IR structure
      const validationError = validateIR(response.ir);
      if (validationError) {
        return [
          { op: "set", path: "error", value: { code: "IR_INVALID", message: validationError } },
          { op: "set", path: "currentStage", value: "failed" },
        ];
      }

      return [
        { op: "set", path: "intentIR", value: response.ir },
      ];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [
        { op: "set", path: "error", value: { code: "IR_PROPOSAL_FAILED", message: `LLM proposal failed: ${message}` } },
        { op: "set", path: "currentStage", value: "failed" },
      ];
    }
  };
}

/**
 * Validate IntentIR basic structure
 */
function validateIR(ir: IntentIR): string | null {
  if (!ir.v || typeof ir.v !== "string") {
    return "Missing or invalid version field";
  }
  if (!ir.force || !["DO", "DONT", "ASK", "TRY"].includes(ir.force)) {
    return `Invalid force field: ${ir.force}`;
  }
  if (!ir.event || typeof ir.event !== "object") {
    return "Missing or invalid event field";
  }
  if (!ir.event.lemma || typeof ir.event.lemma !== "string") {
    return "Missing or invalid event.lemma field";
  }
  if (!ir.event.class || typeof ir.event.class !== "string") {
    return "Missing or invalid event.class field";
  }
  if (ir.args !== undefined && typeof ir.args !== "object") {
    return "Invalid args field";
  }
  return null;
}

// =============================================================================
// S3: Canonicalize
// =============================================================================

/**
 * Canonicalize IntentIR and derive simKey
 * Deterministic stage.
 */
async function canonicalize(params: Record<string, unknown>): Promise<Patch[]> {
  const ir = params.ir as IntentIR;

  if (!ir) {
    return [
      { op: "set", path: "error", value: { code: "CANONICALIZE_FAILED", message: "No IntentIR provided" } },
      { op: "set", path: "currentStage", value: "failed" },
    ];
  }

  // Canonicalize using Intent IR SPEC rules
  const canonical = canonicalizeSemantic(ir);

  // Derive simKey
  const simKey = deriveSimKey(canonical);
  const simKeyHex = serializeSimKey(simKey);

  return [
    { op: "set", path: "canonicalIR", value: canonical },
    { op: "set", path: "simKey", value: simKeyHex },
  ];
}

// =============================================================================
// S4: Feature Check
// =============================================================================

/**
 * Create feature check handler with context
 * Deterministic stage.
 */
function createFeatureCheckHandler(context: HandlerContext) {
  return async function featureCheck(params: Record<string, unknown>): Promise<Patch[]> {
    const ir = params.ir as IntentIR;
    const learnedLexicon = params.learnedLexicon as Record<string, LearnedEntry> | undefined;
    const strict = params.strict as boolean | undefined;

    if (!ir) {
      return [
        { op: "set", path: "error", value: { code: "FEATURE_CHECK_FAILED", message: "No IntentIR provided" } },
        { op: "set", path: "currentStage", value: "failed" },
      ];
    }

    // Build composite lexicon
    const builtin = createBuiltinLexicon();
    const project = context.schema
      ? deriveProjectLexicon(context.schema as DomainSchemaLike)
      : createEmptyLexicon();
    // Create base lexicon for learned (project + builtin)
    const baseLexicon = createCompositeLexicon(createEmptyLexicon(), project, builtin);
    const learned = createLearnedLexicon(learnedLexicon ?? {}, baseLexicon);
    const lexicon = createCompositeLexicon(learned, project, builtin);

    const lemma = ir.event.lemma;
    const entry = lexicon.resolveEvent(lemma);

    if (!entry) {
      if (strict) {
        return [
          { op: "set", path: "error", value: { code: "FEATURE_CHECK_FAILED", message: `Unknown lemma: ${lemma}` } },
          { op: "set", path: "currentStage", value: "failed" },
        ];
      }
      // Non-strict mode: allow unknown lemmas (cold start support)
      return [
        { op: "set", path: "featureCheckPassed", value: true },
      ];
    }

    // Run feature checks
    const checkResult = checkFeatures(ir, lexicon);

    if (!checkResult.valid) {
      if (strict) {
        return [
          { op: "set", path: "error", value: { code: "FEATURE_CHECK_FAILED", message: formatCheckError(checkResult.error) } },
          { op: "set", path: "currentStage", value: "failed" },
        ];
      }
      // Non-strict mode: continue with warnings
    }

    return [
      { op: "set", path: "featureCheckPassed", value: true },
    ];
  };
}

/**
 * Format check error for display
 */
function formatCheckError(error: { code: string; [key: string]: unknown }): string {
  switch (error.code) {
    case "UNKNOWN_LEMMA":
      return `Unknown lemma: ${error.lemma}`;
    case "CLASS_MISMATCH":
      return `Event class mismatch: expected ${error.expected}, got ${error.actual}`;
    case "MISSING_ROLE":
      return `Missing required role: ${error.role}`;
    case "INVALID_TERM_KIND":
      return `Invalid term kind for ${error.role}`;
    case "INVALID_ENTITY_TYPE":
      return `Invalid entity type for ${error.role}`;
    case "INVALID_VALUE_TYPE":
      return `Invalid value type for ${error.role}`;
    default:
      return `Feature check error: ${error.code}`;
  }
}

// =============================================================================
// S5: Resolve References
// =============================================================================

/**
 * Resolve discourse references (this/that/last → id)
 * Deterministic stage.
 */
async function resolveRefs(params: Record<string, unknown>): Promise<Patch[]> {
  const ir = params.ir as IntentIR;
  const depth = params.depth as number | undefined;

  if (!ir) {
    return [
      { op: "set", path: "error", value: { code: "RESOLVE_REFS_FAILED", message: "No IntentIR provided" } },
      { op: "set", path: "currentStage", value: "failed" },
    ];
  }

  // Deep clone IR to avoid mutation
  const resolvedIR: IntentIR = JSON.parse(JSON.stringify(ir));
  const resolutions: Array<{
    path: string;
    original: unknown;
    resolved: unknown;
  }> = [];

  // For v0.2.0, we don't have request history access in this handler
  // Resolution is handled via App's World.listProposals() in the future
  // For now, keep IR as-is and return empty resolutions

  return [
    { op: "set", path: "resolvedIR", value: resolvedIR },
    { op: "set", path: "resolutions", value: resolutions },
  ];
}

// =============================================================================
// S6: Lower
// =============================================================================

/**
 * Create lower handler with context
 * Deterministic stage.
 */
function createLowerHandler(context: HandlerContext) {
  return async function lower(params: Record<string, unknown>): Promise<Patch[]> {
    const ir = params.ir as IntentIR;
    const learnedLexicon = params.learnedLexicon as Record<string, LearnedEntry> | undefined;
    const resolutions = params.resolutions as Array<unknown> | undefined;

    if (!ir) {
      return [
        { op: "set", path: "error", value: { code: "LOWER_FAILED", message: "No IntentIR provided" } },
        { op: "set", path: "currentStage", value: "failed" },
      ];
    }

    // Build composite lexicon
    const builtin = createBuiltinLexicon();
    const project = context.schema
      ? deriveProjectLexicon(context.schema as DomainSchemaLike)
      : createEmptyLexicon();
    // Create base lexicon for learned (project + builtin)
    const baseLexicon = createCompositeLexicon(createEmptyLexicon(), project, builtin);
    const learned = createLearnedLexicon(learnedLexicon ?? {}, baseLexicon);
    const lexicon = createCompositeLexicon(learned, project, builtin);

    const lemma = ir.event.lemma;

    // Resolve action type (canonical lemma)
    const actionType = lexicon.resolveActionType(lemma);

    if (!actionType) {
      // No matching action type - return unresolved result
      const result: UnresolvedResult = {
        kind: "unresolved",
        partial: {
          type: lemma,
          input: {
            args: ir.args,
            cond: ir.cond,
            ext: ir.ext,
          },
        },
        missing: [
          {
            kind: "action_type",
            detail: `No matching Lexicon entry for: ${lemma}`,
            suggestion: `Add a mapping for "${lemma}" via learn action`,
          },
        ],
      };

      return [
        { op: "set", path: "loweringResult", value: result },
      ];
    }

    // Determine lexicon source
    const source = determineLexiconSource(learned, project, builtin, lemma) ?? "builtin";

    // Map args to input
    const input = lexicon.mapArgsToInput(ir.args, ir.cond);

    // Build IntentBody
    const body = {
      type: actionType,
      ...(input !== undefined && { input }),
    };

    // Derive intentKey
    const schemaHash = context.schemaHash ?? "";
    const intentKey = deriveIntentKeySync(body, schemaHash);

    // Build evidence
    const evidence: LoweringEvidence = {
      lexiconSource: source,
      originalLemma: lemma,
      resolvedLemma: actionType,
      mappedFields: buildFieldMappings(ir),
      resolutions: resolutions as LoweringEvidence["resolutions"],
      intentKey,
    };

    const result: ResolvedResult = {
      kind: "resolved",
      body,
      evidence,
    };

    return [
      { op: "set", path: "loweringResult", value: result },
    ];
  };
}

/**
 * Build field mappings from IR args
 */
function buildFieldMappings(ir: IntentIR): readonly FieldMapping[] {
  const mappings: FieldMapping[] = [];

  for (const [role, term] of Object.entries(ir.args)) {
    if (term === undefined) continue;

    mappings.push({
      from: {
        role,
        path: `args.${role}`,
      },
      to: {
        field: role.toLowerCase(),
      },
    });
  }

  return mappings;
}

// =============================================================================
// S7: Validate ActionBody
// =============================================================================

/**
 * Validate ActionBody structural constraints
 * Deterministic stage, executes only for Action-related types.
 */
async function validateActionBody(params: Record<string, unknown>): Promise<Patch[]> {
  const loweringResult = params.loweringResult as LoweringResult | undefined;

  if (!loweringResult) {
    return [
      { op: "set", path: "error", value: { code: "VALIDATE_FAILED", message: "No lowering result provided" } },
      { op: "set", path: "currentStage", value: "failed" },
    ];
  }

  // Skip validation for non-resolved results
  if (loweringResult.kind !== "resolved") {
    return [
      { op: "set", path: "actionBodyValid", value: true },
    ];
  }

  // Check if this is an action-related lemma
  const actionType = loweringResult.body.type;
  const isActionRelated = isActionRelatedLemma(actionType);

  if (!isActionRelated) {
    // Not action-related, skip validation
    return [
      { op: "set", path: "actionBodyValid", value: true },
    ];
  }

  // Extract ActionBody from input
  const input = loweringResult.body.input;
  if (!input || typeof input !== "object") {
    return [
      { op: "set", path: "actionBodyValid", value: true },
    ];
  }

  const actionBody = extractActionBody(input);
  if (!actionBody) {
    return [
      { op: "set", path: "actionBodyValid", value: true },
    ];
  }

  // Validate ActionBody structure
  const violations = validateActionBodyStructure(actionBody);

  if (violations.length > 0) {
    return [
      { op: "set", path: "actionBodyValid", value: false },
      { op: "set", path: "error", value: {
        code: "ACTION_BODY_INVALID",
        message: `Action body has ${violations.length} structural violation(s)`,
        violations,
      }},
      { op: "set", path: "currentStage", value: "failed" },
    ];
  }

  return [
    { op: "set", path: "actionBodyValid", value: true },
  ];
}

/**
 * Action-related lemmas that require body validation
 */
const ACTION_LEMMAS = new Set([
  "ADD_ACTION",
  "ADD_ACTION_GUARD",
  "ADD_ACTION_EFFECT",
]);

/**
 * Check if a lemma is action-related
 */
function isActionRelatedLemma(lemma: string): boolean {
  return ACTION_LEMMAS.has(lemma.toUpperCase());
}

/**
 * Extract ActionBody from input
 */
function extractActionBody(input: unknown): unknown | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const obj = input as Record<string, unknown>;

  if ("body" in obj && typeof obj.body === "object") {
    return obj.body;
  }

  if ("blocks" in obj && Array.isArray(obj.blocks)) {
    return input;
  }

  return undefined;
}

/**
 * Validate ActionBody structure
 */
function validateActionBodyStructure(actionBody: unknown): Array<{ kind: string; [key: string]: unknown }> {
  const violations: Array<{ kind: string; [key: string]: unknown }> = [];

  if (!actionBody || typeof actionBody !== "object") {
    return violations;
  }

  const body = actionBody as { blocks?: unknown[] };

  if (!body.blocks || !Array.isArray(body.blocks)) {
    return violations;
  }

  // Validate each block
  for (let i = 0; i < body.blocks.length; i++) {
    const block = body.blocks[i] as { guard?: { kind: string }; body?: unknown[] };

    if (!block) continue;

    // Check once guard requires marker patch as first statement
    if (block.guard?.kind === "once") {
      if (!block.body || block.body.length === 0) {
        violations.push({ kind: "missing_marker_patch", blockIndex: i });
      } else {
        const firstStmt = block.body[0] as { kind?: string; value?: unknown };
        if (firstStmt?.kind !== "patch") {
          violations.push({ kind: "missing_marker_patch", blockIndex: i });
        }
      }
    }
  }

  return violations;
}

// =============================================================================
// Learn (Add to Lexicon)
// =============================================================================

/**
 * Add entry to learned lexicon
 * Handles uppercasing since Core doesn't support toUpperCase expression yet.
 */
async function learn(params: Record<string, unknown>): Promise<Patch[]> {
  const lemma = params.lemma as string;
  const targetLemma = params.targetLemma as string;

  if (!lemma || typeof lemma !== "string") {
    return [
      { op: "set", path: "error", value: { code: "LEARN_FAILED", message: "lemma must be a non-empty string" } },
    ];
  }

  if (!targetLemma || typeof targetLemma !== "string") {
    return [
      { op: "set", path: "error", value: { code: "LEARN_FAILED", message: "targetLemma must be a non-empty string" } },
    ];
  }

  // Uppercase the lemmas
  const upperLemma = lemma.toUpperCase();
  const upperTargetLemma = targetLemma.toUpperCase();
  const timestamp = new Date().toISOString();

  // Return patch to add to learnedLexicon
  return [
    {
      op: "set",
      path: `learnedLexicon.${upperLemma}`,
      value: {
        kind: "alias",
        lemma: upperLemma,
        targetLemma: upperTargetLemma,
        learnedAt: timestamp,
        learnedFrom: "translator.learn",
      },
    },
  ];
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create translator service handlers with context
 */
export function createTranslatorHandlers(context: HandlerContext = {}): ServiceMap {
  return {
    "translator.normalize": normalize,
    "translator.propose": createProposeHandler(context),
    "translator.canonicalize": canonicalize,
    "translator.featureCheck": createFeatureCheckHandler(context),
    "translator.resolveRefs": resolveRefs,
    "translator.lower": createLowerHandler(context),
    "translator.validateActionBody": validateActionBody,
    "translator.learn": learn,
  };
}
