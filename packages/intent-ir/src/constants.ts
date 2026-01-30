/**
 * @fileoverview Intent IR Constants
 *
 * Canonical orderings and constant values.
 */

import type { Role, Force, EventClass } from "./schema/index.js";
import {
  ForceSchema,
  EventClassSchema,
  RoleSchema,
} from "./schema/index.js";

/**
 * Canonical role ordering for display/pretty-print.
 *
 * NOTE: This is for display only. Canonical serialization uses
 * RFC 8785 lexicographic order per FDR-INT-CAN-003.
 */
export const ROLE_ORDER: readonly Role[] = [
  "TARGET",
  "THEME",
  "SOURCE",
  "DEST",
  "INSTRUMENT",
  "BENEFICIARY",
] as const;

/**
 * All valid Force values.
 */
export const FORCE_VALUES = ForceSchema.options;

/**
 * All valid EventClass values.
 */
export const EVENT_CLASS_VALUES = EventClassSchema.options;

/**
 * All valid Role values.
 */
export const ROLE_VALUES = RoleSchema.options;

/**
 * Intent IR wire version.
 */
export const INTENT_IR_VERSION = "0.2" as const;
