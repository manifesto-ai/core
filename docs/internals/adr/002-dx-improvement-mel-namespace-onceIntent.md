# ADR-002: DX 개선 — `$mel` 네임스페이스 자동 주입 + `onceIntent` 문법 추가

> **Note on Language**
>
> This document is written in Korean, the author's native language.
> Machine translation is encouraged—and arguably appropriate,
> given that this ADR concerns a framework for making Intent
> machine-interpretable regardless of its linguistic surface.

- **Date:** 2026-01-27
- **Status:** Proposed
- **Owners:** 정성우
- **Related:**
  - Host SPEC v2.0.2: `data.$host` 스키마 허용, Host는 `system.*`에 write 금지
  - World SPEC v2.0.2: `$host` namespace convention, WORLD-HASH-4a
  - MEL SPEC v0.3.3: `once()` guard pattern, FDR-MEL-044
  - Core SPEC: `merge`는 shallow merge로 정의됨

---

## 1. Context

### 1.1 문제 배경: Host-owned Namespace (Host v2.0.2)

Host v2.0.2부터 Host-owned state(에러 bookkeeping, intent 슬롯 등)는 `data.$host` 아래로 이동했고, Host는 `system.*`에 patch/write하면 안 된다.

이에 따라 Host를 사용하는 도메인은 스키마에서 `$host` 네임스페이스를 허용해야 하며, 허용하지 않으면 Host patch가 `PATH_NOT_FOUND` 류의 검증 에러를 유발한다.

**현재 DX 문제점:**

| 문제 | 영향 |
|------|------|
| 매 프로젝트마다 `$host`를 수동으로 스키마에 추가해야 함 | 보일러플레이트 증가, 실수 가능성 |
| `$host`는 대부분의 개발자에게 "내 도메인과 무관한 내부 슬롯" | 멘탈모델 오염 |
| 복구/퍼시스턴스 시점에 `$host` 유무 검증 필요 | 추가 마이그레이션 코드 |

### 1.2 문제 배경: `once()` Guard Pattern

Manifesto의 compute loop는 "patch가 더 이상 생성되지 않을 때까지" 동일 intent에 대해 반복 평가된다. 따라서 액션이 무조건 patch를 생성하면 무한 루프가 발생하며, 이를 막기 위해 guard가 필요하다.

현재 패턴 (MEL SPEC v0.3.3):

```mel
action increment() {
  once(incrementGuard) {
    patch incrementGuard = $meta.intentId  // 반드시 첫 번째 statement
    patch count = add(count, 1)
  }
}
```

**현재 DX 문제점:**

| 문제 | 영향 |
|------|------|
| "왜 intentId를 수동으로 저장해야 하지?" | 초심자 멘탈모델 장벽 |
| 첫 statement 강제 규칙(FDR-MEL-044) 위반 시 컴파일 에러 | 학습 곡선 증가 |
| 가드 필드가 도메인 스키마에 노출됨 | 스키마 오염 |

### 1.3 설계 제약조건

기존 의미론을 변경해서는 안 된다:

- 기존 `once(guard)` 문법은 조건부 guard, 다중 키 패턴 등 고급 사용에 필수
- 기존 코드의 실행 결과가 바뀌면 안 됨
- `$host` 소유권 원칙(HOST-DATA-1~6)을 위반해서는 안 됨

---

## 2. Decision

### 2.1 핵심 결정 요약

| 결정 | 내용 |
|------|------|
| **새 네임스페이스 `$mel`** | Compiler/MEL runtime 전용 예약 영역 도입 |
| **스키마 자동 보정** | App 레이어에서 `$host`, `$mel` 자동 주입 |
| **`onceIntent` 문법** | Per-intent 가드의 고수준 sugar 추가 (contextual keyword) |
| **`onceExecution` 연기** | v2.1에서 실사용 패턴 관찰 후 도입 검토 |
| **기존 `once()` 유지** | 고급 패턴을 위한 저수준 프리미티브로 유지 |

### 2.2 `$mel` 네임스페이스 도입

**결정:** Host 소유의 `$host`와 분리된 Compiler 전용 네임스페이스 `$mel`을 도입한다.

```typescript
type SnapshotData = {
  readonly $host?: HostNamespace;  // Host-owned (기존 유지)
  readonly $mel?: MelNamespace;    // Compiler-owned (신규)
  // ... domain state
};

type MelNamespace = {
  readonly guards?: {
    readonly intent?: Record<GuardId, IntentId>;
    // Future: execution guards when onceExecution is introduced
  };
};
```

**Rationale:**

| 대안 | 기각 사유 |
|------|-----------|
| `$host.__compiler.*` | Host 소유권 원칙(HOST-DATA-1) 위반, 역할 혼재 |
| `$runtime` | 범위가 모호, Host/Compiler 모두 해당될 수 있음 |
| `$mel` | MEL compiler 전용임이 명확, 기존 스펙 변경 최소화 |

**World Hash 규칙 확장:**

```typescript
// WORLD-HASH-4a 확장: $host와 $mel 모두 제외
function stripPlatformNamespaces<T extends Record<string, unknown>>(
  data: T
): Omit<T, '$host' | '$mel'> {
  const { $host, $mel, ...rest } = data;
  return rest as Omit<T, '$host' | '$mel'>;
}
```

### 2.3 스키마 자동 보정 (App 레이어)

**결정:** `@manifesto/app`에서 스키마를 자동으로 보정한다.

