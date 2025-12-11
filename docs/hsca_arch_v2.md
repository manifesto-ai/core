# HSCA: Hierarchical Sparse Context Architecture

**Manifesto 기반 대규모 컨텍스트 처리 및 설명 가능한 추론 시스템**

---

## 0. 핵심 가치: Explainable Ignorance

### 0.1 문제 정의

LLM의 가장 위험한 특성은 **"모른다"를 모른다**는 것이다.

```
Q: "2024년 3분기 매출은?"

기존 LLM:
A: "2024년 3분기 매출은 1억 2천만원입니다."
   → 맞을 수도 있고, hallucination일 수도 있음
   → 검증 방법 없음
   → 왜 이 답을 했는지 알 수 없음
```

### 0.2 HSCA의 해답

HSCA는 **"모른다"를 구조적으로 결정하고 설명**한다.

```
Q: "2024년 3분기 매출은?"

HSCA + Manifesto:
1. Query Analysis
   → intent: 'lookup', targetPaths: ['finance.revenue.q3.2024']

2. Context Retrieval  
   → 검색 결과: []
   → 관련성 최고점: 0.15

3. Reasoning Path (투명하게 기록)
   [
     { step: 1, type: 'retrieve', target: 'L2.finance', relevance: 0.15, result: 'no_match' },
     { step: 2, type: 'expand', target: 'L1.finance.*', relevance: 0.12, result: 'no_relevant_children' },
     { step: 3, type: 'conclude', conclusion: 'information_not_found', confidence: 0.95 }
   ]

4. 최종 응답
   A: "해당 정보를 찾을 수 없습니다."
   
   증거:
   - 검색 범위: finance 하위 트리 전체
   - 최고 관련성: 0.15 (임계값 0.5 미달)
   - 확장 시도: 2회, 모두 실패
```

### 0.3 왜 이것이 혁신인가

| 기존 LLM | HSCA |
|----------|------|
| "모른다" = LLM이 임의로 판단 | "모른다" = 시스템이 구조적으로 결정 |
| 근거 없음 | reasoningPath에 전체 과정 기록 |
| 검증 불가 | **왜 모르는지 추적 가능** |
| 신뢰 불가 | 신뢰 가능 (과정이 투명) |
| Hallucination 탐지 어려움 | **Hallucination 구조적 방지** |

**핵심 통찰**: HSCA의 가치는 "더 많이 아는 것"이 아니라 **"모를 때 정직하게 모른다고 하고, 왜 모르는지 설명하는 것"**이다.

---

## 1. 아키텍처 개요

### 1.1 설계 원칙

```
원칙 1: LLM은 "작은 정책 함수"다
        → 전체 컨텍스트를 이해하는 게 아니라, 현재 상태에서 다음 행동을 결정

원칙 2: 모든 결정은 추적 가능해야 한다
        → reasoningPath에 모든 단계 기록
        
원칙 3: "모른다"는 답도 결정이다
        → 정보 부재를 명시적으로 탐지하고 설명

원칙 4: 컨텍스트는 외부화된다
        → LLM 내부가 아닌 Semantic Snapshot에 세계 상태 저장
```

