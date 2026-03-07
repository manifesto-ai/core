# Data Flow

> Follow one intent from caller input to the next terminal snapshot.

---

## Default SDK Flow

In the default path, a caller submits an intent through the SDK:

```text
caller
  -> createIntent()
  -> manifesto.dispatch()
  -> Host
  -> Core
  -> terminal Snapshot
  -> subscribe()/on()/getSnapshot()
```

That is the core loop a new developer should keep in mind.

---

## Step by Step

### 1. The caller creates an Intent

Usually with `createIntent(type, input, intentId)`.

### 2. SDK enqueues the work

`dispatch()` is synchronous enqueue-only. It does not return the result of the action.

### 3. Host runs the compute/execution loop

Host evaluates the domain flow, fulfills declared work, and applies patches.

### 4. Core computes semantic changes

Core stays pure. Given the same schema, snapshot, and intent, it computes the same result.

### 5. SDK publishes the terminal snapshot

Once the intent reaches a terminal result, consumers observe it through:

- `subscribe()` for selected state changes
- `on()` for lifecycle telemetry
- `getSnapshot()` for direct reads

---

## Effect Flow

If an action declares an effect, the flow expands like this:

```text
intent
  -> Core evaluates action
  -> effect declared
  -> Host runs matching effect handler
  -> handler returns patches
  -> patches applied
  -> next terminal Snapshot
```

The effect handler does not bypass Snapshot. Its output still lands as patches.

---

## Optional Governed Flow

When you need explicit authority and lineage, add World in front of execution:

```text
participant
  -> proposal / approval flow in World
  -> approved intent
  -> Host
  -> Core
  -> Snapshot + lineage records
```

That is a deliberate deployment choice, not an implicit part of the basic SDK onboarding path.

---

## What New Developers Should Remember

- `dispatch()` submits work
- Snapshot is the visible result
- Effects still resolve through patches
- World is optional and explicit

If those four points are clear, the rest of the architecture follows naturally.
