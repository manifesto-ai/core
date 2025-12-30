import type { FlowNode, ExprNode } from "@manifesto-ai/core";
import type { z } from "zod";

/**
 * IntentBody - What ActionRef.intent() returns
 *
 * Per FDR-B006, Builder returns IntentBody only.
 * IntentInstance (with intentId, intentKey, origin) is created by Bridge/Issuer.
 */
export interface IntentBody {
  readonly action: string;
  readonly input?: unknown;
}

/**
 * ActionRef<TInput> - Reference to a defined action
 *
 * Provides type-safe intent creation and carries compiled flow/availability.
 */
export interface ActionRef<TInput = void> {
  readonly __brand: "ActionRef";
  readonly __inputType?: TInput; // Phantom type
  readonly name: string;
  readonly label?: string;
  readonly inputSchema?: z.ZodTypeAny;
  readonly available: ExprNode;
  readonly flow: FlowNode;

  /**
   * Create an IntentBody for this action.
   * Does NOT create IntentInstance (no intentId/intentKey/origin).
   */
  intent: TInput extends void ? () => IntentBody : (input: TInput) => IntentBody;
}

/**
 * Internal type for action definition before compilation
 */
export interface ActionDef<TInput = void> {
  readonly name: string;
  readonly label?: string;
  readonly inputSchema?: z.ZodTypeAny;
  readonly available: ExprNode;
  readonly flow: FlowNode;
}

/**
 * Create an ActionRef from an ActionDef
 */
export function createActionRef<TInput>(def: ActionDef<TInput>): ActionRef<TInput>;
/**
 * Create a simple ActionRef from a name (for testing)
 */
export function createActionRef<TInput>(name: string): ActionRef<TInput>;
export function createActionRef<TInput>(defOrName: ActionDef<TInput> | string): ActionRef<TInput> {
  if (typeof defOrName === "string") {
    // Simple form for testing - creates minimal ActionRef
    const name = defOrName;
    const ref: ActionRef<TInput> = {
      __brand: "ActionRef",
      name,
      available: { kind: "lit", value: true },
      flow: { kind: "seq", steps: [] }, // Empty sequence as noop
      intent: ((input?: TInput) => ({
        action: name,
        input: input,
      })) as ActionRef<TInput>["intent"],
    };
    return ref;
  }

  const def = defOrName;
  const ref: ActionRef<TInput> = {
    __brand: "ActionRef",
    name: def.name,
    label: def.label,
    inputSchema: def.inputSchema,
    available: def.available,
    flow: def.flow,
    intent: ((input?: TInput) => ({
      action: def.name,
      input: input,
    })) as ActionRef<TInput>["intent"],
  };
  return ref;
}

/**
 * Type guard for ActionRef
 */
export function isActionRef(value: unknown): value is ActionRef<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ActionRef<unknown>).__brand === "ActionRef"
  );
}
