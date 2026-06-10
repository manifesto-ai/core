# Data Flow

> Follow one action from caller input to the next terminal snapshot.

---

## Default SDK Flow

In the default path, MEL has already declared the rules, Core computes what
should change, and Host converges the next Snapshot. A caller usually enters
that loop through the SDK:

```text
caller
  -> createManifesto()
  -> activate()
  -> app.action.<name>.submit(input?)
  -> Host
  -> Core
  -> terminal Snapshot
  -> observe.state()/observe.event()/snapshot()
```

That is the application-facing route into the core loop a new developer should
keep in mind.

---

## Step by Step

### 1. The caller activates the runtime and submits an action

Usually with `app.action.someAction.submit(...args)` or `app.action.someAction.submit({ ...params })`, depending on the action shape.

### 2. SDK submits the work

`submit()` is the canonical v5 ingress path and resolves to a mode-specific runtime result.

### 3. Host runs the compute/execution loop

Host orchestrates the loop, asks Core to compute semantic transitions, fulfills
declared work, and applies Core-emitted concrete patches.

### 4. Core computes semantic changes

Core stays pure. Given the same schema, snapshot, intent, and materialized context, it computes the same result.
Core evaluates Flow semantics, including dynamic patch target resolution, before
emitting concrete patches.

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

## Optional Approval/History Flow

When you need review, audit history, restore, or approval policies, add the
optional extension runtime before activation:

```text
participant
  -> createManifesto()
  -> withLineage()
  -> withGovernance()
  -> activate()
  -> action.<name>.submit(input?)
  -> review / approval flow
  -> Host
  -> Core
  -> terminal Snapshot
  -> history seal
  -> published snapshot + history
```

That is a deliberate deployment choice, not an implicit part of the basic SDK onboarding path.

---

## What New Developers Should Remember

- `action.<name>.submit()` submits runtime work
- Snapshot is the visible result
- Effects still resolve through patches
- approval/history composition is optional and explicit

If those four points are clear, the rest of the architecture follows naturally.
