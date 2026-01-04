/**
 * @manifesto-ai/lab - Core Types
 *
 * Type definitions for the Lab package.
 */

import type {
  ManifestoWorld,
  Proposal,
  Snapshot,
  IntentScope,
  WorldEvent,
  AuthorityHandler,
} from "@manifesto-ai/world";

// =============================================================================
// Necessity Levels
// =============================================================================

/**
 * Necessity Level determines when LLM usage is structurally justified.
 *
 * - Level 0: Deterministic Full Observation - No LLM required
 * - Level 1: Partial Observation - Hidden state requires belief
 * - Level 2: Open-Ended Rules - Goal interpretation required
 * - Level 3: Natural Language Grounding - Intent grounding required
 */
export type NecessityLevel = 0 | 1 | 2 | 3;

/**
 * LLM Role describes the function an LLM serves at each necessity level.
 */
export type LLMRole =
  | "none"
  | "fact_proposer"
  | "belief_proposer"
  | "rule_interpreter"
  | "intent_parser";

/**
 * Verification method used to validate LLM outputs at each level.
 */
export type VerificationMethod =
  | "deterministic"
  | "posterior_consistency"
  | "semantic_audit"
  | "user_confirmation";

/**
 * Verification guarantee provided by each verification method.
 */
export type VerificationGuarantee =
  | "certain"
  | "consistent"
  | "plausible"
  | "confirmed";

// =============================================================================
// Projection
// =============================================================================

/**
 * Projection mode determines the level of visibility into the experiment.
 *
 * - silent: No output, trace only
 * - watch: Read-only progress view
 * - interactive: Progress + HITL intervention
 * - debug: Full detail including snapshots
 */
export type ProjectionMode = "silent" | "watch" | "interactive" | "debug";

/**
 * Projection view types that can be toggled.
 */
export type ProjectionView =
  | "progress"
  | "proposals"
  | "snapshot"
  | "llm"
  | "hitl"
  | "trace";

/**
 * Projection options for configuring the terminal UI.
 */
export interface ProjectionOptions {
  /** Enable projection output */
  enabled: boolean;

  /** Projection mode */
  mode: ProjectionMode;

  /** Visual theme */
  theme?: "default" | "minimal" | "verbose" | "debug";

  /** Custom projection components (v1.1) */
  components?: ProjectionComponents;
}

/**
 * Projection controller for runtime control of the projection UI.
 */
export interface ProjectionController {
  readonly mode: ProjectionMode;
  setMode(mode: ProjectionMode): void;
  toggleView(view: ProjectionView): void;
  pause(): void;
  resume(): void;
  refresh(): void;
  update(event: WorldEvent): void;
  start(labWorld: LabWorld): void;
  stop(): void;
}

// =============================================================================
// HITL
// =============================================================================

/**
 * HITL context passed to pending handlers.
 */
export interface HITLContext {
  proposalId: string;
  timestamp: number;
}

/**
 * Auto-approve conditions for HITL.
 */
export type AutoApproveCondition =
  | { type: "confidence_above"; threshold: number }
  | { type: "intent_type"; patterns: string[] }
  | { type: "actor"; actorIds: string[] }
  | { type: "custom"; predicate: (proposal: Proposal) => boolean };

/**
 * HITL configuration options.
 */
export interface HITLOptions {
  /** Enable HITL intervention */
  enabled: boolean;

  /** Timeout for HITL decisions (ms) */
  timeout?: number;

  /** Behavior on timeout */
  onTimeout?: "reject" | "approve" | "abort";

  /** Auto-approve conditions */
  autoApprove?: AutoApproveCondition[];

  /** Notification callback when HITL is required */
  onPending?: (proposal: Proposal, context: HITLContext) => void | Promise<void>;
}

/**
 * Options for approving a proposal.
 */
export interface ApproveOptions {
  scope?: IntentScope;
  note?: string;
  validatedBy?: string;
}

/**
 * Modifications to apply when approving with modification.
 */
export interface ProposalModification {
  scope?: IntentScope;
}

/**
 * HITL controller for managing human-in-the-loop decisions.
 */
export interface HITLController {
  readonly pending: Proposal[];
  readonly isWaiting: boolean;

