/**
 * StatusBar Component
 *
 * Displays current compilation status with a spinner for active phases.
 */

import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { StatusBarProps } from "../types.js";

const STATUS_LABELS: Record<string, string> = {
  idle: "Ready",
  segmenting: "Segmenting input...",
  normalizing: "Normalizing intents...",
  proposing: "Proposing schema...",
  validating: "Validating draft...",
  awaiting_resolution: "Waiting for resolution...",
  success: "Compilation complete",
  discarded: "Compilation discarded",
};

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  isSpinning,
}) => {
  const label = STATUS_LABELS[status] || status;
  const isTerminal = status === "success" || status === "discarded";
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
