/**
 * Public API Contract Tests
 *
 * TRD 1.11 (C) 계약 테스트 - Public API 표면 검증
 *
 * 목적:
 * - Public API 변경 감지 (breaking changes)
 * - Export 목록 스냅샷 고정
 * - 타입 시그니처 안정성 보장
 *
 * 주의:
 * - 이 테스트가 실패하면 API 변경이 의도적인지 확인 필요
 * - 의도적 변경 시 스냅샷 업데이트 필요
 */

import { describe, it, expect } from 'vitest';
import * as CompilerExports from '../../src/index.js';

// ============================================================================
// API Surface Types
// ============================================================================

type ExportCategory =
  | 'function'
  | 'class'
  | 'constant'
  | 'type-only'
  | 'enum-like'
  | 'object';

interface ExportSpec {
  name: string;
  category: ExportCategory;
  description?: string;
}

// ============================================================================
// Expected Public API Definition
// ============================================================================

/**
 * PRD FR에서 정의된 필수 Public API 목록
 *
 * 이 목록은 계약(Contract)으로서 작동합니다.
 * 새 export 추가는 허용되지만, 기존 항목 제거는 breaking change입니다.
 *
 * NOTE: API 이름은 실제 구현에 맞게 조정됨
 */
const EXPECTED_PUBLIC_API: ExportSpec[] = [
  // === Compiler Facade (FR1) ===
  { name: 'createCompiler', category: 'function', description: 'Main compiler factory' },

  // === Session (FR7) ===
  { name: 'createCompilerSession', category: 'function', description: 'Session factory' },

  // === Pass System (FR2) ===
  { name: 'PassRegistry', category: 'class', description: 'Pass registry class' },
  { name: 'PassExecutor', category: 'class', description: 'Pass executor class' },
  { name: 'createPassRegistry', category: 'function', description: 'Registry factory' },
  { name: 'createPassExecutor', category: 'function', description: 'Executor factory' },
  { name: 'createPassContext', category: 'function', description: 'Context factory' },
  { name: 'createFindingId', category: 'function', description: 'Finding ID generator' },
  { name: 'isNLPass', category: 'function', description: 'NL pass type guard' },

  // === Linker (FR3) ===
  { name: 'link', category: 'function', description: 'Basic linking' },
  { name: 'linkExtended', category: 'function', description: 'Extended linking' },
  { name: 'incrementalLink', category: 'function', description: 'Incremental linking' },
  { name: 'buildFragmentDependencyGraph', category: 'function', description: 'DAG builder' },
  { name: 'detectConflicts', category: 'function', description: 'Conflict detection' },

  // === Verifier (FR4) ===
  { name: 'verify', category: 'function', description: 'Basic verification' },
  { name: 'verifyFull', category: 'function', description: 'Full verification' },
  { name: 'verifyFragments', category: 'function', description: 'Fragment verification' },
  { name: 'validateDag', category: 'function', description: 'DAG validation' },
  { name: 'validateStatic', category: 'function', description: 'Static validation' },

  // === Patch/Codebook (FR5) ===
  { name: 'createPatch', category: 'function', description: 'Patch factory' },
  { name: 'applyPatch', category: 'function', description: 'Patch application' },
  // PatchOp factories (actual exported names)
  { name: 'replaceExprOp', category: 'function', description: 'Replace expression op' },
  { name: 'addDepOp', category: 'function', description: 'Add dependency op' },
  { name: 'removeFragmentOp', category: 'function', description: 'Remove fragment op' },
  { name: 'chooseConflictOp', category: 'function', description: 'Choose conflict op' },
  { name: 'renamePathOp', category: 'function', description: 'Rename path op' },
  { name: 'addFragmentOp', category: 'function', description: 'Add fragment op' },
  { name: 'createPatchHint', category: 'function', description: 'Create patch hint' },
  // Alias PatchOp helpers
  { name: 'applyAliasOp', category: 'function', description: 'Apply alias op' },
  { name: 'rejectAliasOp', category: 'function', description: 'Reject alias op' },
  { name: 'addAliasOp', category: 'function', description: 'Add alias op' },
  { name: 'removeAliasOp', category: 'function', description: 'Remove alias op' },
  // Codebook (actual exported names)
  { name: 'createCodebook', category: 'function', description: 'Codebook factory' },
  { name: 'getAliasById', category: 'function', description: 'Get alias by ID' },
  { name: 'getAliasForPath', category: 'function', description: 'Get alias for path' },
  { name: 'resolveToCanonical', category: 'function', description: 'Resolve to canonical' },
  { name: 'getAliasesForCanonical', category: 'function', description: 'Get aliases for canonical' },
  { name: 'hasAliasForPath', category: 'function', description: 'Has alias for path' },
  { name: 'addAliasSuggestion', category: 'function', description: 'Add alias suggestion' },
  { name: 'applyAlias', category: 'function', description: 'Apply alias' },
  { name: 'rejectAlias', category: 'function', description: 'Reject alias' },
  { name: 'removeAlias', category: 'function', description: 'Remove alias' },
  // Hint generation
  { name: 'analyzeForAliases', category: 'function', description: 'Analyze for aliases' },
  { name: 'generateAliasHints', category: 'function', description: 'Generate alias hints' },

  // === LLM Module (FR6) ===
  { name: 'createAnthropicAdapter', category: 'function', description: 'Anthropic adapter' },
  { name: 'createOpenAIAdapter', category: 'function', description: 'OpenAI adapter' },
  { name: 'RateLimiter', category: 'class', description: 'Rate limiter' },
  { name: 'withRetry', category: 'function', description: 'Retry wrapper' },
  { name: 'parseJSON', category: 'function', description: 'JSON parser' },
  { name: 'parseJSONArray', category: 'function', description: 'JSON array parser' },
  { name: 'hashPrompt', category: 'function', description: 'Prompt hasher' },
  { name: 'buildSystemPrompt', category: 'function', description: 'System prompt builder' },
  { name: 'buildUserPrompt', category: 'function', description: 'User prompt builder' },
  { name: 'buildMessages', category: 'function', description: 'Messages builder' },
  { name: 'RetryableError', category: 'class', description: 'Retryable error class' },

  // === Safety Module (PRD 6.9) ===
  { name: 'HITLGate', category: 'class', description: 'HITL Gate class' },
  { name: 'createHITLGate', category: 'function', description: 'HITL Gate factory' },
  { name: 'checkFragmentsForHITL', category: 'function', description: 'Check fragments for HITL' },
  { name: 'generateHITLIssues', category: 'function', description: 'Generate HITL issues' },
  { name: 'compareRiskLevels', category: 'function', description: 'Compare risk levels' },
  { name: 'isRiskAtLeast', category: 'function', description: 'Risk level check' },
  { name: 'validateAllowlist', category: 'function', description: 'Validate allowlist' },
  { name: 'generateAllowlistIssues', category: 'function', description: 'Generate allowlist issues' },
  { name: 'hasAllowlistViolations', category: 'function', description: 'Has allowlist violations' },

  // === Fragment Module ===
  { name: 'generateStableFragmentId', category: 'function', description: 'Stable ID generator' },
  { name: 'generateRandomFragmentId', category: 'function', description: 'Random ID generator' },
  { name: 'generateOriginHash', category: 'function', description: 'Origin hash generator' },
  { name: 'fragmentIdMatchesKind', category: 'function', description: 'ID-kind matcher' },
  { name: 'extractKindFromFragmentId', category: 'function', description: 'Extract kind from ID' },
  { name: 'regenerateFragmentIdIfNeeded', category: 'function', description: 'Regenerate ID if needed' },
  { name: 'createSchemaFragment', category: 'function', description: 'Schema fragment factory' },
  { name: 'createSourceFragment', category: 'function', description: 'Source fragment factory' },
  { name: 'createExpressionFragment', category: 'function', description: 'Expression fragment factory' },
  { name: 'createDerivedFragment', category: 'function', description: 'Derived fragment factory' },
  { name: 'createPolicyFragment', category: 'function', description: 'Policy fragment factory' },
  { name: 'createEffectFragment', category: 'function', description: 'Effect fragment factory' },
  { name: 'createActionFragment', category: 'function', description: 'Action fragment factory' },
  { name: 'createStatementFragment', category: 'function', description: 'Statement fragment factory' },
  { name: 'cloneFragment', category: 'function', description: 'Clone fragment' },
  { name: 'updateFragmentRequires', category: 'function', description: 'Update requires' },
  { name: 'addEvidence', category: 'function', description: 'Add evidence' },
  { name: 'setConfidence', category: 'function', description: 'Set confidence' },
  { name: 'COMPILER_VERSION', category: 'constant', description: 'Compiler version' },

  // === Runtime Module ===
  { name: 'compilerDomain', category: 'object', description: 'Compiler domain definition' },
  { name: 'getInitialCompilerData', category: 'function', description: 'Get initial data' },
  { name: 'getInitialCompilerState', category: 'function', description: 'Get initial state' },
];

