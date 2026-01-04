/**
 * HITL Prompt Builder
 *
 * Generates structured prompts for HITL resolution.
 * Added in v1.1.
 */
import { defaultSnapshotRenderer } from "../projection/renderers.js";
// =============================================================================
// Response Schema
// =============================================================================
/**
 * JSON schema for structured HITL response.
 */
const RESPONSE_SCHEMA = {
    type: "object",
    properties: {
        action: {
            type: "string",
            enum: ["approve", "reject", "modify", "request_info", "escalate", "abort"],
            description: "The chosen action",
        },
        reason: {
            type: "string",
            description: "Explanation for the decision",
        },
        modifications: {
            type: "object",
            description: "Modifications if action is 'modify'",
        },
        question: {
            type: "string",
            description: "Question if action is 'request_info'",
        },
    },
    required: ["action", "reason"],
};
/**
 * Build an HITL prompt from context.
 *
 * @param options - Build options
 * @returns Structured HITL prompt
 */
export function buildPrompt(options) {
    const { snapshot, proposal, pendingReason, availableActions, renderContext, promptOptions = {}, } = options;
    // Use provided renderer or default
    const stateRenderer = promptOptions.stateRenderer ?? defaultSnapshotRenderer;
    // Render current state
    const currentState = stateRenderer(snapshot, renderContext);
    // Build situation description
    const situation = buildSituation(renderContext, proposal);
    // Build proposal section
    const yourProposal = {
        intentType: proposal.intent.body.type,
        content: proposal.intent.body.input,
    };
    // Build whyPending section
    const whyPending = {
        reason: pendingReason.code,
        description: pendingReason.description,
        details: pendingReason.details,
    };
    // Build options section
    const promptOptions2 = [];
    // Add approve option (always available)
    promptOptions2.push({
        id: "approve",
        type: "retry",
        description: "Approve the proposal as-is",
        example: '{ "action": "approve", "reason": "Confirmed correct" }',
    });
    // Add reject option (always available)
    promptOptions2.push({
        id: "reject",
        type: "abort",
        description: "Reject the proposal",
        example: '{ "action": "reject", "reason": "Not appropriate" }',
    });
    // Add available actions if requested
    if (promptOptions.includeActions !== false) {
        for (const action of availableActions) {
            promptOptions2.push(actionToOption(action));
        }
    }
    // Build final prompt
    const prompt = {
        situation,
        currentState,
        yourProposal,
        whyPending,
        options: promptOptions2,
    };
    // Add response format if requested
    if (promptOptions.responseFormat === "json" && promptOptions.includeSchema) {
        prompt.responseFormat = {
            type: "json",
            schema: RESPONSE_SCHEMA,
        };
    }
    return prompt;
}
/**
 * Build situation description.
 */
function buildSituation(context, proposal) {
    const levelDesc = getLevelDescription(context.level);
    const stepInfo = context.totalSteps > 0
        ? `Step ${context.step}/${context.totalSteps}`
        : `Step ${context.step}`;
    return (`You are operating at Necessity Level ${context.level} (${levelDesc}). ` +
        `Current run: ${context.runId}, ${stepInfo}. ` +
        `A proposal from actor "${proposal.actor.actorId}" requires your decision.`);
}
/**
 * Get level description.
 */
function getLevelDescription(level) {
    switch (level) {
        case 0:
            return "Deterministic";
        case 1:
            return "Partial Observation";
        case 2:
            return "Open-Ended Rules";
        case 3:
            return "Natural Language";
        default:
            return `Level ${level}`;
    }
}
/**
 * Convert HITLAction to prompt option.
 */
function actionToOption(action) {
    switch (action.type) {
        case "retry":
            return {
                id: `retry-${Date.now()}`,
                type: "retry",
                description: action.description,
                example: action.hint,
            };
        case "modify":
            return {
                id: `modify-${Date.now()}`,
                type: "modify",
                description: action.description,
                example: `Allowed modifications: ${action.allowedModifications.join(", ")}`,
            };
        case "request_info":
            return {
                id: `request_info-${Date.now()}`,
                type: "request_info",
                description: action.description,
                example: `Suggested questions: ${action.suggestedQuestions.join("; ")}`,
            };
        case "escalate":
            return {
                id: `escalate-${Date.now()}`,
                type: "escalate",
                description: action.description,
                example: `Escalate to: ${action.to}`,
            };
        case "abort":
            return {
                id: `abort-${Date.now()}`,
                type: "abort",
                description: action.description,
            };
    }
}
// =============================================================================
// Prompt Serialization
// =============================================================================
/**
 * Convert HITLPrompt to a text string for display or sending to an agent.
 *
 * @param prompt - The HITL prompt
 * @returns Formatted text string
 */
export function promptToText(prompt) {
    const lines = [];
    lines.push("=== HITL Decision Required ===");
    lines.push("");
    lines.push("## Situation");
    lines.push(prompt.situation);
    lines.push("");
    lines.push("## Current State");
    lines.push(prompt.currentState);
    lines.push("");
    lines.push("## Your Proposal");
    lines.push(`Intent Type: ${prompt.yourProposal.intentType}`);
    lines.push(`Content: ${JSON.stringify(prompt.yourProposal.content, null, 2)}`);
    lines.push("");
    lines.push("## Why Pending");
    lines.push(`Reason: ${prompt.whyPending.reason}`);
    lines.push(`Description: ${prompt.whyPending.description}`);
    if (Object.keys(prompt.whyPending.details).length > 0) {
        lines.push(`Details: ${JSON.stringify(prompt.whyPending.details, null, 2)}`);
    }
    lines.push("");
    lines.push("## Available Options");
    for (const option of prompt.options) {
        lines.push(`- [${option.id}] ${option.type}: ${option.description}`);
        if (option.example) {
            lines.push(`  Example: ${option.example}`);
        }
    }
    lines.push("");
    if (prompt.responseFormat) {
        lines.push("## Response Format");
        lines.push("Please respond with a JSON object matching this schema:");
        lines.push(JSON.stringify(prompt.responseFormat.schema, null, 2));
    }
    return lines.join("\n");
}
/**
 * Convert HITLPrompt to JSON string.
 *
 * @param prompt - The HITL prompt
 * @param pretty - Whether to pretty-print
 * @returns JSON string
 */
export function promptToJSON(prompt, pretty = false) {
    return pretty ? JSON.stringify(prompt, null, 2) : JSON.stringify(prompt);
}
//# sourceMappingURL=prompt.js.map