# ADR-005: DX 개선 — Snapshot Path DSL (`${...}`) 도입

> **Status:** Proposed
> **Date:** 2026-02-10
> **Deciders:** Manifesto Architecture Team
> **Scope:** Global (Core, Host, World, App, MEL Compiler)
> **Affected Packages:** `@manifesto-ai/core`, `@manifesto-ai/host`, `@manifesto-ai/world`, `@manifesto-ai/app`, `@manifesto-ai/compiler`

---

## 1. Context

### 1.1 문제

Manifesto에서 **모든 단위는 Snapshot**이며, Core↔Host 간의 유일한 통신 채널도 Snapshot이다.

하지만 JS/TS 사용자 경험에서는 Snapshot 접근이 다음과 같은 DX 문제를 노출한다:

- Domain state가 `snapshot.data.*` 아래에 존재하여, MEL에서 선언한 `state.count`와 사용자 접근 경로가 불일치한다.
- computed 값이 `snapshot.computed['computed.<name>']`처럼 **SemanticPath 문자열 key**로 저장되어,
  - dot accessor(`snapshot.computed.doubled`)로 접근할 수 없고
  - 사용자가 내부 prefix 규칙(`computed.`)을 알아야 한다.
- App 사용자는 물론, Core/Host/World를 직접 사용하는 사용자도 동일한 혼선을 겪는다.
- v3에서 Core/Host/MEL(World 포함) 계약 경계가 확장되더라도,
  **의미론적 좌표계(semantic coordinate)가 흔들리지 않는 "표준 접근 좌표계"**가 필요하다.

### 1.2 요구사항

- **R1 (MUST):** Snapshot의 canonical storage shape(예: `data`, `computed`, `system`, `input`, `meta`)는 유지한다.
- **R2 (MUST):** Domain state를 `$`-prefixed storage namespace로 이동시키지 않는다. (`$*`는 platform reserved 성격이 강하며, World identity/hash 규칙과 결합되어 있음)
- **R3 (MUST):** App 사용자와 Core/Host/World 직접 사용자 모두가 동일한 접근 규약을 사용할 수 있어야 한다.
- **R4 (SHOULD):** MEL 표면(`state`, `computed`)과 접근 방식이 직관적으로 연결되어야 한다.
- **R5 (SHOULD):** computed의 내부 prefix(`computed.`)는 userland에서 노출되지 않아야 한다.
- **R6 (MUST):** "모든 단위는 Snapshot" 원칙을 훼손하지 않는다. (별도의 Component Instance/Proxy 객체를 Truth로 두지 않는다)

---

## 2. Decision

### 2.1 Snapshot Path DSL (SP-DSL) 도입

Snapshot을 읽기 위한 **표준 접근 좌표계**로 `Snapshot Path DSL`을 도입한다.

- Path는 문자열로 표현된다.
- 표준 표기 형식은 `${...}` 래퍼를 사용한다.
  - 예: `"${$state.count}"`, `"${$computed.doubled}"`

> **중요:** `${...}`는 "접근 좌표계"일 뿐이며, Snapshot의 storage key space(저장 구조/해시 입력/델타 규약)를 변경하지 않는다.

### 2.2 Reserved Root Scopes

SP-DSL은 루트 스코프를 예약어로 제공한다:

- `$state` : domain state 접근
- `$computed` : computed 접근 (내부 `computed.` prefix 숨김)
- `$system` : `snapshot.system` 접근
- `$input` : `snapshot.input` 접근
- `$meta` : `snapshot.meta` 접근
- `$platform` : platform reserved namespace 접근 (`snapshot.data.$*` 계열)

다음 alias를 MUST로 제공한다 (APP-NS-1, HOST-NS-1, COMPILER-MEL-1에 의해 `$host`/`$mel`은 런타임에 항상 존재하므로, SP-DSL parser도 이를 필수로 인식해야 한다):

- `$mel` : `$platform.mel`의 sugar
- `$host` : `$platform.host`의 sugar

---

## 3. Specification (Normative)

### 3.1 Syntax

**PathRef**는 아래를 따른다:

- `PathRef := "${" SystemPath "}"`
- `SystemPath := Root (("." Segment) | BracketSegment)*`
- `Root := "$state" | "$computed" | "$system" | "$input" | "$meta" | "$platform" | "$mel" | "$host"`
- `Segment := Identifier`
- `BracketSegment := "[" (QuotedString | Number) "]"`

권장 규칙:

- `Identifier`는 `/^[A-Za-z_][A-Za-z0-9_]*$/`를 기본으로 한다.
- 특수문자(예: `-`, `.`, `$`로 시작하는 키 등)가 필요한 경우 bracket 표기를 사용한다.
  - 예: `"${$input['$app'].memoryContext}"`

### 3.2 Resolution Semantics

