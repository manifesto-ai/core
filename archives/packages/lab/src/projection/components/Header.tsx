/**
 * Header Component
 *
 * Displays Lab metadata: runId, necessity level, and start time.
 */

import React from "react";
import { Box, Text } from "ink";
import type { NecessityLevel } from "../../types.js";

const LEVEL_LABELS: Record<NecessityLevel, string> = {
  0: "L0: Deterministic",
  1: "L1: Partial Observation",
  2: "L2: Open-Ended Rules",
  3: "L3: Natural Language",
};

const LEVEL_COLORS: Record<NecessityLevel, string> = {
  0: "green",
  1: "yellow",
  2: "magenta",
  3: "red",
};

export interface HeaderProps {
  runId: string;
  necessityLevel: NecessityLevel;
  startedAt: number;
}

export const Header: React.FC<HeaderProps> = ({
  runId,
  necessityLevel,
  startedAt,
}) => {
  const startTime = new Date(startedAt).toLocaleTimeString();

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">
          manifesto-lab{" "}
        </Text>
        <Text color="gray">v1.0</Text>
      </Box>
      <Box marginTop={1} gap={2}>
        <Box>
          <Text color="gray">Run: </Text>
          <Text bold>{runId}</Text>
        </Box>
        <Box>
          <Text color="gray">Level: </Text>
          <Text color={LEVEL_COLORS[necessityLevel]}>
            {LEVEL_LABELS[necessityLevel]}
          </Text>
        </Box>
        <Box>
          <Text color="gray">Started: </Text>
          <Text>{startTime}</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default Header;
