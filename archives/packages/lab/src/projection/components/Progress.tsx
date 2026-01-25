/**
 * Progress Component
 *
 * Displays experiment progress: proposals, approvals, rejections, events.
 */

import React from "react";
import { Box, Text } from "ink";

export interface ProgressProps {
  proposalCount: number;
  approvedCount: number;
  rejectedCount: number;
  eventCount: number;
  elapsed: number;
  isRunning: boolean;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}.${Math.floor((ms % 1000) / 100)}s`;
}

export const Progress: React.FC<ProgressProps> = ({
  proposalCount,
  approvedCount,
  rejectedCount,
  eventCount,
  elapsed,
  isRunning,
}) => {
  const pendingCount = proposalCount - approvedCount - rejectedCount;

  return (
    <Box flexDirection="column" marginY={1}>
      <Box gap={3}>
        <Box>
          <Text color="gray">Proposals: </Text>
          <Text bold>{proposalCount}</Text>
        </Box>
        <Box>
          <Text color="green">Approved: </Text>
          <Text color="green">{approvedCount}</Text>
        </Box>
        <Box>
          <Text color="red">Rejected: </Text>
          <Text color="red">{rejectedCount}</Text>
        </Box>
        {pendingCount > 0 && (
          <Box>
            <Text color="yellow">Pending: </Text>
            <Text color="yellow">{pendingCount}</Text>
          </Box>
        )}
      </Box>
      <Box marginTop={1} gap={3}>
        <Box>
          <Text color="gray">Events: </Text>
          <Text>{eventCount}</Text>
        </Box>
        <Box>
          <Text color="gray">Elapsed: </Text>
          <Text color={isRunning ? "cyan" : "white"}>
            {formatDuration(elapsed)}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

export default Progress;
