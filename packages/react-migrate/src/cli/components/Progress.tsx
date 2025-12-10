import React from 'react';
import { Box, Text } from 'ink';

export interface ProgressProps {
  completed: number;
  total: number;
  blocked: number;
  skipped?: number;
  label?: string;
}

export function Progress({
  completed,
  total,
  blocked,
  skipped = 0,
  label = 'Progress',
}: ProgressProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barWidth = 40;
  const filledWidth = Math.round((percentage / 100) * barWidth);
  const emptyWidth = barWidth - filledWidth;

  const filled = '\u2588'.repeat(filledWidth);
  const empty = '\u2591'.repeat(emptyWidth);

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{label}: </Text>
        <Text color="green">{filled}</Text>
        <Text color="gray">{empty}</Text>
        <Text> {percentage}% </Text>
        <Text color="gray">({completed}/{total} files)</Text>
      </Box>

      {blocked > 0 && (
        <Box marginTop={0}>
          <Text color="yellow">
            ! {blocked} file{blocked > 1 ? 's' : ''} blocked (awaiting human input)
          </Text>
        </Box>
      )}

      {skipped > 0 && (
        <Box marginTop={0}>
          <Text color="gray">
            - {skipped} file{skipped > 1 ? 's' : ''} skipped
          </Text>
        </Box>
      )}
    </Box>
  );
}
