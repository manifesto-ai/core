# World Guide

> **Purpose:** Practical guide for using @manifesto-ai/world
> **Prerequisites:** Basic understanding of Core and Host
> **Time to complete:** ~20 minutes

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Common Patterns](#common-patterns)
4. [Advanced Usage](#advanced-usage)
5. [Common Mistakes](#common-mistakes)
6. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
npm install @manifesto-ai/world @manifesto-ai/host @manifesto-ai/core
```

### Minimal Setup

```typescript
import { createManifestoWorld, createAutoApproveHandler } from "@manifesto-ai/world";
import { createHost, createSnapshot } from "@manifesto-ai/host";

// 1. Create host
const host = createHost({ schema, snapshot: createSnapshot(schema) });

// 2. Create world with auto-approve authority
const world = createManifestoWorld({
  schemaHash: "my-app-v1",
  host,
  defaultAuthority: createAutoApproveHandler(),
});

// 3. Verify
console.log(world.getCurrentWorld().worldId);
// → "w_abc123..."
```

---

## Basic Usage

### Use Case 1: Registering Actors

**Goal:** Register actors that can submit proposals.

```typescript
// Register a human user
world.registerActor({
  actorId: "user-alice",
  kind: "human",
  name: "Alice",
  meta: { email: "alice@example.com" },
});

// Register an AI agent
world.registerActor({
  actorId: "agent-assistant",
  kind: "agent",
  name: "Assistant",
  meta: { model: "gpt-4" },
});

// Register a system actor
world.registerActor({
  actorId: "system-scheduler",
  kind: "system",
  name: "Scheduler",
});
```

### Use Case 2: Submitting Proposals

**Goal:** Submit proposals for state changes.

```typescript
// Submit a proposal
const result = await world.submitProposal({
  actorId: "user-alice",
  intent: {
    type: "todo.add",
    input: { title: "Buy groceries" },
  },
});

console.log(result.status);     // → "completed"
console.log(result.proposal.proposalId); // → "p_xyz789..."
console.log(result.world.worldId);       // → "w_def456..."
```

### Use Case 3: Human-in-the-Loop Authority

**Goal:** Require human approval for certain actions.

```typescript
import { createHITLHandler } from "@manifesto-ai/world";

// Create HITL handler
const hitlAuthority = createHITLHandler({
  notify: async (proposal) => {
    // Send to approval queue (webhook, Slack, email, etc.)
    await sendToApprovalQueue(proposal);
  },
  timeout: 30000, // 30 seconds
});

// Bind HITL to AI agent
world.bindAuthority("agent-assistant", "hitl-authority", hitlAuthority);

// When agent submits, it will wait for approval
const result = await world.submitProposal({
  actorId: "agent-assistant",
  intent: { type: "dangerous.action", input: {} },
});

// result.status will be "pending" until approved
```

---

## Common Patterns

### Pattern 1: Policy-Based Authority

**When to use:** Automatically approve/reject based on rules.

```typescript
import { createPolicyRulesHandler } from "@manifesto-ai/world";

const policyAuthority = createPolicyRulesHandler({
  rules: [
    // Allow reads
    { pattern: "*.read", decision: "approve" },
    // Allow creates up to 10 per minute
    { pattern: "*.create", decision: "approve", rateLimit: { max: 10, windowMs: 60000 } },
    // Reject deletes by default
    { pattern: "*.delete", decision: "reject", reason: "Deletes require HITL approval" },
  ],
  defaultDecision: "approve",
});

world.bindAuthority("agent-assistant", "policy-authority", policyAuthority);
```

### Pattern 2: Tribunal Authority (Multi-Agent Review)

**When to use:** High-stakes decisions requiring consensus.

```typescript
import { createTribunalHandler } from "@manifesto-ai/world";

const tribunalAuthority = createTribunalHandler({
  reviewers: ["agent-reviewer-1", "agent-reviewer-2", "agent-reviewer-3"],
  requiredApprovals: 2, // Need 2 of 3 to approve
  timeout: 60000,
  notify: async (proposal, reviewers) => {
    for (const reviewer of reviewers) {
      await notifyReviewer(reviewer, proposal);
    }
  },
});

world.bindAuthority("agent-writer", "tribunal-authority", tribunalAuthority);
```

### Pattern 3: Mixed Authority Strategy

**When to use:** Different authority levels for different action types.

```typescript
// Auto-approve for simple reads
world.bindAuthority("agent-1", "auto", createAutoApproveHandler(), {
  actionPattern: "*.read",
});

// Policy for writes
world.bindAuthority("agent-1", "policy", createPolicyRulesHandler({ rules: [...] }), {
  actionPattern: "*.write",
});

// HITL for deletes
world.bindAuthority("agent-1", "hitl", createHITLHandler({ notify: ... }), {
  actionPattern: "*.delete",
});
```

---

## Advanced Usage

### Querying Proposals

**Prerequisites:** Multiple proposals submitted.

```typescript
// Query all proposals from an actor
const aliceProposals = world.queryProposals({
  actorId: "user-alice",
});

// Query pending proposals
const pendingProposals = world.queryProposals({
  status: "pending",
});

// Query proposals for specific action type
const addProposals = world.queryProposals({
  actionType: "todo.add",
});

// Paginated query
const recentProposals = world.queryProposals({
  limit: 10,
  offset: 0,
  orderBy: "createdAt",
  order: "desc",
});
```

### Traversing World Lineage

```typescript
// Get world by ID
const world = world.getWorld("w_abc123");

// Get parent world
const parent = world.getParent("w_abc123");

// Get all ancestors
const ancestors = world.getAncestors("w_abc123");

// Get children (forks)
const children = world.getChildren("w_abc123");
```

### Custom World Store

```typescript
import { createManifestoWorld, type WorldStore } from "@manifesto-ai/world";

// Custom store (e.g., database)
const dbWorldStore: WorldStore = {
  async saveWorld(world) {
    await db.worlds.insert(world);
  },
  async getWorld(worldId) {
    return db.worlds.findOne({ worldId });
  },
  async saveProposal(proposal) {
    await db.proposals.insert(proposal);
  },
  async getProposal(proposalId) {
    return db.proposals.findOne({ proposalId });
  },
  // ... other methods
};

const world = createManifestoWorld({
  schemaHash: "my-app-v1",
  host,
  store: dbWorldStore,
});
```

---

## Common Mistakes

### Mistake 1: Submitting Without Registering Actor

**What people do:**

```typescript
// Wrong: Actor not registered
await world.submitProposal({
  actorId: "unknown-user",
  intent: { type: "todo.add", input: {} },
});
// → Error: Actor not found
```

**Why it's wrong:** All actors must be registered before submitting.

**Correct approach:**

```typescript
// Right: Register first
world.registerActor({ actorId: "unknown-user", kind: "human" });
await world.submitProposal({
  actorId: "unknown-user",
  intent: { type: "todo.add", input: {} },
});
```

### Mistake 2: Not Handling Pending Status

**What people do:**

```typescript
// Wrong: Assuming immediate completion
const result = await world.submitProposal({ ... });
console.log(result.world.snapshot.data); // May be undefined if pending!
```

**Why it's wrong:** HITL and tribunal authorities don't complete immediately.

**Correct approach:**

```typescript
// Right: Check status
const result = await world.submitProposal({ ... });

if (result.status === "completed") {
  console.log("New world:", result.world);
} else if (result.status === "pending") {
  console.log("Awaiting approval:", result.proposal);
  // Subscribe to updates or poll
} else if (result.status === "rejected") {
  console.log("Rejected:", result.decision.reason);
}
```

### Mistake 3: Ignoring Decision Records

**What people do:**

```typescript
// Wrong: Not tracking decisions
await world.submitProposal({ ... });
// Who approved what? No audit trail!
```

**Why it's wrong:** Decision records are crucial for compliance and debugging.

**Correct approach:**

```typescript
// Right: Store and query decision records
const result = await world.submitProposal({ ... });

if (result.decision) {
  console.log("Decision:", {
    authority: result.decision.authorityId,
    decision: result.decision.decision,
    reason: result.decision.reason,
    timestamp: result.decision.timestamp,
  });

  // Store for audit
  await auditLog.save(result.decision);
}
```

---

## Troubleshooting

### Error: "Actor not found"

**Cause:** Actor not registered.

**Solution:**

```typescript
world.registerActor({
  actorId: "the-actor",
  kind: "human",
});
```

### Error: "No authority bound"

**Cause:** No authority configured for actor.

**Solution:**

```typescript
// Option 1: Set default authority
const world = createManifestoWorld({
  schemaHash: "...",
  host,
  defaultAuthority: createAutoApproveHandler(),
});

// Option 2: Bind specific authority
world.bindAuthority("actor-id", "authority-id", handler);
```

### Proposal stuck in "pending"

**Cause:** HITL approval not received, or timeout not configured.

**Diagnosis:**

```typescript
const proposals = world.queryProposals({ status: "pending" });
console.log("Pending proposals:", proposals);
```

**Solution:**

```typescript
// Option 1: Approve manually
await hitlHandler.approve(proposalId, { approvedBy: "admin" });

// Option 2: Configure timeout with auto-reject
const hitlAuthority = createHITLHandler({
  timeout: 30000,
  onTimeout: "reject", // or "approve"
});
```

---

## Testing

### Unit Testing Authorities

```typescript
import { createAutoApproveHandler, createPolicyRulesHandler } from "@manifesto-ai/world";
import { describe, it, expect } from "vitest";

describe("Policy authority", () => {
  it("approves read actions", async () => {
    const handler = createPolicyRulesHandler({
      rules: [{ pattern: "*.read", decision: "approve" }],
      defaultDecision: "reject",
    });

    const result = await handler.evaluate({
      intent: { type: "user.read", input: {} },
      actor: { actorId: "user-1", kind: "human" },
    });

    expect(result.decision).toBe("approve");
  });

  it("rejects delete actions", async () => {
    const handler = createPolicyRulesHandler({
      rules: [{ pattern: "*.delete", decision: "reject", reason: "Not allowed" }],
    });

    const result = await handler.evaluate({
      intent: { type: "user.delete", input: {} },
      actor: { actorId: "user-1", kind: "human" },
    });

    expect(result.decision).toBe("reject");
    expect(result.reason).toBe("Not allowed");
  });
});
```

---

## Quick Reference

### Key APIs

| API | Purpose | Example |
|-----|---------|---------|
| `createManifestoWorld()` | Create world | `createManifestoWorld({ schemaHash, host })` |
| `world.registerActor()` | Register actor | `world.registerActor({ actorId, kind })` |
| `world.bindAuthority()` | Bind authority | `world.bindAuthority(actorId, authId, handler)` |
| `world.submitProposal()` | Submit proposal | `await world.submitProposal({ actorId, intent })` |
| `world.queryProposals()` | Query proposals | `world.queryProposals({ status: "pending" })` |

### Proposal Status Flow

```
submitted → pending → approved → executing → completed
                 ↓                     ↓
              rejected              failed
```

---

*End of Guide*
