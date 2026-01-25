# TaskFlow Architecture

> TaskFlow는 Manifesto 프레임워크 기반의 AI-powered 태스크 관리 애플리케이션입니다.

## Overview

> NOTE: 현재 TaskFlow는 `@manifesto-ai/app` v2 기반이며, 문서의 Bridge/World 표현은 App 내부 오케스트레이션을 의미합니다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              TaskFlow App                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   React UI  │───▶│   Bridge    │───▶│  Manifesto  │                 │
│  │ (Components)│◀───│  (Provider) │◀───│   (World)   │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│         │                                     ▲                         │
│         │ SSE                                 │                         │
│         ▼                                     │                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │  Agent API  │───▶│   Runtime   │───▶│   Effects   │                 │
│  │  (Stream)   │    │  (Intent)   │    │  (Patches)  │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│         │                                                               │
│         │ LLM Call                                                      │
│         ▼                                                               │
│  ┌─────────────┐                                                        │
│  │   OpenAI    │                                                        │
│  │  (GPT-4o)   │                                                        │
│  └─────────────┘                                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/
│   │   └── agent/
│   │       └── stream/       # Agent Stream API (SSE)
│   │           └── route.ts
│   ├── layout.tsx
│   └── page.tsx              # Main page
│
├── components/               # React Components
│   ├── assistant/            # AI Assistant Panel
│   │   ├── AssistantPanel.tsx
│   │   ├── AssistantHeader.tsx
│   │   ├── AssistantInput.tsx
│   │   ├── AssistantMessages.tsx
│   │   └── messages/         # Message components
│   ├── views/                # Task views (Kanban, Table, Todo)
│   ├── sidebar/              # Sidebar navigation
│   ├── shared/               # Shared components
│   └── ui/                   # UI primitives (shadcn/ui)
│
├── domain/                   # Domain Definition
│   ├── tasks.mel             # MEL (Manifesto Expression Language)
│   └── index.ts              # Type exports
│
├── lib/
│   └── agents/               # Agent System
│       ├── intent.ts         # Intent AST definitions
│       ├── runtime.ts        # Intent execution runtime
│       ├── types.ts          # Type definitions
│       └── prompts/          # LLM prompts
│
├── manifesto/                # Manifesto Integration
│   ├── app.ts                # TaskFlowApp factory
│   ├── actors.ts             # Actor definitions
│   └── effects/              # Effect handlers
│
├── store/                    # State Management
│   ├── provider.tsx          # Manifesto React Provider
│   └── useTasksStore.ts      # Zustand store (UI-only state)
│
└── types/                    # TypeScript types
```

## Core Concepts

### 1. 2-LLM Architecture

TaskFlow는 두 개의 LLM 호출로 사용자 요청을 처리합니다:

```
User Input
    │
    ▼
┌───────────────┐
│ 1st LLM Call  │  Intent Parser
│  (GPT-4o)     │  Natural Language → Structured Intent
└───────────────┘
    │
    ▼
┌───────────────┐
│   Runtime     │  Intent → Effects (Deterministic)
│               │  No LLM, pure transformation
└───────────────┘
    │
    ▼
┌───────────────┐
│ 2nd LLM Call  │  Response Generator
│ (GPT-4o-mini) │  Execution Result → Natural Language
└───────────────┘
    │
    ▼
User Response + Effects
```

### 2. Intent System

Intent는 사용자 의도의 완결된 의미 단위(AST)입니다:

| Intent | Description |
|--------|-------------|
| `CreateTask` | 태스크 생성 (단일/복수) |
| `UpdateTask` | 태스크 수정 (title, description, priority, dueDate, assignee, tags) |
| `ChangeStatus` | 상태 전이 (todo → in-progress → review → done) |
| `DeleteTask` | 태스크 삭제 (soft delete) |
| `RestoreTask` | 삭제된 태스크 복원 |
| `SelectTask` | 태스크 선택/해제 |
| `QueryTasks` | 태스크 조회 (읽기 전용) |
| `ChangeView` | 뷰 모드 변경 (kanban, table, todo) |
| `SetDateFilter` | 날짜 필터 설정 |
| `Undo` | 마지막 액션 취소 |

### 3. Effect System

Runtime은 Intent를 Effect로 변환합니다:

```typescript
type PatchOp =
  | { op: 'append'; path: 'data.tasks'; value: Task }
  | { op: 'set'; path: string; value: unknown }
  | { op: 'remove'; path: 'data.tasks'; value: string }
  | { op: 'restore'; path: 'data.tasks'; value: string };

