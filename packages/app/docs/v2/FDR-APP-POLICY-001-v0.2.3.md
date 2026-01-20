# FDR-APP-POLICY-001: ExecutionKey Policy & ApprovedScope

> **Version:** 0.2.3 (Draft)
> **Status:** Draft
> **Date:** 2026-01-19
> **Scope:** App v2 ExecutionKey derivation, ApprovedScope enforcement, Proposal routing
> **Depends on:** ARCHITECTURE v2, ADR-001, World SPEC v2.0.2, Host SPEC v2.0.2, FDR-APP-INTEGRATION-001
>
> **Changelog:**
> - v0.2.3: PUB-001 교차 참조 추가 — References 섹션에 FDR-APP-PUB-001 추가, EXK-TICK 규칙에 PUB-001 정합성 주석 추가
> - v0.2.2: 타입 정합 — executionKeyPolicy 필드명 통일, binding null 방어, HostExecutionResult 참조 추가, PUB-001 교차 참조
> - v0.2.1: 최종 봉합 — attempt 불일치 수정, getBinding 추가, 직렬화 정책 attempt 제거, config 타입 정합, canonical serialization
> - v0.2.0: 리뷰 피드백 반영 — outcome 필드 정합, SEC-1 HMAC 기반, attempt 출처 명시, tick/publish 경계, allowedPaths World-owned path 제한

---

## 1. Overview

### 1.1 Why This FDR Exists

World SPEC은 **무엇을** 정의한다:
- ExecutionKey는 Proposal마다 결정되어야 함 (WORLD-EXK-1)
- ExecutionKey는 Proposal record에 고정됨 (WORLD-EXK-2)
- Host는 ExecutionKey를 opaque로 취급 (WORLD-EXK-3)

ADR-001은 **누가** 구현하는지 결정했다:
- App이 ExecutionKey policy를 구현함
- App이 approvedScope enforcement를 담당함

이 FDR은 **어떻게** 구현하는지 정의한다.

### 1.2 Design Principles

| Principle | Description |
|-----------|-------------|
| **Policy is Configurable** | ExecutionKey 정책은 App 설정으로 교체 가능 |
| **Scope is Enforceable** | ApprovedScope는 실행 전 검증 가능한 형태 |
| **Authority is Pluggable** | 승인 정책은 확장 가능 |
| **Serialization is Explicit** | 직렬화 필요 시 명시적으로 선택 |

### 1.3 Core Insight

> **정책은 "결정"이 아니라 "결정 방법"이다.**
>
> World는 "이 Proposal을 어떤 ExecutionKey로 실행할지"를 묻고,
> App의 Policy가 "이 규칙에 따라 이 key를 쓴다"고 답한다.

---

## 2. ExecutionKey Policy

### 2.1 Context & Key Derivation

**D-EXK-1:** App은 ExecutionKeyPolicy를 통해 Proposal → ExecutionKey 매핑을 결정한다.

```typescript
/**
 * ExecutionKey 결정에 필요한 컨텍스트
 */
type ExecutionKeyContext = {
  /** Proposal 식별자 */
  readonly proposalId: ProposalId;
  
  /** 제안자 */
  readonly actorId: ActorId;
  
  /** 실행 기준 World */
  readonly baseWorld: WorldId;
  
  /**
   * 실행 시도 횟수 (첫 시도 = 1)
   * 
   * App 정책 레이어에서 관리하며, proposal.meta.executionAttempt에서 가져옴.
   * World SPEC의 Proposal에는 명시 필드가 없으므로, App이 재시도 정책에서 관리.
   * 
   * v2에서 ProposalId는 유일하므로, 재시도 미지원 시 항상 1로 고정.
   */
  readonly attempt: number;
  
  /** Intent 타입 (선택적 라우팅용) */
  readonly intentType?: string;
  
  /** 추가 메타데이터 */
  readonly meta?: Record<string, unknown>;
};

/**
 * ExecutionKey를 결정하는 정책 함수
 */
type ExecutionKeyPolicy = (ctx: ExecutionKeyContext) => ExecutionKey;

/**
 * ExecutionKeyContext 생성
 */
function createExecutionKeyContext(proposal: Proposal): ExecutionKeyContext {
  return {
    proposalId: proposal.proposalId,
    actorId: proposal.actorId,
    baseWorld: proposal.baseWorld,
    // attempt는 App 정책 레이어에서 관리 (EXK-ATTEMPT-1)
    attempt: (proposal.meta?.executionAttempt as number) ?? 1,
    intentType: proposal.intent.type,
    meta: proposal.meta,
  };
}
```
```

### 2.2 Built-in Policies

**D-EXK-2:** App은 기본 제공 정책을 포함하며, 필요 시 교체 가능하다.

```typescript
/**
 * 기본 정책: 각 Proposal이 독립 mailbox (병렬 실행)
 * 
 * 특징: 최대 병렬성, 순서 보장 없음
 * 적합: 독립적인 작업들
 * 
 * Note: attempt 포함 - 재시도는 별도 lane
 */
const defaultPolicy: ExecutionKeyPolicy = ({ proposalId, attempt }) =>
  `proposal:${proposalId}:${attempt}`;

