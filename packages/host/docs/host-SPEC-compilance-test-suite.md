좋아. **v2.0 스펙을 “문서”로 두지 않고, 바로 “컴파일러처럼” 테스트로 못 박는 방향**이 제일 맞아.
(특히 네 스펙은 이벤트루프/레이스/원자성 문제를 다루기 때문에 “구현 후 검증”이 아니라 “검증이 구현을 강제”해야 함)

아래는 **Host Contract v2.0 기준 Spec Compliance Test Suite(이하 HCTS)**를 “바로 구현 가능한 형태”로 설계한 초안이야.

---

# 0) Test Suite의 목표를 먼저 딱 정의하자

HCTS는 다음 2가지를 동시에 해야 해:

1. **규범적 MUST 규칙 위반을 재현 가능하게 실패시키기**

    * 특히: clear 누락, stale apply, lost wakeup, ordering, interlock
2. **레이스성 이슈를 “운”이 아니라 “결정적 스케줄”로 잡기**

    * 즉, 테스트는 flaky 하면 안 됨
    * 그래서 Host Under Test는 **테스트 런타임/스케줄러 주입 + 트레이스**를 제공해야 함 (테스트 모드)

결론: “블랙박스 테스트만으로”는 v2.0 핵심(특히 RUN-4/LIVE-4, JOB-1)을 안정적으로 잡기 어렵고,
**HCTS는 ‘Host Test Adapter’라는 표준 어댑터 계약을 먼저 정의하는 게 핵심**이야.

---

# 1) HCTS용 “Host Test Adapter” 계약 (테스트 전용 최소 API)

스펙 자체의 `Host` 인터페이스만으로는 내부 job/runner를 검증하기 부족해.
그래서 HCTS는 “Host 구현체에 얇은 어댑터를 붙여서” 테스트한다는 방식을 권장해.

## 1.1 HostTestAdapter (제안)

```ts
export type ExecutionKey = string;

export type TraceEvent =
  | { t: 'runner:start'; key: ExecutionKey }
  | { t: 'runner:end'; key: ExecutionKey }
  | { t: 'job:start'; key: ExecutionKey; jobType: string }
  | { t: 'job:end'; key: ExecutionKey; jobType: string }
  | { t: 'core:compute'; key: ExecutionKey; intentId: string }
  | { t: 'core:apply'; key: ExecutionKey; patchCount: number; source: string }
  | { t: 'effect:dispatch'; key: ExecutionKey; requirementId: string; effectType: string }
  | { t: 'effect:fulfill:drop'; key: ExecutionKey; requirementId: string; reason: 'stale' | 'duplicate' }
  | { t: 'requirement:clear'; key: ExecutionKey; requirementId: string }
  | { t: 'continue:enqueue'; key: ExecutionKey; intentId: string };

export interface HostTestAdapter {
  /** Host 인스턴스 생성 (Core/Compiler/EffectRunner 주입 필수) */
  create(opts: {
    core: TestCore;
    effectRunner: TestEffectRunner;
    compiler?: TestCompiler;
    runtime: DeterministicRuntime;
  }): Promise<void>;

  /** 초기 스냅샷 주입/리셋 */
  seedSnapshot(key: ExecutionKey, snapshot: Snapshot): void;

  /** Intent 제출: Host가 내부적으로 StartIntent job enqueue + kick 해야 함 */
  submitIntent(key: ExecutionKey, intent: Intent): void;

  /** (테스트용) 번역 결과가 도착했다고 가정하고 reinject */
  injectTranslatorOutput(key: ExecutionKey, intentId: string, fragments: TranslatorFragment[]): void;

  /** 결정적 런타임을 “idle까지” 드레인 (중요: flaky 방지) */
  drain(key: ExecutionKey): Promise<void>;

  /** 관찰용 */
  getSnapshot(key: ExecutionKey): Snapshot;
  getTrace(key: ExecutionKey): TraceEvent[];
  clearTrace(key: ExecutionKey): void;
}
```

## 1.2 DeterministicRuntime (RUN/LIVE/await-ban 검증의 핵심)

스펙에서 `queueMicrotask`, `yieldToUI`, `timeout` 등이 나오지?
이걸 실제 이벤트루프에 맡기면 **레이스 재현이 불안정**해져.

그래서 Host는 테스트 모드에서 다음을 주입받도록 설계하는 게 좋아:

