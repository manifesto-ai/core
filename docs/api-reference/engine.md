# Engine API Reference

The `@manifesto-ai/engine` package is the framework-agnostic runtime that executes Manifesto schemas. It combines expression evaluation, dependency tracking, form/list runtimes, schema loading, and a legacy adapter so that UIs and agents can share the same execution core.

## Table of Contents
- [Installation](#installation)
- [Modules at a Glance](#modules-at-a-glance)
- [Form Runtime](#form-runtime)
- [List Runtime](#list-runtime)
- [Expression Evaluator](#expression-evaluator)
- [Reactive Dependency Tracker](#reactive-dependency-tracker)
- [Schema Loader](#schema-loader)
- [Legacy Adapter](#legacy-adapter)

---

## Installation

```bash
# Using pnpm
pnpm add @manifesto-ai/engine

# Using npm
npm install @manifesto-ai/engine

# Using yarn
yarn add @manifesto-ai/engine
```

---

## Modules at a Glance
| Module | Purpose |
| --- | --- |
| **FormRuntime** | Drives form state, coercion/validation against `EntitySchema`, reactions, and side effects (API-driven options, navigation, emits). |
| **ListRuntime** | Manages list views with pagination, sorting, filters, selection, and expression-driven column metadata. |
| **ExpressionEvaluator** | Sandbox that runs array-based expressions with operator registry, context references, and depth/timeout guards. |
| **ReactiveDependencyTracker** | Builds a DAG from view schemas and re-evaluates only fields affected by a change. |
| **SchemaLoader** | Fetches, validates, caches, and returns strongly typed schemas (entity, view, action). |
| **LegacyAdapter** | Anti-corruption layer that transforms requests/responses via pipelines for SOAP/XML/legacy APIs. |

---

## Form Runtime
The form runtime keeps the UI and schema in sync. It evaluates expressions, enforces `EntitySchema` constraints, and routes reactions.

```ts
import { createFormRuntime } from '@manifesto-ai/engine'

const runtime = createFormRuntime(viewSchema, {
  entitySchema,
  initialValues: { name: 'Sample', price: 99.99 },
  context: { user: { id: 'u1' }, params: { mode: 'edit' } },
  fetchHandler: (endpoint, options) => fetch(endpoint, options).then((r) => r.json()),
  navigateHandler: (path, params) => console.log('navigate', path, params),
  emitHandler: (event, payload) => console.log(event, payload),
})

const initResult = runtime.initialize()
if (initResult._tag === 'Ok') {
  runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'price', value: '120' })
  console.log(runtime.getState())
}
```

### Key behaviors
- **Initialization**: builds dependency graphs from the view schema, seeds field metadata, loads enum options from `EntitySchema`, evaluates all expressions, and fires `mount` reactions.【F:packages/engine/src/runtime/form-runtime.ts†L59-L152】【F:packages/engine/src/runtime/form-runtime.ts†L179-L232】
- **Event dispatch**: handles `FIELD_CHANGE`, `FIELD_BLUR`, `FIELD_FOCUS`, `SUBMIT`, `RESET`, and `VALIDATE`, returning a `Result` for error handling.【F:packages/engine/src/runtime/form-runtime.ts†L154-L224】
- **Type safety**: coerces incoming values to the target `DataType` (number, boolean, date/datetime) before validation and reports type errors as `VALIDATION_ERROR`.【F:packages/engine/src/runtime/form-runtime.ts†L232-L310】【F:packages/engine/src/runtime/form-runtime.ts†L312-L369】
- **Validation**: uses `EntityField` constraints (required, ranges, enums, etc.) to populate field error messages and compute `isValid`.【F:packages/engine/src/runtime/form-runtime.ts†L370-L461】
- **Reactions & expressions**: extracts expressions from reactions, tracks `$state` references, and re-evaluates only affected fields when a value changes. Results map back to field props/values via the dependency tracker.【F:packages/engine/src/tracker/reactive.ts†L19-L130】【F:packages/engine/src/tracker/reactive.ts†L132-L205】
- **Side effects**:
  - `setOptions` can call an injected `fetchHandler`, evaluate params via expressions, and transform the response into enum options.【F:packages/engine/src/runtime/form-runtime.ts†L520-L642】
  - `navigate` and `emit` actions are delegated to injected handlers after evaluating expression-based params/payloads.【F:packages/engine/src/runtime/form-runtime.ts†L663-L732】
- **State shape**: `getState()` exposes values, field metadata (hidden/disabled/errors/props), loaded options, and flags (`isValid`, `isDirty`, `isSubmitting`).【F:packages/engine/src/runtime/form-runtime.ts†L197-L224】

---

## List Runtime
The list runtime drives tabular views with schema-driven behavior.

```ts
import { createListRuntime } from '@manifesto-ai/engine'

const runtime = createListRuntime(listSchema, {
  context: { user: { id: 'u1' } },
  fetchHandler: (query) => fetch('/api/list', { method: 'POST', body: JSON.stringify(query) }).then((r) => r.json()),
})

runtime.initialize()
runtime.dispatch({ type: 'REFRESH' })
```

### Capabilities
- Initializes column metadata and default pagination/sorting from the schema.【F:packages/engine/src/runtime/list-runtime.ts†L39-L82】【F:packages/engine/src/runtime/list-runtime.ts†L92-L122】
- Evaluates expression-driven column properties with the shared evaluator context (state, context, user, params, env).【F:packages/engine/src/runtime/list-runtime.ts†L13-L37】【F:packages/engine/src/runtime/list-runtime.ts†L77-L82】
- Supports static data sources or API-driven refresh with transform pipelines for list responses.【F:packages/engine/src/runtime/list-runtime.ts†L96-L122】【F:packages/engine/src/runtime/list-runtime.ts†L187-L267】

---

## Expression Evaluator
`ExpressionEvaluator` runs the Mapbox-style expression DSL safely.

```ts
import { createEvaluator } from '@manifesto-ai/engine'

const evaluator = createEvaluator({ maxDepth: 100, timeout: 1000, debug: true })
const context = { state: { price: 100 }, context: {}, user: {}, params: {}, result: {}, env: {} }

const result = evaluator.evaluate(['IF', ['>', '$state.price', 50], 'expensive', 'cheap'], context)
```

- Uses string context references like `$state.field`/`$user.role` and literal values; unsupported shapes raise `INVALID_EXPRESSION`.【F:packages/engine/src/evaluator/context.ts†L8-L74】【F:packages/engine/src/evaluator/evaluator.ts†L48-L132】
- Guards against runaway evaluation with `maxDepth` and `timeout`, throwing structured errors (`MAX_DEPTH_EXCEEDED`, `TIMEOUT`, `UNKNOWN_OPERATOR`, `INVALID_EXPRESSION`).【F:packages/engine/src/evaluator/evaluator.ts†L15-L120】【F:packages/engine/src/evaluator/evaluator.ts†L134-L213】
- Operator registry includes comparison, logical, collection, string, numeric, conditional, type, access, and date helpers (e.g., `IN`, `CONTAINS`, `FORMAT_DATE`).【F:packages/engine/src/evaluator/operators.ts†L9-L165】【F:packages/engine/src/evaluator/operators.ts†L241-L311】
- `evaluateMany` runs a map of expressions with a shared context and returns a map of results wrapped in a `Result`. Debug mode captures per-expression timing/depth logs.【F:packages/engine/src/evaluator/evaluator.ts†L72-L104】【F:packages/engine/src/evaluator/evaluator.ts†L137-L168】

---

## Reactive Dependency Tracker
`ReactiveDependencyTracker` maps field relationships and drives selective re-evaluation.

- Builds a DAG from view schemas, combining explicit `dependsOn` with dependencies inferred from expressions and `$state.*` references.【F:packages/engine/src/tracker/reactive.ts†L46-L130】【F:packages/engine/src/tracker/dag.ts†L24-L117】
- Prevents cycles when edges are added and reports the offending path (`CYCLE_DETECTED`).【F:packages/engine/src/tracker/dag.ts†L118-L205】
- Computes evaluation order via cached topological sort and exposes affected nodes when a field changes. Only those fields are re-evaluated with the shared `ExpressionEvaluator`.【F:packages/engine/src/tracker/dag.ts†L75-L117】【F:packages/engine/src/tracker/dag.ts†L207-L279】【F:packages/engine/src/tracker/reactive.ts†L132-L205】

---

## Schema Loader
The schema loader fetches JSON schemas, validates them with `@manifesto-ai/schema`, and caches them.

```ts
import { createSchemaLoader } from '@manifesto-ai/engine'

const loader = createSchemaLoader({ basePath: '/schemas', cacheTTL: 5 * 60 * 1000 })
const view = await loader.loadView('product/form')
```

- Supports `load`, `loadFromData`, and `loadMany` with optional caching/TTL controls (`cache` default `true`, `cacheTTL` default 5 minutes, `basePath` default `/schemas`).【F:packages/engine/src/loader/schema-loader.ts†L12-L92】【F:packages/engine/src/loader/schema-loader.ts†L148-L207】
- Type-specific helpers `loadEntity`, `loadView`, and `loadAction` ensure schema `_type` matches and surface validation errors via the shared `Result` type. Cached entries expire based on `cacheTTL`.【F:packages/engine/src/loader/schema-loader.ts†L94-L146】【F:packages/engine/src/loader/schema-loader.ts†L209-L248】
- `invalidate` and `clearCache` manage cache lifecycle; `getCachedSchemas` lists current entries. URLs are constructed as `${basePath}/${schemaId}.json` with safe trimming of slashes.【F:packages/engine/src/loader/schema-loader.ts†L209-L248】

---

## Legacy Adapter
`LegacyAdapter` is the anti-corruption layer for heterogeneous backends.

- Transforms request payloads before sending and response payloads after receiving, powered by configurable transform pipelines (`requestTransform` / `responseTransform`).【F:packages/engine/src/adapter/legacy-adapter.ts†L45-L94】【F:packages/engine/src/adapter/legacy-adapter.ts†L96-L171】
- Detects and parses XML/SOAP (or falls back to JSON) via an injectable `xmlParser`, returning structured `AdapterResult` or `AdapterError`. Parsing respects adapter `type` hints (`legacy`, `soap`, `graphql`).【F:packages/engine/src/adapter/legacy-adapter.ts†L173-L252】
- Provides debug logging, duration metadata, and timeout configuration for long-running integrations.【F:packages/engine/src/adapter/legacy-adapter.ts†L25-L43】【F:packages/engine/src/adapter/legacy-adapter.ts†L45-L94】
