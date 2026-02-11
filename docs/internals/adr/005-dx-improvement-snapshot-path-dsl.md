# ADR-005: DX 개선 — Snapshot Path DSL (`${...}`) 도입

> **Status:** Withdrawn
> **Date:** 2026-02-10
> **Withdrawn:** 2026-02-11
> **Deciders:** Manifesto Architecture Team
> **Scope:** Global (Core, Host, World, App, MEL Compiler)
> **Affected Packages:** `@manifesto-ai/core`, `@manifesto-ai/host`, `@manifesto-ai/world`, `@manifesto-ai/app`, `@manifesto-ai/compiler`

---

## Withdrawal Notice

ADR-005는 **Withdrawn** 상태로 전환한다.

### 철회 사유

1. **Constitution §6.1 위반 (Zero String Paths):**
   SP-DSL은 `"${$state.count}"` 같은 문자열 경로를 user-facing API로 도입한다.
   Constitution은 "User-facing APIs MUST NOT require string paths"를 명시하고 있으며,
   SP-DSL은 이를 직접 위반한다.

2. **Constitution §2 Priority 7 (Type Safety) vs Priority 8 (Simplicity) 상충:**
   EBNF 문법 + parser + resolver 인프라는 과도한 복잡성을 도입하며,
   type-safe한 대안(typed projection)이 이미 존재한다.

3. **문제는 이미 해결됨:**
   ADR-005가 해결하려던 DX 문제(`data` vs `state` 혼란, `computed.` prefix 노출)는
   APP-SPEC v2.3.2의 `withDxAliases()` typed projection으로 이미 해결되었다.
   이 접근법은 IDE autocomplete, compile-time type checking을 완전히 지원하며
   Constitution §6.1을 준수한다.

4. **Constitution §8.2 (Invalid Refactoring Motivation):**
   "Future requirements not yet specified"를 위한 v3 좌표계 설계는
   현재 요구사항에 대한 최소 복잡성 원칙(Priority 8)에 반한다.

### 잔여 가치 — 내부 유틸리티로의 가능성

SP-DSL이 유효할 수 있는 영역은 **user-facing API가 아닌 내부 용도**에 한정된다:

- 디버거/inspector 도구에서의 Snapshot 경로 표시
- 런타임 쿼리/로깅에서의 경로 직렬화
- 테스트 헬퍼에서의 간결한 경로 표기

이러한 용도가 필요할 경우, 별도의 **internal utility ADR**로 제안할 수 있다.
이 경우에도 user-facing API 표면에는 노출되지 않아야 한다.

---

## Original Context (Historical Record)

### 문제

Manifesto에서 **모든 단위는 Snapshot**이며, Core↔Host 간의 유일한 통신 채널도 Snapshot이다.

하지만 JS/TS 사용자 경험에서는 Snapshot 접근이 다음과 같은 DX 문제를 노출한다:

- Domain state가 `snapshot.data.*` 아래에 존재하여, MEL에서 선언한 `state.count`와 사용자 접근 경로가 불일치한다.
- computed 값이 `snapshot.computed['computed.<name>']`처럼 **SemanticPath 문자열 key**로 저장되어,
  - dot accessor(`snapshot.computed.doubled`)로 접근할 수 없고
  - 사용자가 내부 prefix 규칙(`computed.`)을 알아야 한다.

### 제안된 결정

SP-DSL(`${$state.count}`, `${$computed.doubled}` 등)을 user-facing 접근 좌표계로 도입.

### 철회 이유 요약

| 근거 | 헌법 조항 | 판정 |
|------|-----------|------|
| 문자열 경로를 user-facing API에 도입 | §6.1 Zero String Paths | 위반 |
| EBNF + parser + resolver 인프라 | §2 Priority 8 Simplicity | 과도 |
| typed projection이 이미 존재 | APP-SPEC v2.3.2 | 불필요 |
| v3 좌표계 사전 설계 | §8.2 Invalid Motivation | 위반 |

---

*End of ADR-005*
