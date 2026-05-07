import { describe, expect, it } from "vitest";
import * as compiler from "../index.js";

describe("@manifesto-ai/compiler public root exports", () => {
  it("does not expose retired runtime patch evaluation or lowering helpers", () => {
    const retiredValueExports = [
      "compileMelPatch",
      "createEvaluationContext",
      "evaluateExpr",
      "evaluateConditionalPatchOps",
      "evaluateRuntimePatches",
      "evaluateRuntimePatchesWithTrace",
      "lowerRuntimePatch",
      "lowerRuntimePatches",
    ] as const;

    for (const symbol of retiredValueExports) {
      expect(symbol in compiler, `${symbol} must stay off the public root surface`).toBe(false);
    }
  });
});
