# projectionScope 구현 기획서

**Version**: 1.0  
**Author**: Manifesto Core Team  
**Last Updated**: 2025-12-13

---

## 1. Executive Summary

### 1.1 왜 projectionScope인가?

Manifesto의 핵심 철학은 **"AI가 판단하지 않는다"**이다. 그러나 현재 구현에는 치명적인 구멍이 있다:

```
현재: LLM 호출 시 전체 스냅샷이 전달됨
     → "무엇을 볼지"를 런타임이 판단해야 함
     → 판단 = 비용, 오류, 추적 불가
```

`projectionScope`는 이 문제를 **스키마 정의 시점에 해결**한다:

```typescript
// 개발자가 선언하면
checkout: defineAction({
  projectionScope: ['data.cart', 'derived.cartTotal'],
  ...
})

// 런타임은 기계적으로 실행만 함
// → 판단 없음, 비용 없음, 완전 추적 가능
```

### 1.2 핵심 가치

| 가치 | 설명 | 측정 지표 |
|------|------|----------|
| **비용 절감** | 필요한 토큰만 전송 | 90%+ 토큰 감소 (대규모 상태) |
| **정확도 향상** | LLM attention 집중 | 응답 품질 개선 |
| **Explainability** | "뭘 보고 판단했나" 추적 | 감사 로그 완전성 |
| **보안** | 민감 정보 물리적 차단 | 접근 제어 강화 |

---

## 2. 핵심 개념

### 2.1 projectionScope의 정의

```
projectionScope: 액션 실행 시 LLM에게 투영(project)될 상태 경로들의 배열
```

**수학적 비유**:
```
전체 스냅샷 S = { a, b, c, d, e, f, ... }
projectionScope P = ['a', 'c']
투영 결과 π(S, P) = { a, c }
```

**SQL 비유**:
```sql
-- projectionScope는 SELECT의 컬럼 목록과 같다
SELECT cart, cartTotal FROM snapshot;  -- projectionScope: ['cart', 'cartTotal']
-- vs
SELECT * FROM snapshot;                 -- projectionScope 없음 (전체 노출)
```

### 2.2 projectionScope vs 관련 개념

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Manifesto 데이터 흐름                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   data.cart.items ──┐                                                       │
│                     ├─→ [deps] ─→ derived.cartTotal ──┐                     │
│   data.products ────┘                                 │                     │
│                                                       │                     │
│                                                       ├─→ [projectionScope] │
│   data.user.address ──────────────────────────────────┘         │           │
│                                                                 ▼           │
│                                                        ┌──────────────┐     │
│                                                        │  Projection  │     │
│                                                        │   Engine     │     │
│                                                        └──────┬───────┘     │
│                                                               ▼             │
│                                                        ┌──────────────┐     │
│                                                        │     LLM      │     │
│                                                        └──────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| 개념 | 역할 | 시점 | 방향 |
|------|------|------|------|
| `deps` | derived 계산에 필요한 의존성 | 데이터 변경 시 | data → derived |
| `projectionScope` | LLM에 노출할 범위 | LLM 호출 직전 | snapshot → LLM |
| `precondition` | 액션 실행 가능 조건 | 액션 평가 시 | snapshot → boolean |

**핵심**: 세 개념은 **직교한다**. 각자 다른 문제를 해결한다.

### 2.3 projectionScope의 특수 케이스

```typescript
// Case 1: 빈 배열 — LLM 호출 없음
concludeNotFound: defineAction({
  projectionScope: [],  // 🔑 시스템이 직접 결정
  precondition: { $get: 'derived.informationNotFound' },
  effect: setState('status', 'not_found')
})

// Case 2: undefined — 전체 스냅샷 노출 (비권장, 하위 호환용)
legacyAction: defineAction({
  // projectionScope 생략
  ...
})

// Case 3: 와일드카드 — 하위 트리 전체
expandSearch: defineAction({
  projectionScope: ['context.retrievedChunks.*'],  // 모든 청크
  ...
})
```

---

## 3. 타입 시스템 설계

### 3.1 Core Types

