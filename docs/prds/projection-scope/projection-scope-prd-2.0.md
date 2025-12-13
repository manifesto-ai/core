# projectionScope 구현 기획서

**Version**: 2.0  
**Author**: Manifesto Core Team  
**Last Updated**: 2025-12-13

---

## 1. Executive Summary

### 1.1 Manifesto의 본질

```
Manifesto = 범용 결정론적 도메인 상태 관리 레이어
```

Consumer는 누구든 될 수 있다:
- LLM Agent
- 일반 함수
- 외부 API
- UI 컴포넌트
- 다른 시스템

**Manifesto는 Consumer가 누구인지 알지도, 알 필요도 없다.**

### 1.2 projectionScope의 역할

```
projectionScope: 액션 실행 시 Consumer에게 투영될 상태 경로들
```

이게 전부다. 누가 소비하는지, 어떻게 처리하는지는 Manifesto의 관심사가 아니다.

### 1.3 설계 원칙

| 원칙 | 설명 |
|------|------|
| **Opt-in 최적화** | 기본은 전체 노출, 제한은 명시적 선언 |
| **Consumer 무관** | 누가 소비하든 동일한 투영 규칙 |
| **단일 책임** | "뭘 보여줄까"만 결정, 다른 건 알 바 아님 |

---

## 2. 핵심 개념

### 2.1 projectionScope 정의

```typescript
type ProjectionScope = string[];  // 상태 경로들의 배열
```

| projectionScope | 의미 | 사용 시점 |
|-----------------|------|-----------|
| 생략 (undefined) | 전체 스냅샷 접근 가능 | 처음 개발, 빠른 프로토타이핑 |
| `['a', 'b']` | a, b만 접근 가능 | 최적화, 명시적 제한 필요 시 |
| `[]` | 상태 접근 없이 처리 | 상태 무관한 처리 |

### 2.2 자연스러운 개발 흐름

```typescript
// Phase 1: 그냥 동작하게 만들자
checkout: defineAction({
  // projectionScope 생략 → 전체 접근
  precondition: ...,
  effect: ...
})

// Phase 2: 최적화가 필요해졌다
checkout: defineAction({
  projectionScope: ['data.cart', 'derived.cartTotal'],
  precondition: ...,
  effect: ...
})
```

**"제한"은 opt-in이어야 한다. 처음부터 강제하면 개발 경험을 해친다.**

### 2.3 상태 없이 처리되는 액션

```typescript
// 사용자가 "고마워"라고 함 → 상태 볼 필요 없음
respondToGratitude: defineAction({
  projectionScope: [],  // 빈 배열 = 상태 안 봐도 돼
  precondition: { $get: 'derived.isGratitudeMessage' },
  effect: setState('context.lastResponse', 'gratitude')
})

// UI 초기화 → 상태 볼 필요 없음
resetModal: defineAction({
  projectionScope: [],
  precondition: { $get: 'ui.modal.open' },
  effect: setState('ui.modal', null)
})

// 타이머 기반 자동 저장 → 상태 볼 필요 없음 (effect만 실행)
autoSave: defineAction({
  projectionScope: [],
  precondition: { $get: 'derived.hasUnsavedChanges' },
  effect: setState('data.lastSaveTriggered', Date.now())
})
```

### 2.4 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Manifesto Data Flow                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐                                                          │
│   │   Snapshot   │ ─── 전체 상태                                             │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────┐     ┌─────────────────┐                                  │
│   │  Projection  │ ←── │ projectionScope │                                  │
│   │    Engine    │     └─────────────────┘                                  │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────┐                                                          │
│   │  Projected   │ ─── 필터링된 상태                                          │
│   │   Snapshot   │                                                          │
│   └──────┬───────┘                                                          │
│          │                                                                  │
│          ▼                                                                  │
│   ┌──────────────┐                                                          │
│   │   Consumer   │ ─── LLM, 함수, API, UI, ...                               │
│   └──────────────┘                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 타입 시스템

### 3.1 Core Types