/**
 * Actor 직렬화 정책: 같은 Actor의 Proposal은 직렬화
 * 
 * 특징: Actor 내 순서 보장 (재시도 포함)
 * 적합: 사용자별 작업 순서가 중요할 때
 * 
 * Note: attempt 미포함 - 같은 Actor의 모든 시도가 하나의 lane
 */
const actorSerialPolicy: ExecutionKeyPolicy = ({ actorId }) =>
  `actor:${actorId}`;

/**
 * Base 직렬화 정책: 같은 baseWorld의 Proposal은 직렬화
 * 
 * 특징: 충돌 가능성 최소화 (재시도 포함)
 * 적합: 같은 상태를 기반으로 한 작업 충돌 방지
 * 
 * Note: attempt 미포함 - 같은 base의 모든 시도가 하나의 lane
 */
const baseSerialPolicy: ExecutionKeyPolicy = ({ baseWorld }) =>
  `base:${baseWorld}`;

/**
 * 전역 직렬화 정책: 모든 Proposal 직렬화
 * 
 * 특징: 완전 순차 실행 (재시도 포함)
 * 적합: 모든 작업이 순서대로 실행되어야 할 때
 * 
 * Note: attempt 미포함 - 전역 단일 lane 보장
 */
const globalSerialPolicy: ExecutionKeyPolicy = () =>
  `global`;

/**
 * Intent 타입 기반 정책: 같은 타입의 Intent는 직렬화
 * 
 * 특징: 타입별 순서 보장 (재시도 포함)
 * 적합: 특정 작업 타입 간 충돌 방지
 * 
 * Note: attempt 미포함 - 같은 타입의 모든 시도가 하나의 lane
 */
const intentTypeSerialPolicy: ExecutionKeyPolicy = ({ intentType }) =>
  `intent:${intentType ?? 'unknown'}`;
```

> **Design Note:** `attempt`는 **defaultPolicy에서만** 포함된다.
> 직렬화 정책(actor, base, global, intentType)은 "같은 lane"을 보장해야 하므로 attempt를 포함하지 않는다.
> 이렇게 해야 재시도도 동일한 lane에서 직렬화된다.

### 2.3 Composite Policy

**D-EXK-3:** 복합 정책을 통해 여러 조건을 조합할 수 있다.

```typescript
/**
 * 조건부 정책: 조건에 따라 다른 정책 적용
 */
type PolicyCondition = (ctx: ExecutionKeyContext) => boolean;

type ConditionalPolicy = {
  readonly condition: PolicyCondition;
  readonly policy: ExecutionKeyPolicy;
};

function createCompositePolicy(
  conditionals: ConditionalPolicy[],
  fallback: ExecutionKeyPolicy = defaultPolicy
): ExecutionKeyPolicy {
  return (ctx) => {
    for (const { condition, policy } of conditionals) {
      if (condition(ctx)) {
        return policy(ctx);
      }
    }
    return fallback(ctx);
  };
}

// 예시: Agent는 직렬화, Human은 병렬
const hybridPolicy = createCompositePolicy([
  {
    condition: (ctx) => ctx.meta?.actorKind === 'agent',
    policy: actorSerialPolicy,
  },
], defaultPolicy);
```

### 2.4 Policy Configuration

```typescript
type ExecutionPolicyConfig = {
  /** 기본 ExecutionKey 정책 */
  executionKeyPolicy: ExecutionKeyPolicy;
  
  /** Intent 타입별 override (선택) */
  intentTypeOverrides?: Record<string, ExecutionKeyPolicy>;
  
  /** Actor 종류별 override (선택) */
  actorKindOverrides?: Record<ActorKind, ExecutionKeyPolicy>;
};

