# Manifesto React Renderer

**Architecture Specification v1.0**

December 2024

---

## 1. Executive Summary

본 문서는 Manifesto 프레임워크의 React Renderer 아키텍처를 정의합니다.
ViewSnapshot을 React UI로 변환하는 전체 시스템의 설계 원칙, 계층 구조,
타입 정의, 그리고 개발자 경험(DX)을 다룹니다.

### 1.1 핵심 설계 결정

| 결정 | 선택 | 근거 |
|------|------|------|
| 렌더러 구조 | 모듈형 (Distributed) | Framework-Agnostic 철학, 교체 가능성 |
| 노드 조회 방식 | Registry 기반 | Open-Closed Principle, 확장성 |
| AsyncState 위치 | 데이터 영역만 | Skeleton UI를 위한 구조 정보 필요 |
| Overlay 내부 폼 | 독립적 Runtime | Agent Intent 명확성, 생명주기 분리 |
| 노드 간 통신 | Intent 기반 간접 통신 | 단방향 데이터 흐름, 결합도 제로 |

### 1.2 아키텍처 원칙

- **ViewSnapshot과의 대칭성**: 타입 계층과 렌더러 계층이 1:1 대응
- **Agent-Human Isomorphism**: Human Renderer와 Agent Processor가 동일한 구조 공유
- **Progressive Disclosure**: 복잡성을 계층화하여 개발자가 필요한 만큼만 노출
- **Snapshot is Truth**: 모든 상태(비동기, 오버레이 포함)는 Snapshot에 존재

---

## 2. Architecture Overview

Renderer는 ViewSnapshot을 React UI로 변환하는 시스템입니다. 3개의 명확한 계층으로 구성되며, 각 계층은 단일 책임을 가집니다.

### 2.1 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    Composition Layer                        │
│  - PageRenderer: Snapshot 트리 순회, Registry 조회          │
│  - Context 전파, 오버레이 스택 관리                          │
├─────────────────────────────────────────────────────────────┤
│                    Node Renderer Layer                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Form    │ │  Table   │ │  Tabs    │ │ Overlay  │      │
│  │ Renderer │ │ Renderer │ │ Renderer │ │ Renderer │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
├─────────────────────────────────────────────────────────────┤
│                    Primitive Layer                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Field   │ │  Button  │ │  Table   │ │  Modal   │      │
│  │Primitive │ │Primitive │ │Primitive │ │Primitive │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│         │            │            │            │           │
│         └────────────┴────────────┴────────────┘           │
│                          │                                  │
│         ┌────────────────┼────────────────┐                │
│         ↓                ↓                ↓                │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│  │  Shadcn  │     │   MUI    │     │  Custom  │           │
│  │ Binding  │     │ Binding  │     │ Binding  │           │
│  └──────────┘     └──────────┘     └──────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 계층별 책임

| 계층 | 책임 | 알아야 하는 것 |
|------|------|---------------|
| Composition | 트리 순회, 렌더러 조회, Context 전파 | PageSnapshot 구조 |
| Node Renderer | Snapshot → Primitive 변환, Intent 핸들러 바인딩 | 특정 Snapshot 타입, Intent 타입 |
| Primitive | 순수 시각적 표현 | Props만 (비즈니스 로직 없음) |

---

## 3. Composition Layer

Composition Layer는 렌더링 파이프라인의 진입점으로, PageSnapshot을 받아 전체 UI 트리를 조립합니다.

### 3.1 PageRenderer

PageRenderer는 최상위 조합 컴포넌트로 다음 책임을 수행합니다:

- Snapshot.children 순회 및 각 노드에 맞는 Renderer 조회
- RenderContext 생성 및 하위 노드로 전파
- Overlay Stack 렌더링 관리
- Error Boundary 제공

### 3.2 RenderContext

RenderContext는 렌더링 과정에서 하위 노드로 전파되는 컨텍스트 객체입니다:

```typescript
interface RenderContext {
  engine: IViewSnapshotEngine;      // Engine 참조
  primitives: PrimitiveSet;         // Primitive 컴포넌트 세트
  path: string[];                   // 현재 위치 (노드 경로)
  depth: number;                    // 트리 깊이
  dispatch: (intent: ViewIntent) => Promise<PageSnapshot>;
  parent?: ViewSnapshotNode;        // 부모 노드 참조
}
```

### 3.3 RendererRegistry

