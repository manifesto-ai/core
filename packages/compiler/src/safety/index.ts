/**
 * Safety Module - HITL Gate and Allowlist Enforcement
 *
 * This module provides safety gating mechanisms for the compiler:
 * - HITL Gate: Human-in-the-loop approval for high-risk effects
 * - Allowlist Validator: Endpoint and effect type restrictions
 *
 * Implements PRD 6.9 safety requirements.
 */

// HITL Gate
export {
  HITLGate,
  createHITLGate,
  checkFragmentsForHITL,
  generateHITLIssues,
  compareRiskLevels,
  isRiskAtLeast,
} from './hitl-gate.js';

// Allowlist Validator
export {
  validateAllowlist,
  generateAllowlistIssues,
  hasAllowlistViolations,
  type AllowlistViolation,
} from './allowlist-validator.js';