const defaultExecutionPolicyConfig: ExecutionPolicyConfig = {
  executionKeyPolicy: defaultPolicy,
  intentTypeOverrides: {},
  actorKindOverrides: {},
};
```

### 2.5 Policy Resolution

```typescript
function resolveExecutionKey(
  ctx: ExecutionKeyContext,
  config: ExecutionPolicyConfig
): ExecutionKey {
  // 1. Intent 타입 override 확인
  if (ctx.intentType && config.intentTypeOverrides?.[ctx.intentType]) {
    return config.intentTypeOverrides[ctx.intentType](ctx);
  }
  
  // 2. Actor 종류 override 확인
  const actorKind = ctx.meta?.actorKind as ActorKind | undefined;
  if (actorKind && config.actorKindOverrides?.[actorKind]) {
    return config.actorKindOverrides[actorKind](ctx);
  }
  
  // 3. 기본 정책 적용
  return config.executionKeyPolicy(ctx);
}
```

### 2.6 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| EXK-POLICY-1 | MUST | App MUST provide ExecutionKeyPolicy implementation |
| EXK-POLICY-2 | MUST | ExecutionKey MUST be deterministic for same context |
| EXK-POLICY-3 | MUST | ExecutionKey MUST be fixed before execution starts (WORLD-EXK-2) |
| EXK-POLICY-4 | SHOULD | App SHOULD support policy configuration |
| EXK-POLICY-5 | MAY | App MAY support intent/actor-specific policy overrides |
| EXK-ATTEMPT-1 | MUST | App MUST define a single authoritative source of attempt (proposal.meta.executionAttempt, default 1) |

### 2.7 Tick/Publish Boundary with Serialization Policies

**D-EXK-TICK:** 여러 Proposal이 같은 ExecutionKey를 공유할 때 (직렬화 정책), tick/publish 경계는 **Proposal 단위**로 정의된다.

> **Cross-reference:** 이 정의는 FDR-APP-PUB-001 v0.3.0의 **Proposal Tick** 개념과 동일하다.
> PUB-001에서 Host Tick(mailbox idle)과 Proposal Tick(execution cycle)을 구분하며,
> Proposal Tick이 publish boundary의 권위 있는 기준이다.

> **Critical:** `actorSerialPolicy`, `baseSerialPolicy`, `globalSerialPolicy`는 여러 Proposal을 같은 ExecutionKey로 매핑할 수 있다.
> 이 경우에도 publish는 "mailbox idle" 시점이 아니라 **각 Proposal의 terminalSnapshot 도달 시점**에 발생해야 한다.

```typescript
/**
 * Tick 정의 (직렬화 정책에서도 유효)
 * 
 * tick = 한 Proposal이 startExecution()부터 terminalSnapshot 도달까지의 구간
 * 
 * 같은 ExecutionKey를 공유하는 여러 Proposal이 있어도,
 * 각 Proposal마다 별도의 tick이 발생한다.
 */
type ProposalTick = {
  readonly proposalId: ProposalId;
  readonly executionKey: ExecutionKey;
  readonly startedAt: number;
  readonly completedAt: number;
  readonly terminalSnapshot: Snapshot;
};
```

| Rule ID | Level | Description |
|---------|-------|-------------|
| EXK-TICK-1 | MUST | A tick is defined as one Proposal execution cycle (startExecution → terminalSnapshot) |
| EXK-TICK-2 | MUST | state:publish MUST occur at most once per proposal-tick, even if proposals share ExecutionKey |
| EXK-TICK-3 | MUST NOT | Multiple proposals on same ExecutionKey MUST NOT merge into single tick |

---

## 3. ApprovedScope

### 3.1 What is ApprovedScope?

**D-SCOPE-1:** ApprovedScope는 Authority가 승인한 **실행 범위 제한**이다.

```typescript
/**
 * ApprovedScope: Authority가 승인한 실행 범위
 * 
 * 예시:
 * - 특정 Actor만 실행 가능
 * - 특정 Intent type만 허용
 * - 특정 data 필드만 수정 가능
 * - 실행 시간 제한
 */
type ApprovedScope = {
  /** Scope 식별자 */
  readonly scopeId: string;
  
  /** 허용된 Actor 목록 (비어있으면 제한 없음) */
  readonly allowedActors?: readonly ActorId[];
  
  /** 허용된 Intent type 목록 (비어있으면 제한 없음) */
  readonly allowedIntentTypes?: readonly string[];
  
  /** 수정 가능한 경로 패턴 (비어있으면 제한 없음) */
  readonly allowedPaths?: readonly string[];
  
  /** 실행 시간 제한 (ms) */
  readonly timeoutMs?: number;
  
  /** 추가 제약 조건 */
  readonly constraints?: Record<string, unknown>;
};
```

### 3.2 Scope Generation

**D-SCOPE-2:** ApprovedScope는 Authority의 승인 결정에서 생성된다.

```typescript
/**
 * Authority 승인 시 scope 생성
 */
type AuthorityDecision = {
  readonly approved: boolean;
  readonly reason?: string;
  readonly scope?: ApprovedScope;  // approved === true일 때
};

/**
 * Scope generator: Authority 정책에 따라 scope 생성
 */
type ScopeGenerator = (
  proposal: Proposal,
  authority: AuthorityRef,
  policy: AuthorityPolicy
) => ApprovedScope;

// 기본 scope generator: 제한 없음
const defaultScopeGenerator: ScopeGenerator = (proposal) => ({
  scopeId: `scope:${proposal.proposalId}`,
});

// 제한적 scope generator: Actor, Intent type 제한
const restrictiveScopeGenerator: ScopeGenerator = (proposal, authority, policy) => ({
  scopeId: `scope:${proposal.proposalId}`,
  allowedActors: [proposal.actorId],
  allowedIntentTypes: [proposal.intent.type],
  timeoutMs: 30_000,
});
```

### 3.3 Scope Enforcement

**D-SCOPE-3:** App은 실행 전 ApprovedScope를 검증한다.

```typescript
/**
 * Scope 위반 결과
 */
type ScopeViolation = {
  readonly type: 'actor' | 'intent_type' | 'path' | 'timeout' | 'constraint';
  readonly expected: unknown;
  readonly actual: unknown;
  readonly message: string;
};

/**
 * Scope 검증 결과
 */
type ScopeValidationResult =
  | { valid: true }
  | { valid: false; violations: ScopeViolation[] };

/**
 * 실행 전 scope 검증
 */
