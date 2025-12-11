# HSCA × Manifesto 통합 아키텍처 기획 v2

**Hierarchical Sparse Context Architecture with Manifesto Semantic Runtime**

---

## 1. 개요: 왜 Manifesto인가?

HSCA의 핵심 문제는 **"LLM 출력의 비결정성"**이다.

```
일반 LLM 출력:
"사용자의 이름은 John이고, 나이는 30세입니다. 
 따라서 성인 요금이 적용됩니다."

→ 이것을 어떻게 시스템 상태로 변환할 것인가?
→ 파싱 실패 시 어떻게 복구할 것인가?
→ "성인 요금"이라는 추론을 어떻게 검증할 것인가?
```

Manifesto는 이 문제에 대한 해답을 제공한다:

| HSCA 요구사항 | Manifesto 해결책 |
|---------------|------------------|
| 정보의 고유 주소 | Semantic Paths (`data.user.name`) |
| 계산의 선언적 표현 | Expression DSL (`{ $get: ... }`) |
| 부작용의 구조화 | Effect System (`sequence([...])`) |
| 조건부 로직 | Field Policies, Actions |
| 오류 처리 | Result Type (`ok`, `err`) |
| **LLM 컨텍스트 제어** | **viewScope** |

---

## 2. viewScope: HSCA의 핵심 메커니즘

### 2.1 왜 viewScope가 HSCA에 결정적인가?

HSCA의 핵심 주장:
> "LLM은 항상 2-4K 토큰만 본다"

이 주장을 **구현 수준에서 강제**하는 메커니즘이 viewScope다.

```
┌─────────────────────────────────────────────────────────────┐
│                    Without viewScope                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Semantic Snapshot (전체)                                   │
│  ├── data.compressionTree (거대함)                          │
│  ├── data.entities (수천 개)                                │
│  ├── data.relations (수만 개)                               │
│  ├── state.retrievedContext (검색 결과)                     │
│  ├── state.reasoningPath (추론 경로)                        │
│  └── derived.* (계산된 값들)                                │
│                                                             │
│  → 전체를 LLM에게 전달? 토큰 폭발, 비용 폭발, 정확도 하락    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    With viewScope                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Action: addReasoningStep                                   │
│  viewScope: [                                               │
│    'state.currentQuery.parsed',                             │
│    'state.retrievedContext',      ← 검색된 요약만           │
│    'state.reasoningPath',         ← 현재까지 추론 경로      │
│    'derived.avgRelevance'         ← 판단에 필요한 지표      │
│  ]                                                          │
│                                                             │
│  → 정확히 필요한 것만 LLM에게 전달                          │
│  → 2-4K 토큰 제약 **기계적으로 강제**                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 viewScope의 HSCA 특화 설계

```typescript
// HSCA Action별 viewScope 정의
const hscaActions = {
  
  // ═══════════════════════════════════════════════════════
  // 질의 분석: 질의 텍스트만 필요
  // ═══════════════════════════════════════════════════════
  analyzeQuery: defineAction({
    viewScope: [
      'state.currentQuery.raw'  // 원본 질의만
    ],
    // LLM은 질의 텍스트만 보고 intent/targetPaths 추출
    effect: ...
  }),

  // ═══════════════════════════════════════════════════════
  // 컨텍스트 확장: 현재 검색 결과 + 트리 구조만 필요
  // ═══════════════════════════════════════════════════════
  expandContext: defineAction({
    viewScope: [
      'state.currentQuery.parsed.targetPaths',  // 목표 경로
      'state.retrievedContext',                  // 현재 검색 결과
      'derived.avgRelevance',                    // 관련성 점수
      'derived.withinTokenBudget'                // 예산 여유
    ],
    // LLM은 "어떤 노드를 확장할지"만 결정
    // 전체 트리 구조는 볼 필요 없음!
    effect: ...
  }),

  // ═══════════════════════════════════════════════════════
  // 추론 단계 추가: 질의 + 컨텍스트 + 현재 추론 경로
  // ═══════════════════════════════════════════════════════
  addReasoningStep: defineAction({
    viewScope: [
      'state.currentQuery.parsed',    // 파싱된 질의
      'state.retrievedContext',       // 검색된 요약들
      'state.reasoningPath',          // 지금까지의 추론
      'derived.reasoningComplete'     // 완료 여부 판단용
    ],
    // 이것만으로 추론 가능 - 전체 엔티티/관계 불필요
    effect: ...
  }),

  // ═══════════════════════════════════════════════════════
  // 엔티티 추가: 현재 컨텍스트에서 추출
  // ═══════════════════════════════════════════════════════
  addEntity: defineAction({
    viewScope: [
      'state.retrievedContext',       // 엔티티 추출 대상
      'data.entities'                 // 중복 체크용 (요약만)
    ],
    // 전체 엔티티 목록이 아닌 현재 청크에서 추출
    effect: ...
  }),

  // ═══════════════════════════════════════════════════════
  // 관계 추가: 엔티티 쌍 + 증거
  // ═══════════════════════════════════════════════════════
  addRelation: defineAction({
    viewScope: [
      'state.retrievedContext',       // 관계 증거
      'input.source',                 // 소스 엔티티
      'input.target'                  // 타겟 엔티티
    ],
    // 전체 관계 그래프 불필요
    effect: ...
  }),

  // ═══════════════════════════════════════════════════════
  // 추론 완료: 최종 검증용 최소 정보
  // ═══════════════════════════════════════════════════════
  completeReasoning: defineAction({
    viewScope: [
      'state.currentQuery.parsed.intent',  // 원래 의도
      'state.reasoningPath',               // 전체 추론 경로
      'derived.avgRelevance'               // 신뢰도 지표
    ],
    // 결론 도출에 필요한 최소 정보
    effect: ...
  })
};
```

### 2.3 viewScope Projection Engine

```typescript
// HSCA 전용 Projection Engine
class HSCAProjectionEngine {
  
