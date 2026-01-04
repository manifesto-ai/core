/**
 * Trace Summary
 *
 * Aggregates statistics across one or more Lab traces.
 * Added in v1.1.
 */
// =============================================================================
// Helpers
// =============================================================================
/**
 * Map FailureExplanation.kind to FailureReason.
 */
function kindToReason(kind) {
    switch (kind) {
        case "structural":
            return "NO_EXECUTABLE_ACTION";
        case "informational":
            return "GOAL_UNREACHABLE";
        case "governance":
            return "AUTHORITY_REJECTION";
        case "human_required":
            return "HUMAN_REQUIRED";
        case "resource":
            return "RESOURCE_EXHAUSTED";
        default:
            return "GOAL_UNREACHABLE";
    }
}
// =============================================================================
// Main API
// =============================================================================
/**
 * Summarize one or more traces.
 *
 * @param traces - Single trace or array of traces
 * @returns Aggregated summary statistics
 */
export function summarize(traces) {
    const traceArray = Array.isArray(traces) ? traces : [traces];
    if (traceArray.length === 0) {
        return createEmptySummary();
    }
    // Collect raw stats
    const stats = collectStats(traceArray);
    // Build summary
    return buildSummary(stats);
}
/**
 * Collect raw statistics from traces.
 */
function collectStats(traces) {
    const stats = {
        runs: traces.length,
        successCount: 0,
        totalSteps: 0,
        totalDurationMs: 0,
        byLevel: new Map(),
        failureReasons: new Map(),
        hitl: {
            triggered: 0,
            approved: 0,
            rejected: 0,
            timedOut: 0,
            totalDecisionTimeMs: 0,
            decisionCount: 0,
        },
        llm: {
            totalProposals: 0,
            approved: 0,
            rejected: 0,
            byRole: new Map(),
        },
        totalProposals: 0,
    };
    for (const trace of traces) {
        processTrace(trace, stats);
    }
    return stats;
}
/**
 * Process a single trace and update stats.
 */
function processTrace(trace, stats) {
    const level = trace.header.necessityLevel;
    const isSuccess = trace.outcome === "success";
    const steps = countSteps(trace.events);
    const durationMs = trace.header.durationMs ?? 0;
    // Update overall stats
    if (isSuccess)
        stats.successCount++;
    stats.totalSteps += steps;
    stats.totalDurationMs += durationMs;
    // Update level stats
    if (!stats.byLevel.has(level)) {
        stats.byLevel.set(level, {
            runs: 0,
            successCount: 0,
            totalSteps: 0,
            totalDurationMs: 0,
        });
    }
    const levelStats = stats.byLevel.get(level);
    levelStats.runs++;
    if (isSuccess)
        levelStats.successCount++;
    levelStats.totalSteps += steps;
    levelStats.totalDurationMs += durationMs;
    // Process events (skip failure.explanation events since we handle failureExplanation separately)
    for (const event of trace.events) {
        if (event.type !== "failure.explanation") {
            processEvent(event, stats);
        }
    }
    // Process failure reasons from trace.failureExplanation only (not from events to avoid double counting)
    if (trace.outcome === "failure" && trace.failureExplanation) {
        const reason = kindToReason(trace.failureExplanation.kind);
        stats.failureReasons.set(reason, (stats.failureReasons.get(reason) ?? 0) + 1);
    }
}
/**
 * Process a single event.
 */
function processEvent(event, stats) {
    switch (event.type) {
        case "proposal":
            processProposalEvent(event, stats);
            break;
        case "authority.decision":
            processDecisionEvent(event, stats);
            break;
        case "hitl":
            processHITLEvent(event, stats);
            break;
        case "failure.explanation":
            processFailureEvent(event, stats);
            break;
    }
}
/**
 * Process proposal event.
 */
function processProposalEvent(event, stats) {
    stats.totalProposals++;
    // Track LLM proposals (actors starting with "llm:" or specific patterns)
    const actorId = event.actorId;
    const llmRole = detectLLMRole(actorId);
    if (llmRole !== "none") {
        stats.llm.totalProposals++;
        if (!stats.llm.byRole.has(llmRole)) {
            stats.llm.byRole.set(llmRole, { proposals: 0, approved: 0, rejected: 0 });
        }
        stats.llm.byRole.get(llmRole).proposals++;
    }
}
/**
 * Process authority decision event.
 */