### 1.2 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                         HSCA                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐                                        │
│  │ 대규모 컨텍스트    │  N tokens (1M, 10M, 100M...)          │
│  │ (문서, 대화, 코드) │                                       │
│  └────────┬────────┘                                        │
│           │                                                 │
│           ↓                                                 │
│  ┌─────────────────────────────────────────┐               │
│  │    Semantic Compression Tree (SCT)      │               │
│  │    L0: chunks → L1 → L2 → ... → root    │               │
│  │    + Semantic Path 태깅                  │               │
│  │    + 정보 손실 추정                       │               │
│  └────────┬────────────────────────────────┘               │
│           │                                                 │
│           ↓                                                 │
│  ┌─────────────────────────────────────────┐               │
│  │      Context Query Engine (CQE)         │               │
│  │      Expression DSL 기반 관련성 계산      │               │
│  │      → 관련 노드 선택 또는 "없음" 판정    │               │
│  └────────┬────────────────────────────────┘               │
│           │                                                 │
│           ↓                                                 │
│  ┌─────────────────────────────────────────┐               │
│  │      Projection Engine                  │  ◄── 핵심     │
│  │      projectionScope 기반 컨텍스트 제한   │               │
│  │      Full Snapshot → Projected View     │               │
│  └────────┬────────────────────────────────┘               │
│           │                                                 │
│           ↓  (항상 2-4K tokens)                             │
│  ┌─────────────────────────────────────────┐               │
│  │      Small LLM Reasoner                 │               │
│  │      입력: projected context only        │               │
│  │      출력: 구조화된 Action               │               │
│  └────────┬────────────────────────────────┘               │
│           │                                                 │
│           ↓                                                 │
│  ┌─────────────────────────────────────────┐               │
│  │      State Transition Engine            │               │
│  │      Manifesto Effect System            │               │
│  │      결정론적 상태 전이                   │               │
│  └────────┬────────────────────────────────┘               │
│           │                                                 │
│           ↓                                                 │
│  ┌─────────────────────────────────────────┐               │
│  │      Semantic Snapshot                  │               │
│  │      data.* / state.* / derived.*       │               │
│  │      + reasoningPath (추론 경로 기록)    │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 어텐션의 재구현

HSCA는 Transformer의 어텐션을 "제거"한 것이 아니라 **재구현**한 것이다.

```
Transformer Attention:
    score(q, k) = softmax(QK^T / √d)
    output = Σ score_i × V_i
    
    단위: 토큰
    복잡도: O(n²)

HSCA Attention:
    relevance(Q, node) = f(path_overlap, semantic_similarity, explicit_mention)
    context = Σ relevance_i × summary_i
    
    단위: 의미 청크
    복잡도: O(log n)
```

**본질은 동일하다**: "현재 질의에 대해 어떤 정보에 가중치를 줄 것인가"

차이점:
| 차원 | Transformer | HSCA |
|------|-------------|------|
| 단위 | 토큰 | 의미 청크 (요약 노드) |
| 복잡도 | O(n²) dense | O(log n) sparse |
| 학습 | End-to-end gradient | 휴리스틱 + 별도 모델 |
| 구조 | 평면적 | 계층적 트리 |
| 추적 가능성 | attention weight (해석 어려움) | reasoningPath (명시적) |

---

## 2. Manifesto 통합

### 2.1 왜 Manifesto인가

HSCA의 "Explainable Ignorance"를 구현하려면 다음이 필요하다:

| 요구사항 | Manifesto 해결책 |
|----------|------------------|
| 정보의 고유 주소 | Semantic Paths |
| 계산의 선언적 표현 | Expression DSL |
| 부작용의 구조화 | Effect System |
| LLM 출력 제약 | Actions + preconditions |
| 오류 처리 | Result Type |
| **LLM 컨텍스트 제어** | **projectionScope** |
| **추론 경로 기록** | **state.reasoningPath** |

### 2.2 HSCA Domain Definition