  constructor(
    private runtime: ManifestoRuntime,
    private tokenBudget: number = 4000
  ) {}

  /**
   * 액션 실행 전 LLM에게 전달할 컨텍스트 생성
   */
  createLLMContext(
    actionId: string,
    fullSnapshot: Snapshot
  ): Result<ProjectedContext, ProjectionError> {
    
    const action = this.runtime.domain.actions[actionId];
    if (!action) {
      return err({ code: 'UNKNOWN_ACTION', message: `Action not found: ${actionId}` });
    }

    // 1. viewScope에 따라 스냅샷 프로젝션
    const projectedSnapshot = this.projectSnapshot(
      fullSnapshot,
      action.viewScope
    );

    // 2. 토큰 수 계산
    const estimatedTokens = this.estimateTokens(projectedSnapshot);

    // 3. 예산 초과 시 추가 압축
    if (estimatedTokens > this.tokenBudget) {
      return this.compressToFit(projectedSnapshot, this.tokenBudget);
    }

    return ok({
      snapshot: projectedSnapshot,
      tokenCount: estimatedTokens,
      actionId,
      viewScope: action.viewScope
    });
  }

  /**
   * viewScope 경로에 따른 스냅샷 프로젝션
   */
  private projectSnapshot(
    full: Snapshot,
    viewScope: string[]
  ): Partial<Snapshot> {
    
    if (!viewScope || viewScope.length === 0) {
      // viewScope 미정의 시 경고 로그 + 전체 반환 (개발 중에만)
      console.warn('viewScope not defined - returning full snapshot');
      return full;
    }

    const projected: any = {};
    
    for (const path of viewScope) {
      const value = get(full, path);
      if (value !== undefined) {
        set(projected, path, value);
      }
    }

    return projected;
  }

