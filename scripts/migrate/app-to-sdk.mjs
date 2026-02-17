#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const shouldWrite = args.includes('--write');
const allowUnsafe = args.includes('--allow-unsafe');
const dryRun = !shouldWrite;

const positional = args.filter((arg) => !arg.startsWith('--'));
const roots = (positional.length > 0 ? positional : ['.']).map((p) => resolve(process.cwd(), p));

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.turbo']);
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.jsx', '.json', '.md', '.yaml', '.yml']);

const SOURCE = '@manifesto-ai/app';
const TARGET = '@manifesto-ai/sdk';
const SDK_INDEX = resolve(process.cwd(), 'packages/sdk/src/index.ts');

const changed = [];
const skippedUnsafe = [];

function parseExportList(specList) {
  return specList
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((entry) => {
      const clean = entry.replace(/^type\s+/, '').trim();
      if (clean.includes(' as ')) {
        const parts = clean.split(/\s+as\s+/);
        return parts[parts.length - 1].trim();
      }
      return clean;
    });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadSdkExports() {
  const exports = new Set();
  let source = '';
  try {
    source = readFileSync(SDK_INDEX, 'utf8');
  } catch {
    return exports;
  }

  const reExportBlock = /export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"][^'"]+['"]/g;
  for (const match of source.matchAll(reExportBlock)) {
    for (const name of parseExportList(match[1])) exports.add(name);
  }

  const directExport = /export\s+(?:class|function|const|let|var|type|interface|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  for (const match of source.matchAll(directExport)) {
    exports.add(match[1]);
  }

  return exports;
}

const sdkExports = loadSdkExports();

function collectAppImportSymbols(content) {
  const symbols = new Set();
  const unresolvedNamespaceAliases = [];

  const appImportStatements = /import[\s\S]*?from\s*["']@manifesto-ai\/app["'];?/g;
  for (const statement of content.match(appImportStatements) ?? []) {
    const trimmed = statement.trim();

    const namespaceImport = trimmed.match(/import\s+\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from/);
    if (namespaceImport) {
      const { usedSymbols, hasMemberAccess } = collectAliasMemberUsage(content, namespaceImport[1]);
      for (const symbol of usedSymbols) symbols.add(symbol);
      if (!hasMemberAccess) unresolvedNamespaceAliases.push(namespaceImport[1]);
      continue;
    }

    if (!trimmed.startsWith('import type')) {
      const defaultImport = trimmed.match(/import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:,|\s+from)/);
      if (defaultImport) {
        const { usedSymbols, hasMemberAccess } = collectAliasMemberUsage(content, defaultImport[1]);
        for (const symbol of usedSymbols) symbols.add(symbol);
        if (!hasMemberAccess) unresolvedNamespaceAliases.push(defaultImport[1]);
      }
    }

    const named = statement.match(/\{([\s\S]*?)\}/);
    if (!named) continue;
    for (const name of parseExportList(named[1])) symbols.add(name);
  }

  const destructuredRequire = /(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*require\(\s*["']@manifesto-ai\/app["']\s*\)/g;
  for (const match of content.matchAll(destructuredRequire)) {
    for (const name of parseExportList(match[1])) symbols.add(name);
  }

  const namespaceRequire = /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*require\(\s*["']@manifesto-ai\/app["']\s*\)/g;
  for (const match of content.matchAll(namespaceRequire)) {
    const alias = match[1];
    const { usedSymbols, hasMemberAccess } = collectAliasMemberUsage(content, alias);
    for (const symbol of usedSymbols) symbols.add(symbol);
    if (!hasMemberAccess) unresolvedNamespaceAliases.push(alias);
  }

  return {
    symbols,
    unresolvedNamespaceAliases,
  };
}

function findUnsupportedSymbols(importedSymbols) {
  if (sdkExports.size === 0) return [];
  return [...importedSymbols].filter((symbol) => !sdkExports.has(symbol));
}

function collectAliasMemberUsage(content, alias) {
  const usedSymbols = new Set();
  const escapedAlias = escapeRegExp(alias);
  let hasMemberAccess = false;

  const dotAccess = new RegExp(`\\b${escapedAlias}\\s*\\.\\s*([A-Za-z_$][A-Za-z0-9_$]*)`, 'g');
  for (const match of content.matchAll(dotAccess)) {
    usedSymbols.add(match[1]);
    hasMemberAccess = true;
  }

  const bracketAccess = new RegExp(`\\b${escapedAlias}\\s*\\[\\s*["']([A-Za-z_$][A-Za-z0-9_$]*)["']\\s*\\]`, 'g');
  for (const match of content.matchAll(bracketAccess)) {
    usedSymbols.add(match[1]);
    hasMemberAccess = true;
  }

  return { usedSymbols, hasMemberAccess };
}

function hasAllowedExt(path) {
  const idx = path.lastIndexOf('.');
  if (idx === -1) return false;
  return TEXT_EXT.has(path.slice(idx));
}

function walk(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    const name = basename(path);
    if (name && SKIP_DIRS.has(name)) return;
    for (const entry of readdirSync(path)) walk(join(path, entry));
    return;
  }

  if (!hasAllowedExt(path)) return;

  const original = readFileSync(path, 'utf8');
  if (!original.includes(SOURCE)) return;

  if (!allowUnsafe) {
    const imported = collectAppImportSymbols(original);
    const unsupported = findUnsupportedSymbols(imported.symbols);
    const unresolvedAliases = imported.unresolvedNamespaceAliases.map(
      (alias) => `namespace/default alias "${alias}" (no member access detected)`,
    );
    const reasons = [...unsupported, ...unresolvedAliases];

    if (reasons.length > 0) {
      skippedUnsafe.push({ path, symbols: reasons });
      return;
    }
  }

  const next = original.split(SOURCE).join(TARGET);
  if (next === original) return;

  if (shouldWrite) writeFileSync(path, next);
  changed.push(path);
}

for (const root of roots) walk(root);

if (changed.length === 0 && skippedUnsafe.length === 0) {
  console.log('No @manifesto-ai/app references found.');
  process.exit(0);
}

if (changed.length > 0) {
  console.log(`${dryRun ? '[dry-run]' : '[write]'} ${changed.length} file(s) will be updated:`);
  for (const file of changed) {
    console.log(`- ${relative(process.cwd(), file)}`);
  }
}

if (dryRun) {
  console.log('Run again with --write to apply changes.');
}

if (skippedUnsafe.length > 0) {
  console.warn('');
  console.warn(`Skipped ${skippedUnsafe.length} file(s) due to app-only imports that are not exported by SDK:`);
  for (const entry of skippedUnsafe) {
    console.warn(`- ${relative(process.cwd(), entry.path)} (${entry.symbols.join(', ')})`);
  }
  console.warn('Update those imports manually, then rerun migration.');
  console.warn('If you still want raw path replacement, rerun with --allow-unsafe.');
  process.exitCode = 1;
}
