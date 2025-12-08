# Manifesto Documentation

**The AI-Native Semantic UI State Layer**

> Manifesto is not a form library. It is a **protocol** for Human-AI interaction—a semantic layer that exposes the complete meaning, structure, and state of your application's UI to both humans and AI agents.

---

## What is Manifesto?

```
┌────────────────────────────────────────────────────────────────────┐
│                        Traditional UI                              │
│                                                                    │
│    Code ──────► Renderer ──────► DOM ──────► Pixels                │
│                                                  │                 │
│                                    AI sees only this               │
│                                    (opaque, unstructured)          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                         Manifesto UI                                  │
│                                                                    │
│    Schema ──────► Engine ──────► DOM ──────► Pixels                │
│                      │                                             │
│                      ├──► Semantic State    ◄── AI reads this      │
│                      ├──► Business Rules    ◄── AI reasons about   │
│                      ├──► Dependency Graph  ◄── AI predicts        │
│                      └──► Valid Transitions ◄── AI acts safely     │
│                                                                    │
│               Full UI context exposed to AI Agents                 │
└────────────────────────────────────────────────────────────────────┘
```

**Manifesto transforms UI from opaque rendering into transparent semantic data.**

---

## Why Manifesto?

| Challenge | Traditional Approach | Manifesto Approach |
|-----------|---------------------|-----------------|
| **AI Understanding** | Parse DOM/pixels, guess meaning | Read structured semantic state |
| **Multi-brand Forms** | Fork codebase N times | One engine, N schemas |
| **Business Logic** | Scattered across components | Centralized in schemas |
| **Maintenance** | O(N) cost per form | O(1) cost regardless of scale |
| **Agent Automation** | Screen scraping, unreliable | Deterministic state transitions |

---

## Core Concepts

Start here to understand the paradigm:

| Document | What You'll Learn |
|----------|-------------------|
| **[Philosophy](./philosophy.md)** | Why UI needs a semantic layer. The AI-Native manifesto-ai. |
| **[Architecture](./architecture.md)** | 3-Layer schema system (Entity, View, Action) and data flow. |
| **[Getting Started](./getting-started.md)** | Build your first Manifesto form in 5 minutes. |

---

## For AI Agents

Manifesto is designed for AI-first development. These resources help you integrate with LLMs and autonomous agents:

| Topic | Description |
|-------|-------------|
| **[ViewSnapshot Architecture](architectures/view-snapshot.md)** | **New!** Normalized UI state for AI agents: Page, Form, Table, Overlay snapshots with Intent-based mutations |
| **[AI Interoperability Protocol](./ai-interoperability.md)** | White Box contract for AI agents: semantic snapshots, intent-based actions, deterministic deltas |
| **Semantic State Export** | The engine exposes complete UI state: values, visibility, validation, options, dependencies, and available transitions. |
| **LLM Tool Definitions** | `@manifesto-ai/ai-util` can emit OpenAI/Claude tool schemas from live snapshots (`toToolDefinitions`) |
| **Safe Expression DSL** | Logic is expressed as AST arrays (`['==', '$state.x', 'value']`), not code strings. No `eval()`, fully serializable. |
| **Deterministic Transitions** | AI can predict exactly what will happen before taking any action. |
| **Schema Generation** | AI can generate valid schemas from natural language requirements. |

**What AI Agents Receive (ViewSnapshot):**

```typescript
// PageSnapshot - normalized UI state
{
  nodeId: 'order-management-page',
  kind: 'page',
  label: '주문 관리',
  children: [
    { nodeId: 'order-filter', kind: 'form', fields: [...], isValid: true, ... },
    { nodeId: 'order-table', kind: 'table', columns: [...], rows: [...], selection: {...}, ... }
  ],
  overlays: [],  // Modal/Dialog/Toast instances
  actions: [...]
}

// ViewIntent - mutation commands
{ type: 'setFieldValue', nodeId: 'order-filter', fieldId: 'status', value: 'paid' }
{ type: 'selectRow', nodeId: 'order-table', rowId: 'row-1' }
{ type: 'openOverlay', template: 'deleteConfirm', dataSourceNodeId: 'order-table' }
```

---

## Schema Reference

Define your UI declaratively:

