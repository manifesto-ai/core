/**
 * dispatchAsync() — Non-normative convenience utility
 *
 * Promise-based wrapper around dispatch() + on().
 * Resolves when the intent reaches a terminal state.
 *
 * @see SDK SPEC v1.0.0 §14.3
 * @module
 */

import type { Snapshot, Intent } from "@manifesto-ai/core";
import type { ManifestoInstance } from "./types.js";

/**
 * Error thrown when an intent is rejected by a guard.
 */
export class DispatchRejectedError extends Error {
  readonly code = "DISPATCH_REJECTED";
  readonly intentId: string;

  constructor(intentId: string, reason?: string) {
    super(reason ?? "Intent was rejected by guard");
    this.name = "DispatchRejectedError";
    this.intentId = intentId;
  }
}

/**
 * Dispatch an intent and wait for it to complete.
 *
 * - Resolves with the terminal Snapshot on `dispatch:completed`
 * - Rejects with the error on `dispatch:failed`
 * - Rejects with DispatchRejectedError on `dispatch:rejected`
 *
 * This is a convenience utility derived entirely from `dispatch` + `on`.
 * It does NOT violate the "one owned concept" rule.
 *
 * @see SDK SPEC v1.0.0 §14.3
 */
export function dispatchAsync(
  instance: ManifestoInstance,
  intent: Intent,
): Promise<Snapshot> {
  const intentId = intent.intentId ?? generateId();
  const enriched: Intent = intent.intentId ? intent : { ...intent, intentId };

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      unsubCompleted();
      unsubFailed();
      unsubRejected();
    };

    const unsubCompleted = instance.on("dispatch:completed", (e) => {
      if (e.intentId === intentId) {
        cleanup();
        resolve(e.snapshot!);
      }
    });

    const unsubFailed = instance.on("dispatch:failed", (e) => {
      if (e.intentId === intentId) {
        cleanup();
        reject(e.error ?? new Error("Dispatch failed"));
      }
    });

    const unsubRejected = instance.on("dispatch:rejected", (e) => {
      if (e.intentId === intentId) {
        cleanup();
        reject(new DispatchRejectedError(intentId, e.reason));
      }
    });

    instance.dispatch(enriched);
  });
}

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
