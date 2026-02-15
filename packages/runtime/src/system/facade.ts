/**
 * System Facade Implementation
 *
 * Provides access to system actions and memory maintenance.
 *
 * @see SPEC §15.2
 * @module
 */

import type {
  ActOptions,
  ActionHandle,
  MemoryMaintenanceOptions,
  SystemFacade,
  SystemMemoryFacade,
} from "../types/index.js";

export interface SystemFacadeDeps {
  act: (type: string, input?: unknown, opts?: ActOptions) => ActionHandle;
}

class SystemMemoryFacadeImpl implements SystemMemoryFacade {
  private readonly _act: SystemFacadeDeps["act"];

  constructor(act: SystemFacadeDeps["act"]) {
    this._act = act;
  }

  maintain(opts: MemoryMaintenanceOptions): ActionHandle {
    return this._act(
      "system.memory.maintain",
      { ops: opts.operations },
      { actorId: opts.actorId }
    );
  }
}

export class SystemFacadeImpl implements SystemFacade {
  readonly memory: SystemMemoryFacade;
  private readonly _act: SystemFacadeDeps["act"];

  constructor(deps: SystemFacadeDeps) {
    this._act = deps.act;
    this.memory = new SystemMemoryFacadeImpl(this._act);
  }

  act(type: `system.${string}`, input?: unknown): ActionHandle {
    return this._act(type, input);
  }
}

/**
 * Create a System Facade.
 */
export function createSystemFacade(deps: SystemFacadeDeps): SystemFacade {
  return new SystemFacadeImpl(deps);
}
