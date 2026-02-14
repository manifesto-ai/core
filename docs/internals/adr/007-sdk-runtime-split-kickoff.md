# ADR-007: SDK/Runtime Split Kickoff Gate and Staged Locking

> **Status:** Accepted
> **Date:** 2026-02-14
> **Deciders:** Manifesto Architecture Team
> **Scope:** Global (App, Runtime, SDK, World, docs governance)
> **Supersedes (partial):** ADR-004 §7.4, ADR-006 §5
> **Related:** ADR-001 (Layer Separation), ADR-004 (App Internal Decomposition), ADR-006 (PUB/CHAN/CAN rules)

---

## 1. Context

Runtime/SDK 분해 문서가 존재하지만, 착수 기준과 상태 해석이 문서마다 다르게 읽히는 문제가 있었다.
특히 다음이 혼선을 만들었다.

1. ADR-006은 PUB/CHAN/CAN 규칙을 정의하면서도 §5에서 분할 착수 시점을 강하게 유보했다.
2. ADR-004 §7.4는 패키지 분할을 거부한 기록을 갖고 있다.
3. Runtime/SDK SPEC은 Draft이지만, 착수 가능한 고정 baseline인지 여부가 명시적으로 잠기지 않았다.

이 ADR은 분할 개발 "착수" 기준을 고정하되, 기존 레이어 원칙(ADR-001)과 현재 public entry(`@manifesto-ai/app`) 안정성을 유지한다.

---

## 2. Decision

### 2.1 Kickoff Gate Policy (A2, Relaxed)

SDK/Runtime 분할 개발 착수는 다음 조건에서 허용한다.

- **Kickoff threshold:** `3/5` 게이트 충족
- **Mandatory gates:** `CAN-2`, `CHAN-2`
- **Selected third gate:** `CAN-4`

즉, 착수 허용 최소 집합은 `CAN-2 + CHAN-2 + CAN-4`이다.

### 2.2 Staged Locking Model

잠금 방식은 **단계적 잠금**으로 고정한다.

1. ADR 정책은 본 ADR(`Accepted`)로 고정한다.
2. Runtime/SDK SPEC 상태는 `Draft`를 유지한다.
3. 다만 Requirement ID 안정성은 잠근다.
   - Runtime: `RT-*` requirement ID rename/remove 금지
   - SDK: `SDK-*` requirement ID rename/remove 금지
4. 허용되는 변경은 additive clarification, 예시 보강, 구현 세부화(규범 의미 불변)로 제한한다.

### 2.3 Direction and Release Strategy (B3 + C1)

- **B3:** SDK-first는 즉시 전환이 아니라 **목표 end-state**로 정의한다.
- **C1:** 2단계 호환 릴리스로 고정한다.
  - **Phase 1 (Kickoff):** `@manifesto-ai/app`를 canonical entry로 유지, Runtime/SDK는 내부/preview baseline
  - **Phase 2 (Transition):** pre-alpha exit gate 충족 후 SDK-first public 전환

### 2.4 Minimal Supersede Scope (D1)

본 ADR은 다음 조항만 최소 범위로 supersede한다.

1. **ADR-004 §7.4**의 "패키지 분할 거부" 조항 중, 분할 착수 시점을 전면 차단하는 부분
2. **ADR-006 §5**의 분할 착수 블로킹 조건 중, 착수 시점에 대한 strict deferral 부분

다음은 supersede 대상이 아니다.

- **ADR-001 레이어 원칙 전체**
- "패키지 분할 = 새 레이어"라는 해석(허용되지 않음)

### 2.5 Scope Guardrails

이번 ADR의 결정은 문서 거버넌스와 착수 게이트에 한정한다.

- 공개 API 변경 없음
- 실제 패키지 추출/배포는 다음 단계
- `createApp()` 및 `@manifesto-ai/app` 현재 계약은 유지

---

## 3. Consequences

### 3.1 Positive

1. 분할 착수 가능 여부를 정량 게이트로 판단할 수 있다.
2. ADR 정책과 SPEC 상태(Draft)의 공존 규칙이 명확해진다.
3. SDK-first 방향(B3)을 유지하면서도 즉시 전환 리스크를 줄인다.

### 3.2 Trade-offs

1. `3/5` 착수는 strict full-closure보다 잔여 리스크를 남긴다.
2. Phase 2 전환 전까지는 `@manifesto-ai/app` 중심 문서와 분해 문서를 함께 관리해야 한다.

---

## 4. Gate Model

### 4.1 Kickoff Gate (A2)

Kickoff verdict는 아래 충족 시 **Allowed**:

- `CAN-2`: canonical snapshot 실행 입력 금지 경계 검증
- `CHAN-2`: World outcome이 host advisory/telemetry에 종속되지 않음
- `CAN-4`: semantic identity에서 `input/meta/computed` 제외 불변성 검증

### 4.2 Pre-Alpha Exit Gate (Phase 2 prerequisite)

아래 항목은 Phase 2 전환 전에 충족해야 한다.

- `PUB-3`
- `CHAN-1`
- Architecture review sign-off

---

## 5. Evidence and Operational Documents

본 ADR의 운영 증빙은 아래 non-normative companion에서 관리한다.

- [ADR-006 Evidence Matrix](./006-evidence-matrix)
- [ADR-006 Split Readiness Pack](./006-split-readiness-pack)

Companion 문서는 본 ADR이나 ADR-006의 규범 문구를 대체하지 않는다.

---

*End of ADR-007*