Registry 기반 노드 렌더러 조회 시스템입니다. Visitor Pattern 대신 Registry를 선택한 이유는 새로운 노드 타입 추가 시 기존 코드 수정 없이 확장이 가능하기 때문입니다.

```typescript
type RendererRegistry = {
  nodes: Map<ViewNodeKind, NodeRenderer>;
  overlays: Map<OverlayKind, OverlayRenderer>;
  primitives: PrimitiveSet;
}

// 새 노드 타입 추가
registry.nodes.set('chart', ChartRenderer);  // 기존 코드 수정 없음
```

---

## 4. Node Renderer Layer

Node Renderer는 특정 Snapshot 타입을 처리하는 컴포넌트입니다. Snapshot의 의미론적 데이터를 Primitive가 이해할 수 있는 렌더링 설정으로 변환합니다.

### 4.1 NodeRenderer 인터페이스

```typescript
interface NodeRenderer<T extends ViewSnapshotNode = ViewSnapshotNode> {
  kind: T['kind'];
  render: (node: T, context: RenderContext) => ReactNode;
}
```

### 4.2 Renderer의 책임

**Transformer로서의 역할**

Renderer는 Snapshot의 Raw Data를 Primitive가 이해할 수 있는 RenderConfig로 변환합니다:

- **파생 상태 계산**: isAllSelected, isIndeterminate, isSorted 등
- **값 포맷팅**: Date, Currency를 표시 문자열로 변환
- **핸들러 바인딩**: Intent를 구체적인 이벤트 핸들러로 매핑

### 4.3 데이터 흐름

```
TableSnapshot
     │
     │ columns: [{columnId: 'status', type: 'badge'}]
     │ data: { status: 'success', rows: [...] }
     │ selection: { selectedRowIds: ['1'] }
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  TableRenderer (변환 & 핸들러 바인딩)                         │
│                                                             │
│  1. 파생 상태 계산                                           │
│     - isAllSelected = rows.length === selectedRowIds.length │
│     - column.isSorted = sorting?.columnId === column.id     │
│                                                             │
│  2. 값 포맷팅                                                │
│     - currency → "₩125,000"                                 │
│     - date → "2024-01-15"                                   │
│                                                             │
│  3. 핸들러 생성                                              │
│     - onRowSelect = (id) => dispatch({type:'selectRow',id}) │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  TablePrimitive (순수 렌더링)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Primitive Layer

Primitive Layer는 디자인 시스템과의 결합점입니다. 순수한 시각적 표현만을 담당하며, 비즈니스 로직이 없습니다.

### 5.1 Primitive 경계: Molecular Level

Primitive의 경계는 Atomic(Input)이 아닌 Molecular(Field = Label + Input + Error) 수준입니다.

| 수준 | 예시 | 선택 여부 |
|------|------|----------|
| Atomic | Input, Label, ErrorText 각각 | X |
| Molecular | Field (Label + Input + Error 조합) | O (선택됨) |

Molecular 수준을 선택한 이유: Node Renderer가 레이아웃 책임까지 지면 디자인 시스템 교체가 어려워집니다. Field 단위로 캡슐화하면 '에러 표시 위치' 같은 정책이 Primitive에 격리됩니다.

### 5.2 PrimitiveSet 인터페이스

```typescript
interface PrimitiveSet {
  // Field (Molecular)
  Field: React.FC<FieldPrimitiveProps>;
  
  // Actions
  Button: React.FC<ButtonPrimitiveProps>;
  ActionBar: React.FC<ActionBarPrimitiveProps>;
  
  // Table
  Table: React.FC<TablePrimitiveProps>;
  Pagination: React.FC<PaginationPrimitiveProps>;
  TableSkeleton: React.FC<TableSkeletonProps>;
  TableEmpty: React.FC<TableEmptyProps>;
  TableError: React.FC<TableErrorProps>;
  
  // Layout
  Card: React.FC<CardPrimitiveProps>;
  Stack: React.FC<StackPrimitiveProps>;
  
  // Overlay
  Modal: React.FC<ModalPrimitiveProps>;
  Dialog: React.FC<DialogPrimitiveProps>;
  Toast: React.FC<ToastPrimitiveProps>;
}
```

### 5.3 Field Primitive Props

```typescript
interface FieldPrimitiveProps {
  field: FieldSnapshot;
  onChange: (value: unknown) => void;
  
  // 레이아웃 커스터마이징
  layout?: 'vertical' | 'horizontal' | 'inline';
  hideLabel?: boolean;
  hideError?: boolean;
  
