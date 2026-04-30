# Data Flow

> Follow one intent from caller input to the next terminal snapshot.

---

## Default SDK Flow

In the default path, a caller submits an action candidate through the SDK:

```text
caller
  -> createManifesto()
  -> activate()
  -> app.actions.<name>.submit(input?)
  -> Host
  -> Core
  -> terminal Snapshot
  -> observe.state()/observe.event()/snapshot()
```

That is the core loop a new developer should keep in mind.

---

## Step by Step

### 1. The caller activates the runtime and binds an action candidate

Usually with `app.actions.someAction.submit(...args)` or `app.actions.someAction.submit({ ...params })`, depending on the action shape.

### 2. SDK submits the work

`submit()` is the canonical v5 ingress path and resolves to a mode-specific runtime result.

### 3. Host runs the compute/execution loop

Host evaluates the domain flow, fulfills declared work, and applies patches.

### 4. Core computes semantic changes

Core stays pure. Given the same schema, snapshot, and intent, it computes the same result.

### 5. SDK publishes the terminal snapshot

Once the intent reaches a terminal result, consumers observe it through:

- `observe.state()` for selected state changes
- `observe.event()` for lifecycle telemetry
- `snapshot()` for direct projected reads

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
  -> actions.<name>.submit(input?)
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

- `actions.<name>.submit()` submits runtime work
- Snapshot is the visible result
- Effects still resolve through patches
- governed composition is optional and explicit

If those four points are clear, the rest of the architecture follows naturally.
