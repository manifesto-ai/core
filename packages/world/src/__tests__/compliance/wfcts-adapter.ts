import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  type GovernanceEvent,
} from "@manifesto-ai/governance";
import { createLineageService } from "@manifesto-ai/lineage";
import * as facadeWorld from "../../facade.js";
import * as legacyWorld from "../../index.js";
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

    return facadeWorld.createWorld({
      store,
      lineage,
      governance,
      eventDispatcher: dispatcher,
    });
  }

  createStore() {
    return facadeWorld.createInMemoryWorldStore();
  }

  facadeExports(): Record<string, unknown> {
    return facadeWorld;
  }

  legacyExports(): Record<string, unknown> {
    return legacyWorld;
  }

  eventLog(): GovernanceEvent[] {
    return [...this.events];
  }
}

export function createWorldFacadeComplianceAdapter(): WorldFacadeComplianceAdapter {
  return new SplitWorldFacadeComplianceAdapter();
}