  // 슬롯 기반 오버라이드
  slots?: {
    label?: (props: { field: FieldSnapshot }) => ReactNode;
    description?: (props: { field: FieldSnapshot }) => ReactNode;
    error?: (props: { errors: string[] }) => ReactNode;
  };
}
```

---

## 6. AsyncState Management

비동기 상태는 노드 전체가 아닌 데이터 영역에만 적용됩니다.

### 6.1 Partial Async State

구조 정보(columns)는 항상 존재하고, 데이터(rows)만 비동기로 로드됩니다. 이를 통해 로딩 중에도 올바른 Skeleton UI를 렌더링할 수 있습니다.

```typescript
interface TableSnapshot extends ViewSnapshotNode {
  kind: 'table';
  
  // 구조 (항상 존재)
  columns: ColumnDefinition[];
  
  // 데이터 (비동기)
  data: AsyncState<{
    rows: TableRow[];
    totalItems: number;
  }>;
  
  // UI 상태 (항상 존재)
  selection: SelectionState;
  pagination: PaginationState;
  sorting?: SortingState;
}
```

### 6.2 AsyncState 타입

```typescript
type AsyncState<T> = 
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: { type: 'network' | 'business'; message: string } };
```

### 6.3 Renderer에서의 처리

```typescript
// TableRenderer
if (node.data.status === 'loading') {
  // columns는 있으니까 올바른 개수의 Skeleton Row 표시 가능
  return <primitives.TableSkeleton columnCount={node.columns.length} />;
}

if (node.data.status === 'error') {
  return <primitives.TableError error={node.data.error} onRetry={...} />;
}

// success
return <primitives.Table columns={...} rows={node.data.data.rows} ... />;
```

---

## 7. Overlay System

Overlay는 동적으로 생성되고 스택으로 관리되는 특별한 노드입니다. Modal, Dialog, Toast를 포함합니다.

### 7.1 Semantic Identity

Agent가 동적으로 생성된 Overlay를 식별하기 위해 세 가지 수준의 식별자를 사용합니다:

| 식별자 | 용도 | 예시 |
|--------|------|------|
| instanceId | 시스템 내부 라우팅 | overlay-999 |
| template | 동일 구조 재사용 | delete-confirm-dialog |
| semanticRole | Agent의 의도 파악 | {purpose: 'confirm-delete', targetEntity: 'user'} |

### 7.2 OverlayInstance 구조

```typescript
interface OverlayInstance {
  // 식별자
  instanceId: string;
  template: string;
  semanticRole: {
    purpose: string;        // 'confirm-delete' | 'edit-item' | 'create-new'
    targetEntity?: string;  // 'user' | 'order'
    targetId?: string;      // 'user-123'
  };
  
  // 계층 관계
  parentOverlayId?: string;
  
  // 상태
  boundData: Record<string, unknown>;
  content?: ViewSnapshotNode;
  message?: string;
  
  // 동작 속성
  kind: 'modal' | 'drawer' | 'dialog' | 'toast';
  interactive: boolean;     // 포커스 대상 여부
  awaitingResult: boolean;
  autoClose?: number;
  
  // 액션
  actions: ViewAction[];
}
```

### 7.3 Focus Context

Overlay 스택에서 암시적 포커스를 관리합니다:

```typescript
interface PageSnapshot {
  children: ViewSnapshotNode[];
  overlays: OverlayInstance[];
  
  focusContext: {
    activeOverlayId: string | null;  // 최상위 interactive 오버레이
    activeNodeId: string;             // 현재 포커스된 노드
  };
}
```

### 7.4 Overlay 간 데이터 전달: ResultMapping

부모 오버레이가 자식 오버레이의 결과를 받아 처리하는 패턴입니다:

```typescript
dispatch({
  type: 'openOverlay',
  template: 'address-search-modal',
  parentOverlayId: 'overlay-1',
  
  // 결과 처리 방법 정의
  onResult: {
    type: 'mapToFields',
    targetNodeId: 'form-888',
    mapping: {
      'zip': 'zipCodeField',
      'addr': 'address1Field'
    }
  }
});
```

### 7.5 Intent Guard (Dirty State)

수정 중인 Overlay를 닫으려 할 때 확인 다이얼로그를 자동으로 띄우는 메커니즘입니다:

```typescript
interface OverlayInstance {
  // ...
  derived: {
    isDirty: boolean;  // content.isDirty에서 파생
  };
  