```typescript
/**
 * 상태 경로 표현
 * 
 * 문법:
 * - 점 표기법: 'data.user.name'
 * - 배열 인덱스: 'data.items.0'
 * - 와일드카드: 'data.items.*' (배열/객체의 모든 자식)
 * - 중첩 와일드카드: 'data.items.*.name'
 */
type StatePath = string;

/**
 * projectionScope 정의
 * 
 * - undefined: 전체 스냅샷 (기본)
 * - string[]: 명시된 경로들만
 * - []: 빈 투영 (상태 접근 없음)
 */
type ProjectionScope = StatePath[] | undefined;

/**
 * 투영 결과
 */
interface ProjectedSnapshot<T = unknown> {
  /** 투영된 데이터 */
  data: T;
  
  /** 메타데이터 */
  _meta: {
    /** 요청된 경로들 (undefined면 전체) */
    requestedPaths: StatePath[] | undefined;
    /** 실제 해석된 경로들 (와일드카드 확장 후) */
    resolvedPaths: StatePath[];
    /** 투영 시점 */
    projectedAt: number;
  };
}
```

### 3.2 ActionDefinition 확장

```typescript
interface ActionDefinition {
  /**
   * 액션 메타데이터
   */
  meta?: {
    description?: string;
  };
  
  /**
   * Consumer에게 투영할 상태 경로들
   * 
   * - 생략: 전체 스냅샷 투영
   * - [...paths]: 명시된 경로만 투영
   * - []: 빈 투영 (상태 없이 처리)
   */
  projectionScope?: ProjectionScope;
  
  /**
   * 액션 실행 가능 조건
   * 전체 스냅샷으로 평가됨 (projectionScope와 무관)
   */
  precondition: Expression;
  
  /**
   * 상태 변경 효과
   */
  effect: Effect;
}
```

### 3.3 경로 문법

```
path          = segment ("." segment)*
segment       = identifier | index | wildcard
identifier    = [a-zA-Z_][a-zA-Z0-9_]*
index         = [0-9]+
wildcard      = "*"

예시:
- "data.user.name"           → 단일 값
- "data.items.0"             → 배열 첫 번째
- "data.items.*"             → 배열 전체
- "data.items.*.name"        → 모든 아이템의 name
- "derived.*"                → 모든 derived
```

---

## 4. Projection Engine

### 4.1 인터페이스

```typescript
interface ProjectionEngine {
  /**
   * 스냅샷에서 지정된 경로들만 추출
   */
  project<T>(
    snapshot: Snapshot,
    scope: ProjectionScope,
    options?: ProjectionOptions
  ): ProjectedSnapshot<T>;
}

interface ProjectionOptions {
  /** 와일드카드 확장 여부 (기본: true) */
  expandWildcards?: boolean;
  
  /** 존재하지 않는 경로 처리 (기본: 'ignore') */
  onMissingPath?: 'ignore' | 'error' | 'null';
  
  /** 최대 깊이 (기본: 10) */
  maxDepth?: number;
}
```

### 4.2 구현

