# Data Flow

> Follow one intent from caller input to the next terminal snapshot.

---

## Default SDK Flow

In the default path, a caller submits an intent through the SDK:

```text
caller
  -> createManifesto()
  -> activate()
  -> instance.createIntent(MEL.actions.*, input?)
  -> instance.dispatchAsync()
  -> Host
  -> Core
  -> terminal Snapshot
  -> subscribe()/on()/getSnapshot()
```

That is the core loop a new developer should keep in mind.

---

## Step by Step

### 1. The caller activates the runtime and creates an Intent

Usually with `instance.createIntent(instance.MEL.actions.someAction, ...args)` or `instance.createIntent(instance.MEL.actions.someAction, { ...params })`, depending on the action shape.

### 2. SDK enqueues the work

`dispatchAsync()` is the canonical base execution path and resolves to the published terminal snapshot.

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

When you need explicit legitimacy and continuity, decorate before activation:

```text
participant
  -> createManifesto()
  -> withLineage()
  -> withGovernance()
  -> activate()
  -> proposeAsync(intent)
  -> governance proposal / authority flow
  -> Host
  -> Core
  -> terminal Snapshot
  -> lineage seal
  -> published snapshot + history
```

That is a deliberate deployment choice, not an implicit part of the basic SDK onboarding path.

---

## What New Developers Should Remember

- `dispatchAsync()` submits and awaits base runtime work
- Snapshot is the visible result
- Effects still resolve through patches
- governed composition is optional and explicit

If those four points are clear, the rest of the architecture follows naturally.
