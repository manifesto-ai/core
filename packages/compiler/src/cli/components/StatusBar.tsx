/**
 * StatusBar Component (v1.1)
 *
 * Displays current compilation status with a spinner for active phases.
 */

import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { StatusBarProps } from "../types.js";

const STATUS_LABELS: Record<string, string> = {
  idle: "Ready",
  planning: "Planning compilation...",
  awaiting_plan_decision: "Awaiting plan approval...",
  generating: "Generating fragments...",
  awaiting_draft_decision: "Awaiting draft approval...",
  lowering: "Lowering drafts to fragments...",
  linking: "Linking fragments...",
  awaiting_conflict_resolution: "Resolving conflicts...",
  verifying: "Verifying domain...",
  emitting: "Emitting domain spec...",
  success: "Compilation complete",
  failed: "Compilation failed",
};

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  isSpinning,
}) => {
  const label = STATUS_LABELS[status] || status;
  const isTerminal = status === "success" || status === "failed";
  const isSuccess = status === "success";

  return (
    <Box>
      {isSpinning && !isTerminal && (
        <Text color="cyan">
          <Spinner type="dots" />
          {" "}
        </Text>
      )}
      {isTerminal && (
        <Text color={isSuccess ? "green" : "red"}>
          {isSuccess ? "✓ " : "✗ "}
        </Text>
      )}
      <Text color={isSuccess ? "green" : isTerminal ? "red" : "white"}>
        {label}
      </Text>
    </Box>
  );
};

export default StatusBar;
