#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

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

const RELEASABLE_TYPES = new Set([
  'deps',
  'feat',
  'fix',
  'perf',
  'revert',
]);

const HEADER_PATTERN =
  /^(?<type>[a-z]+)(?:\((?<scope>[^()\r\n]+)\))?(?<breaking>!)?: (?<description>\S.*)$/u;

function resolveRange() {
  const args = process.argv.slice(2);

  if (args.length === 1) {
    return args[0];
  }

  if (args.length === 2) {
    return `${args[0]}..${args[1]}`;
  }

  if (process.env.GITHUB_BASE_SHA && process.env.GITHUB_HEAD_SHA) {
    return `${process.env.GITHUB_BASE_SHA}..${process.env.GITHUB_HEAD_SHA}`;
  }

  return 'HEAD~1..HEAD';
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function listCommitShas(range) {
  const output = git(['rev-list', '--reverse', '--no-merges', range]);
  if (output === '') {
    return [];
  }
  return output.split('\n');
}

function readCommitSubject(sha) {
  return git(['show', '-s', '--format=%s', sha]);
}

function validateSubject(subject) {
  const match = HEADER_PATTERN.exec(subject);
  if (!match?.groups) {
    return {
      valid: false,
      reason: 'expected Conventional Commit format `type(scope): summary` or `type: summary`',
    };
  }

  if (!ALLOWED_TYPES.has(match.groups.type)) {
    return {
      valid: false,
      reason: `unsupported type \`${match.groups.type}\``,
    };
  }

  return {
    valid: true,
    type: match.groups.type,
  };
}

const range = resolveRange();
const shas = listCommitShas(range);
const failures = [];
let releasableCount = 0;

for (const sha of shas) {
  const subject = readCommitSubject(sha);
  const result = validateSubject(subject);

  if (!result.valid) {
    failures.push({ sha, subject, reason: result.reason });
    continue;
  }

  if (RELEASABLE_TYPES.has(result.type)) {
    releasableCount += 1;
  }
}

if (failures.length > 0) {
  console.error(`Commit message check failed for range ${range}.`);
  console.error(
    'Use Conventional Commits such as `feat(sdk): add provider seam` or `fix(core): preserve deterministic apply order`.',
  );

  for (const failure of failures) {
    console.error(`- ${failure.sha.slice(0, 7)} ${failure.subject}`);
    console.error(`  ${failure.reason}`);
  }

  process.exit(1);
}

console.log(`Commit message check passed for ${shas.length} commit(s) in ${range}.`);

if (releasableCount === 0) {
  console.log(
    'No releasable commits found. Release Please will not open a release PR for docs/chore/refactor/test/build/ci-only changes.',
  );
} else {
  console.log(`Found ${releasableCount} releasable commit(s) for Release Please.`);
}