```typescript
// App 내부 구현
function withPlatformNamespaces(schema: Schema): Schema {
  const fields = { ...schema.state.fields };

  // $host 자동 주입 (Host용)
  if (!fields.$host) {
    fields.$host = { type: 'object', required: false, default: {} };
  }

  // $mel 자동 주입 (Compiler용) - 구조적 default 포함
  if (!fields.$mel) {
    fields.$mel = {
      type: 'object',
      required: false,
      default: { guards: { intent: {} } }  // 깊은 경로 패치 안전성 보장
    };
  }

  return { ...schema, state: { ...schema.state, fields } };
}

// createApp에서 자동 적용
export function createApp(config: AppConfig): App {
  const schema = withPlatformNamespaces(config.schema);
  // ...
}
```

**검증 규칙:**

| 조건 | 처리 |
|------|------|
| `$host`/`$mel`이 없음 | 자동 추가 |
| `$host`/`$mel`이 있으나 `type !== 'object'` | 명확한 에러 + docs 링크 |
| `$host`/`$mel`이 `object`이고 `default` 없음 | 경고 + 적절한 default 보정 |

**Restore/Rehydrate 정규화:**

```typescript
function normalizeSnapshot(snapshot: Snapshot): Snapshot {
  const data = { ...snapshot.data };

  // $host 정규화
  data.$host = data.$host ?? {};

  // $mel 정규화 - 부분적으로 존재하는 경우도 골격 보정
  if (!data.$mel || typeof data.$mel !== 'object') {
    data.$mel = { guards: { intent: {} } };
  } else {
    // $mel이 있지만 내부 구조가 불완전한 경우
    const mel = data.$mel as Record<string, unknown>;
    if (!mel.guards || typeof mel.guards !== 'object') {
      mel.guards = { intent: {} };
    } else {
      const guards = mel.guards as Record<string, unknown>;
      if (!guards.intent || typeof guards.intent !== 'object') {
        guards.intent = {};
      }
    }
    data.$mel = mel as MelNamespace;
  }

  return { ...snapshot, data };
}
```

### 2.4 기존 `once(guard)` 유지

**결정:** 기존 `once(guard)` 문법의 동작/의미론/권한은 변경하지 않는다.

```mel
// 여전히 유효한 패턴들

// 조건부 가드
once(step1) when isReady {
  patch step1 = $meta.intentId
  effect api.fetch(...)
}

// 커스텀 가드 키
once(perUserAction) {
  patch perUserAction = concat($meta.intentId, "-", userId)
  patch userActions = append(userActions, action)
}

// 다중 단계 워크플로우
once(phase1) { ... }
once(phase2) when isNotNull(phase1Result) { ... }
once(phase3) when isNotNull(phase2Result) { ... }
```

### 2.5 `onceIntent` 문법 추가

**결정:** "동일 intentId에 대해 1회만 실행"을 의미하는 고수준 문법을 추가한다.

```ebnf
OnceIntentStmt = "onceIntent" [ "when" Expression ] "{" { InnerStmt } "}"
```

**사용 예:**

```mel
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}

// 조건부 실행도 가능
action submit() {
  onceIntent when isValid(form) {
    effect api.submit({ data: form, into: result })
  }
}
```

**컴파일러 확장 (Desugaring):**

```mel
// Source
onceIntent {
  patch count = add(count, 1)
}

// Desugared (개념적)
// 핵심: once() 인자와 patch 경로가 반드시 일치해야 함 (FDR-MEL-044 준수)
once($mel.guards.intent.a3f7c2e1) {
  patch $mel.guards.intent.a3f7c2e1 = $meta.intentId
  patch count = add(count, 1)
}
```

**Critical:** `once(X)`의 X는 "가드 값을 읽는 경로"이고, 첫 statement는 **동일한 경로**에 intentId를 기록해야 가드가 닫힌다. desugar 시 이 일치를 반드시 보장해야 한다.

### 2.6 `onceIntent`는 Contextual Keyword (Critical)

**문제:** `onceIntent`라는 단어는 기존 코드에서 가드 변수 이름으로 사용될 수 있다:

```mel
// 기존에 유효했던 코드
once(onceIntent) {
  patch onceIntent = $meta.intentId
  ...
}
```

새 문법에서 `onceIntent`를 완전 예약 키워드로 만들면 이 코드가 깨지고, SemVer minor 주장이 약해진다.

**결정:** `onceIntent`는 **contextual keyword**로 처리한다.

**파싱 규칙:**

| 조건 | 해석 |
|------|------|
| 문장 시작 위치 + 다음 토큰이 `{` 또는 `when` | `onceIntent` 문법 |
| 그 외 (예: `once(onceIntent)`, `patch onceIntent = ...`) | **식별자**로 유지 |

```mel
// ✅ onceIntent 문법으로 파싱
onceIntent { ... }
onceIntent when condition { ... }

// ✅ 식별자로 파싱 (기존 코드 호환)
once(onceIntent) { patch onceIntent = $meta.intentId }
patch onceIntent = $meta.intentId
when eq(onceIntent, null) { ... }
```

**Rationale:**

| 접근법 | 장점 | 단점 |
|--------|------|------|
| 완전 예약 키워드 | 파서 단순 | 기존 코드 깨짐, minor 아님 |
| Contextual keyword | 기존 코드 호환, minor 유지 | 파서 약간 복잡 |

**결론:** Contextual keyword 채택. 기존 코드 호환성이 minor 릴리즈의 핵심 조건.

### 2.7 `$mel` 패치 안전성 (Critical)

**문제 1:** `$mel`을 `{}`로만 초기화하면, 컴파일러가 `$mel.guards.intent.<id>` 같은 깊은 경로에 set 패치를 생성할 때 중간 객체가 없어서 `PATH_NOT_FOUND` 에러가 발생한다.

**문제 2:** Core의 `merge`는 **shallow merge**로 정의되어 있다. 따라서 `$mel` 루트에 merge하면 다음과 같은 문제가 발생한다:

```typescript
// ❌ 위험: shallow merge로 인한 guard 손실
// onceIntent #1
{ op: "merge", path: "$mel", value: { guards: { intent: { a: "i1" } } } }
// 결과: $mel = { guards: { intent: { a: "i1" } } }

// onceIntent #2 (같은 action 내)
{ op: "merge", path: "$mel", value: { guards: { intent: { b: "i1" } } } }
// 결과: $mel = { guards: { intent: { b: "i1" } } }  ← a가 날아감!
```

`a` guard가 사라지면 다음 compute cycle에서 #1 블록이 "guard가 안 찍힌 것처럼" 다시 실행되어 **무한 루프** 가능성이 생긴다.

**결정:** 두 가지 방어 레이어를 적용한다.

**Layer 1: 구조적 Default (App)**

```typescript
// $mel default를 깊은 구조로 초기화
fields.$mel = {
  type: 'object',
  required: false,
  default: { guards: { intent: {} } },  // 중간 경로 미리 생성
};
```

**Layer 2: Map 레벨 Merge (Compiler) — MUST**

shallow merge의 특성을 활용하여 **정확히 map 레벨**에서 merge한다:

```typescript
// ❌ 금지: 루트 $mel merge (shallow라서 guards가 덮어씌워짐)
{ op: "merge", path: "$mel", value: { guards: { intent: { [guardId]: intentId } } } }

// ✅ 정답: $mel.guards.intent 레벨 merge
{ op: "merge", path: "$mel.guards.intent", value: { [guardId]: intentId } }
```

이렇게 하면:
- merge가 shallow여도 "intent 맵"의 최상위 키들만 합쳐짐
- `{a: "i1"}` 넣고 다음에 `{b: "i1"}` 넣어도 `a`가 유지됨
- 패치 경로가 고정(`$mel.guards.intent`)이라 스키마/검증 관점에서도 안전

**규칙 (COMPILER-MEL-1):** 컴파일러가 생성하는 `$mel.guards.intent` 관련 패치는 **반드시 `$mel.guards.intent` 경로에 대한 merge**를 사용해야 한다. 루트 `$mel` merge는 금지.

```typescript
// COMPILER-MEL-1: $mel.guards.intent 레벨 merge
function createGuardPatch(guardId: string, intentId: string): Patch {
  return {
    op: "merge",
    path: "$mel.guards.intent",
    value: { [guardId]: intentId }
  };
}
```

### 2.8 GuardId 생성 정책

**결정:** Content-addressable 방식으로 guardId를 생성한다.

```typescript
function generateGuardId(
  actionName: string,
  blockIndex: number,
  guardType: 'intent' | 'execution'
): GuardId {
  const input = `${actionName}:${blockIndex}:${guardType}`;
  return hash(input).slice(0, 8);  // 예: "a3f7c2e1"
}
```

**blockIndex 결정 규칙:**

```mel
action example() {
  onceIntent { ... }      // blockIndex = 0
  when condition {
    onceIntent { ... }    // blockIndex = 1
  }
  onceIntent { ... }      // blockIndex = 2
}
```

- AST 순회 순서(pre-order)로 0부터 증가
- `once()` 블록과 `onceIntent` 블록은 별도 카운터 사용

**안정성 특성 (명확화):**

| 시나리오 | guardId 변경 여부 | 영향 |
|----------|------------------|------|
| 같은 코드 재컴파일 | ❌ 변경 없음 | 정상 |
| action 이름 변경 | ✅ 변경됨 | 새 guard로 인식 (의도된 동작) |
| **블록 순서 변경 (리오더)** | ✅ 변경됨 | 아래 참고 |
| **새 블록 중간 삽입** | ✅ 이후 블록 변경됨 | 아래 참고 |
| 파서 업그레이드 | ❌ 변경 없음 | content-based |

**리오더/삽입 시 guardId 변경에 대하여:**

`blockIndex` 기반이므로 블록 순서 변경이나 중간 삽입 시 guardId가 변경된다. 이는 **허용된 동작**이다:

- `onceIntent`는 per-intent 가드이므로, 새 intent에서는 어차피 새로 실행됨
- 기존 intent의 snapshot에 있는 이전 guardId는 그대로 유지되어 가드 역할 수행
- 새 guardId로 인해 "한 번 더 실행"되는 것은 리팩토링의 자연스러운 결과

**만약 절대적 안정성이 필요하다면:**
```mel
// 추후 고려: 명시적 라벨 옵션
onceIntent("submit-guard") { ... }  // guardId = hash("submit-guard")
```

이는 v2.1 이후 실수요 확인 시 도입 검토.

### 2.9 `onceExecution` 연기 (v2.1)

**결정:** `onceExecution`은 본 ADR에서 제외하고 v2.1에서 재검토한다.

**Rationale:**

| 관찰 | 판단 |
|------|------|
| 기본 dispatch에서 `executionKey = intentId` | 대부분의 사용자에게 `onceExecution`과 `onceIntent`가 동일 |
| low-level mailbox API 사용자만 차이 경험 | 극소수 |
| YAGNI 원칙 | 실제 수요 확인 후 도입이 합리적 |

**v2.1 도입 조건:**
- low-level API 사용자로부터 명시적 요청
- `executionKey !== intentId`인 시나리오의 실제 사용 패턴 확인

### 2.10 문법 선택 가이드라인

| 시나리오 | 권장 문법 | 이유 |
|----------|-----------|------|
| 단순 per-intent 가드 | `onceIntent { }` | 최소 보일러플레이트 |
| 조건부 per-intent 가드 | `onceIntent when cond { }` | 조건 + 간편함 |
| 커스텀 가드 키 필요 | `once(marker) { }` | 키 제어 필요 |
| 다중 키 조합 | `once(marker) { }` | `concat()` 등 사용 |
| 워크플로우 단계 추적 | `once(step1)`, `once(step2)` | 명시적 단계 표현 |
| 가드 값 읽기 필요 | `once(marker) { }` | 도메인 필드에 저장 |

