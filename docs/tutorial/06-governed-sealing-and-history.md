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

## 1. Create The Reviewable Request

```typescript
const candidate = governed.actions.addTodo.bind("Ship the history tutorial");
```

This is still a typed action candidate. Governance adds legitimacy and proposal semantics when the runtime receives it.

## 2. Submit And Inspect The Proposal

```typescript
const pending = await candidate.submit();
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

These queries let you inspect the sealed continuity state after proposal execution.

## Next

Go back to [Guides](/guides/) when you need concrete production techniques, or to [Lineage API](/api/lineage) and [Governance API](/api/governance) for package-level details.
