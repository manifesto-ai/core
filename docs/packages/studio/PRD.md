# PRD: `@manifesto-ai/studio`

문서 버전: v0.1 (Draft)
작성일: 2025-12-25
상태: Draft / MVP 범위 확정용

## 참고문서

### 관련 패키지 문서
* [Compiler PRD](../compiler/PRD.md)
* [Core Overview](../core/en/01-overview.md)
* [Expression DSL](../core/en/04-expression-dsl.md)
* [Effect System](../core/en/05-effect-system.md)
* [DAG Propagation](../core/en/06-dag-propagation.md)
* [Runtime](../core/en/07-runtime.md)

### 아이디에이션 문서
* [Studio Ideation](./IDEA.md)

---

## 1. 배경과 문제 정의

### 1.1 배경

Manifesto는 "AI Native Semantic Layer"로서, 비즈니스 로직을 AI가 읽고 이해하고 안전하게 조작할 수 있는 선언적 구조로 표현한다. `@manifesto-ai/core`는 Runtime, DAG, Expression DSL을, `@manifesto-ai/compiler`는 자연어/코드를 Manifesto Fragment로 변환하는 기능을 제공한다.

### 1.2 문제

현재 Manifesto 생태계의 진입 장벽:

1. **개념 밀도**: SemanticPath, Expression DSL, Effect, Policy 등 학습해야 할 개념이 많음
2. **시각화 부재**: DAG 기반 의존성 흐름을 머릿속으로 추적해야 함
3. **디버깅 어려움**: 값이 왜 그렇게 계산되었는지, Policy가 왜 막히는지 파악 어려움
4. **테스트 도구 부재**: 도메인을 시뮬레이션 테스트할 표준 방법이 없음
5. **Compiler 검증 필요**: Compiler의 Fragment 생성 품질을 실제 사용 환경에서 검증 필요

### 1.3 핵심 요구사항(요약)

* Manifesto Domain을 **시각적으로 편집**할 수 있어야 함
* **DAG를 시각화**하여 의존성 흐름을 직관적으로 파악
* **실시간 검증**으로 이슈를 즉시 확인하고 수정
* **시나리오 기반 테스트**로 도메인 동작 검증
* **Compiler 연동**으로 자연어 입력 지원 (결정론적 루프 우선)

---

## 2. 제품 비전

> **Manifesto Domain을 시각적으로 편집하고, 실시간 검증하며, 시뮬레이션 테스트하는 웹 IDE**

`@manifesto-ai/studio`는 다음을 제공한다:

* 문서형 + 블록 채팅 하이브리드 편집기
* React Flow 기반 DAG 시각화
* 실시간 `validateDomain` 이슈 패널
* 시나리오 기반 시뮬레이션 테스트
* TypeScript/JSON 코드 익스포트

---

## 3. 목표와 비목표

### 3.1 목표(Goals)

1. **DAG 시각화**
   * SemanticPath 기반 노드와 의존성 엣지를 시각적으로 표현
   * 노드 선택 시 Explain(값 추적), Impact(영향 범위) 표시

2. **실시간 검증**
   * `validateDomain` 이슈를 즉시 표시
   * 원클릭 수정 제안 (PatchHint 활용)

3. **시나리오 테스트**
   * Given-When-Then 형식의 테스트 케이스 정의
   * Effect 모킹을 통한 안전한 시뮬레이션

4. **자연어 입력 (Compiler 연동)**
   * 블록 단위 AI 채팅으로 Fragment 생성/수정
   * 결정론적 Linker/Verifier 루프 우선

5. **코드 익스포트**
   * `defineDomain` TypeScript 코드 생성
   * JSON/Fragment 형식 출력

### 3.2 비목표(Non-goals, MVP)

* **코드 에디터 대체**: VS Code 수준의 에디터가 아님
* **IDE 플러그인**: VS Code/IntelliJ 통합은 Post-MVP
* **실시간 협업**: 다중 사용자 동시 편집은 Post-MVP
* **모바일 지원**: 데스크탑 우선, 반응형은 최소한만

---

## 4. 사용자/페르소나

### 4.1 AI Agent 개발자 (Primary)

