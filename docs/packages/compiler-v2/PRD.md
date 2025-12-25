# PRD — Manifesto Compiler 내부 구조 분리 리팩터링 (Public API 유지)

## 0. 한 줄 요약

`@manifesto-ai/compiler`의 **외부 API(Export/동작)는 그대로 유지**하면서, 내부를 **(1) Pass, (2) Linker, (3) Verifier, (4) Patch/Codebook, (5) LLM Adapter, (6) Session/Observability, (7) Types**로 명확히 분리해 **테스트/확장/에이전트 연동/Studio 통합**이 쉬운 구조로 재편한다.
(외부 관점에서 `createCompiler().compile()`/`createSession()` 등은 그대로)

---

## 1. 배경과 문제 정의

### 배경

현재 `@manifesto-ai/compiler`는 제품 방향상 “Manifestofy Agent”의 핵심 엔진(=AI가 호출하는 도구)이면서, 동시에 Studio가 관찰/설명/디버깅하는 대상입니다. 공개 API는 이미 꽤 풍부합니다:

* `createCompiler(config)`로 컴파일러 생성 및 `compile`, `link`, `verify`, `applyPatch`, `createSession` 제공
* Pass 시스템(Registry/Executor)과 기본 Pass들, Linker/Verifier 함수군, Patch Operation, LLM Adapter(OpenAI/Anthropic)까지 모두 Export됨

### 문제

지금 구현은 “모호하게 섞여 있다”는 당신의 표현처럼, **서로 다른 관심사(추출/변환/링크/검증/수정/LLM/세션)가 한 덩어리로 엉킴** → 아래 비용이 커집니다.

* 테스트가 어렵다(순수 함수 경계가 흐림)
* Studio에서 관찰하려면 내부 상태가 더 필요해지고, 그게 곧 API/구조에 누수됨
* LLM을 넣을수록 비결정성/재시도/레이트리밋 같은 IO concerns가 core 로직과 섞임
* 향후 Agent 제품에서 “컴파일러를 도구(MCP)로” 쓰려면 모듈 경계가 분명해야 함 (특히 patch/verify loop)

---

## 2. 목표(Goals)

### G1. Public API 100% 유지 (호환성 최우선)

외부 사용자가 의존하는 시그니처/Export/동작을 깨지 않는다.

* `createCompiler(config: ExtendedCompilerConfig): Compiler` 유지
* `Compiler`가 제공하는 메서드 유지:
  `compile`, `compileFragments`, `link`, `verify`, `suggestPatches`, `applyPatch`, `createSession`
* `CompileInput/CompileOptions/CompileResult` 구조 유지
* Session 관찰 API 유지: `onPhaseChange`, `onSnapshotChange`, `subscribePath`, `subscribeEvents`, `getRuntime` 등

### G2. 내부 모듈 분리 및 의존성 방향 고정

* “Types → (Pass/Linker/Verifier/Patch/LLM) → Pipeline → Session → Public Facade”의 **단방향 의존성**으로 정리.
* 순환 의존성 제거(또는 사전 차단).

### G3. 테스트 가능성/확장성 강화

* Pass/Linker/Verifier/Patch는 “입력 → 출력”이 잘 정의된 **순수 함수 경계**를 최대화.
* LLM은 `LLMAdapter`로 명시적 주입(이미 config에 존재)하고, 나머지 로직은 가능하면 결정적으로.

### G4. Studio/Agent에 적합한 Observability 구조 확립

* Session Phase 모델을 기준으로 pipeline 이벤트/스냅샷 구성 통일 (phase 목록은 이미 정의됨)

---

## 3. 비목표(Non-goals)

* 컴파일러의 기능 확장(새 Pass 추가, 새 검증 규칙 추가 등)은 “리팩터링과 동시에” 하지 않는다.
  (필요하면 **기존 기능을 그대로 옮기는 것**만)
* `@manifesto-ai/core`의 런타임/도메인 DSL을 변경하지 않는다.
* Studio UI/UX 확장(시나리오 테스트 패널 등)은 이 PRD 범위 밖.

---

## 4. 사용자/이해관계자

* **OSS 사용자**: `@manifesto-ai/compiler`를 라이브러리로 사용해 도메인 추출/검증/패치 적용을 자동화.
* **Studio 개발자(=당신 팀)**: session 기반 observability로 “왜 conflict/issue가 생겼는지” 보여줘야 함.
* **Manifestofy Agent 팀**: 컴파일러를 반복 루프에서 사용(compile → verify → patch → 재컴파일).

---

## 5. 범위(Scope)