```ts
export interface DeterministicRuntime {
  microtask(fn: () => void): void;   // scheduleRunner 용
  macrotask(fn: () => void): void;   // setTimeout 대체용(선택)
  now(): number;                     // timeout 계산용(선택)
  yield(): Promise<void>;            // runner loop에서 “job 사이” yield
  /** 테스트가 직접 time/queue를 조작할 수 있어야 함 */
  advanceTime(ms: number): void;
  runAllMicrotasks(): void;
  runNextMacrotask(): void;
  runUntilIdle(): Promise<void>;
}
```

이게 있으면:

* **RUN-4/LIVE-4** 같은 “정말 재현 어려운” 조건도 테스트가 100% 재현 가능해져.

---

# 2) HCTS 구성: MUST/SHOULD를 분리해서 “스펙 보고서”를 만들자

테스트 결과가 단순히 “pass/fail”로 끝나면 OSS 사용자들이 못 써.

그래서 HCTS는 실행 후 다음을 산출하는 걸 권장해:

* `compliance.json`: `{ ruleId: 'PASS' | 'FAIL' | 'SKIP' | 'WARN', evidence: ... }`
* `trace.ndjson`: 타임라인 기반 증거(디버깅 가능)

그리고 규칙 등급:

* **MUST**: FAIL이면 suite 실패
* **SHOULD**: WARN (suite는 통과 가능, 보고서에 경고)

---

# 3) 테스트 카테고리 & “필수 테스트 목록” (v2.0 핵심만 먼저)

여기서부터가 본론이야.
**스펙의 위험지점(무한루프/중복효과/영구스톨/비결정성)을 모두 커버하는 최소 세트**를 먼저 정의하자.

아래는 “테스트 케이스 ID → 커버 규칙 → 목적” 형태로 구성했어.

---

## A. Mailbox / Runner / Liveness (최우선)

### HCTS-RUN-001: single runner 보장

* **커버:** RUN-1, RUN-2, INV-EX-4
* **목적:** 같은 key에 대해 runner가 동시에 2개 이상 돌지 않음
* **검증:** trace에서 동일 key에 `runner:start`가 중첩되면 FAIL

---

### HCTS-LIVE-001: empty→non-empty kick 보장

* **커버:** LIVE-2
* **시나리오:** 빈 mailbox에 job 하나 enqueue → runner가 자동으로 돌기 시작해야 함
* **검증:** drain 후 job 처리됨 + trace에 runner start/end 존재

---

### HCTS-LIVE-002: blocked kick 기억 + 재시도 (lost wakeup 방지)

* **커버:** LIVE-4, RUN-4, INV-EX-10, INV-EX-11
* **시나리오(결정적으로 재현):**

    1. runner가 “종료 직전 단계”에서 테스트 runtime에 의해 멈춰있음
    2. 그 사이 effect completion이 들어와 enqueue + kick 시도
    3. kick이 runnerActive 때문에 막힘
    4. runner가 종료할 때 queue/kickRequested 재확인 → 다시 스케줄 → job 처리
* **검증:** drain 후 큐가 비고 snapshot이 업데이트 됨
* **버그 host:** 여기서 영구 스톨이 걸림(재현 성공)

> 이 테스트가 **v2.0의 존재 이유** 중 하나라서, 반드시 deterministic runtime 기반으로 잡아야 해.

---

## B. Run-to-completion / Await ban

### HCTS-JOB-001: job run-to-completion (job 내부 await 금지)

* **커버:** JOB-1, JOB-2, INV-EX-3
* **핵심 검증(트레이스로 가능):**

    * 같은 key에서 `job:start(A)` ~ `job:end(A)` 사이에

        * `job:start(B)`가 끼어들면 FAIL
    * 즉, “job 실행 중 다른 job이 실행되는 interleaving” 자체가 위반

이 테스트는 **Await 금지 / continuation state**를 거의 완벽하게 잡아준다.

---

## C. Compute↔Effect interlock (apply-before-dispatch)

### HCTS-INTERLOCK-001: compute patches apply 후 effect dispatch

* **커버:** COMP-REQ-INTERLOCK-1, INV-EX-15
* **시나리오:**

    * core.compute가 pendingRequirements를 추가하는 patch를 반환
    * host는 그 patch를 apply한 뒤에 effect dispatch해야 함
