#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const normalizerPath = path.join(
  repoRoot,
  "packages/compiler/src/generator/normalizer.ts"
);
const grammarPath = path.join(
  repoRoot,
  "docs/.vitepress/languages/mel.tmLanguage.json"
);

const normalizerSource = fs.readFileSync(normalizerPath, "utf-8");
const switchIndex = normalizerSource.indexOf("switch (name)");
if (switchIndex === -1) {
  console.error("Could not find switch (name) in normalizer.");
  process.exit(1);
}

const defaultIndex = normalizerSource.indexOf("default:", switchIndex);
if (defaultIndex === -1) {
  console.error("Could not find default: in normalizer switch.");
  process.exit(1);
}

const switchBody = normalizerSource.slice(switchIndex, defaultIndex);
const caseRegex = /case\s+"([^"]+)"/g;
const builtinSet = new Set();
let match;

while ((match = caseRegex.exec(switchBody)) !== null) {
  builtinSet.add(match[1]);
}

if (builtinSet.size === 0) {
  console.error("No builtin functions found in normalizer.");
  process.exit(1);
}

const builtinList = [...builtinSet].sort((a, b) => a.localeCompare(b));
const escapeRegex = (value) => value.replace(/[\\^$.*+?()[\\]{}|]/g, "\\\\$&");
const builtinPattern = `\\b(?:${builtinList.map(escapeRegex).join("|")})\\b(?=\\s*\\()`;

const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf-8"));
if (!grammar.repository || !grammar.repository.builtins) {
  console.error("Builtins section not found in MEL grammar.");
  process.exit(1);
}

grammar.repository.builtins.match = builtinPattern;
fs.writeFileSync(grammarPath, `${JSON.stringify(grammar, null, 2)}\n`, "utf-8");

console.log(
  `Updated MEL builtins (${builtinList.length}) in ${path.relative(repoRoot, grammarPath)}`
);
