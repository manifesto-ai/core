# PRD: `@manifesto-ai/compiler`

문서 버전: v0.1 (Draft)
작성일: 2025-12-16
상태: Draft / MVP 범위 확정용

## 참고문서

### 에이전트 작업 이행 필수 사항

* [에이전트 작업 이행 가이드](./AGENT_README.md)

### Manifesto Core 관련 문서
* [Manifesto Core Overview](../core/en/01-overview.md)
* [Manifesto Semantic Path](../core/en/02-semantic-path.md)
* [Manifesto Domain Definition](../core/en/03-domain-definition.md)
* [Manifesto Expression DSL](../core/en/04-expression-dsl.md)
* [Manifesto Effect System](../core/en/05-effect-system.md)
* [Manifesto DAG Propagation](../core/en/06-dag-propagation.md)
* [Manifesto Runtime](../core/en/07-runtime.md)
* [Manifesto Policy](../core/en/08-policy.md)
* [Manifesto Schema Validation](../core/en/09-schema-validation.md)
* [Manifesto Migration Guide](../core/en/10-migration-guide.md)
* 

---

## 1. 배경과 문제 정의

### 1.1 배경

Manifesto Core는 “AI Native Semantic Layer”로서, SaaS 애플리케이션의 비즈니스 로직을 **AI가 읽고 이해하고 안전하게 조작**할 수 있는 **선언적 데이터 구조**로 표현한다.

Manifesto Core의 핵심은:

* **SemanticPath**로 모든 값에 주소를 부여하고
* **Expression DSL**로 로직을 JSON 기반 AST로 표현하며(직렬화/분석 가능)
* **Effect**를 “실행 코드”가 아니라 “무엇을 할지”의 **설명 데이터**로 만들고
* `deps` 기반 **DAG 전파**와 `validateDomain` 같은 정적 검증을 통해 결정론적 실행을 보장한다.

### 1.2 문제

현재 수요:

* “Manifesto를 쓰고 싶다”는 사용자는 많지만,
* **작성 난이도**(개념 밀도, AST/Policy/DAG 등) 때문에 “도입/학습/수정”이 느리고 어렵다.

특히 사용자 관점에서 가장 큰 pain point는:

1. 자연어 요구사항/기존 코드/부분 코드 조각을 **Manifesto 형태로 빠르게 변환**하고 싶다
2. 전체 도메인을 다시 만들지 않고, 특정 구문(예: `if (...) { ... }`)만 **정확히 표출/수정/재조립**하고 싶다
3. 변환(컴파일) 과정이 블랙박스가 아니라, **어떤 단계에서 무엇을 했고 무엇이 남았고 왜 막혔는지**를 투명하게 보고 싶다 (컴파일러 런타임의 관측 가능성)

### 1.3 핵심 요구사항(요약)

* 도메인 특화 템플릿에 기대지 않고 **도메인-불가지(domain-agnostic)**로 작동
* **작은 LLM 모델에서도** 깨지지 않도록 “자유도 낮은 IR + 결정론적 검증/수정 루프”
* `defineDomain` 뿐 아니라 **statement/expression/effect 단위**로 컴파일 산출물을 제공
* 컴파일러의 각 파트(스키마/derived/action/effect/policy)가 **전문 컴파일러로 분리**되고, 산출물을 **자유롭게 컴포징**(linking) 가능
* “부분 수정”을 최적화: Fragment/ Patch-first workflow
* 컴파일러 진행을 Manifesto 런타임 기반으로 **투명하게 관측**(progress, blockers, next steps, conflicts, logs)

---

## 2. 제품 비전

`@manifesto-ai/compiler`는 다음을 제공하는 **범용 Manifestify 컴파일러**다.

> 자연어/코드/부분 구문을 입력으로 받아
> “Manifesto Fragment(조각)”들을 생성하고,
> 결정론적 Linker/Verifier로 합쳐 유효한 Manifesto Domain을 만들며,
> 전체 과정을 “관측 가능한 컴파일러 런타임”으로 노출한다.

