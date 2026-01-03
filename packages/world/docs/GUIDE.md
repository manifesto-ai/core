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
import { createHost } from "@manifesto-ai/host";

// 1. Create host
const host = createHost(schema, {
  initialData: {},
  context: { now: () => Date.now() },
});

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

### Production HITL with Email Notifications

**Goal:** Complete HITL setup with email notifications for approval requests.

**Prerequisites:** Email service (SendGrid, AWS SES, etc.) or webhook endpoint.

```typescript
import { createManifestoWorld, createHITLHandler } from "@manifesto-ai/world";
import { createHost } from "@manifesto-ai/host";
import type { Proposal } from "@manifesto-ai/world";

// ============ Email Notification Service ============

interface EmailService {
  sendApprovalRequest(params: {
    to: string;
    proposal: Proposal;
    approveUrl: string;
    rejectUrl: string;
  }): Promise<void>;
}

// Example with SendGrid
const emailService: EmailService = {
  async sendApprovalRequest({ to, proposal, approveUrl, rejectUrl }) {
    const sg = require("@sendgrid/mail");
    sg.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to,
      from: "approvals@myapp.com",
      subject: `Approval Required: ${proposal.intent.body.type}`,
      html: `
        <h2>Approval Request</h2>
        <p><strong>Actor:</strong> ${proposal.actor.actorId} (${proposal.actor.kind})</p>
        <p><strong>Action:</strong> ${proposal.intent.body.type}</p>
        <p><strong>Input:</strong></p>
        <pre>${JSON.stringify(proposal.intent.body.input, null, 2)}</pre>
        <p><strong>Submitted:</strong> ${new Date(proposal.createdAt).toLocaleString()}</p>
        <hr />
        <p>
          <a href="${approveUrl}" style="background: green; color: white; padding: 10px 20px; text-decoration: none;">
            Approve
          </a>
          <a href="${rejectUrl}" style="background: red; color: white; padding: 10px 20px; text-decoration: none; margin-left: 10px;">
            Reject
          </a>
        </p>
      `,
    };

    await sg.send(msg);
  },
};

// ============ HITL Controller with Approval Queue ============

// Store pending proposals for webhook callback
const pendingApprovals = new Map<string, Proposal>();

// Create HITL handler
const hitlAuthority = createHITLHandler({
  notify: async (proposal) => {
    // Store for later approval
    pendingApprovals.set(proposal.proposalId, proposal);

    // Generate approval URLs (signed tokens in production)
    const approveUrl = `https://myapp.com/approve/${proposal.proposalId}?token=${generateToken(proposal.proposalId)}`;
    const rejectUrl = `https://myapp.com/reject/${proposal.proposalId}?token=${generateToken(proposal.proposalId)}`;

    // Send email notification
    await emailService.sendApprovalRequest({
      to: "admin@myapp.com",
      proposal,
      approveUrl,
      rejectUrl,
    });

    console.log(`Approval email sent for proposal: ${proposal.proposalId}`);
  },
  timeout: 3600000, // 1 hour timeout
  onTimeout: "reject", // Auto-reject if not approved within 1 hour
});

// ============ World Setup ============

const host = createHost(schema, {
  initialData: {},
  context: { now: () => Date.now() },
});

const world = createManifestoWorld({
  schemaHash: "my-app-v1",
  host,
  defaultAuthority: createAutoApproveHandler(), // Default for non-AI actors
});

// Register AI agent with HITL authority
world.registerActor({
  actorId: "agent-assistant",
  kind: "agent",
  name: "Assistant",
  meta: { model: "gpt-4" },
});

world.bindAuthority("agent-assistant", "hitl-authority", hitlAuthority);

// ============ Webhook Endpoints (Express example) ============

import express from "express";
const app = express();

// Approve endpoint
app.get("/approve/:proposalId", async (req, res) => {
  const { proposalId } = req.params;
  const { token } = req.query;

  // Verify token (omitted for brevity)
  if (!verifyToken(proposalId, token as string)) {
    return res.status(403).send("Invalid token");
  }

  const proposal = pendingApprovals.get(proposalId);
  if (!proposal) {
    return res.status(404).send("Proposal not found or already processed");
  }

  // Approve through World
  await world.processHITLDecision(proposalId, "approved", "Approved via email link");

  // Clean up
  pendingApprovals.delete(proposalId);

  res.send(`
    <h2>Proposal Approved</h2>
    <p>Proposal ${proposalId} has been approved.</p>
    <p><a href="https://myapp.com/dashboard">Return to Dashboard</a></p>
  `);
});

// Reject endpoint
app.get("/reject/:proposalId", async (req, res) => {
  const { proposalId } = req.params;
  const { token } = req.query;

  // Verify token
  if (!verifyToken(proposalId, token as string)) {
    return res.status(403).send("Invalid token");
  }

  const proposal = pendingApprovals.get(proposalId);
  if (!proposal) {
    return res.status(404).send("Proposal not found or already processed");
  }

  // Reject through World
  await world.processHITLDecision(proposalId, "rejected", "Rejected via email link");

  // Clean up
  pendingApprovals.delete(proposalId);

  res.send(`
    <h2>Proposal Rejected</h2>
    <p>Proposal ${proposalId} has been rejected.</p>
    <p><a href="https://myapp.com/dashboard">Return to Dashboard</a></p>
  `);
});

app.listen(3000, () => {
  console.log("HITL approval server running on port 3000");
});

// ============ Helper Functions ============

function generateToken(proposalId: string): string {
  // In production, use proper JWT signing
  const crypto = require("crypto");
  const secret = process.env.APPROVAL_SECRET || "change-me";
  return crypto
    .createHmac("sha256", secret)
    .update(proposalId)
    .digest("hex");
}

