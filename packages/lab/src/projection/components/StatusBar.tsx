/**
 * StatusBar Component
 *
 * Bottom status bar showing current lab status with spinner.
 */

import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { LabStatus } from "../../types.js";

const STATUS_LABELS: Record<LabStatus, string> = {
  running: "Running experiment...",
  waiting_hitl: "Waiting for human decision...",
  completed: "Experiment completed",
  aborted: "Experiment aborted",
};

const STATUS_COLORS: Record<LabStatus, string> = {
  running: "cyan",
  waiting_hitl: "yellow",
  completed: "green",
  aborted: "red",
};

export interface StatusBarProps {
  status: LabStatus;
  isSpinning: boolean;
  message?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  isSpinning,
  message,
}) => {
  const label = message || STATUS_LABELS[status];
  const color = STATUS_COLORS[status];
  const isTerminal = status === "completed" || status === "aborted";
  const isSuccess = status === "completed";

  return (
    <Box marginTop={1}>
      {isSpinning && !isTerminal && (
        <Text color={color}>
          <Spinner type="dots" />
          {" "}
        </Text>
      )}
      {isTerminal && (
        <Text color={color}>
          {isSuccess ? "✓ " : "✗ "}
        </Text>
      )}
      <Text color={color}>{label}</Text>
    </Box>
  );
};

export default StatusBar;
