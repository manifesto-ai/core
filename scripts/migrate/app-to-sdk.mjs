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

function parseSpecList(specList, mode) {
  // Remove inline/block comments to avoid polluting symbol names.
  const withoutBlockComments = specList.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutLineComments = withoutBlockComments.replace(/\/\/.*$/gm, '');

  return withoutLineComments
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((entry) => {
      const clean = entry.replace(/^type\s+/, '').trim();
      if (clean.includes(' as ')) {
        const parts = clean.split(/\s+as\s+/);
        if (mode === 'imported') return parts[0].trim();
        return parts[parts.length - 1].trim();
      }
      if (clean.includes(':')) {
        const parts = clean.split(/\s*:\s*/);
        if (mode === 'imported') return parts[0].trim();
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
    return { exports, loaded: false };
  }

  const reExportBlock = /export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"][^'"]+['"]/g;
  for (const match of source.matchAll(reExportBlock)) {
    for (const name of parseSpecList(match[1], 'exposed')) exports.add(name);
  }

  const directExport = /export\s+(?:class|function|const|let|var|type|interface|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  for (const match of source.matchAll(directExport)) {
    exports.add(match[1]);
  }

  return { exports, loaded: true };
}

const loadedSdkExports = loadSdkExports();
const sdkExports = loadedSdkExports.exports;
const sdkExportsLoaded = loadedSdkExports.loaded;

function collectAppImportSymbols(content) {
  const symbols = new Set();
  const unresolvedNamespaceAliases = [];

  const namedOnlyImport = /^\s*import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']@manifesto-ai\/app["']\s*;?/gm;
  for (const match of content.matchAll(namedOnlyImport)) {
    for (const name of parseSpecList(match[1], 'imported')) symbols.add(name);
  }

  const defaultAndNamedImport = /^\s*import\s+(?:type\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*,\s*\{([^}]*)\}\s*from\s*["']@manifesto-ai\/app["']\s*;?/gm;
  for (const match of content.matchAll(defaultAndNamedImport)) {
    const alias = match[1];
    const { usedSymbols, hasMemberAccess } = collectAliasMemberUsage(content, alias);
    for (const symbol of usedSymbols) symbols.add(symbol);
    if (!hasMemberAccess) unresolvedNamespaceAliases.push(alias);
    for (const name of parseSpecList(match[2], 'imported')) symbols.add(name);
  }

  const namespaceImport = /^\s*import\s+\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s*["']@manifesto-ai\/app["']\s*;?/gm;
  for (const match of content.matchAll(namespaceImport)) {
    const alias = match[1];
    const { usedSymbols, hasMemberAccess } = collectAliasMemberUsage(content, alias);
    for (const symbol of usedSymbols) symbols.add(symbol);
    if (!hasMemberAccess) unresolvedNamespaceAliases.push(alias);
  }

  const defaultAndNamespaceImport = /^\s*import\s+(?:type\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*,\s*\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s*["']@manifesto-ai\/app["']\s*;?/gm;
  for (const match of content.matchAll(defaultAndNamespaceImport)) {
    for (const alias of [match[1], match[2]]) {
      const { usedSymbols, hasMemberAccess } = collectAliasMemberUsage(content, alias);
      for (const symbol of usedSymbols) symbols.add(symbol);
      if (!hasMemberAccess) unresolvedNamespaceAliases.push(alias);
    }
  }

  const defaultImport = /^\s*import\s+(?:type\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s*["']@manifesto-ai\/app["']\s*;?/gm;
  for (const match of content.matchAll(defaultImport)) {
    const alias = match[1];
    const { usedSymbols, hasMemberAccess } = collectAliasMemberUsage(content, alias);
    for (const symbol of usedSymbols) symbols.add(symbol);
    if (!hasMemberAccess) unresolvedNamespaceAliases.push(alias);
  }

  const destructuredRequire = /(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*require\(\s*["']@manifesto-ai\/app["']\s*\)/g;
  for (const match of content.matchAll(destructuredRequire)) {
    for (const name of parseSpecList(match[1], 'imported')) symbols.add(name);
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
    if (!sdkExportsLoaded) {
      skippedUnsafe.push({
        path,
        symbols: [`SDK export index not found at ${relative(process.cwd(), SDK_INDEX) || SDK_INDEX}`],
      });
      return;
    }

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
