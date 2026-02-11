# ADR-006: Runtime Reframing & SDK Typed Client — 실행 통합은 Runtime으로, Type-Safe DX는 SDK로

> **Status:** Proposed
> **Date:** 2026-02-10 (D5–D11 추가: 2026-02-11)
> **Deciders:** Manifesto Architecture Team
> **Scope:** v3 Architecture (Core, Host, World, Compiler, Runtime, SDK)
> **Supersedes / Reframes:** ADR-001의 "App=composition root" 서술 일부, App 중심 DX 서술(부분)
> **Related:** ADR-005 (Snapshot Path DSL — Withdrawn), Constitution §6 (Type Discipline), World HASH rules, Host Contract (Snapshot canonical)
> **Effective:**
> - **Phase 1 (v2.x transition):** D0–D4 — 규범적, 구현 완료
> - **Phase 2 (v3.0+ target):** D5–D11 — 규범적 설계 목표, 구현 미완 (phase-gated)
>
> **v2 SPEC 호환:** 본 ADR이 Accepted 되기 전까지, 기존 v2 운영 SPEC 계약(World SPEC, App SPEC 등)은 유효하다.
> ADR-006의 내부 아키텍처 변경은 v2 외부 계약을 무효화하지 않는다.

---

## 1. Context

v2에서 "App"은 다음 세 역할이 한 덩어리로 묶여 있었다:

1) **Execution Integration (Host ↔ World 결합, 정책, 관측/telemetry, 스케줄링)**
2) **External Facade (act/subscribe/getState 등 외부 계약 표면)**
3) **DX Surface (상태 접근 표면, computed 접근, 네이밍, 프레임워크 친화 API)**

그 결과:

- Snapshot 경계 계약(`data`, `computed`, `system`, `meta`, `input`)이 DX 표면으로 그대로 새어 나와
  - `data` vs `state` 혼란,
  - `computed['computed.x']` 같은 내부 좌표계 노출,
  - getState/getSnapshot 명명 혼선이 누적되었다.
- 실행/수렴/발행(publish) 같은 "runtime semantics"와
  접근/표현 같은 "DX semantics"가 문서/코드에서 섞여
  의미론적 좌표계(semantic coordinate)가 흐려졌다.

v3에서는 "모든 단위는 Snapshot"이라는 헌법을 유지하되,
**실행 통합(aggression/integration)** 과 **DX 표면**을 물리적으로 분리해
다음 조건을 만족해야 한다:

- Core/Host/World/Compiler 계약 경계가 확장되어도 의미론적 좌표계가 흔들리지 않는다.
- Publish boundary와 실행 수렴 규칙이 DX 변화에 의해 오염되지 않는다.
- DX는 SDK에서 자유롭게 진화할 수 있다(프레임워크/언어별).

---

## 2. Decision

### D0. 용어 정의 (Normative)

- **Runtime:** Host↔World↔Compiler를 결합하여 "Proposal 실행→terminalSnapshot"을 수렴시키고,
  publish boundary/telemetry/policy를 소유하는 **실행 통합 주체**.
- **SDK:** 개발자 경험(DX)을 제공하는 **표현/접근/프레임워크 통합 레이어**.
  Runtime 위에서 동작하며, Snapshot 접근/선택/구독의 편의 API를 제공한다.
- **App:** v3에서는 **정식(노멀티브) 아키텍처 용어에서 제거**한다.
  필요 시 `@manifesto-ai/app`는 호환성 래퍼(compat wrapper) 또는 SDK의 별칭으로만 존재할 수 있다.

> 결과: "Results are World's; Process is Runtime's; DX is SDK's."

---

### D1. 패키지/레이어 책임 재배치 (Normative)

#### D1.1 Runtime이 소유하는 것 (MUST)

Runtime은 다음을 **직접 구현/소유**한다:

- **Host ↔ World integration**
  - World가 요구하는 executor 인터페이스를 Runtime이 구현한다.
  - Host 내부 실행 모델(ExecutionKey mailbox, job model)은 Runtime에서 흡수한다.
  - **v2.x 브리지:** World-facing HostExecutor contract provider는 `@manifesto-ai/app`(SDK) facade로 유지.
    Runtime은 facade 뒤의 내부 위임(internal delegation) 구현을 소유한다.
- **Execution policy**
  - ExecutionKey policy
  - approvedScope enforcement
  - retry/serial 정책(필요 시)
- **Proposal Tick 실행 파이프라인**
  - baseSnapshot restore, compute/apply loop orchestration, effect dispatch/fulfill
