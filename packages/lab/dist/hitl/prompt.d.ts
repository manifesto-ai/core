/**
 * HITL Prompt Builder
 *
 * Generates structured prompts for HITL resolution.
 * Added in v1.1.
 */
import type { Snapshot, Proposal } from "@manifesto-ai/world";
import type { HITLPrompt, HITLPromptOptions, HITLAction, PendingReason, RenderContext } from "../types.js";
/**
 * Options for building an HITL prompt.
 */
export interface BuildPromptOptions {
    /** Current snapshot */
    snapshot: Snapshot;
    /** The pending proposal */
    proposal: Proposal;
    /** Why the proposal is pending */
    pendingReason: PendingReason;
    /** Available actions */
    availableActions: HITLAction[];
    /** Render context */
    renderContext: RenderContext;
    /** Prompt generation options */
    promptOptions?: HITLPromptOptions;
}
/**
 * Build an HITL prompt from context.
 *
 * @param options - Build options
 * @returns Structured HITL prompt
 */
export declare function buildPrompt(options: BuildPromptOptions): HITLPrompt;
/**
 * Convert HITLPrompt to a text string for display or sending to an agent.
 *
 * @param prompt - The HITL prompt
 * @returns Formatted text string
 */
export declare function promptToText(prompt: HITLPrompt): string;
/**
 * Convert HITLPrompt to JSON string.
 *
 * @param prompt - The HITL prompt
 * @param pretty - Whether to pretty-print
 * @returns JSON string
 */
export declare function promptToJSON(prompt: HITLPrompt, pretty?: boolean): string;
//# sourceMappingURL=prompt.d.ts.map