import type { IntentScope } from "./types.js";

/**
 * Approved-scope enforcement (#477).
 *
 * `IntentScope.allowedPaths` entries are domain-state-rooted dot paths.
 * A trailing `.*` segment allows the whole subtree ("todos.*"), a bare "*"
 * allows everything, and a plain path allows that path and its subtree
 * ("todos" allows "todos.abc.title").
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function joinPath(base: string, segment: string): string {
  return base.length === 0 ? segment : `${base}.${segment}`;
}

function collectInto(before: unknown, after: unknown, path: string, out: Set<string>): void {
  if (Object.is(before, after)) {
    return;
  }

  const beforeIsRecord = isRecord(before);
  const afterIsRecord = isRecord(after);

  if (beforeIsRecord && afterIsRecord) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      collectInto(before[key], after[key], joinPath(path, key), out);
    }
    return;
  }

  const beforeIsArray = Array.isArray(before);
  const afterIsArray = Array.isArray(after);
  if (beforeIsArray && afterIsArray) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      collectInto(before[index], after[index], joinPath(path, String(index)), out);
    }
    return;
  }

  if (path.length > 0 && JSON.stringify(before) !== JSON.stringify(after)) {
    out.add(path);
  }
}

/**
 * Collect dot paths of leaf-level differences between two domain states.
 */
export function collectChangedStatePaths(before: unknown, after: unknown): readonly string[] {
  const out = new Set<string>();
  collectInto(before, after, "", out);
  return Object.freeze([...out].sort());
}

export function isPathAllowed(path: string, allowedPaths: readonly string[]): boolean {
  for (const allowed of allowedPaths) {
    if (allowed === "*") {
      return true;
    }

    const prefix = allowed.endsWith(".*") ? allowed.slice(0, -2) : allowed;
    if (path === prefix || path.startsWith(`${prefix}.`)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the changed paths that fall outside the approved scope. An empty
 * result means the settlement stayed within what the authority approved.
 */
export function findScopeViolations(
  changedPaths: readonly string[],
  scope: IntentScope | null | undefined,
): readonly string[] {
  const allowedPaths = scope?.allowedPaths;
  if (!allowedPaths || allowedPaths.length === 0) {
    return Object.freeze([]);
  }

  return Object.freeze(changedPaths.filter((path) => !isPathAllowed(path, allowedPaths)));
}

/**
 * Narrow the persisted (unknown-typed) approvedScope back to IntentScope.
 */
export function toIntentScope(value: unknown): IntentScope | null {
  if (!isRecord(value)) {
    return null;
  }

  const allowedPaths = value.allowedPaths;
  if (allowedPaths === undefined) {
    return value as IntentScope;
  }

  if (Array.isArray(allowedPaths) && allowedPaths.every((entry) => typeof entry === "string")) {
    return value as IntentScope;
  }

  return null;
}
