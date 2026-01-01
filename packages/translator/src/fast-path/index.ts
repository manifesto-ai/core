/**
 * Fast Path Module
 *
 * Handles common patterns without LLM calls:
 * - Comparator: User.age gte 18
 * - Range: User.age between 18 and 65
 * - Length: User.password minLen 8
 * - Inclusion: Order.status in [pending, active]
 * - Required: User.email required
 * - Boolean: User.isActive must be true
 */

export { matchFastPath } from "./matcher.js";

export {
  COMPARATOR_PATTERN,
  RANGE_PATTERN,
  LENGTH_PATTERN,
  INCLUSION_PATTERN,
  REQUIRED_PATTERN,
  BOOLEAN_PATTERN,
  ALL_PATTERNS,
  selectPatterns,
  type Pattern,
  type PatternMatchResult,
} from "./patterns.js";
