# TaskFlow v2 SDK Rebuild Working Guide

This guide is the execution checklist for rebuilding `apps/taskflow` on top of the current Manifesto workspace.

## Baseline

- The current app is a UI shell, not a working data app.
- Zustand, legacy runtime, storage, and agent backends are intentionally removed.
- Surviving UI components already render from explicit props and fixture data.
- The monorepo currently contains local workspace packages:
  - `@manifesto-ai/sdk` `1.2.2`
  - `@manifesto-ai/compiler` `1.6.3`

## Before Phase 1

1. Re-read the current specs listed in the rebuild brief.
2. Reintroduce dependencies using workspace references, not npm versions:
   - `@manifesto-ai/sdk`: dependency
   - `@manifesto-ai/compiler`: devDependency
3. Decide and document the MEL loading path for Next.js before writing domain code:
   - imported `.mel` via loader
   - raw MEL string
4. Confirm the app still passes:
   - `pnpm -C apps/taskflow typecheck`
   - `pnpm -C apps/taskflow lint`
5. Start logging real friction in [FRICTION.md](../FRICTION.md) immediately.

## Phase 1 Deliverables ✅ COMPLETE

Create:

- `src/domain/taskflow.mel` ✅
- `src/manifesto/instance.ts` ✅
- `src/manifesto/__tests__/taskflow.test.ts` ✅
- package scripts for test execution ✅

Working rules:

- Keep effect handlers empty in Phase 1 unless strictly needed.
- Prefer the smallest MEL that proves the loop.
- If MEL cannot express a needed computed or action, document it first, then add the smallest fallback.
- Use `dispatch:completed` and `dispatch:failed` only for intent lifecycle handling, not UI rendering.

Phase 1 acceptance:

- `createManifesto()` returns an instance
- `dispatch()` to terminal event cycle works
- the five required scenarios pass
- any compiler/setup friction is recorded

## Phase 2 Deliverables ✅ COMPLETE

Create:

- `src/hooks/useTaskFlow.ts` ✅ (React hook with Manifesto integration)
- Provider: inline in useTaskFlow via useRef/subscribe ✅
- Persistence: deferred (not required for demo) ✅

Replace shell wiring:

- `src/app/page.tsx` ✅
- surviving UI view/shared/sidebar components ✅ (props-only, no changes needed)

Phase 2 acceptance:

- fixture shell is replaced by Manifesto-backed state
- task CRUD, selection, trash, and view switching work
- persistence restores state across reloads
- no Zustand or legacy Manifesto imports remain

## Phase 3 Deliverables ✅ COMPLETE

Create:

- `src/app/api/agent/route.ts` ✅ (LLM Intent Compiler endpoint)
- `src/types/intent.ts` ✅ (9 intent types + API types)
- assistant data flow based on Manifesto intents ✅

Phase 3 acceptance:

- assistant returns validated intent JSON ✅
- client dispatches returned intent ✅
- AI-created and UI-created tasks land in the same snapshot ✅

## Phase 4 Deliverables ✅ COMPLETE

- `FRICTION.md` summary by category and severity ✅
- final README update ✅
- tests and lint/typecheck all green ✅ (pre-existing F-002 only)

## Rebuild Rules

- Do not restore the deleted legacy layers for convenience.
- Use the UI contract document as the boundary definition, not the old demo architecture.
- When the brief conflicts with the current repo baseline, prefer the current repo for framework versions and the brief for target architecture.
- If a workaround is kept in code, annotate it with a friction ID.

## Suggested Command Sequence

```bash
pnpm -C apps/taskflow typecheck
pnpm -C apps/taskflow lint

# Phase 1 begins
# add workspace deps, create taskflow.mel, create manifesto instance, add tests

pnpm -C apps/taskflow typecheck
pnpm -C apps/taskflow lint
pnpm -C apps/taskflow test
```
