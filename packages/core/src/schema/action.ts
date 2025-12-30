import { z } from "zod";
import { FieldSpec } from "./field.js";
import { ExprNodeSchema } from "./expr.js";
import { FlowNodeSchema } from "./flow.js";

/**
 * ActionSpec - Maps intents to flows
 * An action defines what happens when a particular intent is dispatched.
 */
export const ActionSpec = z.object({
  /**
   * The flow to execute when this action is invoked
   */
  flow: FlowNodeSchema,

  /**
   * Input schema for validation.
   * If defined, Core MUST validate input against this schema.
   */
  input: FieldSpec.optional(),

  /**
   * Availability condition.
   * If defined, Core MUST check it before executing the flow.
   * Expression MUST return boolean.
   */
  available: ExprNodeSchema.optional(),

  /**
   * Human-readable description
   */
  description: z.string().optional(),
});
export type ActionSpec = z.infer<typeof ActionSpec>;