---

## 3. 목표와 비목표

### 3.1 목표(Goals)

1. **Fragment 기반 컴파일**

    * statement/expression/effect/policy/derived/action/schema 조각을 개별적으로 산출
2. **Composable Compiler**

    * 여러 전문 컴파일러(pass) 산출물을 Linker가 병합해 최종 Domain 생성
3. **Patch-first Editing**

    * 사용자가 “원하는 조각만” 수정하면 해당 조각만 재컴파일/재링크/재검증
4. **Deterministic Verification & Repair Loop**

    * `validateDomain` 이슈 코드(예: `MISSING_DEPENDENCY`, `CIRCULAR_DEPENDENCY`) 기반으로 부분 패치 유도
5. **투명한 컴파일러 런타임(Observability)**

    * 컴파일 상태, 남은 작업, blocker, conflicts, 로그/메트릭을 Snapshot으로 관측
6. **도메인-불가지(범용) 입력 지원**

    * 특정 산업/업무 도메인 템플릿 강제 없이 작동
7. **Small-model friendly**

    * “한 방에 defineDomain 생성” 대신 단계적 IR/fragment 생성 + 검증/수정 루프

### 3.2 비목표(Non-goals, MVP)

* IDE/GUI 에디터 자체를 본 패키지에서 완성(단, UI가 붙을 수 있는 API는 제공)
* 모든 언어/프레임워크 코드 지원(초기에는 JS/TS 중심, 확장 가능)
* “의미를 완벽히 자동 추론” (환각 0% 목표 아님)
  → 대신 “증거/근거(provenance) 강제 + 검증기 중심”으로 제품 품질 확보

---

## 4. 사용자/페르소나

1. **Product/Domain Owner**

    * 자연어 PRD를 주고 빠르게 “도메인 로직”을 얻고 싶음
    * 에러/막힘이 발생하면 “왜”를 보고 직접 수정하고 싶음

2. **Frontend/Backend Engineer**

    * 기존 코드 일부를 Manifesto로 옮기고 싶음
    * 전체 변환이 아니라 특정 구문(검증 조건/disabled 조건/if 분기)만 빠르게 바꾸고 싶음

3. **Agent Builder**

    * LLM이 Manifesto를 “직접 작성/수정”하게 하고 싶음
    * 도메인 정의의 안정성/안전성/재현성이 중요

---

## 5. 핵심 사용자 시나리오

### 시나리오 A: 자연어 → Fragment → Domain

* 입력: PRD(자연어), 규칙 목록, 예시
* 출력: SchemaFragment + DerivedFragment + PolicyFragment + ActionFragment
* 사용자는 “결제 가능 조건” 조각만 수정하고 싶음
* 수정 후: 해당 조각만 재컴파일 → Linker → Verifier → 통과

### 시나리오 B: 코드 일부 선택 → “그 구문만” Manifestify

* 입력: 사용자가 선택한 코드 스니펫

  ```js
  if (hello > 10) {
    doHello()
  }
  ```
* 출력:

    * ExpressionFragment(`hello > 10`),
    * Statement/EffectFragment(ConditionalEffect),
    * 필요 시 ActionFragment로 래핑(옵션)

Manifesto의 Effect는 조건 분기(ConditionalEffect)를 데이터 구조로 표현 가능하므로, `if`를 “구문 조각”으로 직접 표출할 수 있다.

### 시나리오 C: 충돌/불일치 발생 → “작업 항목”으로 해결

* 여러 컴파일러가 동일 path를 제공(예: `derived.canCheckout`)
* Linker는 실패하지 않고:

    * `conflicts[]`를 생성
    * `nextSteps[]`에 “선택/병합/삭제” 같은 해결 action을 노출
* 사용자는 UI/CLI에서 선택 → Patch 생성 → 재링크