function validateScope(
  proposal: Proposal,
  scope: ApprovedScope
): ScopeValidationResult {
  const violations: ScopeViolation[] = [];
  
  // 1. Actor 검증
  if (scope.allowedActors && scope.allowedActors.length > 0) {
    if (!scope.allowedActors.includes(proposal.actorId)) {
      violations.push({
        type: 'actor',
        expected: scope.allowedActors,
        actual: proposal.actorId,
        message: `Actor ${proposal.actorId} not in allowed list`,
      });
    }
  }
  
  // 2. Intent type 검증
  if (scope.allowedIntentTypes && scope.allowedIntentTypes.length > 0) {
    if (!scope.allowedIntentTypes.includes(proposal.intent.type)) {
      violations.push({
        type: 'intent_type',
        expected: scope.allowedIntentTypes,
        actual: proposal.intent.type,
        message: `Intent type ${proposal.intent.type} not allowed`,
      });
    }
  }
  
  if (violations.length > 0) {
    return { valid: false, violations };
  }
  
  return { valid: true };
}
```

### 3.4 Scope in Execution

```typescript
/**
 * HostExecutionOptions에 scope 전달
 */
async function executeWithScope(
  executor: HostExecutor,
  key: ExecutionKey,
  baseSnapshot: Snapshot,
  intent: Intent,
  scope: ApprovedScope
): Promise<HostExecutionResult> {
  return executor.execute(key, baseSnapshot, intent, {
    approvedScope: scope,
    timeoutMs: scope.timeoutMs,
  });
}
```

### 3.5 Post-Execution Scope Validation

**D-SCOPE-4:** 실행 후에도 scope 준수 여부를 검증할 수 있다.

> **Important:** `allowedPaths`는 **World-owned data paths만** 적용된다.
> `system.*`과 `data.$host` 변경은 scope path 검증에서 **무시**된다.
> 이는 FDR-APP-INTEGRATION-001의 Delta 범위와 일치한다.

```typescript
/**
 * 실행 결과의 scope 준수 검증 (World-owned paths만)
 * 
 * 검증 대상: data.* (excluding $host)
 * 검증 제외: system.*, data.$host
 */
function validateResultScope(
  baseSnapshot: Snapshot,
  terminalSnapshot: Snapshot,
  scope: ApprovedScope
): ScopeValidationResult {
  if (!scope.allowedPaths || scope.allowedPaths.length === 0) {
    return { valid: true };
  }
  
  const violations: ScopeViolation[] = [];
  
  // World-owned paths만 추출 (SCOPE-PATH-1)
  const changedPaths = extractWorldOwnedChangedPaths(baseSnapshot, terminalSnapshot);
  
  // 허용된 패턴과 매칭
  for (const path of changedPaths) {
    const isAllowed = scope.allowedPaths.some(pattern => matchPath(path, pattern));
    if (!isAllowed) {
      violations.push({
        type: 'path',
        expected: scope.allowedPaths,
        actual: path,
        message: `Path ${path} modification not allowed`,
      });
    }
  }
  
  if (violations.length > 0) {
    return { valid: false, violations };
  }
  
  return { valid: true };
}

/**
 * World-owned paths만 추출 (Delta 범위와 일치)
 * 
 * 포함: data.* (excluding $host)
 * 제외: system.*, data.$host
 */
function extractWorldOwnedChangedPaths(
  baseSnapshot: Snapshot,
  terminalSnapshot: Snapshot
): string[] {
  const allChangedPaths = diff(baseSnapshot, terminalSnapshot)
    .map(patch => patch.path);
  
  return allChangedPaths.filter(path => {
    // system.* 제외
    if (path.startsWith('/system/')) return false;
    
    // data.$host 제외
    if (path.startsWith('/data/$host')) return false;
    
    // data.* 포함
    if (path.startsWith('/data/')) return true;
    
    // 그 외 제외
    return false;
  });
}
```

> **Post-validation 실패 시 처리:**
> 실행이 이미 완료되었으므로 "없던 일로" 하면 World의 실행-stage 불변식이 깨진다.
> 따라서 post-validation 실패 시 **failed world로 봉인**하는 것이 올바른 처리다.

### 3.6 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SCOPE-1 | MUST | ApprovedScope MUST be generated at Authority decision time |
| SCOPE-2 | MUST | App MUST validate scope before execution |
| SCOPE-3 | MUST | Scope violation MUST prevent execution |
| SCOPE-4 | SHOULD | App SHOULD validate result scope after execution |
| SCOPE-5 | MAY | Scope MAY include custom constraints |
| SCOPE-PATH-1 | MUST | allowedPaths applies only to World-owned data paths (data excluding $host). system.* and data.$host changes MUST be ignored |
| SCOPE-POST-1 | MUST | Post-validation failure MUST result in failed world (not rollback) |

---

## 4. Proposal Routing

### 4.1 Authority Routing

**D-ROUTE-1:** Proposal은 Actor-Authority binding에 따라 Authority로 라우팅된다.

```typescript
/**
 * Authority 라우팅
 */
interface AuthorityRouter {
  /** Actor → Authority 매핑 조회 */
  getAuthority(actorId: ActorId): AuthorityRef | null;
  