interface SnapshotPatchEffect {
  type: 'snapshot.patch';
  id: string;
  ops: PatchOp[];
}
```

### 4. Manifesto Integration

TaskFlow는 Manifesto 프레임워크를 통해 상태를 관리합니다:

```
┌────────────────────────────────────────────────────┐
│                    Manifesto Stack                  │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Domain  │  │  World   │  │      Bridge      │ │
│  │  (MEL)   │─▶│ (State)  │─▶│ (React Binding)  │ │
│  └──────────┘  └──────────┘  └──────────────────┘ │
│                                                    │
│  MEL Actions:                                      │
│  - createTask    - deleteTask    - selectTask     │
│  - updateTask    - restoreTask   - changeView     │
│  - moveTask      - setFilter     - clearFilter    │
│                                                    │
└────────────────────────────────────────────────────┘
```

## Data Flow

### User Action Flow (Direct UI)

```
1. User clicks button in UI
2. Component calls action (e.g., createTask)
3. TaskFlowApp dispatches action to App
4. App executes action via Host/WorldStore
5. Effects applied to Snapshot
6. App notifies subscribers
9. React re-renders
```

### AI Assistant Flow (Agent)

```
1. User types message in AssistantPanel
2. POST /api/agent/stream (SSE)
3. 1st LLM: Parse intent from natural language
4. Runtime: Execute intent → Generate effects
5. 2nd LLM: Generate response message
6. SSE events: start → intent → done
7. AssistantPanel.applyEffects() processes effects
8. Manifesto actions called
9. UI updates via subscription
```

## API

### `POST /api/agent/stream`

Server-Sent Events (SSE) endpoint for AI assistant.

**Request:**
```typescript
interface AgentRequest {
  instruction: string;   // User's natural language input
  snapshot: Snapshot;    // Current application state
}
```

**SSE Events:**
```
event: start
data: { sessionId: string }

event: intent
data: { intent: Intent }

event: done
data: { message: string, effects: AgentEffect[] }

event: error
data: { error: string }
```

## State Management

### Manifesto State (Domain State)

MEL로 정의된 도메인 상태:

```mel
state {
  tasks: Array<Task> = []
  currentFilter: Filter = { status: null, priority: null, assignee: null }
  selectedTaskId: string | null = null
  viewMode: "todo" | "kanban" | "table" | "trash" = "kanban"
  isCreating: boolean = false
  isEditing: boolean = false

  // Derived arrays (populated by effects)
  activeTasks: Array<Task> | null = null
  todoTasks: Array<Task> | null = null
  inProgressTasks: Array<Task> | null = null
  reviewTasks: Array<Task> | null = null
  doneTasks: Array<Task> | null = null
  deletedTasks: Array<Task> | null = null
}
```

### UI State (Zustand)

UI 전용 상태 (Manifesto 외부):

```typescript
interface UIStore {
  dateFilter: DateFilter | null;
  assistantOpen: boolean;
  lastCreatedTaskIds: string[];
  lastModifiedTaskId: string | null;
  chatHistory: ChatMessage[];
}
```

## Key Components

### TaskFlowApp (`src/manifesto/app.ts`)

애플리케이션 진입점. Manifesto stack을 구성하고 액션 메서드를 제공:

```typescript
interface TaskFlowApp {
  // Core
  app: App;

  // Lifecycle
  initialize(): Promise<void>;
  dispose(): void;

  // State
  getSnapshot(): AppState<TaskFlowState> | null;
  getState(): TaskFlowState | null;
  getComputed(): TaskFlowComputed | null;

  // Dispatch
  dispatch(body: IntentBody, actor?: ActorRef): Promise<void>;

  // Actions
  createTask(params): Promise<void>;
  updateTask(params): Promise<void>;
  deleteTask(id): Promise<void>;
  moveTask(id, status): Promise<void>;
  selectTask(taskId): Promise<void>;
  changeView(viewMode): Promise<void>;
  restoreTask(id): Promise<void>;
  refreshFilters(): Promise<void>;
  setFilter(status, priority): Promise<void>;
  clearFilter(): Promise<void>;
}
```

### AssistantPanel (`src/components/assistant/AssistantPanel.tsx`)

AI 어시스턴트 UI. SSE로 Agent API와 통신하고 effects를 적용:

```typescript
// Effect 적용 로직
const applyEffects = async (effects: AgentEffect[]) => {
  for (const effect of effects) {
    if (effect.type === 'snapshot.patch') {
      for (const op of effect.ops) {
        if (op.op === 'append' && op.path === 'data.tasks') {
          await createTaskAction(op.value);
        } else if (op.op === 'set' && op.path === 'state.viewMode') {
          await changeViewAction(op.value);
        }
        // ... more operations
      }
    }
  }
};
```

### Runtime (`src/lib/agents/runtime.ts`)

Intent를 Effect로 변환하는 결정론적 런타임:

```typescript
function executeIntent(intent: Intent, snapshot: Snapshot): ExecutionResult {
  // 1. Intent Schema 검증
  const validation = validateIntent(intent);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(', ') };
  }

  // 2. Intent → Effects 변환
  const ops = generateEffects(intent, snapshot);

  return {
    success: true,
    effects: wrapOps(ops),
    intent,
  };
}
```

## Testing

```bash
# All tests
pnpm exec vitest run

