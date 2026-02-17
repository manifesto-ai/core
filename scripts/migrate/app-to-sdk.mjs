#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const shouldWrite = args.includes('--write');
const dryRun = !shouldWrite;

const positional = args.filter((arg) => !arg.startsWith('--'));
const roots = (positional.length > 0 ? positional : ['.']).map((p) => resolve(process.cwd(), p));

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.turbo']);
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.json', '.md', '.yaml', '.yml']);

const SOURCE = '@manifesto-ai/app';
const TARGET = '@manifesto-ai/sdk';

const changed = [];

function hasAllowedExt(path) {
  const idx = path.lastIndexOf('.');
  if (idx === -1) return false;
  return TEXT_EXT.has(path.slice(idx));
}

function walk(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    const name = path.split('/').pop();
    if (name && SKIP_DIRS.has(name)) return;
    for (const entry of readdirSync(path)) walk(join(path, entry));
    return;
  }

  if (!hasAllowedExt(path)) return;

  const original = readFileSync(path, 'utf8');
  if (!original.includes(SOURCE)) return;

  const next = original.split(SOURCE).join(TARGET);
  if (next === original) return;

  if (shouldWrite) writeFileSync(path, next);
  changed.push(path);
}

for (const root of roots) walk(root);

if (changed.length === 0) {
  console.log('No @manifesto-ai/app references found.');
  process.exit(0);
}

console.log(`${dryRun ? '[dry-run]' : '[write]'} ${changed.length} file(s) will be updated:`);
for (const file of changed) {
  console.log(`- ${relative(process.cwd(), file)}`);
}

if (dryRun) {
  console.log('Run again with --write to apply changes.');
}
