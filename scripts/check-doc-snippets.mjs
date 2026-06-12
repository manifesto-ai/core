#!/usr/bin/env node
/**
 * Executes the canonical user-facing doc examples against the built
 * workspace packages (#483-adjacent).
 *
 * The docs governance checks catch retired terminology, but nothing
 * verified that the code a new user copies actually runs. This script
 * extracts the MEL domain + runtime TypeScript pair from each checked
 * document, compiles the MEL with @manifesto-ai/compiler, executes the
 * runtime snippet against @manifesto-ai/sdk, and compares every
 * `console.log(...) // <expected>` line against the documented value.
 *
 * Requires built dist output (run after `pnpm build`, as test:hardening
 * and docs:release:check do).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPILER_DIST = path.join(ROOT, "packages", "compiler", "dist", "index.js");
const SDK_DIST = path.join(ROOT, "packages", "sdk", "dist", "index.js");

const CHECKED_DOCS = [
  "README.md",
  "docs/guide/quick-start.md",
];

function fail(message) {
  console.error(`doc-snippet check failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(COMPILER_DIST) || !fs.existsSync(SDK_DIST)) {
  fail("built dist output missing — run `pnpm build` first");
}

const { compileMelDomain } = await import(pathToFileURL(COMPILER_DIST));

function extractBlocks(markdown) {
  const blocks = [];
  const fence = /```(\w+)?\n([\s\S]*?)```/g;
  for (const match of markdown.matchAll(fence)) {
    blocks.push({ lang: match[1] ?? "", code: match[2] });
  }
  return blocks;
}

function findSnippetPair(blocks, docPath) {
  const mel = blocks.find((b) => b.lang === "mel");
  const runtime = blocks.find(
    (b) =>
      (b.lang === "typescript" || b.lang === "ts")
      && b.code.includes("createManifesto")
      && b.code.includes("./counter.mel"),
  );
  if (!mel) fail(`${docPath}: no \`\`\`mel block found`);
  if (!runtime) fail(`${docPath}: no runtime typescript block importing ./counter.mel found`);
  return { mel: mel.code, runtime: runtime.code };
}

function expectedLogs(runtimeCode) {
  const expected = [];
  for (const line of runtimeCode.split("\n")) {
    const match = line.match(/console\.log\(.*\);?\s*\/\/\s*(.+)$/);
    if (match) {
      expected.push(match[1].trim());
    }
  }
  return expected;
}

function toExecutableModule(runtimeCode, schema) {
  const lines = runtimeCode
    .split("\n")
    .filter((line) => !line.includes("./counter.mel"))
    .map((line) =>
      line.replace(
        /from\s+["']@manifesto-ai\/sdk["']/,
        `from ${JSON.stringify(pathToFileURL(SDK_DIST).href)}`,
      ),
    );
  return [
    `const CounterMel = ${JSON.stringify(schema)};`,
    ...lines,
  ].join("\n");
}

let checked = 0;

for (const docPath of CHECKED_DOCS) {
  const markdown = fs.readFileSync(path.join(ROOT, docPath), "utf-8");
  const { mel, runtime } = findSnippetPair(extractBlocks(markdown), docPath);

  const compiled = compileMelDomain(mel);
  if (compiled.errors.length > 0) {
    fail(`${docPath}: documented MEL does not compile: ${compiled.errors[0]?.message}`);
  }

  const expected = expectedLogs(runtime);
  if (expected.length === 0) {
    fail(`${docPath}: runtime snippet has no \`console.log(...) // expected\` assertions`);
  }

  const moduleSource = toExecutableModule(runtime, compiled.schema);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifesto-doc-snippet-"));
  const modulePath = path.join(tempDir, "snippet.mjs");
  fs.writeFileSync(modulePath, moduleSource);

  const result = spawnSync(process.execPath, [modulePath], { encoding: "utf-8" });
  fs.rmSync(tempDir, { recursive: true, force: true });

  if (result.status !== 0) {
    fail(`${docPath}: documented runtime snippet exited ${result.status}:\n${result.stderr}`);
  }

  const actual = result.stdout.trim().split("\n").map((line) => line.trim());
  expected.forEach((value, index) => {
    if (actual[index] !== value) {
      fail(
        `${docPath}: documented output mismatch at log #${index + 1}: `
        + `docs say "${value}", snippet printed "${actual[index] ?? "<nothing>"}"`,
      );
    }
  });

  checked += 1;
  console.log(`✓ ${docPath}: MEL compiles, snippet runs, output matches docs (${expected.length} assertions)`);
}

console.log(`Doc snippets OK (${checked} documents executed against built packages).`);
