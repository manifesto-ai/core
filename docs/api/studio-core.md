# @manifesto-ai/studio-core

> Projection-first read-only analysis engine for Manifesto domains.

## Overview

`@manifesto-ai/studio-core` takes a `DomainSchema` plus optional overlays and returns stable JSON projections for tools and dashboards.

Use it when you want:

- a semantic graph of the domain
- findings analysis over static and runtime overlays
- action availability and coarse blocker explanations, alongside runtime-owned fine intent-legality tooling
- snapshot, trace, lineage, and governance inspection
- one read-only analysis engine shared across CLI, MCP, and UI surfaces

`createStudioSession(bundle, options?)` is the supported entry point.

## Entry Point

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createStudioSession } from "@manifesto-ai/studio-core";

const runtime = createManifesto(schema, effects).activate();

const session = createStudioSession({
  schema,
  snapshot: runtime.getCanonicalSnapshot(),
  trace,
  lineage,
  governance,
}, {
  validationMode: "lenient",
});
```

## Session Methods

| Method | Purpose |
|--------|---------|
| `attachSnapshot(snapshot)` | Attach a canonical runtime snapshot |
| `attachTrace(trace)` | Attach a `TraceGraph` |
| `attachLineage(lineage)` | Attach lineage export or query-like input |
| `attachGovernance(governance)` | Attach governance export or query-like input |
| `detachOverlay(kind)` | Drop one overlay from the session |
| `getGraph(format?)` | Return the domain graph projection |
| `getFindings(filter?)` | Return findings across the current bundle |
| `getActionAvailability()` | Return coarse action-family legality from the current canonical snapshot |
| `explainActionBlocker(actionId)` | Explain why an action family is blocked |
| `inspectSnapshot()` | Return a snapshot inspection projection |
| `analyzeTrace()` | Return trace replay analysis |
| `getLineageState()` | Return lineage state projection |
| `getGovernanceState()` | Return governance state projection |

## Projection Contracts

| API | Projection |
|-----|------------|
| `getGraph()` | `DomainGraphProjection` |
| `getFindings()` | `FindingsReportProjection` |
| `getActionAvailability()` | `ActionAvailabilityProjection[]` |
| `explainActionBlocker()` | `ActionBlockerProjection` |
| `inspectSnapshot()` | `SnapshotInspectorProjection` |
| `analyzeTrace()` | `TraceReplayProjection` |
| `getLineageState()` | `LineageStateProjection` |
| `getGovernanceState()` | `GovernanceStateProjection` |

All of these are JSON-serializable and surface-neutral.

## Input Rules

- `snapshot` must be a canonical runtime snapshot from `runtime.getCanonicalSnapshot()`
- `lineage` and `governance` accept canonical exports and widened query-like shapes
- absent optional overlays degrade to structured `"not-provided"` results instead of failing the whole session
- malformed optional overlays throw only when `validationMode: "strict"` is enabled

`getGraph()` and `getFindings()` always work with `schema` alone.

## Where It Fits

- [`@manifesto-ai/studio-cli`](./studio-cli) wraps this package for terminal workflows.
- [`@manifesto-ai/studio-mcp`](./studio-mcp) wraps the same analysis surface as MCP tools.
- UI packages and dashboards should build on this package instead of re-implementing graph or findings logic.

## Related Docs

- [Developer Tooling Guide](/guides/developer-tooling)
- [@manifesto-ai/studio-cli](./studio-cli)
- [@manifesto-ai/studio-mcp](./studio-mcp)