* Manifesto 기반 Agent를 만드는 개발자
* Agent가 조작할 비즈니스 로직을 안전하게 정의해야 함
* **핵심 니즈**: "Agent가 이해하고 조작할 수 있는 구조를 빠르게 만들고 싶다"

### 4.2 풀스택 개발자 (Secondary)

* React/Next.js 앱에 Manifesto를 도입하려는 개발자
* 복잡한 상태 관리와 폼 검증이 필요함
* **핵심 니즈**: "로직 흐름을 시각화하며 개발하고 싶다"

### 4.3 기획자/PM (Tertiary)

* 비즈니스 로직을 개발자와 함께 설계하는 역할
* 요구사항을 표현하고 결과를 확인하고 싶음
* **핵심 니즈**: "기획 의도가 어떻게 구현되는지 보고 싶다"

---

## 5. 핵심 사용자 시나리오

### 시나리오 A: 도메인 시각화 및 탐색

1. 사용자가 기존 도메인 정의를 불러옴
2. DAG 뷰에서 모든 노드와 의존성을 시각적으로 확인
3. 노드 클릭 시 Explain 패널에서 값의 계산 과정 확인
4. 값 변경 시뮬레이션으로 Impact 미리보기

### 시나리오 B: 새 도메인 생성

1. 빈 캔버스에서 시작
2. Schema 블록 추가: 데이터 필드 정의
3. Derived 블록 추가: 계산 로직 정의
4. Action 블록 추가: 실행 가능한 행동 정의
5. 실시간으로 DAG에 노드가 추가됨
6. 이슈 패널에서 `MISSING_DEPENDENCY` 등 문제 확인 및 수정

### 시나리오 C: 자연어로 수정

1. 기존 Derived 블록 옆의 채팅 버튼 클릭
2. "이 조건에 최소 주문 금액 10000원 추가해줘"
3. Compiler가 Expression 수정 제안
4. 사용자가 승인하면 해당 블록만 업데이트

### 시나리오 D: 시뮬레이션 테스트

1. 시나리오 패널에서 테스트 케이스 작성:
   ```
   Given: items = [{id: "A", quantity: 2, price: 10000}]
   When: checkout action
   Then: total = 20000, checkout.completed = true
   ```
2. 실행 버튼 클릭
3. 각 스텝의 상태 변화를 DAG에서 애니메이션으로 표시
4. 예상 결과와 비교하여 Pass/Fail 표시

### 시나리오 E: 코드 익스포트

1. 도메인 편집 완료
2. Export 버튼 클릭
3. TypeScript `defineDomain` 코드 또는 JSON 다운로드
4. 프로젝트에 붙여넣기

---

## 6. 제품 범위(기능 요구사항)

### 6.1 도메인 에디터

#### 6.1.1 블록 타입

* **Schema Block**: 데이터 필드 정의 (type, validation)
* **Derived Block**: 계산 로직 (Expression DSL)
* **Action Block**: 실행 가능한 행동 (preconditions, effect)
* **Policy Block**: 필드/액션 정책 (ConditionRef)

#### 6.1.2 편집 인터랙션

* 드래그앤드롭으로 블록 순서 변경
* 블록 내 인라인 편집
* 블록별 AI 채팅 버튼 (Compiler 연동)
* 블록 복제/삭제

### 6.2 DAG 시각화

#### 6.2.1 노드 타입과 스타일

| 노드 타입 | 색상 | prefix |
|----------|------|--------|
| Data | 파랑 | `data.*` |
| Derived | 초록 | `derived.*` |
| State | 노랑 | `state.*` |
| Action | 빨강 | `action.*` |

#### 6.2.2 인터랙션

* **호버**: 현재 값 툴팁
* **클릭**: 상세 패널 (Explain, Impact, Edit)
* **줌/팬**: React Flow 기본 제공
* **미니맵**: 대규모 도메인 네비게이션

#### 6.2.3 Explain 패널

* 현재 값
* 계산 과정 (ExplanationTree)
* 의존 경로 하이라이트
* 값 변경 시뮬레이션 입력

#### 6.2.4 Impact 패널

* 직접 영향받는 경로
* 간접 영향받는 경로
* 영향받는 Action 목록

### 6.3 시나리오 테스트

#### 6.3.1 시나리오 정의 형식

