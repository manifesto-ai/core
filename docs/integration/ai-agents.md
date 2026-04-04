# AI Agent Integration

> Let an agent choose the next change, then route that change through the base runtime first and escalate only when writes need review or audit history.
>
> **Current Contract Note:** This page describes the current activation-first SDK surface and the current Lineage/Governance decorator runtime surface. SDK snapshots follow the current Core v4.0.0 contract and no longer expose accumulated `system.errors`.

---

## Two Agent Paths

Manifesto supports two stable agent patterns:

1. direct-dispatch agent turns
2. governed proposal turns

Use direct dispatch when the agent is operating inside a trusted app session and does not need approval. Escalate to reviewable proposals only when the action needs legitimacy, actor tracking, or branch history.

## Agent Tooling Stack

Current agent-facing DX is split across three packages:

- [`@manifesto-ai/skills`](/api/skills) installs current Manifesto guidance into Codex, Claude Code, Cursor, Copilot, and Windsurf
- [`@manifesto-ai/mel-lsp`](/api/mel-lsp) adds MEL diagnostics plus `mel/schemaIntrospection` and `mel/actionSignatures`
- [`@manifesto-ai/studio-mcp`](/api/studio-mcp) exposes graph, findings, availability, trace, lineage, and governance over MCP

Use `skills` for prompt context, `mel-lsp` for authoring-time schema awareness, and `studio-mcp` when an agent needs read-only inspection tools against a concrete domain.

If you use Codex and want Manifesto-specific guidance loaded into the agent session, install `@manifesto-ai/skills` separately and run its explicit Codex setup command.

If you are still deciding whether the agent really needs approval or history, read [When You Need Approval or History](/guides/approval-and-history) before adopting the advanced runtime.

---

## 1. Direct-Dispatch Agent Path

```typescript
import { createManifesto } from "@manifesto-ai/sdk";

const world = createManifesto(todoSchema, effects).activate();

const snapshot = await world.dispatchAsync(
  world.createIntent(
    world.MEL.actions.addTodo,
    "Agent-authored task",
  ),
);
```

This path is appropriate when the agent is already trusted to act on the current Snapshot and the app does not need proposal review.

---

## 2. Optional Proposal Path

When the agent genuinely needs explicit approval or audit history, compose Governance and Lineage first, then submit a proposal from the activated runtime.

```typescript
import { createManifesto } from "@manifesto-ai/sdk";
import { createInMemoryLineageStore, withLineage } from "@manifesto-ai/lineage";
import { createInMemoryGovernanceStore, withGovernance } from "@manifesto-ai/governance";

const agentRuntime = withGovernance(
  withLineage(createManifesto(todoSchema, effects), {
    store: createInMemoryLineageStore(),
  }),
  {
    governanceStore: createInMemoryGovernanceStore(),
    bindings: [
      {
        actorId: "actor:agent",
        authorityId: "authority:auto",
        policy: { mode: "auto_approve" },
      },
    ],
    execution: {
      projectionId: "todo-agent",
      deriveActor: () => ({ actorId: "actor:agent", kind: "agent" }),
      deriveSource: () => ({ kind: "agent", eventId: crypto.randomUUID() }),
    },
  },
).activate();

const proposal = await agentRuntime.proposeAsync(
  agentRuntime.createIntent(
    agentRuntime.MEL.actions.addTodo,
    "Agent-authored task",
  ),
);
```

From there, the agent can submit the proposal for approval, wait for authority resolution, and let the advanced runtime seal the result.

---

## When To Propose Versus Route Directly

| Use Direct Dispatch When | Use Governance When |
|--------------------------|---------------------|
| The action is routine and local | The action needs approval or review |
| The agent is acting inside a trusted session | The agent may affect other users or branches |
| The result can be observed from Snapshot only | You need proposal history or legitimacy records |
| Latency matters more than audit structure | Auditability matters more than the shortest path |

If the agent is deciding between candidate writes but does not need a formal review, direct dispatch is usually enough.

---

## 3. Keep The Translator Boundary Clean

If you use a translator or planner, treat its output as an intent candidate, not as a state mutation.

```typescript
type AgentCommand =
  | { kind: "addTodo"; title: string }
  | { kind: "toggleTodo"; id: string };

async function runAgentTurn(command: AgentCommand) {
  switch (command.kind) {
    case "addTodo":
      return world.dispatchAsync(
        world.createIntent(world.MEL.actions.addTodo, command.title),
      );
    case "toggleTodo":
      return world.dispatchAsync(
        world.createIntent(world.MEL.actions.toggleTodo, command.id),
      );
  }
}
```

The agent or planner can still choose the next command. The app-owned translator layer is responsible for mapping that command into the runtime's typed action refs instead of letting the agent mutate state directly or rely on raw string names as the app-facing contract.

---

## 4. Keep Approval Logic Out Of The Prompt Alone

If the action requires explicit approval, do not bury the policy inside prompt text only. Route it through governance so the review, decision, and seal are visible in the runtime model.

That is the right place for:

- actor identity
- proposal review
- branch-aware decisions
- audit history

---

## Common Mistakes

### Letting the agent bypass the runtime

If the agent edits storage or UI state directly, humans and automation stop sharing one truth.

### Hiding approval logic in the agent layer

If you need explicit approval, model it in governance or application policy, not in ad-hoc prompt logic alone.

### Forgetting to persist the resulting snapshot

The agent should reason from Snapshot, not from a private memory of what it thinks happened.

---

## Next

- Install [`@manifesto-ai/skills`](/api/skills) if you want Codex or another AI tool to load Manifesto-specific guidance
- Use [`@manifesto-ai/studio-mcp`](/api/studio-mcp) when the agent should inspect graph, findings, or runtime overlays through MCP
- Read [React](./react) to connect the same instance to a UI
- Read [When You Need Approval or History](/guides/approval-and-history) when the agent may need review, approval, or sealed history
- Read [Governance API](/api/governance) when the agent should work through proposals and sealing
- Read [Architecture](/architecture/) when you want the bigger system model
