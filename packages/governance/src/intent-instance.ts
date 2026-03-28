import { sha256, toJcs } from "@manifesto-ai/core";
import type {
  ActorRef,
  IntentBody,
  IntentInstance,
  IntentOrigin,
  SourceRef,
} from "./types.js";

export interface CreateIntentInstanceOptions {
  readonly body: IntentBody;
  readonly schemaHash: string;
  readonly projectionId: string;
  readonly source: SourceRef;
  readonly actor: ActorRef;
  readonly note?: string;
  readonly intentId?: string;
}

export async function computeIntentKey(
  schemaHash: string,
  body: IntentBody
): Promise<string> {
  const input = [
    schemaHash,
    body.type,
    toJcs(body.input ?? null),
    toJcs(body.scopeProposal ?? null),
  ].join(":");

  return sha256(input);
}

export async function createIntentInstance(
  options: CreateIntentInstanceOptions
): Promise<IntentInstance> {
  const intentId = options.intentId ?? `intent-${crypto.randomUUID()}`;
  const intentKey = await computeIntentKey(options.schemaHash, options.body);

  return createIntentInstanceSync(
    options.body,
    intentId,
    intentKey,
    {
      projectionId: options.projectionId,
      source: options.source,
      actor: options.actor,
      note: options.note,
    }
  );
}

export function createIntentInstanceSync(
  body: IntentBody,
  intentId: string,
  intentKey: string,
  origin: IntentOrigin
): IntentInstance {
  return deepFreeze({
    body,
    intentId,
    intentKey,
    meta: {
      origin,
    },
  });
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    const nested = (value as Record<string, unknown>)[key];
    if (nested !== null && typeof nested === "object") {
      deepFreeze(nested);
    }
  }

  return Object.freeze(value);
}