  approve(proposalId: string, options?: ApproveOptions): Promise<void>;
  reject(proposalId: string, reason: string): Promise<void>;
  requestInfo(proposalId: string, question: string): Promise<unknown>;
  approveWithModification(
    proposalId: string,
    modifications: ProposalModification
  ): Promise<void>;
  delegate(proposalId: string, authorityId: string): Promise<void>;

  onPending(handler: (proposal: Proposal) => void): Unsubscribe;
}

// =============================================================================
// Lab Options
// =============================================================================

/**
 * Configuration options for withLab.
 */
export interface LabOptions {
  /** Unique run identifier */
  runId: string;

  /** Expected necessity level */
  necessityLevel: NecessityLevel;

  /** Trace output directory */
  outputPath: string;

  /** Trace format */
  traceFormat?: "json" | "jsonl" | "json.gz";

  /** Projection configuration */
  projection?: ProjectionOptions;

  /** HITL configuration */
  hitl?: HITLOptions;

  /** Environment metadata */
  environment?: Record<string, unknown>;
}

// =============================================================================
// Lab State
// =============================================================================

/**
 * Lab status.
 */
export type LabStatus = "running" | "waiting_hitl" | "completed" | "aborted";

/**
 * Lab state union type.
 */
export type LabState =
  | { status: "running"; currentStep: number; pendingHITL: Proposal[] }
  | { status: "waiting_hitl"; proposal: Proposal; waitingSince: number }
  | { status: "completed"; outcome: "success" | "failure" }
  | { status: "aborted"; reason: string };

/**
 * Lab metadata.
 */
export interface LabMeta {
  runId: string;
  necessityLevel: NecessityLevel;
  startedAt: number;
}

// =============================================================================
// Lab Trace
// =============================================================================

/**
 * Lab trace header.
 */
export interface LabTraceHeader {
  specVersion: "lab/1.1";
  runId: string;
  necessityLevel: NecessityLevel;
  schemaHash: string;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
  environment?: Record<string, unknown>;
}

/**
 * Lab trace event types.
 */
export type LabTraceEventType =
  | "proposal"
  | "authority.decision"
  | "apply"
  | "effect"
  | "effect.result"
  | "hitl"
  | "termination"
  | "world.created"
  | "failure.explanation";

/**
 * Base trace event.
 */
export interface BaseTraceEvent {
  type: LabTraceEventType;
  seq: number;
  timestamp: string;
}

/**
 * Proposal trace event.
 */
export interface ProposalTraceEvent extends BaseTraceEvent {
  type: "proposal";
  proposalId: string;
  intentType: string;
  actorId: string;
}

/**
 * Authority decision trace event.
 */
export interface AuthorityDecisionTraceEvent extends BaseTraceEvent {
  type: "authority.decision";
  proposalId: string;
  decision: "approved" | "rejected" | "pending";
  authorityId: string;
  verificationMethod?: VerificationMethod;
}

/**
 * Apply (patches) trace event.
 */
export interface ApplyTraceEvent extends BaseTraceEvent {
  type: "apply";
  intentId: string;
  patchCount: number;
  source: "compute" | "effect";
}

/**
 * Effect trace event.
 */
export interface EffectTraceEvent extends BaseTraceEvent {
  type: "effect";
  intentId: string;
  effectType: string;
}

/**
 * Effect result trace event.
 */
export interface EffectResultTraceEvent extends BaseTraceEvent {
  type: "effect.result";
  intentId: string;
  effectType: string;
  success: boolean;
  patchCount: number;
  error?: string;
}

/**
 * HITL trace event.
 */
export interface HITLTraceEvent extends BaseTraceEvent {
  type: "hitl";
  proposalId: string;
  action: "pending" | "approved" | "rejected" | "timeout" | "delegated";
  decidedBy?: string;
  decisionTimeMs?: number;
  note?: string;
}

/**
 * Termination trace event.
 */
export interface TerminationTraceEvent extends BaseTraceEvent {
  type: "termination";
  outcome: "success" | "failure";
  proposalId?: string;
  error?: ErrorInfo;
}

/**
 * World created trace event.
 */
export interface WorldCreatedTraceEvent extends BaseTraceEvent {
  type: "world.created";
  worldId: string;
  parentWorldId: string | null;
  proposalId: string | null;
}

/**
 * Failure explanation trace event.
 */
export interface FailureExplanationTraceEvent extends BaseTraceEvent {
  type: "failure.explanation";
  explanation: FailureExplanation;
}

