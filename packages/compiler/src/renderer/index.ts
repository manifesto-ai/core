/**
 * MEL Renderer
 *
 * Converts PatchFragment AST to MEL text syntax.
 *
 * This is the inverse of the parser: Parser (MEL text → AST), Renderer (AST → MEL text).
 *
 * @example
 * ```typescript
 * import { renderFragment, renderAsDomain } from '@manifesto-ai/compiler';
 *
 * // Render a single fragment
 * const mel = renderFragment(fragment);
 *
 * // Render multiple fragments as a domain
 * const domain = renderAsDomain('MyDomain', fragments);
 * ```
 */

// Type expression renderer
export {
  renderTypeExpr,
  renderTypeField,
  renderValue,
  type TypeExpr,
  type TypeField,
} from "./type-expr.js";

// Expression node renderer
export {
  renderExprNode,
  type ExprNode,
} from "./expr-node.js";

// Patch operation renderer
export {
  renderPatchOp,
  extractTypeName,
  type PatchOp,
  type AddTypeOp,
  type AddFieldOp,
  type SetFieldTypeOp,
  type SetDefaultValueOp,
  type AddConstraintOp,
  type AddComputedOp,
  type AddActionAvailableOp,
  type RenderOptions,
} from "./patch-op.js";

// Fragment renderer
export {
  renderFragment,
  renderFragments,
  renderFragmentsByKind,
  renderAsDomain,
  type PatchFragment,
  type FragmentRenderOptions,
} from "./fragment.js";
