import type { FlowNode } from "@manifesto-ai/core";

/**
 * FlowRef - Reference to a reusable flow definition
 *
 * Used for flow.call() to invoke named flows.
 */
export interface FlowRef {
  readonly __brand: "FlowRef";
  readonly name?: string;
  readonly flow: FlowNode;
  /**
   * Compile to FlowNode IR
   */
  compile(): FlowNode;
}

/**
 * Create a FlowRef with name and flow
 */
export function createFlowRef(name: string, flow: FlowNode): FlowRef;
/**
 * Create a FlowRef from a FlowNode directly (for testing)
 */
export function createFlowRef(flow: FlowNode): FlowRef;
export function createFlowRef(nameOrFlow: string | FlowNode, maybeFlow?: FlowNode): FlowRef {
  if (typeof nameOrFlow === "string") {
    const name = nameOrFlow;
    const flow = maybeFlow!;
    return {
      __brand: "FlowRef",
      name,
      flow,
      compile: () => flow,
    };
  }

  const flow = nameOrFlow;
  return {
    __brand: "FlowRef",
    flow,
    compile: () => flow,
  };
}

/**
 * Type guard for FlowRef
 */
export function isFlowRef(value: unknown): value is FlowRef {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as FlowRef).__brand === "FlowRef"
  );
}