function verifyToken(proposalId: string, token: string): boolean {
  return token === generateToken(proposalId);
}

// ============ Usage Example ============

// AI agent submits a proposal
const result = await world.submitProposal({
  actorId: "agent-assistant",
  intent: {
    type: "data.delete",
    input: { recordId: "rec_123" },
  },
});

// Result will be pending
console.log(result.status); // → "pending"
console.log(result.proposal.proposalId); // → "p_abc123"

// Email is sent automatically via the notify callback
// Human clicks approve/reject link
// World processes the decision and executes the intent
```

**Production considerations:**

1. **Security:**
   - Use proper JWT signing for approval tokens
   - Set expiration on tokens
   - Rate-limit approval endpoints
   - Require authentication for approval UI

2. **Persistence:**
   - Store pending proposals in database, not in-memory Map
   - Persist approval state to survive restarts

3. **Monitoring:**
   - Track approval latency
   - Alert on timeout rejections
   - Log all approval decisions

4. **User Experience:**
   - Provide web UI for bulk approvals
   - Show proposal context and impact
   - Support delegation to other approvers

---

## Common Mistakes

### Mistake 1: Bypassing World Governance (Direct Host Execution)

**What people do:**

```typescript
// Wrong: Execute directly on Host, skipping World Protocol
import { createHost } from "@manifesto-ai/host";

const host = createHost(schema, {
  initialData: {},
  context: { now: () => Date.now() },
});
await host.dispatch(createIntent("someAction", {}, "intent-1")); // NO GOVERNANCE!
```

**Why it's wrong:** This violates the Manifesto sovereignty model. All intents MUST flow through World Protocol for Authority evaluation, lineage tracking, and accountability. Direct Host execution:
- Skips Authority approval
- Creates no DecisionRecord
- Breaks lineage DAG
- Cannot be audited or replayed

**Constitutional reference:** Section 6 - Authority Bypass (FORBIDDEN)

**Correct approach:**

```typescript
// Right: All intents through World Protocol
import { createManifestoWorld, createAutoApproveHandler } from "@manifesto-ai/world";

const world = createManifestoWorld({
  schemaHash: "my-app-v1",
  host,
  defaultAuthority: createAutoApproveHandler(),
});

// Submit through World (governance enforced)
const result = await world.submitProposal({
  actorId: "user-1",
  intent: { type: "todo.add", input: {} },
});

// Now you have: DecisionRecord, lineage, auditability
```

### Mistake 2: Not Handling Async HITL/Tribunal Approval

**What people do:**

```typescript
// Wrong: Assuming HITL completes synchronously
const result = await world.submitProposal({
  actorId: "agent-1",
  intent: { type: "dangerous.action", input: {} },
});

// Accessing result.world immediately
updateUI(result.world.snapshot); // May not exist yet!
```

**Why it's wrong:** HITL and Tribunal authorities are inherently async. The proposal enters "pending" state until a human approves/rejects. The `result.world` field will be undefined until approval completes.

**Correct approach:**

```typescript
// Right: Check status and handle async flow
const result = await world.submitProposal({
  actorId: "agent-1",
  intent: { type: "dangerous.action", input: {} },
});

if (result.status === "completed") {
  // Immediate completion (auto-approve or synchronous authority)
  updateUI(result.world.snapshot);
} else if (result.status === "pending") {
  // HITL approval needed
  console.log("Waiting for approval:", result.proposal.proposalId);

  // Option 1: Subscribe to world events
  world.subscribe((event) => {
    if (event.kind === "proposal_decided" && event.proposalId === result.proposal.proposalId) {
      if (event.decision === "approved") {
        const updatedWorld = world.getCurrentWorld();
        updateUI(updatedWorld.snapshot);
      }
    }
  });

  // Option 2: Poll for completion
  const interval = setInterval(async () => {
    const proposal = await world.getProposal(result.proposal.proposalId);
    if (proposal.status !== "pending") {
      clearInterval(interval);
      updateUI(world.getCurrentWorld().snapshot);
    }
  }, 1000);
} else if (result.status === "rejected") {
  showError(result.decision.reason);
}
```

### Mistake 3: Not Persisting DecisionRecords

**What people do:**

```typescript
// Wrong: Ignoring decision records
const result = await world.submitProposal({ ... });

// Continue without storing decision
processResult(result);
```

**Why it's wrong:** DecisionRecords are the foundation of:
- Compliance audits (SOC2, GDPR, HIPAA)
- Debugging authority logic
- Replay and time-travel
- Accountability trails

Without persisting decisions, you lose **why** a state change was allowed.

**Correct approach:**

```typescript
// Right: Always persist DecisionRecords
const result = await world.submitProposal({
  actorId: "agent-1",
  intent: { type: "sensitive.action", input: {} },
});

if (result.decision) {
  // Store decision for audit trail
  await decisionStore.save({
    proposalId: result.proposal.proposalId,
    actorId: result.proposal.actor.actorId,
    authorityId: result.decision.authorityId,
    decision: result.decision.decision,
    reason: result.decision.reason,
    timestamp: result.decision.timestamp,
    worldId: result.world?.worldId,
  });

  // Log for compliance
  auditLog.info("Authority decision", {
    proposal: result.proposal.proposalId,
    authority: result.decision.authorityId,
    decision: result.decision.decision,
  });
}

// Query decisions later for audit
const agentDecisions = await decisionStore.query({
  actorId: "agent-1",
  dateRange: { start: "2026-01-01", end: "2026-01-31" },
});
```

### Mistake 4: Submitting Without Registering Actor

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
