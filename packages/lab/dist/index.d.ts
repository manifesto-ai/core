/**
 * @manifesto-ai/lab
 *
 * Manifesto Lab - LLM governance, experimentation, and tracing for Manifesto systems.
 *
 * The Lab package provides:
 * - Necessity level detection and governance
 * - Lab wrapper for World observation
 * - Trace recording for reproducibility
 * - HITL intervention support
 * - Real-time projection visualization
 *
 * @example
 * ```typescript
 * import { createManifestoWorld } from '@manifesto-ai/world';
 * import { withLab } from '@manifesto-ai/lab';
 *
 * const world = createManifestoWorld({ schemaHash, host });
 *
 * const labWorld = withLab(world, {
 *   runId: 'exp-001',
 *   necessityLevel: 1,
 *   outputPath: './traces',
 *   projection: { enabled: true, mode: 'interactive' },
 *   hitl: { enabled: true, timeout: 300000 },
 * });
 *
 * await labWorld.submitProposal(...);
 * const trace = labWorld.trace();
 * ```
 *
 * @packageDocumentation
 */
export { withLab } from "./lab/index.js";
export { createLevelAuthority } from "./authority/index.js";
export type { NecessityLevel, LLMRole, VerificationMethod, VerificationGuarantee, ProjectionMode, ProjectionView, ProjectionOptions, ProjectionController, HITLContext, AutoApproveCondition, HITLOptions, ApproveOptions, ProposalModification, HITLController, LabOptions, LabStatus, LabState, LabMeta, LabTraceHeader, LabTraceEventType, BaseTraceEvent, ProposalTraceEvent, AuthorityDecisionTraceEvent, ApplyTraceEvent, EffectTraceEvent, EffectResultTraceEvent, HITLTraceEvent, TerminationTraceEvent, WorldCreatedTraceEvent, FailureExplanationTraceEvent, LabTraceEvent, LabTrace, FailureReason, ErrorInfo, ExplanationEvidence, CounterfactualChange, Counterfactual, FailureExplanation, LabReport, LabEventType, LabEvent, LabEventHandler, Unsubscribe, LabWorld, LevelAuthorityHandler, LevelAuthorityOptions, } from "./types.js";
export { NecessityBaseSchema, LevelDetectionSchema, LLMTraceEntrySchema, HypothesisSchema, RefutingConditionSchema, ObservationSchema, BeliefStateSchema, Level1Schema, AssumptionSchema, ValidationStatusSchema, InterpretedRuleSchema, Level2Schema, ReferenceResolutionSchema, AmbiguitySchema, ConfirmationStatusSchema, GroundingStateSchema, Level3Schema, } from "./schemas/index.js";
export { saveTrace, loadTrace, loadAllTraces, loadDirTraces, LabTraceIO, summarize, formatSummary, diffTraces, formatDiff, areTracesIdentical, replay, replayPartial, findFirstDivergence, } from "./trace/index.js";
export { enhanceReport, toMarkdown, toHTML, toReportJSON, } from "./report/index.js";
export { createRenderContext, formatElapsedTime, getLevelName, defaultHeaderRenderer, defaultFooterRenderer, defaultSnapshotRenderer, defaultActionRenderer, defaultProposalRenderer, defaultReasoningRenderer, defaultLayoutRenderer, mergeRenderers, renderAllSections, renderComplete, } from "./projection/index.js";
export { PendingReasons, lowConfidence, ambiguousIntent, requiresConfirmation, scopeExceeded, resourceLimit, createPendingReason, HITLActions, retry, modify, requestInfo, escalate, abort, getDefaultActions, buildPrompt, promptToText, promptToJSON, createHITLContext, createPendingDecisionRecord, canAutoResolve, getSuggestedAction, } from "./hitl/index.js";
export type { TraceSaveOptions, TraceOutcome, TraceSummary, LevelSummary, HITLSummary, LLMSummary, TraceDiff, DivergenceType, DivergenceCause, EventDiff, ReplayOptions, ReplayMode, ReplayResult, Divergence, ReportJSON, TimelineEntry, EnhancedLabReport, ProjectionComponents, RenderContext, LayoutSections, SnapshotRenderer, ActionRenderer, ProposalRenderer, ReasoningRenderer, HeaderRenderer, FooterRenderer, LayoutRenderer, PendingReasonCode, PendingReasonDetails, PendingReason, HITLAction, HITLPromptOptions, HITLPrompt, DecisionRecord, HITLContextV1, } from "./types.js";
export type { BuildPromptOptions, CreateHITLContextOptions } from "./hitl/index.js";
export type { CreateRenderContextOptions } from "./projection/index.js";
//# sourceMappingURL=index.d.ts.map