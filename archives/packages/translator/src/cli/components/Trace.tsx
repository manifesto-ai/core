/**
 * Trace Component
 *
 * Displays full translation trace for debugging.
 */

import React from "react";
import { Box, Text } from "ink";
import type { TranslationTrace } from "../../domain/index.js";

export interface TraceProps {
  trace: TranslationTrace;
}

export function Trace({ trace }: TraceProps): React.ReactElement {
  const { timing, stages } = trace;

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="gray">Translation Trace</Text>
      </Box>

      {/* Timing */}
      <Box marginBottom={1}>
        <Text color="gray">Total time: </Text>
        <Text>{timing.durationMs}ms</Text>
      </Box>

      {/* Stages */}
      <Box flexDirection="column">
        <Text color="gray" underline>Stage Timings:</Text>

        {stages.chunking && (
          <Box marginLeft={2}>
            <Text color="gray">Chunking: </Text>
            <Text>{stages.chunking.durationMs}ms</Text>
            <Text color="gray"> ({stages.chunking.sectionCount} sections)</Text>
          </Box>
        )}

        {stages.normalization && (
          <Box marginLeft={2}>
            <Text color="gray">Normalization: </Text>
            <Text>{stages.normalization.durationMs}ms</Text>
            <Text color="gray"> (lang: {stages.normalization.detectedLanguage})</Text>
          </Box>
        )}

        {stages.fastPath && (
          <Box marginLeft={2}>
            <Text color="gray">Fast Path: </Text>
            <Text>{stages.fastPath.durationMs}ms</Text>
            <Text color="gray">
              {" "}({stages.fastPath.matched ? "matched" : "no match"})
            </Text>
          </Box>
        )}

        {stages.retrieval && (
          <Box marginLeft={2}>
            <Text color="gray">Retrieval: </Text>
            <Text>{stages.retrieval.durationMs}ms</Text>
            <Text color="gray"> (tier: {stages.retrieval.tier}, candidates: {stages.retrieval.candidateCount})</Text>
          </Box>
        )}

        {stages.memory && (
          <Box marginLeft={2}>
            <Text color="gray">Memory: </Text>
            <Text>{stages.memory.durationMs}ms</Text>
            <Text color="gray">
              {stages.memory.degraded ? " (degraded)" : ` (${stages.memory.selectedCount} examples)`}
            </Text>
          </Box>
        )}

        {stages.proposer && (
          <Box marginLeft={2}>
            <Text color="gray">Proposer: </Text>
            <Text>{stages.proposer.durationMs}ms</Text>
            <Text color="gray"> (model: {stages.proposer.modelId})</Text>
            {stages.proposer.escalated && <Text color="yellow"> [escalated]</Text>}
          </Box>
        )}

        {stages.assembly && (
          <Box marginLeft={2}>
            <Text color="gray">Assembly: </Text>
            <Text>{stages.assembly.durationMs}ms</Text>
            <Text color="gray">
              {" "}(fragments: {stages.assembly.fragmentCount}, deduped: {stages.assembly.dedupeCount})
            </Text>
          </Box>
        )}
      </Box>

      {/* Request info */}
      <Box marginTop={1}>
        <Text color="gray">Intent: </Text>
        <Text dimColor>{trace.request.intentId}</Text>
      </Box>
    </Box>
  );
}