# Integration tests (Manifesto)
pnpm exec vitest run src/manifesto/integration.test.ts

# Agent runtime tests
pnpm exec vitest run src/lib/agents/runtime.test.ts

# Effect processing tests
pnpm exec vitest run src/components/assistant/applyEffects.test.ts
```

## Configuration

### Environment Variables

```env
OPENAI_API_KEY=sk-...          # Required for Agent API
UPSTASH_REDIS_REST_URL=...     # Optional: Rate limiting
UPSTASH_REDIS_REST_TOKEN=...   # Optional: Rate limiting
```

## Design Decisions

### Why 2-LLM Architecture?

1. **Separation of Concerns**: Intent parsing (structure) vs Response generation (natural language)
2. **Deterministic Execution**: Runtime doesn't use LLM, ensuring predictable behavior
3. **Cost Optimization**: GPT-4o for parsing, GPT-4o-mini for response
4. **Debuggability**: Intent is a clear intermediate representation

### Why Manifesto?

1. **Deterministic State**: `compute(schema, snapshot, intent) → (snapshot', requirements, trace)`
2. **Accountability**: Every change traced to Actor + Authority + Intent
3. **Re-entry Safety**: `once()` guards prevent duplicate effects
4. **Schema-first**: All semantics as JSON-serializable data

### Why MEL?

1. **Declarative**: Actions define "what", not "how"
2. **Type-safe**: Compiled schema with validation
3. **Portable**: JSON representation for cross-platform use

## MCP Server

TaskFlow는 MCP(Model Context Protocol) 서버로 실행할 수 있어, 외부 AI 에이전트가 태스크를 관리할 수 있습니다.

### 시작하기

```bash
# MCP 서버 실행
pnpm mcp
```

### Claude Desktop 설정

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "taskflow": {
      "command": "pnpm",
      "args": ["--dir", "/path/to/apps/taskflow", "mcp"]
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `create_task` | 태스크 생성 (단일/복수) |
| `update_task` | 태스크 수정 |
| `change_status` | 상태 변경 |
| `delete_task` | 태스크 삭제 |
| `restore_task` | 삭제된 태스크 복원 |
| `select_task` | 태스크 선택 |
| `change_view` | 뷰 모드 변경 |
| `set_date_filter` | 날짜 필터 설정 |
| `clear_date_filter` | 필터 해제 |
| `query_tasks` | 태스크 조회 |
| `bulk_change_status` | 일괄 상태 변경 |

### MCP Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Tasks | `taskflow://tasks` | 전체 태스크 목록 및 요약 |
| State | `taskflow://state` | 현재 앱 상태 |

### MCP Prompts

| Prompt | Description |
|--------|-------------|
| `daily_standup` | 일일 스탠드업 리포트 생성 |
| `prioritize_tasks` | 태스크 우선순위 추천 |

### Architecture

```
┌────────────────────────────────────────────────────────┐
│                    External Agent                       │
│              (Claude, GPT, Custom Agent)                │
└────────────────────────────────────────────────────────┘
                           │
                    MCP Protocol (stdio)
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   TaskFlow MCP Server                   │
├────────────────────────────────────────────────────────┤
│  Tools ─────────▶ Intent ─────────▶ Runtime            │
│                      │                  │               │
│                      ▼                  ▼               │
│                 Validation          Effects             │
│                      │                  │               │
│                      ▼                  ▼               │
│                         In-Memory Snapshot              │
└────────────────────────────────────────────────────────┘
```

### 실험: Agent Framework 대체

MCP를 통해 기존 에이전트 프레임워크를 대체하는 패턴:

```
기존 방식:
Agent Framework → Custom API → Business Logic

MCP 방식:
Any LLM + MCP Client → MCP Server → Intent → Effects

장점:
1. 프레임워크 독립적: 어떤 LLM이든 MCP만 지원하면 사용 가능
2. 표준화된 인터페이스: Tools, Resources, Prompts
3. 결정론적 실행: Intent → Effects는 LLM 없이 순수 변환
4. 재사용성: 동일한 MCP 서버를 여러 클라이언트에서 사용
```