### In Scope

* 내부 코드 구조 재편(폴더/엔트리/의존성 재정렬)
* 공용 타입의 위치 통일 및 import 경로 정리
* 단위 테스트/통합 테스트 재배치 및 보강(동작 보장 목적)
* 빌드/트리쉐이킹/번들 이슈 최소화(특히 LLM adapter 의존성)

### Out of Scope

* API naming 변경, breaking change
* 새로운 LLM provider 추가
* 새로운 패치 오퍼레이션 추가

---

## 6. 기능 요구사항(Functional Requirements)

### FR1. Compiler Facade 유지

* `ExtendedCompilerConfig`의 옵션은 유지되어야 한다:
  `coreVersion`, `effectPolicy.maxRisk`, `linker`, `verifier`, `codebook`, `llmAdapter`, `passes(useDefaults/disabled/custom)`
* `Compiler.compile()`은 `CompileInput`을 받고, `CompileResult`를 반환한다(도메인 draft, issues, conflicts, provenance 포함)

### FR2. Pass 시스템 분리

* PassRegistry/Executor는 독립 모듈로 존재해야 한다
* Built-in Pass 목록/우선순위는 유지:
  `codeAstExtractorPass(0)`, `schemaPass(100)`, `expressionLoweringPass(200)`, `effectLoweringPass(300)`, `policyLoweringPass(400)`, `actionPass(500)`, `createNLExtractorPass(900)`
* config에서 defaults on/off 및 disabled/custom pass를 조합할 수 있어야 한다

### FR3. Linker/Verifier 분리

* `link(...)`는 fragments를 받아 `LinkResult`를 만들고, conflicts/issues를 포함해야 한다
* Linker 함수군: `linkExtended`, `incrementalLink`, `buildFragmentDependencyGraph`, `detectConflicts` 등은 Linker 모듈로 묶는다
* `verify(linkResult, options?)`와 `VerifyOptions`/`VerifyResult`는 Verifier 모듈로 격리한다

### FR4. Patch/Codebook 분리

* Patch 생성/적용은 Patch 모듈로 격리: `createPatch`, `applyPatch`
* Patch operation factories 유지: `replaceExprOp`, `addDepOp`, `renamePathOp`, `chooseConflictOp` 등
* codebook(aliasing) 관련 기능은 Patch 모듈 하위(또는 submodule)로 정리 (문서상 Patch 섹션에 존재)

### FR5. LLM Adapter 분리

* OpenAI/Anthropic adapter는 별도 `llm/` 모듈로 분리하고, provider-specific 코드가 core pipeline에 스며들지 않게 한다.
* `createOpenAIAdapter(config)` / `createAnthropicAdapter(config)` 시그니처 및 옵션 유지
* Prompt building/JSON parsing/token estimation 등 유틸도 llm 모듈로 일원화

### FR6. Session/Observability 분리

* `CompilerSession`은 pipeline 실행을 감싸며, phase/snapshot/path subscription을 제공한다
* phase 목록은 유지한다: `idle/parsing/extracting/lowering/linking/verifying/repairing/done/error`

---

## 7. 비기능 요구사항(Non-functional Requirements)

### NFR1. 결정적/재현 가능한 컴파일 결과(가능한 범위에서)

* 같은 `CompileInput` + 같은 config + 같은 pass set이면, LLM을 사용하지 않는 구간은 항상 동일 output을 만든다.
* LLM이 개입되는 경우에도 provenance/prompt hash 등 추적 가능성을 제공(이미 provenance/LLM utilities가 존재)

### NFR2. 의존성 그래프 단순화

* 내부 모듈 간 순환 import 금지(코드 리뷰 체크 + lint rule 권장)

### NFR3. 번들 친화성

* LLM provider SDK 의존은 가능한 한 `llm/`에 국한 (나머지 컴파일러 기능을 브라우저/서버에서 가볍게 사용 가능하게)

---

## 8. 제안 아키텍처

### 8.1 최종 폴더 구조(안)

(“API는 그대로, 내부만 분리”를 전제로 한 **단일 패키지 내 모듈화**)