  /**
   * 토큰 예산에 맞게 추가 압축
   */
  private compressToFit(
    projected: Partial<Snapshot>,
    budget: number
  ): Result<ProjectedContext, ProjectionError> {
    
    // 전략 1: retrievedContext 개수 줄이기
    if (projected.state?.retrievedContext) {
      const contexts = projected.state.retrievedContext;
      const sorted = [...contexts].sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      // 상위 N개만 유지
      for (let n = sorted.length; n > 0; n--) {
        const trimmed = { ...projected };
        trimmed.state = { 
          ...trimmed.state, 
          retrievedContext: sorted.slice(0, n) 
        };
        
        if (this.estimateTokens(trimmed) <= budget) {
          return ok({
            snapshot: trimmed,
            tokenCount: this.estimateTokens(trimmed),
            compressed: true,
            originalContextCount: contexts.length,
            remainingContextCount: n
          });
        }
      }
    }

    // 전략 2: 요약 내용 truncate
    // ... 추가 압축 전략

    return err({ 
      code: 'CANNOT_FIT_BUDGET', 
      message: `Cannot compress to ${budget} tokens` 
    });
  }

  private estimateTokens(obj: any): number {
    // 간단한 추정: JSON 문자열 길이 / 4
    return Math.ceil(JSON.stringify(obj).length / 4);
  }
}
```

### 2.4 viewScope의 계층적 설계

HSCA에서 viewScope는 **추론 단계에 따라 다른 "시야"**를 제공한다:

```
┌─────────────────────────────────────────────────────────────┐
│                    추론 단계별 viewScope                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Stage 1: Query Analysis                                    │
│  ┌─────────────────┐                                        │
│  │ currentQuery    │  ← 질의 텍스트만                       │
│  └─────────────────┘                                        │
│           ↓                                                 │
│  Stage 2: Context Retrieval                                 │
│  ┌─────────────────┐                                        │
│  │ parsedQuery     │                                        │
│  │ treeStructure   │  ← 트리 메타데이터 (내용 X)            │
│  └─────────────────┘                                        │
│           ↓                                                 │
│  Stage 3: Reasoning                                         │
│  ┌─────────────────┐                                        │
│  │ parsedQuery     │                                        │
│  │ retrievedCtx    │  ← 검색된 요약들                       │
│  │ reasoningPath   │  ← 지금까지 추론                       │
│  └─────────────────┘                                        │
│           ↓                                                 │
│  Stage 4: Expansion (optional)                              │
│  ┌─────────────────┐                                        │
│  │ currentNode     │  ← 확장할 노드                         │
│  │ childPreviews   │  ← 자식 노드 미리보기                  │
│  └─────────────────┘                                        │
│           ↓                                                 │
│  Stage 5: Conclusion                                        │
│  ┌─────────────────┐                                        │
│  │ fullReasoning   │  ← 전체 추론 경로                      │
│  │ confidence      │  ← 신뢰도 지표                         │
│  └─────────────────┘                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 아키텍처 매핑 (viewScope 통합)

### 3.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    HSCA + Manifesto + viewScope             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ 대규모 컨텍스트    │    │  Manifesto      │                │
│  │ (문서, 대화, 코드) │    │  Domain         │                │
│  └────────┬────────┘    │  Definition     │                │
│           │             └────────┬────────┘                │
│           ↓                      │                          │
│  ┌─────────────────┐             │                          │
│  │ Semantic        │◄────────────┘                          │
│  │ Compression     │  Path 기반 청킹                         │
│  │ Tree (SCT)      │                                        │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ↓                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ Context Query   │    │  Expression     │                │
│  │ Engine (CQE)    │◄───│  DSL            │                │
│  └────────┬────────┘    └─────────────────┘                │
│           │                                                 │
│           ↓                                                 │
│  ┌─────────────────────────────────────────┐               │
│  │           viewScope Projection          │ ◄── 핵심!     │
│  │  ┌─────────────────────────────────┐   │               │
│  │  │ Full Snapshot → Projected View  │   │               │
│  │  │ (10MB → 2KB, 50K → 200 tokens)  │   │               │
│  │  └─────────────────────────────────┘   │               │
│  └────────────────┬────────────────────────┘               │
│                   │                                         │
│                   ↓ (2-4K tokens only)                      │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ Small LLM       │───►│  Action         │                │
│  │ Reasoner        │    │  Output         │                │
│  └────────┬────────┘    └────────┬────────┘                │
│           │                      ↓                          │
│           │             ┌─────────────────┐                │
│           │             │  Effect         │                │
│           │             │  System         │                │
│           │             └────────┬────────┘                │
│           ↓                      ↓                          │
│  ┌─────────────────────────────────────────┐               │
│  │         Semantic Snapshot Store          │               │
│  │   data.*, state.*, derived.*, async.*   │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 viewScope가 해결하는 HSCA의 핵심 문제

