/**
 * Translate Projection
 *
 * Handles translator:translate source events.
 * Maps natural language input to translation intent.
 */

import type {
  Projection,
  ProjectionRequest,
  ProjectionResult,
} from "@manifesto-ai/bridge";
import {
  isTranslatePayload,
  type TranslateEventPayload,
} from "../source-events.js";

/**
 * Re-export for backward compatibility
 */
export type TranslatePayload = TranslateEventPayload;

/**
 * Create translate projection
 *
 * @param projectionId - Optional custom projection ID
 * @returns Projection for translator:translate events
 */
export function createTranslateProjection(
  projectionId: string = "translator:translate"
): Projection {
  return {
    projectionId,

    project(req: ProjectionRequest): ProjectionResult {
      const { source } = req;

      // Check if this is a translator:translate event
      if (!isTranslatePayload(source.payload)) {
        return { kind: "none", reason: "Not a translate event" };
      }

      const payload = source.payload;

      // Return intent to translate
      return {
        kind: "intent",
        body: {
          type: "translator:translate",
          input: {
            text: payload.input,
          },
        },
      };
    },
  };
}
