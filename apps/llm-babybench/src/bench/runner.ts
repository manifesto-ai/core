/**
 * Benchmark Runner
 *
 * Runs BabyAI tasks using Manifesto World.
 *
 * Key principles:
 * - Only use World.submitProposal() for actions
 * - State comes from World.getSnapshot()
 * - No manual state management
 */

import { createIntentInstance, type WorldId, type Snapshot } from "@manifesto-ai/world";
import type { BabyAIState, BabyAIAction, WorldObject } from "../domain/index.js";
import { BabyAIDomain } from "../domain/index.js";
import type { BabyBenchRow, DatasetConfig, ParsedEnvironment } from "../dataset/index.js";
import { parseEnvDescription, parseInitialState } from "../dataset/index.js";
import { createBenchWorld, createTaskSnapshot, registerActor } from "./setup.js";

// =============================================================================
// Types
// =============================================================================

export interface BenchTask {
  id: string;
  row: BabyBenchRow;
  config: DatasetConfig;
  initialState: BabyAIState;
}

export interface TaskResult {
  taskId: string;
  outcome: "success" | "failure" | "timeout";
  steps: number;
  reason?: string;
}

export interface Actor {
  id: string;
  proposeAction(state: BabyAIState, context: TaskContext): Promise<ActorProposal>;
  reset?(): void;
}

export interface ActorProposal {
  action: BabyAIAction;
  reasoning?: string;
}

export interface TaskContext {
  task: BenchTask;
  step: number;
  availableActions: BabyAIAction[];
}

// =============================================================================
// Task Creation
// =============================================================================

/**
 * Create a BenchTask from a dataset row
 */
export function createTask(row: BabyBenchRow, config: DatasetConfig): BenchTask {
  const parsed = parseEnvDescription(row.env_description);
  const { x, y, direction } = parseInitialState(row.initial_state);

  const objects = buildObjects(parsed);
  const grid = createGrid(parsed.gridSize.width, parsed.gridSize.height);

  // For PLAN config, target_subgoal is coordinates, so use parsed.mission instead
  // For other configs, use row.mission or row.target_subgoal
  let mission: string;
  if (config === "plan") {
    // PLAN: target_subgoal is coordinate like "(1, 6)", use env_description mission
    mission = parsed.mission || row.mission || "go to the red ball";
  } else {
    mission = row.mission || row.target_subgoal || parsed.mission || "Complete the task";
  }

  const initialState: BabyAIState = {
    grid,
    agent: { x, y, direction, carrying: null },
    objects,
    mission,
    steps: 0,
    maxSteps: 100,
    goalReached: false,
    // Re-entry markers for MEL
    lastMoveIntent: null,
    lastPickupIntent: null,
    lastDropIntent: null,
    lastToggleIntent: null,
  };

  return {
    id: `${config}-${row.level_name}-${row.seed}`,
    row,
    config,
    initialState,
  };
}

function buildObjects(parsed: ParsedEnvironment): WorldObject[] {
  const objects: WorldObject[] = [];

  for (const obj of parsed.objects) {
    objects.push({
      id: `obj-${objects.length}`,
      kind: obj.type,
      color: obj.color,
      x: obj.position.x,
      y: obj.position.y,
    });
  }

  for (const door of parsed.doors) {
    objects.push({
      id: `door-${objects.length}`,
      kind: "door",
      color: door.color,
      x: door.position.x,
      y: door.position.y,
      isOpen: door.isOpen,
    });
  }

  return objects;
}

function createGrid(width: number, height: number) {
  const cells: ("empty" | "wall" | "floor")[][] = [];
  for (let y = 0; y < height; y++) {
    const row: ("empty" | "wall" | "floor")[] = [];
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        row.push("wall");
      } else {
        row.push("floor");
      }
    }
    cells.push(row);
  }
  return { width, height, cells };
}

// =============================================================================
// Task Runner
// =============================================================================

/**
 * Run a task using Manifesto World
 */