- **Publish boundary**
  - Proposal Tick 당 state publish 최소 1회, 최대 1회(terminalSnapshot)
- **Telemetry**
  - Host trace/micro-steps를 관측 가능한 이벤트로 변환/스트리밍("Process")
- **Scheduler injection**
  - publish scheduling/coalescing은 런타임 종속이므로 주입 가능해야 한다.

#### D1.2 SDK가 소유하는 것 (MUST)

SDK는 다음을 **직접 구현/소유**한다:

- 개발자용 public API 표면
  - framework integration(React/Vue/etc)
  - subscription helper, selector, memoization 등
- Snapshot 접근 표준(읽기 좌표계)
  - SDK가 type-safe한 접근 방식을 정의한다 (ADR-005의 Snapshot Path DSL은 Withdrawn;
    대안으로 typed projection 또는 별도 접근 표준을 SDK에서 결정한다)
- computed/state와 같은 DX projection/alias
  - `computed.` prefix 제거 같은 "표현 개선"은 SDK에서만 수행

#### D1.3 금지 규칙 (Semantic Pollution 방지)

- Runtime은 **DX projection/alias를 제공하지 않는다.**
  - 예: `snapshot.state` alias, computed alias(`computed.doubled`) 등은 Runtime 금지.
- SDK는 **실행/수렴/정책을 재정의하지 않는다.**
  - SDK는 Runtime 위에 얹혀 동작하며, 실행 의미론을 바꾸지 않는다.

> **전환기 예외 (v2.x):** `toClientState()`(구 `withDxAliases`)는 `@manifesto-ai/shared`에
> 위치하며 Runtime과 SDK 모두가 소비하는 상태 유틸이다. Shared는 Runtime/SDK 아래
> 계약 레이어이므로 D1.3 위반이 아니다. v3.0 TypedClient(D5–D11) 구현 시 SDK의
> `SnapshotView`(D6)로 대체 예정.

---

### D2. Publish boundary 및 채널 분리 (Normative)

#### D2.1 Tick 정의 (재확인)

- **Host Tick:** Host mailbox runner의 수렴 구간(구현 세부사항)
- **Proposal Tick:** 하나의 Proposal 실행 사이클(시작 → terminalSnapshot)

#### D2.2 Publish boundary 규칙

- **PUB-1 (MUST):** Runtime은 Proposal Tick 기준으로 state publish를 **최소 1회, 최대 1회** 발생시킨다.
- **PUB-2 (MUST):** publish 기준 snapshot은 **terminalSnapshot**이다.
- **PUB-3 (MUST NOT):** computed 노드 단위 / apply 호출 단위 publish는 금지한다.

#### D2.3 State vs Telemetry 분리

- **CHAN-1 (MUST):** Runtime은 "state publish"와 "telemetry"를 분리한다.
- **CHAN-2 (MUST):** World 결과(봉인/lineage)는 telemetry에 의존하지 않는다.
  - telemetry는 Process 관측이며, Results/History의 권위가 아니다.

---

### D3. Snapshot Access 규칙 (Normative)

- **ACCESS-1 (MUST):** Runtime은 Snapshot 접근 문법/표현을 정의하지 않는다.
- **ACCESS-2 (MUST):** SDK는 type-safe한 Snapshot 접근 표준을 정의한다.
  (ADR-005 Snapshot Path DSL은 Withdrawn — Constitution §6.1 Zero String Paths 위반.
  D5–D11에서 TypedClient/SnapshotView/FieldRef/PatchBuilder로 구체화한다.)
- **ACCESS-3 (MUST):** Runtime/World/Core/Host 경계에서 Snapshot canonical shape(`data`, `computed`, `system`, `input`, `meta`)는 유지된다.

> 결과: 실행 의미론(D2)과 접근 의미론(D3)이 분리되어,
> DX 변화가 실행 계약을 오염시키지 않는다.

---

### D4. Semantic Pollution 없는 Canonicalization 규칙 (Normative)

v3에서 "의미론적 좌표계"는 다음 원칙으로 보호한다:

#### D4.1 Raw Snapshot vs Canonical Projection

- **RAW:** 실행/리플레이/디버깅을 위한 전체 Snapshot(모든 필드 포함)
- **CANONICAL:** World identity(해시), delta scope, lineage 등 "의미론적 동일성"에 쓰기 위한 **투영(projection)**

#### D4.2 Canonicalization 사용 범위