  closePolicy: {
    confirmOnDirty: boolean;
    confirmMessage: string;
  };
}
```

---

## 8. Developer Experience (DX)

Renderer 아키텍처는 Progressive Disclosure 원칙을 따릅니다. 복잡성을 계층화하여 개발자가 필요한 만큼만 알면 됩니다.

### 8.1 Level 0: 기본 사용

대부분의 개발자가 사용하는 수준입니다. ViewSnapshot, Intent, Engine을 직접 다루지 않습니다.

```typescript
function OrderManagementPage() {
  const overlay = useOverlay();
  
  return (
    <ManifestoPage pageId="orders" title="주문 관리">
      <ManifestoForm
        nodeId="order-filter"
        schema={filterSchema}
        affects={['order-table']}
      />
      
      <ManifestoTable
        nodeId="order-table"
        schema={tableSchema}
        filterSource="order-filter"
        queryFn={fetchOrders}
        onAction={(action, ctx) => {
          if (action === 'viewDetail') {
            overlay.open('order-detail-modal', {
              orderId: ctx.selectedRows[0].id
            });
          }
        }}
      />
    </ManifestoPage>
  );
}
```

### 8.2 Level 1: 커스터마이징

특정 렌더러나 Primitive를 교체해야 할 때 사용합니다.

```typescript
// 커스텀 셀 렌더러
const StatusBadgeCell = createCellRenderer<'badge'>({
  render: ({ value }) => {
    const config = statusConfig[value];
    return <Badge variant={config.color}>{config.label}</Badge>;
  }
});

// 사용
<ManifestoTable
  schema={tableSchema}
  cellRenderers={{ status: StatusBadgeCell }}
/>
```

### 8.3 Level 2: 코어 확장

새로운 노드 타입을 추가하거나 Engine에 직접 접근해야 할 때 사용합니다.

```typescript
const KanbanRenderer = defineNodeRenderer('table', {
  render: ({ node }) => {
    const { dispatch } = useNodeContext();
    // 커스텀 렌더링 로직
  }
});

<ManifestoProvider
  renderers={{ table: KanbanRenderer }}
>
  ...
</ManifestoProvider>
```

### 8.4 Public API Summary

| Tier | API | 대상 |
|------|-----|------|
| Tier 1 | ManifestoPage, ManifestoForm, ManifestoTable, useOverlay, useToast | 대부분의 개발자 |
| Tier 2 | defineNodeRenderer, defineOverlay, useNodeContext | 커스터마이징 필요 시 |
| Tier 3 | useEngine, useSnapshot, createViewSnapshotEngine | 코어 확장 시 |

---

## 9. Implementation Roadmap

구현은 Bottom-Up과 Top-Down을 병행하며, 각 Phase마다 검증 체크포인트를 둡니다.

### 9.1 Phase 개요

| Phase | 작업 | 예상 기간 |
|-------|------|----------|
| Phase 1 | Foundation: 타입 정의, Primitive Layer, Storybook 설정 | 2-3일 |
| Phase 2 | Core Renderers: FormRenderer, TableRenderer + Stories | 2-3일 |
| Phase 3 | Composition: PageRenderer, Overlay System | 2일 |
| Phase 4 | Integration POC: 주문 관리 페이지 + E2E 테스트 | 2-3일 |

### 9.2 Phase 1: Foundation

**목표**
- view-snapshot 패키지와 align된 타입 정의
- Primitive Layer (Shadcn 바인딩)
- Storybook 기본 설정

**완료 조건**
- Primitive 컴포넌트가 Storybook에서 독립적으로 동작
- 타입이 view-snapshot과 충돌 없이 정렬됨

### 9.3 Phase 2: Core Renderers

**목표**
- FormRenderer, TableRenderer 구현
- Mock Engine과 연동 테스트

**완료 조건**
- FormRenderer가 값 변경/제출 동작
- TableRenderer가 선택/정렬/페이지네이션 동작
- Interaction Test 통과

### 9.4 Phase 3: Composition

**목표**
- PageRenderer, ManifestoProvider 구현
- Overlay System 완성
- Form-Table Wiring

**완료 조건**
- 여러 노드 조합 렌더링 동작
- Overlay 열기/닫기 전체 흐름 동작
- Focus Context 올바르게 관리

### 9.5 Phase 4: Integration POC

**목표**
- 주문 관리 페이지 전체 구현
- E2E 시나리오 테스트

**검증 시나리오**
- 검색 → 결과 표시
- 행 선택 → 상세 모달 열기
- 폼 수정 → 확인 다이얼로그 → 저장 → 토스트
- 벌크 액션 시나리오

---

## 10. Package Structure

```
packages/react-renderer/
├── src/
│   ├── primitives/           # Shadcn 바인딩
│   │   ├── Field/
│   │   ├── Button/
│   │   ├── Table/
│   │   ├── Layout/
│   │   ├── Overlay/
│   │   └── index.ts
│   │
│   ├── renderers/            # Node Renderers
│   │   ├── FormRenderer.tsx
│   │   ├── TableRenderer.tsx
│   │   ├── TabsRenderer.tsx
│   │   └── overlays/
│   │
│   ├── composition/          # Composition Layer
│   │   ├── PageRenderer.tsx
│   │   ├── ManifestoProvider.tsx
│   │   └── OverlayStack.tsx
│   │
│   ├── hooks/                # Public Hooks
│   │   ├── useOverlay.ts
│   │   ├── useToast.ts
│   │   └── useFormState.ts
│   │
│   ├── components/           # High-Level Components
│   │   ├── ManifestoPage.tsx
│   │   ├── ManifestoForm.tsx
│   │   ├── ManifestoTable.tsx
│   │   └── ManifestoTabs.tsx
│   │
│   └── index.ts
│
├── stories/
│   ├── primitives/
│   ├── renderers/
│   ├── components/
│   └── scenarios/
│
└── package.json
```

---

## 11. Appendix: Core Type Definitions

### 11.1 ViewSnapshot Types (from @manifesto-ai/view-snapshot)

```typescript
type ViewNodeKind = 'page' | 'tabs' | 'form' | 'table' | 'detailTable'
                  | 'modal' | 'dialog' | 'toast';

