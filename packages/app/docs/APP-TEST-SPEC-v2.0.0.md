# App v2 SPEC/FDR 테스트 규격

> **Version:** 0.1.0  
> **Status:** Draft  
> **Date:** 2026-01-20  
> **Scope:** App v2 구현의 SPEC/FDR 정합성 검증

---

## 1. 범위와 참조

### 1.1 범위

- App v2 퍼블릭 API, 실행/거버넌스 연동, 브랜치/세션/훅/메모리/시스템 런타임을 포함한다.
- Core/World 내부 구현은 직접 테스트하지 않지만, App↔World/Host 계약 정합성은 포함한다.

### 1.2 참조 문서

- `packages/app/docs/v2/APP-SPEC-v2.0.0.md`
- `packages/app/docs/v2/FDR-APP-PUB-001-v0.3.0.md`
- `packages/app/docs/v2/FDR-APP-RUNTIME-001-v0.2.0.md`
- `packages/app/docs/v2/FDR-APP-INTEGRATION-001-v0.4.0.md`
- `packages/app/docs/v2/FDR-APP-POLICY-001-v0.2.3.md`
- `packages/app/docs/v2/FDR-APP-EXT-001-v0.4.0.md`
- `packages/world/docs/world-SPEC-v2.0.2.md` (WorldId, hash, restore 규칙)

---

## 2. 테스트 레벨과 공통 전제

### 2.1 테스트 레벨

- **Unit:** App 내부 컴포넌트의 순수 로직 (BranchManager, PolicyService 등)
- **Integration:** App + HostExecutor + WorldStore + MemoryStore 상호작용
- **Contract:** Host/World 경계 규칙, 결과 구조(ArtifactRef 등)
- **Determinism/Replay:** 동일 입력 → 동일 결과, replay 시 메모리 재조회 금지

### 2.2 공통 전제/도구

- Fake timers 사용 (시간 의존성 제거)
- Random seed 고정 (determinism 보장)
- HostExecutor/WorldStore/MemoryStore는 테스트 더블로 교체 가능해야 함
- Hook/Plugin은 side effect 없이 관찰만 수행

---

## 3. 테스트 케이스 규격

각 테스트 케이스는 다음 형식을 따른다.

- **ID:** TC-APP-<영역>-<번호>
- **Refs:** SPEC/FDR Rule ID
- **Level:** Minimal / Standard / Full
- **Type:** Unit / Integration / Contract / Determinism
- **Steps:** 절차
- **Expected:** 기대 결과

---

## 4. 테스트 케이스

### 4.1 Boundary & API

#### TC-APP-BOUNDARY-01: Core 내부 의존 금지
- **Refs:** APP-BOUNDARY-1
- **Level:** Minimal
- **Type:** Contract
- **Steps:** App 코드에서 Core 내부 모듈 경로(import) 스캔
- **Expected:** 금지된 내부 모듈 경로가 0건

#### TC-APP-BOUNDARY-02: World 거버넌스 수정 금지
- **Refs:** APP-BOUNDARY-2
- **Level:** Minimal
- **Type:** Contract
- **Steps:** App이 World 거버넌스 API를 호출/수정하는 코드 경로 존재 여부 확인
- **Expected:** World 거버넌스에 대한 직접 접근/수정 없음

#### TC-APP-BOUNDARY-03: HostExecutor 우회 금지
- **Refs:** APP-BOUNDARY-3
- **Level:** Minimal
- **Type:** Integration
- **Steps:** 실행 경로에서 HostExecutor만 호출되도록 계측
- **Expected:** HostExecutor 외 경로로 실행/IO가 발생하지 않음

#### TC-APP-BOUNDARY-04: Host/WorldStore 주입
- **Refs:** APP-BOUNDARY-4
- **Level:** Minimal
- **Type:** Integration
- **Steps:** HostExecutor/WorldStore 미주입 상태로 `ready()` 호출
- **Expected:** 명시적 오류로 실패하거나, 주입이 필수임을 보장

#### TC-APP-API-01: App 인터페이스 구현
- **Refs:** APP-API-1
- **Level:** Minimal
- **Type:** Contract
- **Steps:** App 인스턴스의 필수 API 존재 여부 점검
- **Expected:** SPEC 요구 API 전부 구현

