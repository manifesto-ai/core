# Governed Sealing and History

> See how a governed proposal becomes sealed history under the decorator runtime.

## What You'll Learn

- how a governed proposal moves toward execution
- how approval and rejection fit into the sealing flow
- how to read branch, head, and restored snapshot state after commit

## Prerequisites

- You finished [Governed Composition](./05-governed-composition)
- You already know the governed runtime assembly
- You want to understand the operational flow after a proposal is created

## 1. Create The Governed Request

```typescript
const intent = governed.createIntent(
  governed.MEL.actions.addTodo,
  "Ship the history tutorial",
);
```

This is still a typed runtime `Intent`. Governance adds legitimacy and proposal semantics when the runtime receives it.

## 2. Submit And Inspect The Proposal

```typescript
const proposal = await governed.proposeAsync(intent);
```

At this point the proposal is either already terminal, or it is pending review.

## 3. Resolve Pending Work

```typescript
if (proposal.status === "pending") {
  await governed.approve(proposal.proposalId);
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
