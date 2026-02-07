# Schema Evolution

> Patterns for AI-driven domain structure changes

::: warning Roadmap
Schema Evolution is currently in the design phase.
This document describes the vision and planned patterns.
:::

## Vision

In Manifesto, Schema is a first-class object.
This means Schema itself can be modified through Intents.

```
Traditional: Developer → Code change → Deploy → Schema updated
AI-Native:   AI detects need → Schema Intent → Authority approval → Auto-migration
```

## Why Schema Evolution?

### Traditional Approach

1. Developer identifies need for schema change
2. Writes migration script
3. Tests migration
4. Deploys to production
5. Runs migration

### AI-Native Approach

1. AI detects new requirement pattern
2. Proposes Schema change as Intent
3. Authority evaluates and approves
4. System auto-migrates
5. All changes fully traced

## Core Principles

### Schema as Intent Target

```typescript
// Schema changes are just Intents
const schemaIntent = {
  type: "schema:addField",
  input: {
    path: "tasks",
    field: "priority",
    fieldType: "enum",
    values: ["low", "medium", "high"],
    default: "medium"
  }
};

// Goes through normal Intent pipeline
await app.dispatch(schemaIntent);
```

### Backward Compatibility

Schema changes must be backward compatible by default:

- New fields have default values
- Removed fields are deprecated, not deleted
- Type changes are widening, not narrowing

### Full Traceability

Every schema change is:

- Recorded in Trace
- Linked to the Actor who proposed it
- Approved by Authority
- Reversible

## Planned Patterns

### Pattern 1: Field Addition

AI detects a recurring pattern and proposes a new field:

```typescript
// AI observes tasks being marked with "urgent" in comments
// Proposes structured priority field

const intent = {
  type: "schema:addField",
  input: {
    entity: "tasks",
    field: "priority",
    schema: {
      type: "enum",
      values: ["low", "medium", "high", "urgent"]
    },
    default: "medium",
    migration: {
      strategy: "infer-from-comments",
      mapping: {
        "urgent": "urgent",
        "asap": "high",
        "important": "high"
      }
    }
  }
};
```

### Pattern 2: Type Refinement

AI proposes narrowing a broad type:

```typescript
// Current: status: string
// Proposed: status: "todo" | "in_progress" | "done"

const intent = {
  type: "schema:refineType",
  input: {
    path: "tasks.status",
    from: { type: "string" },
    to: {
      type: "enum",
      values: ["todo", "in_progress", "done"]
    },
    migration: {
      unmapped: "todo",  // Default for values that don't match
      mapping: {
        "pending": "todo",
        "started": "in_progress",
        "completed": "done",
        "finished": "done"
      }
    }
  }
};
```

### Pattern 3: Relation Addition

AI detects implicit relationships:

```typescript
// Tasks frequently reference users in comments
// Propose explicit relation

const intent = {
  type: "schema:addRelation",
  input: {
    name: "assignee",
    from: "tasks",
    to: "users",
    cardinality: "many-to-one",
    nullable: true,
    migration: {
      strategy: "extract-from-mentions",
      pattern: "@([a-zA-Z0-9_]+)"
    }
  }
};
```

### Pattern 4: Entity Extraction

AI identifies embedded data that should be separate:

```typescript
// Tasks have embedded address objects
// Propose separate Address entity

const intent = {
  type: "schema:extractEntity",
  input: {
    source: "tasks.location",
    newEntity: "addresses",
    relation: {
      name: "locationAddress",
      cardinality: "many-to-one"
    },
    deduplication: {
      strategy: "exact-match",
      fields: ["street", "city", "zip"]
    }
  }
};
```

## Migration Strategy

### Automatic Migration

When schema changes are approved:

1. **Analyze Impact**: Identify affected data
2. **Generate Plan**: Create migration steps
3. **Validate**: Dry-run migration
4. **Execute**: Apply changes atomically
5. **Record**: Full trace of migration

### Migration Guarantees

| Guarantee | Description |
|-----------|-------------|
| **Atomic** | All or nothing |
| **Reversible** | Can rollback |
| **Traced** | Complete audit trail |
| **Non-destructive** | Original data preserved |

### Example Migration Trace

```typescript
{
  type: "migration",
  schemaIntent: { ... },
  steps: [
    {
      action: "add-field",
      target: "tasks.priority",
      affected: 1234,
      duration: 456
    },
    {
      action: "infer-values",
      source: "tasks.comments",
      filled: 567,
      defaulted: 667
    }
  ],
  result: "success",
  rollbackAvailable: true,
  trace: { ... }
}
```

## Safety Guarantees

### All Changes Through Intent

```typescript
// Direct schema mutation is forbidden
schema.fields.push(newField);  // FORBIDDEN

// Must go through Intent
await app.dispatch({
  type: "schema:addField",
  input: { ... }
});  // REQUIRED
```

### Authority Approval Required

```typescript
// Register the schema-change actor with HITL authority
// All schema changes will require human approval
world.registerActor(
  { actorId: "schema-agent", kind: "ai" },
  { mode: "hitl" }  // Human-in-the-loop for all actions
);

// Register callback for HITL decisions
world.onHITLRequired((state) => {
  console.log("Schema change requires review:", state.proposal);
  // Present to admin for approval/rejection
});
```

### Destructive Changes Blocked

```typescript
// These are blocked by default:
// - Removing required fields
// - Narrowing types in breaking ways
// - Deleting entities with data
// - Removing relations with references

// Override requires explicit authorization
const intent = {
  type: "schema:removeField",
  input: {
    path: "tasks.legacyField",
    authorization: {
      type: "explicit-deletion",
      approvedBy: "admin-123",
      reason: "Field unused for 6 months"
    }
  }
};
```

## Current Status

| Feature | Status |
|---------|--------|
| Concept design | Complete |
| SPEC definition | In progress |
| Core implementation | Planned |
| Host integration | Planned |
| Documentation | This document |

## Roadmap

| Version | Feature |
|---------|---------|
| v2.2 | Schema Intent type definitions |
| v2.3 | Core Schema Intent processing |
| v2.4 | Migration automation |
| v3.0 | AI-driven Schema Evolution GA |

## Experimental Usage

While the full feature is in development, you can experiment with schema changes using manual patterns:

```typescript
// Current workaround: Use regular intents with schema-like semantics
action updateSchema(field: string, config: object) {
  when hasPermission(actor, "schema:modify") {
    // Store schema changes in a meta collection
    patch system.schemaChanges = append(system.schemaChanges, {
      field: input.field,
      config: input.config,
      appliedAt: input.timestamp,
      appliedBy: input.actorId
    })
  }
}
```

## See Also

- [AI Native OS Layer](/concepts/ai-native-os-layer) — Core identity
- [Snapshot Concept](/concepts/snapshot) — Current schema structure
- [AI Agent Integration](/integration/ai-agents) — AI integration patterns
- [World Concept](/concepts/world) — Authority and governance