#### TC-APP-API-02: ready 이전 API 차단
- **Refs:** APP-API-2, READY-1
- **Level:** Minimal
- **Type:** Unit
- **Steps:** `ready()` 이전에 read/mutation API 호출
- **Expected:** `AppNotReadyError`

#### TC-APP-API-03: act() 동기 핸들 반환
- **Refs:** APP-API-3, HANDLE-1
- **Level:** Standard
- **Type:** Unit
- **Steps:** `act()` 호출 직후 반환값 확인
- **Expected:** 즉시 `ActionHandle` 반환

#### TC-APP-API-04: submitProposal() 결과 타입
- **Refs:** APP-API-4
- **Level:** Standard
- **Type:** Unit
- **Steps:** `submitProposal()` 호출
- **Expected:** `ProposalResult` 반환

#### TC-APP-API-05: Host/World 인스턴스 노출 금지
- **Refs:** APP-API-5
- **Level:** Minimal
- **Type:** Contract
- **Steps:** App 퍼블릭 API 표면에 Host/World 객체 노출 여부 검사
- **Expected:** 직접 참조 없음

#### TC-APP-API-06: getDomainSchema()는 현재 브랜치 기준
- **Refs:** APP-API-6, SCHEMA-1, SCHEMA-6
- **Level:** Standard
- **Type:** Integration
- **Steps:** 서로 다른 스키마로 fork 후 `switchBranch()` 수행
- **Expected:** 현재 브랜치 스키마로 변경됨

---

### 4.2 Lifecycle & Ready

#### TC-APP-LC-01: 초기 상태는 created
- **Refs:** APP-LC-1, LC-1
- **Level:** Minimal
- **Type:** Unit
- **Steps:** `createApp()` 직후 상태 확인
- **Expected:** `status === 'created'`

#### TC-APP-LC-02: ready() 필수
- **Refs:** APP-LC-2, READY-1, LC-2
- **Level:** Minimal
- **Type:** Unit
- **Steps:** `ready()` 전 주요 API 호출
- **Expected:** `AppNotReadyError`

#### TC-APP-LC-03: dispose()는 실행 드레인 후 종료
- **Refs:** APP-LC-3, LC-3
- **Level:** Standard
- **Type:** Integration
- **Steps:** 실행 중인 action이 있을 때 `dispose()` 호출
- **Expected:** 실행 종료 후 dispose 완료

#### TC-APP-LC-04: dispose 이후 신규 실행 금지
- **Refs:** APP-LC-4, LC-4
- **Level:** Minimal
- **Type:** Unit
- **Steps:** `dispose()` 이후 `act()` 호출
- **Expected:** `AppDisposedError`

#### TC-APP-LC-05: 플러그인 오류 격리
- **Refs:** APP-LC-5, PLUGIN-3
- **Level:** Full
- **Type:** Integration
- **Steps:** 플러그인 초기화 중 예외 발생
- **Expected:** 오류가 외부로 전달되며 App 상태 오염 없음

#### TC-APP-READY-01: system.* 액션 차단
- **Refs:** READY-4, INV-10, INV-11
- **Level:** Minimal
- **Type:** Unit
- **Steps:** `system.*` 액션 포함 스키마로 `ready()` 호출
- **Expected:** `ReservedNamespaceError`

#### TC-APP-READY-02: 스키마 해석 선행
- **Refs:** READY-6, PLUGIN-1
- **Level:** Full
- **Type:** Integration
- **Steps:** 플러그인에서 `getDomainSchema()` 호출
- **Expected:** 이미 해석/캐시된 스키마 반환

---

### 4.3 Schema & Compatibility

#### TC-APP-SCHEMA-01: getDomainSchema() 캐시 보장
- **Refs:** SCHEMA-1, SCHEMA-4
- **Level:** Standard
- **Type:** Unit
- **Steps:** 동일 브랜치에서 반복 호출
- **Expected:** 동일 인스턴스(동일 schemaHash)

#### TC-APP-SCHEMA-02: not ready 시 오류
- **Refs:** SCHEMA-2
- **Level:** Minimal
- **Type:** Unit
- **Steps:** `ready()` 전 `getDomainSchema()` 호출
- **Expected:** `AppNotReadyError`