* **검증:**

    * trace 순서가 반드시:

        1. `core:compute`
        2. `core:apply (source=compute)`
        3. `effect:dispatch`
    * 반대면 FAIL

### HCTS-INTERLOCK-002: dispatch list는 snapshot에서 읽는 SHOULD

* **커버:** COMP-REQ-INTERLOCK-2 (SHOULD)
* **시나리오(추천):**

    * compute 반환의 pendingRequirements와, apply된 snapshot.pendingRequirements가 일부러 다르게 되도록 만든다
    * host가 snapshot을 읽으면 “정상 dispatch”
    * compute return을 읽으면 “오류 dispatch”
* **결과:** FAIL 대신 WARN로 처리 권장

---

## D. Requirement Lifecycle & FulfillEffect (중복효과/무한루프 방지)

### HCTS-REQ-001: fulfillment 후 clear 필수

* **커버:** REQ-CLEAR-1, INV-RL-2
* **시나리오:**

    * R1 발생 → 효과 완료 → fulfill 처리
* **검증:**

    * 결과 snapshot에서 pendingRequirements에 R1이 없어야 함
    * effectRunner.execute가 동일 R1에 대해 2번 호출되면 FAIL (무한루프 징후)

---

### HCTS-FULFILL-001: stale/duplicate 보호 (FULFILL-0)

* **커버:** FULFILL-0, INV-EX-13
* **시나리오:**

    1. R1 실행 요청
    2. timeout 처리(에러패치)로 R1이 clear됨
    3. 늦게 R1 성공 결과가 도착
* **기대:** 늦은 성공 결과는 **drop**되어야 함
* **검증:**

    * trace에 `effect:fulfill:drop(reason=stale)` 존재
    * 성공 patch가 상태에 반영되지 않음

---

### HCTS-FULFILL-002: apply 실패해도 clear는 무조건 (ERR-FE-2)

* **커버:** ERR-FE-1~2, INV-EX-12, INV-EX-14
* **시나리오:**

    * effect 결과 patch 중 하나가 core.apply에서 throw를 유발(의도)
    * 그럼에도 host는 requirement clear를 반드시 수행해야 함
* **검증:**

    * pendingRequirements에서 해당 req 제거됨
    * continueCompute는 진행됨(멈추면 FAIL)

---

### HCTS-FULFILL-003: error patch는 best-effort (ERR-FE-5)

* **커버:** ERR-FE-5, INV-EX-17
* **시나리오:**

    * applyErrorPatch도 throw 나게 만들어봄(의도)
* **검증:**

    * 그래도 continueCompute가 enqueue되어 진행됨
    * error patch 실패 로그 이벤트는 있으면 좋고(권장), 없어도 “continue 보장”이 핵심

---

## E. Ordering (ORD-SERIAL / ORD-PARALLEL 선택형)

HCTS는 구현체가 어떤 policy인지 알아야 해.
그래서 suite 실행 옵션으로 받자:

```ts
type OrderingPolicy = 'ORD-SERIAL' | 'ORD-PARALLEL';
```

### HCTS-ORD-001 (serial): R2가 먼저 완료돼도 R1부터 실행/적용

* **커버:** ORD-1~4, ORD-SERIAL
* **검증 포인트(serial에서 가장 쉬움):**

    * effectRunner.execute 호출 순서가 pendingRequirements 순서를 따름
    * R2 완료 신호가 먼저 와도 host는 R2를 애초에 dispatch하지 않거나(완전 직렬),
      dispatch했더라도 apply 순서는 R1→R2가 보장되어야 함

### HCTS-ORD-002 (parallel): completion 순서가 뒤집혀도 최종 상태는 pending order

* **커버:** ORD-PARALLEL, ORD-4
* **시나리오:**

    * R1, R2 모두 dispatch
    * R2가 먼저 완료
    * 최종 snapshot은 반드시 R1→R2 순서 적용 결과
* **검증:** non-commutative 패치로 검증(예: `counter += 10` 후 `counter *= 2`)

### HCTS-ORD-003 (parallel): timeout/cancel도 “결과”로 취급해 버퍼 스톨 금지

* **커버:** ORD-TIMEOUT-1~3, INV-EX-16
* **시나리오:**

    * expectedOrder [R1, R2]
    * R2는 성공 결과 도착
    * R1은 timeout
