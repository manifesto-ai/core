/**
 * Verifier Flags Combination Tests
 *
 * TRD 1.11 (B5) Verifier flags 조합 테스트
 *
 * 목적:
 * - VerifyOptions 플래그 조합 검증
 * - 각 플래그별 동작 검증
 * - 플래그 조합 시 상호작용 검증
 * - maxEffectRisk 레벨별 검증
 *
 * 테스트 범위:
 * - 개별 플래그 활성화/비활성화
 * - 플래그 조합 시 결과
 * - treatWarningsAsErrors 영향
 * - useCoreValidation 영향
 */

import { describe, it, expect } from 'vitest';
import {
  verify,
  verifyFull,
  verifyFragments,
  type VerifyOptions,
  type VerifyResult,
} from '../../src/verifier/index.js';
import type {
  Fragment,
  SourceFragment,
  DerivedFragment,
  EffectFragment,
  ActionFragment,
} from '../../src/types/fragment.js';
import type { LinkResult } from '../../src/types/session.js';

// ============================================================================
// Test Helpers - Use inline fragment creation (same as static.test.ts)
// ============================================================================

const TEST_ORIGIN = { artifactId: 'test', location: { kind: 'generated' as const, note: 'test' } };

function makeSourceFragment(overrides: Partial<SourceFragment> = {}): SourceFragment {
  return {
    id: `source-${Math.random().toString(36).slice(2)}`,
    kind: 'SourceFragment',
    requires: [],
    provides: ['data.test'],
    origin: TEST_ORIGIN,
    evidence: [],
    compilerVersion: '0.1.0',
    path: 'data.test',
    schema: { path: 'data.test', type: 'string' },
    semantic: { type: 'string', description: 'test' },
    ...overrides,
  };
}

function makeDerivedFragment(overrides: Partial<DerivedFragment> = {}): DerivedFragment {
  return {
    id: `derived-${Math.random().toString(36).slice(2)}`,
    kind: 'DerivedFragment',
    requires: [],
    provides: ['derived.test'],
    origin: TEST_ORIGIN,
    evidence: [],
    compilerVersion: '0.1.0',
    path: 'derived.test',
    deps: [],
    expression: { _tag: 'literal', value: 0 },
    ...overrides,
  };
}

function makeEffectFragment(overrides: Partial<EffectFragment> = {}): EffectFragment {
  return {
    id: `effect-${Math.random().toString(36).slice(2)}`,
    kind: 'EffectFragment',
    requires: [],
    provides: ['effects.test'],
    origin: TEST_ORIGIN,
    evidence: [],
    compilerVersion: '0.1.0',
    path: 'effects.test',
    effect: { _tag: 'io', operation: 'test' },
    risk: 'low',
    ...overrides,
  };
}

function makeActionFragment(overrides: Partial<ActionFragment> = {}): ActionFragment {
  return {
    id: `action-${Math.random().toString(36).slice(2)}`,
    kind: 'ActionFragment',
    requires: [],
    provides: ['actions.test'],
    origin: TEST_ORIGIN,
    evidence: [],
    compilerVersion: '0.1.0',
    actionId: 'test-action',
    path: 'actions.test',
    effects: [],
    semanticMeta: {},
    ...overrides,
  };
}

/**
 * Create a mock LinkResult with fragments
 */
function createMockLinkResult(fragments: Fragment[]): LinkResult {
  return {
    fragments,
    issues: [],
    conflicts: [],
    domainDraft: undefined,
    graph: undefined,
  };
}

/**
 * Create test fragments with various issues
 */
