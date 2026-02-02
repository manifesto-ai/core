/**
 * onceIntent Tests
 *
 * Covers contextual keyword parsing and lowering semantics.
 */

import { describe, it, expect } from "vitest";
import { tokenize } from "../lexer/index.js";
import { parse, type ProgramNode } from "../parser/index.js";
import { compileMelDomain } from "../api/index.js";
import { sha256Sync } from "@manifesto-ai/core";
import type { CoreExprNode, CoreFlowNode } from "../generator/ir.js";

function collectIfNodes(flow: CoreFlowNode, acc: CoreFlowNode[] = []): CoreFlowNode[] {
  if (flow.kind === "if") {
    acc.push(flow);
    collectIfNodes(flow.then, acc);
    if (flow.else) {
      collectIfNodes(flow.else, acc);
    }
    return acc;
  }

  if (flow.kind === "seq") {
    for (const step of flow.steps) {
      collectIfNodes(step, acc);
    }
  }

  return acc;
}

function findGuardPath(cond: CoreExprNode): string | null {
  if (cond.kind === "neq") {
    if (cond.left.kind === "get" && cond.right.kind === "get" && cond.right.path === "meta.intentId") {
      if (cond.left.path.startsWith("$mel.guards.intent.")) {
        return cond.left.path;
      }
    }
  }

  if (cond.kind === "and") {
    for (const arg of cond.args) {
      const found = findGuardPath(arg);
      if (found) return found;
    }
  }

  return null;
}

describe("onceIntent", () => {
  it("parses onceIntent as statement keyword at statement start", () => {
    const mel = `
      domain Test {
        state { count: number }
        action inc() {
          onceIntent { patch count = add(count, 1) }
        }
      }
    `;

    const tokens = tokenize(mel).tokens;
    const result = parse(tokens);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);

    const program = result.program as ProgramNode;
    const action = program.domain.members.find((m) => m.kind === "action") as any;
    expect(action.body[0].kind).toBe("onceIntent");
  });

  it("treats onceIntent as identifier outside statement-start context", () => {
    const mel = `
      domain Test {
        state { onceIntent: string }
        action submit() {
          once(onceIntent) {
            patch onceIntent = $meta.intentId
          }
        }
      }
    `;

    const result = compileMelDomain(mel, { mode: "domain" });
    expect(result.errors).toHaveLength(0);
  });

  it("lowers onceIntent to map-level guard merge with unique guard ids", () => {
    const mel = `
      domain Test {
        state { count: number }
        action inc() {
          onceIntent { patch count = add(count, 1) }
          onceIntent when eq(count, 0) { patch count = add(count, 1) }
        }
      }
    `;

    const result = compileMelDomain(mel, { mode: "domain" });
    expect(result.errors).toHaveLength(0);
    const flow = result.schema!.actions["inc"].flow;

    const ifNodes = collectIfNodes(flow);
    expect(ifNodes).toHaveLength(2);

    const guardIds = new Set<string>();
    for (const node of ifNodes) {
      if (node.kind !== "if") continue;
      const guardPath = findGuardPath(node.cond);
      expect(guardPath).not.toBeNull();
      if (!guardPath) continue;
      const guardId = guardPath.split(".").pop() as string;
      guardIds.add(guardId);

      const thenSeq = node.then.kind === "seq" ? node.then : null;
      expect(thenSeq).not.toBeNull();
      if (!thenSeq) continue;
      const firstStep = thenSeq.steps[0] as CoreFlowNode;
      expect(firstStep.kind).toBe("patch");
      if (firstStep.kind === "patch") {
        expect(firstStep.op).toBe("merge");
        expect(firstStep.path).toBe("$mel.guards.intent");
        const value = firstStep.value as CoreExprNode;
        expect(value.kind).toBe("object");
        if (value.kind === "object") {
          expect(value.fields[guardId]).toEqual({ kind: "get", path: "meta.intentId" });
        }
      }
    }

    expect(guardIds.size).toBe(2);

    const expectedFirst = sha256Sync("inc:0:intent");
    const expectedSecond = sha256Sync("inc:1:intent");
    expect(guardIds).toEqual(new Set([expectedFirst, expectedSecond]));
  });
});
