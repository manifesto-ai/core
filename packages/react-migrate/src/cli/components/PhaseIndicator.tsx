import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { MigrationPhase } from '../../domains/types.js';

export interface PhaseIndicatorProps {
  phase: MigrationPhase;
  currentFile?: string;
}

const PHASE_CONFIG: Record<MigrationPhase, { label: string; color: string; emoji: string }> = {
  INIT: { label: 'Initializing', color: 'gray', emoji: '*' },
  ANALYZING: { label: 'Analyzing', color: 'blue', emoji: '>' },
  SUMMARIZING: { label: 'Summarizing', color: 'magenta', emoji: '>' },
  TRANSFORMING: { label: 'Transforming', color: 'yellow', emoji: '>' },
  COMPLETE: { label: 'Complete', color: 'green', emoji: 'v' },
  FAILED: { label: 'Failed', color: 'red', emoji: 'x' },
};

export function PhaseIndicator({ phase, currentFile }: PhaseIndicatorProps) {
  const config = PHASE_CONFIG[phase];
  const isActive = phase !== 'COMPLETE' && phase !== 'FAILED' && phase !== 'INIT';

  return (
    <Box flexDirection="column">
      <Box>
        <Text>Phase: </Text>
        {isActive ? (
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
        ) : (
          <Text>{config.emoji} </Text>
        )}
        <Text bold color={config.color}>
          {' '}{config.label.toUpperCase()}
        </Text>
      </Box>

      {currentFile && isActive && (
        <Box marginTop={0}>
          <Text color="gray">Current: </Text>
          <Text color="cyan">{currentFile}</Text>
        </Box>
      )}
    </Box>
  );
}
