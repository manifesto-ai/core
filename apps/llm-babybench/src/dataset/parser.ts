/**
 * @manifesto-ai/llm-babybench
 *
 * Parser for BabyAI environment descriptions.
 */

import type { ParsedEnvironment, ParsedInitialState } from "./types.js";

/**
 * Parse the initial_state string from dataset.
 *
 * Format: "((x, y), direction)"
 * Example: "((3, 4), 3)" -> { x: 3, y: 4, direction: 3 }
 */
export function parseInitialState(stateStr: string): ParsedInitialState {
  const match = stateStr.match(/\(\((\d+),\s*(\d+)\),\s*(\d+)\)/);
  if (!match) {
    return { x: 1, y: 1, direction: 0 };
  }

  return {
    x: parseInt(match[1], 10),
    y: parseInt(match[2], 10),
    direction: parseInt(match[3], 10) as 0 | 1 | 2 | 3,
  };
}

/**
 * Parse direction string to number.
 */
function parseDirection(dirStr: string): "north" | "south" | "east" | "west" {
  const lower = dirStr.toLowerCase().trim();
  if (lower.includes("north")) return "north";
  if (lower.includes("south")) return "south";
  if (lower.includes("east")) return "east";
  if (lower.includes("west")) return "west";
  return "east"; // default
}

/**
 * Parse direction to number.
 */
export function directionToNumber(dir: "north" | "south" | "east" | "west"): 0 | 1 | 2 | 3 {
  switch (dir) {
    case "east": return 0;
    case "south": return 1;
    case "west": return 2;
    case "north": return 3;
  }
}

/**
 * Parse a position string like "(3, 4)" or "3, 4".
 */
function parsePosition(posStr: string): { x: number; y: number } | null {
  const match = posStr.match(/\(?(\d+),?\s*(\d+)\)?/);
  if (!match) return null;
  return {
    x: parseInt(match[1], 10),
    y: parseInt(match[2], 10),
  };
}

/**
 * Parse the env_description natural language string.
 *
 * Example env_description:
 * ```
 * An agent is in a grid world of size 8 by 8 cells.
 * Number of rooms: 1. The environment contains 1 room(s).
 * Room 0: top-left corner at (0, 0), size 8x8.
 * Agent initial position: (3, 4)
 * Agent facing direction: north
 * Object 0: key, color=yellow, position=(1, 6)
 * Mission: 'go to the yellow key'
 * ```
 */
