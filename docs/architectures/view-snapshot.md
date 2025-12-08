# ViewSnapshot Architecture Specification

> **Implementation Status**: Core package `@manifesto-ai/view-snapshot` is available.
>
> ```bash
> # Install
> pnpm add @manifesto-ai/view-snapshot
> ```

## 1. Overview

### 1.1 What is ViewSnapshot?

ViewSnapshot은 SaaS UI의 현재 상태를 **Agent가 이해하고 조작할 수 있는 형태**로 정규화한 구조입니다. Raw State와 달리, ViewSnapshot은 **시그널만 남기고 노이즈를 제거**하여 LLM의 추론 정확도와 토큰 효율성을 극대화합니다.

### 1.2 Why ViewSnapshot?

| Raw State (As-Is) | ViewSnapshot (To-Be) |
|-------------------|----------------------|
| 구현 세부사항 포함 (React 내부 객체, DOM 관련 정보) | 의도와 상태만 포함 |
| 컴포넌트 간 관계가 코드에만 존재 | 관계(Relation)가 명시적으로 표현됨 |
| 페이지가 복잡해질수록 토큰 폭발 | 압축된 시맨틱 구조 |
| 엔진 내부 구조 변경 시 Agent 코드도 수정 필요 | 안정적인 외부 인터페이스 |

### 1.3 Core Principles

1. **Signal over Noise**: Agent가 판단에 필요한 정보만 포함
2. **Explicit Relations**: 컴포넌트 간 인과관계를 명시적으로 표현
3. **Overlay as Pipeline**: Modal/Dialog/Toast는 정적 노드가 아닌 동적 파이프라인
4. **Immutable Snapshot**: 상태 변경은 Intent를 통해서만, Snapshot은 읽기 전용

---

## 2. Type Definitions

### 2.1 Base Types

```typescript
/**
 * 모든 ViewSnapshot 노드의 기본 인터페이스
 */
interface ViewSnapshotNode {
  nodeId: string;                    // 고유 식별자
  kind: ViewNodeKind;                // 노드 타입
  label?: string;                    // 사람/Agent가 읽을 수 있는 이름
  actions: ViewAction[];             // 이 노드에서 가능한 액션들
}

type ViewNodeKind = 
  | "page" 
  | "tabs" 
  | "form" 
  | "table" 
  | "detailTable"
  | "modal"
  | "dialog"
  | "toast";

/**
 * 액션 정의 - 노드에서 수행 가능한 동작
 */
interface ViewAction {
  type: string;                      // 액션 타입
  label?: string;                    // 표시 이름
  targetNodeId?: string;             // 영향받는 노드 (정적 노드용)
  effect?: string;                   // 대상 노드에 미치는 효과
  condition?: ActionCondition;       // 액션 실행 조건
  overlay?: OverlayConfig;           // 오버레이 생성 설정
}

interface ActionCondition {
  requiresSelection?: boolean;       // 선택 필요 여부
  minSelection?: number;             // 최소 선택 개수
  maxSelection?: number;             // 최대 선택 개수
  requiredFields?: string[];         // 필수 입력 필드
}

/**
 * 오버레이 생성 설정
 */
interface OverlayConfig {
  kind: "modal" | "dialog" | "toast";
  template: string;                  // 오버레이 템플릿 ID
  dataSource?: string;               // 데이터 소스 (selectedRow, selectedRows, form 등)
  messageTemplate?: string;          // 동적 메시지 템플릿 ({count} 등 치환)
}
```

### 2.2 Page Node

```typescript
/**
 * 최상위 페이지 노드
 */
interface PageSnapshot extends ViewSnapshotNode {
  kind: "page";
  children: ViewSnapshotNode[];      // 정적 자식 노드들
  overlays: OverlayInstance[];       // 현재 열린 오버레이 스택
}

/**
 * 런타임에 생성된 오버레이 인스턴스
 */
interface OverlayInstance {
  instanceId: string;                // 런타임 생성 ID
  kind: "modal" | "dialog" | "toast";
  template: string;                  // 사용된 템플릿
  boundData: Record<string, unknown>; // 주입된 데이터
  content?: ViewSnapshotNode;        // 오버레이 내부 컨텐츠 (modal용)
  
  // Dialog 전용
  message?: string;                  // 렌더링된 메시지 (템플릿 치환 완료)
  
  // Toast 전용
  variant?: "success" | "error" | "warning" | "info";
  autoClose?: number;                // 자동 닫힘 시간 (ms)
  
  // 상태
  awaitingResult: boolean;           // Promise 대기 중 여부
}
```

