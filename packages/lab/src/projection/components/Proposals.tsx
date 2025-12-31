/**
 * Proposals Component
 *
 * Displays list of recent proposals with their status.
 */

import React from "react";
import { Box, Text } from "ink";
import type { LabTraceEvent, ProposalTraceEvent, AuthorityDecisionTraceEvent } from "../../types.js";

const MAX_PROPOSALS = 10;

export interface ProposalsProps {
  events: LabTraceEvent[];
}

interface ProposalItem {
  proposalId: string;
  intentType: string;
  actorId: string;
  status: "pending" | "approved" | "rejected";
  timestamp: string;
}

function extractProposals(events: LabTraceEvent[]): ProposalItem[] {
  const proposals = new Map<string, ProposalItem>();

  for (const event of events) {
    if (event.type === "proposal") {
      const proposalEvent = event as ProposalTraceEvent;
      proposals.set(proposalEvent.proposalId, {
        proposalId: proposalEvent.proposalId,
        intentType: proposalEvent.intentType,
        actorId: proposalEvent.actorId,
        status: "pending",
        timestamp: proposalEvent.timestamp,
      });
    } else if (event.type === "authority.decision") {
      const decisionEvent = event as AuthorityDecisionTraceEvent;
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

const STATUS_ICONS: Record<ProposalItem["status"], string> = {
  pending: "○",
  approved: "✓",
  rejected: "✗",
};

const STATUS_COLORS: Record<ProposalItem["status"], string> = {
  pending: "yellow",
  approved: "green",
  rejected: "red",
};

export const Proposals: React.FC<ProposalsProps> = ({ events }) => {
  const proposals = extractProposals(events);

  if (proposals.length === 0) {
    return (
      <Box marginY={1}>
        <Text color="gray">No proposals yet</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color="white">Recent Proposals</Text>
      <Box flexDirection="column" marginTop={1}>
        {proposals.map((proposal) => (
          <Box key={proposal.proposalId} gap={2}>
            <Text color={STATUS_COLORS[proposal.status]}>
              {STATUS_ICONS[proposal.status]}
            </Text>
            <Text color="gray">{proposal.proposalId.slice(0, 8)}</Text>
            <Text>{proposal.intentType}</Text>
            <Text color="gray">({proposal.actorId})</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default Proposals;