```
packages/compiler/src/
  index.ts                 # 기존 export 유지 (Facade / Barrel)
  compiler/                # createCompiler + Compiler 구현(오케스트레이션)
    createCompiler.ts
    compilerImpl.ts
  session/                 # CompilerSession + observability
    session.ts
    snapshot.ts
    events.ts
  pipeline/                # 단계(phase) 정의 + compile flow
    phases.ts              # CompilerPhase type
    compilePipeline.ts     # parsing/extracting/lowering/linking/verifying/repairing
  passes/                  # Pass system
    registry.ts
    executor.ts
    builtin/               # built-in passes (priority 유지)
      codeAstExtractorPass.ts
      schemaPass.ts
      expressionLoweringPass.ts
      effectLoweringPass.ts
      policyLoweringPass.ts
      actionPass.ts
      nlExtractorPass.ts   # createNLExtractorPass (LLM 필요)
  linker/
    link.ts
    incrementalLink.ts
    graph.ts
    conflicts.ts
  verifier/
    verify.ts
    rules/                 # cycle/type/policy/effect checks...
  patch/
    patch.ts               # Patch / PatchOp types
    ops.ts                 # replaceExprOp, addDepOp...
    applyPatch.ts
    codebook/              # aliasing + similarity
      codebook.ts
      similarity.ts
  llm/
    adapters/
      openai.ts
      anthropic.ts
    prompts/
      buildSystemPrompt.ts
      buildUserPrompt.ts
      buildMessages.ts
    utils/
      parseJSON.ts
      rateLimiter.ts
      withRetry.ts
      estimateTokens.ts
      hashPrompt.ts
  types/                   # "공용 타입" 단일 소스
    artifact.ts
    fragment.ts
    issue.ts
    conflict.ts
    compile.ts             # CompileInput/Options/Result
    provenance.ts
    domainDraft.ts
  internal/                # 외부 export 하지 않는 공용 유틸
    assert.ts
    errors.ts
    stableSort.ts
```

### 8.2 의존성 방향(강제 규칙)

이 규칙이 핵심입니다. (구조가 섞이는 걸 근본적으로 막음)

* `types/*` : 최하위. 누구나 import 가능. **types는 다른 모듈에 의존 금지**
* `llm/*` : `types`에만 의존 (pass/pipeline이 llm을 직접 import해도 되지만, “provider SDK”는 llm 밖으로 누출 금지)
* `passes/*` : `types` + (필요시) `llm`에만 의존
* `linker/*` : `types`에만 의존
* `verifier/*` : `types` + `linker`(LinkResult 구조)까지만 의존
* `patch/*` : `types`에만 의존(또는 `linker` 결과의 conflict를 patch로 바꾸는 헬퍼가 필요하면 “interface 레벨”로만)
* `pipeline/*` : passes/linker/verifier/patch를 오케스트레이션
* `session/*` : pipeline 실행 + 이벤트/스냅샷
* `compiler/*` : Facade. config를 받아 pipeline/session을 구성하고 public API를 제공

---

## 9. 타입 이동 원칙(“어떤 타입이 어디로 가야 안전한지”)

### 9.1 반드시 `types/`로 보내야 하는 것

아래는 여러 모듈이 동시에 참조하고, 한번 갈라지면 “중복 정의/순환 의존”을 만들기 쉬움.

* `Artifact`(code/text/manifesto), `Fragment`, `FragmentKind`
* `Provenance` 및 origin factories의 타입(함수는 public export이므로 별도 파일로 두고 재export 가능)
* `Issue`, `Conflict`, `Patch`, `PatchOp`, `PatchHint`
* `CompileInput`, `CompileOptions`, `CompileResult`
* `LinkResult`, `VerifyOptions`, `VerifyResult`

### 9.2 모듈 내부에 남겨도 되는 것

* Linker 내부 그래프 표현(내부 adjacency list 등), verifier rule의 내부 데이터 구조
* LLM provider-specific request/response 타입(절대 외부로 export하지 않기)

---

## 10. 공개 엔트리/Export 전략

### 10.1 외부 Entry는 그대로 유지

* `packages/compiler/src/index.ts`는 **기존 export 목록을 그대로** 제공해야 함(단, 내부 구현만 새로운 위치로 이동).

예:

* `createCompiler`는 `compiler/createCompiler.ts`에서 구현하되, `index.ts`에서 re-export
* `createPassRegistry`, `createPassExecutor`는 `passes/*`에서 구현하고 export
* `link`, `incrementalLink` 등은 `linker/*`에서 구현하고 export
* `verify`, `verifyFull`은 `verifier/*`에서 구현하고 export
* `createPatch`, `applyPatch`, patch op factories는 `patch/*`에서 구현하고 export
* `createOpenAIAdapter`, `createAnthropicAdapter`는 `llm/adapters/*`에서 구현하고 export

### 10.2 내부 “Barrel export”는 최소화

* 내부 모듈에서 `index.ts`를 남발하면 순환 의존이 다시 생기기 쉬움
* 내부는 “직접 경로 import”를 기본으로 하고, public index만 배럴로 통합