### 2.3 Tabs Node

```typescript
interface TabsSnapshot extends ViewSnapshotNode {
  kind: "tabs";
  activeTabId: string;
  tabs: TabItem[];
}

interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}
```

### 2.4 Form Node

```typescript
/**
 * 폼 노드 - FilterForm, EditForm 등 모든 폼에 사용
 */
interface FormSnapshot extends ViewSnapshotNode {
  kind: "form";
  fields: FieldSnapshot[];
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
}

interface FieldSnapshot {
  id: string;
  type: FieldType;
  label: string;
  value: unknown;
  
  // 상태
  hidden?: boolean;
  disabled?: boolean;
  required?: boolean;
  errors?: string[];
  
  // Select/Radio 전용
  options?: FieldOption[];
}

type FieldType = 
  | "text" 
  | "number" 
  | "select" 
  | "multiselect"
  | "checkbox"
  | "radio"
  | "datepicker"
  | "daterangepicker"
  | "textarea"
  | "file";

interface FieldOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}
```

### 2.5 Table Node

```typescript
interface TableSnapshot extends ViewSnapshotNode {
  kind: "table";
  columns: ColumnDefinition[];
  rows: TableRow[];
  
  // 선택 상태
  selection: {
    mode: "none" | "single" | "multiple";
    selectedRowIds: string[];
  };
  
  // 페이지네이션
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
  
  // 정렬 (선택적)
  sorting?: {
    columnId: string;
    direction: "asc" | "desc";
  };
}

interface ColumnDefinition {
  id: string;
  label: string;
  type?: "text" | "number" | "date" | "status" | "checkbox" | "actions";
  sortable?: boolean;
}

interface TableRow {
  id: string;
  data: Record<string, unknown>;
}
```

### 2.6 Detail Table Node

```typescript
/**
 * 읽기 전용 상세 정보 테이블
 */
interface DetailTableSnapshot extends ViewSnapshotNode {
  kind: "detailTable";
  rows: DetailRow[];
}

interface DetailRow {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "image" | "link" | "button" | "status";
  value: unknown;
  
  // Link 전용
  href?: string;
  
  // Button 전용
  buttonAction?: ViewAction;
}
```

---

## 3. Intent Types

Intent는 Agent가 ViewSnapshot의 상태를 변경하기 위해 발행하는 명령입니다.

### 3.1 Form Intents

```typescript
interface SetFieldValueIntent {
  type: "setFieldValue";
  nodeId: string;
  fieldId: string;
  value: unknown;
}

interface SubmitFormIntent {
  type: "submit";
  nodeId: string;
}

interface ResetFormIntent {
  type: "reset";
  nodeId: string;
}
```

### 3.2 Table Intents

```typescript
interface SelectRowIntent {
  type: "selectRow";
  nodeId: string;
  rowId: string;
  append?: boolean;              // true면 기존 선택에 추가, false면 교체
}

interface SelectAllRowsIntent {
  type: "selectAll";
  nodeId: string;
}

interface DeselectAllRowsIntent {
  type: "deselectAll";
  nodeId: string;
}

interface ChangePageIntent {
  type: "changePage";
  nodeId: string;
  page: number;
}

interface SortColumnIntent {
  type: "sortColumn";
  nodeId: string;
  columnId: string;
  direction?: "asc" | "desc";    // 없으면 토글
}
```

### 3.3 Tabs Intent

```typescript
interface SwitchTabIntent {
  type: "switchTab";
  nodeId: string;
  tabId: string;
}
```

### 3.4 Overlay Intents

```typescript
/**
 * 오버레이 열기 - 데이터 파이프라인 방식
 */
interface OpenOverlayIntent {
  type: "openOverlay";
  template: string;              // 오버레이 템플릿 ID
  boundData?: Record<string, unknown>;  // 직접 데이터 주입
  dataSourceNodeId?: string;     // 데이터를 가져올 노드 (selectedRow 등)
}

/**
 * 오버레이 내 폼 제출 후 닫기 (결과 반환)
 */
interface SubmitOverlayIntent {
  type: "submitOverlay";
  instanceId: string;
}

/**
 * 오버레이 닫기 (취소)
 */
interface CloseOverlayIntent {
  type: "closeOverlay";
  instanceId: string;
}

/**
 * Confirmation Dialog 확인
 */
interface ConfirmDialogIntent {
  type: "confirmDialog";
  instanceId: string;
}

/**
 * Toast 닫기 (수동)
 */
interface DismissToastIntent {
  type: "dismissToast";
  instanceId: string;
}
```