**예시 - 언제 무엇을 쓰는가:**

```mel
// ✅ onceIntent: 단순 per-intent 가드
action like() {
  onceIntent {
    patch likes = add(likes, 1)
  }
}

// ✅ onceIntent when: 조건부 per-intent 가드
action submit() {
  onceIntent when isValid(form) {
    effect api.submit({ data: form, into: result })
  }
}

// ✅ once(): 다단계 워크플로우 (단계 추적 필요)
action processOrder() {
  once(validated) when isNotNull(order) {
    patch validated = $meta.intentId
    effect validate({ order: order, into: validationResult })
  }

  once(submitted) when eq(validationResult.status, "ok") {
    patch submitted = $meta.intentId
    effect api.submit({ order: order, into: submitResult })
  }
}

// ✅ once(): 커스텀 가드 키 (per-user-per-intent)
action trackView(userId: string) {
  once(viewedBy) {
    patch viewedBy = concat($meta.intentId, ":", userId)
    patch viewCount = add(viewCount, 1)
  }
}

// ✅ 기존 코드 호환: onceIntent를 식별자로 사용
action legacyPattern() {
  once(onceIntent) {
    patch onceIntent = $meta.intentId  // 여전히 동작
    patch count = add(count, 1)
  }
}
```

### 2.11 퍼시스턴스 정책

**결정:** 기본 저장, opt-in 제거

```typescript
interface PersistOptions {
  /**
   * true이면 $host, $mel 등 플랫폼 내부 상태를 제거하고 저장
   * @default false
   */
  stripPlatformState?: boolean;
}

async function persist(
  snapshot: Snapshot,
  options?: PersistOptions
): Promise<void> {
  const data = options?.stripPlatformState
    ? stripPlatformNamespaces(snapshot.data)
    : snapshot.data;
  const toSave = { ...snapshot, data };
  // ...
}
```

**Rationale:**

| 정책 | 장점 | 단점 |
|------|------|------|
| 기본 저장 | replay/debug 시 완전한 상태, 결정론 보장 | 스토리지 약간 증가 |
| 기본 제거 | 스토리지 절약 | replay 시 guard 재실행, 디버깅 어려움 |

**결론:** Manifesto의 "Snapshot is the complete truth" 원칙에 따라 기본 저장이 합리적.

### 2.12 예약 네임스페이스 정책

| 네임스페이스 | 소유자 | 용도 | Hash 포함 |
|--------------|--------|------|-----------|
| `$host` | Host | 에러 bookkeeping, intent slots | ❌ 제외 |
| `$mel` | Compiler | guard state, future compiler internals | ❌ 제외 |
| `$` prefix 전체 | Platform | 향후 확장 예약 | ❌ 제외 |

**도메인 스키마 제약:**
```
HOST-DATA-6 (확장): 도메인 스키마는 `$`로 시작하는 필드명을 사용할 수 없다.
```

---

## 3. Consequences

### 3.1 장점 (Pros)

| 장점 | 설명 |
|------|------|
| **DX 마찰 감소** | `$host`/`$mel` 수동 추가 불필요 |
| **스키마 오염 방지** | 가드 필드가 도메인 스키마에 노출되지 않음 |
| **학습 곡선 완화** | `onceIntent`로 무한 루프 방지 멘탈모델 쉽게 이해 |
| **기존 코드 호환** | `once()` 의미론 변경 없음, `onceIntent` 식별자 사용 가능 |
| **소유권 명확** | `$host`는 Host, `$mel`은 Compiler로 역할 분리 |
| **SemVer 호환** | contextual keyword로 기존 코드 깨지지 않음, minor 릴리즈 가능 |

### 3.2 단점/리스크 (Cons & Risks)

| 단점 | 완화 방안 |
|------|-----------|
| Snapshot에 플랫폼 내부 상태 누적 | `stripPlatformState` 옵션 제공 |
| 새 네임스페이스 `$mel` 도입으로 인한 학습 | 대부분의 개발자는 인지할 필요 없음 (자동) |
| 기존 프로젝트에서 `$mel` 충돌 가능성 | `$` prefix는 이미 예약됨 (SPEC), 충돌 시 명확한 에러 |
| World SPEC 수정 필요 | WORLD-HASH-4a에 `$mel` 추가만으로 최소 변경 |
| Contextual keyword 파서 복잡도 | 규칙이 단순 (문장 시작 + `{`/`when`) |

### 3.3 비용 분석

| 항목 | 예상 비용 |
|------|-----------|
| App 레이어 수정 | 낮음 (유틸 함수 추가) |
| Compiler 수정 | 중간 (파서 + 코드젠 확장, contextual keyword) |
| World SPEC 수정 | 낮음 (hash 제외 규칙 확장) |
| 문서 업데이트 | 중간 (Learn, Advanced 가이드) |
| 테스트 작성 | 중간 (새 문법 + 회귀 테스트) |

---

## 4. Alternatives Considered

### 4.1 기존 `once()`에 guard patch 자동 주입

```mel
// 제안: once() 내부에서 자동으로 guard patch 생성
once(marker) {
  // 컴파일러가 자동 삽입: patch marker = $meta.intentId
  patch count = add(count, 1)
}
```

**기각 사유:**
- 조건부 guard 패턴 (`patch marker = concat(...)`) 깨짐
- 기존 코드의 의미론 변경 위험
- "암시적 동작"은 디버깅을 어렵게 함

### 4.2 `$host.__compiler.*` 사용

**기각 사유:**
- HOST-DATA-1 원칙 위반 ("Host MUST store its internal state under `data.$host`")
- Host와 Compiler의 역할 혼재
- 향후 Host가 `__compiler` prefix 사용 시 충돌

