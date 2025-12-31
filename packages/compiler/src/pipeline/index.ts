/**
 * @manifesto-ai/compiler v1.1 Pipeline
 *
 * Deterministic pipeline components for the Fragment Pipeline architecture.
 */

// PassLayer
export {
  createPassLayer,
  PASS_LAYER_VERSION,
  type PassLayer,
  type PassContext,
  type PassResult,
} from "./pass-layer.js";

// Linker
export {
  createLinker,
  LINKER_VERSION,
  type Linker,
  type LinkContext,
  type LinkResult,
} from "./linker.js";

// Verifier
export {
  createVerifier,
  VERIFIER_VERSION,
  type Verifier,
  type VerifyContext,
  type VerifyResult,
} from "./verifier.js";

// Emitter
export {
  createEmitter,
  EMITTER_VERSION,
  COMPILER_VERSION,
  type Emitter,
  type EmitContext,
  type EmitResult,
} from "./emitter.js";