### 3.5 Action Trigger Intent

```typescript
/**
 * 노드에 정의된 액션 트리거
 */
interface TriggerActionIntent {
  type: "triggerAction";
  nodeId: string;
  actionType: string;
}
```

### 3.6 Union Type

```typescript
type ViewIntent =
  // Form
  | SetFieldValueIntent
  | SubmitFormIntent
  | ResetFormIntent
  // Table
  | SelectRowIntent
  | SelectAllRowsIntent
  | DeselectAllRowsIntent
  | ChangePageIntent
  | SortColumnIntent
  // Tabs
  | SwitchTabIntent
  // Overlay
  | OpenOverlayIntent
  | SubmitOverlayIntent
  | CloseOverlayIntent
  | ConfirmDialogIntent
  | DismissToastIntent
  // Generic
  | TriggerActionIntent;
```

---

## 4. Complete Example: Shopping Mall Backoffice

### 4.1 Initial State (No Overlays)

```json
{
  "nodeId": "order-management-page",
  "kind": "page",
  "label": "주문 관리",
  "actions": [],
  "children": [
    {
      "nodeId": "main-tabs",
      "kind": "tabs",
      "label": "메인 탭",
      "activeTabId": "orders",
      "tabs": [
        { "id": "orders", "label": "주문관리" },
        { "id": "products", "label": "상품관리" },
        { "id": "members", "label": "회원관리" }
      ],
      "actions": [
        { "type": "switchTab" }
      ]
    },
    {
      "nodeId": "order-filter",
      "kind": "form",
      "label": "주문 검색",
      "fields": [
        { "id": "orderNumber", "type": "text", "label": "주문번호", "value": "" },
        { 
          "id": "status", 
          "type": "select", 
          "label": "주문상태", 
          "value": "all",
          "options": [
            { "value": "all", "label": "전체" },
            { "value": "paid", "label": "결제완료" },
            { "value": "shipping", "label": "배송중" },
            { "value": "delivered", "label": "배송완료" }
          ]
        },
        { "id": "startDate", "type": "datepicker", "label": "시작일", "value": null },
        { "id": "endDate", "type": "datepicker", "label": "종료일", "value": null }
      ],
      "isValid": true,
      "isDirty": false,
      "isSubmitting": false,
      "actions": [
        { 
          "type": "submit", 
          "label": "검색", 
          "targetNodeId": "order-table", 
          "effect": "refresh" 
        }
      ]
    },
    {
      "nodeId": "order-table",
      "kind": "table",
      "label": "주문 목록",
      "columns": [
        { "id": "select", "type": "checkbox" },
        { "id": "orderNumber", "label": "주문번호", "sortable": true },
        { "id": "productName", "label": "상품명" },
        { "id": "customerName", "label": "주문자" },
        { "id": "status", "label": "상태", "type": "status" },
        { "id": "orderDate", "label": "주문일", "type": "date", "sortable": true },
        { "id": "actions", "type": "actions" }
      ],
      "rows": [
        { 
          "id": "row-1", 
          "data": { 
            "orderNumber": "ORD-001", 
            "productName": "운동화", 
            "customerName": "김철수", 
            "status": "shipping",
            "orderDate": "2024-01-15"
          }
        },
        { 
          "id": "row-2", 
          "data": { 
            "orderNumber": "ORD-002", 
            "productName": "티셔츠", 
            "customerName": "이영희", 
            "status": "paid",
            "orderDate": "2024-01-16"
          }
        },
        { 
          "id": "row-3", 
          "data": { 
            "orderNumber": "ORD-003", 
            "productName": "청바지", 
            "customerName": "박민수", 
            "status": "delivered",
            "orderDate": "2024-01-10"
          }
        }
      ],
      "selection": {
        "mode": "multiple",
        "selectedRowIds": []
      },
      "pagination": {
        "currentPage": 1,
        "totalPages": 5,
        "pageSize": 10,
        "totalItems": 47
      },
      "actions": [
        { "type": "selectRow" },
        { "type": "selectAll" },
        { "type": "changePage" },
        { "type": "sortColumn" },
        { 
          "type": "openDetail",
          "label": "상세보기",
          "overlay": {
            "kind": "modal",
            "template": "orderDetail",
            "dataSource": "selectedRow"
          },
          "condition": { "requiresSelection": true, "maxSelection": 1 }
        },
        { 
          "type": "bulkDelete",
          "label": "선택 삭제",
          "overlay": {
            "kind": "dialog",
            "template": "deleteConfirm",
            "dataSource": "selectedRows",
            "messageTemplate": "선택한 {count}개 주문을 삭제하시겠습니까?"
          },
          "condition": { "requiresSelection": true, "minSelection": 1 }
        }
      ]
    }
  ],
  "overlays": []
}
```