* **검증:**

    * 버퍼가 R1 때문에 멈추지 않고,
    * R1 timeout 결과를 outcome으로 처리 후 R2까지 진행

---

## F. Translator integration (DEPRECATED)

> **DEPRECATED (v2.0.2):** Translator handling is App responsibility. These tests are legacy and not required for Host v2.0.2 compliance.


### HCTS-TRANS-001: ApplyTranslatorOutput는 FulfillEffect와 분리

* **커버:** TRANS-2
* **시나리오:** translator fragments 주입 → host는 ApplyTranslatorOutput job으로 처리
* **검증:** requirement clear가 발생하면 안 됨(Translator는 Core Requirement가 아님)

### HCTS-TRANS-002: Lower→Evaluate→Apply는 “한 job”에서 동기 실행

* **커버:** TRANS-3, TRANS-4
* **검증(트레이스로 잡기 좋음):**

    * `job:start(ApplyTranslatorOutput)` ~ `job:end(...)` 사이에

        * `compiler:lower`
        * `compiler:evaluate`
        * `core:apply(source=translator)`
    * 이 3개가 모두 존재하고,
    * 그 사이에 다른 job이 끼면 FAIL(스플릿/await 의심)

---

# 4) “가장 먼저 구현할” Minimal Suite (진짜 핵심 8개)

너가 지금 v2.0을 밀고 가는 목적이 “안전한 실행”이면, 최소 이 8개는 **무조건**이야:

1. HCTS-RUN-001
2. HCTS-LIVE-001
3. HCTS-LIVE-002 (lost wakeup)
4. HCTS-JOB-001 (await ban)
5. HCTS-INTERLOCK-001
6. HCTS-REQ-001
7. HCTS-FULFILL-001 (stale)
8. HCTS-FULFILL-002 (apply 실패에도 clear)

이 8개만 통과해도:

* 무한루프
* 중복효과
* 영구 스톨
* 비결정 적용

이 4대 사고는 거의 차단돼.

---

# 5) 다음 액션: 내가 “스위트 파일 구조”까지 잡아줄게

원하면 바로 이런 형태로 시작하면 돼(추천: Vitest):

```
packages/host-compliance/
  src/
    adapter.ts
    runtime.ts
    assertions.ts
    suite/
      runner.spec.ts
      liveness.spec.ts
      job.spec.ts
      interlock.spec.ts
      fulfill.spec.ts
      ordering.spec.ts
      translator.spec.ts
  README.md  (각 테스트가 커버하는 Rule ID 표)
```

그리고 README에는 “Rule Coverage Matrix”를 자동 생성하도록:
좋아. **v2.0 스펙을 “문서”로 두지 않고, 바로 “컴파일러처럼” 테스트로 못 박는 방향**이 제일 맞아.
(특히 네 스펙은 이벤트루프/레이스/원자성 문제를 다루기 때문에 “구현 후 검증”이 아니라 “검증이 구현을 강제”해야 함)

아래는 **Host Contract v2.0 기준 Spec Compliance Test Suite(이하 HCTS)**를 “바로 구현 가능한 형태”로 설계한 초안이야.

---

# 0) Test Suite의 목표를 먼저 딱 정의하자

HCTS는 다음 2가지를 동시에 해야 해:

1. **규범적 MUST 규칙 위반을 재현 가능하게 실패시키기**

    * 특히: clear 누락, stale apply, lost wakeup, ordering, interlock
2. **레이스성 이슈를 “운”이 아니라 “결정적 스케줄”로 잡기**

    * 즉, 테스트는 flaky 하면 안 됨
    * 그래서 Host Under Test는 **테스트 런타임/스케줄러 주입 + 트레이스**를 제공해야 함 (테스트 모드)

결론: “블랙박스 테스트만으로”는 v2.0 핵심(특히 RUN-4/LIVE-4, JOB-1)을 안정적으로 잡기 어렵고,
**HCTS는 ‘Host Test Adapter’라는 표준 어댑터 계약을 먼저 정의하는 게 핵심**이야.

---

# 1) HCTS용 “Host Test Adapter” 계약 (테스트 전용 최소 API)

스펙 자체의 `Host` 인터페이스만으로는 내부 job/runner를 검증하기 부족해.
그래서 HCTS는 “Host 구현체에 얇은 어댑터를 붙여서” 테스트한다는 방식을 권장해.

## 1.1 HostTestAdapter (제안)

