import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileMelDomain } from "../api/compile-mel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../..");

const EXAMPLE_FILES = [
  "docs/mel/examples/computed/bounded-sugar.mel",
  "docs/mel/examples/computed/selection-sugar.mel",
] as const;

describe("docs MEL examples", () => {
  for (const relativePath of EXAMPLE_FILES) {
    it(`compiles ${relativePath}`, () => {
      const fullPath = path.join(REPO_ROOT, relativePath);
      const source = readFileSync(fullPath, "utf8");
      const result = compileMelDomain(source, { mode: "domain" });

      expect(result.errors).toEqual([]);
      expect(result.schema).not.toBeNull();
    });
  }
});
