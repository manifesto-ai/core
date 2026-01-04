#!/usr/bin/env npx tsx
/**
 * Debug Runner - Test state updates through World
 */

import {
  createBenchWorld,
  createTaskSnapshot,
  registerActor,
} from "../src/bench/setup.js";
import { BabyAIDomain, type BabyAIState } from "../src/domain/index.js";
import { createIntentInstance, type WorldId } from "@manifesto-ai/world";

const ACTOR_ID = "debug-actor";

// Simple test state
const initialState: BabyAIState = {
  grid: {
    width: 5,
    height: 5,
    cells: [
      ["wall", "wall", "wall", "wall", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "floor", "floor", "floor", "wall"],
      ["wall", "wall", "wall", "wall", "wall"],
    ],
  },
  agent: { x: 2, y: 2, direction: 0, carrying: null },
  objects: [
    { id: "key-1", type: "key", color: "yellow", x: 3, y: 2 },
  ],
  mission: "go to the yellow key",
  steps: 0,
  maxSteps: 100,
  goalReached: false,
};

async function main() {
  console.log("=".repeat(60));
  console.log("DEBUG RUNNER - State Update Test");
  console.log("=".repeat(60));

  const { world, schemaHash } = createBenchWorld(initialState);
  registerActor(world, ACTOR_ID);

  const snapshot = createTaskSnapshot(initialState);
  const genesis = await world.createGenesis(snapshot);
  let currentWorldId = genesis.worldId as WorldId;

  console.log(`\nInitial: agent at (${initialState.agent.x}, ${initialState.agent.y}) facing ${initialState.agent.direction}`);

  // Test 1: Turn right
  console.log("\n--- Action: turnRight ---");
  let state = await executeAction("turnRight", world, schemaHash, currentWorldId, ACTOR_ID);
  currentWorldId = state.worldId;
  console.log(`After turnRight: agent facing ${state.data.agent.direction} (expected: 1)`);

  // Test 2: Turn right again
  console.log("\n--- Action: turnRight ---");
  state = await executeAction("turnRight", world, schemaHash, currentWorldId, ACTOR_ID);
  currentWorldId = state.worldId;
  console.log(`After turnRight: agent facing ${state.data.agent.direction} (expected: 2)`);

  // Test 3: Move forward (facing West, should move to x=1)
  console.log("\n--- Action: moveForward ---");
  state = await executeAction("moveForward", world, schemaHash, currentWorldId, ACTOR_ID);
  currentWorldId = state.worldId;
  console.log(`After moveForward: agent at (${state.data.agent.x}, ${state.data.agent.y}) (expected: 1, 2)`);

  // Test 4: Turn left twice to face East
  console.log("\n--- Action: turnLeft (twice) ---");
  state = await executeAction("turnLeft", world, schemaHash, currentWorldId, ACTOR_ID);
  currentWorldId = state.worldId;
  state = await executeAction("turnLeft", world, schemaHash, currentWorldId, ACTOR_ID);
  currentWorldId = state.worldId;
  console.log(`After turnLeft x2: agent facing ${state.data.agent.direction} (expected: 0)`);

  // Test 5: Move forward twice to get adjacent to key
  console.log("\n--- Action: moveForward (twice) ---");
  state = await executeAction("moveForward", world, schemaHash, currentWorldId, ACTOR_ID);
  currentWorldId = state.worldId;
  console.log(`After move 1: agent at (${state.data.agent.x}, ${state.data.agent.y})`);
  state = await executeAction("moveForward", world, schemaHash, currentWorldId, ACTOR_ID);
  currentWorldId = state.worldId;
  console.log(`After move 2: agent at (${state.data.agent.x}, ${state.data.agent.y}) (expected: 3, 2 but blocked by key)`);

  console.log("\n" + "=".repeat(60));
  console.log("STATE SUMMARY");
  console.log("=".repeat(60));
  console.log(`Final position: (${state.data.agent.x}, ${state.data.agent.y})`);
  console.log(`Final direction: ${state.data.agent.direction}`);
  console.log(`Steps taken: ${state.data.steps}`);
  console.log(`Objects: ${state.data.objects.length}`);
  console.log("=".repeat(60));
}

async function executeAction(
  action: string,
  world: any,
  schemaHash: string,
  worldId: WorldId,
  actorId: string
): Promise<{ worldId: WorldId; data: BabyAIState }> {
  const intent = await createIntentInstance({
    body: { type: action, input: {} },
    schemaHash,
    projectionId: "debug",
    source: { kind: "agent", eventId: `debug-${Date.now()}` },
    actor: { actorId, kind: "agent" },
  });

  const result = await world.submitProposal(actorId, intent, worldId);

  if (result.error) {
    console.error(`Error: ${result.error.message}`);
    throw new Error(result.error.message);
  }

  const newWorldId = result.resultWorld?.worldId as WorldId;
  const snapshot = await world.getSnapshot(newWorldId);
  const data = snapshot.data as BabyAIState;

  return { worldId: newWorldId, data };
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
