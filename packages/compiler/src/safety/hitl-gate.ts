/**
 * HITL Gate - Human-in-the-Loop Approval System
 *
 * Implements PRD 6.9: Safety gating for high-risk effects.
 *
 * CRITICAL INVARIANTS:
 * - High-risk effects MUST be approved by a human before execution
 * - No auto-approval without explicit configuration
 * - All decisions are logged with provenance
 */

import type {
  HITLConfig,
  HITLApprovalRequest,
  HITLApprovalResult,
  EffectRisk,
} from '../types/session.js';
import type { EffectFragment, ActionFragment, Fragment } from '../types/fragment.js';
import type { Issue } from '../types/issue.js';
import {
  createHITLApprovalRequest,
} from '../types/session.js';
import {
  hitlApprovalRequiredIssue,
  hitlApprovalDeniedIssue,
  hitlApprovalTimeoutIssue,
} from '../types/issue.js';
import { isEffectFragment, isActionFragment } from '../types/fragment.js';

/**
 * Risk level ordering for comparison
 */
const RISK_LEVELS: Record<EffectRisk, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Compare two risk levels
 */
export function compareRiskLevels(a: EffectRisk, b: EffectRisk): number {
  return RISK_LEVELS[a] - RISK_LEVELS[b];
}

/**
 * Check if a risk level is at least as high as another
 */
export function isRiskAtLeast(risk: EffectRisk, threshold: EffectRisk): boolean {
  return RISK_LEVELS[risk] >= RISK_LEVELS[threshold];
}

/**
 * HITL Gate - manages human-in-the-loop approval workflow
 */
export class HITLGate {
  private config: HITLConfig;
  private pendingApprovals: Map<string, HITLApprovalRequest> = new Map();
  private approvalCache: Map<string, HITLApprovalResult> = new Map();

  constructor(config: HITLConfig) {
    this.config = config;
  }

  /**
   * Check if a fragment requires HITL approval
   */
  requiresApproval(fragment: Fragment): boolean {
    if (!this.config.requireApprovalFor.length) {
      return false;
    }

    const risk = this.getFragmentRisk(fragment);
    if (!risk || risk === 'none') {
      return false;
    }

    return this.config.requireApprovalFor.some(
      (requiredRisk) => isRiskAtLeast(risk, requiredRisk)
    );
  }

  /**
   * Get the risk level from a fragment
   */
  private getFragmentRisk(fragment: Fragment): EffectRisk | undefined {
    if (isEffectFragment(fragment)) {
      return fragment.risk;
    }
    if (isActionFragment(fragment)) {
      return fragment.risk;
    }
    return undefined;
  }

  /**
   * Get the effect type from a fragment
   */
  private getEffectType(fragment: Fragment): string {
    if (isEffectFragment(fragment)) {
      return 'effect';
    }
    if (isActionFragment(fragment)) {
      return 'action';
    }
    return 'unknown';
  }

  /**
   * Generate a cache key for a fragment
   */
  private getCacheKey(fragment: Fragment): string {
    const risk = this.getFragmentRisk(fragment) ?? 'none';
    const type = this.getEffectType(fragment);
    // Create a stable key based on fragment characteristics
    return `${type}:${risk}:${fragment.id}`;
  }