```ts
export type ExecutionKey = string;

export type TraceEvent =
  | { t: 'runner:start'; key: ExecutionKey }
  | { t: 'runner:end'; key: ExecutionKey }
  | { t: 'job:start'; key: ExecutionKey; jobType: string }
  | { t: 'job:end'; key: ExecutionKey; jobType: string }
  | { t: 'core:compute'; key: ExecutionKey; intentId: string }
  | { t: 'core:apply'; key: ExecutionKey; patchCount: number; source: string }
  | { t: 'effect:dispatch'; key: ExecutionKey; requirementId: string; effectType: string }
  | { t: 'effect:fulfill:drop'; key: ExecutionKey; requirementId: string; reason: 'stale' | 'duplicate' }
  | { t: 'requirement:clear'; key: ExecutionKey; requirementId: string }
  | { t: 'continue:enqueue'; key: ExecutionKey; intentId: string };

export interface HostTestAdapter {
  /** Host 인스턴스 생성 (Core/Compiler/EffectRunner 주입 필수) */
  create(opts: {
    core: TestCore;
    effectRunner: TestEffectRunner;
    compiler?: TestCompiler;
    runtime: DeterministicRuntime;
  }): Promise<void>;

  /** 초기 스냅샷 주입/리셋 */
  seedSnapshot(key: ExecutionKey, snapshot: Snapshot): void;

  /** Intent 제출: Host가 내부적으로 StartIntent job enqueue + kick 해야 함 */
  submitIntent(key: ExecutionKey, intent: Intent): void;

  /** (테스트용) 번역 결과가 도착했다고 가정하고 reinject */
  injectTranslatorOutput(key: ExecutionKey, intentId: string, fragments: TranslatorFragment[]): void;

  /** 결정적 런타임을 “idle까지” 드레인 (중요: flaky 방지) */
  drain(key: ExecutionKey): Promise<void>;

  /** 관찰용 */
  getSnapshot(key: ExecutionKey): Snapshot;
  getTrace(key: ExecutionKey): TraceEvent[];
  clearTrace(key: ExecutionKey): void;
}
```

## 1.2 DeterministicRuntime (RUN/LIVE/await-ban 검증의 핵심)

스펙에서 `queueMicrotask`, `yieldToUI`, `timeout` 등이 나오지?
이걸 실제 이벤트루프에 맡기면 **레이스 재현이 불안정**해져.

그래서 Host는 테스트 모드에서 다음을 주입받도록 설계하는 게 좋아:

```ts
export interface DeterministicRuntime {
  microtask(fn: () => void): void;   // scheduleRunner 용
  macrotask(fn: () => void): void;   // setTimeout 대체용(선택)
  now(): number;                     // timeout 계산용(선택)
  yield(): Promise<void>;            // runner loop에서 “job 사이” yield
  /** 테스트가 직접 time/queue를 조작할 수 있어야 함 */
  advanceTime(ms: number): void;
  runAllMicrotasks(): void;
  runNextMacrotask(): void;
  runUntilIdle(): Promise<void>;
}
```

이게 있으면:

* **RUN-4/LIVE-4** 같은 “정말 재현 어려운” 조건도 테스트가 100% 재현 가능해져.

---

# 2) HCTS 구성: MUST/SHOULD를 분리해서 “스펙 보고서”를 만들자

테스트 결과가 단순히 “pass/fail”로 끝나면 OSS 사용자들이 못 써.

그래서 HCTS는 실행 후 다음을 산출하는 걸 권장해:

* `compliance.json`: `{ ruleId: 'PASS' | 'FAIL' | 'SKIP' | 'WARN', evidence: ... }`
* `trace.ndjson`: 타임라인 기반 증거(디버깅 가능)

그리고 규칙 등급:

* **MUST**: FAIL이면 suite 실패
* **SHOULD**: WARN (suite는 통과 가능, 보고서에 경고)

---

# 3) 테스트 카테고리 & “필수 테스트 목록” (v2.0 핵심만 먼저)

여기서부터가 본론이야.
**스펙의 위험지점(무한루프/중복효과/영구스톨/비결정성)을 모두 커버하는 최소 세트**를 먼저 정의하자.

아래는 “테스트 케이스 ID → 커버 규칙 → 목적” 형태로 구성했어.

---

## A. Mailbox / Runner / Liveness (최우선)

### HCTS-RUN-001: single runner 보장