SP-DSL은 PathRef를 canonical snapshot coordinate로 resolve한다.

#### A. `$state`

- `${$state.<p>}`는 `snapshot.data.<p>`로 resolve된다.

예:
- `"${$state.count}"` → `snapshot.data.count`

#### B. `$computed`

- `${$computed.<name>}`는 `snapshot.computed['computed.<name>']`로 resolve된다.
- Raw key 접근이 필요한 경우 bracket로 explicit key를 지정할 수 있다.

예:
- `"${$computed.doubled}"` → `snapshot.computed['computed.doubled']`
- `"${$computed['computed.doubled']}"` → `snapshot.computed['computed.doubled']`

#### C. `$system`, `$input`, `$meta`

- `${$system.<p>}` → `snapshot.system.<p>`
- `${$input.<p>}` → `snapshot.input.<p>`
- `${$meta.<p>}` → `snapshot.meta.<p>`

예:
- `"${$meta.intentId}"` → `snapshot.meta.intentId`
- `"${$input.userId}"` → `snapshot.input.userId`
- `"${$input['$app'].memoryContext}"` → `snapshot.input.$app.memoryContext`

#### D. `$platform`

- `${$platform.<ns>.<p>}`는 `snapshot.data.$<ns>.<p>`로 resolve된다.
- Alias:
  - `${$mel.<p>}`는 `${$platform.mel.<p>}`와 동일
  - `${$host.<p>}`는 `${$platform.host.<p>}`와 동일

예:
- `"${$platform.mel.guards.intent}"` → `snapshot.data.$mel.guards.intent`
- `"${$mel.guards.intent}"` → `snapshot.data.$mel.guards.intent`
- `"${$host.intentSlots}"` → `snapshot.data.$host.intentSlots`

---

## 4. Non-Goals

- Snapshot storage shape를 `state`, `computed` 같은 새 필드로 재구성하지 않는다.
- Domain state를 `$state` 같은 `$`-prefixed storage namespace로 옮기지 않는다.
- computed의 canonical key space(SemanticPath) 자체를 변경하지 않는다.
- 별도 "Instance object"를 시스템의 진실(Truth)로 두지 않는다.

---

## 5. Consequences

### Positive

- App/Core/Host/World 사용자 모두가 **단일 접근 좌표계**로 Snapshot을 읽을 수 있다.
- `snapshot.data.*` / `snapshot.computed['computed.*']` 같은 내부 구조 노출이 줄어든다.
- computed prefix(`computed.`)를 userland에서 숨기고, MEL 선언과 더 가까운 문법을 제공한다.
- v3에서 계약 경계가 확장되어도, "접근 좌표계(SP-DSL)"를 통해 의미론적 안정성을 유지할 수 있다.

### Negative / Trade-offs

- Path parsing/resolution 유틸리티가 필요하다.
- JS 템플릿 리터럴(backtick)과 `${...}` 표기가 혼동될 수 있으므로,
  문서에서 **항상 문자열 리터럴로 사용**하도록 안내가 필요하다.
  - 예: `read(snapshot, "${$state.count}")` (✅)
  - 예: ``read(snapshot, `${$state.count}`)`` (❌ 실제 JS interpolation)

---

## 6. Alternatives Considered

1) **Do nothing**
   - Rejected: DX 혼선이 구조적으로 누적된다.

2) **Snapshot storage shape 변경 (`snapshot.state`, computed key prefix 제거 등)**
   - Rejected: Core/Host/World 계약, hash/delta 규약 등 파급이 너무 크다.

3) **Vue Component Instance 같은 별도 Instance/proxy 시스템 도입**
   - Rejected: "모든 단위는 Snapshot" 원칙을 약화시키고,
     JS 런타임 객체가 Truth처럼 보이는 설계를 유도한다.

---

## 7. Implementation Plan (Sketch)

- **Core**: `@manifesto-ai/core`에 SP-DSL parser/resolver 제공 (단일 구현).
- **App**:
  - `app.read(pathRef)` / `app.select(pathRef)` 같은 DX helper를 제공 (선택).
  - 문서/예제를 SP-DSL 중심으로 전환.
- **Tests**:
  - `$computed` prefix 숨김 resolve 테스트
  - `$platform`(`$mel/$host`) resolve 테스트
  - `$input['$app']` 같은 reserved-key 접근 테스트

---

## 8. Appendix

### 8.1 ADR index 추가 제안

`docs/adr/index.md`의 Global ADRs 테이블에 다음 row를 추가한다:

| ID | Title | Status | Date | Affected Packages |
|----|-------|--------|------|-------------------|
| ADR-005 | DX 개선 — Snapshot Path DSL (`${...}`) 도입 | Proposed | 2026-02-10 | Core, Host, World, App, Compiler |

---

*End of ADR-005*
