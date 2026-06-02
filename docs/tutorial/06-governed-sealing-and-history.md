# Sealed History And Review Flow

> See how a reviewable proposal becomes sealed history under the advanced runtime.

## What You'll Learn

- how a reviewable proposal moves toward execution
- how approval and rejection fit into the sealing flow
- how to read branch, head, and restored snapshot state after commit

## Prerequisites

- You finished [Approval and History Setup](./05-governed-composition)
- You already know the advanced runtime assembly
- You want to understand the operational flow after a proposal is created

## Vocabulary Before The Flow

| Term | Meaning in this tutorial |
|------|--------------------------|
| Proposal | A submitted request waiting for approval or rejection |
| Seal | The history write that makes a terminal app snapshot durable |
| Head | The latest sealed record for a branch |
| Restore | Reading the app snapshot stored for a sealed record |
| Branch | A named line of history with its own latest head |

## 1. Create The Reviewable Request

```typescript
import { governed } from "./server/governed-runtime";

const request = governed.action.addTodo.bind("Ship the history tutorial");
```

This is still a typed runtime request. Governance adds an approval policy and
proposal record when the runtime receives it.

## 2. Submit And Inspect The Proposal

```typescript
const pending = await request.submit();
```

At this point the result is either blocked, or it contains a pending proposal reference.

## 3. Resolve Pending Work

```typescript
if (pending.ok && pending.status === "pending") {
  await governed.approve(pending.proposal);
  await pending.waitForSettlement();
}
```

If the governing policy rejects instead, use `reject(proposalId, reason)` and no seal occurs.

## 4. Read Sealed History

```typescript
const head = await governed.getLatestHead();
const restored = head ? await governed.restore(head.worldId) : null;
```

Lineage only publishes the new visible snapshot after seal commit succeeds. That is the key difference from the base runtime.

## 5. Inspect Branch State

```typescript
const branch = await governed.getActiveBranch();
const heads = await governed.getHeads();
```

These queries let you inspect the committed history state after proposal
execution.

## Next

Go back to [Guides](/guides/) when you need concrete production techniques, or to [Lineage API](/api/lineage) and [Governance API](/api/governance) for package-level details.
