/**
 * @manifesto-ai/compiler v1.1 Zod Schemas
 *
 * Zod schemas for all core types in the Fragment Pipeline architecture.
 */

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════════
// §3.1 SourceInput
// ═══════════════════════════════════════════════════════════════════════════════

export const SourceInputTypeSchema = z.enum([
  "natural-language",
  "code",
  "mixed",
]);

export const SourceInputSchema = z.object({
  id: z.string(),
  type: SourceInputTypeSchema,
  content: z.string(),
  language: z.string().optional(),
  receivedAt: z.number(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3.2 Plan & Chunk
// ═══════════════════════════════════════════════════════════════════════════════

export const PlanStrategySchema = z.enum([
  "by-statement",
  "by-entity",
  "by-layer",
  "single",
  "custom",
]);

export const PlanStatusSchema = z.enum(["pending", "accepted", "rejected"]);

export const FragmentTypeSchema = z.enum([
  "state",
  "computed",
  "action",
  "constraint",
  "effect",
  "flow",
]);

export const ChunkDependencySchema = z.object({
  kind: z.literal("requires"),
  targetChunkId: z.string(),
  reason: z.string().optional(),
});

export const ChunkSchema = z.object({
  id: z.string(),
  content: z.string(),
  expectedType: FragmentTypeSchema,
  dependencies: z.array(ChunkDependencySchema),
  sourceSpan: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
});

export const PlanSchema = z.object({
  id: z.string(),
  sourceInputId: z.string(),
  strategy: PlanStrategySchema,
  chunks: z.array(ChunkSchema),
  rationale: z.string().optional(),
  status: PlanStatusSchema,
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3.3 FragmentDraft (UNTRUSTED)
// ═══════════════════════════════════════════════════════════════════════════════

export const FragmentDraftStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
]);

export const FragmentInterpretationSchema = z.object({
  raw: z.unknown(),
  description: z.string().optional(),
});

export const FragmentDraftSchema = z.object({
  id: z.string(),
  chunkId: z.string(),
  type: FragmentTypeSchema,
  interpretation: FragmentInterpretationSchema,
  confidence: z.number().min(0).max(1).optional(),
  alternatives: z.array(FragmentInterpretationSchema).optional(),
  status: FragmentDraftStatusSchema,
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3.4 Fragment (VERIFIED)
// ═══════════════════════════════════════════════════════════════════════════════

export const StateFragmentContentSchema = z.object({
  kind: z.literal("state"),
  name: z.string(),
  schema: z.unknown(),
  initial: z.unknown().optional(),
});

export const ComputedFragmentContentSchema = z.object({
  kind: z.literal("computed"),
  name: z.string(),
  expression: z.unknown(),
  dependencies: z.array(z.string()),
});

export const ActionFragmentContentSchema = z.object({
  kind: z.literal("action"),
  name: z.string(),
  input: z.unknown().optional(),
  available: z.unknown().optional(),
  flow: z.unknown(),
});

export const ConstraintFragmentContentSchema = z.object({
  kind: z.literal("constraint"),
  name: z.string(),
  expression: z.unknown(),
  message: z.string().optional(),
});

export const EffectFragmentContentSchema = z.object({
  kind: z.literal("effect"),
  name: z.string(),
  effectType: z.string(),
  params: z.record(z.string(), z.unknown()),
});

export const FlowFragmentContentSchema = z.object({
  kind: z.literal("flow"),
  name: z.string(),
  steps: z.array(z.unknown()),
});

export const FragmentContentSchema = z.discriminatedUnion("kind", [
  StateFragmentContentSchema,
  ComputedFragmentContentSchema,
  ActionFragmentContentSchema,
  ConstraintFragmentContentSchema,
  EffectFragmentContentSchema,
  FlowFragmentContentSchema,
]);

// ═══════════════════════════════════════════════════════════════════════════════
// §3.5 Provenance
// ═══════════════════════════════════════════════════════════════════════════════

export const ProvenanceSchema = z.object({
  source: SourceInputTypeSchema,
  inputId: z.string(),
  inputSpan: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  chunkId: z.string(),
  fragmentDraftId: z.string(),
  actorId: z.string(),
  runtimeId: z.string(),
  timestamp: z.number(),
  planId: z.string(),
  passLayerVersion: z.string(),
  linkerVersion: z.string(),
});

export const FragmentSchema = z.object({
  id: z.string(),
  type: FragmentTypeSchema,
  path: z.string(),
  requires: z.array(z.string()),
  provides: z.array(z.string()),
  content: FragmentContentSchema,
  provenance: ProvenanceSchema,
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3.6 DomainDraft
// ═══════════════════════════════════════════════════════════════════════════════

export const DependencyEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.literal("requires"),
});

export const DependencyGraphSchema = z.object({
  nodes: z.array(z.string()),
  edges: z.array(DependencyEdgeSchema),
  topologicalOrder: z.array(z.string()),
});

export const DomainDraftSchema = z.object({
  id: z.string(),
  fragments: z.array(FragmentSchema),
  assembled: z.object({
    state: z.record(z.string(), z.unknown()),
    computed: z.record(z.string(), z.unknown()),
    actions: z.record(z.string(), z.unknown()),
    constraints: z.array(z.unknown()),
  }),
  dependencyGraph: DependencyGraphSchema,
  sourceInputId: z.string(),
  planId: z.string(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3.7 DomainSpec
// ═══════════════════════════════════════════════════════════════════════════════

export const IssueSeveritySchema = z.enum(["error", "warning", "info"]);

export const IssueSchema = z.object({
  id: z.string(),
  code: z.string(),
  severity: IssueSeveritySchema,
  message: z.string(),
  fragmentId: z.string().optional(),
  path: z.string().optional(),
  location: z
    .object({
      line: z.number().optional(),
      column: z.number().optional(),
    })
    .optional(),
  suggestion: z.string().optional(),
});

export const DomainSpecProvenanceSchema = z.object({
  sourceInputId: z.string(),
  planId: z.string(),
  fragmentIds: z.array(z.string()),
  compiledAt: z.number(),
  compilerVersion: z.string(),
});

export const DomainSpecVerificationSchema = z.object({
  valid: z.literal(true),
  issues: z.array(IssueSchema),
});

export const DomainSpecSchema = z.object({
  id: z.string(),
  version: z.string(),
  hash: z.string(),
  schema: z.unknown(), // CoreDomainSchema - validated externally
  provenance: DomainSpecProvenanceSchema,
  verification: DomainSpecVerificationSchema,
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3.8 Conflicts
// ═══════════════════════════════════════════════════════════════════════════════

export const ConflictTypeSchema = z.enum([
  "duplicate_path",
  "type_mismatch",
  "missing_dependency",
  "circular_dependency",
  "ambiguous_definition",
]);

export const ConflictSchema = z.object({
  id: z.string(),
  type: ConflictTypeSchema,
  message: z.string(),
  fragmentIds: z.array(z.string()),
  path: z.string().optional(),
  details: z.unknown(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// §6 Resolution Contract
// ═══════════════════════════════════════════════════════════════════════════════

export const ResolutionStageSchema = z.enum(["plan", "draft", "link", "verify"]);

export const ResolutionImpactSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("accept_plan"),
    planId: z.string(),
  }),
  z.object({
    kind: z.literal("reject_plan"),
    planId: z.string(),
    reason: z.string(),
  }),
  z.object({
    kind: z.literal("accept_draft"),
    draftId: z.string(),
  }),
  z.object({
    kind: z.literal("reject_draft"),
    draftId: z.string(),
    reason: z.string(),
  }),
  z.object({
    kind: z.literal("select_fragment"),
    fragmentId: z.string(),
    rejectIds: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("manual_override"),
    content: z.unknown(),
  }),
]);

export const ResolutionOptionSchema = z.object({
  id: z.string(),
  description: z.string(),
  preview: z.string().optional(),
  impact: ResolutionImpactSchema,
});

export const ResolutionRequestSchema = z.object({
  id: z.string(),
  stage: ResolutionStageSchema,
  reason: z.string(),
  conflicts: z.array(ConflictSchema),
  options: z.array(ResolutionOptionSchema),
  context: z.object({
    sourceInputId: z.string(),
    planId: z.string().optional(),
    fragmentIds: z.array(z.string()).optional(),
  }),
});

export const ResolutionResponseSchema = z.object({
  requestId: z.string(),
  selectedOptionId: z.string(),
  decidedBy: z.object({
    kind: z.enum(["human", "ai", "consensus", "policy"]),
    actorId: z.string(),
  }),
  timestamp: z.number(),
});

export const ResolutionRecordSchema = z.object({
  request: ResolutionRequestSchema,
  response: ResolutionResponseSchema,
  appliedAt: z.number(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// §7 Compiler State Machine
// ═══════════════════════════════════════════════════════════════════════════════

export const CompilerStatusSchema = z.enum([
  "idle",
  "planning",
  "awaiting_plan_decision",
  "generating",
  "awaiting_draft_decision",
  "lowering",
  "linking",
  "awaiting_conflict_resolution",
  "verifying",
  "emitting",
  "success",
  "failed",
]);

export const FailureReasonSchema = z.enum([
  "PLANNING_FAILED",
  "GENERATION_FAILED",
  "LOWERING_FAILED",
  "LINKING_FAILED",
  "VERIFICATION_FAILED",
  "EMISSION_FAILED",
  "MAX_PLAN_ATTEMPTS_EXCEEDED",
  "MAX_DRAFT_ATTEMPTS_EXCEEDED",
  "USER_CANCELLED",
  "EMPTY_INPUT",
]);

export const CompilerConfigSchema = z.object({
  maxPlanAttempts: z.number().default(3),
  maxDraftAttempts: z.number().default(5),
  maxLoweringRetries: z.number().default(3),
  recordProvenance: z.boolean().default(true),
});

/**
 * CompilerState schema (v1.1)
 *
 * Per SPEC_1.1v.md §7.3
 */
export const CompilerStateSchema = z.object({
  // ─── Input ───
  sourceInput: SourceInputSchema.nullable(),
  // Raw input storage (workaround for Builder expression resolution)
  rawInput: z.object({
    id: z.string(),
    type: z.enum(["natural-language", "code", "mixed"]),
    text: z.string(),
    timestamp: z.number(),
  }).nullable(),

  // ─── Configuration ───
  config: CompilerConfigSchema,

  // ─── Plan Phase ───
  plan: PlanSchema.nullable(),
  planAttempts: z.number(),

  // ─── Generate Phase ───
  chunks: z.array(ChunkSchema),
  currentChunkIndex: z.number(),
  fragmentDrafts: z.array(FragmentDraftSchema),
  draftAttempts: z.record(z.string(), z.number()),

  // ─── Pipeline Phase ───
  fragments: z.array(FragmentSchema),
  domainDraft: DomainDraftSchema.nullable(),

  // ─── Resolution ───
  conflicts: z.array(ConflictSchema),
  pendingResolution: ResolutionRequestSchema.nullable(),
  resolutionHistory: z.array(ResolutionRecordSchema),

  // ─── Issues ───
  issues: z.array(IssueSchema),

  // ─── Status ───
  status: CompilerStatusSchema,

  // ─── Output ───
  domainSpec: DomainSpecSchema.nullable(),
  failureReason: FailureReasonSchema.nullable(),
});

export type CompilerStateSchemaType = z.infer<typeof CompilerStateSchema>;

/**
 * Initial state for the compiler (v1.1)
 *
 * Per SPEC_1.1v.md §7.3
 */
export const INITIAL_STATE: CompilerStateSchemaType = {
  // Input
  sourceInput: null,
  rawInput: null,

  // Configuration
  config: {
    maxPlanAttempts: 3,
    maxDraftAttempts: 5,
    maxLoweringRetries: 3,
    recordProvenance: true,
  },

  // Plan Phase
  plan: null,
  planAttempts: 0,

  // Generate Phase
  chunks: [],
  currentChunkIndex: 0,
  fragmentDrafts: [],
  draftAttempts: {},

  // Pipeline Phase
  fragments: [],
  domainDraft: null,

  // Resolution
  conflicts: [],
  pendingResolution: null,
  resolutionHistory: [],

  // Issues
  issues: [],

  // Status
  status: "idle",

  // Output
  domainSpec: null,
  failureReason: null,
};

/**
 * Default compiler config
 */
export const DEFAULT_CONFIG = {
  maxPlanAttempts: 3,
  maxDraftAttempts: 5,
  maxLoweringRetries: 3,
  recordProvenance: true,
};