function processDecisionEvent(event, stats) {
    // This would need correlation with proposal to determine LLM approval
    // For now, we just track decision counts
}
/**
 * Process HITL event.
 */
function processHITLEvent(event, stats) {
    switch (event.action) {
        case "pending":
            stats.hitl.triggered++;
            break;
        case "approved":
            stats.hitl.approved++;
            if (event.decisionTimeMs !== undefined) {
                stats.hitl.totalDecisionTimeMs += event.decisionTimeMs;
                stats.hitl.decisionCount++;
            }
            break;
        case "rejected":
            stats.hitl.rejected++;
            if (event.decisionTimeMs !== undefined) {
                stats.hitl.totalDecisionTimeMs += event.decisionTimeMs;
                stats.hitl.decisionCount++;
            }
            break;
        case "timeout":
            stats.hitl.timedOut++;
            break;
    }
}
/**
 * Process failure explanation event.
 */
function processFailureEvent(event, stats) {
    const reason = kindToReason(event.explanation.kind);
    stats.failureReasons.set(reason, (stats.failureReasons.get(reason) ?? 0) + 1);
}
/**
 * Count steps (proposals) in events.
 */
function countSteps(events) {
    return events.filter((e) => e.type === "proposal").length;
}
/**
 * Detect LLM role from actor ID.
 */
function detectLLMRole(actorId) {
    const lower = actorId.toLowerCase();
    if (lower.includes("fact_proposer") || lower.includes("fact-proposer")) {
        return "fact_proposer";
    }
    if (lower.includes("belief_proposer") || lower.includes("belief-proposer")) {
        return "belief_proposer";
    }
    if (lower.includes("rule_interpreter") || lower.includes("rule-interpreter")) {
        return "rule_interpreter";
    }
    if (lower.includes("intent_parser") || lower.includes("intent-parser")) {
        return "intent_parser";
    }
    if (lower.includes("llm")) {
        // Generic LLM - default to fact_proposer
        return "fact_proposer";
    }
    return "none";
}
// =============================================================================
// Summary Building
// =============================================================================
/**
 * Build summary from raw stats.
 */
function buildSummary(stats) {
    return {
        runs: stats.runs,
        successRate: stats.runs > 0 ? stats.successCount / stats.runs : 0,
        avgSteps: stats.runs > 0 ? stats.totalSteps / stats.runs : 0,
        avgDurationMs: stats.runs > 0 ? stats.totalDurationMs / stats.runs : 0,
        byLevel: buildLevelSummaries(stats.byLevel),
        failureReasons: Object.fromEntries(stats.failureReasons),
        hitl: buildHITLSummary(stats),
        llm: buildLLMSummary(stats),
    };
}
/**
 * Build level summaries.
 */
function buildLevelSummaries(byLevel) {
    const result = {};
    // Initialize all levels with zeros
    for (let level = 0; level <= 3; level++) {
        result[level] = {
            runs: 0,
            successRate: 0,
            avgSteps: 0,
            avgDurationMs: 0,
        };
    }
    // Fill in actual stats
    for (const [level, levelStats] of byLevel) {
        result[level] = {
            runs: levelStats.runs,
            successRate: levelStats.runs > 0 ? levelStats.successCount / levelStats.runs : 0,
            avgSteps: levelStats.runs > 0 ? levelStats.totalSteps / levelStats.runs : 0,
            avgDurationMs: levelStats.runs > 0 ? levelStats.totalDurationMs / levelStats.runs : 0,
        };
    }
    return result;
}
/**
 * Build HITL summary.
 */
function buildHITLSummary(stats) {
    const hitl = stats.hitl;
    return {
        triggered: hitl.triggered,
        approved: hitl.approved,
        rejected: hitl.rejected,
        timedOut: hitl.timedOut,
        avgDecisionTimeMs: hitl.decisionCount > 0 ? hitl.totalDecisionTimeMs / hitl.decisionCount : 0,
        hitlRate: stats.totalProposals > 0 ? hitl.triggered / stats.totalProposals : 0,
    };
}
/**
 * Build LLM summary.
 */
