/**
 * Progress Component (v1.1)
 *
 * Displays phase-by-phase progress of compilation.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ProgressProps } from "../types.js";
import type { CompilerStatus } from "../../domain/types.js";
import { PHASES, PHASE_LABELS, getPhaseIndex, isAwaitingDecision, type Phase } from "../types.js";

interface PhaseItemProps {
  index: number;
  phase: Phase;
  currentPhaseIndex: number;
  isAwaitingDecision: boolean;
}

const PhaseItem: React.FC<PhaseItemProps> = ({
  index,
  phase,
  currentPhaseIndex,
  isAwaitingDecision: awaitingDecision,
}) => {
  const isCompleted = index < currentPhaseIndex;
  const isCurrent = index === currentPhaseIndex;
  const isPending = index > currentPhaseIndex;

  let icon: string;
  let color: string;

  if (isCompleted) {
    icon = "✓";
    color = "green";
  } else if (isCurrent) {
    icon = awaitingDecision ? "?" : "◉";
    color = awaitingDecision ? "yellow" : "cyan";
  } else {
    icon = "○";
    color = "gray";
  }

  return (
    <Box>
      <Text color="gray">[{index + 1}/{PHASES.length}] </Text>
      <Text color={color}>{icon} </Text>
      <Text color={isPending ? "gray" : "white"}>{PHASE_LABELS[phase]}</Text>
      {isCompleted && <Text color="green">    ✓</Text>}
      {isCurrent && !awaitingDecision && <Text color="cyan">    ⠋</Text>}
    </Box>
  );
};

export const Progress: React.FC<ProgressProps> = ({ status, currentPhase }) => {
  const currentPhaseIndex = getPhaseIndex(status);
  const awaitingDecision = isAwaitingDecision(status);
  const isTerminal = status === "success" || status === "failed";

  // For terminal states, show all phases as completed (success) or stopped (failed)
  const effectiveIndex = isTerminal
    ? status === "success"
      ? PHASES.length
      : getPhaseIndex(currentPhase as CompilerStatus)
    : currentPhaseIndex;

  return (
    <Box flexDirection="column" marginY={1}>
      {PHASES.map((phase, index) => (
        <PhaseItem
          key={phase}
          index={index}
          phase={phase}
          currentPhaseIndex={effectiveIndex}
          isAwaitingDecision={awaitingDecision && index === effectiveIndex}
        />
      ))}
    </Box>
  );
};

export default Progress;
