import * as world from "../../index.js";
import type { WorldFacadeComplianceAdapter } from "./wfcts-types.js";

export class LegacyWorldFacadeComplianceAdapter implements WorldFacadeComplianceAdapter {
  createWorld(schemaHash: string = "wfcts-schema") {
    return world.createManifestoWorld({ schemaHash });
  }

  createStore(): unknown {
    return world.createMemoryWorldStore();
  }

  exports(): Record<string, unknown> {
    return world;
  }
}

export function createWorldFacadeComplianceAdapter(): WorldFacadeComplianceAdapter {
  return new LegacyWorldFacadeComplianceAdapter();
}