- **CAN-1 (MUST):** Canonicalization은 **오직**
  - WorldId/snapshotHash 계산
  - delta 생성/비교
  - lineage 관련 인덱싱
  에만 사용된다.
- **CAN-2 (MUST NOT):** Canonical snapshot을 Core.compute/Core.apply의 입력으로 사용하지 않는다.
  - 실행 의미론은 raw snapshot을 기준으로 수렴한다.

#### D4.3 Platform namespace 제외 (오염 방지)

- **CAN-3 (MUST):** semantic identity 계산에서 platform-owned namespaces는 제외한다.
  - 최소: `data.$host`, `data.$mel`
  - v3에서는 확장 가능성을 위해 `data.$*` 전체를 platform namespace로 취급하는 것을 권장한다(도메인에서 `$` 금지 전제).
- **CAN-4 (MUST):** `input`, `meta.*(timestamp/randomSeed 등)`, `computed`는 semantic identity에 포함하지 않는다(재파생 가능/비결정론/컨텍스트 오염 방지).

> 목적: runtime/compiler/host의 내부 슬롯 변화가 World identity를 바꾸는 "의미론적 오염"을 구조적으로 차단한다.

---

> **Phase Gate:** D5–D11은 v3.0+ TypedClient DX 목표를 기술한다.
> 규범적 설계 약속이나 아직 구현되지 않았다. v2.x 전환기에는 기존 untyped API
> (`act()`, `getState()`, `subscribe()`)가 지원 표면이다.

### D5. TypedClient\<TSchema\> — 제네릭 기반 타입 추론 (Normative)

D1.2와 ACCESS-2를 구체화한다. SDK는 도메인 수준의 type-safe DX를 `TypedClient<TSchema>`로 제공한다.

#### D5.1 타입 소스 전략

**Phase 1 (Schema Generic):** 유저가 스키마 타입을 제네릭으로 제공한다.

```typescript
interface CounterSchema {
  state: { count: number };
  computed: { doubled: number };
  actions: { increment: () => void; add: (amount: number) => void };
}

const client = createClient<CounterSchema>({
  schema: `domain Counter { ... }`,
  effects: {},
});
```

**Phase 2 (후순위 — MEL Codegen):** MEL → `.d.ts` 코드 생성으로 TSchema를 자동 생성.
Phase 1의 제네릭 구조가 codegen 출력 형태와 동일하므로 마이그레이션 비용 없음.

#### D5.2 TSchema 구조 (Normative)

```typescript
interface DomainSchemaType<
  TState = Record<string, unknown>,
  TComputed = Record<string, unknown>,
  TActions = Record<string, unknown>,
> {
  state: TState;
  computed: TComputed;
  actions: TActions;
}
```

- `state` — MEL `state { ... }` 블록의 필드 타입
- `computed` — MEL `computed` 선언의 필드 타입
- `actions` — MEL `action` 선언의 함수 시그니처 타입

TSchema를 제공하지 않으면 모든 접근이 `unknown`으로 폴백한다 (기존 동작과 동일).

---

### D6. SnapshotView\<TSchema\> — 도메인 좌표계 투사 (Normative)

#### D6.1 좌표 변환

| Snapshot canonical (Runtime) | SnapshotView (SDK) | 의미 |
|---|---|---|
| `snapshot.data.*` | `view.state.*` | 도메인 상태 |
| `snapshot.computed["computed.x"]` | `view.computed.x` | 파생 값 |
| `snapshot.system` | `view.system` | 시스템 메타 (변환 없음) |
| `snapshot.meta` | `view.meta` | 버전/타임스탬프 (변환 없음) |

#### D6.2 규칙

- **VIEW-1 (MUST):** `view.state`는 `Snapshot.data`에 대한 **읽기 전용 투사**이다. 복사하지 않는다.
- **VIEW-2 (MUST):** `view.computed`는 `computed.` prefix가 제거된 키로 접근한다.
- **VIEW-3 (MUST):** SnapshotView는 **불변**이다.
- **VIEW-4 (MUST NOT):** SnapshotView는 `Snapshot.input`을 노출하지 않는다 (transient 필드).

#### D6.3 TypeScript 타입

```typescript
interface SnapshotView<TSchema extends DomainSchemaType = DomainSchemaType> {
  readonly state: Readonly<TSchema["state"]>;
  readonly computed: Readonly<TSchema["computed"]>;
  readonly system: Readonly<SystemState>;
  readonly meta: Readonly<SnapshotMeta>;
}
```

#### D6.4 접근 API

