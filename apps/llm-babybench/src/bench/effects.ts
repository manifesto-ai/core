/**
 * BabyAI Effect Handlers
 *
 * Effect handlers for Host to execute BabyAI game logic.
 * Each handler returns Patch[] to be applied to state.
 */

import type { Patch } from "@manifesto-ai/core";
import type { EffectHandler } from "@manifesto-ai/host";
import type { BabyAIState, WorldObject } from "../domain/index.js";

// Direction vectors: East, South, West, North
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

/**
 * Get position in front of agent
 */
function getFrontPosition(x: number, y: number, direction: number) {
  return {
    x: x + DX[direction],
    y: y + DY[direction],
  };
}

/**
 * Check if position is walkable
 */
function isWalkable(
  x: number,
  y: number,
  state: BabyAIState
): boolean {
  // Bounds check
  if (x < 0 || x >= state.grid.width || y < 0 || y >= state.grid.height) {
    return false;
  }

  // Cell type check
  const cell = state.grid.cells[y]?.[x];
  if (cell !== "floor") {
    return false;
  }

  // Object collision check - can't walk on any object
  const objectAtPos = state.objects.find((o) => o.x === x && o.y === y);
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
 * Find object at position
 */
function findObjectAt(
  x: number,
  y: number,
  objects: WorldObject[]
): { object: WorldObject; index: number } | null {
  const index = objects.findIndex((o) => o.x === x && o.y === y);
  if (index === -1) return null;
  return { object: objects[index], index };
}

// ============================================================================
// Effect Handlers
// ============================================================================

/**
 * Move effect - moves agent forward if valid
 */
export const moveHandler: EffectHandler = async (_type, params, context) => {
  const state = context.snapshot.data as BabyAIState;
  const x = params.x as number;
  const y = params.y as number;
  const direction = params.direction as number;

  const front = getFrontPosition(x, y, direction);
  const walkable = isWalkable(front.x, front.y, state);

  if (process.env.DEBUG) {
    console.log(`[moveHandler] params: x=${x}, y=${y}, dir=${direction}`);
    console.log(`[moveHandler] state: agent=(${state.agent.x}, ${state.agent.y}), steps=${state.steps}`);
    console.log(`[moveHandler] front: (${front.x}, ${front.y}), walkable=${walkable}`);
  }

  if (!walkable) {
    // Can't move - just increment steps
    const patches = [{ op: "set", path: "steps", value: state.steps + 1 }] as Patch[];
    if (process.env.DEBUG) console.log(`[moveHandler] NOT walkable, patches:`, patches);
    return patches;
  }

  const patches = [
    { op: "set", path: "agent.x", value: front.x },
    { op: "set", path: "agent.y", value: front.y },
    { op: "set", path: "steps", value: state.steps + 1 },
  ] as Patch[];
  if (process.env.DEBUG) console.log(`[moveHandler] MOVING to (${front.x}, ${front.y}), patches:`, patches);
  return patches;
};

/**
 * Pickup effect - picks up object in front
 */
export const pickupHandler: EffectHandler = async (_type, params, context) => {
  const state = context.snapshot.data as BabyAIState;
  const x = params.x as number;
  const y = params.y as number;
  const direction = params.direction as number;

  // Already carrying something
  if (state.agent.carrying !== null) {
    return [{ op: "set", path: "steps", value: state.steps + 1 }] as Patch[];
  }

  const front = getFrontPosition(x, y, direction);
  const found = findObjectAt(front.x, front.y, state.objects);

  // Nothing to pick up or it's a door
  if (!found || found.object.kind === "door") {
    return [{ op: "set", path: "steps", value: state.steps + 1 }] as Patch[];
  }

  const { object, index } = found;

  // Remove from objects and add to carrying
  const newObjects = [...state.objects];
  newObjects.splice(index, 1);

  return [
    {
      op: "set",
      path: "agent.carrying",
      value: { kind: object.kind, color: object.color },
    },
    { op: "set", path: "objects", value: newObjects },
    { op: "set", path: "steps", value: state.steps + 1 },
  ] as Patch[];
};

/**
 * Drop effect - drops carried object in front
 */
export const dropHandler: EffectHandler = async (_type, params, context) => {
  const state = context.snapshot.data as BabyAIState;
  const x = params.x as number;
  const y = params.y as number;
  const direction = params.direction as number;
  const carrying = params.carrying as { kind: string; color: string } | null;

  // Nothing to drop
  if (!carrying) {
    return [{ op: "set", path: "steps", value: state.steps + 1 }] as Patch[];
  }

  const front = getFrontPosition(x, y, direction);

  // Check if position is occupied
  const occupied = findObjectAt(front.x, front.y, state.objects);
  if (occupied) {
    return [{ op: "set", path: "steps", value: state.steps + 1 }] as Patch[];
  }

  // Create new object
  const newObject: WorldObject = {
    id: `dropped-${Date.now()}`,
    kind: carrying.kind,
    color: carrying.color,
    x: front.x,
    y: front.y,
  };

  return [
    { op: "set", path: "agent.carrying", value: null },
    { op: "set", path: "objects", value: [...state.objects, newObject] },
    { op: "set", path: "steps", value: state.steps + 1 },
  ] as Patch[];
};

/**
 * Toggle effect - toggles door in front
 */
export const toggleHandler: EffectHandler = async (_type, params, context) => {
  const state = context.snapshot.data as BabyAIState;
  const x = params.x as number;
  const y = params.y as number;
  const direction = params.direction as number;

  const front = getFrontPosition(x, y, direction);
  const found = findObjectAt(front.x, front.y, state.objects);

  // Nothing or not a door
  if (!found || found.object.kind !== "door") {
    return [{ op: "set", path: "steps", value: state.steps + 1 }] as Patch[];
  }

  const { index } = found;
  const newObjects = [...state.objects];
  newObjects[index] = {
    ...newObjects[index],
    isOpen: !newObjects[index].isOpen,
  };

  return [
    { op: "set", path: "objects", value: newObjects },
    { op: "set", path: "steps", value: state.steps + 1 },
  ] as Patch[];
};

/**
 * All effect handlers
 */
export const effectHandlers: Record<string, EffectHandler> = {
  "babyai.move": moveHandler,
  "babyai.pickup": pickupHandler,
  "babyai.drop": dropHandler,
  "babyai.toggle": toggleHandler,
};
