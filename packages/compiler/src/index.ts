/**
 * @manifesto-ai/compiler
 *
 * MEL (Manifesto Expression Language) compiler.
 * Provides lexer, parser, analyzer, lowering, evaluation, and rendering.
 */

// ════════════════════════════════════════════════════════════════════════════
// Lexer (MEL source → tokens)
// ════════════════════════════════════════════════════════════════════════════

export * from "./lexer/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Parser (tokens → AST)
// ════════════════════════════════════════════════════════════════════════════

export * from "./parser/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Analyzer (AST validation and scope analysis)
// ════════════════════════════════════════════════════════════════════════════

export * from "./analyzer/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Diagnostics
// ════════════════════════════════════════════════════════════════════════════

export * from "./diagnostics/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Generator (AST → IR)
// ════════════════════════════════════════════════════════════════════════════

export * from "./generator/index.js";

// ════════════════════════════════════════════════════════════════════════════
// MEL Renderer (PatchFragment → MEL text)
// Re-export with namespace to avoid ExprNode conflict with parser
// ════════════════════════════════════════════════════════════════════════════

export {
  renderTypeExpr,
  renderTypeField,
  renderValue,
  renderExprNode,
  renderPatchOp,
  extractTypeName,
  renderFragment,
  renderFragments,
  renderFragmentsByKind,
  renderAsDomain,
  type TypeExpr,
  type TypeField,
  type ExprNode as RendererExprNode,
  type PatchOp,
  type AddTypeOp,
  type AddFieldOp,
  type SetFieldTypeOp,
  type SetDefaultValueOp,
  type AddConstraintOp,
  type AddComputedOp,
  type AddActionAvailableOp,
  type RenderOptions,
  type PatchFragment,
  type FragmentRenderOptions,
} from "./renderer/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Lowering (MEL IR → Core IR)
// ════════════════════════════════════════════════════════════════════════════

export * from "./lowering/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Evaluation (Core IR → Concrete Values)
// ════════════════════════════════════════════════════════════════════════════

export * from "./evaluation/index.js";

// ════════════════════════════════════════════════════════════════════════════
// Compile API (MEL Text Ingest)
// ════════════════════════════════════════════════════════════════════════════

export * from "./api/index.js";
