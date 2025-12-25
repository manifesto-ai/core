/**
 * HITL Gate Tests
 *
 * Tests for the Human-in-the-Loop approval system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SemanticPath } from '@manifesto-ai/core';
import {
  HITLGate,
  createHITLGate,
  checkFragmentsForHITL,
  generateHITLIssues,
  compareRiskLevels,
  isRiskAtLeast,
} from '../../src/safety/hitl-gate.js';
import type {
  HITLConfig,
  HITLApprovalRequest,
  HITLApprovalResult,
  EffectRisk,
} from '../../src/types/session.js';
import type { Fragment, EffectFragment, ActionFragment } from '../../src/types/fragment.js';
import { generatedOrigin } from '../../src/types/provenance.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestProvenance() {
  return {
    artifactId: 'test-artifact',
    location: generatedOrigin('test'),
    createdAt: Date.now(),
  };
}

function createEffectFragment(risk: EffectRisk = 'low'): EffectFragment {
  return {
    id: `effect_${Date.now()}`,
    kind: 'EffectFragment',
    requires: [],
    provides: [],
    origin: createTestProvenance(),
    evidence: [],
    confidence: 1.0,
    compilerVersion: '0.1.0',
    effect: ['apiCall', '/api/data'],
    risk,
  } as EffectFragment;
}

function createActionFragment(risk: EffectRisk = 'low'): ActionFragment {
  return {
    id: `action_${Date.now()}`,
    kind: 'ActionFragment',
    requires: [],
    provides: [],
    origin: createTestProvenance(),
    evidence: [],
    confidence: 1.0,
    compilerVersion: '0.1.0',
    actionId: 'testAction',
    effect: ['sequence', []],
    preconditions: [],
    risk,
  } as ActionFragment;
}

function createSchemaFragment(): Fragment {
  return {
    id: `schema_${Date.now()}`,
    kind: 'SchemaFragment',
    requires: [],
    provides: ['data.test'],
    origin: createTestProvenance(),
    evidence: [],
    confidence: 1.0,
    compilerVersion: '0.1.0',
    namespace: 'data',
    fields: [],
  } as any;
}

// ============================================================================
// Risk Level Utilities
// ============================================================================

describe('compareRiskLevels', () => {
  it('should return 0 for equal risks', () => {
    expect(compareRiskLevels('low', 'low')).toBe(0);
    expect(compareRiskLevels('critical', 'critical')).toBe(0);
  });

  it('should return negative for lower risk', () => {
    expect(compareRiskLevels('low', 'high')).toBeLessThan(0);
    expect(compareRiskLevels('none', 'critical')).toBeLessThan(0);
  });

  it('should return positive for higher risk', () => {
    expect(compareRiskLevels('high', 'low')).toBeGreaterThan(0);
    expect(compareRiskLevels('critical', 'none')).toBeGreaterThan(0);
  });

  it('should order risks correctly', () => {
    const risks: EffectRisk[] = ['none', 'low', 'medium', 'high', 'critical'];
    for (let i = 0; i < risks.length - 1; i++) {
      expect(compareRiskLevels(risks[i], risks[i + 1])).toBeLessThan(0);
    }
  });
});

describe('isRiskAtLeast', () => {
  it('should return true when risk equals threshold', () => {
    expect(isRiskAtLeast('high', 'high')).toBe(true);
    expect(isRiskAtLeast('low', 'low')).toBe(true);
  });

  it('should return true when risk exceeds threshold', () => {
    expect(isRiskAtLeast('critical', 'high')).toBe(true);
    expect(isRiskAtLeast('high', 'medium')).toBe(true);
  });

  it('should return false when risk is below threshold', () => {
    expect(isRiskAtLeast('low', 'high')).toBe(false);
    expect(isRiskAtLeast('none', 'medium')).toBe(false);
  });
});

// ============================================================================
// HITLGate Class
// ============================================================================

describe('HITLGate', () => {
  describe('requiresApproval', () => {
    it('should return false when no risks are configured', () => {
      const gate = createHITLGate({ requireApprovalFor: [] });
      const fragment = createEffectFragment('critical');

      expect(gate.requiresApproval(fragment)).toBe(false);
    });

    it('should return true for matching risk level', () => {
      const gate = createHITLGate({ requireApprovalFor: ['high', 'critical'] });
      const fragment = createEffectFragment('high');

      expect(gate.requiresApproval(fragment)).toBe(true);
    });

    it('should return true for higher risk level', () => {
      const gate = createHITLGate({ requireApprovalFor: ['high'] });
      const fragment = createEffectFragment('critical');

      expect(gate.requiresApproval(fragment)).toBe(true);
    });

    it('should return false for lower risk level', () => {
      const gate = createHITLGate({ requireApprovalFor: ['high', 'critical'] });
      const fragment = createEffectFragment('low');

      expect(gate.requiresApproval(fragment)).toBe(false);
    });

    it('should return false for non-effect fragments', () => {
      const gate = createHITLGate({ requireApprovalFor: ['low'] });
      const fragment = createSchemaFragment();

      expect(gate.requiresApproval(fragment)).toBe(false);
    });

    it('should handle ActionFragments', () => {
      const gate = createHITLGate({ requireApprovalFor: ['high'] });
      const fragment = createActionFragment('high');

      expect(gate.requiresApproval(fragment)).toBe(true);
    });
  });

  describe('requestApproval', () => {
    it('should return issue when no callback is configured', async () => {
      const gate = createHITLGate({ requireApprovalFor: ['high'] });
      const fragment = createEffectFragment('high');

      const result = await gate.requestApproval(fragment);

      expect('id' in result).toBe(true);
      expect((result as any).code).toBe('HITL_APPROVAL_REQUIRED');
    });

    it('should call callback and return approved result', async () => {
      const mockCallback = vi.fn().mockResolvedValue({
        approved: true,
        approvedBy: 'test-user',
        reason: 'Looks good',
      });

      const gate = createHITLGate({
        requireApprovalFor: ['high'],
        onApprovalRequest: mockCallback,
      });

      const fragment = createEffectFragment('high');
      const result = await gate.requestApproval(fragment);

      expect(mockCallback).toHaveBeenCalled();
      expect((result as HITLApprovalResult).approved).toBe(true);
    });

    it('should return denial issue when callback rejects', async () => {
      const mockCallback = vi.fn().mockResolvedValue({
        approved: false,
        reason: 'Too risky',
      });

      const gate = createHITLGate({
        requireApprovalFor: ['high'],
        onApprovalRequest: mockCallback,
      });

      const fragment = createEffectFragment('high');
      const result = await gate.requestApproval(fragment);

      expect('id' in result).toBe(true);
      expect((result as any).code).toBe('HITL_APPROVAL_DENIED');
    });

    it('should handle timeout', async () => {
      const slowCallback = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      const gate = createHITLGate({
        requireApprovalFor: ['high'],
        onApprovalRequest: slowCallback,
        approvalTimeout: 50,
      });

      const fragment = createEffectFragment('high');
      const result = await gate.requestApproval(fragment);

      expect('id' in result).toBe(true);
      expect((result as any).code).toBe('HITL_APPROVAL_TIMEOUT');
    });

    it('should use cache when enabled', async () => {
      const mockCallback = vi.fn().mockResolvedValue({
        approved: true,
        cacheDecision: true,
      });

      const gate = createHITLGate({
        requireApprovalFor: ['high'],
        onApprovalRequest: mockCallback,
        allowPatternCache: true,
      });

      const fragment = createEffectFragment('high');

      // First call
      await gate.requestApproval(fragment);
      expect(mockCallback).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await gate.requestApproval(fragment);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPendingApprovals', () => {
    it('should return empty array initially', () => {
      const gate = createHITLGate({ requireApprovalFor: ['high'] });
      expect(gate.getPendingApprovals()).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear the approval cache', async () => {
      const mockCallback = vi.fn().mockResolvedValue({
        approved: true,
        cacheDecision: true,
      });

      const gate = createHITLGate({
        requireApprovalFor: ['high'],
        onApprovalRequest: mockCallback,
        allowPatternCache: true,
      });

      const fragment = createEffectFragment('high');
      await gate.requestApproval(fragment);

      gate.clearCache();

      // After clearing, callback should be called again
      await gate.requestApproval(fragment);
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('getConfig', () => {
    it('should return the current configuration', () => {
      const config: HITLConfig = {
        requireApprovalFor: ['high', 'critical'],
        approvalTimeout: 5000,
      };

      const gate = createHITLGate(config);
      expect(gate.getConfig()).toEqual(config);
    });
  });
});

// ============================================================================
// Utility Functions
// ============================================================================

describe('checkFragmentsForHITL', () => {
  it('should return fragments requiring approval', () => {
    const config: HITLConfig = { requireApprovalFor: ['high', 'critical'] };
    const fragments: Fragment[] = [
      createEffectFragment('low'),
      createEffectFragment('high'),
      createActionFragment('critical'),
      createSchemaFragment(),
    ];

    const result = checkFragmentsForHITL(fragments, config);

    expect(result).toHaveLength(2);
    expect(result.every((f) => f.kind === 'EffectFragment' || f.kind === 'ActionFragment')).toBe(
      true
    );
  });

  it('should return empty array when no fragments require approval', () => {
    const config: HITLConfig = { requireApprovalFor: ['critical'] };
    const fragments: Fragment[] = [
      createEffectFragment('low'),
      createEffectFragment('medium'),
    ];

    const result = checkFragmentsForHITL(fragments, config);

    expect(result).toHaveLength(0);
  });
});

describe('generateHITLIssues', () => {
  it('should generate issues for fragments requiring approval', () => {
    const config: HITLConfig = { requireApprovalFor: ['high'] };
    const fragments: Fragment[] = [
      createEffectFragment('high'),
      createActionFragment('high'),
    ];

    const issues = generateHITLIssues(fragments, config);

    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.code === 'HITL_APPROVAL_REQUIRED')).toBe(true);
  });

  it('should not generate issues for approved risk levels', () => {
    const config: HITLConfig = { requireApprovalFor: ['critical'] };
    const fragments: Fragment[] = [
      createEffectFragment('low'),
      createEffectFragment('medium'),
    ];

    const issues = generateHITLIssues(fragments, config);

    expect(issues).toHaveLength(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle fragments without risk property', () => {
    const gate = createHITLGate({ requireApprovalFor: ['high'] });
    const fragment = createSchemaFragment();

    expect(gate.requiresApproval(fragment)).toBe(false);
  });

  it('should handle none risk level', () => {
    const gate = createHITLGate({ requireApprovalFor: ['none'] });
    const fragment = createEffectFragment('none');

    // 'none' risk should not require approval
    expect(gate.requiresApproval(fragment)).toBe(false);
  });

  it('should handle empty fragment list', () => {
    const config: HITLConfig = { requireApprovalFor: ['high'] };

    expect(checkFragmentsForHITL([], config)).toEqual([]);
    expect(generateHITLIssues([], config)).toEqual([]);
  });
});