| 문제 | viewScope 없이 | viewScope 적용 |
|------|----------------|----------------|
| 토큰 폭발 | 전체 스냅샷 직렬화 → 수만 토큰 | 액션별 필요 데이터만 → 수백 토큰 |
| LLM 주의력 분산 | 불필요한 정보에 attention 낭비 | 관련 정보에만 집중 |
| 비용 | 매 호출 $5+ | 매 호출 $0.001 |
| 정확도 | 정보 과부하로 hallucination↑ | 집중된 컨텍스트로 정확도↑ |
| 2-4K 제약 강제 | 수동으로 잘라야 함 | **선언적으로 자동 강제** |

---

## 4. 상세 설계 (viewScope 통합)

### 4.1 HSCA Domain Definition with viewScope

```typescript
import { defineDomain, z, defineAction, defineDerived, fieldPolicy } from '@manifesto-ai/core';

const hscaDomain = defineDomain('hsca', {
  
  // ═══════════════════════════════════════════════════════
  // 4.1.1 Data Schema
  // ═══════════════════════════════════════════════════════
  dataSchema: z.object({
    compressionTree: z.object({
      root: z.lazy(() => SummaryNodeSchema),
      totalChunks: z.number(),
      totalTokens: z.number(),
      compressionRatio: z.number()
    }),
    entities: z.array(EntitySchema),
    relations: z.array(RelationSchema),
    conversationHistory: z.array(ConversationTurnSchema)
  }),

  // ═══════════════════════════════════════════════════════
  // 4.1.2 State Schema
  // ═══════════════════════════════════════════════════════
  stateSchema: z.object({
    currentQuery: z.object({
      raw: z.string(),
      parsed: ParsedQuerySchema.nullable(),
      status: QueryStatusSchema
    }),
    retrievedContext: z.array(RetrievedNodeSchema),
    reasoningPath: z.array(ReasoningStepSchema),
    lastError: ErrorSchema.nullable()
  }),

  // ═══════════════════════════════════════════════════════
  // 4.1.3 Derived
  // ═══════════════════════════════════════════════════════
  derived: {
    'derived.currentContextTokens': defineDerived(
      { $sum: { $map: [{ $get: 'state.retrievedContext' }, '$item.tokenCount'] } },
      z.number()
    ),
    'derived.withinTokenBudget': defineDerived(
      { $lte: [{ $get: 'derived.currentContextTokens' }, 4000] },
      z.boolean()
    ),
    'derived.avgRelevance': defineDerived(
      avgRelevanceExpression,
      z.number()
    ),
    'derived.needsExpansion': defineDerived(
      { $and: [
        { $lt: [{ $get: 'derived.avgRelevance' }, 0.5] },
        { $get: 'derived.withinTokenBudget' }
      ]},
      z.boolean()
    ),
    'derived.reasoningComplete': defineDerived(
      { $and: [
        { $eq: [{ $get: 'state.currentQuery.status' }, 'complete'] },
        { $gt: [{ $size: { $get: 'state.reasoningPath' } }, 0] }
      ]},
      z.boolean()
    )
  },

  // ═══════════════════════════════════════════════════════
  // 4.1.4 Actions with viewScope
  // ═══════════════════════════════════════════════════════
  actions: {
    
    // 질의 분석
    analyzeQuery: defineAction({
      meta: {
        description: '사용자 질의를 분석하여 의도와 대상 경로 추출',
        llmGenerated: true,
        estimatedTokens: 500  // viewScope 적용 후 예상 토큰
      },
      
      // ★ viewScope: LLM이 볼 수 있는 범위 제한
      viewScope: [
        'state.currentQuery.raw'
      ],
      
      precondition: {
        $and: [
          { $ne: [{ $get: 'state.currentQuery.raw' }, ''] },
          { $eq: [{ $get: 'state.currentQuery.status' }, 'pending'] }
        ]
      },
      
      effect: sequence([
        setState('state.currentQuery.status', 'analyzing'),
        // LLM 출력이 parsed에 저장됨
      ])
    }),

    // 컨텍스트 검색 (CQE 실행 - LLM 불필요)
    retrieveContext: defineAction({
      meta: {
        description: '관련 요약 노드 검색',
        llmGenerated: false  // LLM 사용 안 함
      },
      
      // viewScope 불필요 (LLM 호출 없음)
      viewScope: [],
      
      precondition: { 
        $eq: [{ $get: 'state.currentQuery.status' }, 'analyzing'] 
      },
      
      effect: sequence([
        setState('state.currentQuery.status', 'retrieving'),
        // CQE가 검색 수행
      ])
    }),

    // 컨텍스트 확장
    expandContext: defineAction({
      meta: {
        description: '더 깊은 트리 노드로 확장',
        llmGenerated: true,
        estimatedTokens: 1500
      },
      
      // ★ viewScope: 확장 결정에 필요한 최소 정보
      viewScope: [
        'state.currentQuery.parsed.targetPaths',
        'state.retrievedContext',  // 현재 검색 결과
        'derived.avgRelevance',
        'derived.withinTokenBudget'
      ],
      
      precondition: {
        $and: [
          { $get: 'derived.needsExpansion' },
          { $get: 'derived.withinTokenBudget' }
        ]
      },
      
      effect: sequence([
        // LLM이 선택한 노드 확장
      ])
    }),

    // 추론 단계 추가
    addReasoningStep: defineAction({
      meta: {
        description: '추론 경로에 새 단계 추가',
        llmGenerated: true,
        estimatedTokens: 2000
      },
      
      // ★ viewScope: 추론에 필요한 핵심 정보만
      viewScope: [
        'state.currentQuery.parsed',
        'state.retrievedContext',
        'state.reasoningPath',
        'derived.avgRelevance'
      ],
      
      precondition: {
        $eq: [{ $get: 'state.currentQuery.status' }, 'reasoning']
      },
      
      effect: setValue('state.reasoningPath', {
        $concat: [
          { $get: 'state.reasoningPath' },
          [{ $get: 'input' }]
        ]
      })
    }),

    // 추론 완료
    completeReasoning: defineAction({
      meta: {
        description: '추론 완료 및 결과 확정',
        llmGenerated: true,
        estimatedTokens: 1000
      },
      
      // ★ viewScope: 결론 도출에 필요한 것만
      viewScope: [
        'state.currentQuery.parsed.intent',
        'state.reasoningPath',
        'derived.avgRelevance'
      ],
      
      precondition: {
        $and: [
          { $eq: [{ $get: 'state.currentQuery.status' }, 'reasoning'] },
          { $gte: [{ $get: 'derived.avgRelevance' }, 0.7] }
        ]
      },
      
      effect: setState('state.currentQuery.status', 'complete')
    }),

    // 엔티티 추가
    addEntity: defineAction({
      meta: {
        description: '새 엔티티를 지식 그래프에 추가',
        llmGenerated: true,
        estimatedTokens: 800
      },
      
      // ★ viewScope: 엔티티 추출 대상만
      viewScope: [
        'state.retrievedContext'
        // data.entities는 중복 체크용으로 런타임에서 처리
      ],
      
      effect: setValue('data.entities', {
        $concat: [{ $get: 'data.entities' }, [{ $get: 'input' }]]
      })
    }),

    // 관계 추가
    addRelation: defineAction({
      meta: {
        description: '엔티티 간 관계 추가',
        llmGenerated: true,
        estimatedTokens: 600
      },
      
      // ★ viewScope: 관계 추출 대상만
      viewScope: [
        'state.retrievedContext'
      ],
      
      precondition: {
        $and: [
          { $some: [{ $get: 'data.entities' }, { $eq: ['$item.id', { $get: 'input.source' }] }] },
          { $some: [{ $get: 'data.entities' }, { $eq: ['$item.id', { $get: 'input.target' }] }] }
        ]
      },
      
      effect: setValue('data.relations', {
        $concat: [{ $get: 'data.relations' }, [{ $get: 'input' }]]
      })
    })
  },

  // ═══════════════════════════════════════════════════════
  // 4.1.5 Field Policies
  // ═══════════════════════════════════════════════════════
  fieldPolicies: {
    'actions.expandContext': fieldPolicy({
      relevance: { $get: 'derived.needsExpansion' },
      editability: { $get: 'derived.withinTokenBudget' }
    }),
    'actions.completeReasoning': fieldPolicy({
      relevance: { $gte: [{ $get: 'derived.avgRelevance' }, 0.7] }
    })
  }
});
```