// ============================================================================
// Contract Tests
// ============================================================================

describe('Contract: Public API Surface', () => {
  /**
   * Test that all expected exports exist
   * This is the core contract test
   */
  describe('Required Exports', () => {
    for (const spec of EXPECTED_PUBLIC_API) {
      it(`should export ${spec.name} (${spec.category})`, () => {
        expect(CompilerExports).toHaveProperty(spec.name);

        const exportedValue = (CompilerExports as Record<string, unknown>)[spec.name];

        // Verify category matches actual type
        switch (spec.category) {
          case 'function':
            expect(typeof exportedValue).toBe('function');
            break;
          case 'class':
            expect(typeof exportedValue).toBe('function');
            // Classes have prototype
            expect(exportedValue).toHaveProperty('prototype');
            break;
          case 'constant':
            expect(['string', 'number', 'boolean']).toContain(typeof exportedValue);
            break;
          case 'object':
            expect(typeof exportedValue).toBe('object');
            expect(exportedValue).not.toBeNull();
            break;
          // type-only exports won't be in runtime
        }
      });
    }
  });

  /**
   * Snapshot test for the complete export list
   * This catches any additions or removals
   */
  describe('Export List Snapshot', () => {
    it('should have stable export list', () => {
      const exportNames = Object.keys(CompilerExports).sort();
      expect(exportNames).toMatchSnapshot();
    });

    it('should have expected number of exports', () => {
      const exportCount = Object.keys(CompilerExports).length;
      // Snapshot the count - if this changes, it's a potential breaking change
      expect(exportCount).toMatchSnapshot();
    });
  });

  /**
   * Verify no unexpected exports are removed
   */
  describe('Backward Compatibility', () => {
    it('should include all required exports from EXPECTED_PUBLIC_API', () => {
      const actualExports = new Set(Object.keys(CompilerExports));
      const missingExports = EXPECTED_PUBLIC_API.filter(
        (spec) => !actualExports.has(spec.name)
      );

      if (missingExports.length > 0) {
        const missingNames = missingExports.map((e) => e.name).join(', ');
        throw new Error(`Missing required exports: ${missingNames}`);
      }

      expect(missingExports).toHaveLength(0);
    });
  });

  /**
   * Categorize exports for documentation
   */
  describe('Export Categories', () => {
    it('should have categorized exports snapshot', () => {
      const categorized: Record<string, string[]> = {
        functions: [],
        classes: [],
        constants: [],
        objects: [],
        other: [],
      };

      for (const [name, value] of Object.entries(CompilerExports)) {
        if (typeof value === 'function') {
          // Distinguish classes from functions
          if (
            value.prototype &&
            Object.getOwnPropertyNames(value.prototype).length > 1
          ) {
            categorized.classes.push(name);
          } else {
            categorized.functions.push(name);
          }
        } else if (typeof value === 'object' && value !== null) {
          categorized.objects.push(name);
        } else if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          categorized.constants.push(name);
        } else {
          categorized.other.push(name);
        }
      }

      // Sort each category for determinism
      for (const category of Object.keys(categorized)) {
        categorized[category]!.sort();
      }

      expect(categorized).toMatchSnapshot();
    });
  });
});

