/**
 * Benchmark Setup
 *
 * Creates World for BabyAI benchmark.
 *
 * Architecture (per Constitution):
 * - Actor submits Intent to World
 * - World governs (Proposal + Authority)
 * - World internally delegates to Host for execution
 * - Host applies patches, World returns new Snapshot
 *
 * External code ONLY uses world.submitProposal().
 * Host is internal to World - never exposed.
 */

import { createHost } from "@manifesto-ai/host";
import {
  ManifestoWorld,
  createSnapshot,
  type HostInterface,
  type ManifestoWorldConfig,
} from "@manifesto-ai/world";
import { BabyAIDomain, type BabyAIState } from "../domain/index.js";
import { effectHandlers } from "./effects.js";

/**
 * Benchmark world - only World is exposed
 */
export interface BenchWorld {
  world: ManifestoWorld;
  schemaHash: string;
}

/**
 * Create a BenchWorld for a task
 *
 * Host is created internally and encapsulated within World.
 * External code can ONLY interact through world.submitProposal().
 *
 * @param initialState - Initial BabyAI state
 * @returns World (Host is internal, not exposed)
 */
export function createBenchWorld(initialState: BabyAIState): BenchWorld {
  const schemaHash = BabyAIDomain.schema.hash;

  // Host is internal to this function - not exposed
  const host = createHost(BabyAIDomain.schema, {
    initialData: initialState,
  });

  // Register effect handlers on Host
  for (const [type, handler] of Object.entries(effectHandlers)) {
    host.registerEffect(type, handler);
  }

  // HostInterface is the ONLY way World communicates with Host
  // This is internal plumbing, not external API
  const hostInterface: HostInterface = {
    async dispatch(intent, loopOptions) {
      // BabyAI actions are one-shot: limit to 1 iteration
      const result = await host.dispatch(intent, {
        ...loopOptions,
        maxIterations: 1,
      });
      return {
        status: result.status === "complete" ? "complete" : "error",
        snapshot: result.snapshot,
      };
    },
  };

  // World is the governance layer - the ONLY external interface
  const worldConfig: ManifestoWorldConfig = {
    schemaHash,
    host: hostInterface,
  };

  const world = new ManifestoWorld(worldConfig);

  // Return ONLY World - Host is encapsulated
  return { world, schemaHash };
}

/**
 * Create initial snapshot for a task
 */
export function createTaskSnapshot(state: BabyAIState): ReturnType<typeof createSnapshot> {
  const now = Date.now();
  return createSnapshot(state, BabyAIDomain.schema.hash, {
    now,
    randomSeed: `seed-${now}`,
  });
}

/**
 * Register actor with auto-approve policy
 */
export function registerActor(world: ManifestoWorld, actorId: string): void {
  world.registerActor(
    { actorId, kind: "agent" },
    { mode: "auto_approve" }
  );
}