### 4.2 viewScope 기반 추론 루프

```typescript
const reasoningLoopWithViewScope = async (
  query: string,
  runtime: ManifestoRuntime,
  projectionEngine: HSCAProjectionEngine,
  llm: LLMClient,
  maxIterations: number = 10
): Promise<Result<ReasoningResult, ReasoningError>> => {
  
  // 초기화
  runtime.set('state.currentQuery.raw', query);
  runtime.set('state.currentQuery.status', 'pending');

  for (let i = 0; i < maxIterations; i++) {
    const status = runtime.get('state.currentQuery.status');
    const fullSnapshot = runtime.getSnapshot();

    switch (status) {
      case 'pending': {
        // ═══════════════════════════════════════════════
        // Stage 1: Query Analysis
        // ═══════════════════════════════════════════════
        const projected = projectionEngine.createLLMContext(
          'analyzeQuery',
          fullSnapshot
        );
        
        if (isErr(projected)) {
          return err({ code: 'PROJECTION_ERROR', message: projected.error.message });
        }

        console.log(`[analyzeQuery] Tokens: ${projected.value.tokenCount}`);
        // 예상: ~500 tokens (질의 텍스트만)

        const analysis = await llm.call({
          action: 'analyzeQuery',
          context: projected.value.snapshot,
          outputSchema: ParsedQuerySchema
        });

        runtime.set('state.currentQuery.parsed', analysis);
        runtime.set('state.currentQuery.status', 'analyzing');
        break;
      }

      case 'analyzing': {
        // ═══════════════════════════════════════════════
        // Stage 2: Context Retrieval (LLM 불필요)
        // ═══════════════════════════════════════════════
        const parsed = runtime.get('state.currentQuery.parsed');
        const relevantNodes = await queryEngine.retrieve(
          parsed,
          runtime.get('data.compressionTree')
        );
        
        runtime.set('state.retrievedContext', relevantNodes);
        runtime.set('state.currentQuery.status', 'reasoning');
        break;
      }

      case 'reasoning': {
        // ═══════════════════════════════════════════════
        // Stage 3: Reasoning with viewScope
        // ═══════════════════════════════════════════════
        const projected = projectionEngine.createLLMContext(
          'addReasoningStep',
          fullSnapshot
        );

        if (isErr(projected)) {
          // 토큰 예산 초과 시 자동 압축됨
          console.log(`[addReasoningStep] Compressed: ${projected.value?.compressed}`);
        }

        console.log(`[addReasoningStep] Tokens: ${projected.value.tokenCount}`);
        // 예상: ~2000 tokens (질의 + 검색 결과 + 추론 경로)

        const step = await llm.call({
          action: 'addReasoningStep',
          context: projected.value.snapshot,
          outputSchema: ReasoningStepSchema
        });

        // 추론 완료 판단
        if (step.type === 'conclude') {
          await runtime.executeAction('completeReasoning');
        } else if (step.type === 'expand' && runtime.get('derived.needsExpansion')) {
          // 확장 필요
          await handleExpansion(runtime, projectionEngine, llm);
        } else {
          await runtime.executeAction('addReasoningStep', step);
        }
        break;
      }

      case 'complete': {
        // ═══════════════════════════════════════════════
        // 완료: 결과 반환
        // ═══════════════════════════════════════════════
        return ok({
          answer: synthesizeAnswer(runtime),
          reasoningPath: runtime.get('state.reasoningPath'),
          confidence: runtime.get('derived.avgRelevance'),
          totalLLMCalls: i + 1,
          totalTokensUsed: calculateTotalTokens(runtime)
        });
      }
    }
  }

  return err({ code: 'MAX_ITERATIONS', message: '최대 반복 횟수 초과' });
};
```

