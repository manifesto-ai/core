
# Product Requirements Document (PRD)

## Project: `@manifesto-ai/ai`

### The AI-Native SaaS UI Generation Platform

| 문서 버전 | 1.0 |
| :--- | :--- |
| **작성일** | 2025년 12월 6일 |
| **상태** | Draft (기획 확정) |
| **목표** | AI 에이전트가 단일 Entity를 기반으로 일관성 있는 Full-Cycle SaaS UI(List, Form, Detail, Dashboard)를 생성하고 운용하도록 지원 |

-----

## 1\. Executive Summary (개요)

\*\*`@manifesto-ai/ai`\*\*는 AI(LLM)와 Frontend UI 사이의 \*\*'Architectural Bridge'\*\*입니다.
기존의 AI 코딩 도구(v0, Bolt 등)가 단편적인 "컴포넌트 코드"를 생성하는 데 그쳤다면, 본 프로젝트는 **"비즈니스 Entity"를 정의하고 이를 기반으로 서로 연동된 완벽한 애플리케이션 뷰 집합(View Suite)을 생성**합니다.

이 라이브러리는 **Manifesto Engine**을 위한 스키마(Schema)를 생성하며, 생성된 UI는 \*\*100% 결정론적(Deterministic)이고, 보안이 유지되며, 즉시 실행 가능(Instant Run)\*\*합니다.

-----

## 2\. Problem Statement (문제 정의)

1.  **파편화된 생성 (Fragmentation):** AI에게 "목록"과 "상세"를 따로 요청하면, 필드 명칭이나 디자인 스타일이 불일치하는 문제가 발생함.
2.  **비즈니스 로직 부재 (No Logic):** 예쁜 UI는 잘 그리지만, "VIP 고객만 버튼 보임" 같은 조건부 로직이나 유효성 검사(Validation)는 누락되거나 오류가 많음.
3.  **수정의 어려움 (Hard to Maintain):** 생성된 코드는 'Fire-and-forget' 방식이라, Entity에 필드 하나가 추가되면 관련된 모든 파일(List, Form, Detail)을 사람이 찾아 다니며 고쳐야 함.

## 3\. Core Philosophy (핵심 철학)

1.  **Entity-First:** 모든 뷰(View)는 Entity Schema라는 'Single Source of Truth'에서 파생된다.
2.  **View-Agnostic Generation:** AI는 특정 UI 라이브러리에 종속되지 않는 순수한 '구조(Plan)'를 생성하고, 엔진이 이를 렌더링한다.
3.  **Lifecycle Management:** 생성(Create)뿐만 아니라 수정(Update), 동기화(Sync)까지 책임진다.

-----

## 4\. Key Features & Specifications (상세 기능)

### 4.1. Planner Layer (The Brain)

자연어 요구사항을 분석하여 \*\*'어떤 뷰들이 필요한가'\*\*를 설계하는 단계입니다.

* **Intent Analysis:** 사용자의 모호한 요청("고객 관리 시스템 만들어줘")을 구체적인 View Plan으로 변환.
* **Input:** Natural Language Prompt
* **Output:** `ViewPlan[]`
  ```typescript
  { viewType: 'list', purpose: 'search', entity: 'Customer' },
  { viewType: 'form', purpose: 'create', entity: 'Customer' }
  ```

### 4.2. Entity Generator (The Heart)

도메인 지식을 주입하여 완벽한 데이터 모델을 생성합니다.

* **Automatic Inference:** 필드 타입, 제약 조건(Required, Regex), 관계(1:N, M:N) 자동 추론.
* **Context Injection:** 산업군(금융, 커머스 등)에 따른 네이밍 컨벤션 및 필수 필드 자동 제안.
* **Output:** `EntitySchema` (Manifesto Engine 호환)

### 4.3. View Generators (The Hands)

Entity 정보를 바탕으로 각 View의 목적에 맞는 최적의 UX를 생성합니다.

* **List Generator:** 주요 컬럼 자동 선정(Smart Column Selection), 필터/정렬/페이지네이션 자동 구성.
* **Form Generator:** 필드 타입에 따른 입력 위젯 매핑, 섹션(Section) 자동 분리.
* **Detail Generator:** Read-only 뷰 구성, 연관 데이터(Relations) 표시.
* **Dashboard Generator:** 집계(Aggregation) 데이터 시각화 위젯 배치.
* **App Shell Generator:** (New) 생성된 뷰들을 담을 네비게이션 구조 및 레이아웃 생성.

### 4.4. Condition Generator (The Law)

자연어로 된 비즈니스 규칙을 실행 가능한 **Expression AST**로 변환합니다.

