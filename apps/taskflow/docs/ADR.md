
# 📘 기획서: **LLM-as-Intent-Compiler 아키텍처 도입**

## 문서 목적

본 문서는 TaskFlow 시스템을
**LLM 중심 실행 구조 → Intent-Native Deterministic Runtime**으로 전환하기 위한
구조적 개편을 정의한다.

이 개편의 핵심 목표는 다음과 같다:

1. LLM을 **실행 경로에서 제거**
2. LLM을 **입출력 전용 컴파일러/인터프리터**로 격하
3. 시스템의 모든 상태 변경을 **결정론적 Runtime**에서만 수행
4. 언어 의존성을 제거하고 **Intent를 공용 의미 단위**로 확립

---

## 1️⃣ 설계 철학 (헌법)

### 1.1 기본 원칙

* **LLM은 진실을 만들지 않는다**
* **Runtime만이 상태를 변경한다**
* **Intent는 시스템의 유일한 공용 언어다**
* **자연어는 인터페이스일 뿐이다**

### 1.2 역할 분리 선언

| 컴포넌트              | 역할                         | 권한       |
| ----------------- | -------------------------- | -------- |
| LLM (Compiler)    | 자연어 → Intent 변환            | ❌ 상태 변경  |
| Runtime           | Intent → Effect → Snapshot | ✅ 유일한 실행 |
| LLM (Interpreter) | Snapshot → 자연어 설명          | ❌ 정책/결정  |

---

## 2️⃣ 목표 아키텍처 개요

```
[Human]
  └─ Natural Language
        ↓
[LLM Intent Compiler]
  └─ Intent AST
        ↓
[Intent-Native Runtime]
  └─ Deterministic Effects
        ↓
[Snapshot / State]
        ↓
[LLM Result Interpreter]
  └─ Natural Language
```

* LLM은 **앞(입력)** 과 **뒤(출력)** 에만 존재
* 실행 경로 중앙에는 **LLM이 존재하지 않음**

---

## 3️⃣ Intent AST 정의 (핵심 산출물)

### 3.1 Intent의 정의

> Intent는 “무엇을 하고 싶은가”에 대한
> **완결된 의미 단위(AST)** 이다.

* 부분 JSON ❌
* 추론 여지 ❌
* 항상 검증 가능해야 함 ⭕

### 3.2 Intent 공통 인터페이스

```ts
interface BaseIntent {
  kind: string;
  confidence: number;            // LLM 신뢰도
  source: 'human' | 'agent';     // 생성 주체
}
```

### 3.3 초기 Intent 타입 (v1)

```ts
type Intent =
  | ChangeView
  | SetDateFilter
  | CreateTask
  | UpdateTask
  | DeleteTask
  | SelectTask
  | QueryTasks;
```

#### 예시: ChangeView

```ts
interface ChangeView extends BaseIntent {
  kind: 'ChangeView';
  viewMode: 'kanban' | 'table' | 'todo';
}
```

> ⚠️ Intent는 반드시 **단일 의미만 포함**한다
> (복합 Intent는 허용하지 않음)

---

## 4️⃣ LLM Intent Compiler 설계

### 4.1 역할 정의

LLM Intent Compiler는:

* 자연어를 **Intent AST 하나**로 변환한다
* Effect, 상태, 규칙을 **절대 생성하지 않는다**

### 4.2 입력

* 사용자 자연어
* Intent AST 타입 정의 (요약본)

### 4.3 출력 (유일 허용 형식)

```json
{
  "intent": {
    "kind": "ChangeView",
    "viewMode": "kanban",
    "confidence": 0.93,
    "source": "human"
  }
}
```

### 4.4 금지 사항

* ❌ Effect 생성
* ❌ snapshot.patch 생성
* ❌ 자연어 설명
* ❌ 다중 Intent 반환

---

## 5️⃣ Runtime 실행 규칙

### 5.1 Runtime의 책임

Runtime은 다음 단계만 수행한다:

1. Intent Schema 검증
2. 권한/맥락 검증
3. Intent → Effect 변환 (결정론)
4. Snapshot 업데이트

### 5.2 Intent → Effect 매핑 예시

```ts
function executeIntent(intent: Intent): Effect[] {
  switch (intent.kind) {
    case 'ChangeView':
      return [setViewMode(intent.viewMode)];
  }
}
```

* Runtime은 Intent를 **해석하지 않는다**
* 오직 구조적으로 처리한다

---

## 6️⃣ LLM Result Interpreter 설계

### 6.1 역할 정의

Result Interpreter는:

* 실행 결과를 **자연어로 설명**한다
* 상태를 변경하지 않는다
* 결정을 정당화하지 않는다

### 6.2 입력

```json
{
  "intent": { ... },
  "effects": [...],
  "snapshotDiff": {...}
}
```

### 6.3 출력 예시

```text
칸반 보드로 전환했어요.
현재 할 일 5개 중 2개가 진행 중이에요.
```

> ⚠️ 추천, 제안, 다음 행동 유도는 **옵션 기능**으로 분리

---

## 7️⃣ LLM 제거 경로 (중요)

### 7.1 기본 원칙

* UI / Agent는 **Intent를 직접 생성**할 수 있어야 함
* 이 경우 LLM 호출은 완전히 생략됨

### 7.2 구조

```ts
// UI or Agent
dispatchIntent({
  kind: 'ChangeView',
  viewMode: 'kanban',
  source: 'agent',
  confidence: 1.0
});
```

* 이 경로는 **가장 우선**
* LLM은 인간 입력 전용 보조 수단

---

## 8️⃣ 구현 단계 (Agent Action Items)

### Phase 1 — 헌법 수립 (필수)

* [ ] Intent AST 타입 정의 및 고정
* [ ] Intent → Effect 매핑 테이블 구현

### Phase 2 — Compiler 도입

* [ ] LLM Intent Compiler 프롬프트 최소화
* [ ] Compiler 출력 검증 로직 추가

### Phase 3 — Interpreter 도입

* [ ] Result Interpreter 입력/출력 계약 정의
* [ ] UX 톤 가이드 작성

### Phase 4 — LLM 우회 경로

* [ ] UI/Agent 직접 Intent 생성 API 제공
* [ ] LLM fallback 경로 유지

---

## 9️⃣ 성공 기준 (Done Definition)

* 단순 명령 실행 시 **LLM 호출 0회**
* 모든 상태 변경이 Runtime에서만 발생
* Intent 단위 테스트 가능
* LLM 교체 시 Runtime 영향 0

---

## 10️⃣ 결론 (결정 사항)

> **TaskFlow는 더 이상 “AI가 일을 하는 시스템”이 아니다.
> “의미(Intent)가 일을 하는 시스템”이다.**

LLM은:

* 컴파일러
* 인터프리터
* 옵션

Runtime은:

* 법
* 진실
* 실행자

---

이 문서는 **설계 제안이 아니라 결정 사항**이다.
에이전트는 이 문서를 기준으로 구현을 진행한다.
모든 신규 기능은 이 아키텍처 원칙을 준수해야 한다.