---

## 5. viewScope 효과 분석

### 5.1 토큰 사용량 비교

| 시나리오 | viewScope 없이 | viewScope 적용 | 절감률 |
|----------|----------------|----------------|--------|
| 1M 토큰 문서 QA (1회 추론) | ~50,000 tokens | ~2,000 tokens | **96%** |
| 복잡한 추론 (5회 반복) | ~250,000 tokens | ~10,000 tokens | **96%** |
| 엔티티 추출 (10회) | ~500,000 tokens | ~8,000 tokens | **98%** |

### 5.2 비용 비교 (GPT-4o-mini 기준)

| 시나리오 | viewScope 없이 | viewScope 적용 | 절감률 |
|----------|----------------|----------------|--------|
| 단순 QA | $0.075 | $0.003 | **96%** |
| 복잡한 추론 | $0.375 | $0.015 | **96%** |
| 대량 추출 | $0.750 | $0.012 | **98%** |

### 5.3 정확도 영향

| 지표 | viewScope 없이 | viewScope 적용 | 변화 |
|------|----------------|----------------|------|
| Task Completion Rate | 72% | 89% | **+17%** |
| Hallucination Rate | 15% | 4% | **-11%** |
| Response Latency | 8.2s | 1.4s | **-83%** |

*Note: 예상 수치, 실제 벤치마크 필요*

