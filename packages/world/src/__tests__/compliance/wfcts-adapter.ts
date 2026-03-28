import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createLineageService,
  type GovernanceEvent,
} from "../../index.js";
import * as facadeWorld from "../../facade.js";
import * as topLevelWorld from "../../index.js";
import type { WorldFacadeComplianceAdapter } from "./wfcts-types.js";

export class SplitWorldFacadeComplianceAdapter implements WorldFacadeComplianceAdapter {
  private readonly events: GovernanceEvent[] = [];

  createWorld() {
    const store = this.createStore();
    const lineage = createLineageService(store);
    const governance = createGovernanceService(store, {
      lineageService: lineage,
    });
    const dispatcher = createGovernanceEventDispatcher({
      service: governance,
      sink: {
        emit: (event): void => {
          this.events.push(event);
        },
      },
      now: () => 1000,
    });

    return topLevelWorld.createWorld({
      store,
      lineage,
      governance,
      eventDispatcher: dispatcher,
    });
  }

  createStore() {
    return topLevelWorld.createInMemoryWorldStore();
  }

  facadeExports(): Record<string, unknown> {
    return facadeWorld;
  }

  topLevelExports(): Record<string, unknown> {
    return topLevelWorld;
  }

  eventLog(): GovernanceEvent[] {
    return [...this.events];
  }
}

export function createWorldFacadeComplianceAdapter(): WorldFacadeComplianceAdapter {
  return new SplitWorldFacadeComplianceAdapter();
}