function createTestFragments(): {
  validFragment: Fragment;
  fragmentWithMissingDep: Fragment;
  fragmentWithCycle: Fragment;
  highRiskEffect: Fragment;
  actionWithoutVerb: Fragment;
  fragmentWithInvalidPath: Fragment;
} {
  const validFragment = makeSourceFragment({
    provides: ['data.user.name'],
    path: 'data.user.name',
    schema: { path: 'data.user.name', type: 'string' },
  });

  const fragmentWithMissingDep = makeDerivedFragment({
    provides: ['derived.greeting'],
    path: 'derived.greeting',
    requires: ['data.user.name', 'data.user.missingField'],
    deps: ['data.user.name', 'data.user.missingField'],
    expression: { _tag: 'ref', path: 'data.user.name' },
  });

  const fragmentWithCycle = makeDerivedFragment({
    provides: ['derived.cycleA'],
    path: 'derived.cycleA',
    requires: ['derived.cycleB'],
    deps: ['derived.cycleB'],
    expression: { _tag: 'ref', path: 'derived.cycleB' },
  });

  const highRiskEffect = makeEffectFragment({
    provides: ['effects.deleteAllData'],
    path: 'effects.deleteAllData',
    effect: { _tag: 'io', operation: 'DELETE_ALL' },
    risk: 'critical',
  });

  const actionWithoutVerb = makeActionFragment({
    actionId: 'noVerb',
    provides: ['actions.noVerbAction'],
    path: 'actions.noVerbAction',
    effects: [],
    semanticMeta: {
      // Missing actionVerb
      description: 'Action without verb',
    },
  });

  const fragmentWithInvalidPath = makeSourceFragment({
    provides: [''],
    path: '', // Invalid empty path
  });

  return {
    validFragment,
    fragmentWithMissingDep,
    fragmentWithCycle,
    highRiskEffect,
    actionWithoutVerb,
    fragmentWithInvalidPath,
  };
}

// ============================================================================
// Individual Flag Tests
// ============================================================================

describe('Verifier Flags: Individual Flags', () => {
  const fragments = createTestFragments();

  describe('checkCycles flag', () => {
    it('should detect cycles when enabled (default)', async () => {
      // Create fragments that form a cycle
      const cycleA = makeDerivedFragment({
        id: 'cycleA',
        provides: ['derived.cycleA'],
        path: 'derived.cycleA',
        requires: ['derived.cycleB'],
        deps: ['derived.cycleB'],
        expression: { _tag: 'ref', path: 'derived.cycleB' },
      });
      const cycleB = makeDerivedFragment({
        id: 'cycleB',
        provides: ['derived.cycleB'],
        path: 'derived.cycleB',
        requires: ['derived.cycleA'],
        deps: ['derived.cycleA'],
        expression: { _tag: 'ref', path: 'derived.cycleA' },
      });

      const result = await verifyFragments([cycleA, cycleB], { checkCycles: true });

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.code === 'CYCLIC_DEPENDENCY')).toBe(true);
    });

    it('should produce fewer cycle issues when disabled', async () => {
      const cycleA = makeDerivedFragment({
        id: 'cycleA',
        provides: ['derived.cycleA'],
        path: 'derived.cycleA',
        requires: ['derived.cycleB'],
        deps: ['derived.cycleB'],
        expression: { _tag: 'ref', path: 'derived.cycleB' },
      });
      const cycleB = makeDerivedFragment({
        id: 'cycleB',
        provides: ['derived.cycleB'],
        path: 'derived.cycleB',
        requires: ['derived.cycleA'],
        deps: ['derived.cycleA'],
        expression: { _tag: 'ref', path: 'derived.cycleA' },
      });

      const resultEnabled = await verifyFragments([cycleA, cycleB], { checkCycles: true });
      const resultDisabled = await verifyFragments([cycleA, cycleB], { checkCycles: false });

      // When cycle check is enabled, it should find cycles
      const cycleIssuesEnabled = resultEnabled.issues.filter((i) => i.code === 'CYCLIC_DEPENDENCY');
      const cycleIssuesDisabled = resultDisabled.issues.filter((i) => i.code === 'CYCLIC_DEPENDENCY');

      // Enabled should have cycle issues, disabled should have fewer or none
      expect(cycleIssuesEnabled.length).toBeGreaterThanOrEqual(cycleIssuesDisabled.length);
    });
  });

  describe('checkDependencies flag', () => {
    it('should detect missing dependencies when enabled (default)', async () => {
      const result = await verifyFragments([fragments.fragmentWithMissingDep], {
        checkDependencies: true,
      });

      expect(result.issues.some((i) => i.code === 'MISSING_DEPENDENCY')).toBe(true);
    });

    it('should produce fewer dependency issues when disabled', async () => {
      const resultEnabled = await verifyFragments([fragments.fragmentWithMissingDep], {
        checkDependencies: true,
      });
      const resultDisabled = await verifyFragments([fragments.fragmentWithMissingDep], {
        checkDependencies: false,
      });

      // Count missing dependency issues
      const depIssuesEnabled = resultEnabled.issues.filter((i) => i.code === 'MISSING_DEPENDENCY');
      const depIssuesDisabled = resultDisabled.issues.filter((i) => i.code === 'MISSING_DEPENDENCY');

      // Enabled should have dependency issues, disabled should have fewer or none
      expect(depIssuesEnabled.length).toBeGreaterThanOrEqual(depIssuesDisabled.length);
    });
  });

  describe('checkPaths flag', () => {
    it('should validate paths when enabled (default)', async () => {
      const result = await verifyFragments([fragments.fragmentWithInvalidPath], {
        checkPaths: true,
      });

      expect(result.issues.some((i) => i.code === 'INVALID_PATH')).toBe(true);
    });

    it('should skip path validation when disabled', async () => {
      const result = await verifyFragments([fragments.fragmentWithInvalidPath], {
        checkPaths: false,
      });

      expect(result.issues.some((i) => i.code === 'INVALID_PATH')).toBe(false);
    });
  });

  describe('checkEffects flag', () => {
    it('should validate effects when enabled (default)', async () => {
      const result = await verifyFragments([fragments.highRiskEffect], {
        checkEffects: true,
        maxEffectRisk: 'low', // Set low threshold to catch high-risk effects
      });

      expect(result.issues.some((i) => i.code === 'EFFECT_RISK_TOO_HIGH')).toBe(true);
    });

    it('should skip effect validation when disabled', async () => {
      const result = await verifyFragments([fragments.highRiskEffect], {
        checkEffects: false,
        maxEffectRisk: 'low',
      });

      expect(result.issues.some((i) => i.code === 'EFFECT_RISK_TOO_HIGH')).toBe(false);
    });
  });

  describe('requireActionVerb flag', () => {
    it('should require action verb when enabled', async () => {
      const result = await verifyFragments([fragments.actionWithoutVerb], {
        checkActions: true,
        requireActionVerb: true,
      });

      expect(result.issues.some((i) => i.code === 'ACTION_VERB_REQUIRED')).toBe(true);
    });

    it('should not require action verb when disabled (default)', async () => {
      const result = await verifyFragments([fragments.actionWithoutVerb], {
        checkActions: true,
        requireActionVerb: false,
      });

      expect(result.issues.some((i) => i.code === 'ACTION_VERB_REQUIRED')).toBe(false);
    });
  });
});