```typescript
class ProjectionEngineImpl implements ProjectionEngine {
  
  project<T>(
    snapshot: Snapshot,
    scope: ProjectionScope,
    options: ProjectionOptions = {}
  ): ProjectedSnapshot<T> {
    const {
      expandWildcards = true,
      onMissingPath = 'ignore',
      maxDepth = 10
    } = options;
    
    // Case 1: scope 생략 → 전체 반환
    if (scope === undefined) {
      return {
        data: snapshot as T,
        _meta: {
          requestedPaths: undefined,
          resolvedPaths: this.getAllPaths(snapshot),
          projectedAt: Date.now()
        }
      };
    }
    
    // Case 2: 빈 배열 → 빈 객체
    if (scope.length === 0) {
      return {
        data: {} as T,
        _meta: {
          requestedPaths: [],
          resolvedPaths: [],
          projectedAt: Date.now()
        }
      };
    }
    
    // Case 3: 명시된 경로들 추출
    const resolvedPaths = expandWildcards
      ? this.expandPaths(snapshot, scope)
      : scope;
    
    const projected = {};
    for (const path of resolvedPaths) {
      const value = this.getAtPath(snapshot, path);
      if (value !== undefined || onMissingPath === 'null') {
        this.setAtPath(projected, path, value ?? null, maxDepth);
      } else if (onMissingPath === 'error') {
        throw new Error(`Path not found: ${path}`);
      }
    }
    
    return {
      data: projected as T,
      _meta: {
        requestedPaths: scope,
        resolvedPaths,
        projectedAt: Date.now()
      }
    };
  }
  
  /**
   * 와일드카드 경로를 실제 경로로 확장
   */
  private expandPaths(snapshot: Snapshot, scope: StatePath[]): StatePath[] {
    const expanded: StatePath[] = [];
    
    for (const path of scope) {
      if (path.includes('*')) {
        expanded.push(...this.expandWildcard(snapshot, path));
      } else {
        expanded.push(path);
      }
    }
    
    return [...new Set(expanded)];
  }
  
  private expandWildcard(snapshot: Snapshot, path: StatePath): StatePath[] {
    const segments = path.split('.');
    const wildcardIdx = segments.indexOf('*');
    
    if (wildcardIdx === -1) return [path];
    
    const prefix = segments.slice(0, wildcardIdx).join('.');
    const suffix = segments.slice(wildcardIdx + 1);
    const container = this.getAtPath(snapshot, prefix);
    
    if (!container || typeof container !== 'object') return [];
    
    const keys = Array.isArray(container)
      ? container.map((_, i) => String(i))
      : Object.keys(container);
    
    return keys.flatMap(key => {
      const newPath = [...segments.slice(0, wildcardIdx), key, ...suffix].join('.');
      return suffix.includes('*')
        ? this.expandWildcard(snapshot, newPath)
        : [newPath];
    });
  }
  
  private getAtPath(obj: any, path: string): unknown {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }
  
  private setAtPath(obj: any, path: string, value: unknown, maxDepth: number): void {
    const segments = path.split('.');
    if (segments.length > maxDepth) {
      throw new Error(`Path exceeds max depth: ${path}`);
    }
    
    let curr = obj;
    for (let i = 0; i < segments.length - 1; i++) {
      const key = segments[i];
      if (!(key in curr)) {
        // 다음 세그먼트가 숫자면 배열, 아니면 객체
        const nextIsIndex = /^\d+$/.test(segments[i + 1]);
        curr[key] = nextIsIndex ? [] : {};
      }
      curr = curr[key];
    }
    curr[segments[segments.length - 1]] = value;
  }
  
  private getAllPaths(obj: any, prefix = ''): string[] {
    const paths: string[] = [];
    
    for (const key of Object.keys(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      paths.push(path);
      
      if (obj[key] && typeof obj[key] === 'object') {
        paths.push(...this.getAllPaths(obj[key], path));
      }
    }
    
    return paths;
  }
}
```

---

## 5. 런타임 통합

### 5.1 실행 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                    Action Execution Flow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Trigger │ → │ Evaluate    │ → │ Project │ → │ Execute │  │
│  │         │    │ Precondition│    │         │    │         │  │
│  └─────────┘    └─────────────┘    └─────────┘    └─────────┘  │
│                       │                 │              │        │
│                       ▼                 ▼              ▼        │
│                 ┌───────────┐    ┌───────────┐   ┌─────────┐   │
│                 │   Full    │    │ Projected │   │ Apply   │   │
│                 │ Snapshot  │    │ Snapshot  │   │ Effect  │   │
│                 └───────────┘    └───────────┘   └─────────┘   │
│                                                                 │
│  ★ precondition은 항상 전체 스냅샷으로 평가                        │
│  ★ projection은 Consumer에게 전달할 데이터만 필터링                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Runtime 구현

```typescript
class ManifestoRuntime {
  private projectionEngine: ProjectionEngine;
  
  constructor(
    private manifesto: ManifestoDefinition,
    private consumer: Consumer
  ) {
    this.projectionEngine = new ProjectionEngineImpl();
  }
  
  async executeAction(
    actionId: string,
    snapshot: Snapshot
  ): Promise<ActionResult> {
    const action = this.manifesto.actions[actionId];
    if (!action) {
      throw new Error(`Unknown action: ${actionId}`);
    }
    
    // 1. Precondition 평가 (전체 스냅샷)
    const canExecute = this.evaluateExpression(action.precondition, snapshot);
    if (!canExecute) {
      return { success: false, reason: 'precondition_failed' };
    }
    
    // 2. Projection
    const projected = this.projectionEngine.project(
      snapshot,
      action.projectionScope
    );
    
    // 3. Consumer에게 전달
    const result = await this.consumer.process(projected, action);
    
    // 4. Effect 적용
    return this.applyEffect(action.effect, snapshot, result);
  }
}

/**
 * Consumer 인터페이스
 * 구현체는 LLM, 함수, API 등 무엇이든 될 수 있음
 */
interface Consumer {
  process(
    projected: ProjectedSnapshot,
    action: ActionDefinition
  ): Promise<unknown>;
}
```

### 5.3 Consumer 예시들