```typescript
/**
 * 상태 경로 표현
 * - 점 표기법: 'data.user.name'
 * - 와일드카드: 'data.items.*' (배열/객체의 모든 자식)
 * - 인덱스: 'data.items.0' (특정 인덱스)
 */
type StatePath = string;

/**
 * projectionScope 정의
 */
type ProjectionScope = StatePath[];

/**
 * 투영 결과
 */
interface ProjectedSnapshot {
  /** 투영된 데이터 */
  data: Record<string, unknown>;
  
  /** 메타데이터 (디버깅/감사용) */
  _projection: {
    /** 원본 경로들 */
    requestedPaths: StatePath[];
    /** 실제 포함된 경로들 (와일드카드 확장 후) */
    resolvedPaths: StatePath[];
    /** 투영 시점 */
    timestamp: number;
    /** 예상 토큰 수 */
    estimatedTokens: number;
  };
}

/**
 * 액션 정의 확장
 */
interface ActionDefinition {
  meta?: {
    description?: string;
    llmGenerated?: boolean;
  };
  
  /**
   * LLM에 투영할 상태 경로들
   * - 빈 배열 []: LLM 호출 없이 시스템이 직접 처리
   * - undefined: 전체 스냅샷 노출 (하위 호환, 비권장)
   */
  projectionScope?: ProjectionScope;
  
  /**
   * 토큰 예산 (선택적)
   * projectionScope 결과가 이를 초과하면 압축 전략 적용
   */
  tokenBudget?: number;
  
  precondition: Expression;
  effect: Effect;
}
```

### 3.2 Projection Engine Interface

```typescript
interface ProjectionEngine {
  /**
   * 스냅샷에서 지정된 경로들만 추출
   */
  project(
    snapshot: Snapshot,
    scope: ProjectionScope,
    options?: ProjectionOptions
  ): ProjectedSnapshot;
  
  /**
   * 토큰 수 추정
   */
  estimateTokens(projected: ProjectedSnapshot): number;
  
  /**
   * 예산 초과 시 압축
   */
  compress(
    projected: ProjectedSnapshot,
    budget: number,
    strategy: CompressionStrategy
  ): ProjectedSnapshot;
}

interface ProjectionOptions {
  /** 와일드카드 확장 여부 */
  expandWildcards?: boolean;
  
  /** 존재하지 않는 경로 처리 */
  onMissingPath?: 'ignore' | 'error' | 'null';
  
  /** 순환 참조 처리 */
  onCircularRef?: 'error' | 'truncate';
  
  /** 최대 깊이 */
  maxDepth?: number;
}

type CompressionStrategy = 
  | 'truncate'      // 단순 자르기
  | 'summarize'     // LLM 요약 (비용 발생)
  | 'prioritize';   // 관련성 높은 것 우선
```

### 3.3 경로 표현식 문법

```typescript
/**
 * 경로 문법 EBNF
 * 
 * path          = segment ("." segment)*
 * segment       = identifier | index | wildcard
 * identifier    = [a-zA-Z_][a-zA-Z0-9_]*
 * index         = [0-9]+
 * wildcard      = "*"
 * 
 * 예시:
 * - "data.user.name"           → 단일 값
 * - "data.items.0"             → 배열 첫 번째 요소
 * - "data.items.*"             → 배열 모든 요소
 * - "data.items.*.name"        → 모든 아이템의 name 필드
 * - "derived.*"                → 모든 derived 값
 */

// 경로 파서
interface PathParser {
  parse(path: StatePath): PathSegment[];
  validate(path: StatePath): ValidationResult;
}

type PathSegment = 
  | { type: 'property'; name: string }
  | { type: 'index'; value: number }
  | { type: 'wildcard' };
```

---

## 4. Projection Engine 구현

### 4.1 핵심 알고리즘