---

## 11. 단계별 실행 계획(마일스톤)

> 리팩터링 PR은 “큰 PR 1개”보다 “동작 보장 가능한 작은 PR 여러 개”가 안전합니다.

### M0. 안전장치 먼저

* 현재 `createCompiler().compile()`의 e2e 스냅샷 테스트 추가

  * 입력: sample artifacts
  * 출력: `fragments/domain/issues/conflicts/provenance` 구조 스냅샷(정렬 규칙 포함)

### M1. `types/` 모듈 신설 + 타입 이동

* 타입 파일들을 하나로 모으고, 기존 위치에서 re-export
* 빌드/테스트 통과가 목표(기능 변경 금지)

### M2. Pass 시스템 분리

* `PassRegistry`, `PassExecutor`, built-in passes 디렉토리로 이동
* 기본 pass 우선순위 유지(테스트로 고정)

### M3. Linker 분리

* `link`, `incrementalLink`, conflict detection/graph building 관련 파일 이동

### M4. Verifier 분리

* `verify`, `verifyFull`, `VerifyOptions` 적용 경로를 명확히

### M5. Patch/Codebook 분리

* patch operation factories + applyPatch + aliasing을 patch 모듈로 격리

### M6. LLM 모듈 분리

* OpenAI/Anthropic adapter 및 utilities/prompt builder를 `llm/`로 이동

### M7. Pipeline/Session 분리

* session phases 타입과 event/snapshot 구조를 pipeline과 분리
* phase 구간별 event 발행이 안정적으로 되도록 정리

### M8. 정리/문서 업데이트

* 내부 구조 설명 문서(maintainers guide)
* public API reference 자동 생성 파이프라인이 있다면 경로 업데이트

---

## 12. 수용 기준(Acceptance Criteria)

### AC1. API 호환성

* 기존 사용 코드가 타입/런타임 모두 정상 동작:

  * `createCompiler(config)` 생성 및 `compile()` 성공
  * `CompileResult` 구조 동일
  * `createSession()` + 이벤트/스냅샷 hook 정상

### AC2. 의존성 규칙 준수

* 내부 모듈 간 순환 import 0건
* `types/`는 다른 모듈 import 0건

### AC3. 테스트

* e2e 스냅샷 테스트 통과
* Pass/Linker/Verifier/Patch 각각 단위 테스트 최소 N개(각 10개 이상 권장)

### AC4. 번들/빌드

* LLM adapter를 사용하지 않는 환경에서 provider SDK가 번들에 포함되지 않도록(가능한 범위에서) 분리

---

## 13. 리스크와 완화

### R1. 리팩터링 중 동작 미세 변화

* 완화: “스냅샷 테스트 + 정렬 규칙 고정”으로 결과가 바뀌면 바로 감지

### R2. 순환 의존성 재발

* 완화: ESLint rule(`import/no-cycle`) + “types는 하위” 규칙을 CI에서 강제

### R3. LLM 의존성 누수

* 완화: provider 코드는 `llm/adapters/*` 밖으로 import 금지(리뷰 체크리스트 포함)

---

## 14. 오픈 이슈(결정 필요)

1. `effectPolicy.maxRisk`는 Verifier 옵션의 `maxEffectRisk`와 의미가 겹칠 수 있음.

   * 현재 config에 `effectPolicy.maxRisk`가 있고, verifier options에도 `maxEffectRisk`가 있음
     → 내부에서는 “config normalization 단계”에서 하나로 합치고, 외부 표면은 그대로 두는 전략이 안전.
2. `suggestPatches()`의 정책(어떤 issue/conflict를 어떤 patch로 제안할지)을 patch 모듈에 둘지, verifier 모듈에 둘지

   * 추천: “PatchHint 생성”은 patch 모듈(수정책임) / “Issue 판단”은 verifier 모듈(검증책임)

---

## 15. 부록 — 왜 이 구조가 ‘Manifestofy Agent’에 직접 도움이 되나

Agent가 하는 루프는 결국:

1. 컴파일(`compile`) → 2) 이슈/충돌 확인(`issues/conflicts`) → 3) 수정안 생성(`suggestPatches`/`createPatch`) → 4) 적용(`applyPatch`) → 5) 재링크/재검증(`link`/`verify`)
   이 흐름 자체가 이미 공개 API에 들어있습니다.
   내부가 분리되면, “Agent용 최소 컨텍스트/최소 실행 단위”를 만들기가 훨씬 쉬워집니다(특히 verifier와 patch가 순수 함수로 정리되면).