```typescript
import { defineDomain, z, defineAction, defineDerived } from '@manifesto-ai/core';

const hscaDomain = defineDomain('hsca', {
  
  // ═══════════════════════════════════════════════════════
  // Data Schema: 영속적 컨텍스트 데이터
  // ═══════════════════════════════════════════════════════
  dataSchema: z.object({
    // 압축 트리
    compressionTree: CompressionTreeSchema,
    
    // 추출된 지식 그래프
    entities: z.array(EntitySchema),
    relations: z.array(RelationSchema)
  }),

  // ═══════════════════════════════════════════════════════
  // State Schema: 현재 세션 상태
  // ═══════════════════════════════════════════════════════
  stateSchema: z.object({
    // 현재 질의
    currentQuery: z.object({
      raw: z.string(),
      parsed: ParsedQuerySchema.nullable(),
      status: z.enum(['pending', 'analyzing', 'retrieving', 'reasoning', 'complete', 'not_found'])
    }),
    
    // 검색된 컨텍스트
    retrievedContext: z.array(RetrievedNodeSchema),
    
    // ★ 핵심: 추론 경로 (Explainable Ignorance의 근거)
    reasoningPath: z.array(z.object({
      step: z.number(),
      type: z.enum(['retrieve', 'expand', 'infer', 'conclude', 'not_found']),
      target: z.string(),           // 검색/확장 대상
      relevance: z.number(),        // 관련성 점수
      result: z.string(),           // 결과 요약
      evidence: z.array(z.string()) // 근거 경로들
    })),
    
    // 최종 결론
    conclusion: z.object({
      type: z.enum(['answer', 'not_found', 'uncertain']),
      content: z.string(),
      confidence: z.number(),
      evidencePaths: z.array(z.string())
    }).nullable()
  }),

  // ═══════════════════════════════════════════════════════
  // Derived: 자동 계산 값
  // ═══════════════════════════════════════════════════════
  derived: {
    // 현재 컨텍스트 토큰 수
    'derived.currentContextTokens': defineDerived(
      { $sum: { $map: [{ $get: 'state.retrievedContext' }, '$item.tokenCount'] } },
      z.number()
    ),
    
    // 토큰 예산 내 여부
    'derived.withinTokenBudget': defineDerived(
      { $lte: [{ $get: 'derived.currentContextTokens' }, 4000] },
      z.boolean()
    ),
    
    // 평균 관련성
    'derived.avgRelevance': defineDerived(
      { $if: [
        { $gt: [{ $size: { $get: 'state.retrievedContext' } }, 0] },
        { $divide: [
          { $sum: { $map: [{ $get: 'state.retrievedContext' }, '$item.relevance'] } },
          { $size: { $get: 'state.retrievedContext' } }
        ]},
        0
      ]},
      z.number()
    ),
    
    // ★ 핵심: 정보 부재 판정
    'derived.informationNotFound': defineDerived(
      { $and: [
        { $lt: [{ $get: 'derived.avgRelevance' }, 0.3] },  // 관련성 낮음
        { $gte: [{ $size: { $get: 'state.reasoningPath' } }, 2] }  // 충분히 시도함
      ]},
      z.boolean()
    ),
    
    // 확장 필요 여부
    'derived.needsExpansion': defineDerived(
      { $and: [
        { $lt: [{ $get: 'derived.avgRelevance' }, 0.5] },
        { $not: { $get: 'derived.informationNotFound' } },
        { $get: 'derived.withinTokenBudget' }
      ]},
      z.boolean()
    )
  },

  // ═══════════════════════════════════════════════════════
  // Actions: LLM이 수행 가능한 행동들
  // ═══════════════════════════════════════════════════════
  actions: {
    
    // 질의 분석
    analyzeQuery: defineAction({
      meta: { description: '질의 의도 및 대상 경로 추출', llmGenerated: true },
      
      projectionScope: [
        'state.currentQuery.raw'
      ],
      
      precondition: {
        $and: [
          { $ne: [{ $get: 'state.currentQuery.raw' }, ''] },
          { $eq: [{ $get: 'state.currentQuery.status' }, 'pending'] }
        ]
      },
      
      effect: setState('state.currentQuery.status', 'analyzing')
    }),

    // 추론 단계 추가
    addReasoningStep: defineAction({
      meta: { description: '추론 경로에 단계 추가', llmGenerated: true },
      
      projectionScope: [
        'state.currentQuery.parsed',
        'state.retrievedContext',
        'state.reasoningPath',
        'derived.avgRelevance',
        'derived.informationNotFound'
      ],
      
      precondition: {
        $eq: [{ $get: 'state.currentQuery.status' }, 'reasoning']
      },
      
      effect: setValue('state.reasoningPath', {
        $concat: [{ $get: 'state.reasoningPath' }, [{ $get: 'input' }]]
      })
    }),

    // 컨텍스트 확장
    expandContext: defineAction({
      meta: { description: '더 깊은 트리 노드로 확장', llmGenerated: true },
      
      projectionScope: [
        'state.currentQuery.parsed.targetPaths',
        'state.retrievedContext',
        'derived.avgRelevance'
      ],
      
      precondition: { $get: 'derived.needsExpansion' },
      
      effect: sequence([
        // 확장 로직
      ])
    }),

    // ★ 핵심: 정보 부재 결론
    concludeNotFound: defineAction({
      meta: { 
        description: '정보를 찾을 수 없음을 결론', 
        llmGenerated: false  // LLM이 아닌 시스템이 결정
      },
      
      projectionScope: [],  // LLM 호출 불필요
      
      // ★ 시스템이 구조적으로 판단
      precondition: { $get: 'derived.informationNotFound' },
      
      effect: sequence([
        setState('state.currentQuery.status', 'not_found'),
        setValue('state.conclusion', {
          type: 'not_found',
          content: '요청하신 정보를 찾을 수 없습니다.',
          confidence: 0.95,
          evidencePaths: { $map: [{ $get: 'state.reasoningPath' }, '$item.target'] }
        })
      ])
    }),

    // 답변 결론
    concludeWithAnswer: defineAction({
      meta: { description: '답변 도출', llmGenerated: true },
      
      projectionScope: [
        'state.currentQuery.parsed',
        'state.retrievedContext',
        'state.reasoningPath'
      ],
      
      precondition: {
        $and: [
          { $gte: [{ $get: 'derived.avgRelevance' }, 0.5] },
          { $not: { $get: 'derived.informationNotFound' } }
        ]
      },
      
      effect: setState('state.currentQuery.status', 'complete')
    })
  }
});
```