// ============================================================================
// Type Contract Tests (compile-time verification)
// ============================================================================

describe('Contract: Type Imports', () => {
  /**
   * These tests verify that types can be imported.
   * They're compile-time tests - if compilation fails, types are broken.
   */
  it('should export Fragment types', () => {
    // These are type-only imports, verified at compile time
    type _Fragment = import('../../src/index.js').Fragment;
    type _FragmentKind = import('../../src/index.js').FragmentKind;
    type _FragmentId = import('../../src/index.js').FragmentId;
    expect(true).toBe(true); // Compile-time test
  });

  it('should export Issue types', () => {
    type _Issue = import('../../src/index.js').Issue;
    type _IssueCode = import('../../src/index.js').IssueCode;
    type _IssueSeverity = import('../../src/index.js').IssueSeverity;
    expect(true).toBe(true);
  });

  it('should export Conflict types', () => {
    type _Conflict = import('../../src/index.js').Conflict;
    type _ConflictType = import('../../src/index.js').ConflictType;
    expect(true).toBe(true);
  });

  it('should export Patch types', () => {
    type _Patch = import('../../src/index.js').Patch;
    type _PatchOp = import('../../src/index.js').PatchOp;
    type _PatchHint = import('../../src/index.js').PatchHint;
    expect(true).toBe(true);
  });

  it('should export Session types', () => {
    type _CompilerSession = import('../../src/index.js').CompilerSession;
    type _CompilerSessionPhase = import('../../src/index.js').CompilerSessionPhase;
    expect(true).toBe(true);
  });

  it('should export Artifact types', () => {
    type _Artifact = import('../../src/index.js').Artifact;
    type _CompileInput = import('../../src/index.js').CompileInput;
    type _CompileResult = import('../../src/index.js').CompileResult;
    expect(true).toBe(true);
  });

  it('should export LLM types', () => {
    type _LLMAdapter = import('../../src/index.js').LLMAdapter;
    type _LLMResponse = import('../../src/index.js').LLMResponse;
    type _RateLimiterConfig = import('../../src/index.js').RateLimiterConfig;
    expect(true).toBe(true);
  });

  it('should export Linker types', () => {
    type _LinkResult = import('../../src/index.js').LinkResult;
    type _LinkerOptions = import('../../src/index.js').LinkerOptions;
    expect(true).toBe(true);
  });

  it('should export Verifier types', () => {
    type _VerifyResult = import('../../src/index.js').VerifyResult;
    type _VerifierOptions = import('../../src/index.js').VerifierOptions;
    expect(true).toBe(true);
  });
});