### 4.2 After Opening Detail Modal

사용자가 row-1을 선택하고 "상세보기"를 클릭한 후:

```json
{
  "nodeId": "order-management-page",
  "kind": "page",
  "label": "주문 관리",
  "children": [
    "... (동일)"
  ],
  "overlays": [
    {
      "instanceId": "overlay-001",
      "kind": "modal",
      "template": "orderDetail",
      "boundData": {
        "orderId": "row-1",
        "orderNumber": "ORD-001",
        "productName": "운동화",
        "customerName": "김철수",
        "status": "shipping",
        "orderDate": "2024-01-15"
      },
      "awaitingResult": true,
      "content": {
        "nodeId": "order-detail-content",
        "kind": "page",
        "label": "주문 상세",
        "children": [
          {
            "nodeId": "order-detail-info",
            "kind": "detailTable",
            "label": "주문 정보",
            "rows": [
              { "id": "orderNumber", "label": "주문번호", "type": "text", "value": "ORD-001" },
              { "id": "orderDate", "label": "주문일시", "type": "date", "value": "2024-01-15 14:30" },
              { "id": "productImage", "label": "상품이미지", "type": "image", "value": "https://example.com/shoes.jpg" },
              { "id": "trackingLink", "label": "배송조회", "type": "link", "value": "배송 조회하기", "href": "https://tracking.example.com/ORD-001" }
            ],
            "actions": []
          },
          {
            "nodeId": "order-edit-form",
            "kind": "form",
            "label": "상태 변경",
            "fields": [
              {
                "id": "status",
                "type": "select",
                "label": "주문상태",
                "value": "shipping",
                "options": [
                  { "value": "paid", "label": "결제완료" },
                  { "value": "shipping", "label": "배송중" },
                  { "value": "delivered", "label": "배송완료" },
                  { "value": "cancelled", "label": "취소" }
                ]
              },
              {
                "id": "memo",
                "type": "textarea",
                "label": "배송메모",
                "value": ""
              }
            ],
            "isValid": true,
            "isDirty": false,
            "isSubmitting": false,
            "actions": [
              { 
                "type": "submit", 
                "label": "저장",
                "targetNodeId": "order-table",
                "effect": "refreshRow"
              }
            ]
          }
        ],
        "actions": [
          { "type": "close", "label": "닫기" }
        ],
        "overlays": []
      }
    }
  ]
}
```

### 4.3 After Bulk Delete Confirmation

row-1, row-2를 선택하고 "선택 삭제"를 클릭한 후:

```json
{
  "nodeId": "order-management-page",
  "kind": "page",
  "children": ["..."],
  "overlays": [
    {
      "instanceId": "overlay-002",
      "kind": "dialog",
      "template": "deleteConfirm",
      "boundData": {
        "selectedRowIds": ["row-1", "row-2"],
        "count": 2
      },
      "message": "선택한 2개 주문을 삭제하시겠습니까?",
      "awaitingResult": true,
      "content": null
    }
  ]
}
```

### 4.4 After Successful Save (Toast)

저장 성공 후:

```json
{
  "nodeId": "order-management-page",
  "kind": "page",
  "children": ["..."],
  "overlays": [
    {
      "instanceId": "toast-001",
      "kind": "toast",
      "template": "saveSuccess",
      "boundData": {},
      "message": "주문 상태가 변경되었습니다",
      "variant": "success",
      "autoClose": 3000,
      "awaitingResult": false
    }
  ]
}
```

---

## 5. Agent Scenarios

### 5.1 Scenario: "결제완료 상태인 주문만 필터링해줘"

```typescript
// Agent가 생성하는 Intent 시퀀스
[
  { type: "setFieldValue", nodeId: "order-filter", fieldId: "status", value: "paid" },
  { type: "submit", nodeId: "order-filter" }
]
```