- **VIEW-API-1 (MUST):** `client.getSnapshot()` → `SnapshotView<TSchema>`
- **VIEW-API-2 (MUST):** `client.subscribe()` 셀렉터의 인자도 `SnapshotView<TSchema>`

```typescript
const snap = client.getSnapshot();
snap.state.count;       // number (자동완성)
snap.computed.doubled;  // number (자동완성)
```

---

### D7. FieldRef\<T\> — Phantom Type 기반 경로 참조 (Normative)

Constitution §6.2의 FieldRef를 SDK에서 구현한다.

#### D7.1 정의

```typescript
type FieldRef<T> = {
  readonly __kind: "FieldRef";
  readonly __path: string;        // Snapshot canonical path
  readonly __type?: T;            // phantom type — 런타임 값 없음
};
```

#### D7.2 생성 — Proxy 기반

`client.state`와 `client.computed`는 FieldRef를 생성하는 Proxy 객체이다:

```typescript
client.state.count;       // → FieldRef<number>  (path: "data.count")
client.state.items;       // → FieldRef<Item[]>  (path: "data.items")
client.computed.doubled;  // → FieldRef<number>  (path: "computed.doubled")
```

#### D7.3 규칙

- **REF-1 (MUST):** Proxy property access는 `FieldRef<T>`를 반환한다.
- **REF-2 (MUST):** `FieldRef.__path`는 Snapshot canonical path이다 (`data.count`, `computed.doubled`).
- **REF-3 (MUST):** 중첩 접근을 지원한다: `client.state.user.name` → `FieldRef<string>` (path: `"data.user.name"`)
- **REF-4 (MUST NOT):** FieldRef는 값을 담지 않는다. 값 읽기는 `getSnapshot()` 전용.

---

### D8. PatchBuilder — FieldRef로 타입 안전 패치 생성 (Normative)

#### D8.1 API

```typescript
client.patch(ref: FieldRef<T>)
  .set(value: T)               → Patch   // { op: "set", path, value }
  .unset()                     → Patch   // { op: "unset", path }
  .merge(partial: Partial<T>)  → Patch   // { op: "merge", path, value }
```

#### D8.2 규칙

- **PATCH-1 (MUST):** `FieldRef<T>`의 phantom type을 이용해 **타입 안전한 값만** 허용한다.
- **PATCH-2 (MUST):** Constitution §4.2의 3가지 연산(`set`, `unset`, `merge`)만 사용한다.
- **PATCH-3 (MUST):** PatchBuilder는 **Patch 객체만 생성**한다. 실행하지 않는다.

#### D8.3 예시

```typescript
const countRef = client.state.count;

// 타입 안전
client.patch(countRef).set(5);
// → { op: "set", path: "data.count", value: 5 }

// 타입 에러 — number 필드에 string
client.patch(countRef).set("hello");
// → TypeScript compile error

// 중첩 객체 merge
client.patch(client.state.user).merge({ name: "Alice" });
// → { op: "merge", path: "data.user", value: { name: "Alice" } }
```

---

### D9. ActionProxy\<TActions\> — 타입 안전 액션 호출 (Normative)

#### D9.1 API

```typescript
client.actions.increment();     // → client.act("increment"), ActionHandle 반환
client.actions.add(5);          // → client.act("add", { amount: 5 })
```

#### D9.2 규칙

- **ACT-1 (MUST):** `client.actions`는 `TSchema["actions"]`에 대응하는 Proxy이다.
- **ACT-2 (MUST):** 내부적으로 `client.act(type, input)` 을 호출한다.
- **ACT-3 (MUST):** 반환 타입은 `ActionHandle`이다.
- **ACT-4 (MUST NOT):** 실행 의미론을 변경하지 않는다. 순수 DX 래퍼.

#### D9.3 파라미터 매핑

- 단일 파라미터: `client.actions.add(5)` → `act("add", { amount: 5 })`
- 복수 파라미터: `client.actions.transfer({ from, to, amount })` → `act("transfer", { from, to, amount })`

---

### D10. 구독 통합 (Normative)

```typescript
// SnapshotView 기반 셀렉터
client.subscribe(
  (snap) => snap.state.count,    // snap: SnapshotView<TSchema>
  (count) => console.log(count), // count: number 추론
);

// FieldRef 기반 단축 구독
client.watch(client.state.count, (count) => {
  console.log(count); // number
});
```

- **SUB-1 (MUST):** `subscribe()` 셀렉터 인자 타입은 `SnapshotView<TSchema>`.
- **SUB-2 (MAY):** `watch(ref, listener)` 단축 API를 제공할 수 있다.

