TRD — Manifesto Compiler 모듈 분리 리팩터링 (API 유지)

## 1.1 문서 메타

* Doc: TRD / Compiler Internal Modularization
* Status: Draft
* Target package: `@manifesto-ai/compiler`
* Non-breaking: ✅ (외부 API 유지) 

---

## 1.2 배경과 문제 정의

### 배경

컴파일러는 다음을 제공하는 “도구 집합”입니다:

* `createCompiler(config)`로 인스턴스 생성 후 `compile`, `compileFragments`, `link`, `verify`, `suggestPatches`, `applyPatch`, `createSession` 제공 
* Pass 시스템(Registry/Executor) + built-in passes + NL pass(LLM 필요) 
* Linker/Verifier/Patch/Codebook/LLM adapters/Session Observability까지 모두 한 패키지에서 노출 

### 문제

현 구조가 “기능 관심사” 관점에서 섞이기 쉬운 이유:

* 결정론 로직(링크/검증/패치)과 비결정/IO(LLM 호출, rate limit, retry)가 구조적으로 가까이 있음 
* Session(관찰/스냅샷/이벤트)이 pipeline 내부 구현과 강하게 엮이기 쉬움 
* 결과적으로 테스트/확장/설명(Studio)/Agent 루프에서 “경계”가 흐려짐

---

## 1.3 목표와 설계 원칙

## 목표

1. **Public API 100% 유지**

   * `createCompiler`, `Compiler` 인터페이스, 타입(Artifact/Fragment/Issue/Patch/LinkResult/VerifyResult 등) 유지 
2. **내부를 모듈로 분리 + 의존성 방향 고정**
3. **모나딕/아토믹 구성**으로 Manifesto 철학과 align

   * 에러/흐름은 `Result` 기반 합성(throw 최소화)
   * 기능은 작은 순수 함수(atomic)로 쪼개고 합성
   * Side-effect는 “설명”과 “실행”을 분리한다는 Core 원칙을 유지
4. **Functional semantics는 Core 기원**

   * Expression DSL, Effect, Policy, DAG 등은 Core의 모델을 따르고 중복 정의/사설 확장을 지양

---

## 1.4 유지해야 하는 Public API 계약

### Compiler 생성/메서드 (불변)

* `createCompiler(config: ExtendedCompilerConfig): Compiler` 
* `Compiler.compile() / compileFragments() / link() / verify() / suggestPatches() / applyPatch() / createSession()` 

### Pass 시스템 (불변)

* `createPassRegistry`, `createPassExecutor`, `Pass`, `NLPass` 시그니처 유지 
* built-in passes 우선순위(0~900) 유지 

### Linker/Verifier/Patch/LLM adapter/Session (불변)

* `link(...) -> LinkResult`, `verify(...) -> VerifyResult`, patch ops, adapters, session phases 그대로 

---

## 1.5 제안 내부 아키텍처 (단일 패키지 내 모듈 분리)

> “패키지 1개 유지 + 내부 폴더/엔트리 분리”가 가장 현실적인 1차 목표(추후 workspace 분리 가능)

### 폴더 구조

```
packages/compiler/src/
  index.ts                  # Public Facade: 기존 export 유지(재export + createCompiler 조립)
  compiler/                 # createCompiler + Compiler 구현(오케스트레이션)
  types/                    # 공용 IR 타입(최하위)
  passes/                   # Pass system + built-in passes
  linker/                   # link/incrementalLink/graph/conflicts
  verifier/                 # verify/validateDag/validateStatic/rules
  patch/                    # patch ops + applyPatch + codebook/similarity
  llm/                      # adapters + prompts + parseJSON/retry/ratelimit/etc
  pipeline/                 # compile flow orchestration(phase 단계)
  session/                  # CompilerSession + snapshot/events
  internal/                 # (비공개) 공용 유틸/에러/정렬/불변 helpers
```

### 의존성 방향(강제)

* `types/*`는 **어느 것도 import하지 않는다** (최하위)
* `llm/*`는 provider SDK 의존을 여기로만 제한 
* `passes/linker/verifier/patch`는 `types`에만 의존(필요시 최소 유틸)
* `pipeline`은 위 모듈을 “조립/실행”만
* `session`은 `pipeline`을 감싸 관찰 기능 제공(phase/snapshot/events) 
* `compiler`는 facade용 조립 레이어
* `index.ts`는 public export의 단일 진입점

> **금지 규칙 예시:** `linker -> llm` import 금지, `verifier -> session` import 금지, `types -> *` import 금지.

---

## 1.6 모듈별 책임과 핵심 인터페이스

## (A) `types/` — 공용 IR (단일 진실 공급원)

### 책임

* Compiler 전역에서 공유되는 타입: Artifact/Fragment/Issue/Conflict/Patch/Provenance 등
* Public API의 타입 계약이기도 함 

### 포함 대상(예시)