  /** Actor → Binding 전체 조회 */
  getBinding(actorId: ActorId): ActorAuthorityBinding | null;
  
  /** 새 binding 등록 */
  registerBinding(binding: ActorAuthorityBinding): void;
  
  /** Binding 해제 */
  unregisterBinding(actorId: ActorId): void;
}

class DefaultAuthorityRouter implements AuthorityRouter {
  private bindings = new Map<ActorId, ActorAuthorityBinding>();
  
  getAuthority(actorId: ActorId): AuthorityRef | null {
    const binding = this.bindings.get(actorId);
    if (!binding) return null;
    
    return {
      authorityId: binding.authorityId,
      kind: this.deriveKind(binding.policy),
    };
  }
  
  getBinding(actorId: ActorId): ActorAuthorityBinding | null {
    return this.bindings.get(actorId) ?? null;
  }
  
  private deriveKind(policy: AuthorityPolicy): AuthorityKind {
    switch (policy.mode) {
      case 'auto_approve': return 'auto';
      case 'hitl': return 'human';
      case 'policy_rules': return 'policy';
      case 'tribunal': return 'tribunal';
    }
  }
  
  registerBinding(binding: ActorAuthorityBinding): void {
    this.bindings.set(binding.actorId, binding);
  }
  
  unregisterBinding(actorId: ActorId): void {
    this.bindings.delete(actorId);
  }
}
```

### 4.2 Authority Decision Process

```typescript
/**
 * Authority가 Proposal을 평가
 */
type AuthorityEvaluator = (
  proposal: Proposal,
  authority: AuthorityRef,
  policy: AuthorityPolicy
) => Promise<AuthorityDecision>;

const autoApproveEvaluator: AuthorityEvaluator = async (proposal) => ({
  approved: true,
  scope: defaultScopeGenerator(proposal, null!, { mode: 'auto_approve' }),
});

const hitlEvaluator: AuthorityEvaluator = async (proposal, authority, policy) => {
  if (policy.mode !== 'hitl') throw new Error('Invalid policy');
  
  // Human-in-the-loop: 외부 승인 대기
  const decision = await waitForHumanDecision(proposal, policy.delegate);
  return decision;
};

const policyRulesEvaluator: AuthorityEvaluator = async (proposal, authority, policy) => {
  if (policy.mode !== 'policy_rules') throw new Error('Invalid policy');
  
  // 정책 규칙 평가
  const result = evaluatePolicyRules(proposal, policy.rules);
  return {
    approved: result.passed,
    reason: result.reason,
    scope: result.passed ? result.scope : undefined,
  };
};
```

### 4.3 Proposal Flow Integration

```typescript
/**
 * Proposal 라우팅 및 승인 흐름
 */
async function routeAndApprove(
  proposal: Proposal,
  router: AuthorityRouter,
  evaluators: Map<AuthorityKind, AuthorityEvaluator>
): Promise<{ decision: AuthorityDecision; authority: AuthorityRef }> {
  // 1. Authority 찾기
  const authority = router.getAuthority(proposal.actorId);
  if (!authority) {
    throw new Error(`No authority binding for actor ${proposal.actorId}`);
  }
  
  // 2. Binding 조회 (null 방어)
  const binding = router.getBinding(proposal.actorId);
  if (!binding) {
    throw new Error(`No binding found for actor ${proposal.actorId}`);
  }
  const policy = binding.policy;
  
  // 3. Evaluator 선택
  const evaluator = evaluators.get(authority.kind);
  if (!evaluator) {
    throw new Error(`No evaluator for authority kind ${authority.kind}`);
  }
  
  // 4. 평가 실행
  const decision = await evaluator(proposal, authority, policy);
  
  return { decision, authority };
}
```

### 4.4 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| ROUTE-1 | MUST | Every Actor MUST have exactly one Authority binding (BIND-1) |
| ROUTE-2 | MUST | Proposal MUST be routed to Actor's bound Authority |
| ROUTE-3 | MUST | Authority MUST produce ApprovedScope on approval |
| ROUTE-4 | SHOULD | App SHOULD support pluggable AuthorityEvaluator |

---

## 5. Integration with App Runtime

### 5.1 Policy Service

**D-POLICY-SVC-1:** App은 PolicyService를 통해 정책 관련 기능을 중앙화한다.

```typescript
/**
 * PolicyService: 정책 관련 기능 통합
 */
interface PolicyService {
  // === ExecutionKey ===
  
  /** Proposal의 ExecutionKey 결정 */
  deriveExecutionKey(proposal: Proposal): ExecutionKey;
  
  // === Authority ===
  
  /** Authority 라우팅 */
  getAuthority(actorId: ActorId): AuthorityRef | null;
  
  /** Proposal 승인 요청 */
  requestApproval(proposal: Proposal): Promise<AuthorityDecision>;
  
  // === Scope ===
  
  /** Scope 검증 (실행 전) */
  validateScope(proposal: Proposal, scope: ApprovedScope): ScopeValidationResult;
  
