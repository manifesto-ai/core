import { describe, expect, it } from "vitest";

import { compileFragmentInContext } from "../api/index.js";
import { collectTargetReferences } from "../api/compile-fragment-reference-collector.js";
import { tokenize } from "../lexer/index.js";
import { parse, type ProgramNode } from "../parser/index.js";

const INDEX_SHADOW_SOURCE = `
domain Demo {
  state {
    count: number = 0
    items: Array<number> = [0, 1]
  }

  action write(count: number) {
    when true {
      patch items[count] = count
    }
  }
}
`;

const FLOW_PARAM_SHADOW_SOURCE = `
domain Demo {
  state {
    count: number = 0
    items: Array<number> = [0, 1]
  }

  flow helper(count: number) {
    when true {
      patch items[count] = count
    }
  }
}
`;

function parseProgram(source: string): ProgramNode {
  const result = parse(tokenize(source).tokens);
  expect(result.diagnostics).toHaveLength(0);
  expect(result.program).toBeDefined();
  return result.program!;
}

describe("compileFragmentInContext reference shadowing", () => {
  it("does not rewrite action parameter reads in patch path indexes during state rename", () => {
    const result = compileFragmentInContext(INDEX_SHADOW_SOURCE, {
      kind: "renameDeclaration",
      target: "state_field:count",
      newName: "total",
    });

    expect(result.ok).toBe(true);
    expect(result.newSource).toContain("total: number = 0");
    expect(result.newSource).toContain("action write(count: number)");
    expect(result.newSource).toContain("patch items[count] = count");
    expect(result.newSource).not.toContain("items[total]");
  });

  it("does not block state removal on action parameter reads in patch path indexes", () => {
    const result = compileFragmentInContext(INDEX_SHADOW_SOURCE, {
      kind: "removeDeclaration",
      target: "state_field:count",
    }, { includeSchemaDiff: true });

    expect(result.ok).toBe(true);
    expect(result.newSource).not.toContain("count: number = 0");
    expect(result.newSource).toContain("action write(count: number)");
    expect(result.newSource).toContain("patch items[count] = count");
    expect(result.schemaDiff?.removedTargets).toContain("state_field:count");
  });

  it("does not collect flow parameter reads as state references", () => {
    const refs = collectTargetReferences(
      FLOW_PARAM_SHADOW_SOURCE,
      parseProgram(FLOW_PARAM_SHADOW_SOURCE),
      { kind: "state_field", name: "count" },
    );

    expect(refs).toEqual([]);
  });
});