### 시나리오 D: 컴파일 과정 관측(투명성)

* 사용자는 “지금 어떤 단계인지”, “남은 작업”, “blocker”를 보고 싶음
* 컴파일러 런타임은:

    * phase 전환
    * 현재 이슈 목록
    * 추천 수정 사항(패치)
    * 로그/메트릭 이벤트
      를 snapshot/subscribe로 제공

Manifesto Runtime은 path 구독과 이벤트 채널 구독을 제공하므로, “컴파일러 진행 UI”를 만들 수 있다.

---

## 6. 제품 범위(기능 요구사항)

## 6.1 입력(Input) 형태

* `NaturalLanguageArtifact`

    * markdown/plain text
    * 구조화된 bullet list / table도 포함
* `CodeArtifact`

    * JS/TS 코드(부분 스니펫 포함)
    * origin span 정보(파일명/라인/컬럼 또는 raw index)
* `ManifestoArtifact`

    * 기존 도메인 정의(도메인 일부/fragment)
* `UserEdits`

    * 사용자가 직접 수정한 fragment/patch

> 중요: “선택한 코드/문장만 컴파일”이 반드시 가능해야 함.

---

## 6.2 출력(Output) 형태

### 6.2.1 Primary: Fragment Set

* 다양한 종류의 Fragment 리스트(조각)
* 각 fragment는 “requires/provides/origin”을 가진다 (아래 6.3)

### 6.2.2 Secondary: Linked Domain

* Fragment → Linker 병합 → `ManifestoDomain`(또는 defineDomain TS 코드/JSON)

### 6.2.3 Compile Report

* verification issues (`validateDomain` 호환)
* conflicts
* patch hints
* provenance report(어떤 입력에서 무엇이 나왔는지)

### 6.2.4 Compiler Runtime Snapshot

* 컴파일 진행/상태/남은 작업/추천 액션을 snapshot으로 제공
* UI/CLI/Agent가 동일한 정보로 동작 가능

---

## 6.3 Fragment 모델 (핵심)

### 6.3.1 공통 필드

모든 Fragment는 아래 메타를 가진다:

* `id: FragmentId` (stable)
* `kind: FragmentKind`
* `requires: SemanticPath[]` (읽는 값)
* `provides: SemanticPath[]` (정의/산출하는 값)
* `origin: Provenance`

    * 자연어: 문단/문장/토큰 범위
    * 코드: 파일/AST node/span
* `evidence: Evidence[]`

    * “왜 이렇게 컴파일했는지” 근거(문장, 코드 라인, 규칙)
* `confidence?: number`
* `version: CompilerVersion`
* `tags?: string[]`

SemanticPath는 `data.*`, `derived.*`, `state.*` 같은 prefix 규칙이 있고, 이를 기반으로 Linker/Verifier가 경로 정규화/검증을 수행한다.

### 6.3.2 Fragment 종류(MVP)

* `SchemaFragment`

    * dataSchema/stateSchema의 일부(필드 단위)
* `SourceFragment`

    * `defineSource` 후보(semantic/policy 포함 가능)
* `ExpressionFragment`

    * Expression DSL AST (예: if 조건, derived expr)
* `DerivedFragment`

    * `defineDerived` 정의(semantic 포함)
* `PolicyFragment`

    * preconditions / fieldPolicy(ConditionRef 리스트)
* `EffectFragment`

    * Effect AST (sequence, conditional 등)
    * 주의: effect는 실행이 아니라 “설명”이고 실행은 `runEffect()` 호출 시 발생한다.
* `ActionFragment`

    * action id + preconditions + effect 조립

### 6.3.3 Stable ID 정책(필수)

“부분 수정 UX”를 위해 fragment id는 다음 조건을 만족해야 한다:

* 코드/문장이 이동해도 최대한 유지
* 최소한 “동일 의미/동일 구조”일 때 동일 id 유지

