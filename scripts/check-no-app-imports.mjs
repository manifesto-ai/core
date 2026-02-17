#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DISALLOWED = '@manifesto-ai/app';

const SKIP_DIRS = new Set([
  '.git',
  '.turbo',
  'coverage',
  'dist',
  'node_modules',
]);

const SCAN_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mdx',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const LEGACY_ALLOWLIST = [
  /^CHANGELOG\.md$/,
  /^packages\/[^/]+(?:\/[^/]+)?\/CHANGELOG\.md$/,
  /^archives\//,
  /^docs\/api\/app\.md$/,
  /^docs\/guides\/migrate-app-to-sdk\.md$/,
  /^docs\/internals\/adr\//,
  /^docs\/internals\/fdr\//,
  /^packages\/[^/]+(?:\/[^/]+)?\/docs\//,
  /^scripts\/check-no-app-imports\.mjs$/,
  /^scripts\/migrate\/app-to-sdk\.mjs$/,
  /^scripts\/release\/README\.md$/,
  /^skills\//,
];

function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function isLegacyPath(relativePath) {
  return LEGACY_ALLOWLIST.some((pattern) => pattern.test(relativePath));
}

function isScannableFile(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  return SCAN_EXTENSIONS.has(ext);
}

function collectFiles(startDir) {
  const stack = [startDir];
  const files = [];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = toPosixPath(path.relative(ROOT, absolutePath));

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          continue;
        }
        stack.push(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!isScannableFile(relativePath)) {
        continue;
      }

      if (isLegacyPath(relativePath)) {
        continue;
      }

      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

function findViolations() {
  const violations = [];
  const files = collectFiles(ROOT);

  for (const file of files) {
    const content = fs.readFileSync(file.absolutePath, 'utf-8');
    if (!content.includes(DISALLOWED)) {
      continue;
    }

    const lines = content.split(/\r?\n/u);
    lines.forEach((line, index) => {
      if (!line.includes(DISALLOWED)) {
        return;
      }

      violations.push({
        path: file.relativePath,
        line: index + 1,
        snippet: line.trim(),
      });
    });
  }

  return violations;
}

const violations = findViolations();

if (violations.length > 0) {
  console.error('Found forbidden @manifesto-ai/app references in active paths:');
  for (const violation of violations) {
    console.error(`- ${violation.path}:${violation.line} ${violation.snippet}`);
  }
  process.exit(1);
}

console.log('No forbidden @manifesto-ai/app references found in active paths.');