```typescript
class ProjectionEngineImpl implements ProjectionEngine {
  
  project(
    snapshot: Snapshot,
    scope: ProjectionScope,
    options: ProjectionOptions = {}
  ): ProjectedSnapshot {
    const {
      expandWildcards = true,
      onMissingPath = 'ignore',
      maxDepth = 10
    } = options;
    
    // 1. 빈 scope 처리 (LLM 미호출 케이스)
    if (scope.length === 0) {
      return {
        data: {},
        _projection: {
          requestedPaths: [],
          resolvedPaths: [],
          timestamp: Date.now(),
          estimatedTokens: 0
        }
      };
    }
    
    // 2. 경로 확장 (와일드카드 처리)
    const resolvedPaths = expandWildcards
      ? this.expandPaths(snapshot, scope)
      : scope;
    
    // 3. 값 추출 및 트리 구성
    const projected: Record<string, unknown> = {};
    
    for (const path of resolvedPaths) {
      const value = this.getValueAtPath(snapshot, path, onMissingPath);
      if (value !== undefined) {
        this.setValueAtPath(projected, path, value, maxDepth);
      }
    }
    
    // 4. 메타데이터 포함하여 반환
    return {
      data: projected,
      _projection: {
        requestedPaths: scope,
        resolvedPaths,
        timestamp: Date.now(),
        estimatedTokens: this.estimateTokens({ data: projected } as ProjectedSnapshot)
      }
    };
  }
  
  /**
   * 와일드카드 경로를 실제 경로들로 확장
   */
  private expandPaths(snapshot: Snapshot, scope: ProjectionScope): StatePath[] {
    const expanded: StatePath[] = [];
    
    for (const path of scope) {
      if (path.includes('*')) {
        expanded.push(...this.expandWildcard(snapshot, path));
      } else {
        expanded.push(path);
      }
    }
    
    return [...new Set(expanded)]; // 중복 제거
  }
  
  /**
   * 단일 와일드카드 경로 확장
   * 예: 'data.items.*' → ['data.items.0', 'data.items.1', ...]
   */
  private expandWildcard(snapshot: Snapshot, path: StatePath): StatePath[] {
    const segments = path.split('.');
    const wildcardIndex = segments.indexOf('*');
    
    if (wildcardIndex === -1) return [path];
    
    // 와일드카드 이전 경로로 객체/배열 가져오기
    const prefixPath = segments.slice(0, wildcardIndex).join('.');
    const container = this.getValueAtPath(snapshot, prefixPath, 'ignore');
    
    if (!container || typeof container !== 'object') return [];
    
    const keys = Array.isArray(container)
      ? container.map((_, i) => String(i))
      : Object.keys(container);
    
    const suffixSegments = segments.slice(wildcardIndex + 1);
    
    return keys.flatMap(key => {
      const expandedPath = [...segments.slice(0, wildcardIndex), key, ...suffixSegments].join('.');
      
      // 재귀적 와일드카드 처리
      if (suffixSegments.includes('*')) {
        return this.expandWildcard(snapshot, expandedPath);
      }
      return [expandedPath];
    });
  }
  
  /**
   * 토큰 수 추정 (간이 구현)
   * 실제로는 tiktoken 등 사용
   */
  estimateTokens(projected: ProjectedSnapshot): number {
    const json = JSON.stringify(projected.data);
    // 대략 4자당 1토큰 (영문 기준, 보수적 추정)
    return Math.ceil(json.length / 4);
  }
  
  /**
   * 예산 초과 시 압축
   */
  compress(
    projected: ProjectedSnapshot,
    budget: number,
    strategy: CompressionStrategy
  ): ProjectedSnapshot {
    const currentTokens = this.estimateTokens(projected);
    
    if (currentTokens <= budget) return projected;
    
    switch (strategy) {
      case 'truncate':
        return this.truncateProjection(projected, budget);
      case 'prioritize':
        return this.prioritizeProjection(projected, budget);
      case 'summarize':
        // 외부 LLM 호출 필요 — 별도 처리
        throw new Error('Summarize strategy requires async handling');
      default:
        return projected;
    }
  }
  
  private truncateProjection(
    projected: ProjectedSnapshot,
    budget: number
  ): ProjectedSnapshot {
    // JSON 문자열을 예산에 맞게 자르고 재구성
    // 실제로는 더 정교한 로직 필요
    const json = JSON.stringify(projected.data);
    const targetChars = budget * 4;
    
    if (json.length <= targetChars) return projected;
    
    // 단순 구현: 마지막 완전한 객체까지만 유지
    // 실제로는 경로 우선순위에 따라 제거
    return {
      ...projected,
      data: JSON.parse(json.slice(0, targetChars) + '...'),  // 간이 구현
      _projection: {
        ...projected._projection,
        estimatedTokens: budget
      }
    };
  }
  
  private prioritizeProjection(
    projected: ProjectedSnapshot,
    budget: number
  ): ProjectedSnapshot {
    // 경로 깊이가 얕은 것 우선 유지
    // 실제로는 관련성 점수 등 사용
    // TODO: 구현
    return projected;
  }
}
```

### 4.2 최적화 전략

```typescript
/**
 * 성능 최적화를 위한 캐싱 레이어
 */
class CachedProjectionEngine implements ProjectionEngine {
  private cache = new Map<string, ProjectedSnapshot>();
  private engine: ProjectionEngine;
  
  constructor(engine: ProjectionEngine) {
    this.engine = engine;
  }
  
  project(
    snapshot: Snapshot,
    scope: ProjectionScope,
    options?: ProjectionOptions
  ): ProjectedSnapshot {
    // 캐시 키 생성 (scope + 관련 데이터의 해시)
    const cacheKey = this.generateCacheKey(snapshot, scope);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const result = this.engine.project(snapshot, scope, options);
    this.cache.set(cacheKey, result);
    
    return result;
  }
  
  /**
   * 스냅샷 변경 시 관련 캐시만 무효화
   */
  invalidate(changedPaths: StatePath[]): void {
    for (const [key, _] of this.cache) {
      const cachedPaths = this.extractPathsFromKey(key);
      if (this.pathsOverlap(cachedPaths, changedPaths)) {
        this.cache.delete(key);
      }
    }
  }
  
  private generateCacheKey(snapshot: Snapshot, scope: ProjectionScope): string {
    // scope의 각 경로에 대한 값의 해시
    const values = scope.map(path => 
      JSON.stringify(this.engine['getValueAtPath'](snapshot, path, 'ignore'))
    );
    return `${scope.join(',')}:${hashCode(values.join('|'))}`;
  }
}
```