export function parseEnvDescription(desc: string): ParsedEnvironment {
  const lines = desc.split("\n").map((l) => l.trim()).filter(Boolean);

  // Default values
  const result: ParsedEnvironment = {
    gridSize: { width: 8, height: 8 },
    roomCount: 1,
    agentPosition: { x: 1, y: 1 },
    agentDirection: "east",
    objects: [],
    doors: [],
    mission: "",
  };

  for (const line of lines) {
    // Grid size - Format 1: "grid world of size 8 by 8"
    const sizeMatch = line.match(/grid world of size (\d+) by (\d+)/i);
    if (sizeMatch) {
      result.gridSize = {
        width: parseInt(sizeMatch[1], 10),
        height: parseInt(sizeMatch[2], 10),
      };
      continue;
    }

    // Grid size - Format 2: "Total grid size: 8x8" or "Size of each room (including walls): 8x8"
    const gridSizeMatch = line.match(/(?:Total grid size|Size of each room)[^:]*:\s*(\d+)x(\d+)/i);
    if (gridSizeMatch) {
      result.gridSize = {
        width: parseInt(gridSizeMatch[1], 10),
        height: parseInt(gridSizeMatch[2], 10),
      };
      continue;
    }

    // Room count
    const roomMatch = line.match(/Number of rooms:\s*(\d+)/i);
    if (roomMatch) {
      result.roomCount = parseInt(roomMatch[1], 10);
      continue;
    }

    // Agent position
    const agentPosMatch = line.match(/Agent initial position:\s*\((\d+),\s*(\d+)\)/i);
    if (agentPosMatch) {
      result.agentPosition = {
        x: parseInt(agentPosMatch[1], 10),
        y: parseInt(agentPosMatch[2], 10),
      };
      continue;
    }

    // Agent direction
    const agentDirMatch = line.match(/Agent facing direction:\s*(\w+)/i);
    if (agentDirMatch) {
      result.agentDirection = parseDirection(agentDirMatch[1]);
      continue;
    }

    // Objects (keys, balls, boxes) - Format 1: "Object 0: key, color=yellow, position=(1, 6)"
    const objectMatch = line.match(/Object \d+:\s*(\w+),\s*color=(\w+),\s*position=\((\d+),\s*(\d+)\)/i);
    if (objectMatch) {
      const objType = objectMatch[1].toLowerCase();
      if (objType === "key" || objType === "ball" || objType === "box") {
        result.objects.push({
          type: objType,
          color: objectMatch[2].toLowerCase(),
          position: {
            x: parseInt(objectMatch[3], 10),
            y: parseInt(objectMatch[4], 10),
          },
        });
      }
      continue;
    }

    // Objects - Format 2: "- key, color=grey, position=(6, 2)"
    const bulletObjectMatch = line.match(/^-\s*(key|ball|box),\s*color=(\w+),\s*position=\((\d+),\s*(\d+)\)/i);
    if (bulletObjectMatch) {
      result.objects.push({
        type: bulletObjectMatch[1].toLowerCase() as "key" | "ball" | "box",
        color: bulletObjectMatch[2].toLowerCase(),
        position: {
          x: parseInt(bulletObjectMatch[3], 10),
          y: parseInt(bulletObjectMatch[4], 10),
        },
      });
      continue;
    }

    // Door - Format 1: "Door 0: color=blue, position=(14, 1), open, unlocked"
    const doorMatch = line.match(/Door \d+:\s*color=(\w+),\s*position=\((\d+),\s*(\d+)\),\s*(open|closed),\s*(locked|unlocked)/i);
    if (doorMatch) {
      result.doors.push({
        color: doorMatch[1].toLowerCase(),
        position: {
          x: parseInt(doorMatch[2], 10),
          y: parseInt(doorMatch[3], 10),
        },
        isOpen: doorMatch[4].toLowerCase() === "open",
        isLocked: doorMatch[5].toLowerCase() === "locked",
      });
      continue;
    }

    // Door - Format 2: "- door, color=blue, position=(14, 1), locked=False"
    const bulletDoorMatch = line.match(/^-\s*door,\s*color=(\w+),\s*position=\((\d+),\s*(\d+)\),\s*locked=(True|False)/i);
    if (bulletDoorMatch) {
      result.doors.push({
        color: bulletDoorMatch[1].toLowerCase(),
        position: {
          x: parseInt(bulletDoorMatch[2], 10),
          y: parseInt(bulletDoorMatch[3], 10),
        },
        isOpen: false,  // All doors start closed
        isLocked: bulletDoorMatch[4].toLowerCase() === "true",
      });
      continue;
    }

    // Mission
    const missionMatch = line.match(/Mission:\s*['"]?(.+?)['"]?\s*$/i);
    if (missionMatch) {
      result.mission = missionMatch[1].trim();
      continue;
    }
  }

  return result;
}

/**
 * Parse expert action sequence string.
 *
 * Example: "forward, forward, left, pickup" -> ["forward", "forward", "left", "pickup"]
 */
export function parseActionSequence(seq: string): string[] {
  if (!seq) return [];
  return seq.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
}

/**
 * Validate that an action is a valid BabyAI action.
 */
export function isValidAction(action: string): boolean {
  const validActions = ["left", "right", "forward", "pickup", "drop", "toggle", "done"];
  return validActions.includes(action.toLowerCase());
}