권장:
`stableId = hash(normalizedOriginAstOrText + semanticSignature(requires/provides + kind))`

---

## 6.4 Compiler Pass(전문 컴파일러) 아키텍처

### 6.4.1 목표

* `defineDomain` “전체 생성”이 아니라,
  **각 책임별 컴파일러가 fragment를 생성**하고, 이를 Linker가 조립한다.

### 6.4.2 Pass 인터페이스(안)

* `Pass`는 입력/출력/의존성을 명시:

    * `supports(inputType)`
    * `analyze(input) -> Finding[]`
    * `compile(findings, context) -> Fragment[]`
    * `priority` / `dependsOnPasses` (optional)
* Pass 결과는 “추가”만 하고, 삭제/수정은 Patch로 처리(감사/추적 가능)

### 6.4.3 Pass 예시

* `nl-extractor-pass`
* `code-ast-extractor-pass`
* `expression-lowering-pass` (자연어/코드 조건 → Expression DSL)
* `effect-lowering-pass` (호출/절차 → Effect AST)
* `policy-lowering-pass`
* `schema-pass`
* `action-pass`

> 작은 모델에서 안정성을 위해, “LLM이 고자유도 출력을 만들지 않게” 하고, Pass별로 출력 포맷을 매우 제한한다.

---

## 6.5 Linker (Deterministic Composition Engine)

### 6.5.1 책임

* fragments를 병합해 **일관된 ManifestoDomain**을 생성
* 충돌을 자동으로 뭉개지 않고 `conflicts[]`로 표출
* deps/path/schema의 정합성을 최대한 자동 보정

### 6.5.2 Link 규칙 (핵심)

1. **경로 정규화**

    * `hello` → `data.hello` 같은 prefix inference(규칙 기반)
2. **deps 자동 생성/보정**

    * Expression DSL은 정적 분석이 가능하므로, `analyzeExpression`로 directDeps를 추출해 deps 누락을 자동 보정한다.
3. **Schema 병합**

    * SchemaFragment를 합쳐 `dataSchema/stateSchema`를 구성
4. **충돌 탐지**

    * 같은 `provides`(예: `derived.total`)를 여러 fragment가 제공할 때 conflict 생성
5. **정책/액션 조립**

    * PolicyFragment + EffectFragment → ActionFragment로 자동 래핑 가능(옵션)

### 6.5.3 Conflict 모델

* `Conflict`

    * `target: SemanticPath | actionId | schemaField`
    * `candidates: FragmentId[]`
    * `type: 'duplicate_provides' | 'schema_mismatch' | 'semantic_mismatch' | 'effect_incompatible' | ...`
    * `recommendedResolutions: PatchHint[]`

---

## 6.6 Verifier (Static + Runtime-aided)

### 6.6.1 정적 검증(필수)

* `validateDomain()` 결과를 그대로 활용

    * `CIRCULAR_DEPENDENCY`, `MISSING_DEPENDENCY`, `INVALID_PATH`, `SCHEMA_MISMATCH` 등 표준 코드 제공.
* DAG 기반 순환/정렬 검증

    * `topologicalSortWithCycleDetection`, `hasCycle` 등으로 사이클 탐지 가능.

### 6.6.2 Runtime-aided 검증(권장, MVP 포함)

* “부분 수정” 후 영향 범위를 즉시 보여주는 기능:

    * Runtime의 `getImpact(path)`로 영향 경로를 반환 가능.
* “왜 이렇게 계산됐는지”를 사용자/AI가 확인:

    * Runtime의 `explain(path)`는 ExplanationTree를 제공한다.

---

## 6.7 Repair Loop (Patch-first)

### 6.7.1 왜 Patch-first인가

사용자는 “전체 재생성”이 아니라,

* “저 조건만 10→5”
* “이 precondition 하나만 삭제”
* “이 derived의 expr만 수정”
  같은 **국소 수정**을 원한다.

### 6.7.2 Patch 모델 (MVP)