---

## 3. projectionScope: 투명성의 핵심 메커니즘

### 3.1 projectionScope의 역할

```
projectionScope가 하는 일:
1. LLM이 볼 수 있는 범위를 명시적으로 제한
2. "이것만 보고 판단해라"를 코드로 강제
3. 나중에 "LLM이 무엇을 보고 판단했는가"를 추적 가능
```

### 3.2 Explainable Ignorance와의 연결

```typescript
// concludeNotFound 액션
concludeNotFound: defineAction({
  projectionScope: [],  // LLM 호출 없음
  precondition: { $get: 'derived.informationNotFound' },
  ...
})
```

**이것이 의미하는 바:**

1. `derived.informationNotFound`가 `true`가 되면
2. LLM에게 물어보지 않고 시스템이 직접 "모른다" 결론
3. 왜? reasoningPath에 충분한 시도가 기록되어 있으므로

```
reasoningPath: [
  { step: 1, type: 'retrieve', target: 'finance.revenue', relevance: 0.12, result: 'no_match' },
  { step: 2, type: 'expand', target: 'finance.*', relevance: 0.15, result: 'no_relevant_children' }
]

→ derived.informationNotFound = true (관련성 < 0.3 && 시도 >= 2)
→ concludeNotFound 액션 자동 트리거
→ LLM 개입 없이 "모른다" 결론

증거: reasoningPath 전체가 "왜 모르는지"의 설명
```

### 3.3 projectionScope별 토큰 예산

| 액션 | projectionScope | 예상 토큰 |
|------|-----------------|-----------|
| analyzeQuery | `[currentQuery.raw]` | ~200 |
| addReasoningStep | `[parsed, retrievedContext, reasoningPath, metrics]` | ~2,000 |
| expandContext | `[targetPaths, retrievedContext, avgRelevance]` | ~1,500 |
| concludeNotFound | `[]` | 0 (LLM 호출 없음) |
| concludeWithAnswer | `[parsed, retrievedContext, reasoningPath]` | ~2,500 |

**핵심**: `concludeNotFound`의 projectionScope가 `[]`라는 것 — LLM이 "모른다"를 결정하는 게 아니라 **시스템이 구조적으로 결정**한다.

---

## 4. 추론 루프: Explainable Ignorance 구현

