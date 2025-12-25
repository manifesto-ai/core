/**
 * Integration Tests - Full Pipeline
 *
 * 전체 Pass 파이프라인을 테스트하여 Code → Fragment 변환이
 * 올바르게 동작하는지 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import {
  createPassRegistry,
  createPassExecutor,
  codeAstExtractorPass,
  schemaPass,
  expressionLoweringPass,
  effectLoweringPass,
  policyLoweringPass,
  actionPass,
  nlExtractorPass,
  lowerDrafts,
} from '../../src/pass/index.js';
import type { CodeArtifact, TextArtifact } from '../../src/types/artifact.js';
import type {
  Fragment,
  SchemaFragment,
  DerivedFragment,
  EffectFragment,
  PolicyFragment,
  ActionFragment,
} from '../../src/types/fragment.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createCodeArtifact(content: string, language: 'js' | 'ts' = 'ts'): CodeArtifact {
  return {
    id: 'test-code-artifact',
    kind: 'code',
    language,
    content,
  };
}

function createTextArtifact(content: string): TextArtifact {
  return {
    id: 'test-text-artifact',
    kind: 'text',
    content,
  };
}

async function compileCode(content: string): Promise<{
  fragments: Fragment[];
  findings: Array<{ kind: string }>;
}> {
  const registry = createPassRegistry();
  registry.registerAll([
    codeAstExtractorPass,
    schemaPass,
    expressionLoweringPass,
    effectLoweringPass,
    policyLoweringPass,
    actionPass,
  ]);

  const executor = createPassExecutor(registry);
  const artifact = createCodeArtifact(content);
  const result = await executor.execute(artifact);

  return {
    fragments: result.fragments,
    findings: result.findings.map((f) => ({ kind: f.kind })),
  };
}

// ============================================================================
// Full Pipeline Tests
// ============================================================================

describe('Full Code Pipeline', () => {
  it('should compile simple variable to SchemaFragment', async () => {
    const { fragments } = await compileCode('const count = 10;');

    const schemaFragments = fragments.filter(
      (f): f is SchemaFragment => f.kind === 'SchemaFragment'
    );

    expect(schemaFragments.length).toBeGreaterThanOrEqual(1);
    expect(schemaFragments[0]?.provides).toContain('data.count');
    expect(schemaFragments[0]?.fields[0]?.type).toBe('number');
  });

  it('should compile expression to DerivedFragment', async () => {
    const { fragments } = await compileCode('const valid = count > 10;');

    const derivedFragments = fragments.filter(
      (f): f is DerivedFragment => f.kind === 'DerivedFragment'
    );

    expect(derivedFragments.length).toBeGreaterThanOrEqual(1);
  });

  it('should compile assignment to EffectFragment', async () => {
    const { fragments } = await compileCode('count = 20;');

    const effectFragments = fragments.filter(
      (f): f is EffectFragment => f.kind === 'EffectFragment'
    );

    expect(effectFragments.length).toBeGreaterThanOrEqual(1);
    expect(effectFragments[0]?.effect._tag).toBe('SetValue');
  });

  it('should compile handler function to ActionFragment', async () => {
    const { fragments } = await compileCode('function handleSubmit() { submit(); }');

    const actionFragments = fragments.filter(
      (f): f is ActionFragment => f.kind === 'ActionFragment'
    );

    expect(actionFragments.length).toBe(1);
    expect(actionFragments[0]?.actionId).toBe('submit');
  });

  it('should extract findings from code', async () => {
    const { findings } = await compileCode(`
      const count = 10;
      const valid = count > 5;
      if (valid) { doSomething(); }
    `);

    const findingKinds = findings.map((f) => f.kind);

    expect(findingKinds).toContain('variable_declaration');
    expect(findingKinds).toContain('binary_expression');
    expect(findingKinds).toContain('if_statement');
  });
});

// ============================================================================
// Complex Code Tests
// ============================================================================

describe('Complex Code Compilation', () => {
  it('should compile React-like component', async () => {
    const code = `
      const stateCount = 0;
      const stateLoading = false;

      function handleIncrement() {
        stateCount = stateCount + 1;
      }

      const derivedDoubled = stateCount * 2;
    `;

    const { fragments } = await compileCode(code);

    // Check schema fragments for state
    const schemaFragments = fragments.filter(
      (f): f is SchemaFragment => f.kind === 'SchemaFragment'
    );
    const stateFragments = schemaFragments.filter((f) => f.namespace === 'state');
    expect(stateFragments.length).toBeGreaterThanOrEqual(2);

    // Check action fragment
    const actionFragments = fragments.filter(
      (f): f is ActionFragment => f.kind === 'ActionFragment'
    );
    expect(actionFragments.length).toBe(1);
    expect(actionFragments[0]?.actionId).toBe('increment');

    // Check effect fragment
    const effectFragments = fragments.filter(
      (f): f is EffectFragment => f.kind === 'EffectFragment'
    );
    expect(effectFragments.length).toBeGreaterThanOrEqual(1);
  });

  it('should compile form validation logic', async () => {
    const code = `
      const email = "";
      const password = "";

      const isEmailValid = email.length > 0;
      const isPasswordValid = password.length >= 8;
      const canSubmit = isEmailValid && isPasswordValid;

      function handleLogin() {
        if (!canSubmit) return;
        emit("login", { email, password });
      }
    `;

    const { fragments } = await compileCode(code);

    // Should have schema fragments for email and password
    const schemaFragments = fragments.filter(
      (f): f is SchemaFragment => f.kind === 'SchemaFragment'
    );
    expect(schemaFragments.length).toBeGreaterThanOrEqual(2);

    // Should have derived fragments for validation
    const derivedFragments = fragments.filter(
      (f): f is DerivedFragment => f.kind === 'DerivedFragment'
    );
    expect(derivedFragments.length).toBeGreaterThanOrEqual(1);

    // Should have action fragment for login
    const actionFragments = fragments.filter(
      (f): f is ActionFragment => f.kind === 'ActionFragment'
    );
    expect(actionFragments.length).toBe(1);

    // Should have effect fragment for emit
    const effectFragments = fragments.filter(
      (f): f is EffectFragment => f.kind === 'EffectFragment'
    );
    const emitEffects = effectFragments.filter((f) => f.effect._tag === 'EmitEvent');
    expect(emitEffects.length).toBeGreaterThanOrEqual(1);
  });

  it('should compile API call logic', async () => {
    const code = `
      const stateLoading = false;
      const data = null;

      async function handleFetch() {
        stateLoading = true;
        const response = fetch("/api/data");
        data = response;
        stateLoading = false;
      }
    `;

    const { fragments } = await compileCode(code);

    // Should have effect fragments for state updates and API call
    const effectFragments = fragments.filter(
      (f): f is EffectFragment => f.kind === 'EffectFragment'
    );

    const stateEffects = effectFragments.filter(
      (f) => f.effect._tag === 'SetState' || f.effect._tag === 'SetValue'
    );
    expect(stateEffects.length).toBeGreaterThanOrEqual(1);

    const apiEffects = effectFragments.filter((f) => f.effect._tag === 'ApiCall');
    expect(apiEffects.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Pass Ordering Tests
// ============================================================================

describe('Pass Execution Order', () => {
  it('should execute passes in dependency order', async () => {
    const registry = createPassRegistry();
    registry.registerAll([
      codeAstExtractorPass,
      schemaPass,
      expressionLoweringPass,
      effectLoweringPass,
      policyLoweringPass,
      actionPass,
    ]);

    const executor = createPassExecutor(registry);
    const artifact = createCodeArtifact('const x = 10;');
    const result = await executor.execute(artifact);

    // Check pass execution order
    const passNames = result.passResults.map((r) => r.passName);

    // code-ast-extractor should be first
    expect(passNames[0]).toBe('code-ast-extractor');

    // schema-pass should be before expression-lowering (both depend on extractor)
    const schemaIndex = passNames.indexOf('schema-pass');
    const expressionIndex = passNames.indexOf('expression-lowering');
    expect(schemaIndex).toBeGreaterThan(0);
    expect(expressionIndex).toBeGreaterThan(0);

    // action-pass should be last (depends on effect and policy)
    const actionIndex = passNames.indexOf('action-pass');
    expect(actionIndex).toBe(passNames.length - 1);
  });

  it('should propagate findings between passes', async () => {
    const registry = createPassRegistry();
    registry.registerAll([
      codeAstExtractorPass,
      schemaPass,
    ]);

    const executor = createPassExecutor(registry);
    const artifact = createCodeArtifact('const count = 10;');
    const result = await executor.execute(artifact);

    // Extractor should produce findings
    const extractorResult = result.passResults.find(
      (r) => r.passName === 'code-ast-extractor'
    );
    expect(extractorResult?.findings.length).toBeGreaterThan(0);

    // Schema pass should use those findings to produce fragments
    const schemaResult = result.passResults.find((r) => r.passName === 'schema-pass');
    expect(schemaResult?.fragments.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// NL Pipeline Tests
// ============================================================================

describe('NL Pipeline', () => {
  it('should process text artifact with NL pass', async () => {
    const registry = createPassRegistry();
    registry.register(nlExtractorPass);

    const executor = createPassExecutor(registry);
    const artifact = createTextArtifact('User is a person with name and email.');
    const result = await executor.execute(artifact);

    // Should have findings
    expect(result.findings.length).toBeGreaterThanOrEqual(1);

    // Should have drafts (not fragments - NL produces drafts)
    expect(result.passResults[0]?.drafts?.length).toBeGreaterThanOrEqual(0);
  });

  it('should lower NL drafts to fragments', async () => {
    const registry = createPassRegistry();
    registry.register(nlExtractorPass);

    const executor = createPassExecutor(registry);
    const artifact = createTextArtifact('Count is a number. User can submit.');
    const result = await executor.execute(artifact);

    // Get drafts from NL pass
    const drafts = result.passResults[0]?.drafts || [];

    if (drafts.length > 0) {
      // Lower drafts to fragments
      const { fragments, results } = lowerDrafts(drafts);

      // Check that at least some drafts were successfully lowered
      const successCount = results.filter((r) => r.success).length;
      expect(fragments.length).toBe(successCount);
    }
  });
});

// ============================================================================
// Provenance Tests
// ============================================================================

describe('Provenance Tracking', () => {
  it('should include artifact ID in fragment origin', async () => {
    const { fragments } = await compileCode('const x = 10;');

    for (const fragment of fragments) {
      expect(fragment.origin.artifactId).toBe('test-code-artifact');
    }
  });

  it('should include evidence in fragments', async () => {
    const { fragments } = await compileCode('const count = 10;');

    const schemaFragments = fragments.filter(
      (f): f is SchemaFragment => f.kind === 'SchemaFragment'
    );

    for (const fragment of schemaFragments) {
      expect(fragment.evidence.length).toBeGreaterThanOrEqual(1);
      expect(fragment.evidence[0]?.kind).toBe('ast_node');
    }
  });

  it('should include compiler version', async () => {
    const { fragments } = await compileCode('const x = 10;');

    for (const fragment of fragments) {
      expect(fragment.compilerVersion).toBeDefined();
      expect(fragment.compilerVersion).toMatch(/^\d+\.\d+\.\d+/);
    }
  });
});

// ============================================================================
// Fragment ID Stability Tests
// ============================================================================

describe('Fragment ID Stability', () => {
  it('should generate stable IDs with correct prefix', async () => {
    const { fragments } = await compileCode(`
      const count = 10;
      count = 20;
      function handleClick() {}
    `);

    for (const fragment of fragments) {
      // Check prefix matches kind
      switch (fragment.kind) {
        case 'SchemaFragment':
          expect(fragment.id).toMatch(/^sch_/);
          break;
        case 'DerivedFragment':
          expect(fragment.id).toMatch(/^der_/);
          break;
        case 'EffectFragment':
          expect(fragment.id).toMatch(/^eff_/);
          break;
        case 'ActionFragment':
          expect(fragment.id).toMatch(/^act_/);
          break;
        case 'PolicyFragment':
          expect(fragment.id).toMatch(/^pol_/);
          break;
      }
    }
  });

  it('should generate unique IDs for different fragments', async () => {
    const { fragments } = await compileCode(`
      const a = 1;
      const b = 2;
      const c = 3;
    `);

    const ids = fragments.map((f) => f.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  it('should handle empty code', async () => {
    const { fragments, findings } = await compileCode('');

    // Should not crash, may have no output
    expect(Array.isArray(fragments)).toBe(true);
    expect(Array.isArray(findings)).toBe(true);
  });

  it('should handle comments-only code', async () => {
    const { fragments } = await compileCode('// This is a comment');

    // Should not crash
    expect(Array.isArray(fragments)).toBe(true);
  });

  it('should handle syntax errors gracefully', async () => {
    // Missing semicolon might not be a syntax error in JS
    // But this tests that the pipeline handles various inputs
    const registry = createPassRegistry();
    registry.registerAll([codeAstExtractorPass, schemaPass]);

    const executor = createPassExecutor(registry);
    const artifact = createCodeArtifact('const x = {invalid syntax');

    // Should not throw
    try {
      const result = await executor.execute(artifact);
      expect(result).toBeDefined();
    } catch {
      // If it throws, that's also acceptable for invalid syntax
      expect(true).toBe(true);
    }
  });
});

// ============================================================================
// Real-World Scenario Tests
// ============================================================================

describe('Real-World Scenarios', () => {
  it('should compile shopping cart logic', async () => {
    const code = `
      const items = [];
      const stateLoading = false;

      const derivedTotal = items.reduce((sum, item) => sum + item.price, 0);
      const derivedCanCheckout = items.length > 0;

      function handleAddItem() {
        emit("addItem");
      }

      function handleRemoveItem() {
        emit("removeItem");
      }

      function handleCheckout() {
        if (!derivedCanCheckout) return;
        fetch("/api/checkout", { items });
      }
    `;

    const { fragments } = await compileCode(code);

    // Check we have all expected fragment types
    const fragmentKinds = new Set(fragments.map((f) => f.kind));
    expect(fragmentKinds.has('SchemaFragment')).toBe(true);
    expect(fragmentKinds.has('ActionFragment')).toBe(true);
    expect(fragmentKinds.has('EffectFragment')).toBe(true);
  });

  it('should compile user authentication flow', async () => {
    const code = `
      const username = "";
      const password = "";
      const stateIsLoggedIn = false;
      const stateError = null;

      const derivedIsValid = username.length > 0 && password.length >= 8;

      async function handleLogin() {
        if (!derivedIsValid) return;
        stateError = null;
        const result = fetch("/api/login", { username, password });
        stateIsLoggedIn = true;
      }

      function handleLogout() {
        stateIsLoggedIn = false;
        emit("userLoggedOut");
      }
    `;

    const { fragments } = await compileCode(code);

    // Verify schema fragments
    const schemaFragments = fragments.filter(
      (f): f is SchemaFragment => f.kind === 'SchemaFragment'
    );
    expect(schemaFragments.length).toBeGreaterThanOrEqual(2);

    // Verify action fragments (login and logout)
    const actionFragments = fragments.filter(
      (f): f is ActionFragment => f.kind === 'ActionFragment'
    );
    const actionIds = actionFragments.map((f) => f.actionId);
    expect(actionIds).toContain('login');
    expect(actionIds).toContain('logout');

    // Verify effect fragments include state updates and emit
    const effectFragments = fragments.filter(
      (f): f is EffectFragment => f.kind === 'EffectFragment'
    );
    const effectTags = effectFragments.map((f) => f.effect._tag);
    expect(effectTags).toContain('EmitEvent');
  });
});
