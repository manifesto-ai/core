/**
 * AmbiguityPrompt Component
 *
 * Human escalation UI for ambiguity resolution.
 * Per SPEC-1.1.1v INV-004: Ambiguity = Human Authority
 */

import React from "react";
import { Box, Text, useInput } from "ink";
import type { AmbiguityReport } from "../../domain/index.js";

export interface AmbiguityPromptProps {
  report: AmbiguityReport;
  onResolve: (optionId: string) => void;
}

export function AmbiguityPrompt({
  report,
  onResolve,
}: AmbiguityPromptProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const candidates = report.candidates;

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(candidates.length - 1, prev + 1));
    } else if (key.return) {
      const selected = candidates[selectedIndex];
      if (selected) {
        onResolve(selected.optionId);
      }
    } else if (input >= "1" && input <= "9") {
      const index = parseInt(input, 10) - 1;
      if (index >= 0 && index < candidates.length) {
        const selected = candidates[index];
        if (selected) {
          onResolve(selected.optionId);
        }
      }
    }
  });

  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">Human Decision Required</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Kind: </Text>
        <Text>{report.kind}</Text>
      </Box>

      {report.resolutionPrompt?.question && (
        <Box marginBottom={1}>
          <Text color="gray">Question: </Text>
          <Text>{report.resolutionPrompt.question}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        {candidates.map((candidate, index) => {
          const isSelected = index === selectedIndex;
          const confidencePercent = Math.round(candidate.confidence * 100);

          return (
            <Box key={candidate.optionId}>
              <Text color={isSelected ? "cyan" : "white"}>
                {isSelected ? ">" : " "} {index + 1}. {candidate.description}
              </Text>
              <Text color="gray"> ({confidencePercent}%)</Text>
            </Box>
          );
        })}
      </Box>

      <Box>
        <Text color="gray" dimColor>
          Use ↑↓ to select, Enter to confirm, or press 1-{candidates.length}
        </Text>
      </Box>
    </Box>
  );
}
