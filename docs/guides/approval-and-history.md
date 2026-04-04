# When You Need Approval or History

> Do not start here unless the base runtime already makes sense.

Most projects should begin with `@manifesto-ai/sdk` and stay there. This page is for the moment when the team realizes plain direct dispatch is no longer enough.

## Typical Signals

Open the advanced runtime only when one or more of these become true:

- writes need human review or approval before they commit
- the team needs actor attribution or explicit decision records
- state changes need sealed history, not just the current snapshot
- branch/head continuity matters after commits
- an agent or workflow should propose work rather than execute it directly

If none of those are true, stay on the base runtime.

## What Changes

The domain model stays the same. What changes is the runtime shape around it.

```text
createManifesto(schema, effects)
  -> withLineage(...)
  -> withGovernance(...)
  -> activate()
  -> proposeAsync(...)
```

That adds:

- continuity through `@manifesto-ai/lineage`
- review and decision flow through `@manifesto-ai/governance`
- sealed history on top of the same semantic model

## Recommended Reading Order

1. [Tutorial 05: Approval and History Setup](/tutorial/05-governed-composition)
2. [Tutorial 06: Sealed History and Review Flow](/tutorial/06-governed-sealing-and-history)
3. [Advanced Runtime Assembly](/guides/governed-composition) when you want the compact setup guide
4. [@manifesto-ai/lineage](/api/lineage) and [@manifesto-ai/governance](/api/governance) for package-level details

## Good Defaults

- Keep app onboarding, UI wiring, and simple agents on the base runtime until reviewability is an actual requirement.
- Introduce the advanced runtime because of an operational need, not because the architecture exists.
- Use tooling like [`@manifesto-ai/studio-cli`](/api/studio-cli) and [`@manifesto-ai/studio-mcp`](/api/studio-mcp) to inspect the model before deciding that approval/history layers are necessary.

## See Also

- [Start Here](/start-here)
- [Quickstart](/quickstart)
- [Tutorial](/tutorial/)
- [AI Agents](/integration/ai-agents)
