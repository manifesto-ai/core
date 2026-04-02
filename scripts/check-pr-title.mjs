#!/usr/bin/env node

const ALLOWED_TYPES = new Set([
  'build',
  'chore',
  'ci',
  'deps',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
]);

const HEADER_PATTERN =
  /^(?<type>[a-z]+)(?:\((?<scope>[^()\r\n]+)\))?(?<breaking>!)?: (?<description>\S.*)$/u;

const title = process.argv[2] ?? process.env.GITHUB_PR_TITLE;

if (!title) {
  console.error('Pull request title check failed: no title provided.');
  process.exit(1);
}

const match = HEADER_PATTERN.exec(title);

if (!match?.groups) {
  console.error(`Pull request title check failed: ${title}`);
  console.error(
    'Use Conventional Commit format `type(scope): summary` or `type: summary` for PR titles.',
  );
  process.exit(1);
}

if (!ALLOWED_TYPES.has(match.groups.type)) {
  console.error(`Pull request title check failed: unsupported type \`${match.groups.type}\`.`);
  process.exit(1);
}

console.log(`Pull request title check passed: ${title}`);