---

## 6. deps vs viewScope: HSCA에서의 역할

| 개념 | deps | viewScope |
|------|------|-----------|
| **질문** | "이 값을 계산하려면 무엇이 필요한가?" | "이 액션에서 LLM이 무엇을 봐야 하는가?" |
| **HSCA에서의 역할** | derived 값 자동 계산 | LLM 컨텍스트 제한 |
| **예시** | `avgRelevance`는 `retrievedContext`에 의존 | `addReasoningStep`은 `retrievedContext`만 노출 |
| **자동성** | 자동 (DAG 전파) | 명시적 (개발자 선언) |
| **실행 시점** | 데이터 변경 시 | LLM 호출 직전 |

**핵심 통찰**: 두 개념은 직교한다.
- deps가 `derived.avgRelevance`를 계산해도
- viewScope가 없으면 LLM은 전체 스냅샷을 봄
- viewScope가 `derived.avgRelevance`만 포함하면 LLM은 그것만 봄

---

## 7. 구현 로드맵 (수정)

### Phase 1: 기반 (2주)
- Domain Definition 완성 (viewScope 포함)
- HSCAProjectionEngine 구현
- 토큰 추정기 구현

### Phase 2: SCT 구현 (3주)
- Path 기반 청킹
- 계층적 요약
- 트리 저장소

### Phase 3: CQE + viewScope (2주)
- 질의 파서
- 관련성 계산
- **viewScope Projection 통합**

### Phase 4: 추론 통합 (3주)
- LLM 프롬프트 (viewScope 기반)
- 추론 루프
- 오류 복구

### Phase 5: 검증 (2주)
- viewScope 효과 벤치마크
- 토큰/비용 측정
- 정확도 비교

---

## 8. 결론

viewScope는 HSCA의 **"2-4K 토큰 제약"을 선언적으로 강제**하는 핵심 메커니즘이다.

| HSCA 주장 | viewScope 구현 |
|-----------|----------------|
| "LLM은 항상 2-4K 토큰만 본다" | 액션별 viewScope가 자동으로 제한 |
| "비용 O(log n)" | 전체 스냅샷이 아닌 필요 부분만 직렬화 |
| "정확도 향상" | 집중된 컨텍스트로 attention 효율화 |

Manifesto의 viewScope를 HSCA에 통합함으로써:

1. **토큰 예산이 "코드"가 된다** — 설정이 아닌 스키마의 일부
2. **압축이 자동화된다** — 예산 초과 시 Projection Engine이 처리
3. **추적이 가능해진다** — 어떤 액션이 무엇을 봤는지 로깅 가능
4. **테스트가 쉬워진다** — viewScope만 검증하면 토큰 제약 보장

이것이 HSCA를 **"아이디어"에서 "구현 가능한 시스템"**으로 만드는 결정적 메커니즘이다.
