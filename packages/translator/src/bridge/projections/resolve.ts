/**
 * Resolve Projection
 *
 * Handles translator:resolve source events.
 * Maps ambiguity resolution to intent.
 */

import type {
  Projection,
  ProjectionRequest,
  ProjectionResult,
} from "@manifesto-ai/bridge";
import {
  isResolvePayload,
  type ResolveEventPayload,
} from "../source-events.js";

/**
 * Re-export for backward compatibility
 */
export type ResolvePayload = ResolveEventPayload;

/**
 * Create resolve projection
 *
 * @param projectionId - Optional custom projection ID
 * @returns Projection for translator:resolve events
 */
export function createResolveProjection(
  projectionId: string = "translator:resolve"
): Projection {
  return {
    projectionId,

    project(req: ProjectionRequest): ProjectionResult {
      const { source } = req;

      // Check if this is a translator:resolve event
      if (!isResolvePayload(source.payload)) {
        return { kind: "none", reason: "Not a resolve event" };
      }

      const payload = source.payload;

      // Return intent to resolve
      return {
        kind: "intent",
        body: {
          type: "translator:resolve",
          input: {
            reportId: payload.reportId,
            resolution: payload.resolution,
          },
        },
      };
    },
  };
}