```typescript
// LLM Consumer
class LLMConsumer implements Consumer {
  async process(projected: ProjectedSnapshot, action: ActionDefinition) {
    return this.llmClient.call({
      context: projected.data,
      instruction: action.meta?.description
    });
  }
}

// Function Consumer
class FunctionConsumer implements Consumer {
  constructor(private handlers: Record<string, Function>) {}
  
  async process(projected: ProjectedSnapshot, action: ActionDefinition) {
    const handler = this.handlers[action.meta?.description ?? ''];
    return handler?.(projected.data);
  }
}

// Passthrough Consumer (Effect만 실행)
class PassthroughConsumer implements Consumer {
  async process() {
    return undefined;  // 아무것도 안 함, Effect만 실행됨
  }
}
```

---

## 6. 사용 시나리오

### 6.1 E-commerce: 단계적 최적화

```typescript
const ecommerceManifesto = defineManifesto({
  state: {
    data: {
      user: { id: '', name: '', email: '', address: {}, paymentMethods: [] },
      cart: { items: [], appliedCoupon: null },
      products: [],  // 대용량
      inventory: {}
    },
    derived: {
      cartTotal: {
        deps: ['data.cart.items', 'data.products'],
        compute: (items, products) => /* 계산 */
      },
      cartItemsEnriched: {
        deps: ['data.cart.items', 'data.products'],
        compute: (items, products) => 
          items.map(item => ({
            ...item,
            product: products.find(p => p.id === item.productId)
          }))
      }
    }
  },

  actions: {
    // Phase 1: 빠른 프로토타이핑 (전체 노출)
    checkout_v1: defineAction({
      // projectionScope 생략 → 전체 접근
      precondition: { $gt: [{ $size: { $get: 'data.cart.items' } }, 0] },
      effect: setState('ui.step', 'payment')
    }),

    // Phase 2: 최적화 (필요한 것만)
    checkout_v2: defineAction({
      projectionScope: [
        'data.user.address',
        'derived.cartTotal',
        'derived.cartItemsEnriched'
      ],
      // data.products (대용량) 제외됨
      // data.paymentMethods (민감) 제외됨
      precondition: { $gt: [{ $size: { $get: 'data.cart.items' } }, 0] },
      effect: setState('ui.step', 'payment')
    })
  }
});
```

### 6.2 문서 QA: 계층적 컨텍스트

```typescript
const documentQA = defineManifesto({
  state: {
    data: {
      documents: [],      // 원본 문서들
      currentQuery: { raw: '', status: 'idle' }
    },
    context: {
      retrievedChunks: [],
      reasoningPath: []
    },
    derived: {
      parsedQuery: { deps: ['data.currentQuery.raw'], compute: /* ... */ },
      avgRelevance: { deps: ['context.retrievedChunks'], compute: /* ... */ },
      informationNotFound: {
        deps: ['context.reasoningPath', 'derived.avgRelevance'],
        compute: (path, rel) => path.length >= 3 && rel < 0.3
      }
    }
  },

  actions: {
    // 질의 분석: 쿼리만 필요
    analyzeQuery: defineAction({
      projectionScope: ['data.currentQuery.raw'],
      precondition: { $eq: [{ $get: 'data.currentQuery.status' }, 'idle'] },
      effect: setState('data.currentQuery.status', 'analyzing')
    }),

    // 검색 확장: 현재 컨텍스트 기반
    expandSearch: defineAction({
      projectionScope: [
        'derived.parsedQuery',
        'context.retrievedChunks',
        'context.reasoningPath'
      ],
      // data.documents (원본) 제외 → 이미 청킹된 것만 봄
      precondition: {
        $and: [
          { $lt: [{ $get: 'derived.avgRelevance' }, 0.6] },
          { $not: { $get: 'derived.informationNotFound' } }
        ]
      },
      effect: /* 확장 로직 */
    }),

    // "모른다" 결론: 상태 불필요
    concludeNotFound: defineAction({
      projectionScope: [],  // 상태 안 봄
      precondition: { $get: 'derived.informationNotFound' },
      effect: sequence([
        setState('data.currentQuery.status', 'done'),
        setValue('context.answer', {
          type: 'not_found',
          attempts: { $size: { $get: 'context.reasoningPath' } }
        })
      ])
    })
  }
});
```

### 6.3 대화형 앱: 상태 무관 처리

