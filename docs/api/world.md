# @manifesto-ai/world

> Governance layer for Manifesto

---

## Overview

`@manifesto-ai/world` is the **governance layer** that manages proposals, authority evaluation, and lineage tracking. It ensures every state change is authorized and recorded.

**World governs who may change what, and records that they did.**

---

## Architecture

World operates above Core and Host:

```
Actor submits Intent
        |
        v
  ┌───────────┐
  │  World    │  <-- Governance layer
  │  Protocol │
  └───────────┘
        |
        +---> Proposal created
        |
        +---> Authority evaluates
        |
        +---> Decision recorded
        |
        v
  ┌───────────┐
  │   Host    │  <-- Execution (if approved)
  └───────────┘
```

---

## Main Exports

### createManifestoWorld()

Creates a ManifestoWorld instance.

```typescript
import { createManifestoWorld } from "@manifesto-ai/world";

const world = createManifestoWorld({
  schemaHash: "my-app-v1",
  authority: authorityEvaluator,
  store: worldStore,
});
```

### ManifestoWorld Interface

```typescript
interface ManifestoWorld {
  /** Submit a proposal for evaluation */
  submit(proposal: Proposal): Promise<ProposalResult>;

  /** Get current world */
  current(): World;

  /** Get lineage */
  lineage(opts?: LineageOptions): readonly string[];
}
```

---

## Key Concepts

### Proposal

A proposal is an intent submitted for authorization:

```typescript
interface Proposal {
  id: string;
  actorId: string;
  intent: IntentInstance;
  parentWorldId: string;
  timestamp: number;
}
```

### Authority

Authority evaluates whether proposals should be approved:

```typescript
interface AuthorityHandler {
  evaluate(proposal: Proposal, ctx: AuthorityContext): Promise<AuthorityDecision>;
}
```

### Decision

Decisions record the outcome of authority evaluation:

```typescript
interface DecisionRecord {
  id: string;
  proposalId: string;
  verdict: "approved" | "rejected" | "pending";
  reason?: string;
  timestamp: number;
}
```

### World

A World is an immutable record of state at a point in time:

```typescript
interface World {
  id: string;
  snapshotHash: string;
  parentId: string | null;
  decisionId: string;
  timestamp: number;
}
```

---

## Authority Handlers

Built-in authority handlers:

```typescript
import {
  createAutoApproveHandler,
  createPolicyRulesHandler,
  createHITLHandler,
  createTribunalHandler,
} from "@manifesto-ai/world";

// Auto-approve all proposals
const autoApprove = createAutoApproveHandler();

// Policy-based approval
const policy = createPolicyRulesHandler({
  rules: [
    { action: "delete*", require: "admin" },
    { action: "*", allow: "user" },
  ],
});

// Human-in-the-loop approval
const hitl = createHITLHandler({
  onPending: (proposal) => notifyHuman(proposal),
});
```

---

## Lineage

World maintains a DAG (Directed Acyclic Graph) of state history:

```typescript
import { createWorldLineage } from "@manifesto-ai/world";

const lineage = createWorldLineage(store);

// Get ancestors
const ancestors = lineage.ancestors(worldId, { depth: 10 });

// Find common ancestor
const common = lineage.commonAncestor(worldA, worldB);
```

---

## When to Use Directly

Most applications should use `@manifesto-ai/app` instead. Use World directly when:

- Implementing custom governance policies
- Building audit and compliance tools
- Creating custom authority handlers
- Building Manifesto tooling

---

## Specification

For the complete normative specification, see:

- [Specifications Hub](/internals/spec/) - Links to all package specs
- [World SPEC v2.0.2](https://github.com/manifesto-ai/core/blob/main/workspaces/core/packages/world/docs/world-SPEC-v2.0.2.md) - Latest package spec

---

## Related Packages

| Package | Relationship |
|---------|--------------|
| [@manifesto-ai/host](./host) | Executes approved intents |
| [@manifesto-ai/core](./core) | Provides pure computation |
| [@manifesto-ai/app](./app) | High-level facade using World |
