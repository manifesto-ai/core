/**
 * HITLPanel Component
 *
 * Interactive panel for Human-in-the-Loop decisions.
 * Displays pending proposals and allows approval/rejection.
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { Proposal } from "@manifesto-ai/world";

export interface HITLPanelProps {
  pending: Proposal[];
  onApprove: (proposalId: string) => Promise<void>;
  onReject: (proposalId: string, reason: string) => Promise<void>;
  enabled: boolean;
}

export const HITLPanel: React.FC<HITLPanelProps> = ({
  pending,
  onApprove,
  onReject,
  enabled,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Reset selection when pending list changes
  useEffect(() => {
    if (selectedIndex >= pending.length) {
      setSelectedIndex(Math.max(0, pending.length - 1));
    }
  }, [pending.length, selectedIndex]);

  // Keyboard input
  useInput(
    (input, key) => {
      if (!enabled || isProcessing || pending.length === 0) return;

      if (rejectMode) {
        // In reject mode, handle text input
        if (key.return) {
          // Submit rejection
          handleReject();
        } else if (key.escape) {
          // Cancel rejection
          setRejectMode(false);
          setRejectReason("");
        } else if (key.backspace || key.delete) {
          setRejectReason((prev) => prev.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta) {
          setRejectReason((prev) => prev + input);
        }
        return;
      }

      // Navigation
      if (key.upArrow || input === "k") {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === "j") {
        setSelectedIndex((prev) => Math.min(pending.length - 1, prev + 1));
      }

      // Actions
      if (input === "a" || input === "A") {
        handleApprove();
      } else if (input === "r" || input === "R") {
        setRejectMode(true);
      }
    },
    { isActive: enabled && pending.length > 0 }
  );

  const handleApprove = async () => {
    if (pending.length === 0) return;
    const proposal = pending[selectedIndex];
    if (!proposal) return;

    setIsProcessing(true);
    try {
      await onApprove(proposal.proposalId);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (pending.length === 0) return;
    const proposal = pending[selectedIndex];
    if (!proposal) return;

    setIsProcessing(true);
    try {
      await onReject(proposal.proposalId, rejectReason || "User rejected");
    } finally {
      setIsProcessing(false);
      setRejectMode(false);
      setRejectReason("");
    }
  };

  if (!enabled) {
    return null;
  }

  if (pending.length === 0) {
    return (
      <Box marginY={1}>
        <Text color="gray">No pending HITL decisions</Text>
      </Box>
    );
  }

  const currentProposal = pending[selectedIndex];

  return (
    <Box flexDirection="column" marginY={1} borderStyle="round" borderColor="yellow" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">
          HITL Required ({pending.length} pending)
        </Text>
      </Box>

      {/* Proposal list */}
      <Box flexDirection="column">
        {pending.map((proposal, index) => (
          <Box key={proposal.proposalId}>
            <Text color={index === selectedIndex ? "yellow" : "gray"}>
              {index === selectedIndex ? "▸ " : "  "}
            </Text>
            <Text color={index === selectedIndex ? "white" : "gray"}>
              {proposal.proposalId.slice(0, 8)}
            </Text>
            <Text color="gray"> - </Text>
            <Text color={index === selectedIndex ? "cyan" : "gray"}>
              {proposal.intent.body.type}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Current proposal details */}
      {currentProposal && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">Intent: {JSON.stringify(currentProposal.intent.body.input, null, 2).slice(0, 100)}</Text>
        </Box>
      )}

      {/* Reject mode input */}
      {rejectMode ? (
        <Box marginTop={1}>
          <Text color="red">Reject reason: </Text>
          <Text>{rejectReason}</Text>
          <Text color="gray">_</Text>
        </Box>
      ) : (
        <Box marginTop={1} gap={2}>
          <Text color="green">[A] Approve</Text>
          <Text color="red">[R] Reject</Text>
          <Text color="gray">[↑↓] Navigate</Text>
        </Box>
      )}

      {isProcessing && (
        <Box marginTop={1}>
          <Text color="cyan">Processing...</Text>
        </Box>
      )}
    </Box>
  );
};

export default HITLPanel;
