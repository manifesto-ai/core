import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileMelDomain } from "../api/compile-mel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../..");

function collectMelExamples(relativeDir: string): readonly string[] {
  const absoluteDir = path.join(REPO_ROOT, relativeDir);
  return readdirSync(absoluteDir, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.posix.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        return [...collectMelExamples(relativePath)];
      }
      return entry.isFile() && entry.name.endsWith(".mel") ? [relativePath] : [];
    })
    .sort();
}

const EXAMPLE_FILES = collectMelExamples("docs/mel/examples");

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