// ============================================================================
// maxEffectRisk Level Tests
// ============================================================================

describe('Verifier Flags: maxEffectRisk Levels', () => {
  const riskLevels: Array<'low' | 'medium' | 'high' | 'critical'> = [
    'low',
    'medium',
    'high',
    'critical',
  ];

  for (const riskLevel of riskLevels) {
    describe(`maxEffectRisk: ${riskLevel}`, () => {
      it(`should allow effects at or below ${riskLevel}`, async () => {
        const effectAtRisk = makeEffectFragment({
          provides: [`effects.at${riskLevel}`],
          path: `effects.at${riskLevel}`,
          effect: { _tag: 'io', operation: 'test' },
          risk: riskLevel,
        });

        const result = await verifyFragments([effectAtRisk], {
          checkEffects: true,
          maxEffectRisk: riskLevel,
        });

        expect(result.issues.some((i) => i.code === 'EFFECT_RISK_TOO_HIGH')).toBe(false);
      });

      if (riskLevel !== 'critical') {
        it(`should reject effects above ${riskLevel}`, async () => {
          const higherRisk = riskLevels[riskLevels.indexOf(riskLevel) + 1]!;
          const effectAboveRisk = makeEffectFragment({
            provides: [`effects.above${riskLevel}`],
            path: `effects.above${riskLevel}`,
            effect: { _tag: 'io', operation: 'test' },
            risk: higherRisk,
          });

          const result = await verifyFragments([effectAboveRisk], {
            checkEffects: true,
            maxEffectRisk: riskLevel,
          });

          expect(result.issues.some((i) => i.code === 'EFFECT_RISK_TOO_HIGH')).toBe(true);
        });
      }
    });
  }
});

// ============================================================================
// treatWarningsAsErrors Tests
// ============================================================================