---

## 5. 런타임 통합

### 5.1 액션 실행 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Action Execution Flow                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────┐  │
│  │  Event   │ ──→ │  Evaluate    │ ──→ │  Project     │ ──→ │  Execute  │  │
│  │ Trigger  │     │ Precondition │     │  Snapshot    │     │  Action   │  │
│  └──────────┘     └──────────────┘     └──────────────┘     └───────────┘  │
│                          │                    │                    │        │
│                          ▼                    ▼                    ▼        │
│                   ┌─────────────┐      ┌─────────────┐      ┌───────────┐  │
│                   │ Full        │      │ Projected   │      │ LLM Call  │  │
│                   │ Snapshot    │      │ Snapshot    │      │ or Direct │  │
│                   └─────────────┘      └─────────────┘      │ Effect    │  │
│                                                             └───────────┘  │
│                                                                             │
│  ★ projectionScope: []인 경우 Project 단계 스킵, LLM 호출 없이 Effect 직접 실행  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 ManifestoRuntime 확장

```typescript
class ManifestoRuntime {
  private projectionEngine: ProjectionEngine;
  private llmClient: LLMClient;
  
  constructor(
    private manifesto: ManifestoDefinition,
    options: RuntimeOptions
  ) {
    this.projectionEngine = new CachedProjectionEngine(
      new ProjectionEngineImpl()
    );
    this.llmClient = options.llmClient;
  }
  
  async executeAction(
    actionId: string,
    snapshot: Snapshot,
    input?: unknown
  ): Promise<ActionResult> {
    const action = this.manifesto.actions[actionId];
    if (!action) {
      throw new Error(`Unknown action: ${actionId}`);
    }
    
    // 1. Precondition 평가 (전체 스냅샷 사용)
    const canExecute = this.evaluateExpression(action.precondition, snapshot);
    if (!canExecute) {
      return { 
        success: false, 
        reason: 'precondition_failed',
        actionId 
      };
    }
    
    // 2. projectionScope 처리
    const { projectedSnapshot, shouldCallLLM } = this.handleProjection(
      action,
      snapshot
    );
    
    // 3. 실행
    if (shouldCallLLM) {
      // LLM 호출이 필요한 액션
      return this.executeWithLLM(action, projectedSnapshot, input);
    } else {
      // 시스템 직접 처리 (projectionScope: [])
      return this.executeDirectly(action, snapshot, input);
    }
  }
  
  private handleProjection(
    action: ActionDefinition,
    snapshot: Snapshot
  ): { projectedSnapshot: ProjectedSnapshot | null; shouldCallLLM: boolean } {
    
    // Case 1: projectionScope가 빈 배열 — LLM 호출 없음
    if (action.projectionScope && action.projectionScope.length === 0) {
      return { projectedSnapshot: null, shouldCallLLM: false };
    }
    
    // Case 2: projectionScope 정의됨 — 해당 경로만 투영
    if (action.projectionScope) {
      const projected = this.projectionEngine.project(
        snapshot,
        action.projectionScope,
        { expandWildcards: true, onMissingPath: 'ignore' }
      );
      
      // 토큰 예산 체크
      if (action.tokenBudget && projected._projection.estimatedTokens > action.tokenBudget) {
        const compressed = this.projectionEngine.compress(
          projected,
          action.tokenBudget,
          'prioritize'
        );
        return { projectedSnapshot: compressed, shouldCallLLM: true };
      }
      
      return { projectedSnapshot: projected, shouldCallLLM: true };
    }
    
    // Case 3: projectionScope 미정의 — 전체 노출 (하위 호환)
    console.warn(`Action "${action.meta?.description}" has no projectionScope. Consider adding one.`);
    return {
      projectedSnapshot: this.projectionEngine.project(snapshot, ['*']),
      shouldCallLLM: true
    };
  }
  
  private async executeWithLLM(
    action: ActionDefinition,
    projectedSnapshot: ProjectedSnapshot,
    input?: unknown
  ): Promise<ActionResult> {
    // 감사 로그 기록
    this.auditLog.record({
      type: 'llm_call',
      actionId: action.meta?.description,
      projectionScope: projectedSnapshot._projection.requestedPaths,
      resolvedPaths: projectedSnapshot._projection.resolvedPaths,
      estimatedTokens: projectedSnapshot._projection.estimatedTokens,
      timestamp: projectedSnapshot._projection.timestamp
    });
    
    // LLM 호출
    const llmResponse = await this.llmClient.call({
      snapshot: projectedSnapshot.data,
      action: action.meta,
      input
    });
    
    // Effect 적용
    return this.applyEffect(action.effect, llmResponse);
  }
  
  private executeDirectly(
    action: ActionDefinition,
    snapshot: Snapshot,
    input?: unknown
  ): ActionResult {
    // 감사 로그 기록
    this.auditLog.record({
      type: 'direct_execution',
      actionId: action.meta?.description,
      reason: 'empty_projection_scope',
      timestamp: Date.now()
    });
    
    // Effect 직접 적용
    return this.applyEffect(action.effect, snapshot);
  }
}
```