#### TC-APP-SCHEMA-03: resolved 이후 undefined 금지
- **Refs:** SCHEMA-3
- **Level:** Standard
- **Type:** Unit
- **Steps:** `ready()` 후 `getDomainSchema()` 반환 확인
- **Expected:** undefined가 아님

#### TC-APP-SCHEMA-04: MEL 텍스트 해석
- **Refs:** SCHEMA-5
- **Level:** Standard
- **Type:** Integration
- **Steps:** MEL 텍스트 스키마로 초기화 후 `getDomainSchema()`
- **Expected:** 컴파일 결과 반환

#### TC-APP-SCHEMA-05: 브랜치 전환 시 스키마 교체
- **Refs:** SCHEMA-6
- **Level:** Standard
- **Type:** Integration
- **Steps:** 다른 schemaHash 가진 브랜치로 `switchBranch()`
- **Expected:** 새 스키마 반환

#### TC-APP-FORK-01: fork(domain) 새 런타임 생성
- **Refs:** FORK-1, BRANCH-6
- **Level:** Full
- **Type:** Integration
- **Steps:** `fork({ domain: newSchema })`
- **Expected:** 새로운 runtime/branch 생성

#### TC-APP-FORK-02: effect handler 호환성 검사
- **Refs:** FORK-2
- **Level:** Full
- **Type:** Integration
- **Steps:** 필수 effect 누락 스키마로 fork
- **Expected:** fork 실패

#### TC-APP-FORK-03: 누락 effect 시 World 생성 금지
- **Refs:** FORK-3, INV-6
- **Level:** Full
- **Type:** Integration
- **Steps:** 누락 effect 스키마 fork 시도
- **Expected:** World/lineage 변화 없음

---

### 4.4 Branch

#### TC-APP-BRANCH-01: 기본 브랜치 존재
- **Refs:** BRANCH-1
- **Level:** Standard
- **Type:** Unit
- **Steps:** `ready()` 후 브랜치 목록 조회
- **Expected:** `main` 기본 브랜치 존재

#### TC-APP-BRANCH-02: currentBranch() 정확성
- **Refs:** BRANCH-2
- **Level:** Standard
- **Type:** Unit
- **Steps:** `switchBranch()` 후 `currentBranch()`
- **Expected:** 활성 브랜치 반환

#### TC-APP-BRANCH-03: fork() 브랜치 생성
- **Refs:** BRANCH-3
- **Level:** Standard
- **Type:** Integration
- **Steps:** 특정 World 기준 fork
- **Expected:** 새 브랜치 head가 지정 World

#### TC-APP-BRANCH-04: switchBranch() 포인터 갱신
- **Refs:** BRANCH-4
- **Level:** Standard
- **Type:** Unit
- **Steps:** `switchBranch()` 호출
- **Expected:** 현재 브랜치 포인터 변경

#### TC-APP-BRANCH-05: 완료 실행 후 head 갱신
- **Refs:** BRANCH-5
- **Level:** Standard
- **Type:** Integration
- **Steps:** 성공 실행 완료 후 head 확인
- **Expected:** head가 완료 World로 이동

#### TC-APP-BRANCH-06: 실패 World에 head 금지
- **Refs:** BRANCH-7
- **Level:** Standard
- **Type:** Integration
- **Steps:** 실패 실행 발생
- **Expected:** head 유지, 실패 World는 lineage에만 존재

---

### 4.5 Session

#### TC-APP-SESS-01: session actorId 바인딩
- **Refs:** SESS-1, SESS-2
- **Level:** Standard
- **Type:** Integration
- **Steps:** session 생성 후 `session.act()` 호출
- **Expected:** 요청 actorId가 세션 actorId로 고정

#### TC-APP-SESS-02: opts.actorId 금지
- **Refs:** SESS-ACT-1
- **Level:** Standard
- **Type:** Unit
- **Steps:** `session.act()`에 actorId 전달
- **Expected:** 오류 또는 무시(금지 규칙 준수)

#### TC-APP-SESS-03: opts.branchId 금지(바인딩 시)
- **Refs:** SESS-ACT-2
- **Level:** Standard
- **Type:** Unit
- **Steps:** branchId 바인딩 세션에서 `session.act({ branchId })`
- **Expected:** 오류 또는 무시(금지 규칙 준수)

