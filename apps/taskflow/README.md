# TaskFlow — Manifesto SDK Demo

A task management app rebuilt on `@manifesto-ai/sdk`, demonstrating the Intent-Native Deterministic Runtime architecture.

## Architecture

```
User Input (UI)                  User Input (Natural Language)
      |                                    |
      v                                    v
  dispatch()                     LLM Intent Compiler (Claude API)
      |                                    |
      v                                    v
                  Manifesto Runtime
                  (deterministic)
                        |
                        v
                    Snapshot
                   (immutable)
                        |
                        v
                    React UI
```

- **Core computes. Host executes. UI reads.**
- **Snapshot is the sole source of truth.** All state lives in Manifesto snapshot.
- **No LLM in the execution path.** LLM compiles natural language to Intent JSON. Runtime executes.
- **AI tasks and UI tasks share the same snapshot.** One `dispatch()` path for both.

## Stack

- **Runtime**: `@manifesto-ai/sdk` + `@manifesto-ai/compiler` (workspace packages)
- **Domain**: MEL (Manifesto Expression Language) — `src/domain/taskflow.mel`
- **UI**: Next.js 16, React 19, Tailwind CSS 4, Radix UI, Framer Motion
- **AI**: Anthropic Claude API via `@anthropic-ai/sdk`

## Setup

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start development server
pnpm -C apps/taskflow dev
```

### AI Assistant (Optional)

To enable the AI assistant, set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Without the key, the assistant panel will show a configuration message. All other features (task CRUD, views, drag-and-drop) work without it.

## Commands

```bash
pnpm -C apps/taskflow dev        # Start dev server
pnpm -C apps/taskflow typecheck  # Run TypeScript checks
pnpm -C apps/taskflow lint       # Run ESLint
pnpm -C apps/taskflow test       # Run Vitest tests (9 scenarios)
```

## Domain Model

Defined in `src/domain/taskflow.mel`:

- **State**: `tasks[]`, `selectedTaskId`, `viewMode`, `assistantOpen`
- **Computed** (12): `activeTasks`, `deletedTasks`, status-grouped tasks, counts
- **Actions** (10): `createTask`, `updateTask`, `moveTask`, `softDeleteTask`, `restoreTask`, `permanentlyDeleteTask`, `emptyTrash`, `selectTask`, `changeView`, `toggleAssistant`

## Key Files

| File | Role |
|------|------|
| `src/domain/taskflow.mel` | MEL domain definition (canonical) |
| `src/domain/taskflow-schema.ts` | MEL as TS string (Turbopack workaround, F-005) |
| `src/manifesto/instance.ts` | SDK instance + `dispatchAsync` helper |
| `src/hooks/useTaskFlow.ts` | React hook: snapshot → state + actions |
| `src/app/api/agent/route.ts` | LLM Intent Compiler endpoint |
| `src/types/intent.ts` | Intent type definitions |
| `src/app/page.tsx` | Main page: intent execution + UI wiring |

## Documentation

- [FRICTION.md](./FRICTION.md) — Implementation friction log (12 issues, prioritized)
- [docs/SDK-REBUILD-WORKING.md](./docs/SDK-REBUILD-WORKING.md) — Phase execution checklist
- [docs/UI-CONTRACT.md](./docs/UI-CONTRACT.md) — State/computed/action contract
- [docs/ADR.md](./docs/ADR.md) — LLM-as-Intent-Compiler architecture decision