### 5.2 Scenario: "ORD-001 주문 상세 열어서 상태를 배송완료로 변경해줘"

```typescript
// Step 1: 테이블에서 해당 행 찾기 (Agent가 rows에서 orderNumber로 검색)
// Step 2: Intent 시퀀스 생성
[
  { type: "selectRow", nodeId: "order-table", rowId: "row-1" },
  { type: "triggerAction", nodeId: "order-table", actionType: "openDetail" },
  // Modal이 열린 후 새 ViewSnapshot 수신
  { type: "setFieldValue", nodeId: "order-edit-form", fieldId: "status", value: "delivered" },
  { type: "submitOverlay", instanceId: "overlay-001" }
]
```

### 5.3 Scenario: "처음 두 개 주문 선택해서 삭제해줘"

```typescript
[
  { type: "selectRow", nodeId: "order-table", rowId: "row-1" },
  { type: "selectRow", nodeId: "order-table", rowId: "row-2", append: true },
  { type: "triggerAction", nodeId: "order-table", actionType: "bulkDelete" },
  // Dialog가 열린 후 새 ViewSnapshot 수신
  { type: "confirmDialog", instanceId: "overlay-002" }
]
```

### 5.4 Scenario: "상품관리 탭으로 이동해줘"

```typescript
[
  { type: "switchTab", nodeId: "main-tabs", tabId: "products" }
]
```

---

## 6. Engine API

### 6.1 Core Methods

```typescript
interface ViewSnapshotEngine {
  /**
   * 현재 ViewSnapshot 반환
   */
  getViewSnapshot(): PageSnapshot;
  
  /**
   * Intent 처리 후 새 ViewSnapshot 반환
   */
  dispatchIntent(intent: ViewIntent): Promise<PageSnapshot>;
  
  /**
   * 여러 Intent를 순차 처리
   */
  dispatchIntents(intents: ViewIntent[]): Promise<PageSnapshot>;
}
```

### 6.2 Agent-Facing API (MCP/REST)

```typescript
// GET /view-snapshot
// Response: PageSnapshot

// POST /dispatch-intent
// Body: ViewIntent
// Response: PageSnapshot

// POST /dispatch-intents
// Body: ViewIntent[]
// Response: PageSnapshot
```

---

## 7. Design Decisions & Rationale

### 7.1 Why Overlay as Pipeline?

**문제**: 정적 Modal 노드 방식은 "어떤 데이터가 바인딩되었는지"를 표현하기 어려움

```typescript
// ❌ 정적 노드 방식
{ nodeId: "detail-modal", kind: "modal", isOpen: false }
// Modal이 열려도 어떤 row 데이터가 들어갔는지 불명확

// ✅ Pipeline 방식
overlays: [{
  instanceId: "overlay-001",
  template: "orderDetail",
  boundData: { orderNumber: "ORD-001", ... }  // 데이터가 명시적
}]
```

### 7.2 Why Action with targetNodeId?

**대안 비교**:

| 방식 | 장점 | 단점 |
|------|------|------|
| 별도 Relations 배열 | 관계가 명시적 | 구조 복잡, 파싱 어려움 |
| 트리 구조로 암시 | 단순 | N:M 관계 표현 불가 |
| **Action에 target 포함** | 직관적, LLM 이해 용이 | 양방향 관계 표현 제한 |

Agent 관점에서는 "이 액션을 하면 어디가 영향받는지"를 바로 알 수 있는 것이 중요하므로, Action에 targetNodeId를 포함하는 방식 선택

### 7.3 Why Condition in Action?

```typescript
{
  type: "openDetail",
  condition: { requiresSelection: true, maxSelection: 1 }
}
```

Agent가 "지금 이 액션을 실행할 수 있는가?"를 판단하려면, 조건이 명시되어 있어야 함. 그렇지 않으면 Agent가 불가능한 액션을 시도하고 에러를 받는 비효율 발생

---

## 8. Implementation Guide

### 8.1 Package Structure

