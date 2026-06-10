# When You Need Approval or History

> Do not start here unless the base runtime already makes sense.

Most projects should begin with `@manifesto-ai/sdk` and stay there. This page
is for the moment when direct action submission is no longer enough.

## Stay On The Base Runtime When

Do not add approval/history just because the packages exist. Stay with the SDK
runtime when the product only needs:

- a UI, route, script, or trusted agent that can submit actions immediately
- current-state reads through `snapshot()` or subscriptions
- ordinary server logs, analytics, or database persistence outside Manifesto
- local undo/redo or draft UI state that does not need sealed continuity
- simple allow/deny checks that MEL or app code can enforce before calling an
  action

Those are app concerns. They do not require proposal records, approval decision
records, or branch history.

## Typical Signals

Open the advanced runtime only when one or more of these become true:

- writes need human review or approval before they commit
- the team needs actor attribution or explicit decision records
- state changes need durable audit history, not just the current snapshot
- branch/head continuity matters after commits
- an agent or workflow should propose work rather than execute it directly

If none of those are true, stay on the base SDK runtime.

## What Changes

The domain model stays the same. What changes is the runtime shape around it.

```text
createManifesto(schema, effects)
  -> withLineage(...)
  -> withGovernance(...)
  -> activate()
  -> action.x.submit(...)
  -> waitForSettlement(...)
```

That adds:

- continuity through `@manifesto-ai/lineage`
- review and decision flow through `@manifesto-ai/governance`
- durable audit history on top of the same domain model

## What Does Not Change

- Keep the same MEL domain.
- Keep the same app-owned action names.
- Keep UI and agent code reading snapshots and calling action helpers.
- Keep effect handlers returning patches.

The approval/history runtime changes what `submit()` means. It does not ask
React components, route handlers, or agent tools to learn low-level package
internals.

## Recommended Reading Order

1. [Tutorial 05: Approval and History Setup](/tutorial/05-governed-composition)
2. [Tutorial 06: Review And Durable History Flow](/tutorial/06-governed-sealing-and-history)
3. [Advanced Runtime Assembly](/guides/governed-composition) when you want the compact setup guide
4. [@manifesto-ai/lineage](/api/lineage) and [@manifesto-ai/governance](/api/governance) for package-level details

## Good Defaults

- Keep app onboarding, UI wiring, and simple agents on the base SDK runtime
  until reviewability is an actual requirement.
- Introduce the advanced runtime because of an operational need, not because the architecture exists.
- Use tooling like [`@manifesto-ai/studio-cli`](/api/studio-cli) and [`@manifesto-ai/studio-mcp`](/api/studio-mcp) to inspect the model before deciding that approval/history layers are necessary.

## See Also

- [Docs Home](/)
- [Quick Start](/guide/quick-start)
- [Tutorial](/tutorial/)
- [AI Agents](/integration/ai-agents)
