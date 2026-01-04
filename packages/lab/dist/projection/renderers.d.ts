/**
 * Projection Renderers
 *
 * Default renderers and rendering utilities for projection.
 * Added in v1.1.
 */
import type { Snapshot, Proposal } from "@manifesto-ai/world";
import type { RenderContext, SnapshotRenderer, ActionRenderer, ProposalRenderer, ReasoningRenderer, HeaderRenderer, FooterRenderer, LayoutRenderer, LayoutSections, ProjectionComponents } from "../types.js";
/**
 * Default header renderer.
 */
export declare const defaultHeaderRenderer: HeaderRenderer;
/**
 * Default footer renderer.
 */
export declare const defaultFooterRenderer: FooterRenderer;
/**
 * Default snapshot renderer.
 * Shows a JSON summary of the snapshot data.
 */
export declare const defaultSnapshotRenderer: SnapshotRenderer;
/**
 * Default action renderer.
 */
export declare const defaultActionRenderer: ActionRenderer;
/**
 * Default proposal renderer.
 */
export declare const defaultProposalRenderer: ProposalRenderer;
/**
 * Default reasoning renderer.
 */
export declare const defaultReasoningRenderer: ReasoningRenderer;
/**
 * Default layout renderer.
 */
export declare const defaultLayoutRenderer: LayoutRenderer;
/**
 * Merge custom renderers with defaults.
 */
export declare function mergeRenderers(custom?: ProjectionComponents): Required<ProjectionComponents>;
/**
 * Render all sections using components.
 */
export declare function renderAllSections(components: Required<ProjectionComponents>, options: {
    snapshot?: Snapshot | null;
    intent?: unknown;
    beforeSnapshot?: Snapshot | null;
    afterSnapshot?: Snapshot | null;
    proposal?: Proposal | null;
    reasoning?: string | null;
    confidence?: number;
    hitlContent?: string;
    context: RenderContext;
}): LayoutSections;
/**
 * Render complete output using components.
 */
export declare function renderComplete(components: Required<ProjectionComponents>, options: Parameters<typeof renderAllSections>[1]): string;
//# sourceMappingURL=renderers.d.ts.map