### 5.3 감사 로그 스키마

```typescript
interface AuditLogEntry {
  type: 'llm_call' | 'direct_execution';
  actionId: string;
  timestamp: number;
  
  // LLM 호출 시에만
  projectionScope?: StatePath[];
  resolvedPaths?: StatePath[];
  estimatedTokens?: number;
  actualTokens?: number;
  
  // 직접 실행 시에만
  reason?: 'empty_projection_scope' | 'precondition_false';
}

/**
 * 감사 로그 쿼리 예시
 * 
 * Q: "이 답변은 어떤 정보를 보고 생성됐나?"
 * A: auditLog.filter(e => e.actionId === 'generateAnswer')
 *      .map(e => e.resolvedPaths)
 * 
 * Q: "왜 '모른다'고 결론났나?"
 * A: auditLog.filter(e => e.actionId === 'concludeNotFound')
 *      .find(e => e.reason === 'empty_projection_scope')
 *    → projectionScope: [] 이므로 LLM 판단 아닌 시스템 판단
 */
```

---

## 6. 엣지 케이스 처리

### 6.1 존재하지 않는 경로

```typescript
// 시나리오: 선언된 경로가 현재 스냅샷에 없음
checkout: defineAction({
  projectionScope: ['data.cart', 'data.user.preferences.theme'],  // theme이 없을 수 있음
  ...
})

// 처리 전략
const options: ProjectionOptions = {
  onMissingPath: 'ignore'  // 기본값: 무시하고 진행
  // 또는 'null': null로 채움
  // 또는 'error': 에러 발생
};

// 권장: 'ignore' — 선언적 특성 유지
// 이유: "있으면 보여주고, 없으면 말고"가 자연스러움
```

### 6.2 순환 참조

```typescript
// 시나리오: 상태에 순환 참조 존재
const snapshot = {
  data: {
    user: { name: 'Alice', friend: null as any }
  }
};
snapshot.data.user.friend = snapshot.data.user;  // 순환!

// 처리
projectionScope: ['data.user']

// 옵션
const options: ProjectionOptions = {
  onCircularRef: 'truncate',  // [Circular] 표시
  maxDepth: 5                 // 최대 깊이 제한
};
```

### 6.3 대용량 배열

```typescript
// 시나리오: 배열에 10만 개 아이템
projectionScope: ['data.products.*']  // 💥 토큰 폭발

// 해결 1: tokenBudget으로 자동 압축
defineAction({
  projectionScope: ['data.products.*'],
  tokenBudget: 2000,  // 초과 시 자동 압축
  ...
})

// 해결 2: derived로 필터링 (권장)
derived: {
  relevantProducts: {
    deps: ['data.products', 'data.searchQuery'],
    compute: (products, query) => 
      products.filter(p => p.name.includes(query)).slice(0, 10)
  }
}
// 그 후
projectionScope: ['derived.relevantProducts']
```

### 6.4 projectionScope와 precondition의 불일치

```typescript
// 문제: precondition이 참조하는 경로가 projectionScope에 없음
badAction: defineAction({
  projectionScope: ['data.cart'],
  precondition: { 
    $gt: [{ $get: 'derived.userCredit' }, 0]  // userCredit은 projectionScope에 없음!
  },
  ...
})

// 이게 문제가 되는가? 아니다.
// - precondition은 전체 스냅샷으로 평가됨 (실행 가능 여부 판단)
// - projectionScope는 LLM에게 보여줄 것만 결정
// 
// 즉, precondition과 projectionScope는 독립적이다.
// 단, 코드 리뷰 시 의도 확인 필요 — "왜 userCredit은 LLM에게 안 보여주지?"
```

### 6.5 동적 projectionScope 필요성