/**
 * Lab trace event union type.
 */
export type LabTraceEvent =
  | ProposalTraceEvent
  | AuthorityDecisionTraceEvent
  | ApplyTraceEvent
  | EffectTraceEvent
  | EffectResultTraceEvent
  | HITLTraceEvent
  | TerminationTraceEvent
  | WorldCreatedTraceEvent
  | FailureExplanationTraceEvent;

/**
 * Trace outcome.
 */
export type TraceOutcome = "success" | "failure" | "aborted";

/**
 * Complete lab trace.
 */
export interface LabTrace {
  header: LabTraceHeader;
  events: LabTraceEvent[];
  outcome?: TraceOutcome;
  failureExplanation?: FailureExplanation;
}

// =============================================================================
// Failure Explanation
// =============================================================================

/**
 * Failure reason codes.
 */
export type FailureReason =
  | "NO_EXECUTABLE_ACTION"
  | "GOAL_UNREACHABLE"
  | "AUTHORITY_REJECTION"
  | "UNRESOLVED_AMBIGUITY"
  | "HUMAN_REQUIRED"
  | "TIMEOUT"
  | "RESOURCE_EXHAUSTED";

/**
 * Error info structure.
 */
export interface ErrorInfo {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Explanation evidence.
 */
export interface ExplanationEvidence {
  type: string;
  description: string;
  data?: unknown;
}

/**
 * Counterfactual change types.
 */
export type CounterfactualChange =
  | { type: "add_observation"; observation: unknown }
  | { type: "relax_constraint"; constraint: string }
  | { type: "increase_confidence"; to: number }
  | { type: "resolve_ambiguity"; resolution: unknown }
  | { type: "obtain_confirmation"; from: string };

/**
 * Counterfactual explanation.
 */
export interface Counterfactual {
  change: CounterfactualChange;
  expectedOutcome: "success" | "different_failure";
  confidence: "high" | "medium" | "low";
}

/**
 * Failure explanation structure.
 */
export interface FailureExplanation {
  kind:
    | "structural"
    | "informational"
    | "governance"
    | "human_required"
    | "resource";
  title: string;
  description: string;
  evidence: ExplanationEvidence[];
  counterfactual?: Counterfactual;
}

// =============================================================================
// Lab Report
// =============================================================================

/**
 * Lab report structure.
 */
export interface LabReport {
  runId: string;
  necessityLevel: NecessityLevel;
  startedAt: string;
  completedAt: string;
  duration: number;
  outcome: "success" | "failure" | "aborted";
  summary: {
    totalProposals: number;
    approvedProposals: number;
    rejectedProposals: number;
    hitlInterventions: number;
    totalPatches: number;
    totalEffects: number;
    worldsCreated: number;
  };
  failureExplanation?: FailureExplanation;
  trace: LabTrace;
}

// =============================================================================
// Lab Events
// =============================================================================

/**
 * Lab-specific event types.
 */
export type LabEventType =
  | "hitl:pending"
  | "hitl:decided"
  | "lab:status_changed"
  | "world:event";

/**
 * Lab event union type.
 */
export type LabEvent =
  | { type: "hitl:pending"; proposalId: string }
  | { type: "hitl:decided"; proposalId: string; decision: "approved" | "rejected" }
  | { type: "lab:status_changed"; status: LabStatus }
  | { type: "world:event"; event: WorldEvent };

/**
 * Lab event handler.
 */
export type LabEventHandler = (event: LabEvent) => void;

/**
 * Unsubscribe function.
 */
export type Unsubscribe = () => void;

// =============================================================================
// LabWorld
// =============================================================================

/**
 * LabWorld extends ManifestoWorld with Lab capabilities.
 */
export interface LabWorld extends ManifestoWorld {
  /** Lab metadata */
  readonly labMeta: LabMeta;

  /** Current experiment state */
  readonly state: LabState;

  /** HITL controller */
  readonly hitl: HITLController;

  /** Projection controller */
  readonly projection: ProjectionController;

  /** Get current trace */
  trace(): LabTrace;

  /** Generate final report */
  report(): LabReport;

