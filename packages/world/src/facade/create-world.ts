import { createWorldCoordinator } from "./coordinator.js";
import { createWorldRuntime } from "./runtime.js";
import type { WorldConfig, WorldInstance } from "./types.js";

export function createWorld(config: WorldConfig): WorldInstance {
  const coordinator = createWorldCoordinator({
    store: config.store,
    lineage: config.lineage,
    governance: config.governance,
    eventDispatcher: config.eventDispatcher,
  });
  const runtime = createWorldRuntime({
    store: config.store,
    lineage: config.lineage,
    governance: config.governance,
    eventDispatcher: config.eventDispatcher,
    executor: config.executor,
  });

  return {
    coordinator,
    runtime,
    lineage: config.lineage,
    governance: config.governance,
    store: config.store,
  };
}