  /** 결과 scope 검증 (실행 후) */
  validateResultScope(
    baseSnapshot: Snapshot,
    terminalSnapshot: Snapshot,
    scope: ApprovedScope
  ): ScopeValidationResult;
}

class DefaultPolicyService implements PolicyService {
  constructor(
    private config: ExecutionPolicyConfig,
    private router: AuthorityRouter,
    private evaluators: Map<AuthorityKind, AuthorityEvaluator>
  ) {}
  
  deriveExecutionKey(proposal: Proposal): ExecutionKey {
    // EXK-ATTEMPT-1: 항상 createExecutionKeyContext()를 통해 attempt 결정
    const ctx = createExecutionKeyContext(proposal);
    return resolveExecutionKey(ctx, this.config);
  }
  
  getAuthority(actorId: ActorId): AuthorityRef | null {
    return this.router.getAuthority(actorId);
  }
  
  async requestApproval(proposal: Proposal): Promise<AuthorityDecision> {
    const { decision } = await routeAndApprove(proposal, this.router, this.evaluators);
    return decision;
  }
  
  validateScope(proposal: Proposal, scope: ApprovedScope): ScopeValidationResult {
    return validateScope(proposal, scope);
  }
  
  validateResultScope(
    baseSnapshot: Snapshot,
    terminalSnapshot: Snapshot,
    scope: ApprovedScope
  ): ScopeValidationResult {
    return validateResultScope(baseSnapshot, terminalSnapshot, scope);
  }
}
```

### 5.2 App Integration

> **Note:** `HostExecutionResult`는 World SPEC v2.0.2에서 정의된다.
> - `outcome: 'completed' | 'failed'` — advisory (힌트)
> - `terminalSnapshot: Snapshot` — **authoritative** (권위)
>
> World는 `outcome`을 참고하되, 최종 판정은 `deriveOutcome(terminalSnapshot)`으로 한다.

```typescript
/**
 * App에서 PolicyService 사용
 */
class App {
  private policyService: PolicyService;
  private worldStore: WorldStore;
  private hostExecutor: HostExecutor;
  
  async submitProposal(proposal: Proposal): Promise<ProposalResult> {
    // 1. ExecutionKey 결정 (정책 기반)
    const executionKey = this.policyService.deriveExecutionKey(proposal);
    
    // 2. Authority 승인 요청
    const decision = await this.policyService.requestApproval(proposal);
    
    if (!decision.approved) {
      return { status: 'rejected', reason: decision.reason };
    }
    
    const scope = decision.scope!;
    
    // 3. Scope 검증 (실행 전)
    const preValidation = this.policyService.validateScope(proposal, scope);
    if (!preValidation.valid) {
      return { status: 'scope_violation', violations: preValidation.violations };
    }
    
    // 4. 실행
    const baseSnapshot = await this.worldStore.restore(proposal.baseWorld);
    const result = await this.hostExecutor.execute(
      executionKey,
      baseSnapshot,
      proposal.intent,
      { approvedScope: scope, timeoutMs: scope.timeoutMs }
    );
    
    // 5. Scope 검증 (실행 후, World-owned paths만)
    const postValidation = this.policyService.validateResultScope(
      baseSnapshot,
      result.terminalSnapshot,
      scope
    );
    
    if (!postValidation.valid) {
      // Post-execution scope 위반: World는 여전히 생성됨 (failed world로 봉인)
      // 실행을 "없던 일로" 하면 World 불변식이 깨짐
      const failedWorld = await this.createWorld(proposal, {
        ...result,
        outcome: 'failed',
        error: { code: 'SCOPE_VIOLATION_POST', violations: postValidation.violations }
      });
      
      return { 
        status: 'scope_violation_post', 
        violations: postValidation.violations,
        world: failedWorld 
      };
    }
    
    // 6. World 생성
    const world = await this.createWorld(proposal, result);
    
    return { status: 'completed', world };
  }
}
```

### 5.3 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| POLICY-SVC-1 | MUST | App MUST provide PolicyService implementation |
| POLICY-SVC-2 | MUST | PolicyService MUST be used for all ExecutionKey derivation |
| POLICY-SVC-3 | MUST | PolicyService MUST be used for all Authority routing |
| POLICY-SVC-4 | SHOULD | PolicyService SHOULD be injectable (testability) |

---

## 6. Configuration & Defaults

### 6.1 Recommended Defaults

```typescript
const defaultPolicyConfig = {
  // ExecutionKey 정책
  execution: {
    executionKeyPolicy: defaultPolicy,
    intentTypeOverrides: {},
    actorKindOverrides: {
      // Agent는 직렬화 (안전성)
      agent: actorSerialPolicy,
    },
  } satisfies ExecutionPolicyConfig,
  
  // Authority 정책
  authority: {
    defaultPolicy: { mode: 'auto_approve' } as AuthorityPolicy,
    evaluators: new Map<AuthorityKind, AuthorityEvaluator>([
      ['auto', autoApproveEvaluator],
      ['human', hitlEvaluator],
      ['policy', policyRulesEvaluator],
    ]),
  },
  
  // Scope 정책
  scope: {
    generator: defaultScopeGenerator,
    enforceResultScope: false,  // 기본은 결과 scope 검증 안 함
  },
};

