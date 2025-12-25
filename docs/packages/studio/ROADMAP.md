# Studio Development Roadmap

문서 버전: v1.0
최종 업데이트: 2025-12-25
상태: Phase 2 완료

---

## 전체 진행 현황

```
Phase 0: 프로젝트 셋업        ████████████ 100% ✅
Phase 1: 도메인 에디터        ████████████ 100% ✅
Phase 1.5: Expression Editor  ████████████ 100% ✅
Phase 2: DAG 시각화           ████████████ 100% ✅
Phase 3: 시나리오 테스트      ░░░░░░░░░░░░   0%
Phase 4: Compiler 연동        ░░░░░░░░░░░░   0%
Phase 5: 익스포트             ████████████ 100% ✅
```

**테스트 현황**: 236 tests passing (9 test files)

---

## Phase 0: 프로젝트 셋업 ✅

Next.js 15 기반 Studio 앱 초기 설정.

| 항목 | 상태 | 파일/위치 |
|------|------|-----------|
| Next.js 15 + App Router | ✅ | `apps/studio/` |
| TailwindCSS + shadcn/ui | ✅ | `tailwind.config.ts` |
| @manifesto-ai/core 연동 | ✅ | `package.json` |
| @manifesto-ai/bridge-react 연동 | ✅ | `runtime/` |
| 기본 레이아웃 | ✅ | `components/layout/` |

---

## Phase 1: 도메인 에디터 + 검증 ✅

TipTap 기반 블록 에디터와 실시간 검증 시스템.

| 항목 | 상태 | 파일/위치 |
|------|------|-----------|
| TipTap 블록 에디터 | ✅ | `components/editor/` |
| Schema Block | ✅ | `blocks/SchemaBlock.tsx` |
| Derived Block | ✅ | `blocks/DerivedBlock.tsx` |
| Action Block | ✅ | `blocks/ActionBlock.tsx` |
| Policy Block | ✅ | `blocks/PolicyBlock.tsx` |
| `validateDomain` 연동 | ✅ | `runtime/validation.ts` |
| 순환 의존성 탐지 | ✅ | `runtime/dag-validation.ts` |
| 이슈 패널 | ✅ | `components/issues/` |
| PatchHint 수정 제안 | ✅ | `IssueItem.tsx` |

**테스트**: `validation.test.ts` (26 tests), `dag-validation.test.ts` (16 tests)

---

## Phase 1.5: Expression Editor ✅

시각적 Expression DSL 편집기.

| 항목 | 상태 | 파일/위치 |
|------|------|-----------|
| 시각적 트리 편집기 | ✅ | `expression/ExpressionEditor.tsx` |
| 100+ 연산자 지원 | ✅ | `expression/operators.ts` |
| Copy/Paste | ✅ | `expression/clipboard.ts` |
| Undo/Redo | ✅ | `expression/useExpressionHistory.ts` |
| Drag & Drop (variadic) | ✅ | `expression/` |
| Expression 검증 | ✅ | `expression/expression-validation.ts` |
| Expression 평가 | ✅ | `expression/expression-evaluator.ts` |

**테스트**:
- `expression-validation.test.ts` (40 tests)
- `expression-evaluator.test.ts` (54 tests)
- `operators.test.ts` (21 tests)
- `types.test.ts` (23 tests)
- `useExpressionHistory.test.ts` (21 tests)

---

## Phase 2: DAG 시각화 ✅

React Flow 기반 의존성 그래프 시각화.

| 항목 | 상태 | 파일/위치 |
|------|------|-----------|
| @xyflow/react 통합 | ✅ | `components/dag/` |
| dagre 자동 레이아웃 | ✅ | `dag/layout/dagre-layout.ts` |
| StudioNode 컴포넌트 | ✅ | `dag/nodes/StudioNode.tsx` |
| DependencyEdge 컴포넌트 | ✅ | `dag/edges/DependencyEdge.tsx` |
| useStudioGraph 훅 | ✅ | `dag/hooks/useStudioGraph.ts` |
| DAGView 메인 컴포넌트 | ✅ | `dag/DAGView.tsx` |
| EditorLayout 탭 통합 | ✅ | `layout/EditorLayout.tsx` |
| Explain 패널 | ✅ | `dag/panels/ExplainPanel.tsx` |
| Impact 패널 | ✅ | `dag/panels/ImpactPanel.tsx` |
| 에디터 ↔ DAG 동기화 | ✅ | `selectedBlockId` 연동 |
| Todo App 예시 | ✅ | `domain/examples/todo-app.ts` |

**테스트**: `impact-analysis.test.ts` (18 tests)

### 노드 타입 및 색상