* **커버:** RUN-1, RUN-2, INV-EX-4
* **목적:** 같은 key에 대해 runner가 동시에 2개 이상 돌지 않음
* **검증:** trace에서 동일 key에 `runner:start`가 중첩되면 FAIL

---

### HCTS-LIVE-001: empty→non-empty kick 보장

* **커버:** LIVE-2
* **시나리오:** 빈 mailbox에 job 하나 enqueue → runner가 자동으로 돌기 시작해야 함
* **검증:** drain 후 job 처리됨 + trace에 runner start/end 존재

---

### HCTS-LIVE-002: blocked kick 기억 + 재시도 (lost wakeup 방지)

* **커버:** LIVE-4, RUN-4, INV-EX-10, INV-EX-11
* **시나리오(결정적으로 재현):**

    1. runner가 “종료 직전 단계”에서 테스트 runtime에 의해 멈춰있음
    2. 그 사이 effect completion이 들어와 enqueue + kick 시도
    3. kick이 runnerActive 때문에 막힘
    4. runner가 종료할 때 queue/kickRequested 재확인 → 다시 스케줄 → job 처리
* **검증:** drain 후 큐가 비고 snapshot이 업데이트 됨
* **버그 host:** 여기서 영구 스톨이 걸림(재현 성공)

> 이 테스트가 **v2.0의 존재 이유** 중 하나라서, 반드시 deterministic runtime 기반으로 잡아야 해.

---

## B. Run-to-completion / Await ban

### HCTS-JOB-001: job run-to-completion (job 내부 await 금지)

* **커버:** JOB-1, JOB-2, INV-EX-3
* **핵심 검증(트레이스로 가능):**

    * 같은 key에서 `job:start(A)` ~ `job:end(A)` 사이에

        * `job:start(B)`가 끼어들면 FAIL
    * 즉, “job 실행 중 다른 job이 실행되는 interleaving” 자체가 위반

이 테스트는 **Await 금지 / continuation state**를 거의 완벽하게 잡아준다.

---

## C. Compute↔Effect interlock (apply-before-dispatch)

### HCTS-INTERLOCK-001: compute patches apply 후 effect dispatch

* **커버:** COMP-REQ-INTERLOCK-1, INV-EX-15
* **시나리오:**

    * core.compute가 pendingRequirements를 추가하는 patch를 반환
    * host는 그 patch를 apply한 뒤에 effect dispatch해야 함
* **검증:**

    * trace 순서가 반드시:

        1. `core:compute`
        2. `core:apply (source=compute)`
        3. `effect:dispatch`
    * 반대면 FAIL

### HCTS-INTERLOCK-002: dispatch list는 snapshot에서 읽는 SHOULD

* **커버:** COMP-REQ-INTERLOCK-2 (SHOULD)
* **시나리오(추천):**

    * compute 반환의 pendingRequirements와, apply된 snapshot.pendingRequirements가 일부러 다르게 되도록 만든다
    * host가 snapshot을 읽으면 “정상 dispatch”
    * compute return을 읽으면 “오류 dispatch”
* **결과:** FAIL 대신 WARN로 처리 권장

---

## D. Requirement Lifecycle & FulfillEffect (중복효과/무한루프 방지)

### HCTS-REQ-001: fulfillment 후 clear 필수

* **커버:** REQ-CLEAR-1, INV-RL-2
* **시나리오:**

    * R1 발생 → 효과 완료 → fulfill 처리
* **검증:**

    * 결과 snapshot에서 pendingRequirements에 R1이 없어야 함
    * effectRunner.execute가 동일 R1에 대해 2번 호출되면 FAIL (무한루프 징후)

---

### HCTS-FULFILL-001: stale/duplicate 보호 (FULFILL-0)

* **커버:** FULFILL-0, INV-EX-13
* **시나리오:**

    1. R1 실행 요청
    2. timeout 처리(에러패치)로 R1이 clear됨
    3. 늦게 R1 성공 결과가 도착
* **기대:** 늦은 성공 결과는 **drop**되어야 함
* **검증:**

    * trace에 `effect:fulfill:drop(reason=stale)` 존재
    * 성공 patch가 상태에 반영되지 않음

---

### HCTS-FULFILL-002: apply 실패해도 clear는 무조건 (ERR-FE-2)

