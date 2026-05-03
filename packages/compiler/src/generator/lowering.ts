/**
 * System Value Lowering
 *
 * v5 keeps Core independent from MEL-owned storage. The previous lowering
 * strategy used MEL namespace slots as runtime bookkeeping, which made Core
 * and Host paths depend on MEL-specific shape. Until a replacement ADR defines
 * an owner-neutral async system-value protocol, this compatibility hook leaves
 * schemas unchanged and relies on Core's deterministic $system expression
 * evaluation.
 */

import type { DomainSchema } from "./ir.js";

export function lowerSystemValues(schema: DomainSchema): DomainSchema {
  return schema;
}