```typescript
const chatApp = defineManifesto({
  state: {
    data: {
      messages: [],
      user: { name: '', preferences: {} }
    },
    derived: {
      lastMessageIntent: {
        deps: ['data.messages'],
        compute: (msgs) => classifyIntent(msgs.slice(-1)[0])
      },
      isGratitude: {
        deps: ['derived.lastMessageIntent'],
        compute: (intent) => intent === 'gratitude'
      },
      isCasual: {
        deps: ['derived.lastMessageIntent'],
        compute: (intent) => intent === 'casual'
      }
    }
  },

  actions: {
    // 감사 응답: 상태 필요 없음
    respondToGratitude: defineAction({
      projectionScope: [],
      precondition: { $get: 'derived.isGratitude' },
      effect: appendMessage('감사 응답 생성됨')
    }),

    // 일상 대화: 상태 필요 없음
    handleCasualChat: defineAction({
      projectionScope: [],
      precondition: { $get: 'derived.isCasual' },
      effect: appendMessage('일상 응답 생성됨')
    }),

    // 개인화 응답: 사용자 정보 필요
    personalizedResponse: defineAction({
      projectionScope: ['data.user', 'data.messages'],
      precondition: { $not: { $get: 'derived.isCasual' } },
      effect: /* ... */
    })
  }
});
```

### 6.4 권한 기반 차등 노출

```typescript
const adminDashboard = defineManifesto({
  state: {
    data: {
      analytics: { public: {}, sensitive: {} },
      users: [],
      financials: {},
      auditLogs: []
    },
    session: {
      role: 'viewer'  // viewer | editor | admin
    }
  },

  actions: {
    // Viewer: 공개 분석만
    viewPublicAnalytics: defineAction({
      projectionScope: ['data.analytics.public'],
      precondition: true,
      effect: /* ... */
    }),

    // Editor: 사용자 목록 추가
    viewUsersAnalytics: defineAction({
      projectionScope: ['data.analytics.public', 'data.users'],
      precondition: {
        $in: [{ $get: 'session.role' }, ['editor', 'admin']]
      },
      effect: /* ... */
    }),

    // Admin: 전체
    viewAllData: defineAction({
      projectionScope: [
        'data.analytics.*',
        'data.users',
        'data.financials',
        'data.auditLogs'
      ],
      precondition: { $eq: [{ $get: 'session.role' }, 'admin'] },
      effect: /* ... */
    })
  }
});
```

---

## 7. 엣지 케이스

### 7.1 존재하지 않는 경로

```typescript
// 기본 동작: 무시 (에러 안 남)
projectionScope: ['data.user.nickname']  // nickname이 없어도 OK

// 옵션으로 동작 변경 가능
const options: ProjectionOptions = {
  onMissingPath: 'null'   // undefined 대신 null
  // 또는 'error'         // 에러 발생
};
```

### 7.2 대용량 와일드카드

```typescript
// 위험: 10만 개 아이템
projectionScope: ['data.products.*']  // 💥

// 권장: derived로 필터링 후 투영
derived: {
  relevantProducts: {
    deps: ['data.products', 'data.searchQuery'],
    compute: (products, query) => 
      products.filter(p => matches(p, query)).slice(0, 10)
  }
}

// 안전한 투영
projectionScope: ['derived.relevantProducts']
```

### 7.3 precondition과 projectionScope의 관계

```typescript
// 이건 정상이다
checkout: defineAction({
  projectionScope: ['data.cart'],
  precondition: { $gt: [{ $get: 'derived.userCredit' }, 0] },
  // userCredit은 precondition에서만 사용
  // Consumer는 cart만 봄
})

// 왜?
// - precondition: "실행 가능한가?" → 전체 스냅샷 필요
// - projectionScope: "Consumer가 뭘 봐야 하나?" → 별개 관심사
```

---

## 8. 스키마 검증

### 8.1 검증 규칙

```typescript
const validationRules = [
  // 경로가 스키마에 존재하는가?
  {
    id: 'path-exists',
    severity: 'warning',  // 에러 아님 - 런타임에 무시될 뿐
    check: (path, schema) => pathExistsInSchema(path, schema)
  },
  
  // 와일드카드가 배열/객체에 사용되었는가?
  {
    id: 'wildcard-valid',
    severity: 'error',
    check: (path, schema) => {
      if (!path.includes('*')) return true;
      const parentType = getTypeAtPath(path.replace('.*', ''), schema);
      return parentType === 'array' || parentType === 'object';
    }
  },
  
  // 민감 필드 노출 경고 (선택적)
  {
    id: 'sensitive-exposure',
    severity: 'info',
    check: (path) => {
      const sensitive = ['password', 'secret', 'token', 'key'];
      return !sensitive.some(s => path.toLowerCase().includes(s));
    }
  }
];
```

---

## 9. 테스트

### 9.1 단위 테스트

