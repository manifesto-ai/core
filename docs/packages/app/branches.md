# Branch Management

> Forking, switching, and managing parallel state timelines

Branches allow you to create parallel versions of your application state. This enables powerful patterns like undo/redo, A/B testing, speculative execution, and schema migrations.

---

## What Are Branches?

A **branch** is a named pointer to a specific World (state version) in the lineage. Each branch maintains its own head and can evolve independently.

```
main:     W0 → W1 → W2 → W3
                    ↓
feature:            W2 → W4 → W5
```

When you fork a branch:
- A new branch is created pointing to the current head
- Changes on the new branch don't affect the original
- Both branches can evolve independently

---

## Basic Operations

### Get Current Branch

```typescript
const branch = app.currentBranch();

console.log("Branch ID:", branch.id);
console.log("Branch name:", branch.name);
console.log("Head World:", branch.head());
console.log("Schema:", branch.schemaHash);
```

### List All Branches

```typescript
const branches = app.listBranches();

branches.forEach(branch => {
  console.log(`${branch.name || branch.id}: ${branch.head()}`);
});
```

### Switch Branches

```typescript
// Switch to a different branch
await app.switchBranch("feature-branch");

// Current state now reflects the feature branch
const state = app.getState();
```

---

## Creating Branches (Fork)

### Basic Fork

```typescript
// Fork from current branch
const newBranch = await app.fork();

console.log("New branch:", newBranch.id);
// App automatically switches to new branch (default)
```

### Named Fork

```typescript
const experimentBranch = await app.fork({
  name: "experiment-v2",
});

console.log("Branch name:", experimentBranch.name); // "experiment-v2"
```

### Fork Without Switching

```typescript
const backgroundBranch = await app.fork({
  name: "background-processing",
  switchTo: false,  // Stay on current branch
});

// Current branch unchanged
console.log(app.currentBranch().id);  // Still "main"
```

---

## Branch Isolation

Changes on one branch don't affect others:

```typescript
// On main branch
console.log(app.getState().data.count);  // 0

// Fork and make changes
const feature = await app.fork({ name: "feature" });
await feature.act("increment").done();
console.log(feature.getState().data.count);  // 1

// Switch back to main
await app.switchBranch("main");
console.log(app.getState().data.count);  // Still 0!
```

---

## Branch-Specific Actions

Execute actions on a specific branch:

```typescript
const branch = await app.fork({ name: "draft" });

// Act on the branch directly
await branch.act("addItem", { name: "Draft item" }).done();

// Or act via app with branchId
await app.act("addItem", { name: "Another item" }, {
  branchId: branch.id,
}).done();
```

---

## Lineage

Get the history of Worlds in a branch:

```typescript
const branch = app.currentBranch();

// Get all World IDs in order
const worldIds = branch.lineage();
console.log("History:", worldIds);
// → ["world_abc", "world_def", "world_ghi"]

// With limits
const recent = branch.lineage({ limit: 5 });

// Until specific World
const partial = branch.lineage({ untilWorldId: "world_def" });
```

---

## Checkout (Time Travel)

Move a branch's head to a previous World:

```typescript
const branch = app.currentBranch();
const history = branch.lineage();

// Go back to a previous state
await branch.checkout(history[2]);

// State now reflects that World
const state = branch.getState();
```

### Undo/Redo Pattern

```typescript
class UndoManager {
  private undoStack: string[] = [];
  private redoStack: string[] = [];

  async recordAndAct(type: string, input: unknown) {
    const branch = app.currentBranch();
    this.undoStack.push(branch.head());
    this.redoStack = [];  // Clear redo on new action

    await app.act(type, input).done();
  }

  async undo() {
    if (this.undoStack.length === 0) return;

    const branch = app.currentBranch();
    this.redoStack.push(branch.head());

    const previousWorld = this.undoStack.pop()!;
    await branch.checkout(previousWorld);
  }

  async redo() {
    if (this.redoStack.length === 0) return;

    const branch = app.currentBranch();
    this.undoStack.push(branch.head());

    const nextWorld = this.redoStack.pop()!;
    await branch.checkout(nextWorld);
  }
}
```