  /** Subscribe to lab-specific events */
  onLabEvent(handler: LabEventHandler): Unsubscribe;
}

// =============================================================================
// Level Authority
// =============================================================================

/**
 * Level-specific authority handler.
 */
export interface LevelAuthorityHandler extends AuthorityHandler {
  readonly level: NecessityLevel;
  readonly verificationMethod: VerificationMethod;
  readonly guarantee: VerificationGuarantee;
}

/**
 * Options for creating a level authority.
 */
export interface LevelAuthorityOptions {
  hitlController?: HITLController;
  confidenceThreshold?: number;
}

// =============================================================================
// v1.1: Trace I/O
// =============================================================================

/**
 * Options for saving a trace.
 */
export interface TraceSaveOptions {
  /** Output format (default: inferred from extension) */
  format?: "json" | "jsonl" | "json.gz";

  /** Pretty print JSON (default: false) */
  pretty?: boolean;

  /** Include snapshots in trace (default: false) */
  includeSnapshots?: boolean;
}

// =============================================================================
// v1.1: Trace Summary
// =============================================================================

/**
 * Summary statistics for a single necessity level.
 */
export interface LevelSummary {
  runs: number;
  successRate: number;
  avgSteps: number;
  avgDurationMs: number;
}

/**
 * HITL statistics summary.
 */
export interface HITLSummary {
  /** Total HITL triggers */
  triggered: number;

  /** Approved by human */
  approved: number;

  /** Rejected by human */
  rejected: number;

  /** Timed out */
  timedOut: number;

  /** Average decision time in ms */
  avgDecisionTimeMs: number;

  /** HITL rate (triggered / total proposals) */
  hitlRate: number;
}

/**
 * LLM usage statistics summary.
 */
export interface LLMSummary {
  /** Total LLM proposals */
  totalProposals: number;

  /** Proposals approved */
  approved: number;

  /** Proposals rejected */
  rejected: number;

  /** Approval rate */
  approvalRate: number;

  /** Breakdown by role */
  byRole: Record<
    LLMRole,
    {
      proposals: number;
      approved: number;
      rejected: number;
    }
  >;
}

/**
 * Aggregated statistics across one or more traces.
 */
export interface TraceSummary {
  /** Number of runs */
  runs: number;

  /** Overall success rate */
  successRate: number;

  /** Average steps per run */
  avgSteps: number;

  /** Average duration in ms */
  avgDurationMs: number;

  /** Breakdown by necessity level */
  byLevel: Record<NecessityLevel, LevelSummary>;

  /** Failure reason distribution */
  failureReasons: Record<FailureReason, number>;

  /** HITL statistics */
  hitl: HITLSummary;

  /** LLM usage statistics */
  llm: LLMSummary;
}

// =============================================================================
// v1.1: Trace Diff
// =============================================================================

/**
 * Type of divergence between two traces.
 */
export type DivergenceType =
  | "authority_decision" // Same proposal, different decision
  | "proposal_content" // Different proposal content
  | "execution_result" // Same intent, different execution result
  | "effect_result" // Same effect, different result
  | "hitl_decision" // Different HITL decision
  | "timing" // Same events, different timing (non-causal)
  | "unknown"; // Cannot determine cause

/**
 * Cause of divergence between two traces.
 */
export interface DivergenceCause {
  type: DivergenceType;
  description: string;
  details: Record<string, unknown>;
}

/**
 * Comparison of a single event between two traces.
 */
export interface EventDiff {
  seq: number;
  status: "identical" | "different" | "only_a" | "only_b";
  eventA?: LabTraceEvent;
  eventB?: LabTraceEvent;
  differences?: string[];
}

/**
 * Comparison result between two traces.
 */
export interface TraceDiff {
  /** Whether traces are identical */
  identical: boolean;

  /** Event sequence where traces diverge (null if identical) */
  divergedAtSeq: number | null;

  /** Event in trace A at divergence point */
  eventA: LabTraceEvent | null;

  /** Event in trace B at divergence point */
  eventB: LabTraceEvent | null;

  /** Inferred cause of divergence */
  cause: DivergenceCause | null;

  /** Outcome comparison */
  outcomes: {
    a: TraceOutcome;
    b: TraceOutcome;
  };

  /** Detailed event-by-event comparison */
  eventDiffs: EventDiff[];
}

// =============================================================================
// v1.1: Trace Report (Enhanced)
// =============================================================================

/**
 * Timeline entry for report.
 */
export interface TimelineEntry {
  seq: number;
  timestamp: string;
  event: string;
  actor?: string;
  result?: string;
  note?: string;
}

/**
 * Structured report JSON format.
 */
export interface ReportJSON {
  meta: {
    runId: string;
    level: NecessityLevel;
    outcome: TraceOutcome;
    duration: string;
    createdAt: string;
  };

