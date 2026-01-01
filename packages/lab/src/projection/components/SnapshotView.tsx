/**
 * SnapshotView Component
 *
 * Displays current world snapshot.
 * Detects BabyAI state and renders as a visual grid.
 */

import React from "react";
import { Box, Text } from "ink";
import type { Snapshot } from "@manifesto-ai/world";

// =============================================================================
// BabyAI Grid Renderer
// =============================================================================

// Direction arrows: 0=East, 1=South, 2=West, 3=North
const DIRECTION_ARROWS = ["→", "↓", "←", "↑"];

const COLOR_MAP: Record<string, string> = {
  red: "red",
  green: "green",
  blue: "blue",
  yellow: "yellow",
  purple: "magenta",
  grey: "gray",
  gray: "gray",
};

interface BabyAIState {
  grid: { width: number; height: number; cells: string[][] };
  agent: { x: number; y: number; direction: number; carrying: { type: string; color: string } | null };
  objects: Array<{ x: number; y: number; type: string; color: string; isOpen?: boolean }>;
  mission: string;
  steps: number;
  maxSteps: number;
}

function isBabyAIState(data: unknown): data is BabyAIState {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return (
    "grid" in obj &&
    "agent" in obj &&
    "objects" in obj &&
    "mission" in obj &&
    typeof obj.grid === "object" &&
    obj.grid !== null &&
    "width" in (obj.grid as object) &&
    "height" in (obj.grid as object)
  );
}

const BabyAIGridView: React.FC<{ state: BabyAIState }> = ({ state }) => {
  const { grid, agent, objects, mission, steps, maxSteps } = state;

  // Build object lookup map
  const objectMap = new Map<string, { type: string; color: string; isOpen?: boolean }>();
  for (const obj of objects) {
    objectMap.set(`${obj.x},${obj.y}`, obj);
  }

  // Render grid rows
  const rows: React.ReactNode[] = [];

  for (let y = 0; y < grid.height; y++) {
    const cells: React.ReactNode[] = [];

    for (let x = 0; x < grid.width; x++) {
      const cellType = grid.cells[y]?.[x] ?? "empty";
      const obj = objectMap.get(`${x},${y}`);
      const isAgent = agent.x === x && agent.y === y;

      let char = " ";
      let color: string = "gray";

      if (isAgent) {
        char = DIRECTION_ARROWS[agent.direction] ?? "?";
        color = "cyan";
      } else if (obj) {
        switch (obj.type) {
          case "key":
            char = "♦";
            color = COLOR_MAP[obj.color] ?? "white";
            break;
          case "ball":
            char = "●";
            color = COLOR_MAP[obj.color] ?? "white";
            break;
          case "box":
            char = "□";
            color = COLOR_MAP[obj.color] ?? "white";
            break;
          case "door":
            char = obj.isOpen ? "▯" : "▮";
            color = COLOR_MAP[obj.color] ?? "white";
            break;
          default:
            char = "?";
        }
      } else if (cellType === "wall") {
        char = "█";
        color = "gray";
      } else if (cellType === "floor") {
        char = "·";
        color = "blackBright";
      }

      cells.push(
        <Text key={x} color={color as any}>
          {char}
        </Text>
      );
    }

    rows.push(<Box key={y}>{cells}</Box>);
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">BabyAI World</Text>
        <Text color="gray"> (Step {steps}/{maxSteps})</Text>
      </Box>

      <Box flexDirection="column">{rows}</Box>

      <Box marginTop={1} gap={2}>
        <Text color="cyan">{DIRECTION_ARROWS[agent.direction]} Agent</Text>
        <Text color="gray">█ Wall</Text>
        <Text color="yellow">♦ Key</Text>
        <Text color="green">▮ Door</Text>
      </Box>

      <Box marginTop={1}>
        <Text bold>Mission: </Text>
        <Text color="yellow">{mission}</Text>
      </Box>

      {agent.carrying && (
        <Box>
          <Text color="gray">Carrying: </Text>
          <Text color={COLOR_MAP[agent.carrying.color] ?? "white"}>
            {agent.carrying.type} ({agent.carrying.color})
          </Text>
        </Box>
      )}
    </Box>
  );
};

// =============================================================================
// Generic JSON Renderer (for debug mode)
// =============================================================================

const MAX_DISPLAY_DEPTH = 3;
const MAX_STRING_LENGTH = 50;
const MAX_ARRAY_ITEMS = 5;

export interface SnapshotViewProps {
  snapshot: Snapshot | null;
  enabled: boolean;
  mode?: "auto" | "grid" | "json";
}

function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

function renderValue(value: unknown, depth: number = 0): React.ReactNode {
  if (depth > MAX_DISPLAY_DEPTH) {
    return <Text color="gray">...</Text>;
  }

  if (value === null) return <Text color="magenta">null</Text>;
  if (value === undefined) return <Text color="gray">undefined</Text>;
  if (typeof value === "string") return <Text color="green">"{truncateString(value, MAX_STRING_LENGTH)}"</Text>;
  if (typeof value === "number") return <Text color="yellow">{value}</Text>;
  if (typeof value === "boolean") return <Text color="cyan">{value.toString()}</Text>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <Text color="gray">[]</Text>;
    const displayItems = value.slice(0, MAX_ARRAY_ITEMS);
    const remaining = value.length - MAX_ARRAY_ITEMS;
    return (
      <Box flexDirection="column">
        <Text color="gray">[</Text>
        {displayItems.map((item, index) => (
          <Box key={index} marginLeft={2}>
            {renderValue(item, depth + 1)}
            {index < displayItems.length - 1 && <Text color="gray">,</Text>}
          </Box>
        ))}
        {remaining > 0 && <Box marginLeft={2}><Text color="gray">...{remaining} more</Text></Box>}
        <Text color="gray">]</Text>
      </Box>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <Text color="gray">{"{}"}</Text>;
    const displayEntries = entries.slice(0, MAX_ARRAY_ITEMS);
    const remaining = entries.length - MAX_ARRAY_ITEMS;
    return (
      <Box flexDirection="column">
        <Text color="gray">{"{"}</Text>
        {displayEntries.map(([key, val], index) => (
          <Box key={key} marginLeft={2}>
            <Text color="blue">{key}</Text>
            <Text color="gray">: </Text>
            {renderValue(val, depth + 1)}
            {index < displayEntries.length - 1 && <Text color="gray">,</Text>}
          </Box>
        ))}
        {remaining > 0 && <Box marginLeft={2}><Text color="gray">...{remaining} more</Text></Box>}
        <Text color="gray">{"}"}</Text>
      </Box>
    );
  }

  return <Text color="gray">{String(value)}</Text>;
}

// =============================================================================
// Main Component
// =============================================================================

export const SnapshotView: React.FC<SnapshotViewProps> = ({
  snapshot,
  enabled,
  mode = "auto",
}) => {
  if (!enabled || !snapshot) {
    return null;
  }

  // Auto-detect BabyAI state and render as grid
  if (mode === "auto" || mode === "grid") {
    if (isBabyAIState(snapshot.data)) {
      return <BabyAIGridView state={snapshot.data} />;
    }
  }

  // JSON mode or non-BabyAI state
  return (
    <Box flexDirection="column" marginY={1} borderStyle="single" borderColor="gray" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="gray">Snapshot (Debug)</Text>
      </Box>
      <Box marginLeft={2}>
        {renderValue(snapshot.data, 0)}
      </Box>
    </Box>
  );
};

export default SnapshotView;
