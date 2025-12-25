/**
 * Allowlist Validator Tests
 *
 * Tests for endpoint and effect type allowlist enforcement
 */

import { describe, it, expect } from 'vitest';
import {
  validateAllowlist,
  generateAllowlistIssues,
  hasAllowlistViolations,
  type AllowlistViolation,
} from '../../src/safety/allowlist-validator.js';
import type { EffectPolicy } from '../../src/types/session.js';
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

function createEffectFragment(effect: unknown): EffectFragment {
  return {
    id: `effect_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind: 'EffectFragment',
    requires: [],
    provides: [],
    origin: createTestProvenance(),
    evidence: [],
    confidence: 1.0,
    compilerVersion: '0.1.0',
    effect: effect as any,
    risk: 'low',
  } as EffectFragment;
}

function createActionFragment(effect: unknown): ActionFragment {
  return {
    id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind: 'ActionFragment',
    requires: [],
    provides: [],
    origin: createTestProvenance(),
    evidence: [],
    confidence: 1.0,
    compilerVersion: '0.1.0',
    actionId: 'testAction',
    effect: effect as any,
    preconditions: [],
    risk: 'low',
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
// validateAllowlist
// ============================================================================

describe('validateAllowlist', () => {
  describe('endpoint allowlist', () => {
    it('should detect endpoint violations', () => {
      const policy: EffectPolicy = {
        maxRisk: 'high',
        allowedEndpoints: ['/api/safe', '/api/allowed'],
      };

      const fragments: Fragment[] = [
        createEffectFragment(['apiCall', '/api/unsafe']),
      ];

      const violations = validateAllowlist(fragments, policy);

      expect(violations).toHaveLength(1);
      expect(violations[0].violationType).toBe('endpoint');
      expect(violations[0].value).toBe('/api/unsafe');
    });

    it('should allow valid endpoints', () => {
      const policy: EffectPolicy = {
        maxRisk: 'high',
        allowedEndpoints: ['/api/safe', '/api/allowed'],
      };

      const fragments: Fragment[] = [
        createEffectFragment(['apiCall', '/api/safe']),
      ];

      const violations = validateAllowlist(fragments, policy);

      expect(violations).toHaveLength(0);
    });

    it('should detect nested endpoint violations', () => {
      const policy: EffectPolicy = {
        maxRisk: 'high',
        allowedEndpoints: ['/api/safe'],
      };

      const fragments: Fragment[] = [
        createEffectFragment([
          'sequence',
          [
            ['apiCall', '/api/safe'],
            ['apiCall', '/api/unsafe'],
          ],
        ]),
      ];

      const violations = validateAllowlist(fragments, policy);

      expect(violations).toHaveLength(1);
      expect(violations[0].value).toBe('/api/unsafe');
    });

    it('should handle parallel effects', () => {
      const policy: EffectPolicy = {
        maxRisk: 'high',
        allowedEndpoints: ['/api/safe'],
      };

      const fragments: Fragment[] = [
        createEffectFragment([
          'parallel',
          [
            ['apiCall', '/api/safe'],
            ['apiCall', '/api/blocked'],
          ],
        ]),
      ];

      const violations = validateAllowlist(fragments, policy);

      expect(violations).toHaveLength(1);
      expect(violations[0].value).toBe('/api/blocked');
    });
  });

  describe('effect type allowlist', () => {
    it('should detect effect type violations', () => {
      const policy: EffectPolicy = {
        maxRisk: 'high',
        allowedEffectTypes: ['sequence', 'set', 'literal'],
      };

      const fragments: Fragment[] = [
        createEffectFragment(['apiCall', '/api/data']),
      ];

      const violations = validateAllowlist(fragments, policy);

      expect(violations).toHaveLength(1);
      expect(violations[0].violationType).toBe('effectType');
      expect(violations[0].value).toBe('apiCall');
    });

    it('should allow valid effect types', () => {
      const policy: EffectPolicy = {
        maxRisk: 'high',
        allowedEffectTypes: ['sequence', 'set'],
      };

      const fragments: Fragment[] = [
        createEffectFragment(['sequence', [['set', 'data.x', 1]]]),
      ];

      const violations = validateAllowlist(fragments, policy);

      expect(violations).toHaveLength(0);
    });

    it('should detect nested effect type violations', () => {
      const policy: EffectPolicy = {
        maxRisk: 'high',
        allowedEffectTypes: ['sequence'],
      };

      const fragments: Fragment[] = [
        createEffectFragment(['sequence', [['set', 'data.x', 1]]]),
      ];

      const violations = validateAllowlist(fragments, policy);

      expect(violations).toHaveLength(1);
      expect(violations[0].value).toBe('set');
    });
  });

  describe('no allowlist configured', () => {
    it('should return no violations when no allowlist is configured', () => {
      const policy: EffectPolicy = {
        maxRisk: 'high',
      };

      const fragments: Fragment[] = [
        createEffectFragment(['apiCall', '/api/anything']),
      ];

      const violations = validateAllowlist(fragments, policy);

      expect(violations).toHaveLength(0);
    });

    it('should return no violations for empty allowlists', () => {
      const policy: EffectPolicy = {
        maxRisk: 'high',
        allowedEndpoints: [],
        allowedEffectTypes: [],
      };

      const fragments: Fragment[] = [
        createEffectFragment(['apiCall', '/api/anything']),
      ];

      const violations = validateAllowlist(fragments, policy);

      // Empty allowlist means no restrictions
      expect(violations).toHaveLength(0);
    });
  });

  describe('non-effect fragments', () => {
    it('should skip schema fragments', () => {
      const policy: EffectPolicy = {
        maxRisk: 'high',
        allowedEndpoints: ['/api/safe'],
      };

      const fragments: Fragment[] = [createSchemaFragment()];

      const violations = validateAllowlist(fragments, policy);

      expect(violations).toHaveLength(0);
    });
  });

  describe('ActionFragment support', () => {
    it('should validate ActionFragment effects', () => {
      const policy: EffectPolicy = {
        maxRisk: 'high',
        allowedEndpoints: ['/api/safe'],
      };

      const fragments: Fragment[] = [
        createActionFragment(['apiCall', '/api/unsafe']),
      ];

      const violations = validateAllowlist(fragments, policy);

      expect(violations).toHaveLength(1);
      expect(violations[0].value).toBe('/api/unsafe');
    });
  });
});

// ============================================================================
// generateAllowlistIssues
// ============================================================================

describe('generateAllowlistIssues', () => {
  it('should generate endpoint issues', () => {
    const policy: EffectPolicy = {
      maxRisk: 'high',
      allowedEndpoints: ['/api/safe'],
    };

    const fragments: Fragment[] = [
      createEffectFragment(['apiCall', '/api/unsafe']),
    ];

    const issues = generateAllowlistIssues(fragments, policy);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('ENDPOINT_NOT_ALLOWED');
    expect(issues[0].message).toContain('/api/unsafe');
  });

  it('should generate effect type issues', () => {
    const policy: EffectPolicy = {
      maxRisk: 'high',
      allowedEffectTypes: ['sequence'],
    };

    const fragments: Fragment[] = [
      createEffectFragment(['apiCall', '/api/data']),
    ];

    const issues = generateAllowlistIssues(fragments, policy);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('EFFECT_TYPE_NOT_ALLOWED');
    expect(issues[0].message).toContain('apiCall');
  });

  it('should generate multiple issues for multiple violations', () => {
    const policy: EffectPolicy = {
      maxRisk: 'high',
      allowedEndpoints: ['/api/safe'],
      allowedEffectTypes: ['sequence'],
    };

    const fragments: Fragment[] = [
      createEffectFragment(['apiCall', '/api/unsafe']),
    ];

    const issues = generateAllowlistIssues(fragments, policy);

    // Both endpoint and effect type violations
    expect(issues).toHaveLength(2);
    expect(issues.some((i) => i.code === 'ENDPOINT_NOT_ALLOWED')).toBe(true);
    expect(issues.some((i) => i.code === 'EFFECT_TYPE_NOT_ALLOWED')).toBe(true);
  });

  it('should return empty array for no violations', () => {
    const policy: EffectPolicy = {
      maxRisk: 'high',
      allowedEndpoints: ['/api/safe'],
    };

    const fragments: Fragment[] = [
      createEffectFragment(['apiCall', '/api/safe']),
    ];

    const issues = generateAllowlistIssues(fragments, policy);

    expect(issues).toHaveLength(0);
  });
});

// ============================================================================
// hasAllowlistViolations
// ============================================================================

describe('hasAllowlistViolations', () => {
  it('should return true when violations exist', () => {
    const policy: EffectPolicy = {
      maxRisk: 'high',
      allowedEndpoints: ['/api/safe'],
    };

    const fragments: Fragment[] = [
      createEffectFragment(['apiCall', '/api/unsafe']),
    ];

    expect(hasAllowlistViolations(fragments, policy)).toBe(true);
  });

  it('should return false when no violations exist', () => {
    const policy: EffectPolicy = {
      maxRisk: 'high',
      allowedEndpoints: ['/api/safe'],
    };

    const fragments: Fragment[] = [
      createEffectFragment(['apiCall', '/api/safe']),
    ];

    expect(hasAllowlistViolations(fragments, policy)).toBe(false);
  });

  it('should return false for empty fragment list', () => {
    const policy: EffectPolicy = {
      maxRisk: 'high',
      allowedEndpoints: ['/api/safe'],
    };

    expect(hasAllowlistViolations([], policy)).toBe(false);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle null/undefined effects', () => {
    const policy: EffectPolicy = {
      maxRisk: 'high',
      allowedEndpoints: ['/api/safe'],
    };

    const fragment = createEffectFragment(null);
    const violations = validateAllowlist([fragment], policy);

    expect(violations).toHaveLength(0);
  });

  it('should handle empty effect arrays', () => {
    const policy: EffectPolicy = {
      maxRisk: 'high',
      allowedEndpoints: ['/api/safe'],
    };

    const fragment = createEffectFragment([]);
    const violations = validateAllowlist([fragment], policy);

    expect(violations).toHaveLength(0);
  });

  it('should handle conditional effects', () => {
    const policy: EffectPolicy = {
      maxRisk: 'high',
      allowedEndpoints: ['/api/safe'],
    };

    const fragment = createEffectFragment([
      'conditional',
      ['literal', true],
      ['apiCall', '/api/safe'],
      ['apiCall', '/api/unsafe'],
    ]);

    const violations = validateAllowlist([fragment], policy);

    expect(violations).toHaveLength(1);
    expect(violations[0].value).toBe('/api/unsafe');
  });

  it('should handle mixed fragment types', () => {
    const policy: EffectPolicy = {
      maxRisk: 'high',
      allowedEndpoints: ['/api/safe'],
    };

    const fragments: Fragment[] = [
      createSchemaFragment(),
      createEffectFragment(['apiCall', '/api/unsafe']),
      createActionFragment(['apiCall', '/api/safe']),
    ];

    const violations = validateAllowlist(fragments, policy);

    expect(violations).toHaveLength(1);
  });
});