| Schema | Purpose | Key Features |
|--------|---------|--------------|
| **[Entity Schema](./schema-reference/entity-schema.md)** | Data structure | Types, constraints, relations |
| **[View Schema](./schema-reference/view-schema.md)** | UI layout (Form & List) | Components, layouts, styling, ListView |
| **[Action Schema](./schema-reference/action-schema.md)** | Workflows | API calls, transforms, navigation |
| **[Expression DSL](./schema-reference/expression-dsl.md)** | Dynamic logic | Safe, AST-based expressions |
| **[Reaction DSL](./schema-reference/reaction-dsl.md)** | Event handling | Triggers, conditions, actions |

---

## API Reference

Integrate with your framework:

| Package | Use Case | Documentation |
|---------|----------|---------------|
| **@manifesto-ai/schema** | Schema builders and types | Included in schema reference |
| **@manifesto-ai/engine** | Framework-agnostic runtime (Form + List) | [engine.md](./api-reference/engine.md) |
| **@manifesto-ai/react** | React integration (FormRenderer, ListRenderer) | [react.md](./api-reference/react.md) |
| **@manifesto-ai/vue** | Vue integration (FormRenderer, ListRenderer) | [vue.md](./api-reference/vue.md) |
| **@manifesto-ai/view-snapshot** | ViewSnapshot architecture for AI agents | [view-snapshot.md](architectures/view-snapshot.md) |
| **@manifesto-ai/ai-util** | AI utilities (deprecated, use view-snapshot) | [ai.md](./api-reference/ai.md) |

---

## Developer Guides

Learn patterns and best practices:

| Guide | What You'll Build |
|-------|-------------------|
| **[Basic CRUD Form](./guides/basic-crud-form.md)** | Complete product form with validation |
| **[Dynamic Conditions](./guides/dynamic-conditions.md)** | Show/hide fields based on state |
| **[Cascade Select](./guides/cascade-select.md)** | Country → State → City dropdowns |
| **[Validation Patterns](./guides/validation.md)** | Cross-field validation, async checks |
| **[Legacy Integration](./guides/legacy-integration.md)** | Connect to SOAP/XML/legacy REST APIs |

---

## Migration & Adoption

| Resource | Description |
|----------|-------------|
| **[Adoption Guide](./migration/adoption-guide.md)** | When to use Manifesto, migration strategies |
| **[Contributing](../CONTRIBUTING.md)** | How to contribute to the project |
| **[Changelog](../CHANGELOG.md)** | Version history and release notes |

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                     Schema Definition                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │    Entity    │  │     View     │  │    Action    │           │
│  │    Schema    │  │    Schema    │  │    Schema    │           │
│  │              │  │              │  │              │           │
│  │  Data Model  │  │  UI Layout   │  │  Workflows    │           │
│  │  Constraints │  │  Components  │  │  API Calls   │           │
│  │  Relations   │  │  Reactions   │  │  Transforms  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     @manifesto-ai/engine                              │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ Expression │  │ Dependency │  │   Form     │  │   List    │  │
│  │ Evaluator  │  │  Tracker   │  │  Runtime   │  │  Runtime  │  │
│  │            │  │            │  │            │  │           │  │
│  │ Safe eval  │  │ DAG-based  │  │ State mgmt │  │ Paging,   │  │
│  │ No eval()  │  │ Optimized  │  │ Reactive   │  │ Sort, Sel │  │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               Semantic State Export                      │   │
│  │   Values │ Rules │ Graph │ Transitions │ Context         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ @manifesto-ai/react│  │ @manifesto-ai/vue  │  │  AI Agents   │
│              │  │              │  │              │
│ Hooks        │  │ Composables  │  │ Read state   │
│ Form + List  │  │ Form + List  │  │ Reason       │
│ Renderers    │  │ Renderers    │  │ Act safely   │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Live Examples

Explore interactive demos:

```bash
# React Storybook
pnpm storybook:react

# Vue Storybook
pnpm storybook:vue
```

---

## Quick Links

- [GitHub Repository](../README.md)
- [Philosophy & Vision](./philosophy.md)
- [Getting Started](./getting-started.md)
- [Expression DSL Reference](./schema-reference/expression-dsl.md)

---

**Version:** 0.0.1 (Development)

*Manifesto: Making UI transparent to intelligence.*
