# @manifesto-ai/world

> Historical note only.

## Status

`@manifesto-ai/world` is not part of the current maintained public runtime story.

The active governed composition path is:

```typescript
createManifesto(schema, effects)
  -> withLineage(...)
  -> withGovernance(...)
  -> activate()
```

## How to use this file

Use this file only when:

- reading historical ADRs or archived specs
- explaining the previous facade split
- handling migration or archaeology tasks

Do not use old `world` facade docs as the default basis for new code changes.

## Current owners

- continuity and sealing: `@manifesto-ai/lineage`
- legitimacy and proposals: `@manifesto-ai/governance`
- direct application runtime: `@manifesto-ai/sdk`
