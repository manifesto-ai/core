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
// =============================================================================
// Main API
// =============================================================================
export { withLab } from "./lab/index.js";
// =============================================================================
// Authority
// =============================================================================
export { createLevelAuthority } from "./authority/index.js";
// =============================================================================
// Schemas
// =============================================================================
export { 
// Base schemas
NecessityBaseSchema, LevelDetectionSchema, LLMTraceEntrySchema, 
// Level 1 schemas
HypothesisSchema, RefutingConditionSchema, ObservationSchema, BeliefStateSchema, Level1Schema, 
// Level 2 schemas
AssumptionSchema, ValidationStatusSchema, InterpretedRuleSchema, Level2Schema, 
// Level 3 schemas
ReferenceResolutionSchema, AmbiguitySchema, ConfirmationStatusSchema, GroundingStateSchema, Level3Schema, } from "./schemas/index.js";
// =============================================================================
// v1.1: Trace Utilities
// =============================================================================
export { 
// I/O
saveTrace, loadTrace, loadAllTraces, loadDirTraces, LabTraceIO, 
// Summary
summarize, formatSummary, 
// Diff
diffTraces, formatDiff, areTracesIdentical, 
// Replay
replay, replayPartial, findFirstDivergence, } from "./trace/index.js";
// =============================================================================
// v1.1: Report Formats
// =============================================================================
export { enhanceReport, toMarkdown, toHTML, toReportJSON, } from "./report/index.js";
// =============================================================================
// v1.1: Projection Components
// =============================================================================
export { 
// Context
createRenderContext, formatElapsedTime, getLevelName, 
// Renderers
defaultHeaderRenderer, defaultFooterRenderer, defaultSnapshotRenderer, defaultActionRenderer, defaultProposalRenderer, defaultReasoningRenderer, defaultLayoutRenderer, mergeRenderers, renderAllSections, renderComplete, } from "./projection/index.js";
// =============================================================================
// v1.1: HITL Prompt Builder
// =============================================================================
export { 
// Pending Reason
PendingReasons, lowConfidence, ambiguousIntent, requiresConfirmation, scopeExceeded, resourceLimit, createPendingReason, 
// HITL Actions
HITLActions, retry, modify, requestInfo, escalate, abort, getDefaultActions, 
// Prompt Builder
buildPrompt, promptToText, promptToJSON, 
// HITL Context
createHITLContext, createPendingDecisionRecord, canAutoResolve, getSuggestedAction, } from "./hitl/index.js";
//# sourceMappingURL=index.js.map