// ============================================================================
// Signature Contract Tests
// ============================================================================

describe('Contract: Function Signatures', () => {
  /**
   * Test that critical functions have expected signatures.
   * These tests verify the "shape" of the API.
   */

  it('createCompiler should accept config and return compiler', () => {
    const compiler = CompilerExports.createCompiler({});
    expect(compiler).toHaveProperty('compile');
    expect(compiler).toHaveProperty('compileFragments');
    expect(compiler).toHaveProperty('link');
    expect(compiler).toHaveProperty('verify');
    expect(compiler).toHaveProperty('suggestPatches');
    expect(compiler).toHaveProperty('applyPatch');
    expect(compiler).toHaveProperty('createSession');
  });

  it('createCompilerSession should require compiler and return session', () => {
    // createCompilerSession requires a Compiler argument
    const compiler = CompilerExports.createCompiler({});
    const session = CompilerExports.createCompilerSession(compiler);
    expect(session).toHaveProperty('getSnapshot');
    expect(session).toHaveProperty('onPhaseChange');
    expect(session).toHaveProperty('onSnapshotChange');
    expect(session).toHaveProperty('compile');
  });

  it('link should accept fragments and return LinkResult', async () => {
    const result = await CompilerExports.link([]);
    // LinkResult has fragments, issues, conflicts
    expect(result).toHaveProperty('fragments');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('conflicts');
  });

  it('verifyFragments should accept fragments and return VerifyResult', async () => {
    // verifyFragments is the function that takes fragments directly
    const result = await CompilerExports.verifyFragments([]);
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('issues');
  });

  it('createPatch should accept ops and return Patch', () => {
    const patch = CompilerExports.createPatch([]);
    expect(patch).toHaveProperty('ops');
    expect(patch).toHaveProperty('id');
    expect(patch).toHaveProperty('description');
  });

  it('RateLimiter should be constructable', () => {
    const limiter = new CompilerExports.RateLimiter({ tokensPerSecond: 10 });
    expect(limiter).toHaveProperty('acquire');
  });

  it('createHITLGate should return gate with requiresApproval method', () => {
    // createHITLGate requires config
    const gate = CompilerExports.createHITLGate({ requireApprovalFor: ['high'] });
    expect(gate).toHaveProperty('requiresApproval');
    expect(gate).toHaveProperty('requestApproval');
    expect(typeof gate.requiresApproval).toBe('function');
    expect(typeof gate.requestApproval).toBe('function');
  });
});