* `Artifact`(code/text/manifesto), `Fragment`, `FragmentKind`, `Provenance`(promptHash 포함) 
* `CompileInput/Options/Result`, `LinkResult`, `VerifyResult` 
* `Patch`, `PatchOp`, `PatchHint`, `ApplyPatchResult` 
* `LLMAdapter` **인터페이스 타입**(구현은 llm로 이동) 

---

## (B) `passes/` — Pass Registry/Executor + Built-in passes

### 책임

* Pass 등록/정렬/실행(Registry/Executor) 
* built-in passes 제공(우선순위 유지) 
* NL pass는 `llmAdapter`가 있을 때만 조립 단계에서 enable 

### 모나딕/아토믹 설계 요구

* `Pass.analyze()` / `Pass.compile()`은 **작은 단위의 순수 결과**(`Finding[]`, `Fragment[]`)만 반환
* 실패는 throw보다 `Result`(내부)로 변환해 pipeline에서 수집/Issue로 변환(아래 1.7 참조)

---

## (C) `linker/` — fragments → domain draft + conflicts/issues

### 책임

* `link`, `incrementalLink`, dependency graph 구축, conflicts 탐지/병합 전략 
* 옵션: `mergeStrategy`, `sortFragments`, `sortResults`, `codebook` 등 유지 

### 원칙

* **결정론**: 동일 fragments + options => 동일 LinkResult
* aliasing/유사도 제안은 `patch/codebook`로 위임(링커는 “생성”보다 “결과” 중심)

---

## (D) `verifier/` — LinkResult/DomainDraft 검증

### 책임

* DAG 검증 / static 검증 / policy/effect/action 검증 
* `VerifyOptions`의 flags 유지 + `maxEffectRisk` 처리 

### Core align 포인트

* Manifesto Core의 “결정론적 상태 관리”/DAG 검증 철학에 맞게, 검증은 **데이터 기반**으로 수행
* effect 위험도는 Action semantic의 risk 개념과 맞물리므로 정책/효과 검증은 Core semantics를 존중

---

## (E) `patch/` — Patch ops + applyPatch + codebook/similarity

### 책임

* Patch는 **아토믹 연산들의 집합**(PatchOp list)으로 정의 
* `createPatch`, op factories, `applyPatch` / 결과(성공/실패 op 목록) 유지 
* codebook(aliasing) 및 similarity 분석 기능 유지 

### 아토믹 원칙

* PatchOp는 “한 번에 하나의 의미 변화”만 수행

  * renamePathOp는 “전역 rename”이므로 atomic이지만 범위가 넓음 → 내부 구현은 atomic step들로 분해해 실행 가능(실패지점 추적 용이)

---

## (F) `llm/` — 비결정/IO 경계(Provider SDK 격리)

### 책임

* `createOpenAIAdapter`, `createAnthropicAdapter` 구현 + config 유지 
* prompt building, JSON parse, retry, rate limit, token estimate 등의 유틸 유지 
* NL extractor pass 지원(필요시 passes/builtin/nlExtractorPass.ts에서 어댑터를 주입받아 사용)

### 원칙

* LLM 호출은 “제안/초안” 생성까지만.
* 생성된 결과는 반드시 `Provenance(llm + promptHash + model)`로 추적 가능해야 함(타입에 이미 존재) 

---

## (G) `pipeline/` — compile flow orchestration

### 책임

* `compileFragments` → `link` → `verify` → (optional) `repairing` 단계를 조립
* session이 관찰할 수 있도록 **phase event hook** 제공(아래 session 참조) 

---

## (H) `session/` — CompilerSession / Observability

### 책임

* `CompilerSession`의 `onPhaseChange`, `onSnapshotChange`, `subscribePath`, `subscribeEvents`, `getRuntime()` 유지 
* phase 상태( `idle/parsing/extracting/lowering/linking/verifying/repairing/done/error`) 유지 

### Core align 포인트

* Core Runtime도 “스냅샷 불변성 + 구독” 패턴을 갖고 있음. Compiler session도 동일 철학(스냅샷과 구독)을 유지하는 것이 일관적

---

## 1.7 “모나딕 & 아토믹” 구현 규격 (Compiler 내부 표준)

Manifesto Core에서 Effect/Result 패턴이 명시적 에러 흐름과 합성을 제공하는 것처럼, Compiler도 동일 철학을 적용합니다.

## (1) 내부 Result 표준(권장)

* 가능하면 `@manifesto-ai/core`의 Result 패턴(`ok/err`, `isOk/isErr`, `map/flatMap`)을 재사용 
* 최소한 동일한 형태의 `Result<T,E>`를 compiler 내부 표준으로 둔다.

예시(개념):

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

## (2) Atomic function 규격

* 함수는 “한 단계 변환”만 수행한다.
* 입력/출력 타입을 좁게 가져간다.
* throw 대신 Result로 실패를 표현하고, 상위에서 Issue로 변환한다(유저가 이해 가능한 실패). 

예시(개념):

