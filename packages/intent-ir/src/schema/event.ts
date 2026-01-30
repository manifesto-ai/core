/**
 * @fileoverview Event Schema (SPEC Section 7.2)
 *
 * Event specifies the core action/operation of the intent.
 */

import { z } from "zod";
import { EventClassSchema } from "./heads.js";

/**
 * Event schema representing the core action.
 *
 * @example
 * { lemma: "CANCEL", class: "CONTROL" }
 * { lemma: "SOLVE", class: "SOLVE" }
 */
export const EventSchema = z.object({
  /**
   * Canonical verb/event label.
   * MUST be uppercase ASCII.
   * MUST resolve to a LexiconEntry at runtime.
   */
  lemma: z
    .string()
    .min(1)
    .regex(/^[A-Z][A-Z0-9_]*$/, "lemma must be uppercase ASCII"),

  /**
   * Coarse event classification.
   */
  class: EventClassSchema,
}).strict();

export type Event = z.infer<typeof EventSchema>;