export async function runTask(task: BenchTask, actor: Actor): Promise<TaskResult> {
  // Reset actor
  actor.reset?.();

  // Create world with initial state
  const { world, schemaHash } = createBenchWorld(task.initialState);

  // Register actor
  registerActor(world, actor.id);

  // Create genesis
  const initialSnapshot = createTaskSnapshot(task.initialState);
  const genesis = await world.createGenesis(initialSnapshot);
  let currentWorldId = genesis.worldId as WorldId;

  let step = 0;
  const maxSteps = task.initialState.maxSteps;

  while (step < maxSteps) {
    // Get current state from World
    const snapshot = await world.getSnapshot(currentWorldId);
    if (!snapshot) {
      return {
        taskId: task.id,
        outcome: "failure",
        steps: step,
        reason: "Snapshot not found",
      };
    }

    const state = snapshot.data as BabyAIState;

    // Check goal
    if (state.goalReached) {
      return {
        taskId: task.id,
        outcome: "success",
        steps: step,
      };
    }

    // Get available actions
    const availableActions = getAvailableActions(state);

    // Get action from actor
    const context: TaskContext = { task, step, availableActions };
    const proposal = await actor.proposeAction(state, context);

    // Handle done action
    if (proposal.action === "done") {
      const success = checkGoalReached(state, task);
      return {
        taskId: task.id,
        outcome: success ? "success" : "failure",
        steps: step,
        reason: success ? undefined : "Agent declared done but goal not reached",
      };
    }

    // Create intent
    const intent = await createIntentInstance({
      body: {
        type: proposal.action, // Domain action name
        input: {},
      },
      schemaHash,
      projectionId: "babybench",
      source: { kind: "agent", eventId: `step-${step}` },
      actor: { actorId: actor.id, kind: "agent" },
    });

    // Submit proposal to World
    const result = await world.submitProposal(actor.id, intent, currentWorldId);

    // Check result
    if (result.error) {
      return {
        taskId: task.id,
        outcome: "failure",
        steps: step,
        reason: result.error.message,
      };
    }

    // Update world ID
    if (result.resultWorld) {
      currentWorldId = result.resultWorld.worldId as WorldId;
    }

    step++;
  }

  return {
    taskId: task.id,
    outcome: "timeout",
    steps: step,
    reason: "Maximum steps exceeded",
  };
}

// =============================================================================
// Helpers
// =============================================================================

function getAvailableActions(state: BabyAIState): BabyAIAction[] {
  const actions: BabyAIAction[] = ["turnLeft", "turnRight", "done"];

  const dx = [1, 0, -1, 0][state.agent.direction];
  const dy = [0, 1, 0, -1][state.agent.direction];
  const frontX = state.agent.x + dx;
  const frontY = state.agent.y + dy;

  const frontCell = state.grid.cells[frontY]?.[frontX];

  // moveForward
  if (frontCell === "floor") {
    const door = state.objects.find(
      (o) => o.kind === "door" && o.x === frontX && o.y === frontY && !o.isOpen
    );
    if (!door) {
      actions.push("moveForward");
    }
  }

  // pickup
  if (state.agent.carrying === null) {
    const obj = state.objects.find(
      (o) => o.x === frontX && o.y === frontY && o.kind !== "door"
    );
    if (obj) {
      actions.push("pickup");
    }
  }

  // drop
  if (state.agent.carrying !== null) {
    const occupied = state.objects.find((o) => o.x === frontX && o.y === frontY);
    if (!occupied && frontCell === "floor") {
      actions.push("drop");
    }
  }

  // toggle
  const door = state.objects.find(
    (o) => o.kind === "door" && o.x === frontX && o.y === frontY
  );
  if (door) {
    actions.push("toggle");
  }

  return actions;
}

