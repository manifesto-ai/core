/**
 * Retired System Value Lowering Compatibility Hook
 *
 * v5 keeps Core independent from MEL-owned storage. The previous lowering
 * strategy used MEL namespace slots as runtime bookkeeping, which made Core
 * and Host paths depend on MEL-specific shape. Current v5 MEL rejects
 * `$system.*` and `$meta.*`; this compatibility hook remains a no-op for
 * older callers that still pass the option.
 */

import type { DomainSchema } from "./ir.js";

export function lowerSystemValues(schema: DomainSchema): DomainSchema {
  return schema;
}