#### TC-APP-SESS-04: actor 바인딩 불변
- **Refs:** SESS-ACT-4
- **Level:** Standard
- **Type:** Unit
- **Steps:** 세션 수명 동안 act 여러 번 호출
- **Expected:** actorId 변하지 않음

---

### 4.6 Action Handle

#### TC-APP-HANDLE-01: completed() 터미널 동기화
- **Refs:** HANDLE-2
- **Level:** Standard
- **Type:** Integration
- **Steps:** `completed()` 대기 후 terminal 상태 확인
- **Expected:** terminal 상태에서 resolve

#### TC-APP-HANDLE-02: phase 반영
- **Refs:** HANDLE-3
- **Level:** Standard
- **Type:** Unit
- **Steps:** 단계별 상태 확인
- **Expected:** 실제 phase와 일치

#### TC-APP-HANDLE-03: onPhase 트리거
- **Refs:** HANDLE-4
- **Level:** Standard
- **Type:** Unit
- **Steps:** `onPhase` 등록 후 실행
- **Expected:** 각 phase 전이마다 호출

#### TC-APP-HANDLE-04: cancel 전/후 규칙
- **Refs:** HANDLE-5, HANDLE-6
- **Level:** Standard
- **Type:** Integration
- **Steps:** 준비 단계와 실행 이후 cancel 호출
- **Expected:** 준비 전 cancel 동작, 실행 후 no-op

#### TC-APP-HANDLE-05: preparation_failed 결과
- **Refs:** HANDLE-7, HANDLE-8
- **Level:** Standard
- **Type:** Integration
- **Steps:** 준비 실패 유도
- **Expected:** `completed()`가 `status: 'preparation_failed'`로 resolve, World 참조 없음

#### TC-APP-HANDLE-06: proposalId 선할당
- **Refs:** HANDLE-9
- **Level:** Standard
- **Type:** Unit
- **Steps:** preparing phase에서 proposalId 확인
- **Expected:** 선할당된 proposalId 존재

#### TC-APP-HANDLE-07: preparation_failed 시 proposalId 유지
- **Refs:** HANDLE-10
- **Level:** Standard
- **Type:** Integration
- **Steps:** preparation_failed 상황 발생
- **Expected:** 결과에 동일 proposalId 유지

---

### 4.7 Hooks

#### TC-APP-HOOK-01: Hook은 관찰 전용
- **Refs:** HOOK-1, HOOK-2
- **Level:** Standard
- **Type:** Integration
- **Steps:** Hook에서 Snapshot/World 수정 시도
- **Expected:** 변경이 반영되지 않음

#### TC-APP-HOOK-02: Hook 오류 격리
- **Refs:** HOOK-3
- **Level:** Standard
- **Type:** Integration
- **Steps:** Hook에서 예외 발생
- **Expected:** 실행 흐름 유지, 오류 전파 없음

#### TC-APP-HOOK-03: state:publish 1회/틱
- **Refs:** HOOK-4, INV-9, PUB-BOUNDARY-1
- **Level:** Standard
- **Type:** Integration
- **Steps:** 한 Proposal Tick 내 다중 apply 발생
- **Expected:** publish 1회

#### TC-APP-HOOK-04: Hook async-safe
- **Refs:** HOOK-5
- **Level:** Standard
- **Type:** Integration
- **Steps:** async hook 사용
- **Expected:** 순서/결과 안정성 유지

#### TC-APP-HOOK-05: AppRef 전달
- **Refs:** HOOK-6
- **Level:** Standard
- **Type:** Unit
- **Steps:** hook ctx 검사
- **Expected:** `ctx.app`은 AppRef이며 제한된 API만 제공

#### TC-APP-HOOK-06: enqueueAction 지연 실행
- **Refs:** HOOK-7, HOOK-GUARD-1
- **Level:** Standard
- **Type:** Integration
- **Steps:** hook 내 `enqueueAction()` 호출
- **Expected:** 현재 hook 종료 후 실행

#### TC-APP-HOOK-07: Hook 변경 차단 (가드)
- **Refs:** HOOK-GUARD-1
- **Level:** Standard
- **Type:** Unit
- **Steps:** hook에서 동기 `act()` 시도
- **Expected:** 차단 또는 enqueue 패턴 강제

