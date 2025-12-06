# @manifesto-ai/engine

The Manifesto engine provides a framework-agnostic runtime that executes Manifesto schemas. It combines expression evaluation, dependency tracking, form/list runtimes, schema loading, and legacy system adaptation into one package.

## Contents
- **Expression Evaluator**: Safe Mapbox-style expression runner with operator registry, depth/timeout guards, and debug logging.
- **Reactive Dependency Tracker**: DAG-based tracker that recomputes only the fields affected by a change.
- **Form Runtime**: Manages form state, coercion/validation against Entity schemas, reactions, and side effects (navigation, API-driven options, emits).
- **List Runtime**: Handles list views with pagination, sorting, filtering, and expression-driven column metadata.
- **Schema Loader**: Fetches and validates schemas with caching and TTL control.
- **Legacy Adapter**: Anti-corruption layer that transforms requests/responses via pipelines for SOAP/XML/legacy APIs.

## Quickstart
```ts
import { createFormRuntime } from '@manifesto-ai/engine'
import { productView, productEntity } from './schemas'

const runtime = createFormRuntime(productView, {
  entitySchema: productEntity,
  initialValues: { name: 'Sample', price: 100 },
  context: { user: { id: 'u1' } },
})

const initResult = runtime.initialize()
if (initResult._tag === 'Ok') {
  runtime.dispatch({ type: 'FIELD_CHANGE', fieldId: 'price', value: 120 })
  console.log(runtime.getState())
}
```

For detailed APIs, see `docs/api-reference/engine.md`.