  summary: {
    totalSteps: number;
    proposals: number;
    approvals: number;
    rejections: number;
    hitlInterventions: number;
  };

  failure?: {
    reason: FailureReason;
    explanation: string;
    counterfactual?: string;
  };

  timeline: TimelineEntry[];
}

/**
 * Enhanced Lab report with multiple output formats.
 */
export interface EnhancedLabReport extends LabReport {
  /** Render to Markdown string */
  toMarkdown(): string;

  /** Save Markdown to file */
  toMarkdownFile(path: string): Promise<void>;

  /** Render to HTML string */
  toHTML(): string;

  /** Save HTML to file */
  toHTMLFile(path: string): Promise<void>;

  /** Render to structured JSON */
  toJSON(): ReportJSON;
}

// =============================================================================
// v1.1: Trace Replay
// =============================================================================

/**
 * Replay mode determines how divergences are handled.
 */
export type ReplayMode =
  | "strict" // Fail if any divergence
  | "lenient" // Continue despite divergence
  | "compare"; // Record divergences, don't fail

/**
 * Options for replaying a trace.
 */
export interface ReplayOptions {
  /** World to replay against */
  world: ManifestoWorld;

  /** Stop at specific event sequence */
  stopAtSeq?: number;

  /** Stop at specific event type */
  stopAtEvent?: LabTraceEventType;

  /** Override actor for proposals */
  actorOverride?: string;

  /** Replay mode */
  mode?: ReplayMode;
}

/**
 * A single divergence encountered during replay.
 */
export interface Divergence {
  seq: number;
  originalEvent: LabTraceEvent;
  replayEvent: LabTraceEvent;
  cause: DivergenceCause;
}

/**
 * Result of replaying a trace.
 */
export interface ReplayResult {
  /** Resulting trace from replay */
  trace: LabTrace;

  /** Whether replay completed without divergence */
  success: boolean;

  /** Comparison with original */
  diff: TraceDiff;

  /** Divergences encountered (in compare mode) */
  divergences: Divergence[];

  /** Events replayed */
  eventsReplayed: number;

  /** Events remaining (if stopped early) */
  eventsRemaining: number;
}

// =============================================================================
// v1.1: Projection Components (Custom Renderers)
// =============================================================================

/**
 * Render context passed to all renderers.
 */
export interface RenderContext {
  /** Current step number */
  step: number;

  /** Total steps (may be unknown) */
  totalSteps: number;

  /** Run identifier */
  runId: string;

  /** Necessity level */
  level: NecessityLevel;

  /** Current lab state */
  state: LabState;

  /** Elapsed time in ms */
  elapsedMs: number;

  /** Recent trace events */
  recentEvents: LabTraceEvent[];

  /** Current projection mode */
  mode: ProjectionMode;
}

/**
 * Snapshot renderer for domain-specific visualization.
 */
export type SnapshotRenderer = (
  snapshot: Snapshot,
  context: RenderContext
) => string;

/**
 * Action renderer for intent visualization.
 */
export type ActionRenderer = (
  intent: unknown,
  before: Snapshot,
  after: Snapshot,
  context: RenderContext
) => string;

/**
 * Proposal renderer for proposal visualization.
 */
export type ProposalRenderer = (
  proposal: Proposal,
  context: RenderContext
) => string;

/**
 * Reasoning renderer for LLM reasoning visualization.
 */
export type ReasoningRenderer = (
  reasoning: string,
  confidence: number,
  context: RenderContext
) => string;

/**
 * Header renderer for custom header.
 */
export type HeaderRenderer = (context: RenderContext) => string;

/**
 * Footer renderer for custom footer.
 */
export type FooterRenderer = (context: RenderContext) => string;

/**
 * Layout sections for custom layout composition.
 */
export interface LayoutSections {
  header: string;
  domain: string;
  actions: string;
  reasoning: string;
  hitl: string;
  footer: string;
}

/**
 * Layout renderer for custom layout composition.
 */
export type LayoutRenderer = (sections: LayoutSections) => string;

/**
 * Custom projection components for domain-specific rendering.
 */
export interface ProjectionComponents {
  /** Custom snapshot renderer */
  renderSnapshot?: SnapshotRenderer;