---

### 4.8 Policy & Authority

#### TC-APP-POLICY-01: ExecutionKey는 PolicyService에서 유도
- **Refs:** POLICY-1, EXK-POLICY-1
- **Level:** Standard
- **Type:** Integration
- **Steps:** PolicyService mock에서 ExecutionKey 생성 추적
- **Expected:** App이 PolicyService 경유로 ExecutionKey 결정

#### TC-APP-POLICY-02: Authority 승인 필수
- **Refs:** POLICY-2, SEC-1
- **Level:** Standard
- **Type:** Integration
- **Steps:** Authority reject 반환
- **Expected:** 실행/World 생성 없음

#### TC-APP-POLICY-03: Scope 사전 검증
- **Refs:** POLICY-3, SCOPE-1
- **Level:** Standard
- **Type:** Integration
- **Steps:** scope 위반 intent 제출
- **Expected:** 실행 전 reject

#### TC-APP-POLICY-04: Scope 사후 검증
- **Refs:** POLICY-4, SCOPE-POST-1
- **Level:** Standard
- **Type:** Integration
- **Steps:** 결과 스냅샷이 scope 위반
- **Expected:** 정책 서비스가 위반 보고(실패/경고)

#### TC-APP-POLICY-05: 거부 Proposal은 World 생성 금지
- **Refs:** POLICY-5, INV-4
- **Level:** Standard
- **Type:** Integration
- **Steps:** Authority reject
- **Expected:** World/lineage 변경 없음

#### TC-APP-POLICY-06: Tick은 Proposal 단위
- **Refs:** POLICY-6, EXK-TICK-1, EXK-TICK-2
- **Level:** Standard
- **Type:** Integration
- **Steps:** 동일 ExecutionKey로 연속 Proposal 실행
- **Expected:** Proposal마다 publish 발생

#### TC-APP-POLICY-07: ExecutionKey 라우팅 규칙
- **Refs:** ROUTE-1, ROUTE-2, ROUTE-3, ROUTE-4
- **Level:** Standard
- **Type:** Integration
- **Steps:** actor/branch/intent 조합으로 ExecutionKey 비교
- **Expected:** 라우팅 규칙에 따라 동일/분리 키 결정

#### TC-APP-POLICY-08: Scope 구조/제약 검증
- **Refs:** SCOPE-2, SCOPE-3, SCOPE-4, SCOPE-5
- **Level:** Standard
- **Type:** Unit
- **Steps:** 유효/무효 scope 입력 검증
- **Expected:** 스펙 위반은 reject

#### TC-APP-POLICY-09: World-ExecutionKey 연계
- **Refs:** WORLD-EXK-1, WORLD-EXK-2, WORLD-EXK-3
- **Level:** Standard
- **Type:** Integration
- **Steps:** World store 결과와 ExecutionKey 기록 확인
- **Expected:** World에 ExecutionKey 매핑이 일관됨

---

### 4.9 HostExecutor

#### TC-APP-HEXEC-01: HostExecutor 인터페이스 준수
- **Refs:** HEXEC-1
- **Level:** Minimal
- **Type:** Contract
- **Steps:** HostExecutor 형태 검증
- **Expected:** 필수 메서드 존재

#### TC-APP-HEXEC-02: Host 내부 노출 금지
- **Refs:** HEXEC-2, HEXEC-6
- **Level:** Minimal
- **Type:** Contract
- **Steps:** HostExecutionResult 구조 검사
- **Expected:** TraceEvent 등 내부 타입 미노출

#### TC-APP-HEXEC-03: execute() 결과 타입
- **Refs:** HEXEC-3
- **Level:** Standard
- **Type:** Unit
- **Steps:** `execute()` 반환 확인
- **Expected:** HostExecutionResult 반환

#### TC-APP-HEXEC-04: ExecutionKey 라우팅
- **Refs:** HEXEC-4, D-HEXEC-2
- **Level:** Standard
- **Type:** Integration
- **Steps:** 서로 다른 ExecutionKey 요청 동시 실행
- **Expected:** 각 mailbox로 분리 실행