  /**
   * Request approval for a fragment
   */
  async requestApproval(fragment: Fragment): Promise<HITLApprovalResult | Issue> {
    const risk = this.getFragmentRisk(fragment);
    if (!risk) {
      return { approved: true, reason: 'No risk assessment required' };
    }

    const effectType = this.getEffectType(fragment);
    const cacheKey = this.getCacheKey(fragment);

    // Check cache if enabled
    if (this.config.allowPatternCache) {
      const cached = this.approvalCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Create approval request
    const request = createHITLApprovalRequest(
      fragment.id,
      effectType,
      risk,
      this.generateDescription(fragment),
      this.generateContext(fragment)
    );

    // Store in pending
    this.pendingApprovals.set(request.id, request);

    // If no callback, return an issue requiring approval
    if (!this.config.onApprovalRequest) {
      return hitlApprovalRequiredIssue(
        fragment.id,
        effectType,
        risk,
        `Effect "${effectType}" with risk level "${risk}" requires human approval`
      );
    }

    // Request approval with optional timeout
    try {
      const result = await this.executeApprovalRequest(request);

      // Remove from pending
      this.pendingApprovals.delete(request.id);

      // Cache if requested
      if (result.cacheDecision && this.config.allowPatternCache) {
        this.approvalCache.set(cacheKey, result);
      }

      // Return issue if denied
      if (!result.approved) {
        return hitlApprovalDeniedIssue(fragment.id, effectType, result.reason);
      }

      return result;
    } catch (error) {
      this.pendingApprovals.delete(request.id);

      if (error instanceof Error && error.message === 'HITL_TIMEOUT') {
        return hitlApprovalTimeoutIssue(
          fragment.id,
          effectType,
          this.config.approvalTimeout ?? 0
        );
      }

      throw error;
    }
  }

  /**
   * Execute approval request with optional timeout
   */
  private async executeApprovalRequest(
    request: HITLApprovalRequest
  ): Promise<HITLApprovalResult> {
    if (!this.config.onApprovalRequest) {
      throw new Error('No approval callback configured');
    }

    const approvalPromise = this.config.onApprovalRequest(request);

    if (!this.config.approvalTimeout) {
      return approvalPromise;
    }

    // Race with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('HITL_TIMEOUT'));
      }, this.config.approvalTimeout);
    });

    return Promise.race([approvalPromise, timeoutPromise]);
  }

  /**
   * Generate a human-readable description for a fragment
   */
  private generateDescription(fragment: Fragment): string {
    if (isEffectFragment(fragment)) {
      return `Effect fragment "${fragment.id}" with risk level "${fragment.risk}"`;
    }
    if (isActionFragment(fragment)) {
      return `Action "${fragment.actionId}" with risk level "${fragment.risk}"`;
    }
    return `Fragment "${fragment.id}"`;
  }

  /**
   * Generate context for a fragment
   */
  private generateContext(fragment: Fragment): Record<string, unknown> {
    const context: Record<string, unknown> = {
      fragmentId: fragment.id,
      kind: fragment.kind,
    };

    if (isEffectFragment(fragment)) {
      context.risk = fragment.risk;
      context.effect = fragment.effect;
    }

    if (isActionFragment(fragment)) {
      context.actionId = fragment.actionId;
      context.risk = fragment.risk;
      context.preconditions = fragment.preconditions;
    }

    return context;
  }

  /**
   * Get all pending approval requests
   */
  getPendingApprovals(): HITLApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }

  /**
   * Clear the approval cache
   */
  clearCache(): void {
    this.approvalCache.clear();
  }

  /**
   * Get the current configuration
   */
  getConfig(): HITLConfig {
    return this.config;
  }
}

/**
 * Create a HITL gate with the given configuration
 */
export function createHITLGate(config: HITLConfig): HITLGate {
  return new HITLGate(config);
}

/**
 * Check if any fragments require HITL approval
 */
export function checkFragmentsForHITL(
  fragments: Fragment[],
  config: HITLConfig
): Fragment[] {
  const gate = new HITLGate(config);
  return fragments.filter((f) => gate.requiresApproval(f));
}

/**
 * Generate HITL issues for fragments that require approval
 */
export function generateHITLIssues(
  fragments: Fragment[],
  config: HITLConfig
): Issue[] {
  const gate = new HITLGate(config);
  const issues: Issue[] = [];

  for (const fragment of fragments) {
    if (gate.requiresApproval(fragment)) {
      const risk = isEffectFragment(fragment)
        ? fragment.risk
        : isActionFragment(fragment)
          ? fragment.risk
          : 'none';
      const effectType = isEffectFragment(fragment)
        ? 'effect'
        : isActionFragment(fragment)
          ? 'action'
          : 'unknown';

      issues.push(
        hitlApprovalRequiredIssue(
          fragment.id,
          effectType,
          risk ?? 'unknown'
        )
      );
    }
  }

  return issues;
}
