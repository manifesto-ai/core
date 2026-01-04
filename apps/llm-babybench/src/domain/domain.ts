/**
 * BabyAI Domain
 *
 * Loads the MEL-compiled domain schema for BabyAI grid world.
 *
 * Actions:
 * - turnLeft/turnRight: Pure state patches (direction rotation)
 * - moveForward/pickup/drop/toggle: Effects (collision detection, validation)
 * - done: Signal task completion
 */

import type { DomainSchema } from "@manifesto-ai/core";
import babyaiSchema from "./babyai.json" with { type: "json" };

/**
 * BabyAI Domain Module
 *
 * Provides the compiled MEL schema compatible with @manifesto-ai/core.
 * The schema is pre-compiled from babyai.mel.
 */
export const BabyAIDomain = {
  /**
   * The compiled DomainSchema IR (for Core/Host)
   */
  schema: babyaiSchema as unknown as DomainSchema,
};

export type { BabyAIState, BabyAIAction } from "./schema.js";
