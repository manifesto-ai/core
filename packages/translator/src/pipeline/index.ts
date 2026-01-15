/**
 * @fileoverview Pipeline Module Exports
 *
 * Re-exports all pipeline stage implementations.
 */

// S1: Normalize
export {
  type NormalizeResult,
  type NormalizeTrace,
  normalize,
  createNormalizeTrace,
} from "./normalize.js";

// S2: Propose (LLM)
export {
  type ProposeInput,
  type ProposeResult,
  type ProposeTrace,
  propose,
  createProposeTrace,
} from "./propose.js";

// LLM Client Interface
export {
  type ProposeRequest,
  type ProposeResponse,
  type LLMClient,
  MockLLMClient,
  createMockLLMClient,
} from "./llm-client.js";

// OpenAI Client
export {
  type OpenAIClientOptions,
  OpenAIClient,
  createOpenAIClient,
} from "./openai-client.js";

// S3: Canonicalize
export {
  type CanonicalizeResult,
  type CanonicalizeTrace,
  canonicalize,
  createCanonicalizeTrace,
  areSemanticallySame,
} from "./canonicalize.js";

// S4: Feature Check
export {
  type FeatureCheckResult,
  type FeatureCheck,
  type FeatureCheckTrace,
  featureCheck,
  createFeatureCheckTrace,
} from "./feature-check.js";

// S5: Resolve References
export {
  type ResolveStageOutput,
  type ResolutionContext,
  type ResolveStageTrace,
  buildResolutionContext,
  resolveReferences,
  createResolveStageTrace,
  countSymbolicRefs,
} from "./resolve-refs.js";

// S6: Lower
export {
  type LowerStageResult,
  type LowerTrace,
  lowerIR,
  createLowerTrace,
  isResolved,
} from "./lower.js";

// S7: Validate Action Body
export {
  type ValidateActionBodyResult,
  type ValidateActionBodyTrace,
  isActionRelatedLemma,
  validateActionBody,
  extractActionBody,
  createValidateActionBodyTrace,
} from "./validate-action-body.js";