### 4.1 전체 흐름

```typescript
const reasoningLoop = async (
  query: string,
  runtime: ManifestoRuntime,
  projectionEngine: ProjectionEngine,
  llm: LLMClient
): Promise<Result<Conclusion, Error>> => {
  
  runtime.set('state.currentQuery.raw', query);
  runtime.set('state.currentQuery.status', 'pending');
  runtime.set('state.reasoningPath', []);

  const MAX_ITERATIONS = 10;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const status = runtime.get('state.currentQuery.status');

    // ═══════════════════════════════════════════════════
    // ★ 핵심: 매 반복마다 "모른다" 조건 체크
    // ═══════════════════════════════════════════════════
    if (runtime.get('derived.informationNotFound')) {
      // LLM 호출 없이 시스템이 결론
      await runtime.executeAction('concludeNotFound');
      
      return ok({
        type: 'not_found',
        explanation: buildExplanation(runtime.get('state.reasoningPath')),
        confidence: 0.95
      });
    }

    switch (status) {
      case 'pending': {
        // 질의 분석 (LLM)
        const projected = projectionEngine.project('analyzeQuery', runtime.getSnapshot());
        const analysis = await llm.call(projected);
        
        runtime.set('state.currentQuery.parsed', analysis);
        runtime.set('state.currentQuery.status', 'analyzing');
        
        // 추론 경로에 기록
        runtime.executeAction('addReasoningStep', {
          step: i + 1,
          type: 'analyze',
          target: 'query',
          relevance: 1.0,
          result: `intent: ${analysis.intent}, paths: ${analysis.targetPaths.join(', ')}`,
          evidence: []
        });
        break;
      }

      case 'analyzing': {
        // 컨텍스트 검색 (CQE, LLM 불필요)
        const parsed = runtime.get('state.currentQuery.parsed');
        const results = await queryEngine.retrieve(parsed, runtime.get('data.compressionTree'));
        
        runtime.set('state.retrievedContext', results);
        runtime.set('state.currentQuery.status', 'reasoning');
        
        // 추론 경로에 기록
        runtime.executeAction('addReasoningStep', {
          step: i + 1,
          type: 'retrieve',
          target: parsed.targetPaths.join(', '),
          relevance: runtime.get('derived.avgRelevance'),
          result: results.length > 0 ? `found ${results.length} nodes` : 'no_match',
          evidence: results.map(r => r.nodeId)
        });
        break;
      }

      case 'reasoning': {
        // 확장 필요 여부 확인
        if (runtime.get('derived.needsExpansion')) {
          const projected = projectionEngine.project('expandContext', runtime.getSnapshot());
          const expansion = await llm.call(projected);
          
          // 확장 실행 및 기록
          await executeExpansion(runtime, expansion);
          
          runtime.executeAction('addReasoningStep', {
            step: i + 1,
            type: 'expand',
            target: expansion.targetNode,
            relevance: runtime.get('derived.avgRelevance'),
            result: expansion.found ? 'expanded' : 'no_relevant_children',
            evidence: expansion.newNodes || []
          });
          
          continue;
        }

        // 충분한 컨텍스트 확보 → 답변 생성
        if (runtime.get('derived.avgRelevance') >= 0.5) {
          const projected = projectionEngine.project('concludeWithAnswer', runtime.getSnapshot());
          const answer = await llm.call(projected);
          
          runtime.set('state.conclusion', {
            type: 'answer',
            content: answer.content,
            confidence: runtime.get('derived.avgRelevance'),
            evidencePaths: runtime.get('state.retrievedContext').map(r => r.nodeId)
          });
          runtime.set('state.currentQuery.status', 'complete');
          
          return ok(runtime.get('state.conclusion'));
        }
        break;
      }

      case 'complete':
        return ok(runtime.get('state.conclusion'));
        
      case 'not_found':
        return ok(runtime.get('state.conclusion'));
    }
  }

  return err({ code: 'MAX_ITERATIONS', message: '최대 반복 초과' });
};
```

