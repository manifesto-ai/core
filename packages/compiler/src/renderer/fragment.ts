/**
 * PatchFragment to MEL Renderer
 *
 * Converts PatchFragment to MEL syntax with metadata comments.
 */

import { renderPatchOp, PatchOp, RenderOptions } from "./patch-op.js";

// ============ PatchFragment Type ============

export interface PatchFragment {
  /**
   * Unique fragment identifier (content-addressed)
   */
  fragmentId: string;

  /**
   * Source intent identifier
   */
  sourceIntentId: string;

  /**
   * Fragment operation
   */
  op: PatchOp;

  /**
   * Confidence score (0-1)
   */
  confidence: number;

  /**
   * Evidence strings
   */
  evidence: string[];

  /**
   * Creation timestamp (ISO 8601)
   */
  createdAt: string;
}

// ============ Render Options ============

export interface FragmentRenderOptions extends RenderOptions {
  /**
   * Include fragment metadata as comments
   */
  includeMetadata?: boolean;

  /**
   * Include evidence as comments
   */
  includeEvidence?: boolean;

  /**
   * Include confidence score
   */
  includeConfidence?: boolean;

  /**
   * Include fragment ID
   */
  includeFragmentId?: boolean;
}

const DEFAULT_FRAGMENT_OPTIONS: FragmentRenderOptions = {
  indent: "  ",
  includeComments: true,
  commentPrefix: "// ",
  includeMetadata: true,
  includeEvidence: false,
  includeConfidence: true,
  includeFragmentId: false,
};

// ============ Fragment Renderer ============

/**
 * Renders a PatchFragment to MEL syntax string with optional metadata.
 *
 * @param fragment - The PatchFragment to render
 * @param options - Rendering options
 * @returns MEL syntax string with metadata comments
 */
export function renderFragment(
  fragment: PatchFragment,
  options?: FragmentRenderOptions
): string {
  const opts = { ...DEFAULT_FRAGMENT_OPTIONS, ...options };
  const lines: string[] = [];

  // Add metadata comments
  if (opts.includeMetadata) {
    if (opts.includeFragmentId) {
      lines.push(`${opts.commentPrefix}Fragment: ${fragment.fragmentId}`);
    }
    if (opts.includeConfidence) {
      const confidencePercent = (fragment.confidence * 100).toFixed(0);
      lines.push(`${opts.commentPrefix}Confidence: ${confidencePercent}%`);
    }
    if (opts.includeEvidence && fragment.evidence.length > 0) {
      lines.push(`${opts.commentPrefix}Evidence:`);
      for (const evidence of fragment.evidence) {
        lines.push(`${opts.commentPrefix}  - ${evidence}`);
      }
    }
  }

  // Render the operation
  const opStr = renderPatchOp(fragment.op, {
    indent: opts.indent,
    includeComments: opts.includeComments,
    commentPrefix: opts.commentPrefix,
  });

  lines.push(opStr);

  return lines.join("\n");
}

/**
 * Renders multiple PatchFragments to MEL syntax string.
 *
 * @param fragments - The PatchFragments to render
 * @param options - Rendering options
 * @returns MEL syntax string with all fragments
 */
export function renderFragments(
  fragments: PatchFragment[],
  options?: FragmentRenderOptions
): string {
  const opts = { ...DEFAULT_FRAGMENT_OPTIONS, ...options };

  const renderedFragments = fragments.map((fragment) =>
    renderFragment(fragment, opts)
  );

  return renderedFragments.join("\n\n");
}

/**
 * Renders PatchFragments grouped by operation kind.
 *
 * @param fragments - The PatchFragments to render
 * @param options - Rendering options
 * @returns Object with rendered strings grouped by operation kind
 */
export function renderFragmentsByKind(
  fragments: PatchFragment[],
  options?: FragmentRenderOptions
): Record<string, string> {
  const opts = { ...DEFAULT_FRAGMENT_OPTIONS, ...options };
  const grouped: Record<string, PatchFragment[]> = {};

  for (const fragment of fragments) {
    const kind = fragment.op.kind;
    if (!grouped[kind]) {
      grouped[kind] = [];
    }
    grouped[kind].push(fragment);
  }

  const result: Record<string, string> = {};
  for (const [kind, kindFragments] of Object.entries(grouped)) {
    result[kind] = renderFragments(kindFragments, opts);
  }

  return result;
}

/**
 * Renders PatchFragments as a complete MEL domain block.
 *
 * @param domainName - The domain name
 * @param fragments - The PatchFragments to render
 * @param options - Rendering options
 * @returns Complete MEL domain string
 */
export function renderAsDomain(
  domainName: string,
  fragments: PatchFragment[],
  options?: FragmentRenderOptions
): string {
  const opts = { ...DEFAULT_FRAGMENT_OPTIONS, ...options };
  const indent = opts.indent ?? "  ";

  // Group fragments by type for organized output
  const types: PatchFragment[] = [];
  const fields: PatchFragment[] = [];
  const defaults: PatchFragment[] = [];
  const computed: PatchFragment[] = [];
  const constraints: PatchFragment[] = [];
  const actions: PatchFragment[] = [];

  for (const fragment of fragments) {
    switch (fragment.op.kind) {
      case "addType":
        types.push(fragment);
        break;
      case "addField":
      case "setFieldType":
        fields.push(fragment);
        break;
      case "setDefaultValue":
        defaults.push(fragment);
        break;
      case "addComputed":
        computed.push(fragment);
        break;
      case "addConstraint":
        constraints.push(fragment);
        break;
      case "addActionAvailable":
        actions.push(fragment);
        break;
    }
  }

  const lines: string[] = [];
  lines.push(`domain ${domainName} {`);

  // State section
  if (fields.length > 0 || defaults.length > 0) {
    lines.push(`${indent}state {`);
    for (const fragment of [...fields, ...defaults]) {
      const rendered = renderPatchOp(fragment.op, { indent: indent + indent, includeComments: false });
      lines.push(`${indent}${indent}${rendered}`);
    }
    lines.push(`${indent}}`);
    lines.push("");
  }

  // Types section
  for (const fragment of types) {
    const rendered = renderPatchOp(fragment.op, { indent, includeComments: false });
    // Indent each line
    const indented = rendered.split("\n").map(line => `${indent}${line}`).join("\n");
    lines.push(indented);
    lines.push("");
  }

  // Computed section
  for (const fragment of computed) {
    const rendered = renderPatchOp(fragment.op, { indent, includeComments: false });
    lines.push(`${indent}${rendered}`);
  }
  if (computed.length > 0) lines.push("");

  // Constraints section (as comments)
  for (const fragment of constraints) {
    const rendered = renderPatchOp(fragment.op, { indent, includeComments: true });
    lines.push(`${indent}${rendered}`);
  }
  if (constraints.length > 0) lines.push("");

  // Actions section
  for (const fragment of actions) {
    const rendered = renderPatchOp(fragment.op, { indent, includeComments: false });
    const indented = rendered.split("\n").map(line => `${indent}${line}`).join("\n");
    lines.push(indented);
    lines.push("");
  }

  lines.push("}");

  return lines.join("\n");
}