### 4.3 스키마에서 `$host` 요구 제거

```typescript
// 제안: Host가 스키마 검증 없이 $host에 쓰도록 허용
```

**기각 사유:**
- Core의 스키마 검증/결정론 철학 위반
- Snapshot 소유권 불명확
- 재현성/디버깅 약화

### 4.4 새 예약 네임스페이스 `$runtime` 도입

**기각 사유:**
- "runtime"이 Host/Compiler 모두를 포함할 수 있어 모호
- `$mel`이 MEL compiler 전용임을 명확히 표현

### 4.5 `onceExecution` 동시 도입

**연기 사유:**
- 대부분의 사용 케이스에서 `intentId = executionKey`
- YAGNI 원칙 적용
- v2.1에서 실제 수요 확인 후 도입

### 4.6 `$mel` 루트 merge 사용

**기각 사유:**
- Core의 `merge`는 shallow merge
- 같은 action 내 `onceIntent` 블록이 2개 이상이면 이전 guard가 덮어씌워짐
- 무한 루프 가능성

### 4.7 `onceIntent`를 완전 예약 키워드로

**기각 사유:**
- 기존에 `once(onceIntent)`처럼 식별자로 사용한 코드가 깨짐
- SemVer minor 주장이 약해짐
- Contextual keyword로 충분히 해결 가능

---

## 5. Rollout Plan

### 5.1 구현 순서

```
Phase 1: Foundation (Week 1)
├── World SPEC v2.0.3: WORLD-HASH-4a에 $mel 추가
├── App: withPlatformNamespaces() 유틸 구현 (구조적 default 포함)
├── App: createApp() 자동 적용
└── App: normalizeSnapshot() 구현 (부분 $mel 보정 포함)

Phase 2: Compiler (Week 2)
├── Compiler: onceIntent 파서 확장 (contextual keyword)
├── Compiler: guardId 생성 로직 구현
├── Compiler: desugaring 코드젠 (경로 일치 + map 레벨 merge)
├── Compiler: COMPILER-MEL-1 규칙 적용 ($mel.guards.intent 레벨 merge)
└── Compiler: 기존 once() 회귀 테스트 + onceIntent 식별자 호환 테스트

Phase 3: Documentation (Week 3)
├── Learn: 기본 예제를 onceIntent 중심으로 갱신
├── Advanced: once() 고급 패턴 별도 문서화
├── Migration: 기존 코드 전환 가이드
└── API Reference: 새 문법 추가
```

### 5.2 버전 정책

| 패키지 | 변경 유형 | 버전 범프 |
|--------|-----------|-----------|
| `@manifesto/world` | WORLD-HASH-4a 확장 | patch (v2.0.3) |
| `@manifesto/app` | 기능 추가 | minor |
| `@manifesto/compiler` | 문법 추가 (contextual keyword) | minor |
| `@manifesto/host` | 변경 없음 | - |

### 5.3 배포 순서 주의사항

**WORLD-HASH 변경에 따른 배포 동기화:**

`$mel`을 스냅샷에 넣는 순간, 해시 계산 로직이 `$mel`을 제외하도록 업데이트되어 있어야 한다.

| 환경 | 주의사항 |
|------|----------|
| 단일 모노레포/런타임 | 문제 없음 (atomic 배포) |
| 분산 시스템 (서버/클라/워크플로 엔진) | World hash 계산 로직을 **먼저** 배포 |

**안전한 배포 순서:**
1. `@manifesto/world` (hash 계산 로직) 배포
2. `@manifesto/app`, `@manifesto/compiler` 배포
3. 새 스키마를 사용하는 도메인 코드 배포

### 5.4 기존 코드 마이그레이션

**Before (현재):**
```mel
action increment() {
  once(incrementGuard) {
    patch incrementGuard = $meta.intentId
    patch count = add(count, 1)
  }
}
```

**After (권장):**
```mel
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}
```

**마이그레이션 도구 계획:**
```bash
# Codemod (Phase 3에서 제공)
npx @manifesto/codemod once-to-onceIntent

# 동작:
# - 단순 패턴 (guard = $meta.intentId만 있는 경우) 자동 변환
# - 복잡한 패턴 (조건부 키, 다중 키) 수동 리뷰 플래그
# - dry-run 모드 지원
```

**호환성:**
- 기존 `once()` 코드는 변경 없이 계속 동작
- `onceIntent`를 식별자로 사용한 기존 코드도 계속 동작 (contextual keyword)
- 마이그레이션은 선택적 (권장이지 강제 아님)
- 같은 action 내에서 `once()`와 `onceIntent` 혼용 가능

---

## 6. Test Plan

### 6.1 App 테스트

```typescript
describe('withPlatformNamespaces', () => {
  it('adds $host and $mel when missing', () => {
    const schema = { state: { fields: { count: { type: 'number' } } } };
    const result = withPlatformNamespaces(schema);
    expect(result.state.fields.$host).toEqual({
      type: 'object', required: false, default: {}
    });
    expect(result.state.fields.$mel).toEqual({
      type: 'object', required: false, default: { guards: { intent: {} } }
    });
  });

  it('throws when $host exists but is not object type', () => {
    const schema = { state: { fields: { $host: { type: 'string' } } } };
    expect(() => withPlatformNamespaces(schema)).toThrow(/\$host must be object type/);
  });

  it('preserves existing valid $host', () => {
    const schema = { state: { fields: { $host: { type: 'object', default: { custom: true } } } } };
    const result = withPlatformNamespaces(schema);
    expect(result.state.fields.$host.default).toEqual({ custom: true });
  });
});

describe('normalizeSnapshot', () => {
  it('adds missing $host and $mel on restore', () => {
    const snapshot = { data: { count: 1 }, system: { status: 'idle' } };
    const result = normalizeSnapshot(snapshot);
    expect(result.data.$host).toEqual({});
    expect(result.data.$mel).toEqual({ guards: { intent: {} } });
  });

  it('fixes partially existing $mel', () => {
    // $mel이 있지만 내부 구조가 불완전한 경우
    const snapshot = { data: { count: 1, $mel: {} }, system: { status: 'idle' } };
    const result = normalizeSnapshot(snapshot);
    expect(result.data.$mel).toEqual({ guards: { intent: {} } });
  });

  it('fixes partially existing $mel.guards', () => {
    const snapshot = { data: { count: 1, $mel: { guards: {} } }, system: { status: 'idle' } };
    const result = normalizeSnapshot(snapshot);
    expect(result.data.$mel).toEqual({ guards: { intent: {} } });
  });

  it('preserves existing valid $mel structure', () => {
    const snapshot = {
      data: {
        count: 1,
        $mel: { guards: { intent: { abc: 'i1' } } }
      },
      system: { status: 'idle' }
    };
    const result = normalizeSnapshot(snapshot);
    expect(result.data.$mel.guards.intent.abc).toBe('i1');
  });
});
```

