Manifesto Compiler 헌법서(Constitution)

> 이 문서는 “리팩터링 이후에도” 컴파일러/에이전트/스튜디오 기능이 **Manifesto 철학**에서 이탈하지 않게 하는 운영 규범입니다.

## 전문(Preamble)

Manifesto는 **AI Native Semantic Layer**로서, 비즈니스 로직을 “선언적 데이터 구조”로 표현하여 AI가 이해/조작할 수 있게 한다. 
Compiler는 그 선언 구조로 수렴하기 위한 변환기이며, Runtime은 DAG 기반 결정론적 전파와 스냅샷/구독으로 실행을 제공한다.

이 헌법은 다음 두 가지를 최상위 가치로 둔다:

1. **결정론적 의미 모델(Core)의 보존**
2. **확장 가능하지만 안전한 제안 기반 변화**

---

## 제1조 — Core 주권(Core Supremacy)

1. Functional semantics(표현식, 효과, 정책, 주소 체계, DAG)의 “정의 권한”은 오직 `@manifesto-ai/core`에 있다.
2. Compiler/Studio/Agent는 Core semantics를 “사용/투영/제안”할 수 있으나, **사설 semantics를 도입해선 안 된다.**
3. “도메인은 단일 진실 공급원”이며, defineDomain/defineSource/defineDerived/defineAction으로 표현되는 구조를 최종 진실로 존중한다.

---

## 제2조 — 모나딕 규율(Monadic Discipline)

1. 모든 실패 가능 로직은 **명시적 결과 타입(Result)** 을 통해 흐름을 드러내야 한다. (throw는 최후 수단)
2. Core는 이미 Result 패턴을 통해 예외 대신 명시적 에러 처리를 권장한다. 
3. Compiler에서의 원칙:

   * “실패”는 `Issue`/`Conflict`/`VerifyResult`로 수렴되어 사용자/Agent에게 관측 가능해야 한다. 
   * 내부적으로는 `Result<T,E>`로 합성 가능해야 한다(= map/flatMap으로 파이프라인 조립).

---

## 제3조 — 아토믹 규율(Atomicity)

1. 기능은 가능한 작은 “원자 단위”로 쪼개야 한다.
2. Patch는 원자 연산(PatchOp)들의 리스트로 표현되며, 컴파일러/에이전트/사용자 편집은 원칙적으로 Patch로 표현한다. 
3. 원자 단위는 다음 조건을 충족해야 한다:

   * 단일 책임(한 가지 의미 변화)
   * 테스트 가능(입력→출력)
   * 추적 가능(Provenance/Evidence/Confidence가 연결 가능) 

---

## 제4조 — “설명”과 “실행”의 분리(Effect Separation)

1. Effect는 실행이 아니라 **기술(description)** 이다.
2. Compiler는 Effect를 **생성/분석/검증**할 수 있으나, 절대 실행하지 않는다.
3. 실행은 Runtime(effect runner/handler)에서만 발생한다.

---

## 제5조 — 결정론 경계(Determinism Boundary)

1. Linker/Verifier/Patch 적용은 가능한 한 결정론적이어야 한다. 
2. 비결정/IO(LLM 호출, rate limit, retry)는 `llmAdapter` 경계 뒤로 격리한다. 
3. 비결정 요소가 개입된 산출물은 반드시 provenance에 모델/프롬프트 해시 등 추적 정보를 포함해야 한다. 

---

## 제6조 — 주소(semantic path) 불변

1. 도메인의 모든 값은 SemanticPath로 주소화된다. 
2. Compiler는 path를 생성/검증/aliasing할 수 있으나, 주소 체계를 바꾸지 않는다.
3. aliasing은 codebook으로 수행하며, 이는 **제안 가능한 변화**로 취급한다. 

---

## 제7조 — Core 확장 요청 절차(Proposal-First Extension)

1. Compiler가 Core에 없는 기능이 필요하다고 판단할 때(새 operator, 새 effect tag, 새 policy semantics 등), 다음 중 하나로만 진행한다:

   * (A) 기존 Core 기능 조합으로 대체 가능한 경우 → PatchHint로 제안
   * (B) 대체 불가능한 경우 → Issue로 “Core 확장 제안”을 사용자에게 노출 
2. Compiler는 Core를 “몰래 확장”하지 않는다(사설 DSL/사설 effect 금지).
3. 사용자/커뮤니티가 수용하면 Core에 정식 도입하고, Compiler는 그 버전을 타겟으로 업데이트한다(마이그레이션 가이드 제공). 

---

## 제8조 — 관측 가능성(Observability) 우선

1. 내부 동작은 Session을 통해 관측 가능해야 한다(phase/snapshot/events). 
2. Runtime이 스냅샷/구독 모델을 제공하듯, Compiler도 상태 변화는 스냅샷으로 추적 가능해야 한다.
3. 관측 가능성은 “디버그 옵션”이 아니라 설계의 기본값이다.

---

## 제9조 — 안전(Safety)과 정책(Policy) 우선

1. Action/Effect는 위험도(risk)와 정책을 통해 안전하게 다뤄져야 한다.
2. `effectPolicy.maxRisk`와 `verifier.maxEffectRisk`는 사용자 의도에 따라 일관되게 해석되어야 한다. 

---

## 제10조 — 호환성(Compatibility)과 진화(Evolution)

1. Public API는 가능한 오래 안정적으로 유지한다. 
2. 변경이 필요할 경우:

   * Proposal → Deprecation → Migration Guide 순으로 진행한다. 
3. “코어 버전(coreVersion)”을 명시하고, 호환성 범위를 명확히 한다. 
