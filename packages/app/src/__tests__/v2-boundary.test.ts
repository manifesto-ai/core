/**
 * v2 Boundary Compliance Tests
 *
 * @see APP-SPEC-v2.0.0 §4.4 Boundary Rules
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, "..");

type Violation = {
  ruleId: string;
  file: string;
  importPath: string;
};

const IMPORT_RE = /from\\s+["']([^"']+)["']|require\\(["']([^"']+)["']\\)/g;

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "dist") {
        continue;
      }
      files.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractImports(text: string): string[] {
  const imports: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = IMPORT_RE.exec(text)) !== null) {
    const value = match[1] ?? match[2];
    if (value) {
      imports.push(value);
    }
  }
  return imports;
}

function findViolations(prefix: string, ruleId: string): Violation[] {
  const files = collectSourceFiles(SOURCE_DIR);
  const violations: Violation[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const imports = extractImports(content);
    for (const importPath of imports) {
      if (importPath.startsWith(prefix)) {
        violations.push({ ruleId, file, importPath });
      }
    }
  }

  return violations;
}

describe("Boundary Rules (v2)", () => {
  it("APP-BOUNDARY-1: App must not import Core internals", () => {
    const violations = findViolations("@manifesto-ai/core/", "APP-BOUNDARY-1");
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("APP-BOUNDARY-2: App must not import World internals", () => {
    const violations = findViolations("@manifesto-ai/world/", "APP-BOUNDARY-2");
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it("APP-BOUNDARY-3: App must not import Host internals", () => {
    const violations = findViolations("@manifesto-ai/host/", "APP-BOUNDARY-3");
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
