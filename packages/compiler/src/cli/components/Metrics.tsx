/**
 * Metrics Component (v1.1)
 *
 * Displays detailed metrics in full verbosity mode.
 */

import React from "react";
import { Box, Text } from "ink";
import type { MetricsProps } from "../types.js";
import { PHASES, PHASE_LABELS, type Phase } from "../types.js";

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const Metrics: React.FC<MetricsProps> = ({ metrics, status }) => {
  const elapsed = metrics.endTime
    ? metrics.endTime - metrics.startTime
    : Date.now() - metrics.startTime;

  const totalDraftAttempts = Object.values(metrics.draftAttempts).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="single" paddingX={1}>
      <Text bold color="cyan">Metrics</Text>

      {/* Phase timings table */}
      <Box flexDirection="column" marginY={1}>
        <Box>
          <Text bold>
            <Text color="white">{"Phase".padEnd(15)}</Text>
            <Text color="white">{"Status".padEnd(10)}</Text>
            <Text color="white">{"Duration".padEnd(12)}</Text>
            <Text color="white">Details</Text>
          </Text>
        </Box>
        <Text color="gray">{"─".repeat(50)}</Text>

        {PHASES.map((phase) => {
          const phaseTiming = metrics.phaseTimings[phase];
          const isComplete = phaseTiming !== undefined;
          const isCurrent = status === phase;

          return (
            <Box key={phase}>
              <Text color={isCurrent ? "cyan" : "white"}>
                {PHASE_LABELS[phase].padEnd(15)}
              </Text>
              <Text color={isComplete ? "green" : isCurrent ? "cyan" : "gray"}>
                {(isComplete ? "✓" : isCurrent ? "⠋" : "○").padEnd(10)}
              </Text>
              <Text color="white">
                {formatDuration(phaseTiming).padEnd(12)}
              </Text>
              <Text color="gray">
                {phase === "planning" && metrics.planAttempts > 0
                  ? `${metrics.planAttempts} attempt(s)`
                  : phase === "generating" && metrics.chunkCount
                  ? `${metrics.chunkCount} chunk(s)`
                  : phase === "lowering" && metrics.fragmentCount
                  ? `${metrics.fragmentCount} fragment(s)`
                  : "-"}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Effect timings */}
      {metrics.effectTimings.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="gray">Effects:</Text>
          {metrics.effectTimings.map((effect, index) => (
            <Box key={`${effect.type}-${index}`} marginLeft={2}>
              <Text color="gray">
                {effect.type.padEnd(18)}
                {formatDuration(effect.duration).padEnd(10)}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Summary line */}
      <Box marginTop={1}>
        <Text color="gray">
          Total: {formatDuration(elapsed)} | Plan attempts: {metrics.planAttempts} | Draft attempts: {totalDraftAttempts} | Status: {status}
        </Text>
      </Box>
    </Box>
  );
};

export default Metrics;
