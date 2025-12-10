import React from 'react';
import { Box, Text } from 'ink';

export interface ErrorDisplayProps {
  error: string;
  details?: string;
  suggestion?: string;
}

export function ErrorDisplay({ error, details, suggestion }: ErrorDisplayProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="red">
        x Error
      </Text>

      <Box marginTop={1}>
        <Text color="red">{error}</Text>
      </Box>

      {details && (
        <Box marginTop={1}>
          <Text color="gray">{details}</Text>
        </Box>
      )}

      {suggestion && (
        <Box marginTop={1}>
          <Text color="yellow">Suggestion: {suggestion}</Text>
        </Box>
      )}
    </Box>
  );
}