function buildLLMSummary(stats) {
    const llm = stats.llm;
    const byRole = {
        none: { proposals: 0, approved: 0, rejected: 0 },
        fact_proposer: { proposals: 0, approved: 0, rejected: 0 },
        belief_proposer: { proposals: 0, approved: 0, rejected: 0 },
        rule_interpreter: { proposals: 0, approved: 0, rejected: 0 },
        intent_parser: { proposals: 0, approved: 0, rejected: 0 },
    };
    for (const [role, roleStats] of llm.byRole) {
        byRole[role] = roleStats;
    }
    return {
        totalProposals: llm.totalProposals,
        approved: llm.approved,
        rejected: llm.rejected,
        approvalRate: llm.totalProposals > 0 ? llm.approved / llm.totalProposals : 0,
        byRole,
    };
}
/**
 * Create an empty summary.
 */
function createEmptySummary() {
    return {
        runs: 0,
        successRate: 0,
        avgSteps: 0,
        avgDurationMs: 0,
        byLevel: {
            0: { runs: 0, successRate: 0, avgSteps: 0, avgDurationMs: 0 },
            1: { runs: 0, successRate: 0, avgSteps: 0, avgDurationMs: 0 },
            2: { runs: 0, successRate: 0, avgSteps: 0, avgDurationMs: 0 },
            3: { runs: 0, successRate: 0, avgSteps: 0, avgDurationMs: 0 },
        },
        failureReasons: {},
        hitl: {
            triggered: 0,
            approved: 0,
            rejected: 0,
            timedOut: 0,
            avgDecisionTimeMs: 0,
            hitlRate: 0,
        },
        llm: {
            totalProposals: 0,
            approved: 0,
            rejected: 0,
            approvalRate: 0,
            byRole: {
                none: { proposals: 0, approved: 0, rejected: 0 },
                fact_proposer: { proposals: 0, approved: 0, rejected: 0 },
                belief_proposer: { proposals: 0, approved: 0, rejected: 0 },
                rule_interpreter: { proposals: 0, approved: 0, rejected: 0 },
                intent_parser: { proposals: 0, approved: 0, rejected: 0 },
            },
        },
    };
}
// =============================================================================
// Utilities
// =============================================================================
/**
 * Format summary as a human-readable string.
 *
 * @param summary - The summary to format
 * @returns Formatted string
 */
export function formatSummary(summary) {
    const lines = [];
    lines.push("=== Trace Summary ===");
    lines.push("");
    lines.push(`Runs: ${summary.runs}`);
    lines.push(`Success Rate: ${(summary.successRate * 100).toFixed(1)}%`);
    lines.push(`Avg Steps: ${summary.avgSteps.toFixed(1)}`);
    lines.push(`Avg Duration: ${formatDuration(summary.avgDurationMs)}`);
    lines.push("");
    lines.push("By Necessity Level:");
    for (let level = 0; level <= 3; level++) {
        const levelSummary = summary.byLevel[level];
        if (levelSummary.runs > 0) {
            lines.push(`  Level ${level}: ${levelSummary.runs} runs, ${(levelSummary.successRate * 100).toFixed(1)}% success`);
        }
    }
    lines.push("");
    if (Object.keys(summary.failureReasons).length > 0) {
        lines.push("Failure Reasons:");
        for (const [reason, count] of Object.entries(summary.failureReasons)) {
            lines.push(`  ${reason}: ${count}`);
        }
        lines.push("");
    }
    lines.push("HITL:");
    lines.push(`  Triggered: ${summary.hitl.triggered}`);
    lines.push(`  Approved: ${summary.hitl.approved}`);
    lines.push(`  Rejected: ${summary.hitl.rejected}`);
    lines.push(`  Timed Out: ${summary.hitl.timedOut}`);
    lines.push(`  Avg Decision Time: ${formatDuration(summary.hitl.avgDecisionTimeMs)}`);
    lines.push(`  HITL Rate: ${(summary.hitl.hitlRate * 100).toFixed(1)}%`);
    lines.push("");
    lines.push("LLM:");
    lines.push(`  Total Proposals: ${summary.llm.totalProposals}`);
    lines.push(`  Approved: ${summary.llm.approved}`);
    lines.push(`  Rejected: ${summary.llm.rejected}`);
    lines.push(`  Approval Rate: ${(summary.llm.approvalRate * 100).toFixed(1)}%`);
    return lines.join("\n");
}
/**
 * Format duration in human-readable format.
 */
function formatDuration(ms) {
    if (ms < 1000)
        return `${ms.toFixed(0)}ms`;
    if (ms < 60000)
        return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}
//# sourceMappingURL=summary.js.map