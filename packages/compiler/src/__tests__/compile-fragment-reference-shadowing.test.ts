import { describe, expect, it } from "vitest";

import { compileFragmentInContext } from "../api/index.js";

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
});