  /** Custom action renderer */
  renderAction?: ActionRenderer;

  /** Custom proposal renderer */
  renderProposal?: ProposalRenderer;

  /** Custom reasoning renderer */
  renderReasoning?: ReasoningRenderer;

  /** Custom header renderer */
  header?: HeaderRenderer;

  /** Custom footer renderer */
  footer?: FooterRenderer;

  /** Custom layout renderer */
  layout?: LayoutRenderer;
}

// =============================================================================
// v1.1: HITL Prompt Builder
// =============================================================================

/**
 * Pending reason codes.
 */
export type PendingReasonCode =
  | "LOW_CONFIDENCE" // Confidence below threshold
  | "AMBIGUOUS_INTENT" // Multiple interpretations possible
  | "REQUIRES_CONFIRMATION" // Policy requires human confirmation
  | "SCOPE_EXCEEDED" // Action exceeds allowed scope
  | "RESOURCE_LIMIT"; // Would exceed resource limits

/**
 * Structured details for pending reasons.
 */
export interface PendingReasonDetails {
  /** For LOW_CONFIDENCE */
  confidence?: { actual: number; required: number };

  /** For AMBIGUOUS_INTENT */
  ambiguity?: { interpretations: unknown[]; question: string };

  /** For REQUIRES_CONFIRMATION */
  confirmation?: { policy: string; risk: "low" | "medium" | "high" };

  /** For SCOPE_EXCEEDED */
  scope?: { requested: string[]; allowed: string[] };

  /** For RESOURCE_LIMIT */
  resource?: { type: string; requested: number; limit: number };
}

/**
 * Explains why Authority returned pending.
 */
export interface PendingReason {
  /** Reason code */
  code: PendingReasonCode;

  /** Human-readable description */
  description: string;

  /** Structured details (code-specific) */
  details: PendingReasonDetails;

  /** Suggestions for resolution */
  suggestions?: string[];
}

/**
 * HITL action types.
 */
export type HITLAction =
  | {
      type: "retry";
      description: string;
      hint?: string;
    }
  | {
      type: "modify";
      description: string;
      allowedModifications: string[];
    }
  | {
      type: "request_info";
      description: string;
      suggestedQuestions: string[];
    }
  | {
      type: "escalate";
      description: string;
      to: string;
    }
  | {
      type: "abort";
      description: string;
    };

/**
 * Authority decision record.
 */
export interface DecisionRecord {
  authorityId: string;
  decision: "approved" | "rejected" | "pending";
  timestamp: number;
  verificationMethod?: VerificationMethod;
  confidence?: number;
  note?: string;
}

/**
 * Options for generating HITL prompt.
 */
export interface HITLPromptOptions {
  /** Use domain renderer for state visualization */
  stateRenderer?: SnapshotRenderer;

  /** Include available actions in prompt */
  includeActions?: boolean;

  /** Response format specification */
  responseFormat?: "json" | "text";

  /** Include response schema for structured output */
  includeSchema?: boolean;
}

/**
 * Structured prompt for HITL resolution.
 */
export interface HITLPrompt {
  /** Situation description */
  situation: string;

  /** Current state (rendered by stateRenderer if provided) */
  currentState: string;

  /** The proposal that was submitted */
  yourProposal: {
    intentType: string;
    content: unknown;
  };

  /** Why it's pending */
  whyPending: {
    reason: PendingReasonCode;
    description: string;
    details: PendingReasonDetails;
  };

  /** Available options */
  options: {
    id: string;
    type: HITLAction["type"];
    description: string;
    example?: string;
  }[];

  /** Expected response format */
  responseFormat?: {
    type: "json";
    schema: unknown;
  };
}

/**
 * Extended HITL context (v1.1) with prompt builder.
 */
export interface HITLContextV1 {
  /** Current snapshot at time of pending */
  snapshot: Snapshot;

  /** The pending proposal */
  proposal: Proposal;

  /** Why this proposal is pending */
  pendingReason: PendingReason;

  /** Available actions for resolution */
  availableActions: HITLAction[];

  /** Render context (reused from Projection) */
  renderContext: RenderContext;

  /** Decision record from Authority */
  decisionRecord: DecisionRecord;

  /** Generate structured prompt for agent */
  toPrompt(options?: HITLPromptOptions): HITLPrompt;
}
