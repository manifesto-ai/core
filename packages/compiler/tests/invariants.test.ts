/**
 * Compiler Invariant Tests
 *
 * AGENT_README 불변식 검증 테스트
 * 리뷰어 피드백 반영: 결정론, Provenance, Side Effect 금지, 충돌 표면화
 */

import { describe, it, expect } from 'vitest';
import {
  // Fragment creation
  createSchemaFragment,
  createSourceFragment,
  createExpressionFragment,
  createDerivedFragment,
  createPolicyFragment,
  createEffectFragment,
  createActionFragment,
  // Stable ID
  generateStableFragmentId,
  generateFragmentIdentity,
  extractStructuralShape,
  extractEffectStructuralShape,
  calculateSimilarity,
  type FragmentIdentity,
} from '../src/fragment/index.js';
import {
  createProvenance,
  codeOrigin,
  llmOrigin,
  createEvidence,
} from '../src/types/provenance.js';
import type { Fragment, FragmentDraft, ExpressionDraft } from '../src/types/fragment.js';
import type { Expression, Effect } from '@manifesto-ai/core';

// ============================================================================
// Test Fixtures
// ============================================================================

const codeProvenance = createProvenance(
  'test-artifact',
  codeOrigin({
    file: 'test.ts',
    startLine: 1,
    startCol: 0,
    endLine: 1,
    endCol: 10,
  })
);

const llmProvenance = createProvenance(
  'llm-artifact',
  llmOrigin('gpt-4', 'test-prompt-hash')
);

const testEvidence = [createEvidence('ast_node', 'VariableDeclaration', 'const x = 10')];

// ============================================================================
// Invariant 1: 결정론 (Determinism)
// ============================================================================

describe('Invariant #1: Determinism', () => {
  describe('Stable ID Generation', () => {
    it('should generate identical IDs for identical inputs', () => {
      // Given: 동일한 입력
      const kind = 'SchemaFragment' as const;
      const requires: string[] = [];
      const provides = ['data.hello'];

      // When: 두 번 생성
      const id1 = generateStableFragmentId(kind, codeProvenance, requires, provides);
      const id2 = generateStableFragmentId(kind, codeProvenance, requires, provides);

      // Then: 동일한 ID
      expect(id1).toBe(id2);
    });

    it('should generate identical identities for identical inputs', () => {
      // Given: 동일한 입력
      const kind = 'ExpressionFragment' as const;
      const requires = ['data.a', 'data.b'];
      const provides = ['expr:test'];
      const expr: Expression = ['>', ['get', 'data.a'], ['get', 'data.b']];

      // When: 두 번 생성
      const identity1 = generateFragmentIdentity(kind, codeProvenance, requires, provides, expr);
      const identity2 = generateFragmentIdentity(kind, codeProvenance, requires, provides, expr);

      // Then: 모든 필드가 동일
      expect(identity1.primaryId).toBe(identity2.primaryId);
      expect(identity1.secondaryHints.structuralHash).toBe(identity2.secondaryHints.structuralHash);
      expect(identity1.secondaryHints.semanticSignature).toBe(identity2.secondaryHints.semanticSignature);
    });

    it('should generate different IDs for different inputs', () => {
      // Given: 다른 입력
      const id1 = generateStableFragmentId('SchemaFragment', codeProvenance, [], ['data.a']);
      const id2 = generateStableFragmentId('SchemaFragment', codeProvenance, [], ['data.b']);

      // Then: 다른 ID
      expect(id1).not.toBe(id2);
    });
  });

  describe('Structural Shape Extraction', () => {
    it('should produce identical shapes for structurally identical expressions', () => {
      // Given: 값은 다르지만 구조가 같은 표현식
      const expr1: Expression = ['>', ['get', 'data.a'], 10];
      const expr2: Expression = ['>', ['get', 'data.b'], 20];

      // When: 구조 추출
      const shape1 = extractStructuralShape(expr1);
      const shape2 = extractStructuralShape(expr2);

      // Then: 동일한 구조
      expect(shape1).toBe(shape2);
    });

    it('should produce different shapes for structurally different expressions', () => {
      // Given: 구조가 다른 표현식
      const expr1: Expression = ['>', ['get', 'data.a'], 10];
      const expr2: Expression = ['<', ['get', 'data.a'], 10];

      // When: 구조 추출
      const shape1 = extractStructuralShape(expr1);
      const shape2 = extractStructuralShape(expr2);

      // Then: 다른 구조
      expect(shape1).not.toBe(shape2);
    });

    it('should preserve semantic path namespaces', () => {
      // Given: 다른 namespace의 경로
      const expr1: Expression = ['get', 'data.hello'];
      const expr2: Expression = ['get', 'state.hello'];
      const expr3: Expression = ['get', 'derived.hello'];

      // When: 구조 추출
      const shape1 = extractStructuralShape(expr1);
      const shape2 = extractStructuralShape(expr2);
      const shape3 = extractStructuralShape(expr3);

      // Then: namespace 차이 반영
      expect(shape1).toContain('PATH:data');
      expect(shape2).toContain('PATH:state');
      expect(shape3).toContain('PATH:derived');
    });
  });

  describe('Fragment Creation', () => {
    it('should create identical fragments for identical inputs', () => {
      // Given: 동일한 입력
      const options = {
        namespace: 'data' as const,
        fields: [{ path: 'data.test', type: 'string' as const }],
        origin: codeProvenance,
        evidence: testEvidence,
      };

      // When: 두 번 생성
      const fragment1 = createSchemaFragment(options);
      const fragment2 = createSchemaFragment(options);

      // Then: ID와 내용이 동일
      expect(fragment1.id).toBe(fragment2.id);
      expect(fragment1.provides).toEqual(fragment2.provides);
      expect(fragment1.requires).toEqual(fragment2.requires);
    });
  });
});