```yaml
name: 결제 플로우 테스트
given:
  data.items:
    - { id: "A", quantity: 2, price: 10000 }
  data.user.isLoggedIn: true
when:
  - action: checkout
then:
  derived.total: 20000
  state.checkout.completed: true
```

#### 6.3.2 실행 모드

* **Full Run**: 모든 스텝 실행 후 결과 비교
* **Step-by-Step**: 각 스텝 개별 실행, 중간 상태 확인
* **Diff View**: 초기 상태와 최종 상태 비교

#### 6.3.3 Effect 모킹

```typescript
// Mock Handler 등록
registerMock('apiCall', (endpoint) => {
  if (endpoint === '/api/checkout') {
    return { success: true, orderId: 'mock-123' };
  }
});
```

### 6.4 이슈 패널

#### 6.4.1 이슈 표시

* 실시간 `validateDomain` 결과 반영
* 심각도별 그룹핑 (Error, Warning, Info)
* 관련 노드 하이라이트

#### 6.4.2 이슈 코드 (core 호환)

* `MISSING_DEPENDENCY`
* `CYCLIC_DEPENDENCY`
* `INVALID_PATH`
* `SCHEMA_MISMATCH`
* `EFFECT_RISK_TOO_HIGH`
* 기타 `validateDomain` 이슈 코드

#### 6.4.3 수정 제안

* PatchHint 기반 원클릭 수정
* "Add missing field" 버튼
* "Remove unused path" 버튼

### 6.5 코드 익스포트

#### 6.5.1 출력 형식

* **TypeScript**: `defineDomain({ ... })` 코드
* **JSON**: Domain 정의 객체
* **Fragments**: 개별 Fragment JSON

#### 6.5.2 Schema Descriptor

Zod 스키마의 직렬화 문제 해결:

```typescript
// 내부: Schema Descriptor (JSON)
{
  type: 'object',
  properties: {
    quantity: { type: 'number', minimum: 1 }
  }
}

// 익스포트: Zod 코드로 변환
z.object({
  quantity: z.number().min(1)
})
```

### 6.6 NL 입력 (Compiler 연동)

#### 6.6.1 결정론적 루프 우선

1. 수동 Fragment 편집
2. Linker → Verifier 실행
3. 이슈 해결
4. 도메인 완성

#### 6.6.2 LLM 연동 (Phase 4)

1. 블록별 채팅 입력
2. Compiler Pass 실행 → Fragment 생성
3. 결정론적 루프로 검증
4. 사용자 승인 후 적용

---

## 7. 비기능 요구사항

### 7.1 성능

* 100개 노드 DAG에서 60fps 렌더링
* 시나리오 실행 1초 이내 (Effect 제외)
* 초기 로딩 3초 이내

### 7.2 접근성

* 키보드 네비게이션 지원
* 스크린 리더 기본 지원
* 고대비 테마 옵션

### 7.3 반응형

* 데스크탑 우선 (1280px+)
* 태블릿 최소 지원 (768px+)
* 모바일은 읽기 전용 (Post-MVP)

### 7.4 브라우저 호환성

* Chrome, Firefox, Safari 최신 2개 버전
* Edge 최신 버전

---

## 8. 기술 아키텍처

### 8.1 기술 스택

| 레이어 | 기술 |
|--------|------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, TailwindCSS, shadcn/ui |
| DAG 시각화 | React Flow |
| 상태 관리 | Zustand |
| 에디터 | TipTap / BlockNote (검토 필요) |
| API | Next.js API Routes |
| LLM | OpenAI (기본), Provider 추상화 |

### 8.2 패키지 구조

```
apps/studio/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 랜딩
│   │   ├── editor/             # 에디터 페이지
│   │   └── api/                # API Routes
│   ├── components/
│   │   ├── editor/             # 블록 에디터
│   │   ├── dag/                # DAG 시각화
│   │   ├── scenario/           # 시나리오 테스트
│   │   ├── issues/             # 이슈 패널
│   │   └── export/             # 익스포트
│   ├── lib/
│   │   ├── domain/             # Domain 관리
│   │   ├── compiler/           # Compiler 연동
│   │   ├── runtime/            # Runtime 래퍼
│   │   └── mock/               # Effect 모킹
│   └── stores/                 # Zustand 스토어
├── package.json
└── tsconfig.json
```

