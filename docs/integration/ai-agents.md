# AI Agent Integration

> Let an agent choose the next change, then route that change through either direct dispatch or governed proposal flow.

---

## Two Agent Paths

Manifesto supports two stable agent patterns:

1. direct-dispatch agent turns
2. governed proposal turns

Use direct dispatch when the agent is operating inside a trusted app session and does not need approval. Use governed proposals when the action needs legitimacy, actor tracking, or branch history.

If you use Codex and want Manifesto-specific guidance loaded into the agent session, install [`@manifesto-ai/skills`](/guides/codex-skills) separately and run its explicit Codex setup command.

---

## 1. Direct-Dispatch Agent Path

```typescript
import { createIntent, dispatchAsync } from "@manifesto-ai/sdk";

const snapshot = await dispatchAsync(
  manifesto,
  createIntent(
    "todo.add",
    { title: "Agent-authored task" },
    crypto.randomUUID(),
  ),
);
```

This path is appropriate when the agent is already trusted to act on the current Snapshot and the app does not need proposal review.

---

## 2. Governed Proposal Path

When the agent needs explicit approval, create an intent instance and hand it to the governed runtime.

```typescript
import {
  createIntentInstance,
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryWorldStore,
  createLineageService,
  createWorld,
} from "@manifesto-ai/world";

const store = createInMemoryWorldStore();
const lineage = createLineageService(store);
const governance = createGovernanceService(store, { lineageService: lineage });
const world = createWorld({
  store,
  lineage,
  governance,
  eventDispatcher: createGovernanceEventDispatcher({ service: governance }),
});

const intent = await createIntentInstance({
  body: {
    type: "todo.add",
    input: { title: "Agent-authored task" },
  },
  schemaHash: "todo-v1",
  projectionId: "todo-ui",
  source: { kind: "agent", eventId: "evt-2" },
  actor: { actorId: "agent-1", kind: "agent" },
});

const branch = world.lineage.getActiveBranch();
const proposal = world.governance.createProposal({
  baseWorld: branch.head,
  branchId: branch.id,
  actorId: intent.meta.origin.actor.actorId,
  authorityId: "auth-auto",
  intent: {
    type: intent.body.type,
    intentId: intent.intentId,
    input: intent.body.input,
    scopeProposal: intent.body.scopeProposal,
  },
  executionKey: intent.intentKey,
  submittedAt: Date.now(),
  epoch: branch.epoch,
});
```

From there, the agent can submit the proposal for approval, wait for authority resolution, and let the governed runtime seal the result.

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
import {
  createIntent,
  dispatchAsync,
  type ManifestoInstance,
} from "@manifesto-ai/sdk";

type IntentCandidate = {
  type: string;
  input?: unknown;
};

async function runAgentTurn(
  manifesto: ManifestoInstance,
  candidate: IntentCandidate,
) {
  const snapshot = await dispatchAsync(
    manifesto,
    createIntent(
      candidate.type,
      candidate.input ?? {},
      crypto.randomUUID(),
    ),
  );

  return snapshot.data;
}
```

The agent proposes a change. The runtime decides how that change becomes the next Snapshot.

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

### Letting the agent bypass the SDK

If the agent edits storage or UI state directly, humans and automation stop sharing one truth.

### Hiding approval logic in the agent layer

If you need explicit approval, model it in governance or application policy, not in ad-hoc prompt logic alone.

### Forgetting to persist the resulting snapshot

The agent should reason from Snapshot, not from a private memory of what it thinks happened.

---

## Next

- Read [Codex Skills Setup](/guides/codex-skills) if you want Codex to load Manifesto-specific guidance
- Read [React](./react) to connect the same instance to a UI
- Read [World](../concepts/world) when the agent should work through proposals and sealing
- Read [Architecture](/architecture/) when you want the bigger system model