* `PatchOp`:

    * `replaceExpr(targetPath, newExpr)`
    * `addDep(targetDerived, depPath)`
    * `renamePath(from, to)`
    * `removeFragment(fragmentId)`
    * `chooseConflict(conflictId, chosenFragmentId)`
    * `updateSchema(fieldPath, zodOrJsonSchemaLike)`
* Patch는 항상:

    * `origin`(누가/무엇이 만들었는지)
    * `reason`(왜 하는지)
    * `appliesToVersion`
      를 가진다.

### 6.7.3 PatchHint 생성

* `validateDomain`의 issue.suggestedFix(있는 경우)와 함께
* 컴파일러가 “부분 수정 명령”으로 변환해 LLM/사용자에게 제공

---

## 6.8 Compiler Runtime 투명성 (Manifesto로 모델링)

### 6.8.1 컨셉

컴파일러 자체를 하나의 Manifesto 도메인으로 모델링한다.
그러면:

* 상태가 snapshot으로 남고
* path 구독으로 UI/Agent가 실시간 관측하고
* 이벤트 채널로 로그/메트릭 스트림을 보낼 수 있다.

### 6.8.2 Compiler Domain (안)

* `data.input.*`

    * artifacts, selection, user intent
* `data.ir.*`

    * fragments, linkedDomain, patches
* `data.verify.*`

    * issues[], conflicts[]
* `state.phase`

    * `idle | parsing | extracting | lowering | linking | verifying | repairing | done | error`
* `state.progress`

    * stage index, message
* `derived.blockers`

    * severity=error issues + unresolved conflicts
* `derived.nextSteps`

    * 실행 가능한 “다음 action”(예: `applyPatch`, `resolveConflict`, `exportDomain`)
* `events.log`

    * emitEvent 기반(스냅샷에 저장하지 않음)

---

## 6.9 안전/거버넌스 (MVP 필수 최소)

Effect는 “설명”이지만 handler에 연결되면 실행된다.
따라서 MVP에서도 최소한 아래가 필요:

* Effect risk level:

    * `low | medium | high`
* 실행 승인 정책:

    * `high`는 기본적으로 “HITL 승인 없이는 run 금지”
* handler allowlist:

    * apiCall endpoint allowlist / method allowlist
* provenance 강제:

    * “이 effect는 어떤 입력 근거에서 생성되었는가?”가 항상 남아야 함

---

## 7. 비기능 요구사항

### 7.1 결정론/재현성

* Linker/Verifier/Runtime 검증은 **완전 결정론적**
* LLM이 개입하는 구간은 반드시 “산출물(fragment/patch)”로 저장(재현 가능)
* 동일 artifact+same fragments+same patches → 동일 domain 결과

### 7.2 성능

* 부분 수정 시 전체 컴파일을 다시 돌리지 않고:

    * 변경된 fragment가 `provides`하는 경로만 다시 링크/검증
    * 영향 범위는 DAG 기반으로 최소화 가능

### 7.3 확장성

* Pass/plugin 등록 구조
* 새로운 언어 입력, 새로운 패턴(예: SQL, YAML rules) 추가 가능

### 7.4 호환성

* `@manifesto-ai/core` 버전 변경에 대응할 수 있도록:

    * core의 검증 이슈 타입/런타임 API 변경을 버전 게이트로 관리(마이그레이션 가이드 참고)

---

## 8. 패키지 API(외부 노출) 제안

### 8.1 상위 API

* `createCompiler(config): Compiler`

    * config: pass registry, core version, policy, allowlist, llm adapter(선택)
* `compiler.compile(input, options): CompileResult`

    * options: selection, incremental, targetOutput(`fragments` | `domain` | `both`)