```typescript
// 시나리오: 사용자 역할에 따라 다른 정보 노출
// 현재 설계로는 정적 선언만 가능

// 옵션 1: 역할별 액션 분리 (권장)
viewAnalytics_viewer: defineAction({
  projectionScope: ['data.analytics.public'],
  precondition: { $eq: [{ $get: 'session.role' }, 'viewer'] },
  ...
})
viewAnalytics_admin: defineAction({
  projectionScope: ['data.analytics.public', 'data.analytics.sensitive'],
  precondition: { $eq: [{ $get: 'session.role' }, 'admin'] },
  ...
})

// 옵션 2: 동적 projectionScope (Phase 2에서 고려)
viewAnalytics: defineAction({
  projectionScope: {
    $if: [
      { $eq: [{ $get: 'session.role' }, 'admin'] },
      ['data.analytics.*'],
      ['data.analytics.public']
    ]
  },
  ...
})
// 복잡성 증가 — 정말 필요할 때만
```

---

## 7. 스키마 검증

### 7.1 정적 검증 (빌드 타임)

```typescript
interface SchemaValidator {
  /**
   * projectionScope의 경로들이 스키마에 존재하는지 검증
   */
  validateProjectionPaths(
    manifesto: ManifestoDefinition
  ): ValidationResult[];
}

// 검증 규칙
const validationRules = [
  // 1. 경로가 스키마에 존재하는가?
  {
    id: 'path-exists',
    check: (path, schema) => pathExistsInSchema(path, schema),
    severity: 'error'
  },
  
  // 2. 와일드카드 사용이 적절한가?
  {
    id: 'wildcard-on-array-or-object',
    check: (path, schema) => {
      if (!path.includes('*')) return true;
      const parentType = getTypeAtPath(path.replace('.*', ''), schema);
      return parentType === 'array' || parentType === 'object';
    },
    severity: 'error'
  },
  
  // 3. 민감 필드 노출 경고
  {
    id: 'sensitive-field-exposure',
    check: (path, schema) => {
      const sensitivePatterns = ['password', 'token', 'secret', 'key'];
      return !sensitivePatterns.some(p => path.toLowerCase().includes(p));
    },
    severity: 'warning'
  },
  
  // 4. projectionScope 미정의 경고
  {
    id: 'missing-projection-scope',
    check: (action) => action.projectionScope !== undefined,
    severity: 'warning',
    message: 'Consider adding projectionScope for token optimization'
  }
];
```

### 7.2 런타임 검증

```typescript
class RuntimeValidator {
  /**
   * 투영 결과가 예상과 일치하는지 검증 (개발 모드)
   */
  validateProjection(
    projected: ProjectedSnapshot,
    scope: ProjectionScope
  ): void {
    if (process.env.NODE_ENV !== 'development') return;
    
    // 요청한 경로가 실제로 포함되었는지 확인
    for (const path of scope) {
      if (!path.includes('*')) {
        const value = getValueAtPath(projected.data, path);
        if (value === undefined) {
          console.warn(`ProjectionScope path "${path}" resolved to undefined`);
        }
      }
    }
    
    // 요청하지 않은 경로가 포함되지 않았는지 확인
    const allPaths = getAllPaths(projected.data);
    const scopeSet = new Set(projected._projection.resolvedPaths);
    
    for (const path of allPaths) {
      if (!scopeSet.has(path)) {
        console.error(`Unexpected path in projection: "${path}"`);
      }
    }
  }
}
```

---

## 8. 테스트 전략

### 8.1 단위 테스트