### 6.2 Compiler 테스트

```typescript
describe('onceIntent parsing', () => {
  it('parses onceIntent as statement keyword', () => {
    const source = `
      action test() {
        onceIntent { patch count = add(count, 1) }
      }
    `;
    const ast = parse(source);
    expect(ast.actions[0].body[0].kind).toBe('onceIntent');
  });

  it('parses onceIntent with when clause', () => {
    const source = `
      action test() {
        onceIntent when isValid { patch count = add(count, 1) }
      }
    `;
    const ast = parse(source);
    expect(ast.actions[0].body[0].condition).toBeDefined();
  });

  it('parses onceIntent as identifier in once() (contextual keyword)', () => {
    const source = `
      action test() {
        once(onceIntent) {
          patch onceIntent = $meta.intentId
          patch count = add(count, 1)
        }
      }
    `;
    const ast = parse(source);
    expect(ast.actions[0].body[0].kind).toBe('once');
    expect(ast.actions[0].body[0].guardPath).toBe('onceIntent');
  });

  it('parses onceIntent as identifier in patch (contextual keyword)', () => {
    const source = `
      action test() {
        when true {
          patch onceIntent = "value"
        }
      }
    `;
    const ast = parse(source);
    const patchStmt = ast.actions[0].body[0].statements[0];
    expect(patchStmt.path).toBe('onceIntent');
  });
});

describe('onceIntent codegen', () => {
  it('generates guard patch with matching path (Critical)', () => {
    const source = `
      action test() {
        onceIntent { patch count = add(count, 1) }
      }
    `;
    const ir = compile(source);

    // once() 인자 경로와 patch 경로가 일치해야 함
    const onceBlock = ir.actions[0].body[0];
    const guardPath = onceBlock.guardPath;  // e.g., "$mel.guards.intent.a3f7c2e1"
    const firstPatch = onceBlock.statements[0];

    expect(firstPatch.path).toBe(guardPath);  // Critical: 경로 일치
    expect(firstPatch.value).toBe('$meta.intentId');
  });

  it('uses map-level merge for guard patches (COMPILER-MEL-1)', () => {
    const source = `
      action test() {
        onceIntent { patch count = add(count, 1) }
      }
    `;
    const patches = compileToPatches(source);

    const melPatch = patches.find(p => p.path.startsWith('$mel'));
    expect(melPatch.op).toBe('merge');
    expect(melPatch.path).toBe('$mel.guards.intent');  // NOT "$mel"
  });

  it('multiple onceIntent blocks do not overwrite each other', () => {
    const source = `
      action test() {
        onceIntent { patch a = 1 }
        onceIntent { patch b = 2 }
      }
    `;
    const patches = compileToPatches(source);

    // 두 패치 모두 $mel.guards.intent 레벨 merge
    const melPatches = patches.filter(p => p.path === '$mel.guards.intent');
    expect(melPatches.length).toBe(2);

    // 각각 다른 guardId를 가져야 함
    const guardIds = melPatches.map(p => Object.keys(p.value)[0]);
    expect(new Set(guardIds).size).toBe(2);
  });

  it('generates stable guardId', () => {
    const source = `
      action myAction() {
        onceIntent { patch x = 1 }
      }
    `;
    const ir1 = compile(source);
    const ir2 = compile(source);
    expect(ir1.guardIds).toEqual(ir2.guardIds);
  });
});

describe('once() regression', () => {
  it('existing once() behavior unchanged', () => {
    const source = `
      action test() {
        once(myGuard) {
          patch myGuard = $meta.intentId
          patch count = add(count, 1)
        }
      }
    `;
    const ir = compile(source);
    // Guard should be in domain field, not $mel
    const guardPatch = ir.actions[0].patches.find(p => p.path === 'myGuard');
    expect(guardPatch).toBeDefined();
  });
});
```

### 6.3 Integration 테스트

