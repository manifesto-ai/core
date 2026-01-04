import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
const MAX_PROPOSALS = 10;
function extractProposals(events) {
    const proposals = new Map();
    for (const event of events) {
        if (event.type === "proposal") {
            const proposalEvent = event;
            proposals.set(proposalEvent.proposalId, {
                proposalId: proposalEvent.proposalId,
                intentType: proposalEvent.intentType,
                actorId: proposalEvent.actorId,
                status: "pending",
                timestamp: proposalEvent.timestamp,
            });
        }
        else if (event.type === "authority.decision") {
            const decisionEvent = event;
            const proposal = proposals.get(decisionEvent.proposalId);
            if (proposal) {
                proposal.status = decisionEvent.decision === "approved"
                    ? "approved"
                    : decisionEvent.decision === "rejected"
                        ? "rejected"
                        : "pending";
            }
        }
    }
    // Return most recent proposals
    return Array.from(proposals.values())
        .slice(-MAX_PROPOSALS)
        .reverse();
}
const STATUS_ICONS = {
    pending: "○",
    approved: "✓",
    rejected: "✗",
};
const STATUS_COLORS = {
    pending: "yellow",
    approved: "green",
    rejected: "red",
};
export const Proposals = ({ events }) => {
    const proposals = extractProposals(events);
    if (proposals.length === 0) {
        return (_jsx(Box, { marginY: 1, children: _jsx(Text, { color: "gray", children: "No proposals yet" }) }));
    }
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsx(Text, { bold: true, color: "white", children: "Recent Proposals" }), _jsx(Box, { flexDirection: "column", marginTop: 1, children: proposals.map((proposal) => (_jsxs(Box, { gap: 2, children: [_jsx(Text, { color: STATUS_COLORS[proposal.status], children: STATUS_ICONS[proposal.status] }), _jsx(Text, { color: "gray", children: proposal.proposalId.slice(0, 8) }), _jsx(Text, { children: proposal.intentType }), _jsxs(Text, { color: "gray", children: ["(", proposal.actorId, ")"] })] }, proposal.proposalId))) })] }));
};
export default Proposals;
//# sourceMappingURL=Proposals.js.map