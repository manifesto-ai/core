/**
 * Error Component
 *
 * Displays error or discard reason.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ErrorProps } from "../types.js";

const ERROR_MESSAGES: Record<string, string> = {
  SEGMENTATION_FAILED: "Failed to segment input",
  NORMALIZATION_FAILED: "Failed to normalize intents",
  PROPOSAL_FAILED: "Failed to propose schema",
  VALIDATION_FAILED: "Draft validation failed",
  MAX_RETRIES_EXCEEDED: "Maximum retry attempts exceeded",
  RESOLUTION_REQUIRED_BUT_DISABLED: "Resolution required but not available",
  USER_CANCELLED: "Compilation cancelled by user",
  NO_SEGMENTS: "No segments found in input",
  EMPTY_INPUT: "Empty input provided",
};

export const Error: React.FC<ErrorProps> = ({ reason }) => {
  const message = reason
    ? ERROR_MESSAGES[reason] || reason
    : "Unknown error occurred";

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="red" bold>✗ Compilation Failed</Text>
      </Box>

      <Box>
        <Text color="gray">Reason: </Text>
        <Text color="red">{message}</Text>
      </Box>

      {reason && ERROR_MESSAGES[reason] && reason !== message && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>Code: {reason}</Text>
        </Box>
      )}
    </Box>
  );
};

export default Error;