* **커버:** ERR-FE-1~2, INV-EX-12, INV-EX-14
* **시나리오:**

    * effect 결과 patch 중 하나가 core.apply에서 throw를 유발(의도)
    * 그럼에도 host는 requirement clear를 반드시 수행해야 함
* **검증:**

    * pendingRequirements에서 해당 req 제거됨
    * continueCompute는 진행됨(멈추면 FAIL)

---

### HCTS-FULFILL-003: error patch는 best-effort (ERR-FE-5)

* **커버:** ERR-FE-5, INV-EX-17
* **시나리오:**

    * applyErrorPatch도 throw 나게 만들어봄(의도)
* **검증:**

    * 그래도 continueCompute가 enqueue되어 진행됨
    * error patch 실패 로그 이벤트는 있으면 좋고(권장), 없어도 “continue 보장”이 핵심

---

## E. Ordering (ORD-SERIAL / ORD-PARALLEL 선택형)

HCTS는 구현체가 어떤 policy인지 알아야 해.
그래서 suite 실행 옵션으로 받자:

```ts
type OrderingPolicy = 'ORD-SERIAL' | 'ORD-PARALLEL';
```

### HCTS-ORD-001 (serial): R2가 먼저 완료돼도 R1부터 실행/적용

* **커버:** ORD-1~4, ORD-SERIAL
* **검증 포인트(serial에서 가장 쉬움):**

    * effectRunner.execute 호출 순서가 pendingRequirements 순서를 따름
    * R2 완료 신호가 먼저 와도 host는 R2를 애초에 dispatch하지 않거나(완전 직렬),
      dispatch했더라도 apply 순서는 R1→R2가 보장되어야 함

### HCTS-ORD-002 (parallel): completion 순서가 뒤집혀도 최종 상태는 pending order

* **커버:** ORD-PARALLEL, ORD-4
* **시나리오:**

    * R1, R2 모두 dispatch
    * R2가 먼저 완료
    * 최종 snapshot은 반드시 R1→R2 순서 적용 결과
* **검증:** non-commutative 패치로 검증(예: `counter += 10` 후 `counter *= 2`)

### HCTS-ORD-003 (parallel): timeout/cancel도 “결과”로 취급해 버퍼 스톨 금지

* **커버:** ORD-TIMEOUT-1~3, INV-EX-16
* **시나리오:**

    * expectedOrder [R1, R2]
    * R2는 성공 결과 도착
    * R1은 timeout
* **검증:**

    * 버퍼가 R1 때문에 멈추지 않고,
    * R1 timeout 결과를 outcome으로 처리 후 R2까지 진행

---

## F. Translator integration (DEPRECATED)

> **DEPRECATED (v2.0.2):** Translator handling is App responsibility. These tests are legacy and not required for Host v2.0.2 compliance.


### HCTS-TRANS-001: ApplyTranslatorOutput는 FulfillEffect와 분리

* **커버:** TRANS-2
* **시나리오:** translator fragments 주입 → host는 ApplyTranslatorOutput job으로 처리
* **검증:** requirement clear가 발생하면 안 됨(Translator는 Core Requirement가 아님)

### HCTS-TRANS-002: Lower→Evaluate→Apply는 “한 job”에서 동기 실행

* **커버:** TRANS-3, TRANS-4
* **검증(트레이스로 잡기 좋음):**

    * `job:start(ApplyTranslatorOutput)` ~ `job:end(...)` 사이에

        * `compiler:lower`
        * `compiler:evaluate`
        * `core:apply(source=translator)`
    * 이 3개가 모두 존재하고,
    * 그 사이에 다른 job이 끼면 FAIL(스플릿/await 의심)

---

# 4) “가장 먼저 구현할” Minimal Suite (진짜 핵심 8개)

너가 지금 v2.0을 밀고 가는 목적이 “안전한 실행”이면, 최소 이 8개는 **무조건**이야:

1. HCTS-RUN-001
2. HCTS-LIVE-001
3. HCTS-LIVE-002 (lost wakeup)
4. HCTS-JOB-001 (await ban)
5. HCTS-INTERLOCK-001
6. HCTS-REQ-001
7. HCTS-FULFILL-001 (stale)
8. HCTS-FULFILL-002 (apply 실패에도 clear)

이 8개만 통과해도:

* 무한루프
* 중복효과
* 영구 스톨
* 비결정 적용

이 4대 사고는 거의 차단돼.