---

### D11. 패키지 경계 — SDK 전용 구현 (Normative)

- **BOUNDARY-1 (MUST):** D5–D10의 모든 구현은 `@manifesto-ai/sdk` 내에 위치한다.
- **BOUNDARY-2 (MUST NOT):** Core, Runtime, Shared, Host, World를 수정하지 않는다.
- **BOUNDARY-3 (MUST):** TypedClient 내부에서 기존 `App` 인터페이스를 래핑한다. 기존 untyped API는 하위 호환 유지.

#### D11.1 SDK 모듈 구조

```
packages/sdk/src/
├── typed-client.ts           # TypedClient<TSchema>
├── snapshot-view.ts          # SnapshotView 투사
├── field-ref.ts              # FieldRef + Proxy 팩토리
├── patch-builder.ts          # PatchBuilder
├── action-proxy.ts           # ActionProxy
└── create-client.ts          # createClient<TSchema>() (기존 확장)
```

#### D11.2 Type Flow

```
유저 정의           SDK 내부                 Runtime/Core
─────────────      ─────────────            ─────────────
TSchema
  .state ──────►  SnapshotView.state ────►  Snapshot.data
  .computed ───►  SnapshotView.computed ─►  Snapshot.computed
  .actions ────►  ActionProxy ───────────►  client.act(type, input)

FieldRef<number>
  (path: "data.count")
       │
       ▼
  PatchBuilder.set(5)
       │
       ▼
  Patch { op: "set", path: "data.count", value: 5 }
       │
       ▼
  Core.apply(schema, snapshot, [patch])
```

#### D11.3 Phase 2 마이그레이션 경로 (Non-normative)

```bash
# MEL → TypeScript codegen (Phase 2)
npx manifesto codegen --input counter.mel --output counter.schema.ts
```

```typescript
// 자동 생성됨 — Phase 1의 수동 정의와 동일 구조
export interface CounterSchema extends DomainSchemaType {
  state: { count: number };
  computed: { doubled: number };
  actions: { increment: () => void; add: (amount: number) => void };
}
```

Phase 1의 `TSchema` 제네릭 구조 = codegen 출력 형태. 마이그레이션 비용 없음.

---

## 3. Architecture Sketch

### 3.1 Dependency Direction (v3)

```
SDK  ────────────────►  Runtime  ──────────►  World  ──────────►  (WorldStore)
                          │
                          ├──────────────►  Host  ───────────►  Core
                          │
                          └──────────────►  Compiler (MEL → schema/IR, lowering)
```

- SDK는 Runtime만 안다(호스트/월드 디테일 숨김).
- Runtime은 Host/World/Compiler를 결합한다(통합/흡수).
- World는 governance + persistence + lineage를 소유한다.

---

## 4. Consequences

### Positive

- 실행 의미론(수렴/발행/telemetry)이 DX와 분리되어 안정성이 높아진다.
- SDK는 프레임워크별/런타임별 DX를 독립적으로 진화시킬 수 있다.
- "Snapshot이 단위"라는 헌법을 유지하면서도 접근 혼선(경계 타입 누출)을 구조적으로 막는다.
- platform namespaces를 semantic identity에서 분리하여, 내부 슬롯 변화가 WorldId를 오염시키지 않는다.
- TypedClient\<TSchema\>로 도메인 수준 타입 안전성 확보 — `snap.state.count`가 `number`로 추론된다.
- FieldRef + PatchBuilder로 Constitution §6.1 Zero String Paths를 SDK 레벨에서 완전히 충족한다.
- Phase 1(Schema Generic)과 Phase 2(MEL Codegen)가 동일 제네릭 구조를 공유하여 마이그레이션 비용 없음.
- ActionProxy로 액션 호출에도 자동완성/타입 검사가 적용된다.

### Negative / Trade-offs

- 패키지/개념 재정렬로 마이그레이션 비용이 발생한다.
- SDK/Runtime 분리로 초기 진입점이 2단("SDK로 들어가 Runtime을 만든다")처럼 보일 수 있어,
  문서/온보딩에서 "SDK가 유일한 DX entrypoint"임을 강하게 안내해야 한다.
- TSchema 제네릭 제공이 Phase 1에서는 수동이므로, 스키마와 타입 정의의 drift 가능성이 있다.
  Phase 2 codegen으로 해소 예정.