### 4.2 "왜 모르는지" 설명 생성

```typescript
function buildExplanation(reasoningPath: ReasoningStep[]): string {
  const attempts = reasoningPath.filter(s => s.type === 'retrieve' || s.type === 'expand');
  const maxRelevance = Math.max(...attempts.map(a => a.relevance));
  const searchedAreas = [...new Set(attempts.map(a => a.target))];

  return `
요청하신 정보를 찾을 수 없습니다.

검색 시도 내역:
${attempts.map(a => `- ${a.target}: 관련성 ${(a.relevance * 100).toFixed(1)}% (${a.result})`).join('\n')}

요약:
- 검색 범위: ${searchedAreas.join(', ')}
- 최고 관련성: ${(maxRelevance * 100).toFixed(1)}% (임계값 30% 미달)
- 총 시도 횟수: ${attempts.length}회

이 정보가 문서에 포함되어 있다면, 다른 키워드로 질문해 주세요.
`.trim();
}
```

---

## 5. 복잡도 및 비용 분석

### 5.1 복잡도

| 단계 | Transformer | HSCA |
|------|-------------|------|
| 전처리 | - | O(n) 요약 트리 구축 |
| 질의당 검색 | O(n²) attention | O(log n) 트리 탐색 |
| 질의당 추론 | O(n²) | O(k) where k ≤ 4K tokens |

### 5.2 비용 비교 (100만 토큰 문서, GPT-4o-mini 기준)

| 방식 | 질의당 비용 | 100회 질의 |
|------|-------------|------------|
| 전체 컨텍스트 | ~$1.50 | $150 |
| HSCA | ~$0.003 | $0.30 + $15 (전처리) |

**손익분기점**: ~10회 질의

### 5.3 토큰 사용량

| 시나리오 | 전체 컨텍스트 | HSCA (projectionScope) |
|----------|---------------|------------------------|
| 단순 조회 | 50,000 tokens | ~500 tokens |
| 복잡한 추론 (5회) | 250,000 tokens | ~10,000 tokens |
| "모른다" 결론 | 50,000 tokens | ~700 tokens + **LLM 0회** |

---

## 6. 한계 및 정직한 포지셔닝

### 6.1 이것은 "무한 컨텍스트"가 아니다

HSCA는 **"컨텍스트 윈도우 문제를 제거"**한 것이 아니라, **"압축 + 검색 문제로 변환"**한 것이다.

| 얻는 것 | 잃는 것 |
|---------|---------|
| O(n²) → O(log n) 확장성 | Full attention의 표현력 |
| 비용 절감 | 잠재적 연결 탐지 능력 |
| "모른다"의 설명 가능성 | Soft reasoning 유연성 |
| 추적 가능한 추론 | 암묵적 추론 능력 |

### 6.2 실패 모드

**Case 1: 암묵적 관계 손실**

```
원본: "김 과장이 3월에 제출한 보고서의 '프로젝트 A'는 
       사실 작년 이 회장이 비공식적으로 언급한 신사업과 동일하다"

L1 요약: "김 과장 프로젝트 A 보고서 제출"
L2 요약: "내부 보고서 존재"

→ "이 회장 ↔ 프로젝트 A" 연결이 요약에서 손실
→ 이 관계를 묻는 질문에 "모른다"고 답할 수 있음 (False Negative)
```

**Case 2: 관련성 점수의 한계**

```
Q: "회사의 숨겨진 리스크는?"

검색 결과: finance.* 노드들 (관련성 0.6)
실제 답: legal.footnotes 에 buried된 소송 정보

→ 표면적 관련성 높은 finance 정보만 검색
→ 진짜 중요한 legal 정보 누락 가능
```

### 6.3 적합한 사용 사례

| 적합 | 부적합 |
|------|--------|
| 구조화된 문서 QA | 비정형 서사 분석 |
| 코드베이스 탐색 | 소설 해석 |
| 지식베이스 질의 | 암묵적 의도 파악 |
| 명시적 정보 검색 | 깊은 다중 홉 추론 |

