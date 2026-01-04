/**
 * BFS Actor - Deterministic Pathfinding
 *
 * Uses Breadth-First Search to find the shortest path to the goal.
 * No LLM calls - purely deterministic.
 *
 * Supported mission types:
 * - "go to": Navigate to be adjacent to target object
 * - "open": Navigate to door and toggle it
 * - "pick up": Navigate to object and pick it up
 * - "put next to": Pick up object X, navigate to Y, drop X next to Y
 * - "predict": Navigate to exact target_state position + direction
 * - "plan": Navigate to target coordinate
 * - Compound missions: "X and Y", "X then Y", "X, then Y"
 * - Relative positions: "in front of you", "behind you", etc.
 */

import type { Actor, ActorProposal, TaskContext } from "../bench/index.js";
import type { BabyAIState, BabyAIAction } from "../domain/index.js";
import type { WorldObject as BabyAIObject } from "../domain/index.js";
import { parseInitialState } from "../dataset/index.js";

// =============================================================================
// Types
// =============================================================================

interface Position {
  x: number;
  y: number;
}

/**
 * Mission type determines what action to take after navigating
 */
type MissionType = "goto" | "open" | "pickup" | "putnext" | "exact";

/**
 * Phase for multi-step missions like "put next to"
 */
type MissionPhase = "pickup" | "drop";

/**
 * Target goal for BFS
 */
interface TargetGoal {
  x: number;
  y: number;
  direction?: number;      // Required direction when reaching goal (predict mode)
  adjacentTo?: Position;   // If set, goal is to be adjacent to this position
  missionType: MissionType; // What to do when reaching target
}

/**
 * Parsed "put next to" mission
 * Color can be undefined for "any" color (e.g., "put a key next to a ball")
 */
interface PutNextMission {
  pickupColor?: string;
  pickupType: string;
  targetColor?: string;
  targetType: string;
  pickupRelativePos?: string;  // For "the key behind you"
}

interface AgentState {
  x: number;
  y: number;
  direction: number;
  carrying: { kind: string; color: string } | null;
}

// =============================================================================
// Direction Helpers
// =============================================================================

const DIRECTION_DX = [1, 0, -1, 0];
const DIRECTION_DY = [0, 1, 0, -1];

function getFrontPosition(x: number, y: number, direction: number): Position {
  return {
    x: x + DIRECTION_DX[direction],
    y: y + DIRECTION_DY[direction],
  };
}

// =============================================================================
// Mission Parsing
// =============================================================================

/**
 * Split compound missions into individual sub-missions
 * Handles: "X and Y", "X, then Y", "X then Y", "after you X, Y"
 */
function splitCompoundMission(mission: string): string[] {
  // Normalize the mission
  let normalized = mission.toLowerCase().trim();

  // Split patterns (order matters - more specific first)
  const splitPatterns = [
    /, then /,      // "open door, then go to ball"
    / then /,       // "open door then go to ball"
    / and /,        // "open door and go to ball"
    /after you /,   // "after you open door, go to ball"
  ];

  for (const pattern of splitPatterns) {
    if (pattern.test(normalized)) {
      const parts = normalized.split(pattern).map(p => p.trim()).filter(p => p.length > 0);
      if (parts.length > 1) {
        // Recursively split each part
        const result: string[] = [];
        for (const part of parts) {
          result.push(...splitCompoundMission(part));
        }
        return result;
      }
    }
  }

  // No compound pattern found, return as single mission
  return [normalized];
}

/**
 * Resolve relative position references like "in front of you", "behind you"
 * Returns the actual object at that relative position
 */