```typescript
describe('ProjectionEngine', () => {
  let engine: ProjectionEngine;
  
  beforeEach(() => {
    engine = new ProjectionEngineImpl();
  });
  
  describe('project()', () => {
    const snapshot = {
      data: {
        user: { name: 'Alice', email: 'alice@test.com', password: 'secret' },
        cart: { items: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }] },
        products: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Product ${i}` }))
      },
      derived: {
        cartTotal: 15000,
        itemCount: 3
      }
    };
    
    it('빈 scope는 빈 객체 반환', () => {
      const result = engine.project(snapshot, []);
      expect(result.data).toEqual({});
      expect(result._projection.estimatedTokens).toBe(0);
    });
    
    it('단일 경로 추출', () => {
      const result = engine.project(snapshot, ['data.user.name']);
      expect(result.data).toEqual({ data: { user: { name: 'Alice' } } });
    });
    
    it('다중 경로 추출', () => {
      const result = engine.project(snapshot, ['data.user.name', 'derived.cartTotal']);
      expect(result.data).toEqual({
        data: { user: { name: 'Alice' } },
        derived: { cartTotal: 15000 }
      });
    });
    
    it('와일드카드 확장', () => {
      const result = engine.project(snapshot, ['data.cart.items.*']);
      expect(result._projection.resolvedPaths).toContain('data.cart.items.0');
      expect(result._projection.resolvedPaths).toContain('data.cart.items.1');
    });
    
    it('중첩 와일드카드', () => {
      const result = engine.project(snapshot, ['data.cart.items.*.id']);
      expect(result.data).toEqual({
        data: { cart: { items: [{ id: 1 }, { id: 2 }] } }
      });
    });
    
    it('존재하지 않는 경로는 무시', () => {
      const result = engine.project(snapshot, ['data.nonexistent', 'data.user.name']);
      expect(result.data).toEqual({ data: { user: { name: 'Alice' } } });
    });
    
    it('민감 정보 포함 여부 확인', () => {
      const result = engine.project(snapshot, ['data.user']);
      // password가 포함됨 — projectionScope에서 명시적으로 제외해야 함
      expect(result.data.data.user.password).toBeDefined();
      
      // 올바른 사용
      const safeResult = engine.project(snapshot, ['data.user.name', 'data.user.email']);
      expect(safeResult.data.data?.user?.password).toBeUndefined();
    });
  });
  
  describe('estimateTokens()', () => {
    it('빈 객체는 0 토큰', () => {
      const projected = { data: {}, _projection: { ... } };
      expect(engine.estimateTokens(projected)).toBe(0);
    });
    
    it('대략적 토큰 추정', () => {
      const projected = { data: { name: 'Alice' }, _projection: { ... } };
      // {"name":"Alice"} = 17자 ≈ 4~5 토큰
      expect(engine.estimateTokens(projected)).toBeGreaterThan(0);
      expect(engine.estimateTokens(projected)).toBeLessThan(10);
    });
  });
  
  describe('compress()', () => {
    it('예산 내면 압축 안 함', () => {
      const projected = engine.project(snapshot, ['data.user.name']);
      const compressed = engine.compress(projected, 1000, 'truncate');
      expect(compressed).toEqual(projected);
    });
    
    it('예산 초과 시 truncate', () => {
      const projected = engine.project(snapshot, ['data.products.*']);
      const compressed = engine.compress(projected, 100, 'truncate');
      expect(compressed._projection.estimatedTokens).toBeLessThanOrEqual(100);
    });
  });
});
```

### 8.2 통합 테스트

```typescript
describe('Runtime + ProjectionEngine Integration', () => {
  let runtime: ManifestoRuntime;
  let mockLLM: jest.Mocked<LLMClient>;
  
  beforeEach(() => {
    mockLLM = {
      call: jest.fn().mockResolvedValue({ result: 'ok' })
    };
    
    runtime = new ManifestoRuntime(testManifesto, { llmClient: mockLLM });
  });
  
  it('projectionScope: [] 이면 LLM 호출 안 함', async () => {
    await runtime.executeAction('concludeNotFound', testSnapshot);
    expect(mockLLM.call).not.toHaveBeenCalled();
  });
  
  it('projectionScope 정의 시 해당 경로만 LLM에 전달', async () => {
    await runtime.executeAction('checkout', testSnapshot);
    
    const llmCallArg = mockLLM.call.mock.calls[0][0];
    expect(llmCallArg.snapshot).toHaveProperty('data.cart');
    expect(llmCallArg.snapshot).toHaveProperty('derived.cartTotal');
    expect(llmCallArg.snapshot).not.toHaveProperty('data.products');
  });
  
  it('감사 로그에 projectionScope 기록', async () => {
    await runtime.executeAction('checkout', testSnapshot);
    
    const auditEntry = runtime.getAuditLog().slice(-1)[0];
    expect(auditEntry.projectionScope).toEqual(['data.cart', 'derived.cartTotal']);
    expect(auditEntry.estimatedTokens).toBeGreaterThan(0);
  });
});
```

### 8.3 성능 테스트

```typescript
describe('Performance', () => {
  it('대용량 스냅샷에서 projection 성능', () => {
    const largeSnapshot = {
      data: {
        products: Array.from({ length: 100000 }, (_, i) => ({
          id: i,
          name: `Product ${i}`,
          description: 'x'.repeat(1000)
        }))
      }
    };
    
    const start = performance.now();
    engine.project(largeSnapshot, ['data.products.0', 'data.products.1']);
    const elapsed = performance.now() - start;
    
    // 100ms 이내 완료 (10만 개 중 2개만 추출)
    expect(elapsed).toBeLessThan(100);
  });
  
  it('와일드카드 확장 성능', () => {
    const snapshot = {
      data: {
        items: Array.from({ length: 1000 }, (_, i) => ({ id: i }))
      }
    };
    
    const start = performance.now();
    engine.project(snapshot, ['data.items.*.id']);
    const elapsed = performance.now() - start;
    
    // 1000개 와일드카드 확장 500ms 이내
    expect(elapsed).toBeLessThan(500);
  });
});
```

---

## 9. 구현 로드맵

### Phase 1: Core Engine (1주)

```
목표: ProjectionEngine 핵심 구현

태스크:
□ 타입 정의 (StatePath, ProjectionScope, ProjectedSnapshot)
□ 경로 파서 구현 (점 표기법, 인덱스)
□ 기본 project() 구현 (와일드카드 제외)
□ estimateTokens() 구현
□ 단위 테스트 작성