### 6.4 RAG와의 관계

HSCA는 RAG의 한계를 공유한다:

```
공통 한계: "검색이 성공한 정보에만 접근 가능"
```

차별점:
- RAG: 평면적 청크 검색
- HSCA: 계층적 요약 트리 + **reasoningPath로 검색 실패 설명**

---

## 7. 결론

### 7.1 핵심 가치 재정리

HSCA의 핵심 가치는 **토큰 효율성**이나 **비용 절감**이 아니다.

**핵심 가치는 "Explainable Ignorance"다:**

```
"LLM이 '모른다'고 할 때, 왜 모르는지 설명할 수 있는 시스템"
```

이것이 가능한 이유:
1. **projectionScope**: LLM이 무엇을 보고 판단했는지 명시적
2. **reasoningPath**: 모든 검색/확장 시도가 기록됨
3. **derived.informationNotFound**: "모른다"가 LLM 판단이 아닌 시스템 결정
4. **concludeNotFound**: LLM 없이 구조적으로 "모른다" 결론

### 7.2 Manifesto와의 시너지

| HSCA 요구 | Manifesto 해결 |
|-----------|----------------|
| 추론 경로 기록 | state.reasoningPath |
| "모른다" 조건 | derived.informationNotFound |
| LLM 컨텍스트 제한 | projectionScope |
| 결정론적 결론 | concludeNotFound.precondition |

### 7.3 정직한 포지셔닝

> HSCA는 **"LLM이 더 많이 알게 하는"** 시스템이 아니다.
> 
> HSCA는 **"LLM이 모를 때, 정직하게 모른다고 하고, 왜 모르는지 설명하는"** 시스템이다.

이것이 Hallucination 문제에 대한 구조적 해결책이다.

---

## Appendix A: 스키마 정의

```typescript
const ParsedQuerySchema = z.object({
  intent: z.enum(['lookup', 'compare', 'summarize', 'analyze', 'list']),
  targetPaths: z.array(z.string()),
  constraints: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'gt', 'lt', 'contains', 'between']),
    value: z.unknown()
  })),
  expectedDepth: z.number()
});

const RetrievedNodeSchema = z.object({
  nodeId: z.string(),
  level: z.number(),
  summary: z.string(),
  relevance: z.number(),
  tokenCount: z.number(),
  semanticPaths: z.array(z.string())
});

const ReasoningStepSchema = z.object({
  step: z.number(),
  type: z.enum(['analyze', 'retrieve', 'expand', 'infer', 'conclude', 'not_found']),
  target: z.string(),
  relevance: z.number(),
  result: z.string(),
  evidence: z.array(z.string())
});

const ConclusionSchema = z.object({
  type: z.enum(['answer', 'not_found', 'uncertain']),
  content: z.string(),
  confidence: z.number(),
  evidencePaths: z.array(z.string())
});
```

---

## Appendix B: Expression DSL 확장 (HSCA용)

```typescript
// 트리 탐색
{ $ancestors: { $get: 'nodeId' } }
{ $descendants: { $get: 'nodeId' } }
{ $siblings: { $get: 'nodeId' } }

// 관련성 계산
{ $relevance: [queryExpr, nodeExpr] }
{ $pathOverlap: [paths1, paths2] }

// 정보 존재 판정
{ $hasRelevantInfo: [{ $get: 'state.retrievedContext' }, threshold] }
{ $searchExhausted: [{ $get: 'state.reasoningPath' }, maxAttempts] }
```

---

## Appendix C: 버전 히스토리

| 버전 | 변경 내용 |
|------|-----------|
| v1.0 | 초기 ICWA 설계 |
| v2.0 | "Infinite" → "Hierarchical Sparse" 리네이밍, 정직한 포지셔닝 |
| v3.0 | Manifesto 통합, viewScope 추가 |
| v4.0 (현재) | **Explainable Ignorance** 중심 재구성, viewScope → projectionScope |

---

*This document is part of the Manifesto Protocol specification.*