function checkGoalReached(state: BabyAIState, task: BenchTask): boolean {
  const mission = state.mission.toLowerCase();
  const { row, config } = task;

  // predict: check target state
  if (config === "predict" && row.target_state) {
    const { x, y, direction } = parseInitialState(row.target_state);
    return (
      state.agent.x === x &&
      state.agent.y === y &&
      state.agent.direction === direction
    );
  }

  // plan: check subgoal
  if (config === "plan" && row.target_subgoal) {
    const subgoal = row.target_subgoal.toLowerCase();

    // PLAN config: target_subgoal is often a coordinate like "(1, 6)"
    const coordMatch = row.target_subgoal.match(/\((\d+),\s*(\d+)\)/);
    if (coordMatch) {
      const targetX = parseInt(coordMatch[1], 10);
      const targetY = parseInt(coordMatch[2], 10);
      // Check if agent is adjacent to target position
      const dx = Math.abs(state.agent.x - targetX);
      const dy = Math.abs(state.agent.y - targetY);
      return dx + dy === 1;
    }

    if (subgoal.includes("go to")) {
      // Match "go to the/a COLOR TYPE" - support both articles
      const match = subgoal.match(/go to (?:the |a )?(\w+) (\w+)/);
      if (match) {
        const [, color, type] = match;
        const target = state.objects.find(
          (o) => o.color === color && o.kind === type
        );
        if (target) {
          const dx = Math.abs(state.agent.x - target.x);
          const dy = Math.abs(state.agent.y - target.y);
          return dx + dy === 1;
        }
      }
    }

    if (subgoal.includes("pick up")) {
      // Match "pick up the/a COLOR TYPE" - support both articles
      const match = subgoal.match(/pick up (?:the |a )?(\w+) (\w+)/);
      if (match) {
        const [, color, type] = match;
        return (
          state.agent.carrying?.color === color &&
          state.agent.carrying?.kind === type
        );
      }
    }
  }

  // Default: check mission
  // "put the/a COLOR1 TYPE1 next to the/a COLOR2 TYPE2"
  // Also handles: "put a TYPE next to a TYPE" (color-less)
  if (mission.includes("put") && mission.includes("next to")) {
    const objectTypes = ["ball", "key", "box", "door"];
    const putMatch = mission.match(/put (?:the |a )?(\w+) (\w+) next to (?:the |a )?(\w+) (\w+)/);
    if (putMatch) {
      const [, word1, word2, word3, word4] = putMatch;

      let pickupColor: string | undefined;
      let pickupType: string;
      let targetColor: string | undefined;
      let targetType: string;

      // Determine if word1 is type or color
      if (objectTypes.includes(word1)) {
        pickupType = word1;
        // Check if word3 is type or color
        if (objectTypes.includes(word3)) {
          targetType = word3;
        } else {
          targetColor = word3;
          targetType = word4;
        }
      } else {
        pickupColor = word1;
        pickupType = word2;
        if (objectTypes.includes(word3)) {
          targetType = word3;
        } else {
          targetColor = word3;
          targetType = word4;
        }
      }

      // Find the picked up object (should now be on the floor)
      const pickedObj = state.objects.find((o) => {
        if (o.kind !== pickupType) return false;
        if (pickupColor && o.color !== pickupColor) return false;
        return true;
      });
      // Find the target object
      const targetObj = state.objects.find((o) => {
        if (o.kind !== targetType) return false;
        if (targetColor && o.color !== targetColor) return false;
        return true;
      });
      if (pickedObj && targetObj) {
        // Check if they are adjacent
        const dx = Math.abs(pickedObj.x - targetObj.x);
        const dy = Math.abs(pickedObj.y - targetObj.y);
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
      }
    }
  }

  // "open the/a COLOR door"
  if (mission.includes("open")) {
    const openMatch = mission.match(/open (?:the |a )?(\w+) door/);
    if (openMatch) {
      const [, color] = openMatch;
      const door = state.objects.find(
        (o) => o.kind === "door" && o.color === color
      );
      if (door) {
        return door.isOpen === true;
      }
    }
  }

  // "pick up the/a COLOR TYPE"
  if (mission.includes("pick up")) {
    const pickupMatch = mission.match(/pick up (?:the |a )?(\w+) (\w+)/);
    if (pickupMatch) {
      const [, color, type] = pickupMatch;
      return (
        state.agent.carrying?.color === color &&
        state.agent.carrying?.kind === type
      );
    }
  }

  // "go to the/a COLOR TYPE"
  if (mission.includes("go to")) {
    // Match "go to the/a COLOR TYPE" - support both articles
    const match = mission.match(/go to (?:the |a )?(\w+) (\w+)/);
    if (match) {
      const [, color, type] = match;
      const target = state.objects.find(
        (o) => o.color === color && o.kind === type
      );
      if (process.env.DEBUG) {
        console.log(`[checkGoalReached] goto: mission="${mission}", color=${color}, type=${type}`);
        console.log(`[checkGoalReached] agent at (${state.agent.x}, ${state.agent.y})`);
        console.log(`[checkGoalReached] target: ${target ? `(${target.x}, ${target.y})` : "not found"}`);
        if (target) {
          const dx = Math.abs(state.agent.x - target.x);
          const dy = Math.abs(state.agent.y - target.y);
          console.log(`[checkGoalReached] distance: dx=${dx}, dy=${dy}, sum=${dx + dy}`);
        }
      }
      if (target) {
        const dx = Math.abs(state.agent.x - target.x);
        const dy = Math.abs(state.agent.y - target.y);
        return dx + dy === 1;
      }
    }
  }

  return false;
}