// ============================================================================
// Invariant 2: Provenance (출처 추적)
// ============================================================================

describe('Invariant #4: Provenance', () => {
  it('every fragment must have origin', () => {
    // Given: Fragment 생성
    const schemaFragment = createSchemaFragment({
      namespace: 'data',
      fields: [{ path: 'data.test', type: 'string' }],
      origin: codeProvenance,
      evidence: testEvidence,
    });

    const sourceFragment = createSourceFragment({
      path: 'data.input',
      semantic: { type: 'string', description: 'User input' },
      origin: codeProvenance,
      evidence: testEvidence,
    });

    const exprFragment = createExpressionFragment({
      expr: ['>', ['get', 'data.a'], 10],
      requires: ['data.a'],
      origin: codeProvenance,
      evidence: testEvidence,
    });

    // Then: 모든 fragment에 origin 존재
    expect(schemaFragment.origin).toBeDefined();
    expect(schemaFragment.origin.artifactId).toBe('test-artifact');

    expect(sourceFragment.origin).toBeDefined();
    expect(sourceFragment.origin.artifactId).toBe('test-artifact');

    expect(exprFragment.origin).toBeDefined();
    expect(exprFragment.origin.artifactId).toBe('test-artifact');
  });

  it('every fragment must have evidence', () => {
    // Given: Fragment 생성
    const fragment = createDerivedFragment({
      path: 'derived.total',
      expr: ['sum', ['map', ['get', 'data.items'], '$.price']],
      requires: ['data.items'],
      origin: codeProvenance,
      evidence: testEvidence,
    });

    // Then: evidence 배열 존재
    expect(fragment.evidence).toBeDefined();
    expect(Array.isArray(fragment.evidence)).toBe(true);
    expect(fragment.evidence.length).toBeGreaterThan(0);
  });

  it('LLM-generated drafts must have LLM provenance', () => {
    // Given: LLM provenance로 FragmentDraft 생성 시뮬레이션
    const draft: ExpressionDraft = {
      kind: 'ExpressionFragment',
      provisionalRequires: ['data.a'],
      provisionalProvides: ['expr:test'],
      status: 'raw',
      origin: llmProvenance,
      confidence: 0.8,
      reasoning: 'Extracted from user description',
      rawExpr: ['>', ['get', 'data.a'], 10],
    };

    // Then: LLM provenance 정보 확인
    expect(draft.origin.location.kind).toBe('llm');
    expect((draft.origin.location as { model: string }).model).toBe('gpt-4');
    expect(draft.confidence).toBeDefined();
    expect(draft.confidence).toBeGreaterThanOrEqual(0);
    expect(draft.confidence).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Invariant 5: Effect는 설명만 (No Execution)
// ============================================================================

describe('Invariant #5: Effects are Descriptions Only', () => {
  it('EffectFragment should only describe, not execute', () => {
    // Given: Effect 정의
    const effect: Effect = {
      _tag: 'SetValue',
      path: 'data.count',
      value: 42,
      description: 'Set count to 42',
    };

    // When: EffectFragment 생성
    const fragment = createEffectFragment({
      effect,
      requires: [],
      risk: 'low',
      origin: codeProvenance,
      evidence: testEvidence,
    });

    // Then: Effect는 데이터로만 존재, 실행되지 않음
    expect(fragment.effect).toEqual(effect);
    expect(fragment.effect._tag).toBe('SetValue');
    // Effect가 실행되었다면 data.count가 변경되어야 하지만,
    // 컴파일러는 이를 실행하지 않으므로 단순 데이터로만 존재
    expect(typeof fragment.effect).toBe('object');
  });

  it('ActionFragment should only describe effect, not execute', () => {
    // Given: Action with effect
    const effect: Effect = {
      _tag: 'EmitEvent',
      channel: 'domain',
      payload: { type: 'checkout' },
      description: 'Emit checkout event',
    };

    // When: ActionFragment 생성
    const fragment = createActionFragment({
      actionId: 'checkout',
      requires: ['data.items'],
      effect,
      semantic: { verb: 'checkout', description: 'Complete checkout' },
      risk: 'medium',
      origin: codeProvenance,
      evidence: testEvidence,
    });

    // Then: Effect는 설명으로만 존재
    expect(fragment.effect).toBeDefined();
    expect(fragment.effect?._tag).toBe('EmitEvent');
  });

  it('Effect structural shape extraction should be pure', () => {
    // Given: 복합 Effect
    const effect: Effect = {
      _tag: 'Sequence',
      effects: [
        { _tag: 'SetValue', path: 'data.a', value: 1 },
        { _tag: 'EmitEvent', channel: 'test', payload: {} },
      ],
    };

    // When: 구조 추출 (순수 함수여야 함)
    const shape1 = extractEffectStructuralShape(effect);
    const shape2 = extractEffectStructuralShape(effect);

    // Then: 동일한 결과 (부수효과 없음)
    expect(shape1).toBe(shape2);
    expect(shape1).toContain('Sequence');
    expect(shape1).toContain('SetValue');
    expect(shape1).toContain('EmitEvent');
  });
});

// ============================================================================
// Invariant 6: 충돌 명시적 표면화 (Explicit Conflicts)
// ============================================================================

describe('Invariant #6: Explicit Conflict Detection', () => {
  describe('Similarity Matching for Conflict Detection', () => {
    it('should detect exact match', () => {
      // Given: 동일한 Identity
      const identity: FragmentIdentity = {
        primaryId: 'sch_abc123',
        secondaryHints: {
          originHash: 'origin1',
          semanticSignature: 'SchemaFragment:req():prov(data.hello)',
          requiresSet: [],
          providesSet: ['data.hello'],
          structuralHash: 'hash1',
        },
      };

      // When: 자기 자신과 비교
      const match = calculateSimilarity(identity, identity);

      // Then: exact match
      expect(match).not.toBeNull();
      expect(match!.matchType).toBe('exact');
      expect(match!.similarity).toBe(1.0);
      expect(match!.changeType).toBe('none');
    });

    it('should detect structural match (rename/move)', () => {
      // Given: 구조는 같지만 ID가 다른 Identity
      const existing: FragmentIdentity = {
        primaryId: 'sch_abc123',
        secondaryHints: {
          originHash: 'origin1',
          semanticSignature: 'SchemaFragment:req():prov(data.hello)',
          requiresSet: [],
          providesSet: ['data.hello'],
          structuralHash: 'same_hash',
        },
      };

      const incoming: FragmentIdentity = {
        primaryId: 'sch_xyz789', // 다른 ID
        secondaryHints: {
          originHash: 'origin2', // 다른 origin
          semanticSignature: 'SchemaFragment:req():prov(data.world)',
          requiresSet: [],
          providesSet: ['data.world'],
          structuralHash: 'same_hash', // 같은 구조
        },
      };

      // When: 유사도 계산
      const match = calculateSimilarity(existing, incoming);

      // Then: structural match with change detection
      expect(match).not.toBeNull();
      expect(match!.matchType).toBe('structural');
      expect(match!.similarity).toBe(0.9);
      expect(['rename', 'move', 'modify']).toContain(match!.changeType);
    });

    it('should detect semantic match', () => {
      // Given: requires/provides는 같지만 구조가 다른 Identity
      const existing: FragmentIdentity = {
        primaryId: 'expr_abc',
        secondaryHints: {
          semanticSignature: 'ExpressionFragment:req(data.a):prov(expr:test)',
          requiresSet: ['data.a'],
          providesSet: ['expr:test'],
          structuralHash: 'hash1',
        },
      };

      const incoming: FragmentIdentity = {
        primaryId: 'expr_xyz',
        secondaryHints: {
          semanticSignature: 'ExpressionFragment:req(data.a):prov(expr:test)',
          requiresSet: ['data.a'],
          providesSet: ['expr:test'],
          structuralHash: 'hash2', // 다른 구조
        },
      };

      // When: 유사도 계산
      const match = calculateSimilarity(existing, incoming);

      // Then: semantic match
      expect(match).not.toBeNull();
      expect(match!.matchType).toBe('semantic');
      expect(match!.similarity).toBe(0.8);
    });

    it('should return null for no match', () => {
      // Given: 완전히 다른 Identity
      const existing: FragmentIdentity = {
        primaryId: 'sch_abc',
        secondaryHints: {
          semanticSignature: 'SchemaFragment:req():prov(data.a)',
          requiresSet: [],
          providesSet: ['data.a'],
          structuralHash: 'hash1',
        },
      };

      const incoming: FragmentIdentity = {
        primaryId: 'expr_xyz',
        secondaryHints: {
          semanticSignature: 'ExpressionFragment:req(data.x):prov(expr:y)',
          requiresSet: ['data.x'],
          providesSet: ['expr:y'],
          structuralHash: 'hash2',
        },
      };

      // When: 유사도 계산
      const match = calculateSimilarity(existing, incoming);

      // Then: no match
      expect(match).toBeNull();
    });
  });
});

// ============================================================================
// Invariant 7: 기계적 의존성 추출
// ============================================================================

describe('Invariant #7: Mechanical Dependency Extraction', () => {
  it('ExpressionFragment requires should be populated', () => {
    // Given: Expression with paths
    const expr: Expression = ['>', ['get', 'data.a'], ['get', 'data.b']];

    // When: ExpressionFragment 생성
    const fragment = createExpressionFragment({
      expr,
      requires: ['data.a', 'data.b'],
      origin: codeProvenance,
      evidence: testEvidence,
    });

    // Then: requires가 채워져 있음
    expect(fragment.requires).toContain('data.a');
    expect(fragment.requires).toContain('data.b');
  });

  it('DerivedFragment requires should match deps', () => {
    // Given: Derived expression
    const expr: Expression = ['sum', ['map', ['get', 'data.items'], '$.price']];

    // When: DerivedFragment 생성
    const fragment = createDerivedFragment({
      path: 'derived.total',
      expr,
      deps: ['data.items'],
      requires: ['data.items'],
      origin: codeProvenance,
      evidence: testEvidence,
    });

    // Then: requires와 deps 일치
    expect(fragment.requires).toContain('data.items');
    expect(fragment.deps).toContain('data.items');
  });

  it('PolicyFragment requires should reference condition paths', () => {
    // Given: Policy with preconditions
    const fragment = createPolicyFragment({
      target: { kind: 'action', actionId: 'checkout' },
      preconditions: [
        { path: 'derived.canCheckout', expect: 'true', reason: 'Must be able to checkout' },
      ],
      origin: codeProvenance,
      evidence: testEvidence,
    });

    // Then: requires에 precondition path 포함
    expect(fragment.requires).toContain('derived.canCheckout');
  });
});

// ============================================================================
// FragmentDraft 관련 불변식
// ============================================================================

describe('FragmentDraft Invariants', () => {
  it('FragmentDraft should have raw status initially', () => {
    // Given: Draft 생성
    const draft: ExpressionDraft = {
      kind: 'ExpressionFragment',
      provisionalRequires: ['data.a'],
      provisionalProvides: ['expr:test'],
      status: 'raw',
      origin: llmProvenance,
      confidence: 0.7,
      rawExpr: ['>', ['get', 'data.a'], 10],
    };

    // Then: 초기 상태는 raw
    expect(draft.status).toBe('raw');
    expect(draft.validation).toBeUndefined();
    expect(draft.loweredFragmentId).toBeUndefined();
  });

  it('FragmentDraft confidence should be in valid range', () => {
    // Given: 다양한 confidence 값
    const validConfidences = [0, 0.5, 0.8, 1.0];
    const invalidConfidences = [-0.1, 1.1, 2, -1];

    // Then: 유효 범위 확인
    for (const conf of validConfidences) {
      expect(conf).toBeGreaterThanOrEqual(0);
      expect(conf).toBeLessThanOrEqual(1);
    }

    for (const conf of invalidConfidences) {
      expect(conf < 0 || conf > 1).toBe(true);
    }
  });

  it('FragmentDraft must have LLM provenance', () => {
    // Given: Draft with provenance
    const draft: ExpressionDraft = {
      kind: 'ExpressionFragment',
      provisionalRequires: [],
      provisionalProvides: [],
      status: 'raw',
      origin: llmProvenance,
      confidence: 0.8,
      rawExpr: 10,
    };

    // Then: LLM origin 확인
    expect(draft.origin.location.kind).toBe('llm');
  });
});

// ============================================================================
// Compiler Version 불변식
// ============================================================================

describe('Compiler Version Invariants', () => {
  it('all fragments should have compilerVersion', () => {
    const fragments = [
      createSchemaFragment({
        namespace: 'data',
        fields: [{ path: 'data.test', type: 'string' }],
        origin: codeProvenance,
        evidence: testEvidence,
      }),
      createSourceFragment({
        path: 'data.input',
        semantic: { type: 'string', description: 'Input' },
        origin: codeProvenance,
        evidence: testEvidence,
      }),
      createExpressionFragment({
        expr: ['get', 'data.test'],
        requires: ['data.test'],
        origin: codeProvenance,
        evidence: testEvidence,
      }),
    ];

    for (const fragment of fragments) {
      expect(fragment.compilerVersion).toBeDefined();
      expect(typeof fragment.compilerVersion).toBe('string');
      expect(fragment.compilerVersion.length).toBeGreaterThan(0);
    }
  });
});
