/**
 * Strip Host-owned namespace from snapshot data for assertions
 */
export function stripHostState(
  data: Record<string, unknown>
): Record<string, unknown> {
  const { $host: _host, ...rest } = data;
  return rest;
}
