export type PathValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; reason: string };

/**
 * Validate and normalize a file path per FP-1, FP-2, GEN-6.
 *
 * - MUST be a POSIX relative path
 * - MUST NOT contain `..`, absolute prefixes, drive letters, or null bytes
 * - Normalizes backslashes, multiple slashes, and leading `./`
 */
export function validatePath(path: string): PathValidationResult {
  if (!path) {
    return { valid: false, reason: "Path must not be empty" };
  }

  if (path.includes("\0")) {
    return { valid: false, reason: "Path must not contain null bytes" };
  }

  // Normalize backslashes to forward slashes (GEN-6)
  let normalized = path.replace(/\\/g, "/");

  // Check for drive letters (e.g., C:/)
  if (/^[a-zA-Z]:/.test(normalized)) {
    return { valid: false, reason: "Path must not contain drive letters" };
  }

  // Check for absolute path
  if (normalized.startsWith("/")) {
    return { valid: false, reason: "Path must be relative, not absolute" };
  }

  // Collapse multiple slashes
  normalized = normalized.replace(/\/+/g, "/");

  // Remove leading ./
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  // Remove trailing slash
  if (normalized.endsWith("/") && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }

  // Check for .. traversal (after normalization)
  const segments = normalized.split("/");
  for (const segment of segments) {
    if (segment === "..") {
      return { valid: false, reason: "Path must not contain '..' traversal" };
    }
  }

  if (!normalized) {
    return { valid: false, reason: "Path resolves to empty after normalization" };
  }

  return { valid: true, normalized };
}