#### TC-APP-HEXEC-05: abort() 지원
- **Refs:** HEXEC-5, D-HEXEC-1
- **Level:** Standard
- **Type:** Integration
- **Steps:** 실행 중 abort 호출
- **Expected:** 취소 처리 또는 명시적 미지원 동작

---

### 4.10 WorldStore & Delta

#### TC-APP-STORE-01: WorldStore 기본 메서드
- **Refs:** STORE-1, D-STORE-1
- **Level:** Minimal
- **Type:** Contract
- **Steps:** `store/restore/getWorld/has` 존재 확인
- **Expected:** 모두 구현

#### TC-APP-STORE-02: restore() 완전 스냅샷
- **Refs:** STORE-2, D-STORE-2
- **Level:** Standard
- **Type:** Integration
- **Steps:** delta 기반 복원
- **Expected:** 완전 Snapshot 반환

#### TC-APP-STORE-03: delta 복원 경로
- **Refs:** STORE-3, DELTA-GEN-1
- **Level:** Standard
- **Type:** Integration
- **Steps:** full snapshot 없는 경우 restore
- **Expected:** delta 체인 복원 성공

#### TC-APP-STORE-04: store() 불변성
- **Refs:** STORE-6
- **Level:** Minimal
- **Type:** Unit
- **Steps:** `store()` 호출 전후 World/Delta 비교
- **Expected:** 객체 변경 없음

#### TC-APP-STORE-05: $host 제외 규칙
- **Refs:** STORE-7, STORE-8, D-STORE-CANONICAL
- **Level:** Standard
- **Type:** Integration
- **Steps:** `data.$host` 포함 스냅샷 store/restore
- **Expected:** hash에 포함되지 않으며 restore 결과에 없음

#### TC-APP-STORE-06: WorldId 결정성
- **Refs:** WORLD-ID-1 (World SPEC), INV-1
- **Level:** Standard
- **Type:** Determinism
- **Steps:** 동일 schemaHash+snapshotHash로 WorldId 생성
- **Expected:** 항상 동일 WorldId

#### TC-APP-STORE-07: delta 생성 규칙
- **Refs:** D-DELTA-GEN, DELTA-GEN-2, DELTA-GEN-3
- **Level:** Standard
- **Type:** Integration
- **Steps:** snapshot 전/후 delta 생성
- **Expected:** delta가 정확한 patch 집합 제공

#### TC-APP-STORE-08: restore context
- **Refs:** D-STORE-RESTORE-CTX, RESTORE-CTX-1
- **Level:** Full
- **Type:** Integration
- **Steps:** restore 시 Host가 재주입해야 하는 필드 확인
- **Expected:** App이 Host 재주입 경로를 준수

---

### 4.11 Publish Boundary & Scheduler

#### TC-APP-PUB-01: App↔World 1:1 바인딩
- **Refs:** APP-WORLD-1, APP-WORLD-2, APP-WORLD-3
- **Level:** Standard
- **Type:** Contract
- **Steps:** App 인스턴스에 WorldStore 1개만 바인딩
- **Expected:** 다른 World 혼입 불가

#### TC-APP-PUB-02: Publish boundary = Proposal Tick
- **Refs:** PUB-BOUNDARY-1, PUB-TICK-1
- **Level:** Standard
- **Type:** Integration
- **Steps:** Proposal 실행 종료 시점 publish 관측
- **Expected:** terminalSnapshot 기준 1회 publish

#### TC-APP-PUB-03: ExecutionKey 공유 상황의 publish 보장
- **Refs:** PUB-BOUNDARY-2, PUB-TICK-2, EXK-TICK-2
- **Level:** Standard
- **Type:** Integration
- **Steps:** 동일 ExecutionKey에서 다중 Proposal 연속 실행
- **Expected:** 각 Proposal마다 publish 발생

#### TC-APP-PUB-04: publish coalescing
- **Refs:** PUB-BOUNDARY-3
- **Level:** Standard
- **Type:** Integration
- **Steps:** 한 Proposal 내 다중 apply 발생
- **Expected:** 중간 상태 publish 없음

#### TC-APP-PUB-05: scheduler 주입
- **Refs:** PUB-SCHED-1, PUB-SCHED-2, PUB-SCHED-3
- **Level:** Full
- **Type:** Integration
- **Steps:** 스케줄러 주입 시 publish 타이밍/코얼레스 동작 확인
- **Expected:** 주입 정책대로 동작