* `normalizeFragments(fragments) -> Result<Fragment[], NormalizeError>`
* `detectConflicts(fragments) -> Conflict[]`
* `buildDomainDraft(fragments) -> Result<DomainDraft, DomainBuildError>`

## (3) Side-effect 분리(“설명 vs 실행”)

Core Effect 철학: Effect는 “기술(description)”이고 실행은 runner에서만 일어난다.
Compiler에서도 동일:

* 컴파일러는 Effect를 “생성/분석/검증”할 뿐, 실행하지 않는다.
* LLM 호출(네트워크)은 `llm/` 모듈에서만 발생하도록 제한한다.

---

## 1.8 “Core 기원” 규칙의 기술적 구현

## 원칙

Functional semantics(표현식/효과/정책/주소체계/DAG)는 Core가 정의한다.

## 구현 가이드

* Expression 관련:

  * Expression은 JSON DSL이며 직렬화/정적분석이 가능해야 한다는 Core 원칙을 따른다. 
  * Compiler는 “새로운 표현식 언어”를 만들지 않는다.
* SemanticPath 관련:

  * 모든 값은 SemanticPath로 주소화된다. Compiler는 path aliasing은 codebook으로 처리하되 “새 주소 체계”를 만들지 않는다.
* Policy/Effect 관련:

  * 정책/효과는 데이터로 선언되고, 위험도 등은 Core semantics와 호환돼야 한다.
* DAG 관련:

  * cycle/dep 검증은 DAG 기반으로 수행하며, derived/async와 deps 개념을 존중한다.

---

## 1.9 “Core 확장이 필요한 경우” 처리(제안 기반)

Core에 없는 기능(예: 새로운 operator/effect/policy 개념)이 필요해 보일 때 compiler가 임의로 확장하면 철학이 깨집니다.
따라서 compiler는 다음처럼 행동합니다:

### 규칙

* **즉시 구현 금지:** compiler 내부 “사설 연산자/사설 effect tag” 추가 금지
* **대신 Issue + Suggestion을 생성:**

  * `Issue`에 `suggestedFix?: PatchHint`가 이미 존재하므로 이를 적극 활용 
  * 또는 “Core Extension Proposal” 타입의 `Issue`를 도입하되 Public API 타입을 깨지 않도록 기존 `IssueCode` 내에서 확장(내부 코드)하거나 message로 표현

### 예시(행동)

* (예) 코드에서 `['regexExtract', ...]` 같은 연산이 필요해 보이지만 Expression DSL에 없다면:

  1. `Issue(severity: 'suggestion' | 'warning')` 추가
  2. message: “Core Expression DSL에 regexExtract operator 추가를 고려하세요”
  3. “대체 가능한 기존 연산(예: matches + replace 조합)”이 있으면 PatchHint로 제안

---

## 1.10 빌드/엔트리/트리쉐이킹 요구사항

* `src/index.ts`는 Public API의 단일 엔트리(기존 export 유지) 
* Provider SDK는 `llm/` 외부로 import 금지 → LLM 미사용 환경에서 번들 누수 최소화 
* 내부 배럴 export 남발 금지(순환 의존 방지)

---

## 1.11 테스트 전략(모듈 분리와 “결정론” 고정)

### (A) Golden / Snapshot (최우선)

* 동일 입력 artifacts로 `compile()` 결과(`fragments/issues/conflicts/domain/provenance`) 스냅샷 고정 
* `sortFragments/sortResults` 옵션에 따른 순서 안정성도 함께 고정 

### (B) 모듈 단위 테스트

* passes: registry sorting/disabled/custom 조합, supports/filtering 
* linker: conflict detection/merge strategy/aliasing 옵션
* verifier: check flags 조합 + maxEffectRisk 처리 
* patch: apply 성공/실패 op 목록 일치 
* llm: parseJSON/retry/ratelimit (네트워크 mocking) 
* session: phase transition + snapshot change 이벤트 시퀀스 

### (C) 계약 테스트(API 유지)

* 타입 레벨 계약 테스트(tsd 등)로 `@manifesto-ai/compiler` d.ts 스냅샷 고정 

---

## 1.12 리스크와 대응

1. **순환 import 재발**

   * 대응: ESLint `import/no-cycle` + `no-restricted-imports`로 방향 규칙 강제
2. **LLM 의존이 core로 새는 문제**

   * 대응: provider SDK는 `llm/`에서만 import 가능(리뷰 체크리스트)
3. **스냅샷/정렬로 인한 미세한 출력 변화**

   * 대응: golden tests로 즉시 감지, 정렬 규칙 명시

---

## 1.13 구현 마일스톤(리팩터링 순서)

1. M0: Golden test(compile 결과) 먼저 고정
2. M1: `types/` 도입 + 타입 이동(기존 경로 re-export로 내부 깨짐 최소화)
3. M2: passes 분리
4. M3: linker 분리
5. M4: verifier 분리
6. M5: patch/codebook 분리
7. M6: llm 분리
8. M7: pipeline + session 분리
9. M8: lint 규칙/문서화/리뷰 체크리스트