---

## Schema Migration

Fork with a new domain schema:

```typescript
const newMel = `
domain AppV2 {
  state {
    items: Array<Item> = []
    // New field in v2
    settings: Settings = { theme: "light" }
  }
  // ... actions
}
`;

const v2Branch = await app.fork({
  name: "v2",
  domain: newMel,
  migrate: "auto",  // Automatic migration
});
```

### Custom Migration

```typescript
const v2Branch = await app.fork({
  name: "v2",
  domain: newMel,
  migrate: (ctx) => {
    // ctx.from: source state
    // ctx.to: target schema

    return {
      // Map old data to new structure
      items: ctx.from.state.data.items,
      settings: { theme: "light" },  // New field with default
    };
  },
  migrationMeta: {
    reason: "Adding settings feature",
  },
});
```

### Migration Links

Track schema migrations:

```typescript
const links = app.getMigrationLinks();

links.forEach(link => {
  console.log(`Migration: ${link.from.schemaHash} → ${link.to.schemaHash}`);
  console.log(`  From: ${link.from.branchId} @ ${link.from.worldId}`);
  console.log(`  To: ${link.to.branchId} @ ${link.to.worldId}`);
  console.log(`  Strategy: ${link.migration.strategy}`);
  console.log(`  Reason: ${link.migration.reason}`);
});
```

---

## Common Patterns

### Draft/Publish Pattern

```typescript
// Create draft from published state
const draft = await app.fork({ name: "draft" });

// Make changes
await draft.act("editContent", { content: "New content" }).done();
await draft.act("addImage", { url: "..." }).done();

// Review draft
const draftState = draft.getState();
if (isApproved(draftState)) {
  // Merge to main (copy state)
  await app.switchBranch("main");
  await app.act("replaceContent", draftState.data).done();
}
```

### A/B Testing

```typescript
// Create variants
const variantA = await app.fork({ name: "variant-a", switchTo: false });
const variantB = await app.fork({ name: "variant-b", switchTo: false });

// Apply different configurations
await variantA.act("setConfig", { layout: "grid" }).done();
await variantB.act("setConfig", { layout: "list" }).done();

// Route users to variants
function getBranchForUser(userId: string): string {
  return hash(userId) % 2 === 0 ? "variant-a" : "variant-b";
}

await app.switchBranch(getBranchForUser(currentUser.id));
```

### Speculative Execution

```typescript
// Fork for speculation
const spec = await app.fork({ name: "speculation", switchTo: false });

// Try risky operation
try {
  await spec.act("riskyOperation", data).done();
  const result = spec.getState();

  if (isValid(result)) {
    // Apply to main
    await app.switchBranch("main");
    await app.act("riskyOperation", data).done();
  }
} catch (error) {
  // Speculation failed, main is unaffected
  console.log("Speculation failed, ignoring");
}
```

### Feature Branches

```typescript
// Create feature branch
const feature = await app.fork({ name: "feature-search" });

// Develop feature
await feature.act("addSearchIndex").done();
await feature.act("addSearchUI").done();

// When ready, switch back to main and merge
await app.switchBranch("main");
// Your merge strategy here
```

---

## Branch Events

Listen to branch-related events:

```typescript
// Branch created
app.hooks.on("branch:created", ({ branchId, schemaHash, head }) => {
  console.log(`New branch: ${branchId} at ${head}`);
});

// Branch switched
app.hooks.on("branch:switched", ({ from, to }) => {
  console.log(`Switched from ${from} to ${to}`);
});

// Checkout (time travel)
app.hooks.on("branch:checkout", ({ branchId, from, to }) => {
  console.log(`Branch ${branchId}: ${from} → ${to}`);
});
```

---

## Best Practices

1. **Name your branches** — Use descriptive names for clarity
2. **Don't fork excessively** — Each branch consumes memory
3. **Clean up unused branches** — Implement branch garbage collection if needed
4. **Use switchTo: false for background work** — Avoid disrupting the UI
5. **Track lineage for debugging** — Understand how state evolved
6. **Test migrations carefully** — Schema changes can be complex
7. **Use fork for risky operations** — Protect main state from failures
