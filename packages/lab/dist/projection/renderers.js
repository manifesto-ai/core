/**
 * Projection Renderers
 *
 * Default renderers and rendering utilities for projection.
 * Added in v1.1.
 */
import { formatElapsedTime, getLevelName } from "./context.js";
// =============================================================================
// Default Renderers
// =============================================================================
/**
 * Default header renderer.
 */
export const defaultHeaderRenderer = (ctx) => {
    const level = `Level ${ctx.level} (${getLevelName(ctx.level)})`;
    const time = formatElapsedTime(ctx.elapsedMs);
    const step = ctx.totalSteps > 0
        ? `Step: ${ctx.step}/${ctx.totalSteps}`
        : `Step: ${ctx.step}`;
    return `Lab: ${ctx.runId}  |  ${level}  |  ${step}  |  ${time}`;
};
/**
 * Default footer renderer.
 */
export const defaultFooterRenderer = (ctx) => {
    const status = ctx.state.status;
    const modeLabel = ctx.mode.toUpperCase();
    switch (status) {
        case "running":
            return `[${modeLabel}] Running...`;
        case "waiting_hitl":
            return `[${modeLabel}] Waiting for HITL decision`;
        case "completed":
            return `[${modeLabel}] Completed: ${ctx.state.outcome}`;
        case "aborted":
            return `[${modeLabel}] Aborted: ${ctx.state.reason}`;
        default:
            return `[${modeLabel}]`;
    }
};
/**
 * Default snapshot renderer.
 * Shows a JSON summary of the snapshot data.
 */
export const defaultSnapshotRenderer = (snapshot, ctx) => {
    if (!snapshot || !snapshot.data) {
        return "(No snapshot data)";
    }
    try {
        // Show truncated JSON preview
        const json = JSON.stringify(snapshot.data, null, 2);
        const lines = json.split("\n");
        if (lines.length > 10) {
            return lines.slice(0, 10).join("\n") + "\n... (truncated)";
        }
        return json;
    }
    catch {
        return "(Unable to render snapshot)";
    }
};
/**
 * Default action renderer.
 */
export const defaultActionRenderer = (intent, before, after, ctx) => {
    if (!intent || typeof intent !== "object") {
        return "(No action)";
    }
    const body = intent.body;
    const type = body?.type ?? "unknown";
    return `Action: ${type}`;
};
/**
 * Default proposal renderer.
 */
export const defaultProposalRenderer = (proposal, ctx) => {
    const intentType = proposal.intent?.body?.type ?? "unknown";
    const status = proposal.status;
    return `Proposal: ${proposal.proposalId}\n  Intent: ${intentType}\n  Status: ${status}`;
};
/**
 * Default reasoning renderer.
 */
export const defaultReasoningRenderer = (reasoning, confidence, ctx) => {
    const confidencePercent = (confidence * 100).toFixed(0);
    return `Reasoning:\n  "${reasoning}"\n  Confidence: ${confidencePercent}%`;
};
/**
 * Default layout renderer.
 */
export const defaultLayoutRenderer = (sections) => {
    const divider = "─".repeat(60);
    const parts = [];
    if (sections.header) {
        parts.push(sections.header);
        parts.push(divider);
    }
    if (sections.domain) {
        parts.push(sections.domain);
        parts.push(divider);
    }
    if (sections.actions) {
        parts.push(sections.actions);
        parts.push(divider);
    }
    if (sections.reasoning) {
        parts.push(sections.reasoning);
        parts.push(divider);
    }
    if (sections.hitl) {
        parts.push(sections.hitl);
        parts.push(divider);
    }
    if (sections.footer) {
        parts.push(sections.footer);
    }
    return parts.join("\n");
};
// =============================================================================
// Renderer Utilities
// =============================================================================
/**
 * Merge custom renderers with defaults.
 */
export function mergeRenderers(custom) {
    return {
        renderSnapshot: custom?.renderSnapshot ?? defaultSnapshotRenderer,
        renderAction: custom?.renderAction ?? defaultActionRenderer,
        renderProposal: custom?.renderProposal ?? defaultProposalRenderer,
        renderReasoning: custom?.renderReasoning ?? defaultReasoningRenderer,
        header: custom?.header ?? defaultHeaderRenderer,
        footer: custom?.footer ?? defaultFooterRenderer,
        layout: custom?.layout ?? defaultLayoutRenderer,
    };
}
/**
 * Render all sections using components.
 */
export function renderAllSections(components, options) {
    const { context } = options;
    // Render each section
    const header = components.header(context);
    const domain = options.snapshot
        ? components.renderSnapshot(options.snapshot, context)
        : "";
    const actions = options.intent && options.beforeSnapshot && options.afterSnapshot
        ? components.renderAction(options.intent, options.beforeSnapshot, options.afterSnapshot, context)
        : "";
    const reasoning = options.reasoning !== null && options.reasoning !== undefined
        ? components.renderReasoning(options.reasoning, options.confidence ?? 0, context)
        : "";
    const hitl = options.hitlContent ?? "";
    const footer = components.footer(context);
    return {
        header,
        domain,
        actions,
        reasoning,
        hitl,
        footer,
    };
}
/**
 * Render complete output using components.
 */
export function renderComplete(components, options) {
    const sections = renderAllSections(components, options);
    return components.layout(sections);
}
//# sourceMappingURL=renderers.js.map