```typescript
describe('ProjectionEngine', () => {
  const snapshot = {
    data: {
      user: { name: 'Alice', email: 'alice@test.com' },
      items: [{ id: 1 }, { id: 2 }, { id: 3 }]
    },
    derived: { itemCount: 3 }
  };

  describe('project()', () => {
    it('undefined scope → 전체 반환', () => {
      const result = engine.project(snapshot, undefined);
      expect(result.data).toEqual(snapshot);
    });

    it('빈 배열 → 빈 객체', () => {
      const result = engine.project(snapshot, []);
      expect(result.data).toEqual({});
    });

    it('단일 경로 추출', () => {
      const result = engine.project(snapshot, ['data.user.name']);
      expect(result.data).toEqual({ data: { user: { name: 'Alice' } } });
    });

    it('다중 경로 추출', () => {
      const result = engine.project(snapshot, ['data.user.name', 'derived.itemCount']);
      expect(result.data).toEqual({
        data: { user: { name: 'Alice' } },
        derived: { itemCount: 3 }
      });
    });

    it('와일드카드 확장', () => {
      const result = engine.project(snapshot, ['data.items.*.id']);
      expect(result.data).toEqual({
        data: { items: [{ id: 1 }, { id: 2 }, { id: 3 }] }
      });
    });

    it('존재하지 않는 경로 무시', () => {
      const result = engine.project(snapshot, ['data.nonexistent', 'data.user.name']);
      expect(result.data).toEqual({ data: { user: { name: 'Alice' } } });
    });
  });
});
```

### 9.2 통합 테스트

```typescript
describe('Runtime + ProjectionEngine', () => {
  it('projectionScope 생략 시 전체 전달', async () => {
    const consumer = { process: jest.fn() };
    const runtime = new ManifestoRuntime(manifesto, consumer);
    
    await runtime.executeAction('actionWithoutScope', snapshot);
    
    expect(consumer.process).toHaveBeenCalledWith(
      expect.objectContaining({ data: snapshot }),
      expect.anything()
    );
  });

  it('projectionScope: [] 시 빈 객체 전달', async () => {
    const consumer = { process: jest.fn() };
    const runtime = new ManifestoRuntime(manifesto, consumer);
    
    await runtime.executeAction('actionWithEmptyScope', snapshot);
    
    expect(consumer.process).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} }),
      expect.anything()
    );
  });

  it('projectionScope 명시 시 해당 경로만 전달', async () => {
    const consumer = { process: jest.fn() };
    const runtime = new ManifestoRuntime(manifesto, consumer);
    
    await runtime.executeAction('checkout', snapshot);
    
    const projected = consumer.process.mock.calls[0][0].data;
    expect(projected).toHaveProperty('data.cart');
    expect(projected).not.toHaveProperty('data.products');
  });
});
```

---

## 10. 구현 로드맵

### Phase 1: Core (1주)

```
□ 타입 정의
□ ProjectionEngine 기본 구현
  - project() 메서드
  - 단순 경로 추출
□ 단위 테스트
```

### Phase 2: Advanced (1주)

```
□ 와일드카드 지원
□ 중첩 와일드카드
□ 옵션 처리 (onMissingPath, maxDepth)
□ 성능 테스트
```

### Phase 3: Integration (1주)

```
□ ManifestoRuntime 통합
□ Consumer 인터페이스 정의
□ 통합 테스트
□ 마이그레이션 가이드
```

### Phase 4: Tooling (1주)

```
□ 스키마 검증기
□ 타입 자동완성 지원
□ 문서화
```

---

## 11. 요약

```typescript
// projectionScope의 세 가지 형태

// 1. 생략 → 전체 접근 (기본, 자연스러움)
action1: defineAction({
  precondition: ...,
  effect: ...
})

// 2. 명시 → 최적화 (opt-in)
action2: defineAction({
  projectionScope: ['data.cart', 'derived.total'],
  precondition: ...,
  effect: ...
})

// 3. 빈 배열 → 상태 무관 처리
action3: defineAction({
  projectionScope: [],
  precondition: ...,
  effect: ...
})
```

**핵심 원칙:**

1. **Manifesto는 Consumer가 누구인지 모른다** — LLM이든, 함수든, API든 무관
2. **projectionScope는 투영 범위만 결정한다** — 다른 건 알 바 아님
3. **기본은 전체 노출** — 제한은 명시적 opt-in
4. **precondition과 독립적** — 각자 다른 관심사

---

*This document is part of the Manifesto Protocol specification.*