#### TC-APP-PUB-06: publish liveness
- **Refs:** PUB-LIVENESS-1, PUB-LIVENESS-2, PUB-LIVENESS-3
- **Level:** Standard
- **Type:** Integration
- **Steps:** 실행 성공/실패 각각에 대해 publish 확인
- **Expected:** 최소 1회 publish 보장

---

### 4.12 Memory & Ext

#### TC-APP-MEM-01: MemoryStore CRUD
- **Refs:** MEM-1, MEM-2, MEM-3, MEM-4, MEM-CRUD-1~5
- **Level:** Full
- **Type:** Integration
- **Steps:** create/get/update/delete/query 수행
- **Expected:** 규격대로 동작 (없으면 null/오류)

#### TC-APP-MEM-02: 메모리 실패는 실행 차단 금지
- **Refs:** MEM-5
- **Level:** Full
- **Type:** Integration
- **Steps:** MemoryStore 에러 유발
- **Expected:** World 실행은 계속 진행

#### TC-APP-MEM-03: recall 타임아웃
- **Refs:** MEM-6, MEM-REC-1
- **Level:** Full
- **Type:** Integration
- **Steps:** recall 타임아웃 유도
- **Expected:** graceful degradation (실패로 중단되지 않음)

#### TC-APP-MEM-04: memoryContext freeze
- **Refs:** MEM-7, MEM-CONTEXT-1, MEM-CONTEXT-2
- **Level:** Full
- **Type:** Determinism
- **Steps:** recall 결과를 `input.$app.memoryContext`에 주입
- **Expected:** snapshot input에 고정 값으로 저장

#### TC-APP-MEM-05: replay 시 재조회 금지
- **Refs:** MEM-8, MEM-CONTEXT-3
- **Level:** Full
- **Type:** Determinism
- **Steps:** replay 실행 시 MemoryStore 호출 감시
- **Expected:** 재조회 없이 기존 context 사용

#### TC-APP-MEM-06: HostExecutionOptions로 전달 금지
- **Refs:** MEM-9
- **Level:** Full
- **Type:** Contract
- **Steps:** HostExecutionOptions 전달 내용 검사
- **Expected:** memoryContext 없음

#### TC-APP-MEM-07: Memory 비활성화 규칙
- **Refs:** MEM-DIS-1, MEM-DIS-2
- **Level:** Full
- **Type:** Integration
- **Steps:** Memory disabled 상태에서 recall/remember 호출
- **Expected:** 지정된 오류/무시 규칙 준수

#### TC-APP-MEM-08: Memory auth scope
- **Refs:** MEM-AUTH-1, MEM-AUTH-2, MEM-AUTH-3, MEM-AUTH-4
- **Level:** Full
- **Type:** Integration
- **Steps:** actor/branch별 memory 접근 정책 테스트
- **Expected:** 허용된 범위만 접근

#### TC-APP-MEM-09: Memory 유지보수 작업
- **Refs:** MEM-MAINT-1~4, MEM-INT-1~5
- **Level:** Full
- **Type:** Integration
- **Steps:** maintenance action 실행
- **Expected:** 지정된 유지보수 흐름 동작

---

### 4.13 Plugins

#### TC-APP-PLUGIN-01: ready() 중 플러그인 실행
- **Refs:** PLUGIN-1, D-PLUGIN-1
- **Level:** Full
- **Type:** Integration
- **Steps:** 플러그인 등록 후 ready
- **Expected:** ready 중 플러그인 실행

#### TC-APP-PLUGIN-02: getDomainSchema() 호출 허용
- **Refs:** PLUGIN-2
- **Level:** Full
- **Type:** Unit
- **Steps:** 플러그인에서 getDomainSchema 호출
- **Expected:** 호출 가능

#### TC-APP-PLUGIN-03: 플러그인 오류 격리
- **Refs:** PLUGIN-3, D-PLUGIN-4
- **Level:** Full
- **Type:** Integration
- **Steps:** 플러그인 throw
- **Expected:** 오류 격리, App 상태 보존

