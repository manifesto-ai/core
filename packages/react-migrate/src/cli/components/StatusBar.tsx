import React from 'react';
import { Box, Text } from 'ink';

export interface StatusBarProps {
  model: string;
  contextUsage: number;
  attempts: number;
  error?: string | null;
}

function formatContextUsage(usage: number): string {
  return (usage * 100).toFixed(0) + '%';
}

export function StatusBar({ model, contextUsage, attempts, error }: StatusBarProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginTop={1}
    >
      <Box justifyContent="space-between">
        <Box>
          <Text color="gray">Model: </Text>
          <Text color="cyan">{model}</Text>
        </Box>
        <Box>
          <Text color="gray">Context: </Text>
          <Text color={contextUsage > 0.8 ? 'yellow' : 'green'}>
            {formatContextUsage(contextUsage)}
          </Text>
        </Box>
        <Box>
          <Text color="gray">Attempts: </Text>
          <Text>{attempts}</Text>
        </Box>
      </Box>

      {error && (
        <Box marginTop={0}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}