### 8.3 의존성

```json
{
  "dependencies": {
    "@manifesto-ai/core": "workspace:*",
    "@manifesto-ai/compiler": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "reactflow": "^11.0.0",
    "zustand": "^5.0.0"
  }
}
```

### 8.4 API 설계

#### Domain CRUD

```typescript
// GET /api/domain/:id
// POST /api/domain
// PUT /api/domain/:id
// DELETE /api/domain/:id
```

#### Compiler 연동

```typescript
// POST /api/compile
{
  input: string,           // 자연어 또는 코드
  fragmentId?: string,     // 수정 대상 (옵션)
  context: FragmentContext // 주변 컨텍스트
}
```

#### Scenario 실행

```typescript
// POST /api/scenario/run
{
  domainId: string,
  scenario: ScenarioDefinition,
  mocks: MockHandlers
}
```

---

## 9. MVP 마일스톤

### Phase 0: 프로젝트 셋업

* [ ] apps/studio 디렉토리 생성
* [ ] Next.js 15 + TailwindCSS + shadcn/ui 설정
* [ ] @manifesto-ai/core, @manifesto-ai/compiler 연동
* [ ] 기본 레이아웃 구성

### Phase 1: 도메인 에디터 + 검증

* [ ] 블록 에디터 기본 구현
* [ ] Schema/Derived/Action 블록 타입
* [ ] `validateDomain` 연동
* [ ] 이슈 패널 구현
* [ ] PatchHint 기반 수정 제안

### Phase 2: DAG 시각화

* [ ] React Flow 통합
* [ ] 노드 타입별 스타일링
* [ ] Explain 패널 (ExplanationTree)
* [ ] Impact 패널 (getImpact)
* [ ] 에디터 ↔ DAG 동기화

### Phase 3: 시나리오 실행

* [ ] 시나리오 정의 UI
* [ ] Effect 모킹 시스템
* [ ] 시나리오 실행 엔진
* [ ] 결과 비교 및 표시
* [ ] Step-by-step 실행

### Phase 4: Compiler 연동

* [ ] 블록별 채팅 UI
* [ ] Compiler API 연동
* [ ] Fragment 적용 워크플로우
* [ ] 결정론적 검증 루프

### Phase 5: 익스포트 및 마무리

* [ ] TypeScript 코드 생성
* [ ] JSON/Fragment 익스포트
* [ ] 템플릿 (E-commerce, Form, Search)
* [ ] 문서화

---

## 10. 성공 지표

1. **개발 시간 단축**
   * Manifesto 도메인 정의 시간 50% 감소 (vs 수동 코딩)

2. **디버깅 효율**
   * "왜 이 값인지" 파악 시간 80% 감소

3. **학습 곡선**
   * 첫 도메인 생성까지 30분 이내

4. **Compiler 검증**
   * Compiler 생성 Fragment의 검증 통과율 측정

5. **사용자 만족도**
   * NPS (Net Promoter Score) 50 이상

---

## 11. 리스크와 대응

1. **대규모 DAG 성능**
   * 대응: 가상화, 뷰포트 기반 렌더링

2. **Schema Descriptor 복잡성**
   * 대응: 단순 타입부터 시작, 점진적 확장

3. **Effect 모킹 한계**
   * 대응: 명확한 한계 문서화, 실제 테스트 가이드

4. **Compiler 불안정**
   * 대응: 결정론적 루프 우선, LLM은 보조

---

## 12. 오픈 이슈

* 블록 에디터 라이브러리 선택 (TipTap vs BlockNote vs 자체 구현)
* 도메인 저장소 (로컬 스토리지 vs 서버 DB)
* 인증/인가 필요 여부 (MVP에서)

---

## 요약

`@manifesto-ai/studio`는 Manifesto Domain을 **시각적으로 편집**하고, **DAG로 시각화**하며, **실시간 검증**과 **시나리오 테스트**를 제공하는 웹 IDE다. **결정론적 루프를 우선**하고 **LLM은 보조**로 활용하여, 안정적이고 예측 가능한 도메인 개발 경험을 제공한다.