```
@manifesto-ai/view-snapshot
├── types/           # Type definitions
│   ├── nodes.ts     # ViewSnapshotNode, PageSnapshot, FormSnapshot, etc.
│   ├── intents.ts   # ViewIntent union types
│   ├── fields.ts    # FieldSnapshot, ColumnDefinition, TableRow
│   ├── overlays.ts  # OverlayInstance, OverlayConfig, OverlayTemplate
│   └── actions.ts   # ViewAction, ActionCondition
├── engine/          # Core engine
│   ├── ViewSnapshotEngine.ts   # Main engine class
│   ├── IntentDispatcher.ts     # Intent -> Runtime dispatch
│   ├── OverlayManager.ts       # Overlay stack management
│   ├── TemplateRegistry.ts     # Overlay template registry
│   └── NodeRegistry.ts         # Form/List runtime registry
├── builders/        # Snapshot builders
│   ├── FormSnapshotBuilder.ts  # FormRuntime -> FormSnapshot
│   ├── TableSnapshotBuilder.ts # ListRuntime -> TableSnapshot
│   └── PageSnapshotBuilder.ts  # Compose PageSnapshot
└── guards/          # Type guards
    ├── node-guards.ts
    └── intent-guards.ts
```

### 8.2 Basic Usage

```typescript
import {
  createViewSnapshotEngine,
  type PageSnapshot,
  type ViewIntent,
} from '@manifesto-ai/view-snapshot'
import { createFormRuntime } from '@manifesto-ai/engine'

// 1. Create engine
const engine = createViewSnapshotEngine({
  pageId: 'order-management-page',
  pageLabel: '주문 관리',
})

// 2. Register runtimes
const formRuntime = createFormRuntime(formSchema, { initialValues: {} })
formRuntime.initialize()

engine.registerFormRuntime('order-filter', formRuntime, formSchema)

// 3. Get snapshot
const snapshot: PageSnapshot = engine.getViewSnapshot()

// 4. Dispatch intent
const intent: ViewIntent = {
  type: 'setFieldValue',
  nodeId: 'order-filter',
  fieldId: 'status',
  value: 'paid',
}

const newSnapshot = await engine.dispatchIntent(intent)

// 5. Subscribe to changes
const unsubscribe = engine.subscribe((snapshot) => {
  console.log('Snapshot updated:', snapshot)
})

// 6. Cleanup
engine.dispose()
```

### 8.3 Migration from SemanticSnapshot

```typescript
// Before (deprecated)
import { createInteroperabilitySession } from '@manifesto-ai/ai-util'

const session = createInteroperabilitySession({ runtime, viewSchema })
const snapshot = session.snapshot()
session.dispatch({ type: 'updateField', fieldId: 'name', value: 'John' })

// After
import { createViewSnapshotEngine } from '@manifesto-ai/view-snapshot'

const engine = createViewSnapshotEngine({ pageId: 'my-page' })
engine.registerFormRuntime('form-1', runtime, viewSchema)
const snapshot = engine.getViewSnapshot()
await engine.dispatchIntent({
  type: 'setFieldValue',
  nodeId: 'form-1',
  fieldId: 'name',
  value: 'John',
})
```

---

## 9. Future Considerations

### 9.1 Not Yet Covered

- Drawer (Slide-over) - Modal의 변형으로 처리 가능
- Summary Cards - 별도 노드 타입 추가 필요
- Charts/Dashboards - 추후 확장
- Multi-page Navigation - Router 통합 필요

### 9.2 Async Operations

현재 구조에서 비동기 작업 상태는 `isSubmitting` 등으로 단순화했으나, 복잡한 시나리오에서는 확장 필요:

```typescript
interface AsyncOperation {
  operationId: string;
  type: "submit" | "fetch" | "delete";
  status: "pending" | "success" | "error";
  error?: { code: string; message: string };
  retriable: boolean;
}
```

---

## Appendix: Template Registry

오버레이 템플릿은 엔진에서 관리하며, ViewSnapshot에는 template ID만 포함:

```typescript
// Engine 내부 템플릿 정의 (ViewSnapshot에 포함되지 않음)
const overlayTemplates = {
  orderDetail: {
    kind: "modal",
    title: "주문 상세",
    contentSchema: { /* FormSnapshot + DetailTableSnapshot 구조 */ }
  },
  deleteConfirm: {
    kind: "dialog",
    title: "삭제 확인",
    messageTemplate: "선택한 {count}개 항목을 삭제하시겠습니까?",
    confirmLabel: "삭제",
    cancelLabel: "취소"
  },
  saveSuccess: {
    kind: "toast",
    variant: "success",
    defaultMessage: "저장되었습니다",
    autoClose: 3000
  }
};
```
