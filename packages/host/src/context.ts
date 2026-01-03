import type { HostContext, Intent } from "@manifesto-ai/core";

export type HostContextOptions = {
  now?: () => number;
  randomSeed?: (intent: Intent) => string;
  env?: Record<string, unknown>;
  initialRandomSeed?: string;
};

export function createHostContextBuilder(
  intent: Intent,
  options?: HostContextOptions
): () => HostContext {
  const now = options?.now ?? Date.now;
  const randomSeed = options?.randomSeed?.(intent) ?? intent.intentId;
  const env = options?.env;

  return () => ({
    now: now(),
    randomSeed,
    env,
    durationMs: 0,
  });
}

export function createInitialHostContext(
  options?: HostContextOptions
): HostContext {
  const now = options?.now ?? Date.now;
  const randomSeed = options?.initialRandomSeed ?? "initial";

  return {
    now: now(),
    randomSeed,
    env: options?.env,
    durationMs: 0,
  };
}
