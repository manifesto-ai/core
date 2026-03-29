import { createWorldCoordinator } from "./coordinator.js";
import type { WorldConfig, WorldInstance } from "./types.js";

export function createWorld(config: WorldConfig): WorldInstance {
  return {
    coordinator: createWorldCoordinator({
      store: config.store,
      lineage: config.lineage,
      governance: config.governance,
      eventDispatcher: config.eventDispatcher,
    }),
    lineage: config.lineage,
    governance: config.governance,
    store: config.store,
  };
}
