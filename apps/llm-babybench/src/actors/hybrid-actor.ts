/**
 * Hybrid Actor - LLM Planning + BFS Execution
 *
 * Uses LLM once to understand the task and plan,
 * then uses BFS for deterministic pathfinding.
 *
 * This is the "Manifesto-compliant" approach:
 * - LLM for high-level understanding (1 call)
 * - Deterministic computation for execution
 *
 * For "predict" config tasks:
 * - Skips LLM planning (uses target_state directly)
 * - Navigates to exact position + direction
 */

import OpenAI from "openai";
import type { Actor, ActorProposal, TaskContext } from "../bench/index.js";
import type { BabyAIState, BabyAIAction } from "../domain/index.js";
import type { WorldObject as BabyAIObject } from "../domain/index.js";
import { parseInitialState } from "../dataset/index.js";

// =============================================================================
// Types
// =============================================================================

export interface HybridActorOptions {
  /** OpenAI model to use */
  model?: string;

  /** Temperature for generation */
  temperature?: number;

  /** Debug mode */
  debug?: boolean;
}

interface Target {
  type: "go_to" | "pick_up" | "drop" | "toggle";
  objectType: string;
  color: string;
}

/**
 * Target goal for BFS
 * - exactDirection: navigate to exact position + direction (predict mode)
 * - Otherwise: navigate to be adjacent to position
 */
interface TargetGoal {
  x: number;
  y: number;
  exactDirection?: number;  // If set, navigate to exact position with this direction
}

// =============================================================================
// Direction Helpers
// =============================================================================

const DIRECTION_DX = [1, 0, -1, 0];
const DIRECTION_DY = [0, 1, 0, -1];

interface Position {
  x: number;
  y: number;
}

function getDirectionTo(from: Position, to: Position): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx > 0) return 0;
  if (dy > 0) return 1;
  if (dx < 0) return 2;
  return 3;
}

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

// =============================================================================
// LLM Planning
// =============================================================================

function buildPlanningPrompt(state: BabyAIState): string {
  const { agent, objects, mission } = state;
  const directions = ["East", "South", "West", "North"];

  const objectList = objects
    .map((o) => `- ${o.color} ${o.kind} at (${o.x}, ${o.y})`)
    .join("\n");

  return `You are analyzing a BabyAI grid world task.

## Current State
Agent Position: (${agent.x}, ${agent.y})
Agent Direction: ${directions[agent.direction]}
Carrying: ${agent.carrying ? `${agent.carrying.color} ${agent.carrying.kind}` : "nothing"}

## Objects
${objectList || "No objects"}

## Mission
${mission}

Analyze the mission and identify the target. Respond with JSON:
{
  "type": "go_to" | "pick_up" | "drop" | "toggle",
  "objectType": "key" | "ball" | "box" | "door",
  "color": "red" | "blue" | "green" | "yellow" | "purple" | "grey"
}`;
}

async function getPlanFromLLM(
  state: BabyAIState,
  model: string,
  temperature: number,
  debug: boolean
): Promise<Target | null> {
  const client = new OpenAI();

  try {
    const response = await client.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: "user", content: buildPlanningPrompt(state) },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content) as Target;

    if (debug) {
      console.log(`[Hybrid] Plan: ${JSON.stringify(result)}`);
    }

    return result;
  } catch (error) {
    if (debug) {
      console.error(`[Hybrid] Planning error:`, error);
    }
    return null;
  }
}

// =============================================================================
// BFS Pathfinding
// =============================================================================

function bfsPath(
  state: BabyAIState,
  target: TargetGoal
): BabyAIAction[] | null {
  const start = { x: state.agent.x, y: state.agent.y };
  const startDir = state.agent.direction;
  const isExactMode = target.exactDirection !== undefined;

  // Exact mode: check if already at exact position
  if (isExactMode) {
    if (start.x === target.x && start.y === target.y) {
      if (startDir === target.exactDirection) {
        return []; // Already at exact goal
      }
      // Need to turn to target direction
      const actions: BabyAIAction[] = [];
      let dir = startDir;
      while (dir !== target.exactDirection!) {
        actions.push("turnRight");
        dir = (dir + 1) % 4;
      }
      return actions;
    }
  }

  // Adjacent mode: check if already adjacent
  if (!isExactMode) {
    const dx = Math.abs(start.x - target.x);
    const dy = Math.abs(start.y - target.y);

    if (dx + dy === 1) {
      // Already adjacent, just turn to face
      const targetDir = getDirectionTo(start, target);
      const actions: BabyAIAction[] = [];
      let dir = startDir;
      while (dir !== targetDir) {
        actions.push("turnRight");
        dir = (dir + 1) % 4;
      }
      return actions;
    }
  }

  // BFS to find path
  const queue: { pos: Position; dir: number; path: BabyAIAction[] }[] = [
    { pos: start, dir: startDir, path: [] },
  ];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y},${startDir}`);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Try forward movement
    const nx = current.pos.x + DIRECTION_DX[current.dir];
    const ny = current.pos.y + DIRECTION_DY[current.dir];

    if (isWalkable(nx, ny, state.grid, state.objects)) {
      const key = `${nx},${ny},${current.dir}`;
      if (!visited.has(key)) {
        visited.add(key);
        const newPath = [...current.path, "moveForward" as BabyAIAction];

        // Exact mode: check if at exact target position
        if (isExactMode && nx === target.x && ny === target.y) {
          // Add final turns to reach exact direction
          let d = current.dir;
          while (d !== target.exactDirection!) {
            newPath.push("turnRight");
            d = (d + 1) % 4;
          }
          return newPath;
        }

        // Adjacent mode: check if adjacent to target
        if (!isExactMode) {
          const adjDx = Math.abs(nx - target.x);
          const adjDy = Math.abs(ny - target.y);
          if (adjDx + adjDy === 1) {
            // Turn to face target
            const targetDir = getDirectionTo({ x: nx, y: ny }, target);
            let d = current.dir;
            while (d !== targetDir) {
              newPath.push("turnRight");
              d = (d + 1) % 4;
            }
            return newPath;
          }
        }

        queue.push({ pos: { x: nx, y: ny }, dir: current.dir, path: newPath });
      }
    }

    // Try turns
    for (const turn of ["turnLeft", "turnRight"] as BabyAIAction[]) {
      const newDir = turn === "turnLeft"
        ? (current.dir + 3) % 4
        : (current.dir + 1) % 4;
      const key = `${current.pos.x},${current.pos.y},${newDir}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({
          pos: current.pos,
          dir: newDir,
          path: [...current.path, turn],
        });
      }
    }
  }

  return null;
}