| 타입 | 색상 | prefix | 아이콘 |
|------|------|--------|--------|
| Data | Blue (#3b82f6) | `data.*` | Database |
| Derived | Green (#22c55e) | `derived.*` | Calculator |
| Action | Red (#ef4444) | `action.*` | Zap |
| Policy | Purple (#a855f7) | `policy.*` | Shield |

---

## Phase 3: 시나리오 테스트 (예정)

Given-When-Then 형식의 도메인 로직 테스트 시스템.

### 3.1 개요

사용자가 Action/Policy의 동작을 **시뮬레이션**으로 검증할 수 있는 기능.

```yaml
name: Add Todo Test
given:
  data.todos: []
  data.newTodoText: "Buy milk"
when:
  action: addTodo
then:
  derived.totalCount: 1
  data.todos[0].text: "Buy milk"
```

### 3.2 구현 항목

| 항목 | 상태 | 설명 |
|------|------|------|
| 시나리오 정의 UI | 📋 | Given-When-Then 폼 |
| 시나리오 저장/관리 | 📋 | 도메인별 시나리오 목록 |
| Effect 모킹 시스템 | 📋 | 외부 API 호출 모킹 |
| 시나리오 실행 엔진 | 📋 | Given 적용 → When 실행 → Then 검증 |
| 결과 비교 (Pass/Fail) | 📋 | 예상 vs 실제 diff 표시 |
| Step-by-step 실행 | 📋 | 각 단계별 상태 변화 관찰 |
| 시나리오 익스포트 | 📋 | JSON/YAML 형식 저장 |

### 3.3 기술 구현 방향

```typescript
// 시나리오 타입 정의
interface Scenario {
  id: string;
  name: string;
  description?: string;
  given: Record<string, unknown>;  // 초기 상태
  when: ScenarioAction[];          // 실행할 액션들
  then: Record<string, unknown>;   // 기대 결과
}

interface ScenarioAction {
  action: string;        // action path
  input?: unknown;       // action input
  mockEffects?: Record<string, unknown>;  // effect 결과 모킹
}

// 실행 결과
interface ScenarioResult {
  passed: boolean;
  steps: StepResult[];
  finalState: Record<string, unknown>;
  diff?: StateDiff;  // 실패 시 차이점
}
```

### 3.4 파일 구조 (예상)

```
components/scenario/
├── ScenarioPanel.tsx        # 메인 패널
├── ScenarioEditor.tsx       # Given-When-Then 편집
├── ScenarioRunner.tsx       # 실행 및 결과 표시
├── StepViewer.tsx           # 단계별 상태 표시
└── hooks/
    ├── useScenarioRunner.ts # 실행 로직
    └── useScenarioStore.ts  # 시나리오 저장

runtime/
├── scenario-executor.ts     # 순수 함수: 시나리오 실행
├── scenario-executor.test.ts
├── effect-mocker.ts         # Effect 모킹 유틸
└── effect-mocker.test.ts
```

### 3.5 의존성

- Expression Evaluator (Phase 1.5) - Then 조건 평가
- Runtime Hooks - 상태 조작
- Action 실행 시스템 - When 단계

---

## Phase 4: Compiler 연동 (예정)

AI 기반 도메인 자동 생성/수정 시스템.

### 4.1 개요

자연어 입력을 Manifesto 스키마로 변환하는 **결정론적 검증 루프** 시스템.

```
사용자 입력 → LLM 생성 → validateDomain →
실패 시 재생성 → 성공 시 적용
```

### 4.2 구현 항목

| 항목 | 상태 | 설명 |
|------|------|------|
| 블록별 채팅 UI | 📋 | 노드 선택 후 AI 대화 |
| @manifesto-ai/compiler 연동 | 📋 | Fragment 생성 API |
| 결정론적 검증 루프 | 📋 | LLM 출력 → 검증 → 재시도 |
| Fragment 적용 워크플로우 | 📋 | 생성된 Fragment를 도메인에 병합 |
| 자동 수정 제안 | 📋 | 검증 실패 시 AI 수정 |
| Self-healing | 📋 | 런타임 오류 → AI 수정 제안 |

### 4.3 기술 구현 방향

```typescript
// Compiler 연동 인터페이스
interface CompileRequest {
  input: string;              // 자연어 입력
  context: {
    domain: DomainDefinition; // 현재 도메인
    targetPath?: string;      // 수정 대상 (선택)
    blockType?: BlockType;    // 블록 타입 힌트
  };
}

interface CompileResult {
  success: boolean;
  fragment?: Fragment;        // 생성된 Fragment
  validationIssues?: Issue[]; // 검증 이슈
  retryCount: number;         // 재시도 횟수
}

// 결정론적 루프
async function compileWithValidation(
  request: CompileRequest,
  maxRetries: number = 3
): Promise<CompileResult> {
  for (let i = 0; i < maxRetries; i++) {
    const fragment = await compiler.generate(request);
    const issues = validateFragment(fragment, request.context.domain);

    if (issues.length === 0) {
      return { success: true, fragment, retryCount: i };
    }

    // 이슈를 컨텍스트에 추가하여 재시도
    request = { ...request, previousIssues: issues };
  }

  return { success: false, validationIssues: issues, retryCount: maxRetries };
}
```

### 4.4 파일 구조 (예상)

```
components/compiler/
├── ChatPanel.tsx            # 블록별 AI 채팅
├── SuggestionPreview.tsx    # 생성된 Fragment 미리보기
├── ValidationLoop.tsx       # 검증 루프 상태 표시
└── hooks/
    └── useCompiler.ts       # Compiler API 연동

runtime/
├── compiler-client.ts       # @manifesto-ai/compiler 클라이언트
└── fragment-merger.ts       # Fragment → Domain 병합
```

### 4.5 의존성

- **@manifesto-ai/compiler** 패키지 완성 필요
- OpenAI API 키 설정
- validateDomain (Phase 1)

### 4.6 우선순위 고려사항

Phase 4는 `@manifesto-ai/compiler` 패키지 상태에 따라 범위 조정 가능:

1. **Compiler 준비됨**: 전체 기능 구현
2. **Compiler 미완성**: Mock API로 UI만 구현, 실제 연동은 추후

---

## Phase 5: 익스포트 ✅

도메인 정의를 외부 형식으로 내보내기.

| 항목 | 상태 | 파일/위치 |
|------|------|-----------|
| domain-serializer | ✅ | `runtime/domain-serializer.ts` |
| JSON 익스포트 | ✅ | `.manifesto.json` 형식 |
| JSON 임포트 | ✅ | 파일 업로드 |
| Export UI | ✅ | `EditorToolbar.tsx` |
| Import UI | ✅ | `EditorToolbar.tsx` |

**테스트**: `domain-serializer.test.ts` (17 tests)

---

## 파일 구조 (현재)

```
apps/studio/src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # 랜딩 페이지
│   ├── editor/page.tsx           # 에디터 페이지
│   └── layout.tsx
├── domain/                       # Manifesto 도메인 정의
│   ├── types.ts                  # EditorSource, EditorDerived, etc.
│   ├── studio-domain.ts          # 스튜디오 자체 도메인
│   └── examples/
│       ├── index.ts
│       └── todo-app.ts           # Todo App 예시
├── runtime/                      # 훅 + 순수 함수
│   ├── hooks.ts                  # Typed hooks
│   ├── runtime-provider.tsx      # ManifestoProvider 래퍼
│   ├── validation.ts             # validateDomain
│   ├── dag-validation.ts         # detectCycles
│   ├── domain-serializer.ts      # Export/Import
│   └── impact-analysis.ts        # Impact 분석
├── components/
│   ├── editor/
│   │   ├── Editor.tsx
│   │   ├── EditorToolbar.tsx
│   │   ├── blocks/               # Schema, Derived, Action, Policy
│   │   ├── expression/           # Expression Editor
│   │   └── extensions/           # TipTap extensions
│   ├── dag/
│   │   ├── DAGView.tsx
│   │   ├── types.ts
│   │   ├── nodes/                # StudioNode
│   │   ├── edges/                # DependencyEdge
│   │   ├── hooks/                # useStudioGraph
│   │   ├── panels/               # Explain, Impact
│   │   └── layout/               # dagre-layout
│   ├── issues/                   # IssuesPanel
│   └── layout/                   # EditorLayout
└── lib/
    └── utils.ts
```

---

## 다음 단계 권장

### Option A: Phase 3 (시나리오 테스트)
- **장점**: 독립적으로 구현 가능, 도메인 검증 강화
- **난이도**: 중간
- **예상 규모**: 파일 8-10개, 테스트 50+

### Option B: Phase 4 (Compiler 연동)
- **장점**: AI 기반 도메인 생성으로 사용성 혁신
- **난이도**: 높음 (@manifesto-ai/compiler 의존)
- **예상 규모**: 파일 6-8개, 외부 의존성

### 권장 순서

1. **Phase 3** 먼저 (독립적, 테스트 강화)
2. **Phase 4** 이후 (compiler 패키지 상태 확인 후)

---

## 참고 문서

- [PRD](./PRD.md) - 제품 요구사항
- [IDEA](./IDEA.md) - 아이디어 문서
- [Core Overview](../core/en/01-overview.md)
- [Expression DSL](../core/en/04-expression-dsl.md)
- [Compiler PRD](../compiler/PRD.md)
