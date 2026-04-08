import { z } from "zod";
import { FieldSpec } from "./field.js";
import { ExprNodeSchema } from "./expr.js";
import { FlowNodeSchema } from "./flow.js";
import { TypeDefinition } from "./type-spec.js";

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
   * Compatibility/introspection seam. When `inputType` is present,
   * Core uses `inputType` as the normative validation source.
   */
  input: FieldSpec.optional(),

  /**
   * Lossless runtime input typing seam.
   * If defined, Core MUST validate input against this definition.
   */
  inputType: TypeDefinition.optional(),

  /**
   * Declared action parameter order.
   * This is the canonical parameter-order seam for consumers.
   */
  params: z.array(z.string()).readonly().optional(),

  /**
   * Availability condition.
   * If defined, Core MUST check it before executing the flow.
   * Expression MUST return boolean.
   */
  available: ExprNodeSchema.optional(),

  /**
   * Intent dispatchability condition.
   * If defined, callers MAY query it against a bound intent before execution.
   * Expression MUST return boolean.
   */
  dispatchable: ExprNodeSchema.optional(),

  /**
   * Human-readable description
   */
  description: z.string().optional(),
});
export type ActionSpec = z.infer<typeof ActionSpec>;
