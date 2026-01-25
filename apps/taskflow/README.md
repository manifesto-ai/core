# TaskFlow Demo

> **TL;DR**: This is a runnable demo showing how LLMs can drive applications by emitting validated intents — without directly mutating UI state.

A demonstration web application built on top of [`@manifesto-ai/core`](https://github.com/manifesto-ai/core), showcasing an **Intent-Native runtime** architecture where LLMs emit validated intents that are executed deterministically by a runtime layer.

In this architecture, **the LLM does not mutate UI state directly**. Instead, it produces structured Intent objects that are validated, then executed by a deterministic runtime to generate Effects—which are finally applied to the application snapshot.

---

## What This Project IS

- A **working demo** of an Intent → Effect → Snapshot execution model
- A **reference implementation** of a Simple Intent API using GPT-4o-mini
- A practical example of integrating:
  - LLM (intent generation via natural language)
  - Deterministic runtime (effect execution)
  - React + Zustand UI (state projection)
  - SSE streaming (real-time feedback)
- A **runnable example** to understand Manifesto as a runtime, not just a concept
- A task management app with natural language interaction (create, update, delete)

---

## What This Project is NOT

- **Not** the full Manifesto research architecture
- **Not** a multi-agent orchestration framework
- **Not** an attempt to replace React, Zustand, or existing UI frameworks
- **Not** a production-ready task management solution
- This demo **intentionally avoids** complex policy learning, speculative autonomy, or multi-step planning

This project is scoped as a **minimal, understandable demonstration** of the core runtime concepts.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│                                                             │
│   User Input ("Add a task for tomorrow")                    │
│         │                                                   │
│         ▼                                                   │
│   ┌─────────────┐    SSE     ┌─────────────┐                │
│   │ Assistant   │ ─────────▶ │   Zustand   │                │
│   │   Panel     │   Events   │    Store    │                │
│   └─────────────┘            └──────┬──────┘                │
│                                     │                       │
│                              ┌──────▼──────┐                │
│                              │   Storage   │                │
│                              │ (IndexedDB) │                │
│                              └─────────────┘                │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ POST /api/agent/simple/stream
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVER (2-LLM Architecture)              │
│                                                             │
│   ┌───────────────────────────────────────────────────┐     │
│   │  1st LLM: Intent Parser                           │     │
│   │  - Converts natural language → structured Intent  │     │
│   │  - Focused on understanding user intent           │     │
│   └───────────────────────┬───────────────────────────┘     │
│                           ▼                                 │
│   ┌─────────────┐   ┌─────────────┐                         │
│   │   Intent    │ → │   Runtime   │ → Effects               │
│   │  Validator  │   │  Executor   │   (PatchOps)            │
│   └─────────────┘   └─────────────┘                         │
│                           │                                 │
│                           ▼                                 │
│   ┌───────────────────────────────────────────────────┐     │
│   │  2nd LLM: Response Generator                      │     │
│   │  - Generates natural language response            │     │
│   │  - Uses execution result + context for accuracy   │     │
│   └───────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 2-LLM Architecture

This project uses a **2-LLM architecture** that separates intent parsing from response generation:

| Stage | LLM Role | Input | Output |
|-------|----------|-------|--------|
| 1st | **Intent Parser** | User instruction + Task context | Structured Intent JSON |
| 2nd | **Response Generator** | Intent + Execution result + State | Natural language message |

**Why 2 LLMs?**

1. **Separation of Concerns**: Each LLM focuses on a single task, improving accuracy
2. **Better Responses**: Response Generator has access to actual execution results
3. **Simpler Prompts**: Each prompt is shorter and more focused

### Data Flow

1. **User Input** → Natural language instruction
2. **1st LLM (Intent Parser)** → Generates structured Intent JSON (no message)
3. **Validation** → Intent schema validation
4. **Runtime** → Executes intent deterministically, produces Effects
5. **2nd LLM (Response Generator)** → Creates user-friendly response based on results
6. **Effects** → Applied to Zustand store via patch operations
7. **Storage** → Persists to IndexedDB (with localStorage fallback)

---

## Relationship to `@manifesto-ai/core`

### What `@manifesto-ai/core` provides:

- Snapshot model and schema definitions
- Deterministic runtime semantics
- Effect application mechanics
- Domain definition DSL

### What this demo app provides:

- UI layer (React + Tailwind + shadcn/ui)
- LLM integration (OpenAI GPT-4o-mini)
- SSE streaming for real-time feedback
- Storage layer (IndexedDB / localStorage)
- Intent validation and execution pipeline

---

## Who This Demo Is For

- Engineers exploring **AI + UI + state management** patterns
- Developers curious about making **AI behavior auditable and explainable**
- People evaluating Manifesto as a **runtime for LLM-driven applications**
- Anyone interested in **Intent-Native architectures** where AI doesn't directly mutate state

---

## Key Concepts

### Intent

A structured, validated object representing "what the user wants to do":

```typescript
{
  kind: "CreateTask",
  tasks: [{ title: "Review PR", priority: "high", dueDate: "2024-12-15" }],
  confidence: 0.95,
  source: "human"
}
```

### Effect

A deterministic patch operation produced by the runtime:

```typescript
{
  type: "snapshot.patch",
  ops: [
    { op: "append", path: "data.tasks", value: { id: "task-123", ... } }
  ]
}
```

### Snapshot

The complete application state at a point in time, modified only through Effects.

---

## Supported Intent Types

| Intent | Description |
|--------|-------------|
| `CreateTask` | Create one or more tasks |
| `UpdateTask` | Modify task properties (title, assignee, etc.) |
| `ChangeStatus` | Change task status (todo → in-progress → done) |
| `DeleteTask` | Soft-delete a task |
| `SelectTask` | Select/deselect a task for viewing |
| `ChangeView` | Switch view mode (kanban/table/todo) |
| `SetDateFilter` | Apply date-based filtering |
| `Undo` | Revert the last action |

---

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key

### Installation

```bash
pnpm install
```

### Configuration

Create a `.env.local` file:

```env
OPENAI_API_KEY=your-api-key-here
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Project Structure

```
src/
├── app/
│   ├── api/agent/simple/     # Simple Intent API (streaming + non-streaming)
│   └── page.tsx              # Main application page
├── lib/
│   ├── agents/
│   │   ├── intent.ts         # Intent types and validation
│   │   ├── runtime.ts        # Deterministic execution engine
│   │   └── types.ts          # Shared type definitions
│   └── storage/              # IndexedDB + localStorage persistence
├── store/
│   ├── useTasksStore.ts      # Zustand store
│   └── provider.tsx          # React context + storage sync
├── components/
│   ├── assistant/            # AI assistant panel
│   └── views/                # Kanban, Table, Todo views
└── domain/
    └── tasks.ts              # Task domain model
```

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS, shadcn/ui
- **State**: Manifesto App v2 (React Provider)
- **LLM**: OpenAI GPT-4o-mini
- **Storage**: IndexedDB (primary), localStorage (fallback)
- **Streaming**: Server-Sent Events (SSE)

---

## License

MIT
