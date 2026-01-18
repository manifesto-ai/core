/**
 * World Event Hub (App-owned)
 *
 * Provides subscription and scheduling for World governance events.
 * World emits events via WorldEventSink; App owns listener mechanics.
 */

import type {
  WorldEvent,
  WorldEventType,
  WorldEventSink,
} from "@manifesto-ai/world";
import type { Unsubscribe } from "../types/index.js";

// =============================================================================
// Scheduling
// =============================================================================

export interface ScheduleContext<Action = unknown> {
  schedule(action: Action): void;
}

function createScheduleContext<Action>(): {
  ctx: ScheduleContext<Action>;
  getActions: () => Action[];
} {
  const actions: Action[] = [];

  const ctx: ScheduleContext<Action> = {
    schedule(action: Action): void {
      actions.push(action);
    },
  };

  return {
    ctx,
    getActions: () => [...actions],
  };
}

// =============================================================================
// Event Handler Types
// =============================================================================

export type WorldEventHandler<Action = unknown> = (
  event: WorldEvent,
  ctx: ScheduleContext<Action>
) => void;

export type ScheduledActionHandler<Action = unknown> = (action: Action) => void;

export interface WorldEventSource<Action = unknown> {
  subscribe(handler: WorldEventHandler<Action>): Unsubscribe;
  subscribe(
    types: WorldEventType[],
    handler: WorldEventHandler<Action>
  ): Unsubscribe;
}

// =============================================================================
// World Event Hub
// =============================================================================

export class WorldEventHub<Action = unknown>
  implements WorldEventSource<Action>, WorldEventSink
{
  private handlers: Set<WorldEventHandler<Action>> = new Set();
  private actionHandler?: ScheduledActionHandler<Action>;
  private _dispatching = false;

  get isDispatching(): boolean {
    return this._dispatching;
  }

  assertNotDispatching(operation: string): void {
    if (this._dispatching) {
      throw new Error(
        `EVT-C2 violation: ${operation} called during event dispatch. ` +
          `Use ScheduleContext.schedule() to defer actions.`
      );
    }
  }

  onScheduledAction(handler: ScheduledActionHandler<Action>): void {
    this.actionHandler = handler;
  }

  subscribe(handler: WorldEventHandler<Action>): Unsubscribe;
  subscribe(
    types: WorldEventType[],
    handler: WorldEventHandler<Action>
  ): Unsubscribe;
  subscribe(
    typesOrHandler: WorldEventType[] | WorldEventHandler<Action>,
    maybeHandler?: WorldEventHandler<Action>
  ): Unsubscribe {
    if (typeof typesOrHandler === "function") {
      const handler = typesOrHandler;
      this.handlers.add(handler);
      return () => {
        this.handlers.delete(handler);
      };
    }

    const types = new Set(typesOrHandler);
    const handler = maybeHandler!;
    const filteredHandler: WorldEventHandler<Action> = (event, ctx) => {
      if (types.has(event.type)) {
        handler(event, ctx);
      }
    };

    this.handlers.add(filteredHandler);
    return () => {
      this.handlers.delete(filteredHandler);
    };
  }

  emit(event: WorldEvent): void {
    const { ctx, getActions } = createScheduleContext<Action>();
    this._dispatching = true;

    try {
      for (const handler of this.handlers) {
        try {
          handler(event, ctx);
        } catch (error) {
          console.error(
            `[WorldEventHub] Handler threw for event ${event.type}:`,
            error
          );
        }
      }
    } finally {
      this._dispatching = false;
    }

    const actions = getActions();
    if (actions.length > 0 && this.actionHandler) {
      for (const action of actions) {
        try {
          this.actionHandler(action);
        } catch (error) {
          console.error("[WorldEventHub] Action handler threw:", error);
        }
      }
    }
  }
}

export function createWorldEventHub<Action = unknown>(): WorldEventHub<Action> {
  return new WorldEventHub<Action>();
}