interface ViewSnapshotNode {
  nodeId: string;
  kind: ViewNodeKind;
  label?: string;
  actions: ViewAction[];
}

interface PageSnapshot extends ViewSnapshotNode {
  kind: 'page';
  children: ViewSnapshotNode[];
  overlays: OverlayInstance[];
  focusContext: {
    activeOverlayId: string | null;
    activeNodeId: string;
  };
}

interface FormSnapshot extends ViewSnapshotNode {
  kind: 'form';
  fields: FieldSnapshot[];
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
}

interface TableSnapshot extends ViewSnapshotNode {
  kind: 'table';
  columns: ColumnDefinition[];
  data: AsyncState<{ rows: TableRow[]; totalItems: number }>;
  selection: SelectionState;
  pagination: PaginationState;
  sorting?: SortingState;
}
```

### 11.2 Renderer Types

```typescript
interface RenderContext {
  engine: IViewSnapshotEngine;
  primitives: PrimitiveSet;
  path: string[];
  depth: number;
  dispatch: (intent: ViewIntent) => Promise<PageSnapshot>;
  parent?: ViewSnapshotNode;
}

interface NodeRenderer<T extends ViewSnapshotNode> {
  kind: T['kind'];
  render: (node: T, context: RenderContext) => ReactNode;
}

interface RendererRegistry {
  nodes: Map<ViewNodeKind, NodeRenderer>;
  overlays: Map<OverlayKind, OverlayRenderer>;
  primitives: PrimitiveSet;
}
```

### 11.3 Intent Types

```typescript
type ViewIntent =
  // Form
  | { type: 'setFieldValue'; nodeId: string; fieldId: string; value: unknown }
  | { type: 'submit'; nodeId: string }
  | { type: 'reset'; nodeId: string }
  // Table
  | { type: 'selectRow'; nodeId: string; rowId: string; append?: boolean }
  | { type: 'selectAll'; nodeId: string }
  | { type: 'deselectAll'; nodeId: string }
  | { type: 'changePage'; nodeId: string; page: number }
  | { type: 'sortColumn'; nodeId: string; columnId: string; direction?: 'asc' | 'desc' }
  // Tabs
  | { type: 'switchTab'; nodeId: string; tabId: string }
  // Overlay
  | { type: 'openOverlay'; template: string; boundData?: Record<string, unknown> }
  | { type: 'closeOverlay'; instanceId: string }
  | { type: 'submitOverlay'; instanceId: string }
  | { type: 'confirmDialog'; instanceId: string }
  | { type: 'dismissToast'; instanceId: string }
  // Generic
  | { type: 'triggerAction'; nodeId: string; actionType: string };
```

---
