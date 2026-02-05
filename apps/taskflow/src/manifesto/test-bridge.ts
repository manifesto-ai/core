/**
 * Test Bridge Adapter
 *
 * Provides a Bridge-like interface backed by @manifesto-ai/app v2.3.0.
 */

import {
  createApp,
  createDefaultPolicyService,
  type AppState,
  type PolicyService,
  type Unsubscribe,
} from "@manifesto-ai/app";
import type { DomainSchema } from "@manifesto-ai/core";
import type { ActorRef, IntentBody } from "@manifesto-ai/world";

import { taskflowEffects } from "./effects";

export interface TestBridge {
  dispatch: (body: IntentBody, source?: unknown, actor?: ActorRef) => Promise<void>;
  getSnapshot: () => AppState<Record<string, unknown>> | null;
  subscribe: (callback: (snapshot: AppState<Record<string, unknown>>) => void) => Unsubscribe;
  refresh: () => Promise<void>;
  dispose: () => void;
  isDisposed: () => boolean;
}

export interface TestBridgeOptions {
  schema: DomainSchema;
  initialData: Record<string, unknown>;
  defaultActor: ActorRef;
  policyService?: PolicyService;
}

export async function createTestBridge(options: TestBridgeOptions): Promise<TestBridge> {
  // v2.3.0 Effects-first API
  const app = createApp({
    schema: options.schema,
    effects: taskflowEffects,
    policyService: options.policyService ?? createDefaultPolicyService({ warnOnAutoApprove: false }),
    initialData: options.initialData,
    actorPolicy: {
      mode: "anonymous",
      defaultActor: {
        actorId: options.defaultActor.actorId,
        kind: options.defaultActor.kind,
        name: options.defaultActor.name,
        meta: options.defaultActor.meta,
      },
    },
  });

  await app.ready();

  let disposed = false;

  return {
    dispatch: async (body, _source, actor) => {
      if (disposed) {
        throw new Error("Bridge is disposed");
      }
      const handle = app.act(body.type, body.input, actor ? { actorId: actor.actorId } : undefined);
      await handle.result();
    },

    getSnapshot: () => (disposed ? null : (app.getState() as AppState<Record<string, unknown>>)),

    subscribe: (callback) => {
      return app.subscribe(
        (state) => state as AppState<Record<string, unknown>>,
        (state) => callback(state as AppState<Record<string, unknown>>),
        { batchMode: "immediate" }
      );
    },

    refresh: async () => {
      if (disposed) {
        return;
      }
      await app.act("refreshFilters").done();
    },

    dispose: () => {
      disposed = true;
      void app.dispose();
    },

    isDisposed: () => disposed,
  };
}