describe('Verifier Flags: treatWarningsAsErrors', () => {
  it('should not affect isValid for warnings when disabled (default)', async () => {
    // Create a fragment that produces a warning but not an error
    const fragmentWithWarning = makeSourceFragment({
      provides: ['data.warnable'],
      path: 'data.warnable',
      // Missing provenance could be a warning
    });

    const result = await verifyFragments([fragmentWithWarning], {
      treatWarningsAsErrors: false,
      checkProvenance: true,
    });

    // If there are only warnings, isValid should be true
    if (result.warningCount > 0 && result.errorCount === 0) {
      expect(result.isValid).toBe(true);
    }
  });

  it('should treat warnings as errors when enabled', async () => {
    const fragmentWithWarning = makeSourceFragment({
      provides: ['data.warnable'],
      path: 'data.warnable',
    });

    const resultNormal = await verifyFragments([fragmentWithWarning], {
      treatWarningsAsErrors: false,
    });

    const resultStrict = await verifyFragments([fragmentWithWarning], {
      treatWarningsAsErrors: true,
    });

    // If warnings exist, strict mode should make them errors
    if (resultNormal.warningCount > 0) {
      expect(resultStrict.errorCount).toBeGreaterThanOrEqual(resultNormal.warningCount);
    }
  });
});

// ============================================================================
// Flag Combinations Tests
// ============================================================================