// ExecutionPolicyConfig 타입과 일치하는 단독 export
const defaultExecutionPolicyConfig: ExecutionPolicyConfig = {
  executionKeyPolicy: defaultPolicy,
  intentTypeOverrides: {},
  actorKindOverrides: {
    agent: actorSerialPolicy,
  },
};
```

### 6.2 Configuration Rationale

| Config | Default | Rationale |
|--------|---------|-----------|
| ExecutionKey: defaultPolicy | 병렬 실행 | 성능 우선 |
| Agent: actorSerialPolicy | 직렬화 | AI 안전성 |
| Authority: auto_approve | 자동 승인 | 개발 편의 |
| enforceResultScope: false | 검증 안 함 | 성능 우선, 필요 시 활성화 |

---

## 7. Security Considerations

### 7.1 ExecutionKey Isolation

```typescript
/**
 * ExecutionKey는 격리 단위
 * - 같은 key를 공유하면 직렬화됨
 * - 다른 key는 병렬 실행됨
 * 
 * 보안 고려:
 * - ExecutionKey는 App 내부 값이므로 외부 노출되지 않아야 함
 * - 외부 노출 시에도 결정적이어야 함 (EXK-POLICY-2)
 * - 추측 방지가 필요하면 HMAC 기반 derivation 사용
 */

/**
 * Trust boundary를 넘는 경우: HMAC 기반 (결정적 + 비추측)
 * 
 * Canonical serialization: 언어/런타임 간 일관성 보장
 */
function deriveSecureExecutionKey(
  ctx: ExecutionKeyContext,
  secret: string
): ExecutionKey {
  // Canonical format: 언어/런타임 간 동일 결과 보장
  const canonicalInput =
    `proposalId=${ctx.proposalId}\n` +
    `actorId=${ctx.actorId}\n` +
    `baseWorld=${ctx.baseWorld}\n` +
    `attempt=${ctx.attempt}`;
  
  // HMAC: 결정적이면서 secret 없이는 추측 불가
  return `hmac:${hmacSha256(secret, canonicalInput)}`;
}
```

### 7.2 Scope Tampering Prevention

```typescript
/**
 * Scope는 Authority가 생성하고 변조되면 안 됨
 * 
 * 옵션:
 * 1. Scope에 서명 추가
 * 2. Scope를 별도 저장소에 저장하고 ID만 전달
 */
type SignedScope = {
  readonly scope: ApprovedScope;
  readonly signature: string;
  readonly authorityId: AuthorityId;
};

function verifyScope(signed: SignedScope, publicKey: string): boolean {
  // 서명 검증 로직
  return crypto.verify(signed.scope, signed.signature, publicKey);
}
```

### 7.3 Rules

| Rule ID | Level | Description |
|---------|-------|-------------|
| SEC-1 | SHOULD | If ExecutionKey may cross a trust boundary, App SHOULD derive it using a deterministic keyed hash (e.g., HMAC) to prevent guessing while preserving determinism |
| SEC-2 | MAY | ApprovedScope MAY be signed by Authority |
| SEC-3 | MUST | Scope modification after approval MUST be detectable |

---

## 8. Proposed Rules Summary

### ExecutionKey Policy

| Rule ID | Level | Description |
|---------|-------|-------------|
| EXK-POLICY-1 | MUST | App MUST provide ExecutionKeyPolicy implementation |
| EXK-POLICY-2 | MUST | ExecutionKey MUST be deterministic for same context |
| EXK-POLICY-3 | MUST | ExecutionKey MUST be fixed before execution starts |
| EXK-POLICY-4 | SHOULD | App SHOULD support policy configuration |
| EXK-POLICY-5 | MAY | App MAY support intent/actor-specific overrides |
| EXK-ATTEMPT-1 | MUST | App MUST define single authoritative source of attempt (default: proposal.meta.executionAttempt ?? 1) |
| EXK-TICK-1 | MUST | A tick is one Proposal execution cycle (startExecution → terminalSnapshot) |
| EXK-TICK-2 | MUST | state:publish MUST occur at most once per proposal-tick |
| EXK-TICK-3 | MUST NOT | Multiple proposals on same ExecutionKey MUST NOT merge into single tick |

### ApprovedScope

| Rule ID | Level | Description |
|---------|-------|-------------|
| SCOPE-1 | MUST | ApprovedScope MUST be generated at Authority decision |
| SCOPE-2 | MUST | App MUST validate scope before execution |
| SCOPE-3 | MUST | Scope violation MUST prevent execution |
| SCOPE-4 | SHOULD | App SHOULD validate result scope after execution |
| SCOPE-5 | MAY | Scope MAY include custom constraints |
| SCOPE-PATH-1 | MUST | allowedPaths applies only to World-owned paths (data excluding $host) |
| SCOPE-POST-1 | MUST | Post-validation failure MUST result in failed world (not rollback) |

### Authority Routing

| Rule ID | Level | Description |
|---------|-------|-------------|
| ROUTE-1 | MUST | Every Actor MUST have exactly one Authority binding |
| ROUTE-2 | MUST | Proposal MUST be routed to Actor's bound Authority |
| ROUTE-3 | MUST | Authority MUST produce ApprovedScope on approval |
| ROUTE-4 | SHOULD | App SHOULD support pluggable AuthorityEvaluator |

### Policy Service

| Rule ID | Level | Description |
|---------|-------|-------------|
| POLICY-SVC-1 | MUST | App MUST provide PolicyService implementation |
| POLICY-SVC-2 | MUST | PolicyService MUST be used for ExecutionKey derivation |
| POLICY-SVC-3 | MUST | PolicyService MUST be used for Authority routing |
| POLICY-SVC-4 | SHOULD | PolicyService SHOULD be injectable |

### Security

| Rule ID | Level | Description |
|---------|-------|-------------|
| SEC-1 | SHOULD | If ExecutionKey crosses trust boundary, use deterministic keyed hash (HMAC) |
| SEC-2 | MAY | ApprovedScope MAY be signed |
| SEC-3 | MUST | Scope modification MUST be detectable |

---

## 9. References

- **World SPEC v2.0.2**: ExecutionKey contract (§7.2), Actor/Authority (§5.6-5.7)
- **Host SPEC v2.0.2**: ExecutionKey opaque treatment
- **ADR-001**: App owns ExecutionKey policy, approvedScope enforcement
- **FDR-APP-INTEGRATION-001**: HostExecutor implementation, execution flow
- **FDR-APP-PUB-001 v0.3.0**: Tick definition (Host Tick vs Proposal Tick), publish boundary — EXK-TICK-1~3 정합

---

## 10. Appendix: Type Definitions

```typescript
// ─────────────────────────────────────────────────────────
// ExecutionKey Policy
// ─────────────────────────────────────────────────────────
type ExecutionKey = string;