- Proxy 기반 FieldRef는 TypeScript 타입 추론에 의존하므로, 에디터 성능에 미미한 영향이 있을 수 있다.

---

## 5. Migration Notes (Non-normative)

- `@manifesto-ai/app`는 v3에서 deprecated:
  - 가능하면 SDK로 이동(호환 wrapper 제공 가능)
- 기존 `createApp` 성격의 API는 SDK로 이동:
  - SDK 내부에서 Runtime을 구성/생성하거나,
  - `createRuntime()` + `createClient()`(SDK)로 분리할 수 있다.
- Runtime 이벤트/훅 시스템이 필요하면 Runtime이 소유하고 SDK는 구독만 한다.

---

## 6. Non-Goals

- Snapshot canonical shape를 변경하지 않는다.
- Core/Host/World 계약을 DX 때문에 바꾸지 않는다.
- SDK가 실행 의미론(수렴/정책/봉인)을 소유하지 않는다.
- Canonicalization을 실행 입력으로 사용하지 않는다.

---

## 7. Normative Rules Summary

| Rule | Category | Statement |
|------|----------|-----------|
| PUB-1 | Publish | Proposal Tick당 state publish 최소 1회, 최대 1회 |
| PUB-2 | Publish | Publish 기준은 terminalSnapshot |
| PUB-3 | Publish | Computed/apply 단위 publish 금지 |
| CHAN-1 | Channel | State publish와 telemetry 분리 |
| CHAN-2 | Channel | World 결과는 telemetry에 의존하지 않음 |
| ACCESS-1 | Access | Runtime은 Snapshot 접근 문법/표현을 정의하지 않음 |
| ACCESS-2 | Access | SDK가 type-safe한 Snapshot 접근 표준을 정의 (D5–D11으로 구체화) |
| ACCESS-3 | Access | Snapshot canonical shape는 경계에서 유지 |
| CAN-1 | Canonicalization | Hash/delta/lineage에만 사용 |
| CAN-2 | Canonicalization | Canonical snapshot을 실행 입력으로 사용 금지 |
| CAN-3 | Canonicalization | Platform namespace (`data.$*`) semantic identity 제외 |
| CAN-4 | Canonicalization | `input`, `meta.*`, `computed` semantic identity 제외 |
| VIEW-1 | SnapshotView | `view.state`는 `Snapshot.data`에 대한 읽기 전용 투사 |
| VIEW-2 | SnapshotView | `view.computed`는 `computed.` prefix 제거 키로 접근 |
| VIEW-3 | SnapshotView | SnapshotView는 불변 |
| VIEW-4 | SnapshotView | SnapshotView는 `Snapshot.input`을 노출하지 않음 (transient) |
| REF-1 | FieldRef | Proxy property access는 `FieldRef<T>`를 반환 |
| REF-2 | FieldRef | `FieldRef.__path`는 Snapshot canonical path |
| REF-3 | FieldRef | 중첩 접근 지원 (`client.state.user.name` → `data.user.name`) |
| REF-4 | FieldRef | FieldRef는 값을 담지 않음 — 값 읽기는 `getSnapshot()` 전용 |
| PATCH-1 | PatchBuilder | FieldRef\<T\> phantom type으로 타입 안전한 값만 허용 |
| PATCH-2 | PatchBuilder | Constitution §4.2의 3가지 연산(`set`, `unset`, `merge`)만 사용 |
| PATCH-3 | PatchBuilder | PatchBuilder는 Patch 객체만 생성 — 실행하지 않음 |
| ACT-1 | ActionProxy | `client.actions`는 `TSchema["actions"]`에 대응하는 Proxy |
| ACT-2 | ActionProxy | 내부적으로 `client.act(type, input)` 호출 |
| ACT-3 | ActionProxy | 반환 타입은 `ActionHandle` |
| ACT-4 | ActionProxy | 실행 의미론을 변경하지 않음 — 순수 DX 래퍼 |
| SUB-1 | Subscription | `subscribe()` 셀렉터 인자 타입은 `SnapshotView<TSchema>` |
| SUB-2 | Subscription | `watch(ref, listener)` 단축 API 제공 가능 (MAY) |
| BOUNDARY-1 | Package | D5–D10 구현은 `@manifesto-ai/sdk` 내에 위치 |
| BOUNDARY-2 | Package | Core, Runtime, Shared, Host, World를 수정하지 않음 |
| BOUNDARY-3 | Package | TypedClient는 기존 App 인터페이스를 래핑 — 하위 호환 유지 |

---

*End of ADR-006*
