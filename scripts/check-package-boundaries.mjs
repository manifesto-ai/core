#!/usr/bin/env node
/**
 * Enforces the constitution §3 package boundary rules (CLAUDE.md, Forbidden
 * Import Matrix) and the core no-throw rule (§5.2) as a CI gate.
 *
 * Three checks over production sources in packages/*\/src:
 *  1. Cross-package imports must follow the allowed dependency matrix.
 *  2. Deep imports into another package's src/ or dist/ are forbidden.
 *  3. @manifesto-ai/core must not `throw` in business logic.
 *
 * Test files (__tests__/, *.test.ts, *.spec.ts) are exempt from the import
 * matrix so compliance suites can use @manifesto-ai/cts-kit.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Allowed @manifesto-ai/* imports per package (production src only).
const ALLOWED_IMPORTS = {
  core: [],
  host: ["@manifesto-ai/core"],
  compiler: ["@manifesto-ai/core"],
  codegen: ["@manifesto-ai/core"],
  sdk: ["@manifesto-ai/core", "@manifesto-ai/host", "@manifesto-ai/compiler"],
  lineage: ["@manifesto-ai/core", "@manifesto-ai/sdk"],
  governance: ["@manifesto-ai/core", "@manifesto-ai/sdk", "@manifesto-ai/lineage"],
};

// Temporary exemptions from the core no-throw rule. Each entry must reference
// the tracking work item; remove entries as they are fixed.
const CORE_THROW_ALLOWLIST = new Set([
  // M1 legality-channel workstream (#493): throwing query wrappers pending
  // replacement by evaluateActionAvailability / evaluateIntentDispatchability.
  "packages/core/src/core/action-availability.ts",
]);

const SKIP_DIRS = new Set([".git", ".turbo", "coverage", "dist", "node_modules"]);

const IMPORT_PATTERN = /(?:^|[^\\])["'](@manifesto-ai\/[a-z-]+)(\/[^"']*)?["']/g;
const IMPORT_LINE_PATTERN =
  /(?:\bfrom\s*["']|\bimport\s*\(\s*["']|\brequire\s*\(\s*["']|^\s*import\s+["'])/;

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function isTestPath(relativePath) {
  return relativePath.includes("/__tests__/") || /\.(test|spec)\.[cm]?tsx?$/.test(relativePath);
}

function collectSourceFiles(startDir) {
  const stack = [startDir];
  const files = [];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/\.[cm]?tsx?$/.test(entry.name)) continue;
      files.push({ abs, rel: toPosix(path.relative(ROOT, abs)) });
    }
  }
  return files;
}

function checkImportMatrix() {
  const violations = [];
  for (const [pkg, allowed] of Object.entries(ALLOWED_IMPORTS)) {
    const srcDir = path.join(ROOT, "packages", pkg, "src");
    for (const file of collectSourceFiles(srcDir)) {
      if (isTestPath(file.rel)) continue;
      const lines = fs.readFileSync(file.abs, "utf-8").split(/\r?\n/u);
      lines.forEach((line, index) => {
        if (!IMPORT_LINE_PATTERN.test(line) && !line.includes("} from")) return;
        for (const match of line.matchAll(IMPORT_PATTERN)) {
          const target = match[1];
          const subpath = match[2] ?? "";
          if (target === `@manifesto-ai/${pkg}`) continue;
          if (!allowed.includes(target)) {
            violations.push({
              path: file.rel,
              line: index + 1,
              message: `${pkg} must not import ${target}`,
              snippet: line.trim(),
            });
            continue;
          }
          if (/^\/(src|dist)(\/|$)/.test(subpath)) {
            violations.push({
              path: file.rel,
              line: index + 1,
              message: `deep import into ${target}${subpath} is forbidden`,
              snippet: line.trim(),
            });
          }
        }
      });
    }
  }
  return violations;
}

function checkCoreNoThrow() {
  const violations = [];
  const srcDir = path.join(ROOT, "packages", "core", "src");
  for (const file of collectSourceFiles(srcDir)) {
    if (isTestPath(file.rel)) continue;
    if (CORE_THROW_ALLOWLIST.has(file.rel)) continue;
    const lines = fs.readFileSync(file.abs, "utf-8").split(/\r?\n/u);
    lines.forEach((line, index) => {
      const code = line.replace(/\/\/.*$/u, "");
      if (/\bthrow\b/.test(code) && !/^\s*\*/.test(line)) {
        violations.push({
          path: file.rel,
          line: index + 1,
          message: "core must not throw (errors are values, constitution §5.2)",
          snippet: line.trim(),
        });
      }
    });
  }
  return violations;
}

const violations = [...checkImportMatrix(), ...checkCoreNoThrow()];

if (violations.length > 0) {
  console.error("Package boundary violations found:");
  for (const v of violations) {
    console.error(`- ${v.path}:${v.line} ${v.message}`);
    console.error(`    ${v.snippet}`);
  }
  process.exit(1);
}

console.log("Package boundaries OK (constitution §3 matrix + core no-throw).");