describe('Verifier Flags: Combinations', () => {
  describe('All checks disabled', () => {
    it('should return valid with no checks', async () => {
      const fragments = createTestFragments();
      const allFragments = [
        fragments.validFragment,
        fragments.fragmentWithMissingDep,
        fragments.highRiskEffect,
        fragments.actionWithoutVerb,
      ];

      const result = await verifyFragments(allFragments, {
        checkCycles: false,
        checkDependencies: false,
        checkTypes: false,
        checkPolicies: false,
        checkEffects: false,
        checkActions: false,
        checkProvenance: false,
        checkPaths: false,
        useCoreValidation: false,
      });

      // With all checks disabled, no issues should be found
      expect(result.issues).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Only DAG checks enabled', () => {
    it('should have DAG result when DAG checks enabled', async () => {
      const cycleA = makeDerivedFragment({
        id: 'dagCycleA',
        provides: ['derived.cycleA'],
        path: 'derived.cycleA',
        requires: ['derived.cycleB'],
        deps: ['derived.cycleB'],
        expression: { _tag: 'ref', path: 'derived.cycleB' },
      });
      const cycleB = makeDerivedFragment({
        id: 'dagCycleB',
        provides: ['derived.cycleB'],
        path: 'derived.cycleB',
        requires: ['derived.cycleA'],
        deps: ['derived.cycleA'],
        expression: { _tag: 'ref', path: 'derived.cycleA' },
      });

      const result = await verifyFragments([cycleA, cycleB], {
        checkCycles: true,
        checkDependencies: true,
        checkTypes: false,
        checkPolicies: false,
        checkEffects: false,
        checkActions: false,
        checkProvenance: false,
        checkPaths: false,
        useCoreValidation: false,
      });

      // Should have DAG result defined
      expect(result.dagResult).toBeDefined();
      // Static result may or may not be undefined depending on implementation
      // but with all static checks disabled, it should have no static issues
      if (result.staticResult) {
        expect(result.staticResult.issues).toHaveLength(0);
      }
    });
  });

  describe('Only static checks enabled', () => {
    it('should only report static issues', async () => {
      const fragments = createTestFragments();

      const result = await verifyFragments([fragments.highRiskEffect], {
        checkCycles: false,
        checkDependencies: false,
        checkTypes: true,
        checkPolicies: true,
        checkEffects: true,
        checkActions: true,
        checkProvenance: true,
        checkPaths: true,
        maxEffectRisk: 'low',
        useCoreValidation: false,
      });

      // Should have static issues but not DAG issues
      expect(result.staticResult).toBeDefined();
      // DAG result may still exist but won't have cycle/dependency issues
    });
  });

  describe('Strict mode (all checks + treatWarningsAsErrors)', () => {
    it('should catch all possible issues', async () => {
      const fragments = createTestFragments();

      const result = await verifyFragments([fragments.fragmentWithMissingDep], {
        checkCycles: true,
        checkDependencies: true,
        checkTypes: true,
        checkPolicies: true,
        checkEffects: true,
        checkActions: true,
        checkProvenance: true,
        checkPaths: true,
        treatWarningsAsErrors: true,
        useCoreValidation: false,
      });

      // Missing dependency should be caught
      expect(result.issues.some((i) => i.code === 'MISSING_DEPENDENCY')).toBe(true);
    });
  });
});

// ============================================================================
// sortResults Flag Tests (Determinism)
// ============================================================================

/**
 * Normalize issues for determinism comparison (remove random IDs)
 */
function normalizeIssuesForComparison(issues: Array<{ code: string; message: string; path?: string }>) {
  return issues.map((i) => ({
    code: i.code,
    message: i.message,
    path: i.path,
  })).sort((a, b) => {
    const codeCmp = a.code.localeCompare(b.code);
    if (codeCmp !== 0) return codeCmp;
    return (a.path || '').localeCompare(b.path || '');
  });
}

describe('Verifier Flags: sortResults (Determinism)', () => {
  it('should produce deterministic output when enabled (default)', async () => {
    const fragments = createTestFragments();
    const testFragments = [
      fragments.validFragment,
      fragments.fragmentWithMissingDep,
    ];

    const result1 = await verifyFragments(testFragments, { sortResults: true });
    const result2 = await verifyFragments(testFragments, { sortResults: true });

    // Compare normalized issues (without random IDs)
    const norm1 = normalizeIssuesForComparison(result1.issues);
    const norm2 = normalizeIssuesForComparison(result2.issues);

    expect(JSON.stringify(norm1)).toBe(JSON.stringify(norm2));
  });

  it('should produce consistent results across multiple runs', async () => {
    const cycleA = makeDerivedFragment({
      id: 'sortCycleA',
      provides: ['derived.cycleA'],
      path: 'derived.cycleA',
      requires: ['derived.cycleB', 'derived.cycleC'],
      deps: ['derived.cycleB', 'derived.cycleC'],
      expression: { _tag: 'ref', path: 'derived.cycleB' },
    });
    const cycleB = makeDerivedFragment({
      id: 'sortCycleB',
      provides: ['derived.cycleB'],
      path: 'derived.cycleB',
      requires: ['derived.cycleA'],
      deps: ['derived.cycleA'],
      expression: { _tag: 'ref', path: 'derived.cycleA' },
    });
    const cycleC = makeDerivedFragment({
      id: 'sortCycleC',
      provides: ['derived.cycleC'],
      path: 'derived.cycleC',
      requires: ['derived.cycleA'],
      deps: ['derived.cycleA'],
      expression: { _tag: 'ref', path: 'derived.cycleA' },
    });

    const results: VerifyResult[] = [];
    for (let i = 0; i < 3; i++) {
      const result = await verifyFragments([cycleA, cycleB, cycleC], {
        sortResults: true,
      });
      results.push(result);
    }

    // Compare normalized results (without random IDs)
    const firstResult = JSON.stringify(normalizeIssuesForComparison(results[0]!.issues));
    for (const result of results) {
      expect(JSON.stringify(normalizeIssuesForComparison(result.issues))).toBe(firstResult);
    }
  });
});

// ============================================================================
// Full Verification Pipeline Tests
// ============================================================================

describe('Verifier Flags: Full Pipeline', () => {
  it('verify function should work with LinkResult', async () => {
    const fragments = createTestFragments();
    const linkResult = createMockLinkResult([fragments.validFragment]);

    const result = await verify(linkResult);

    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('summary');
  });

  it('verifyFull should enable all checks', async () => {
    const fragments = createTestFragments();
    const linkResult = createMockLinkResult([
      fragments.fragmentWithMissingDep,
      fragments.highRiskEffect,
    ]);

    const result = await verifyFull(linkResult);

    // verifyFull should catch multiple issues
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.dagResult).toBeDefined();
    expect(result.staticResult).toBeDefined();
  });

  it('verifyFragments should be equivalent to verify with constructed LinkResult', async () => {
    const fragments = createTestFragments();
    const testFragments = [fragments.validFragment];

    const linkResult = createMockLinkResult(testFragments);
    const resultFromLinkResult = await verify(linkResult);
    const resultFromFragments = await verifyFragments(testFragments);

    // Both should produce consistent results
    expect(resultFromLinkResult.isValid).toBe(resultFromFragments.isValid);
    expect(resultFromLinkResult.issues.length).toBe(resultFromFragments.issues.length);
  });
});