function resolveRelativePosition(
  state: BabyAIState,
  relativePos: string,
  objectType?: string,
  objectColor?: string
): BabyAIObject | null {
  const { x, y, direction } = state.agent;

  // Calculate position based on relative reference
  let targetX = x;
  let targetY = y;

  if (relativePos === "in front of you") {
    targetX = x + DIRECTION_DX[direction];
    targetY = y + DIRECTION_DY[direction];
  } else if (relativePos === "behind you") {
    targetX = x - DIRECTION_DX[direction];
    targetY = y - DIRECTION_DY[direction];
  } else if (relativePos === "on your left") {
    const leftDir = (direction + 3) % 4;
    targetX = x + DIRECTION_DX[leftDir];
    targetY = y + DIRECTION_DY[leftDir];
  } else if (relativePos === "on your right") {
    const rightDir = (direction + 1) % 4;
    targetX = x + DIRECTION_DX[rightDir];
    targetY = y + DIRECTION_DY[rightDir];
  }

  // Find object at that position
  return state.objects.find((o) => {
    if (o.x !== targetX || o.y !== targetY) return false;
    if (objectType && o.kind !== objectType) return false;
    if (objectColor && o.color !== objectColor) return false;
    return true;
  }) || null;
}

/**
 * Parse "put X next to Y" mission
 * Supports:
 * - "put the/a COLOR TYPE next to the/a COLOR TYPE"
 * - "put a TYPE next to a TYPE" (color-less)
 * - "put the TYPE behind you next to a TYPE" (relative position)
 */
function parsePutNextMission(mission: string): PutNextMission | null {
  // Pattern 1: "put the/a COLOR TYPE next to the/a COLOR TYPE" (with colors)
  const fullMatch = mission.match(/put (?:the |a )?(\w+) (\w+) next to (?:the |a )?(\w+) (\w+)/);
  if (fullMatch) {
    const [, word1, word2, word3, word4] = fullMatch;
    const objectTypes = ["ball", "key", "box", "door"];

    // Check if word1 is a type (color-less) or color
    if (objectTypes.includes(word1)) {
      // Pattern: "put a TYPE next to a COLOR TYPE" or "put a TYPE next to a TYPE"
      if (objectTypes.includes(word3)) {
        // "put a key next to a ball" - both color-less
        return {
          pickupType: word1,
          targetType: word3,
        };
      } else {
        // "put a key next to the red ball"
        return {
          pickupType: word1,
          targetColor: word3,
          targetType: word4,
        };
      }
    } else {
      // word1 is a color
      if (objectTypes.includes(word3)) {
        // "put the red key next to a ball" - target is color-less
        return {
          pickupColor: word1,
          pickupType: word2,
          targetType: word3,
        };
      } else {
        // "put the red key next to the blue ball" - full pattern
        return {
          pickupColor: word1,
          pickupType: word2,
          targetColor: word3,
          targetType: word4,
        };
      }
    }
  }

  // Pattern 2: "put the TYPE RELATIVE_POS next to a TYPE/COLOR TYPE"
  // e.g., "put the key behind you next to a door"
  const relativePatterns = ["in front of you", "behind you", "on your left", "on your right"];
  for (const relPos of relativePatterns) {
    const relPattern = new RegExp(`put (?:the |a )?(\\w+) ${relPos.replace(/ /g, " ")} next to (?:the |a )?(\\w+)(?: (\\w+))?`);
    const relMatch = mission.match(relPattern);
    if (relMatch) {
      const [, pickupType, word2, word3] = relMatch;
      const objectTypes = ["ball", "key", "box", "door"];

      if (objectTypes.includes(word2)) {
        // "put the key behind you next to a door" - target is type only
        return {
          pickupType,
          pickupRelativePos: relPos,
          targetType: word2,
        };
      } else if (word3) {
        // "put the key behind you next to the red door" - target has color
        return {
          pickupType,
          pickupRelativePos: relPos,
          targetColor: word2,
          targetType: word3,
        };
      }
    }
  }

  return null;
}

/**
 * Parse mission and find target
 * @param phase - For multi-step missions, which phase we're in
 * @param missionOverride - Optional override for compound mission sub-steps
 */
