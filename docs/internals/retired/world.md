# @manifesto-ai/world (Removed)

> **Status:** Removed after the Lineage/Governance split.
> **Decision:** [ADR-014](/internals/adr/014-split-world-protocol), then hard-cut from the active public story by [ADR-017](/internals/adr/017-capability-decorator-pattern).

::: warning Historical Page
This page is a retirement record only. Do not use it to infer current public APIs.
:::

`@manifesto-ai/world` was the former unified facade for continuity and
governance. It is no longer part of the active workspace or public runtime
story.

Current packages:

- `@manifesto-ai/lineage` owns sealed continuity, branch/head history, restore,
  and stored snapshot lookup.
- `@manifesto-ai/governance` owns proposal lifecycle, authority decisions, and
  approval settlement.
- `@manifesto-ai/sdk` owns the application-facing action runtime.

## Migration Target

Use explicit decorators instead of a world facade:

```typescript
const app = withGovernance(
  withLineage(createManifesto(schema, effects), lineageConfig),
  governanceConfig,
).activate();
```

For history without approval, use only `withLineage(...)`.

## Historical References

- Protocol split: [ADR-014](/internals/adr/014-split-world-protocol)
- Decorator composition: [ADR-017](/internals/adr/017-capability-decorator-pattern)
- Current continuity contract: [Lineage SPEC](/internals/spec/)
- Current legitimacy contract: [Governance API](/api/governance)

This page is retained only as a retirement record.