산출물:
- ProjectionEngine 클래스
- 80%+ 테스트 커버리지
```

### Phase 2: Advanced Features (1주)

```
목표: 와일드카드, 압축, 캐싱

태스크:
□ 와일드카드 확장 구현
□ 중첩 와일드카드 지원
□ compress() 구현 (truncate, prioritize)
□ CachedProjectionEngine 구현
□ 성능 테스트 작성

산출물:
- 완전한 ProjectionEngine
- 캐싱 레이어
- 성능 벤치마크
```

### Phase 3: Runtime Integration (1주)

```
목표: ManifestoRuntime에 통합

태스크:
□ ActionDefinition 타입 확장 (projectionScope, tokenBudget)
□ executeAction() 수정
□ 감사 로그 구현
□ 통합 테스트 작성
□ 하위 호환성 테스트

산출물:
- 확장된 ManifestoRuntime
- 감사 로그 시스템
- 마이그레이션 가이드
```

### Phase 4: Validation & Tooling (1주)

```
목표: 개발자 경험 향상

태스크:
□ 스키마 검증기 구현
□ 런타임 검증 (개발 모드)
□ VSCode 자동완성 지원 (타입 개선)
□ 디버깅 도구 (projection 시각화)
□ 문서 작성

산출물:
- 검증 도구
- IDE 지원
- API 문서
```

---

## 10. 마이그레이션 가이드

### 10.1 기존 코드 마이그레이션

```typescript
// Before: projectionScope 없음
actions: {
  checkout: defineAction({
    precondition: ...,
    effect: ...
  })
}

// After: projectionScope 추가 (권장)
actions: {
  checkout: defineAction({
    projectionScope: ['data.cart', 'data.user.address', 'derived.cartTotal'],
    precondition: ...,
    effect: ...
  })
}

// 하위 호환: projectionScope 없으면 전체 노출 (경고 발생)
```

### 10.2 점진적 적용

```typescript
// Step 1: 가장 비용이 큰 액션부터
// 어떤 액션이 토큰을 많이 쓰는지 감사 로그로 확인
const topTokenActions = auditLog
  .filter(e => e.type === 'llm_call')
  .sort((a, b) => b.actualTokens - a.actualTokens)
  .slice(0, 10);

// Step 2: 해당 액션에 projectionScope 추가
// Step 3: 토큰 감소 확인
// Step 4: 다음 액션으로
```

---

## 11. FAQ

### Q1: deps와 projectionScope가 중복되는 것 아닌가?

**A**: 아니다. 직교하는 개념이다.

```typescript
// deps: "cartTotal을 계산하려면 items와 products가 필요해"
cartTotal: {
  deps: ['data.cart.items', 'data.products'],
  compute: ...
}

// projectionScope: "checkout 시 LLM에게는 cart와 cartTotal만 보여줘"
checkout: {
  projectionScope: ['data.cart', 'derived.cartTotal'],
  // data.products는 계산에 필요했지만 LLM에게는 불필요
}
```

### Q2: projectionScope: []가 왜 중요한가?

**A**: Explainable Ignorance의 핵심이다.

```typescript
concludeNotFound: defineAction({
  projectionScope: [],  // LLM 호출 없음
  precondition: { $get: 'derived.informationNotFound' },
  ...
})
```

- `derived.informationNotFound`가 true면 시스템이 직접 "모른다" 결론
- LLM이 "모른다고 결정한" 게 아니라 시스템이 "구조적으로 판단"
- 왜 모르는지? `reasoningPath`에 모든 시도가 기록되어 있음
- 이게 Hallucination 문제의 구조적 해결책

### Q3: 동적 projectionScope는 지원하지 않는가?

**A**: Phase 1에서는 정적 선언만 지원한다.

동적 scope가 필요하면:
1. 역할/상황별로 액션을 분리 (권장)
2. derived에서 필터링 후 해당 derived를 scope에 포함

Phase 2에서 Expression 기반 동적 scope 검토 예정.

### Q4: tokenBudget 초과 시 어떻게 되나?

**A**: 설정된 CompressionStrategy에 따라 자동 압축된다.

```typescript
defineAction({
  projectionScope: ['data.products.*'],
  tokenBudget: 2000,
  // 기본 전략: 'prioritize' (관련성 높은 것 우선)
})
```

압축 발생 시 감사 로그에 기록되므로 추적 가능.

---

## 12. 참고 자료

- [Manifesto Core Specification](./manifesto_spec.md)
- [HSCA Architecture](./hsca_architecture.md)
- [Expression DSL Reference](./expression_dsl.md)

---

*This document is part of the Manifesto Protocol specification.*
