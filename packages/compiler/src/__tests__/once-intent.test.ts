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
import type { CoreFlowNode } from "../generator/ir.js";

function collectCausalGuardNodes(
  flow: CoreFlowNode,
  acc: Extract<CoreFlowNode, { kind: "causalGuard" }>[] = [],
): Extract<CoreFlowNode, { kind: "causalGuard" }>[] {
  if (flow.kind === "causalGuard") {
    acc.push(flow);
    collectCausalGuardNodes(flow.body, acc);
    return acc;
  }

  if (flow.kind === "if") {
    collectCausalGuardNodes(flow.then, acc);
    if (flow.else) {
      collectCausalGuardNodes(flow.else, acc);
    }
    return acc;
  }

  if (flow.kind === "seq") {
    for (const step of flow.steps) {
      collectCausalGuardNodes(step, acc);
    }
  }

  return acc;
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
            patch onceIntent = $runtime.intent.id
          }
        }
      }
    `;

    const result = compileMelDomain(mel, { mode: "domain" });
    expect(result.errors).toHaveLength(0);
  });

  it("lowers onceIntent to Core intent guards with unique guard ids", () => {
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

    const guardNodes = collectCausalGuardNodes(flow);
    expect(guardNodes).toHaveLength(2);

    const guardIds = new Set<string>();
    for (const node of guardNodes) {
      guardIds.add(node.guardId);
      expect(node.body.kind).toBe("seq");
    }

    expect(guardIds.size).toBe(2);

    const expectedFirst = sha256Sync("inc:0:intent");
    const expectedSecond = sha256Sync("inc:1:intent");
    expect(guardIds).toEqual(new Set([expectedFirst, expectedSecond]));
  });
});