#### TC-APP-PLUGIN-04: Core/Host/World 변경 금지
- **Refs:** PLUGIN-4, D-PLUGIN-5
- **Level:** Full
- **Type:** Contract
- **Steps:** 플러그인에서 변경 시도 감시
- **Expected:** 변경 불가 또는 차단

---

### 4.14 System Runtime

#### TC-APP-SYS-01: system.* 네임스페이스 강제
- **Refs:** SYS-1
- **Level:** Full
- **Type:** Unit
- **Steps:** system runtime 실행 타입 확인
- **Expected:** `system.*`만 허용

#### TC-APP-SYS-02: rejected system action World 생성 금지
- **Refs:** SYS-3
- **Level:** Full
- **Type:** Integration
- **Steps:** system action reject 유도
- **Expected:** World 생성 없음

#### TC-APP-SYS-03: failed system action World 생성
- **Refs:** SYS-4, INV-3
- **Level:** Full
- **Type:** Integration
- **Steps:** system action 실패 유도
- **Expected:** failed World 생성

#### TC-APP-SYSRT-01: System/Domain 런타임 분리
- **Refs:** SYSRT-1
- **Level:** Full
- **Type:** Integration
- **Steps:** system action과 domain action 실행 경로 비교
- **Expected:** 서로 다른 런타임으로 분리

#### TC-APP-SYSRT-02: system action의 domain state 변경 금지
- **Refs:** SYSRT-2
- **Level:** Full
- **Type:** Integration
- **Steps:** system action 수행 후 domain state 비교
- **Expected:** domain state 불변

#### TC-APP-SYSRT-03: System Runtime 스키마 고정
- **Refs:** SYSRT-3
- **Level:** Full
- **Type:** Contract
- **Steps:** user schema로 system runtime 변경 시도
- **Expected:** 변경 불가

---

### 4.15 Invariants

#### TC-APP-INV-01: Determinism
- **Refs:** INV-1
- **Level:** Full
- **Type:** Determinism
- **Steps:** 동일 input/상태로 2회 실행
- **Expected:** 동일 Snapshot/WorldId

#### TC-APP-INV-02: World 불변
- **Refs:** INV-2
- **Level:** Standard
- **Type:** Contract
- **Steps:** WorldStore에 저장된 World 수정 시도
- **Expected:** 변경되지 않음

#### TC-APP-INV-03: 실패 실행은 Failed World 생성
- **Refs:** INV-3
- **Level:** Standard
- **Type:** Integration
- **Steps:** 실행 실패 유도
- **Expected:** Failed World 생성 및 기록

#### TC-APP-INV-04: Authority reject는 World 생성 금지
- **Refs:** INV-4
- **Level:** Standard
- **Type:** Integration
- **Steps:** Authority reject
- **Expected:** World 없음

#### TC-APP-INV-05: 외부 Memory는 World history와 분리
- **Refs:** INV-5
- **Level:** Full
- **Type:** Contract
- **Steps:** World hash/lineage에 memory 영향 검사
- **Expected:** Memory 변화가 World hash에 영향 없음

#### TC-APP-INV-06: 설정 오류는 World 생성 금지
- **Refs:** INV-6
- **Level:** Full
- **Type:** Integration
- **Steps:** schema compatibility 실패
- **Expected:** World 생성 없음

#### TC-APP-INV-07: 실행은 run-to-completion
- **Refs:** INV-7
- **Level:** Standard
- **Type:** Integration
- **Steps:** HostExecutor 실행 중 중단/재진입 시도
- **Expected:** 실행 원자성 보장

#### TC-APP-INV-08: Proposal당 tick 1회
- **Refs:** INV-8
- **Level:** Standard
- **Type:** Integration
- **Steps:** ExecutionKey 공유 상황에서 tick 수 측정
- **Expected:** Proposal마다 1 tick

---

## 5. 커버리지 지침

- **Minimal:** APP-BOUNDARY, APP-API, APP-LC, READY, HEXEC, STORE 기본
- **Standard:** Minimal + SCHEMA, BRANCH, SESSION, HANDLE, POLICY, HOOK
- **Full:** Standard + MEMORY, SYSTEM RUNTIME, PLUGINS, PUBLISH BOUNDARY

각 테스트는 SPEC/FDR Rule ID를 반드시 명시하고, 실패 시 어떤 규칙이 깨졌는지 역추적 가능해야 한다.

