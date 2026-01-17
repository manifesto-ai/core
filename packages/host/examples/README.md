# Host Examples

> Runnable examples demonstrating @manifesto-ai/host v2.0.1 features

---

## Prerequisites

```bash
# From the repository root
pnpm install
pnpm build
```

---

## Running Examples

```bash
# Run with tsx (recommended)
npx tsx packages/host/examples/basic-counter.ts
npx tsx packages/host/examples/effect-handling.ts
npx tsx packages/host/examples/determinism.ts

# Or from the host package directory
cd packages/host
npx tsx examples/basic-counter.ts
```

---

## Examples

### 1. basic-counter.ts

Demonstrates basic `ManifestoHost` usage:
- Creating a host with schema
- Dispatching intents
- Reading snapshot state

```typescript
// Key concepts:
// - ManifestoHost instantiation
// - createIntent for action dispatch
// - getSnapshot() for state access
```

### 2. effect-handling.ts

Demonstrates effect handler registration and execution:
- Registering effect handlers
- Error handling patterns (errors as patches)
- Effect handler contract (never throw)

```typescript
// Key concepts:
// - registerEffect() API
// - Patch[] return type
// - Error handling without exceptions
```

### 3. determinism.ts

Demonstrates v2.0.1 context determinism:
- Frozen context per job
- Deterministic `now` timestamp
- `randomSeed` derived from `intentId`
- Trace replay guarantee

```typescript
// Key concepts:
// - Runtime injection for fixed time
// - Same input → same output guarantee
// - Context determinism verification
```

---

## Example Output

### basic-counter.ts

```
=== Basic Counter Example ===

Initial state: { count: 0 }

Dispatching increment...
Result status: complete
Snapshot data: { count: 1 }

Dispatching increment again...
Result status: complete
Snapshot data: { count: 2 }

Dispatching addAmount with amount: 10...
Result status: complete
Snapshot data: { count: 12 }

Dispatching decrement...
Result status: complete
Snapshot data: { count: 11 }

Final state via getSnapshot(): { count: 11 }

Done!
```

### effect-handling.ts

```
=== Effect Handling Example ===

Registering effect handlers...
Registered effects: api.get, timer.delay

Dispatching fetchUser action (userId: 123)...
Result status: complete
Response data: { id: '123', name: 'Alice', email: 'alice@example.com' }
Loading: false

Dispatching fetchUser action (userId: 999 - not found)...
Result status: complete
Response data: { error: 'User 999 not found' }

Dispatching delayedAction (100ms delay)...
Result status: complete
Result value: delayed-value
Elapsed time: ~101ms

--- Effect Handler Management ---
Has api.get: true
Has api.unknown: false

Unregistering timer.delay...
Registered effects: api.get

Effect handling complete!
```

### determinism.ts

```
=== Determinism Example ===

Creating two hosts with fixed runtime...
Fixed timestamp: 1704067200000 (2024-01-01T00:00:00.000Z)

Dispatching same intent to both hosts...
Intent ID: intent-determinism-test

Host 1 result:
  count: 1
  timestamp: ...
  randomSeed: initial

Host 2 result:
  count: 1
  timestamp: ...
  randomSeed: initial

--- Trace Recording for Replay ---

Recorded trace events:
  1. runner:start
  2. job:start
  3. context:frozen
  4. core:compute
  5. core:apply
  6. job:end
  7. runner:recheck
  8. runner:end

Determinism verified!
```

---

## Related Documentation

- [GUIDE.md](../docs/GUIDE.md) — Full usage guide
- [MIGRATION.md](../docs/MIGRATION.md) — v1.x → v2.0.1 migration
- [host-SPEC-v2.0.1.md](../docs/host-SPEC-v2.0.1.md) — Specification
- [host-FDR-v2.0.1.md](../docs/host-FDR-v2.0.1.md) — Design rationale
