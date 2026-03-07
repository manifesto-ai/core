# AI Agent Integration

> Let an agent propose intents against the same Snapshot model your human-facing code uses.

---

## The Core Idea

An AI agent should not mutate state directly. It should produce intent candidates and submit them through the same public SDK contract:

1. Build or receive an intent description
2. Convert it to a real `Intent`
3. Dispatch it
4. Read the resulting snapshot or telemetry

That keeps humans, agents, and automation on one state model.

---

## A Small Pattern

```typescript
import { createIntent, type ManifestoInstance, type Snapshot } from "@manifesto-ai/sdk";

export async function dispatchAsync(
  manifesto: ManifestoInstance,
  type: string,
  input?: unknown,
): Promise<Snapshot> {
  const intentId = crypto.randomUUID();
  const intent =
    input === undefined
      ? createIntent(type, intentId)
      : createIntent(type, input, intentId);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      offCompleted();
      offRejected();
      offFailed();
    };

    const offCompleted = manifesto.on("dispatch:completed", (event) => {
      if (event.intentId !== intentId) return;
      cleanup();
      resolve(event.snapshot!);
    });
    const offRejected = manifesto.on("dispatch:rejected", (event) => {
      if (event.intentId !== intentId) return;
      cleanup();
      reject(new Error(event.reason ?? "Dispatch rejected"));
    });
    const offFailed = manifesto.on("dispatch:failed", (event) => {
      if (event.intentId !== intentId) return;
      cleanup();
      reject(event.error ?? new Error("Dispatch failed"));
    });

    manifesto.dispatch(intent);
  });
}
```

Your agent can now work with the same lifecycle as the rest of the application.

---

## Example: Agent Produces Intent Candidates

```typescript
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
    candidate.type,
    candidate.input,
  );

  return snapshot.data;
}
```

The agent does not need a special write path. It needs a good way to choose the next intent.

---

## Optional Governance With World

If agent actions require approval, lineage, or explicit actor tracking, add `@manifesto-ai/world` as a separate integration step. A typical governed flow looks like this:

```text
agent proposal -> World authority check -> approved intent -> Host/Core -> next Snapshot
```

That is a higher-level deployment choice. It is not automatically wired by `createManifesto()`.

---

## Where the Translator Fits

If you use the translator stack, treat its output as intent candidates or plans. The final step is still the same:

- lower the result to a Manifesto intent shape
- create a stable `intentId`
- dispatch it or route it through World

Keep the boundary clean: the agent proposes, the Manifesto runtime applies the resulting state transition.

---

## Common Mistakes

### Letting the agent bypass the SDK

If the agent edits storage or UI state directly, humans and automation stop sharing one truth.

### Hiding approval logic in the agent layer

If you need explicit approval, model it in World or application policy, not in ad-hoc prompt logic alone.

### Forgetting to persist the resulting snapshot

The agent should reason from Snapshot, not from a private memory of what it thinks happened.

---

## Next

- Read [React](./react) to connect the same instance to a UI
- Read [Architecture](/architecture/) when you want the bigger system model