function findTarget(
  state: BabyAIState,
  context: TaskContext,
  phase?: MissionPhase,
  missionOverride?: string
): TargetGoal | null {
  const { task } = context;

  // For "predict" config: use exact target_state
  if (task.config === "predict" && task.row.target_state && !missionOverride) {
    const { x, y, direction } = parseInitialState(task.row.target_state);
    return { x, y, direction, missionType: "exact" };
  }

  // For "plan" config: target_subgoal is a coordinate like "(1, 6)"
  if (task.config === "plan" && task.row.target_subgoal && !missionOverride) {
    const coordMatch = task.row.target_subgoal.match(/\((\d+),\s*(\d+)\)/);
    if (coordMatch) {
      const targetX = parseInt(coordMatch[1], 10);
      const targetY = parseInt(coordMatch[2], 10);
      return { x: targetX, y: targetY, adjacentTo: { x: targetX, y: targetY }, missionType: "goto" };
    }
  }

  // Parse mission text (use override if provided)
  const mission = (missionOverride || state.mission).toLowerCase();

  // "put the/a COLOR1 TYPE1 next to the/a COLOR2 TYPE2"
  // Also handles: "put a TYPE next to a TYPE", "put the TYPE behind you next to a TYPE"
  const putNextMission = parsePutNextMission(mission);
  if (putNextMission) {
    if (phase === "pickup" || !phase) {
      // Phase 1: Navigate to pickup object
      let pickupObj: BabyAIObject | null | undefined = null;

      // Check for relative position reference first
      if (putNextMission.pickupRelativePos) {
        pickupObj = resolveRelativePosition(
          state,
          putNextMission.pickupRelativePos,
          putNextMission.pickupType,
          putNextMission.pickupColor
        );
      } else {
        // Find by color and type (color is optional)
        pickupObj = state.objects.find((o) => {
          if (o.kind !== putNextMission.pickupType) return false;
          if (putNextMission.pickupColor && o.color !== putNextMission.pickupColor) return false;
          return true;
        });
      }

      if (pickupObj) {
        return { x: pickupObj.x, y: pickupObj.y, adjacentTo: { x: pickupObj.x, y: pickupObj.y }, missionType: "putnext" };
      }
    } else if (phase === "drop") {
      // Phase 2: Find an empty cell adjacent to the target to drop the object
      const targetObj = state.objects.find((o) => {
        if (o.kind !== putNextMission.targetType) return false;
        if (putNextMission.targetColor && o.color !== putNextMission.targetColor) return false;
        return true;
      });

      if (targetObj) {
        // Find empty cells adjacent to target where we can drop
        const adjacentCells = [
          { x: targetObj.x + 1, y: targetObj.y },
          { x: targetObj.x - 1, y: targetObj.y },
          { x: targetObj.x, y: targetObj.y + 1 },
          { x: targetObj.x, y: targetObj.y - 1 },
        ];

        for (const cell of adjacentCells) {
          // Check if cell is floor and empty
          if (cell.x < 0 || cell.x >= state.grid.width || cell.y < 0 || cell.y >= state.grid.height) continue;
          if (state.grid.cells[cell.y]?.[cell.x] !== "floor") continue;
          const objectAtCell = state.objects.find((o) => o.x === cell.x && o.y === cell.y);
          if (objectAtCell) continue;

          // Found an empty cell adjacent to target - navigate to be adjacent to IT
          return { x: cell.x, y: cell.y, adjacentTo: { x: cell.x, y: cell.y }, missionType: "putnext" };
        }
      }
    }
    return null;
  }

  // Check for relative position patterns
  const relativePatterns = ["in front of you", "behind you", "on your left", "on your right"];
  const hasRelativePos = relativePatterns.some(p => mission.includes(p));

  // "open the/a COLOR door" or "open the door in front of you" or "open a door"
  if (mission.includes("open") && mission.includes("door")) {
    // Check for relative position first
    if (hasRelativePos) {
      for (const relPos of relativePatterns) {
        if (mission.includes(relPos)) {
          const door = resolveRelativePosition(state, relPos, "door");
          if (door && !door.isOpen) {
            return { x: door.x, y: door.y, adjacentTo: { x: door.x, y: door.y }, missionType: "open" };
          }
        }
      }
    }

    // Try "open the/a COLOR door"
    const openMatch = mission.match(/open (?:the |a )?(\w+) door/);
    if (openMatch && openMatch[1] !== "door") {
      const color = openMatch[1];
      const door = state.objects.find(
        (o) => o.kind === "door" && o.color === color && !o.isOpen
      );
      if (door) {
        return { x: door.x, y: door.y, adjacentTo: { x: door.x, y: door.y }, missionType: "open" };
      }
      const anyDoor = state.objects.find((o) => o.kind === "door" && o.color === color);
      if (anyDoor) {
        return { x: anyDoor.x, y: anyDoor.y, adjacentTo: { x: anyDoor.x, y: anyDoor.y }, missionType: "open" };
      }
    }

    // Try "open a door" (any door)
    if (mission.match(/open a door/)) {
      const door = state.objects.find((o) => o.kind === "door" && !o.isOpen);
      if (door) {
        return { x: door.x, y: door.y, adjacentTo: { x: door.x, y: door.y }, missionType: "open" };
      }
    }

    return null;
  }

  // "pick up the/a COLOR TYPE" with relative position support
  if (mission.includes("pick up")) {
    // Check for relative position
    if (hasRelativePos) {
      for (const relPos of relativePatterns) {
        if (mission.includes(relPos)) {
          // Try to find any pickable object at relative position
          const obj = resolveRelativePosition(state, relPos);
          if (obj && obj.kind !== "door") {
            return { x: obj.x, y: obj.y, adjacentTo: { x: obj.x, y: obj.y }, missionType: "pickup" };
          }
        }
      }
    }

    // Try "pick up the/a COLOR TYPE" first
    const pickupMatch = mission.match(/pick up (?:the |a )?(\w+) (\w+)/);
    if (pickupMatch) {
      const [, color, type] = pickupMatch;
      const target = state.objects.find(
        (o) => o.color === color && o.kind === type
      );
      if (target) {
        return { x: target.x, y: target.y, adjacentTo: { x: target.x, y: target.y }, missionType: "pickup" };
      }
    }

    // Try "pick up a TYPE" (any color) - e.g., "pick up a ball"
    const pickupAnyMatch = mission.match(/pick up (?:the |a )(ball|key|box)/);
    if (pickupAnyMatch) {
      const type = pickupAnyMatch[1];
      const target = state.objects.find((o) => o.kind === type);
      if (target) {
        return { x: target.x, y: target.y, adjacentTo: { x: target.x, y: target.y }, missionType: "pickup" };
      }
    }

    return null;
  }

  // "go to the/a COLOR TYPE" with relative position support
  if (mission.includes("go to")) {
    // Check for relative position
    if (hasRelativePos) {
      for (const relPos of relativePatterns) {
        if (mission.includes(relPos)) {
          const obj = resolveRelativePosition(state, relPos);
          if (obj) {
            return { x: obj.x, y: obj.y, adjacentTo: { x: obj.x, y: obj.y }, missionType: "goto" };
          }
        }
      }
    }

    // Try "go to the/a COLOR TYPE" first
    const gotoMatch = mission.match(/go to (?:the |a )?(\w+) (\w+)/);
    if (gotoMatch) {
      const [, color, type] = gotoMatch;
      const target = state.objects.find(
        (o) => o.color === color && o.kind === type
      );
      if (target) {
        return { x: target.x, y: target.y, adjacentTo: { x: target.x, y: target.y }, missionType: "goto" };
      }
    }

    // Try "go to a TYPE" (any color) - e.g., "go to a door"
    const gotoAnyMatch = mission.match(/go to (?:the |a )(ball|key|box|door)/);
    if (gotoAnyMatch) {
      const type = gotoAnyMatch[1];
      const target = state.objects.find((o) => o.kind === type);
      if (target) {
        return { x: target.x, y: target.y, adjacentTo: { x: target.x, y: target.y }, missionType: "goto" };
      }
    }

    return null;
  }

  return null;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if agent is adjacent to target
 */
function isAdjacentTo(agent: AgentState, target: Position): boolean {
  const dx = Math.abs(agent.x - target.x);
  const dy = Math.abs(agent.y - target.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

/**
 * Check if agent is facing target
 */
function isFacing(agent: AgentState, target: Position): boolean {
  const dx = target.x - agent.x;
  const dy = target.y - agent.y;

  if (dx === 1 && dy === 0) return agent.direction === 0;
  if (dx === 0 && dy === 1) return agent.direction === 1;
  if (dx === -1 && dy === 0) return agent.direction === 2;
  if (dx === 0 && dy === -1) return agent.direction === 3;

  return false;
}

/**
 * Get direction to face a target
 */
function getDirectionTo(from: Position, to: Position): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx > 0) return 0; // East
  if (dy > 0) return 1; // South
  if (dx < 0) return 2; // West
  return 3; // North
}

/**
 * Get action to turn from current direction to target direction
 */
function getTurnAction(current: number, target: number): BabyAIAction | null {
  if (current === target) return null;

  const diff = (target - current + 4) % 4;
  if (diff === 1) return "turnRight";
  if (diff === 3) return "turnLeft";
  // For diff === 2, turn either way
  return "turnRight";
}

/**
 * Check if position is walkable
 */
function isWalkable(
  x: number,
  y: number,
  grid: BabyAIState["grid"],
  objects: BabyAIObject[]
): boolean {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) {
    return false;
  }

  const cell = grid.cells[y]?.[x];
  if (cell !== "floor") {
    return false;
  }

  // Check for any object at position
  const objectAtPos = objects.find((o) => o.x === x && o.y === y);
  if (objectAtPos) {
    // Can only walk on open doors
    if (objectAtPos.kind === "door" && objectAtPos.isOpen) {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Get the direction after executing a path
 */
function getLastDirection(path: BabyAIAction[], startDir: number): number {
  let dir = startDir;
  for (const action of path) {
    if (action === "turnLeft") dir = (dir + 3) % 4;
    if (action === "turnRight") dir = (dir + 1) % 4;
  }
  return dir;
}

// =============================================================================
// BFS Path Finding
// =============================================================================

/**
 * BFS to find path to target goal
 *
 * For exact mode: navigate to exact position with exact direction
 * For adjacent mode: navigate to be adjacent to target and facing it
 */
function bfsPath(
  state: BabyAIState,
  target: TargetGoal
): BabyAIAction[] | null {
  const start: AgentState = {
    x: state.agent.x,
    y: state.agent.y,
    direction: state.agent.direction,
    carrying: state.agent.carrying,
  };

  const isExactMode = target.missionType === "exact" && target.direction !== undefined;
  const isAdjacentMode = target.adjacentTo !== undefined;

  // Exact mode: navigate to exact position with exact direction
  if (isExactMode) {
    // Check if already at exact position
    if (start.x === target.x && start.y === target.y) {
      if (start.direction === target.direction) {
        return []; // Already at exact goal
      }
      // Need to turn to target direction
      const actions: BabyAIAction[] = [];
      let dir = start.direction;
      while (dir !== target.direction!) {
        actions.push("turnRight");
        dir = (dir + 1) % 4;
      }
      return actions;
    }
  }

  // Adjacent mode: check if already adjacent and facing
  if (isAdjacentMode) {
    if (isAdjacentTo(start, target.adjacentTo!)) {
      if (isFacing(start, target.adjacentTo!)) {
        return []; // Already there
      }
      // Need to turn to face
      const targetDir = getDirectionTo(start, target.adjacentTo!);
      const actions: BabyAIAction[] = [];
      let dir = start.direction;
      while (dir !== targetDir) {
        actions.push("turnRight");
        dir = (dir + 1) % 4;
      }
      return actions;
    }
  }

  // BFS
  const queue: { pos: Position; path: BabyAIAction[] }[] = [
    { pos: { x: start.x, y: start.y }, path: [] },
  ];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Try all 4 directions
    for (let dir = 0; dir < 4; dir++) {
      const nx = current.pos.x + DIRECTION_DX[dir];
      const ny = current.pos.y + DIRECTION_DY[dir];
      const key = `${nx},${ny}`;

      if (visited.has(key)) continue;
      if (!isWalkable(nx, ny, state.grid, state.objects)) continue;

      visited.add(key);

      // Build path to this position
      const pathToPos = [...current.path];

      // Add turns needed from previous direction
      const prevDir = current.path.length > 0
        ? getLastDirection(current.path, start.direction)
        : start.direction;

      let curDir = prevDir;
      while (curDir !== dir) {
        const turn = getTurnAction(curDir, dir);
        if (turn) {
          pathToPos.push(turn);
          curDir = (curDir + (turn === "turnRight" ? 1 : 3)) % 4;
        } else {
          break;
        }
      }

      pathToPos.push("moveForward");

      // Exact mode: check if at exact target position
      if (isExactMode && nx === target.x && ny === target.y) {
        // Add final turns to reach exact direction
        let d = dir;
        while (d !== target.direction!) {
          pathToPos.push("turnRight");
          d = (d + 1) % 4;
        }
        return pathToPos;
      }

      // Adjacent mode: check if adjacent to target
      if (isAdjacentMode) {
        const adjTarget = target.adjacentTo!;
        if (
          (Math.abs(nx - adjTarget.x) === 1 && ny === adjTarget.y) ||
          (nx === adjTarget.x && Math.abs(ny - adjTarget.y) === 1)
        ) {
          // Add final turn to face target
          const finalDir = getDirectionTo({ x: nx, y: ny }, adjTarget);
          let d = dir;
          while (d !== finalDir) {
            pathToPos.push("turnRight");
            d = (d + 1) % 4;
          }
          return pathToPos;
        }
      }

      queue.push({ pos: { x: nx, y: ny }, path: pathToPos });
    }
  }

  return null; // No path found
}

// =============================================================================
// BFS Actor
// =============================================================================

export interface BFSActorOptions {
  /** Debug mode */
  debug?: boolean;
}

export function createBFSActor(options: BFSActorOptions = {}): Actor {
  let currentPath: BabyAIAction[] = [];
  let pathIndex = 0;
  let currentMissionType: MissionType = "goto";
  let finalActionDone = false;
  // For multi-step missions like "put next to"
  let currentPhase: MissionPhase = "pickup";
  let phaseComplete = false;
  // For compound missions (e.g., "X and Y")
  let subMissions: string[] = [];
  let currentSubMissionIndex = 0;
  let initialized = false;

  return {
    id: "bfs-deterministic",

    async proposeAction(
      state: BabyAIState,
      context: TaskContext
    ): Promise<ActorProposal> {
      // Initialize compound mission parsing on first call
      // Skip compound parsing for PREDICT and PLAN configs - they use exact targets
      if (!initialized) {
        initialized = true;
        const { config } = context.task;
        if (config === "predict" || config === "plan") {
          // For predict/plan, treat as single mission
          subMissions = [state.mission.toLowerCase()];
        } else {
          // For decompose and others, split compound missions
          const fullMission = state.mission.toLowerCase();
          subMissions = splitCompoundMission(fullMission);
          if (options.debug && subMissions.length > 1) {
            console.log(`[BFS] Compound mission detected: ${subMissions.length} sub-missions`);
            subMissions.forEach((m, i) => console.log(`  [${i}] ${m}`));
          }
        }
        currentSubMissionIndex = 0;
      }

      // Helper function to get current sub-mission state
      const getCurrentSubMission = () => {
        const subMission = subMissions[currentSubMissionIndex] || state.mission.toLowerCase();
        return {
          text: subMission,
          isPutNext: parsePutNextMission(subMission) !== null,
        };
      };

      let { text: currentSubMission, isPutNext: isPutNextMission } = getCurrentSubMission();
      const mission = currentSubMission;

      // If path is complete, check if we need to do final action
      if (pathIndex >= currentPath.length && currentPath.length > 0) {
        if (!finalActionDone) {
          finalActionDone = true;

          // Execute final action based on mission type
          switch (currentMissionType) {
            case "open":
              if (options.debug) {
                console.log("[BFS] Executing final action: toggle");
              }
              return {
                action: "toggle",
                reasoning: "Opening door",
              };
            case "pickup":
              if (options.debug) {
                console.log("[BFS] Executing final action: pickup");
              }
              return {
                action: "pickup",
                reasoning: "Picking up object",
              };
            case "putnext":
              if (currentPhase === "pickup") {
                if (options.debug) {
                  console.log("[BFS] PutNext Phase 1: picking up object");
                }
                // Mark phase as complete, will transition to drop phase
                phaseComplete = true;
                return {
                  action: "pickup",
                  reasoning: "Picking up object for put next to",
                };
              } else if (currentPhase === "drop") {
                if (options.debug) {
                  console.log("[BFS] PutNext Phase 2: dropping object");
                }
                return {
                  action: "drop",
                  reasoning: "Dropping object next to target",
                };
              }
              break;
            case "goto":
            case "exact":
              // Goal reached, declare done
              return {
                action: "done",
                reasoning: "Goal reached",
              };
          }
        }

        // For "put next to": transition to drop phase after pickup
        if (isPutNextMission && currentPhase === "pickup" && phaseComplete) {
          currentPhase = "drop";
          phaseComplete = false;
          currentPath = [];
          pathIndex = 0;
          finalActionDone = false;
          if (options.debug) {
            console.log("[BFS] Transitioning to drop phase");
          }
          // Continue to compute new path for drop phase
        } else if (currentMissionType === "pickup" && state.agent.carrying === null) {
          // Pickup action was executed but agent is not carrying anything
          // This means the pickup failed (object not in front, already carrying, etc.)
          // Reset and try again
          if (options.debug) {
            console.log("[BFS] Pickup failed - agent not carrying anything, retrying");
          }
          currentPath = [];
          pathIndex = 0;
          finalActionDone = false;
          // Continue to recompute path
        } else if (currentMissionType === "open") {
          // For "open" missions, verify the door is actually open
          // Find the door we were trying to open
          const doorTarget = findTarget(state, context, undefined, subMissions.length > 1 ? currentSubMission : undefined);
          if (doorTarget && doorTarget.adjacentTo) {
            const door = state.objects.find(
              (o) => o.kind === "door" && o.x === doorTarget.adjacentTo!.x && o.y === doorTarget.adjacentTo!.y
            );
            if (door && !door.isOpen) {
              // Door not open yet, retry
              if (options.debug) {
                console.log("[BFS] Door not open yet, retrying toggle");
              }
              currentPath = [];
              pathIndex = 0;
              finalActionDone = false;
              // Continue to recompute path
            } else {
              // Door is open or not found, proceed to next mission or done
              if (currentSubMissionIndex < subMissions.length - 1) {
                currentSubMissionIndex++;
                currentPath = [];
                pathIndex = 0;
                finalActionDone = false;
                currentPhase = "pickup";
                phaseComplete = false;
                const updated = getCurrentSubMission();
                currentSubMission = updated.text;
                isPutNextMission = updated.isPutNext;
                if (options.debug) {
                  console.log(`[BFS] Moving to sub-mission ${currentSubMissionIndex + 1}/${subMissions.length}: "${currentSubMission}"`);
                }
              } else {
                return { action: "done", reasoning: "Mission complete" };
              }
            }
          } else {
            // No door target found, declare done
            return { action: "done", reasoning: "Mission complete" };
          }
        } else {
          // Check if there are more sub-missions
          if (currentSubMissionIndex < subMissions.length - 1) {
            currentSubMissionIndex++;
            currentPath = [];
            pathIndex = 0;
            finalActionDone = false;
            currentPhase = "pickup";
            phaseComplete = false;
            // Re-compute current sub-mission state
            const updated = getCurrentSubMission();
            currentSubMission = updated.text;
            isPutNextMission = updated.isPutNext;
            if (options.debug) {
              console.log(`[BFS] Moving to sub-mission ${currentSubMissionIndex + 1}/${subMissions.length}: "${currentSubMission}"`);
            }
            // Continue to compute path for next sub-mission
          } else {
            // All sub-missions complete, declare done
            // For pickup missions, verify agent is carrying the object
            if (currentMissionType === "pickup" && state.agent.carrying !== null) {
              return {
                action: "done",
                reasoning: "Mission complete - object picked up",
              };
            } else if (currentMissionType === "pickup") {
              // Still not carrying, this shouldn't happen but retry
              if (options.debug) {
                console.log("[BFS] Final check: pickup mission but not carrying, retrying");
              }
              currentPath = [];
              pathIndex = 0;
              finalActionDone = false;
            } else {
              return {
                action: "done",
                reasoning: "Mission complete",
              };
            }
          }
        }
      }

      // If no path, compute one
      if (currentPath.length === 0 || pathIndex >= currentPath.length) {
        const phase = isPutNextMission ? currentPhase : undefined;
        // Pass current sub-mission as override for compound missions
        const missionOverride = subMissions.length > 1 ? currentSubMission : undefined;
        const target = findTarget(state, context, phase, missionOverride);

        if (!target) {
          return {
            action: "done",
            reasoning: "Cannot find target from mission",
          };
        }

        currentMissionType = target.missionType;
        finalActionDone = false;

        if (options.debug) {
          const mode = target.adjacentTo ? "adjacent" : "exact";
          const phaseStr = isPutNextMission ? ` phase=${currentPhase}` : "";
          console.log(`[BFS] Target: (${target.x}, ${target.y}) mode=${mode} mission=${target.missionType}${phaseStr}${target.direction !== undefined ? ` dir=${target.direction}` : ""}`);
        }

        const path = bfsPath(state, target);

        if (!path) {
          return {
            action: "done",
            reasoning: "No path found to target",
          };
        }

        if (path.length === 0) {
          // Already at target position, do final action immediately
          finalActionDone = true;
          switch (currentMissionType) {
            case "open":
              return {
                action: "toggle",
                reasoning: "Already at door, opening",
              };
            case "pickup":
              return {
                action: "pickup",
                reasoning: "Already at object, picking up",
              };
            case "putnext":
              if (currentPhase === "pickup") {
                phaseComplete = true;
                return {
                  action: "pickup",
                  reasoning: "Already at object, picking up for put next to",
                };
              } else if (currentPhase === "drop") {
                return {
                  action: "drop",
                  reasoning: "Already at target, dropping object",
                };
              }
              break;
            case "goto":
            case "exact":
              return {
                action: "done",
                reasoning: "Already at goal",
              };
          }
        }

        currentPath = path;
        pathIndex = 0;

        if (options.debug) {
          console.log(`[BFS] Path to target: ${path.join(" → ")}`);
        }
      }

      // Return next action in path
      const action = currentPath[pathIndex];
      pathIndex++;

      return {
        action,
        reasoning: `BFS step ${pathIndex}/${currentPath.length}`,
      };
    },

    reset() {
      currentPath = [];
      pathIndex = 0;
      currentMissionType = "goto";
      finalActionDone = false;
      currentPhase = "pickup";
      phaseComplete = false;
      subMissions = [];
      currentSubMissionIndex = 0;
      initialized = false;
    },
  };
}