// =============================================================================
// Hybrid Actor
// =============================================================================

export function createHybridActor(options: HybridActorOptions = {}): Actor {
  const { model = "gpt-4o-mini", temperature = 0.2, debug = false } = options;

  let plan: Target | null = null;
  let hasPlanned = false;
  let currentPath: BabyAIAction[] = [];
  let pathIndex = 0;

  return {
    id: `hybrid-${model}`,

    async proposeAction(
      state: BabyAIState,
      context: TaskContext
    ): Promise<ActorProposal> {
      // Phase 1: Plan (once)
      if (!hasPlanned) {
        hasPlanned = true;
        const { task } = context;

        // For predict config with target_state: skip LLM, use exact mode
        if (task.config === "predict" && task.row.target_state) {
          const { x, y, direction } = parseInitialState(task.row.target_state);
          const targetGoal: TargetGoal = { x, y, exactDirection: direction };

          if (debug) {
            console.log(`[Hybrid] Predict mode: target (${x}, ${y}) dir=${direction}`);
          }

          const path = bfsPath(state, targetGoal);

          if (!path) {
            return {
              action: "done",
              reasoning: "No path found to target",
            };
          }

          currentPath = path;
          pathIndex = 0;

          if (debug) {
            console.log(`[Hybrid] Path: ${path.join(" → ")}`);
          }

          if (path.length === 0) {
            return {
              action: "done",
              reasoning: "Already at goal",
            };
          }

          const action = currentPath[pathIndex];
          pathIndex++;

          return {
            action,
            reasoning: `Predict path, step 1/${currentPath.length}`,
          };
        }

        // For other configs: use LLM planning
        plan = await getPlanFromLLM(state, model, temperature, debug);

        if (!plan) {
          return {
            action: "done",
            reasoning: "Failed to get plan from LLM",
          };
        }

        // Find target object
        const target = state.objects.find(
          (o) => o.kind === plan!.objectType && o.color === plan!.color
        );

        if (!target) {
          return {
            action: "done",
            reasoning: `Target not found: ${plan.color} ${plan.objectType}`,
          };
        }

        // Compute path using BFS (adjacent mode)
        const path = bfsPath(state, { x: target.x, y: target.y });

        if (!path) {
          return {
            action: "done",
            reasoning: "No path found to target",
          };
        }

        currentPath = path;
        pathIndex = 0;

        if (debug) {
          console.log(`[Hybrid] Path: ${path.join(" → ")}`);
        }

        // If path is empty, we're already there
        if (path.length === 0) {
          if (plan.type === "pick_up") {
            return {
              action: "pickup",
              reasoning: "At target, picking up",
            };
          }
          return {
            action: "done",
            reasoning: "Already at target",
          };
        }

        // Return first action
        const action = currentPath[pathIndex];
        pathIndex++;

        return {
          action,
          reasoning: `Planned path, step 1/${currentPath.length}`,
        };
      }

      // Phase 2: Execute path deterministically
      if (pathIndex < currentPath.length) {
        const action = currentPath[pathIndex];
        pathIndex++;

        return {
          action,
          reasoning: `Executing plan step ${pathIndex}/${currentPath.length}`,
        };
      }

      // Path complete, execute final action
      if (plan) {
        if (plan.type === "pick_up") {
          return {
            action: "pickup",
            reasoning: "At target, picking up",
          };
        }
        if (plan.type === "toggle") {
          return {
            action: "toggle",
            reasoning: "At target, toggling",
          };
        }
      }

      return {
        action: "done",
        reasoning: "Plan execution complete",
      };
    },

    reset() {
      plan = null;
      hasPlanned = false;
      currentPath = [];
      pathIndex = 0;
    },
  };
}
