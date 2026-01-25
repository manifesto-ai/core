/**
 * Strip Host-owned namespace from snapshot data for assertions
 */
export function stripHostState(data: unknown): Record<string, unknown> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {};
  }

  const { $host: _host, ...rest } = data as Record<string, unknown>;
  return rest;
}