* `compiler.compileFragments(input, selection?): Fragment[]`
* `compiler.link(fragments, patches?): LinkResult`
* `compiler.verify(domainOrLinkResult): VerifyResult`
* `compiler.suggestPatches(issues/conflicts): PatchHint[]`
* `compiler.applyPatch(fragmentsOrDomain, patch): ApplyPatchResult`
* `compiler.createRuntimeSession(): CompilerRuntimeSession`

    * 내부적으로 “Compiler Domain Runtime” 생성
    * UI/CLI/Agent가 subscribe 가능

### 8.2 타입(요약)

* `Artifact`, `Finding`, `Fragment`, `Conflict`, `Issue`, `Patch`, `PatchHint`
* `CompileResult`:

    * `fragments`, `domain?`, `issues`, `conflicts`, `runtimeSnapshot?`, `provenance`

---

## 9. 성공 지표(Success Metrics)

MVP 성공 판정 기준(정량/정성):

1. **Time-to-first-valid-domain**

    * 입력 제공 후 “validateDomain 통과 domain”까지 걸리는 시간
2. **Partial Edit Latency**

    * fragment 하나 수정 → 링크+검증+리포트까지 1~2초 내(환경에 따라)
3. **Small-model robustness**

    * 작은 모델을 써도 “fragment 단위” 성공률이 높고,
    * 실패 시 verifier→patch hint로 복구 가능
4. **투명성 만족도**

    * 사용자 설문: “왜 실패했는지 알겠다/고칠 수 있다” 비율
5. **충돌 해결 UX**

    * conflict가 발생해도 “진행이 멈추지 않고” 작업 목록으로 해결 가능

---

## 10. MVP 단계별 로드맵(제안)

### Phase 0 — Core Integrations

* Fragment 타입/Provenance/StableId 도입
* validateDomain/DAG/runtime explain/getImpact 연동

### Phase 1 — Fragment Compiler MVP

* NL → Expression/Policy/Schema 조각 생성(출력 포맷 강제)
* Code snippet → AST 추출 → if/assignment/call을 Effect/Expr로 lowering
  (if는 ConditionalEffect로)

### Phase 2 — Linker/Conflict/Patch-first

* deterministic linker + conflict detection
* patch apply + incremental relink/verify

### Phase 3 — Compiler Runtime (Observability)

* 컴파일러 도메인(runtime) 제공
* UI/CLI/Agent가 subscribeEvents/subscribePath로 상태/로그 관측

---

## 11. 리스크와 대응

1. **Stable ID 불안정 → 사용자가 수정한 조각이 “사라지는” 문제**

    * origin span만 의존 금지, 구조 기반 stable hash + heuristic rename/move

2. **충돌 해결이 “에러로 종료”되면 UX 붕괴**

    * conflict는 “상태”로 남기고 nextSteps로 해결 가이드 제공

3. **deps 누락/경로 오타가 잦음**

    * Expression 분석으로 deps 자동 생성/보정(LLM에게 deps 작성 금지)

4. **Effect 실행 위험**

    * allowlist + risk 등급 + HITL gate(최소 MVP부터)

---

## 12. 오픈 이슈(결정 필요)

* “코드에서 doHello() 같은 호출”을 Effect로 모델링할 때:

    * 기본은 `emitEvent`로 추상화할지, `apiCall`/`navigate` 등 구체 builder로 내릴지
* “Action으로 래핑” 기준:

    * 사용자가 구문만 원하면 EffectFragment로 끝
    * 실행/버튼 의미가 필요하면 ActionFragment로 래핑(옵션)
* JSON Schema 병행 여부(UI/저장/전송 목적):

    * 내부는 Zod 유지, 외부는 JSON Schema projection(별도 패키지로 분리 가능)

---

## 요약(한 문장)

`@manifesto-ai/compiler`의 MVP는 **도메인 불가지 입력**을 **Fragment 단위로 컴파일**하고, **결정론적 Linker/Verifier/Patch**로 품질을 보장하며, 그 전 과정을 **Manifesto Runtime으로 투명하게 관측**할 수 있게 만드는 것이다.

-