type ExecutionKeyContext = {
  readonly proposalId: ProposalId;
  readonly actorId: ActorId;
  readonly baseWorld: WorldId;
  readonly attempt: number;
  readonly intentType?: string;
  readonly meta?: Record<string, unknown>;
};

type ExecutionKeyPolicy = (ctx: ExecutionKeyContext) => ExecutionKey;

type ExecutionPolicyConfig = {
  executionKeyPolicy: ExecutionKeyPolicy;
  intentTypeOverrides?: Record<string, ExecutionKeyPolicy>;
  actorKindOverrides?: Record<ActorKind, ExecutionKeyPolicy>;
};

// ─────────────────────────────────────────────────────────
// ApprovedScope
// ─────────────────────────────────────────────────────────
type ApprovedScope = {
  readonly scopeId: string;
  readonly allowedActors?: readonly ActorId[];
  readonly allowedIntentTypes?: readonly string[];
  readonly allowedPaths?: readonly string[];
  readonly timeoutMs?: number;
  readonly constraints?: Record<string, unknown>;
};

type ScopeViolation = {
  readonly type: 'actor' | 'intent_type' | 'path' | 'timeout' | 'constraint';
  readonly expected: unknown;
  readonly actual: unknown;
  readonly message: string;
};

type ScopeValidationResult =
  | { valid: true }
  | { valid: false; violations: ScopeViolation[] };

// ─────────────────────────────────────────────────────────
// Authority
// ─────────────────────────────────────────────────────────
type AuthorityKind = 'auto' | 'human' | 'policy' | 'tribunal';

type AuthorityRef = {
  readonly authorityId: AuthorityId;
  readonly kind: AuthorityKind;
  readonly name?: string;
};

type AuthorityPolicy =
  | { readonly mode: 'auto_approve' }
  | { readonly mode: 'hitl'; readonly delegate: ActorRef }
  | { readonly mode: 'policy_rules'; readonly rules: unknown }
  | { readonly mode: 'tribunal'; readonly members: ActorRef[] };

type AuthorityDecision = {
  readonly approved: boolean;
  readonly reason?: string;
  readonly scope?: ApprovedScope;
};

// ─────────────────────────────────────────────────────────
// Authority Router
// ─────────────────────────────────────────────────────────
interface AuthorityRouter {
  getAuthority(actorId: ActorId): AuthorityRef | null;
  getBinding(actorId: ActorId): ActorAuthorityBinding | null;
  registerBinding(binding: ActorAuthorityBinding): void;
  unregisterBinding(actorId: ActorId): void;
}

type ActorAuthorityBinding = {
  readonly actorId: ActorId;
  readonly authorityId: AuthorityId;
  readonly policy: AuthorityPolicy;
};

// ─────────────────────────────────────────────────────────
// Policy Service
// ─────────────────────────────────────────────────────────
interface PolicyService {
  deriveExecutionKey(proposal: Proposal): ExecutionKey;
  getAuthority(actorId: ActorId): AuthorityRef | null;
  requestApproval(proposal: Proposal): Promise<AuthorityDecision>;
  validateScope(proposal: Proposal, scope: ApprovedScope): ScopeValidationResult;
  validateResultScope(
    baseSnapshot: Snapshot,
    terminalSnapshot: Snapshot,
    scope: ApprovedScope
  ): ScopeValidationResult;
}
```

---

*End of FDR-APP-POLICY-001*
