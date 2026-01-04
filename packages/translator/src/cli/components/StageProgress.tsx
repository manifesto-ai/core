/**
 * StageProgress Component
 *
 * Displays 6-stage pipeline progress visualization.
 */

import React from "react";
import { Box, Text } from "ink";
import type { TranslationProgress } from "../types.js";

export interface StageProgressProps {
  progress: TranslationProgress;
}

const STAGES = [
  { key: "chunking", label: "Chunk" },
  { key: "normalization", label: "Norm" },
  { key: "fastPath", label: "Fast" },
  { key: "retrieval", label: "Retr" },
  { key: "memory", label: "Mem" },
  { key: "proposer", label: "Prop" },
  { key: "assembly", label: "Asm" },
];

export function StageProgress({ progress }: StageProgressProps): React.ReactElement {
  const currentIndex = progress.stageIndex;

  return (
    <Box marginBottom={1}>
      <Text color="gray">[</Text>
      {STAGES.map((stage, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        let color: string;
        let symbol: string;

        if (isComplete) {
          color = "green";
          symbol = "✓";
        } else if (isCurrent) {
          color = "yellow";
          symbol = "●";
        } else {
          color = "gray";
          symbol = "○";
        }

        return (
          <Box key={stage.key}>
            <Text color={color}>{symbol}</Text>
            <Text color={isCurrent ? "yellow" : "gray"}>{stage.label}</Text>
            {index < STAGES.length - 1 && <Text color="gray">→</Text>}
          </Box>
        );
      })}
      <Text color="gray">]</Text>
    </Box>
  );
}
