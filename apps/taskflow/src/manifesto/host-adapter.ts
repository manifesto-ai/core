/**
 * Host adapter for Manifesto App v2.
 *
 * Adapts ManifestoHost (core input/output shape) to App Host interface
 * with body-based intents and completed/failed status.
 */

import type { Host as AppHost, HostResult as AppHostResult, Intent as AppIntent } from "@manifesto-ai/app";
import { isHostError, type HostResult as HostDispatchResult, type ManifestoHost } from "@manifesto-ai/host";
import type { ErrorValue, Intent as CoreIntent, Snapshot } from "@manifesto-ai/core";

function toCoreIntent(intent: AppIntent): CoreIntent {
  return {
    type: intent.type,
    input: intent.body,
    intentId: intent.intentId,
  };
}

function toErrorValue(intent: AppIntent, error: unknown): ErrorValue {
  const timestamp = Date.now();
  if (isHostError(error)) {
    return {
      code: error.code,
      message: error.message,
      source: {
        actionId: intent.intentId,
        nodePath: "host.dispatch",
      },
      timestamp,
      context: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: "HOST_ERROR",
      message: error.message,
      source: {
        actionId: intent.intentId,
        nodePath: "host.dispatch",
      },
      timestamp,
    };
  }

  return {
    code: "HOST_ERROR",
    message: String(error),
    source: {
      actionId: intent.intentId,
      nodePath: "host.dispatch",
    },
    timestamp,
  };
}

function mapHostResult(
  intent: AppIntent,
  result: HostDispatchResult
): AppHostResult {
  if (result.status === "complete") {
    return {
      status: "completed",
      snapshot: result.snapshot,
    };
  }

  if (result.status === "pending") {
    return {
      status: "failed",
      snapshot: result.snapshot,
      error: toErrorValue(intent, result.error ?? new Error("Host returned pending")),
    };
  }

  return {
    status: "failed",
    snapshot: result.snapshot,
    error: toErrorValue(intent, result.error ?? new Error("Host error")),
  };
}

/**
 * Create an App-compatible Host adapter.
 */
export function createAppHostAdapter(host: ManifestoHost): AppHost {
  const hostWithEffects = host as ManifestoHost & {
    getRegisteredEffectTypes?: () => readonly string[];
  };

  return {
    async dispatch(intent: AppIntent): Promise<AppHostResult> {
      const result = await host.dispatch(toCoreIntent(intent));
      return mapHostResult(intent, result);
    },

    registerEffect: (type, handler) =>
      host.registerEffect(type, async (effectType, params, context) => {
        const patches = await handler(effectType, params, {
          snapshot: context.snapshot as Snapshot,
        });
        return Array.from(patches);
      }),

    getRegisteredEffectTypes: () => hostWithEffects.getRegisteredEffectTypes?.() ?? [],
  };
}