```typescript
describe('onceIntent execution', () => {
  it('executes block only once per intent', async () => {
    const app = createApp({
      schema: { state: { fields: { count: { type: 'number', default: 0 } } } },
      actions: compile(`
        action increment() {
          onceIntent { patch count = add(count, 1) }
        }
      `),
    });

    // First dispatch
    await app.dispatch({ type: 'increment', intentId: 'i1' });
    expect(app.getSnapshot().data.count).toBe(1);

    // Same intent, should not increment again (re-entry)
    await app.dispatch({ type: 'increment', intentId: 'i1' });
    expect(app.getSnapshot().data.count).toBe(1);

    // New intent, should increment
    await app.dispatch({ type: 'increment', intentId: 'i2' });
    expect(app.getSnapshot().data.count).toBe(2);
  });

  it('guard state stored in $mel namespace', async () => {
    const app = createApp({ /* ... */ });
    await app.dispatch({ type: 'increment', intentId: 'i1' });

    const snapshot = app.getSnapshot();
    expect(snapshot.data.$mel?.guards?.intent).toBeDefined();
    expect(snapshot.data.count).toBe(1);
    // Guard not in domain state
    expect(snapshot.data.incrementGuard).toBeUndefined();
  });

  it('multiple onceIntent blocks work correctly (Critical)', async () => {
    const app = createApp({
      schema: { state: { fields: { a: { type: 'number', default: 0 }, b: { type: 'number', default: 0 } } } },
      actions: compile(`
        action test() {
          onceIntent { patch a = 1 }
          onceIntent { patch b = 2 }
        }
      `),
    });

    await app.dispatch({ type: 'test', intentId: 'i1' });
    const snapshot = app.getSnapshot();

    // 둘 다 실행되어야 함 (shallow merge로 덮어씌워지지 않음)
    expect(snapshot.data.a).toBe(1);
    expect(snapshot.data.b).toBe(2);

    // 두 guard 모두 저장되어야 함
    const guards = snapshot.data.$mel?.guards?.intent;
    expect(Object.keys(guards).length).toBe(2);
  });

  it('handles deep path patch safely', async () => {
    const app = createApp({
      schema: { state: { fields: { count: { type: 'number', default: 0 } } } },
      actions: compile(`
        action test() {
          onceIntent { patch count = 1 }
        }
      `),
    });

    // Should not throw PATH_NOT_FOUND
    await expect(app.dispatch({ type: 'test', intentId: 'i1' })).resolves.not.toThrow();
  });

  it('onceIntent identifier still works in once() (contextual keyword)', async () => {
    const app = createApp({
      schema: { state: { fields: {
        onceIntent: { type: 'string', default: null },
        count: { type: 'number', default: 0 }
      } } },
      actions: compile(`
        action test() {
          once(onceIntent) {
            patch onceIntent = $meta.intentId
            patch count = add(count, 1)
          }
        }
      `),
    });

    await app.dispatch({ type: 'test', intentId: 'i1' });
    const snapshot = app.getSnapshot();

    expect(snapshot.data.onceIntent).toBe('i1');
    expect(snapshot.data.count).toBe(1);
  });
});

describe('World hash', () => {
  it('excludes $mel from hash computation', async () => {
    const snap1 = { data: { count: 1, $mel: { guards: { intent: { a: 'i1' } } } } };
    const snap2 = { data: { count: 1, $mel: { guards: { intent: { a: 'i2' } } } } };

    const hash1 = computeSnapshotHash(snap1);
    const hash2 = computeSnapshotHash(snap2);

    expect(hash1).toBe(hash2);  // Same hash, $mel excluded
  });
});
```

---

## 7. Open Questions

### 7.1 Resolved (본 ADR에서 확정)

| # | 질문 | 결정 |
|---|------|------|
| 1 | 네임스페이스 정책 | `$mel` 별도 도입, `$host` 유지 |
| 2 | guardId 생성 정책 | Content-addressable: `hash(actionName:blockIndex:guardType)` |
| 3 | guardId 안정성 | 리오더/삽입 시 변경 허용, 명시적 라벨은 추후 고려 |
| 4 | 퍼시스턴스 정책 | 기본 저장, `stripPlatformState` opt-in 제거 |
| 5 | `onceExecution` 도입 시점 | v2.1로 연기 |
| 6 | `$mel` 패치 안전성 | 구조적 default + **map 레벨 merge** (루트 merge 금지) |
| 7 | desugar 경로 일치 | `once(X)` 인자와 첫 patch 경로 반드시 동일 |
| 8 | `onceIntent` 키워드 타입 | **Contextual keyword** (기존 식별자 사용 호환) |

### 7.2 Deferred (후속 결정)

| # | 질문 | 결정 시점 |
|---|------|-----------|
| 1 | `$meta.executionKey` 제공 방식 | `onceExecution` 도입 시 (v2.1) |
| 2 | 명시적 라벨 옵션 `onceIntent("label")` | 실수요 확인 후 |
| 3 | Codemod 세부 구현 | Phase 3 (Week 3) |
| 4 | 추가 플랫폼 네임스페이스 (`$debug` 등) | 필요 시 별도 ADR |

---

## 8. Decision

**GO**

본 ADR의 결정들을 기반으로 구현/문서 업데이트를 진행한다.

- 모든 핵심 설계 결정이 확정됨
- 크리티컬 이슈 4건 해결됨:
  - desugar 경로 일치
  - $mel 패치 안전성 (map 레벨 merge)
  - shallow merge 문제 해결
  - contextual keyword로 기존 코드 호환
- 기존 의미론 변경 없음
- SemVer minor 릴리즈로 배포 가능
- 리스크 완화 방안 명시됨

---

## Appendix A: Specification Changes Summary

### A.1 World SPEC v2.0.3 변경사항

```diff
 ## 7.9.4 Implementation

 /**
- * Strip Host-owned namespace from data before hashing.
- * WORLD-HASH-4a: data.$host MUST NOT be included in hash.
+ * Strip platform-owned namespaces from data before hashing.
+ * WORLD-HASH-4a: data.$host MUST NOT be included in hash.
+ * WORLD-HASH-4b: data.$mel MUST NOT be included in hash.
  */
-function stripHostNamespace<T extends Record<string, unknown>>(
+function stripPlatformNamespaces<T extends Record<string, unknown>>(
   data: T
-): Omit<T, '$host'> {
+): Omit<T, '$host' | '$mel'> {
   if (data && typeof data === 'object' && !Array.isArray(data)) {
-    const { $host, ...rest } = data;
-    return rest as Omit<T, '$host'>;
+    const { $host, $mel, ...rest } = data;
+    return rest as Omit<T, '$host' | '$mel'>;
   }
   return data;
 }
```

