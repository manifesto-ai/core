import { describe, it, expect } from "vitest";
import { createFieldRef, isFieldRef } from "../refs/field-ref.js";
import { createComputedRef, isComputedRef } from "../refs/computed-ref.js";
import { createActionRef, isActionRef } from "../refs/action-ref.js";
import { createFlowRef, isFlowRef } from "../refs/flow-ref.js";

describe("FieldRef", () => {
  it("creates a field ref with correct path", () => {
    const ref = createFieldRef<string>("user.name");
    expect(ref.path).toBe("user.name");
    expect(ref.__brand).toBe("FieldRef");
  });

  it("isFieldRef correctly identifies field refs", () => {
    const ref = createFieldRef<number>("count");
    expect(isFieldRef(ref)).toBe(true);
    expect(isFieldRef({ path: "foo" })).toBe(false);
    expect(isFieldRef(null)).toBe(false);
    expect(isFieldRef(undefined)).toBe(false);
  });

  it("handles nested paths", () => {
    const ref = createFieldRef<boolean>("deeply.nested.path.value");
    expect(ref.path).toBe("deeply.nested.path.value");
  });
});

describe("ComputedRef", () => {
  it("creates a computed ref with correct name", () => {
    const ref = createComputedRef<boolean>("isActive");
    expect(ref.name).toBe("isActive");
    expect(ref.__brand).toBe("ComputedRef");
  });

  it("generates correct path for computed", () => {
    const ref = createComputedRef<string>("displayName");
    expect(ref.path).toBe("computed.displayName");
  });

  it("isComputedRef correctly identifies computed refs", () => {
    const ref = createComputedRef<number>("total");
    expect(isComputedRef(ref)).toBe(true);
    expect(isComputedRef({ name: "foo" })).toBe(false);
    expect(isComputedRef(null)).toBe(false);
  });
});

describe("ActionRef", () => {
  it("creates an action ref with correct name", () => {
    const ref = createActionRef<{ amount: number }>("withdraw");
    expect(ref.name).toBe("withdraw");
    expect(ref.__brand).toBe("ActionRef");
  });

  it("intent returns correct IntentBody", () => {
    const ref = createActionRef<{ id: string }>("select");
    const intent = ref.intent({ id: "abc123" });

    expect(intent).toEqual({
      action: "select",
      input: { id: "abc123" },
    });
  });

  it("intent works with void input", () => {
    const ref = createActionRef<void>("reset");
    const intent = ref.intent();

    expect(intent).toEqual({
      action: "reset",
      input: undefined,
    });
  });

  it("isActionRef correctly identifies action refs", () => {
    const ref = createActionRef<void>("submit");
    expect(isActionRef(ref)).toBe(true);
    expect(isActionRef({ name: "foo" })).toBe(false);
    expect(isActionRef(null)).toBe(false);
  });
});

describe("FlowRef", () => {
  it("creates a flow ref with correct node", () => {
    const node = { kind: "seq" as const, steps: [] };
    const ref = createFlowRef(node);
    expect(ref.__brand).toBe("FlowRef");
    expect(ref.compile()).toBe(node);
  });

  it("isFlowRef correctly identifies flow refs", () => {
    const ref = createFlowRef({ kind: "halt" as const, reason: "done" });
    expect(isFlowRef(ref)).toBe(true);
    expect(isFlowRef({ compile: () => ({}) })).toBe(false);
    expect(isFlowRef(null)).toBe(false);
  });
});