* **Template-First Strategy:** 자주 쓰이는 패턴(권한 체크, 상태 의존성)은 룰 기반으로 생성하여 환각 방지.
* **LLM Fallback:** 복잡한 조건은 LLM을 통해 AST로 변환 후 검증.
* **Target:** `visibility`, `disabled`, `validation`, `reactions`

### 4.5. Sync Manager (Consistency)

Entity 스키마 변경 시, 의존성이 있는 모든 View를 자동으로 동기화합니다.

* **Event:** `field-added`, `field-removed`, `type-changed` 감지.
* **Auto-Refactoring:**
    * Entity에 `phone` 추가 → Form에 Input 추가, List에 Column 추가(옵션), Detail에 Row 추가.

### 4.6. Refiner Agent (Conversation)

대화형으로 스키마를 미세 조정(Refine)합니다.

* **Multi-turn Context:** 이전 수정 이력을 기억하여 맥락 유지.
* **Action Tracking:** 사용자의 수정 요청을 `AddColumn`, `HideSection` 등의 명시적 액션으로 기록.

-----

## 5\. Technical Architecture

```mermaid
graph TD
    User[User Prompt] --> Planner[Planner Layer]
    Planner -->|ViewPlan[]| EntityGen[Entity Generator]
    EntityGen -->|EntitySchema| ViewGen[View Generators]
    
    subgraph Generators
        ViewGen --> ListGen[List Generator]
        ViewGen --> FormGen[Form Generator]
        ViewGen --> DetailGen[Detail Generator]
        ViewGen --> DashGen[Dashboard Generator]
    end
    
    EntityGen --> ConditionGen[Condition Generator]
    ConditionGen -->|AST Logic| Generators
    
    Generators -->|Draft Schemas| SyncMgr[Sync Manager]
    SyncMgr -->|Consistency Check| Output[Final JSON Schema]
    
    Output --> Refiner[Refiner Agent]
    Refiner -->|Modification| SyncMgr
    
    Output -->|JSON| Engine[🛡️ Manifesto Engine]
    Engine -->|Render| UI[Instant SaaS UI]
```

-----

## 6\. Development Roadmap

### Phase 1: MVP (Core Engine)

* **목표:** "텍스트 한 줄로 List + Form + Detail이 완벽하게 연동된 CRUD 생성"
* **범위:**
    * `Entity Generator` (기본 타입 추론)
    * `List/Form/Detail Generator` (기본 템플릿 적용)
    * `@manifesto-ai/ai` 패키지 구조 셋업

### Phase 2: Logic & Consistency (The Brain)

* **목표:** "비즈니스 로직이 포함된 실제 사용 가능한 앱 생성"
* **범위:**
    * `Planner Layer` 구현 (Intent 분석)
    * `Condition Generator` (Expression AST 변환)
    * `Sync Manager` (Entity 변경 시 View 전파)

### Phase 3: Advanced & Operations (Enterprise Ready)

* **목표:** "대화형 수정 및 복잡한 대시보드/위자드 지원"
* **범위:**
    * `Refiner Agent` (대화형 수정 모듈)
    * `Dashboard / Wizard Generator`
    * `App Shell Generator` (네비게이션 구조)
    * `Mock Data & API Spec` 자동 생성

-----

## 7\. Success Metrics (성공 지표)

1.  **Time-to-App:** 자연어 프롬프트 입력 후, 실행 가능한 CRUD 앱이 렌더링 되기까지 걸리는 시간 **\< 10초**.
2.  **Consistency Rate:** 생성된 List, Form, Detail 간의 필드 명칭 및 타입 일치율 **100%**.
3.  **Interaction Cost:** 사용자가 생성 후 수정(Refine)을 위해 입력해야 하는 대화 턴 수 **평균 2회 미만**.

-----

## 8\. Definition of Done (예시 출력)

사용자가 \*\*"보험 계약 관리 시스템"\*\*을 요청했을 때, 라이브러리는 다음 JSON 객체를 반환해야 함.

```json
{
  "app": {
    "title": "보험 계약 관리",
    "nav": [...]
  },
  "entities": {
    "contract": { "fields": [ ... ] } // Single Source
  },
  "views": {
    "contract-list": {
      "type": "ListView",
      "entity": "contract",
      "columns": ["policyNo", "customerName", "status", "premium"],
      "filters": ["status", "dateRange"]
    },
    "contract-form": {
      "type": "FormView",
      "entity": "contract",
      "sections": [
        { "title": "기본 정보", "fields": ["customerName", "policyType"] },
        { "title": "계약 조건", "fields": ["startDate", "endDate", "premium"] }
      ],
      "validation": { ... }
    }
  }
}
```