### A.2 MEL SPEC 변경사항

```diff
 ## 4.5 Action Declaration

 GuardedStmt     = WhenStmt
                 | OnceStmt
+                | OnceIntentStmt

 OnceStmt        = "once" "(" Path ")" [ "when" Expression ] "{" { InnerStmt } "}"

+OnceIntentStmt  = "onceIntent" [ "when" Expression ] "{" { InnerStmt } "}"
+
+/* Note: "onceIntent" is a contextual keyword.
+ * It is recognized as a keyword only when:
+ *   - At statement start position, AND
+ *   - Next token is "{" or "when"
+ * Otherwise, it is treated as a regular identifier.
+ */
```

### A.3 New FDR Entries

| FDR ID | Title | Decision |
|--------|-------|----------|
| FDR-MEL-060 | `onceIntent` Sugar | Per-intent guard with auto-generated key in `$mel` namespace |
| FDR-MEL-061 | `$mel` Namespace | Compiler-owned namespace for internal state |
| FDR-MEL-062 | GuardId Stability | Content-addressable guardId, reorder allowed |
| FDR-MEL-063 | `$mel` Patch Safety | Structured default + map-level merge required |
| FDR-MEL-064 | `onceIntent` Contextual Keyword | Keyword only at statement start + `{`/`when` |

### A.4 New Compiler Rules

| Rule ID | Description |
|---------|-------------|
| COMPILER-MEL-1 | 컴파일러가 생성하는 `$mel.guards.intent` 관련 패치는 **반드시 `$mel.guards.intent` 경로에 대한 merge**를 사용해야 한다. 루트 `$mel` merge는 **금지**. |
| COMPILER-MEL-2 | `onceIntent` desugar 시 `once(X)` 인자와 첫 patch 경로는 반드시 동일해야 한다 |
| COMPILER-MEL-3 | `onceIntent`는 contextual keyword로 파싱한다. 문장 시작 + 다음 토큰이 `{` 또는 `when`일 때만 키워드로 인식. |

---

## Appendix B: Examples

### B.1 Before/After Comparison

**Before (v2.0.2):**
```mel
domain Counter {
  state {
    count: number = 0
    incrementGuard: string | null = null  // 스키마 오염
  }

  action increment() {
    once(incrementGuard) {
      patch incrementGuard = $meta.intentId  // 보일러플레이트
      patch count = add(count, 1)
    }
  }
}
```

**After (v2.0.3+):**
```mel
domain Counter {
  state {
    count: number = 0
    // $host, $mel 자동 주입됨 (스키마에 명시 불필요)
  }

  action increment() {
    onceIntent {
      patch count = add(count, 1)
    }
  }
}
```

### B.2 Complex Workflow (once() 여전히 유용)

```mel
domain OrderProcessor {
  state {
    order: Order | null = null
    validationResult: ValidationResult | null = null
    submitResult: SubmitResult | null = null
    // 워크플로우 추적용 가드는 도메인 상태
    validated: string | null = null
    submitted: string | null = null
  }

  action processOrder() {
    // Step 1: Validate
    once(validated) when isNotNull(order) {
      patch validated = $meta.intentId
      effect validation.run({ order: order, into: validationResult })
    }

    // Step 2: Submit (depends on validation)
    once(submitted) when eq(validationResult.status, "ok") {
      patch submitted = $meta.intentId
      effect api.submit({ order: order, into: submitResult })
    }

    // 단순 로깅 (워크플로우 추적 불필요)
    onceIntent when isNotNull(submitResult) {
      effect analytics.track({ event: "order_submitted" })
    }
  }
}
```

### B.3 Compiled Output Example

```mel
// Source
action increment() {
  onceIntent {
    patch count = add(count, 1)
  }
}

// Compiled (conceptual)
action increment() {
  // guardId = hash("increment:0:intent") = "a3f7c2e1"
  once($mel.guards.intent.a3f7c2e1) {
    patch $mel.guards.intent.a3f7c2e1 = $meta.intentId  // 경로 일치 ✓
    patch count = add(count, 1)
  }
}

// Generated Patches (map 레벨 merge)
[
  { op: "merge", path: "$mel.guards.intent", value: { a3f7c2e1: "intent-123" } },
  { op: "set", path: "count", value: 2 }
]
```

### B.4 Multiple onceIntent Blocks (Shallow Merge Safe)

```mel
// Source
action multiStep() {
  onceIntent { patch a = 1 }
  onceIntent { patch b = 2 }
}

// Generated Patches (각각 map 레벨 merge)
[
  { op: "merge", path: "$mel.guards.intent", value: { abc123: "intent-1" } },
  { op: "set", path: "a", value: 1 },
  { op: "merge", path: "$mel.guards.intent", value: { def456: "intent-1" } },
  { op: "set", path: "b", value: 2 }
]

// Final $mel state (두 guard 모두 유지됨)
{
  guards: {
    intent: {
      abc123: "intent-1",
      def456: "intent-1"
    }
  }
}
```

### B.5 Contextual Keyword Behavior

```mel
// ✅ onceIntent 문법으로 파싱 (statement start + { or when)
action example1() {
  onceIntent { patch x = 1 }
}

action example2() {
  onceIntent when ready { patch x = 1 }
}

// ✅ 식별자로 파싱 (기존 코드 호환)
action example3() {
  once(onceIntent) {                    // onceIntent는 식별자
    patch onceIntent = $meta.intentId   // onceIntent는 식별자
    patch x = 1
  }
}

action example4() {
  when eq(onceIntent, null) {           // onceIntent는 식별자
    patch onceIntent = "value"          // onceIntent는 식별자
  }
}
```

---

*End of ADR-002*
