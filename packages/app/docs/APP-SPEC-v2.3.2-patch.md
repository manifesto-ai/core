# App SPEC v2.3.2 Patch Document

> **Patch Target:** App SPEC v2.3.1 → v2.3.2
> **Status:** Draft
> **Date:** 2026-02-10
> **Related:** Core SPEC v2.0.2 (Normative Note), App SPEC v2.3.1 (Head Query API)
> **Scope:** Snapshot/State DX aliases for App consumers
> **Breaking Change:** No (additive)

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| Add `getSnapshot()` no-arg overload (current head snapshot) | API Addition | Non-breaking |
| Add `state` alias on AppState (`state === data`) | Behavior Addition | Non-breaking |
| Add computed alias keys (e.g. `computed.doubled` alongside `computed['computed.doubled']`) | Behavior Addition | Non-breaking |
| Add normative rules for alias semantics + collision handling | Spec Clarification | Non-breaking |

---

## 1. Changelog Entry

```diff
> **Changelog:**
+ > - **v2.3.2 (2026-02-10):** Snapshot DX Aliases — `state` alias for `data`, computed short keys, `getSnapshot()` no-arg overload
> - **v2.3.1 (2026-02-08):** Head Query API — `getHeads()`, `getLatestHead()` added to App Public API
> - **v2.3.0 (2026-02-08):** READY-8 — Genesis snapshot evaluates computed values from schema defaults
```

---

## 2. Motivation

### 2.1 Problem

App consumers observe a mismatch between MEL terminology and runtime state shape:

- MEL declares `state { count }`, but App consumers must read `snapshot.data.count`.
- MEL declares `computed doubled = ...`, but computed values are stored under semantic-path keys such as:
  `snapshot.computed['computed.doubled']`.

This is correct at the Core/Host boundary, but creates unnecessary friction in App-level DX.

### 2.2 Goal

Provide **App-only, read-only aliases** so MEL users can access:

- `snapshot.state.count` (instead of `snapshot.data.count`)
- `snapshot.computed.doubled` (instead of `snapshot.computed['computed.doubled']`)

without changing the canonical Snapshot contract used by Core/Host/World.

---

## 3. §6.2 App Public API — State Access Section (Patch)

### 3.1 Add `getSnapshot()` no-arg overload

```diff
  // State Access
  getState<T = unknown>(): AppState<T>;

+ /**
+  * Get current snapshot for the active branch head (latest published snapshot).
+  *
+  * NOTE: This is an App-level convenience overload.
+  * Canonical cross-layer Snapshot shape remains unchanged.
+  */
+ getSnapshot<T = unknown>(): AppState<T>;

  subscribe<TSelected>(
    selector: (state: AppState<unknown>) => TSelected,
    onChange: (selected: TSelected) => void
  ): Unsubscribe;

  // World Query
  getSnapshot(worldId: WorldId): Promise<Snapshot>;
```

**API-DX-1 (MUST):** `getSnapshot()` (no args) MUST return the same value as `getState()` at the time of call.

**API-DX-2 (SHOULD):** Documentation SHOULD present `getSnapshot()` as the preferred name for reading the latest published snapshot, while `getState()` remains supported for compatibility.

> **Rationale:** `getState()` returns a Snapshot-like object; `getSnapshot()` improves naming alignment for App consumers.

---

## 4. AppState Aliases (New subsection §7.3)

### 4.1 `state` alias for `data`

**STATE-ALIAS-1 (MUST):** `AppState` MUST expose a read-only property `state` that is an alias of `data`.
- `app.getState().state` MUST be deeply equal to `app.getState().data`.
- Implementations SHOULD ensure referential identity: `state === data`.

**STATE-ALIAS-2 (SHOULD):** `state` SHOULD be implemented as a non-enumerable accessor to avoid changing JSON serialization shape of Snapshot-like objects.

### 4.2 Computed alias keys

Let canonical computed values remain addressable by semantic paths, but add App-level ergonomic keys.

**COMP-ALIAS-1 (MUST):** For each computed entry key of the form `computed.<name>`, `AppState.computed` MUST also expose an alias key `<name>` with the same value, if `<name>` is a valid identifier and does not already exist.

Example:
- Canonical: `computed['computed.doubled'] === 2`
- Alias: `computed.doubled === 2`

**COMP-ALIAS-2 (MUST):** Alias keys MUST NOT overwrite existing keys on `computed`. If collision occurs, App MUST skip alias creation for that key.

**COMP-ALIAS-3 (SHOULD):** Alias keys SHOULD be non-enumerable to preserve canonical iteration semantics over semantic-path keys.

**COMP-ALIAS-4 (NOTE):** This is an App-only DX convenience. Canonical keys remain semantic paths and MUST be preserved.

---

## 5. Examples

### 5.1 Before (v2.3.1 style)

```typescript
const snapshot = app.getState();
const count = snapshot.data.count;
const doubled = snapshot.computed['computed.doubled'];
```

### 5.2 After (v2.3.2 recommended)

```typescript
const snapshot = app.getSnapshot(); // or app.getState()
const count = snapshot.state.count;           // alias for data
const doubled = snapshot.computed.doubled;    // alias for computed.<name>
```

---

## 6. Implementation

### 6.1 `toClientState()` utility

A utility function `toClientState<T>(obj)` is provided in `@manifesto-ai/shared` to attach aliases to any AppState-shaped object.

```typescript
import { toClientState } from "@manifesto-ai/shared";
```

- Adds `state` as a non-enumerable getter aliasing `data`.
- Adds computed short-key aliases as non-enumerable getters.
- Called internally by `snapshotToAppState()` and `createInitialAppState()`.

> **Note:** `withDxAliases`는 `toClientState`의 deprecated alias로 하위 호환을 위해 유지된다. 신규 코드는 `toClientState`를 사용해야 한다.

### 6.2 ManifestoApp facade

```typescript
class ManifestoApp implements App {
  getSnapshot<T = unknown>(): AppState<T>;
  getSnapshot(worldId: WorldId): Promise<Snapshot>;
  getSnapshot<T = unknown>(worldId?: WorldId): AppState<T> | Promise<Snapshot> {
    if (worldId !== undefined) {
      return this._getRuntime("getSnapshot").getSnapshot(worldId);
    }
    return this.getState<T>();
  }
}
```

---

## 7. Compatibility Notes

- Existing code using `data.*` continues to work.
- Existing code using `computed['computed.*']` continues to work.
- Alias additions are additive and do not modify Core/Host/World Snapshot contracts.

---

## 8. Compliance Checklist Update

Add the following to App compliance checklist:

- [ ] AppState exposes `state` alias for `data` (STATE-ALIAS-1)
- [ ] `state` alias is non-enumerable (STATE-ALIAS-2)
- [ ] AppState.computed exposes alias keys for `computed.<name>` (COMP-ALIAS-1)
- [ ] Alias keys do not overwrite existing keys (COMP-ALIAS-2)
- [ ] Alias keys are non-enumerable (COMP-ALIAS-3)
- [ ] `getSnapshot()` no-arg overload returns latest published snapshot (API-DX-1)

---

## 9. Cross-Reference

| Document | Section | Change |
|----------|---------|--------|
| Core SPEC v2.0.2 | §13.2 Normative Note | Clarifies `data` vs "state" terminology, computed key access semantics |
| App SPEC v2.3.1 | §3 World Query | Base for `getSnapshot()` overload |
| App SPEC v2.3.0 | §7 State Model | Base for AppState shape |

---

*End of App SPEC v2.3.2 Patch Document*
