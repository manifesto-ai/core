# App SPEC v2.3.1 Patch Document

> **Patch Target:** App SPEC v2.3.0 → v2.3.1
> **Status:** Draft
> **Date:** 2026-02-08
> **Related:** Issue #109, World SPEC v2.0.5 (Head Query API)
> **Scope:** App Public API에 Head Query 위임 추가
> **Breaking Change:** No (additive only)

---

## Summary of Changes

| Change | Type | Impact |
|--------|------|--------|
| `getHeads()` added to App Public API | API Addition | Non-breaking |
| `getLatestHead()` added to App Public API | API Addition | Non-breaking |
| QUERY-HEAD-1~3 delegation rules | New Rules | Non-breaking |

---

## 1. Changelog Entry

```diff
> **Changelog:**
+ > - **v2.3.1 (2026-02-08):** Head Query API — `getHeads()`, `getLatestHead()` added to App Public API (World SPEC v2.0.5 alignment)
> - **v2.3.0 (2026-02-08):** READY-8 — Genesis snapshot evaluates computed values from schema defaults
```

---

## 2. Motivation

World SPEC v2.0.5에 `getHeads()`/`getLatestHead()`를 추가해도, App Public API에 노출되지 않으면 소비자(Extension, Projection, Plugin)가 접근할 수 없다. App은 thin facade(ADR-004)이므로 World의 query를 그대로 위임해야 한다.

---

## 3. §6.2 App Public API — World Query Section (Patch)

```diff
  // ═══════════════════════════════════════════════════════════════
  // World Query
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get current head WorldId (active branch only, synchronous).
   */
  getCurrentHead(): WorldId;

+ /**
+  * Get all Heads (one per Branch), ordered by createdAt descending.
+  *
+  * Delegates to World.getHeads().
+  */
+ getHeads(): Promise<WorldHead[]>;
+
+ /**
+  * Get the most recent Head across all Branches.
+  *
+  * Returns null if no branches exist.
+  * Useful for UI ("show most recently updated branch") or alternative resume strategies.
+  * NOTE: Default resume uses persisted active branch, not this method.
+  * Delegates to World.getLatestHead().
+  */
+ getLatestHead(): Promise<WorldHead | null>;

  /**
   * Get snapshot for a World.
   */
  getSnapshot(worldId: WorldId): Promise<Snapshot>;

  /**
   * Get World metadata.
   */
  getWorld(worldId: WorldId): Promise<World>;
```

---

## 4. AppRef — NOT Changed

`AppRef`(§17.2)는 Hook context용 동기 인터페이스다. `getHeads()`/`getLatestHead()`는 `Promise`를 반환하는 비동기 쿼리이므로 AppRef에 추가하지 않는다.

```typescript
// AppRef는 변경 없음 — 동기 전용
interface AppRef {
  readonly status: AppStatus;
  getState<T = unknown>(): AppState<T>;
  getDomainSchema(): DomainSchema;
  getCurrentHead(): WorldId;      // 기존: 동기, 현재 브랜치 head
  currentBranch(): Branch;
  enqueueAction(type: string, input?: unknown, opts?: ActOptions): ProposalId;
}
```

**Rationale:** Hook 안에서 비동기 World 쿼리가 필요한 경우는 Hook의 설계 의도(관찰 전용, 빠른 반환)와 맞지 않는다. Head 쿼리가 필요한 컨텍스트는 App 초기화(resume)와 외부 소비자(Extension)이지, Hook이 아니다.

---

## 5. Implementation — Thin Facade Delegation

```typescript
// ManifestoApp 구현 (facade pattern)
class ManifestoApp implements App {
  // ... 기존 ...

  async getHeads(): Promise<WorldHead[]> {
    return this._getRuntime().world.getHeads();
  }

  async getLatestHead(): Promise<WorldHead | null> {
    return this._getRuntime().world.getLatestHead();
  }
}
```

---

## 6. §6.6 App Rules Addition

Add to §6.6 (App Rules):

```diff
 | APP-API-6 | MUST | `getDomainSchema()` MUST return current branch's schema |
+| QUERY-HEAD-1 | MUST | `app.getHeads()` MUST delegate to `world.getHeads()` |
+| QUERY-HEAD-2 | MUST | `app.getLatestHead()` MUST delegate to `world.getLatestHead()` |
+| QUERY-HEAD-3 | MUST NOT | App MUST NOT add filtering or transformation beyond World's return value |
```

---

## 7. Test Cases

### 7.1 App Delegation

```typescript
describe('App SPEC v2.3.1: Head Query Delegation', () => {
  it('app.getHeads() delegates to world.getHeads()', async () => {
    const app = await createApp(config);
    await app.act('action_a');

    const appHeads = await app.getHeads();
    const worldHeads = await world.getHeads();

    expect(appHeads).toEqual(worldHeads);
  });

  it('app.getLatestHead() delegates to world.getLatestHead()', async () => {
    const app = await createApp(config);
    await app.act('action_a');

    const appLatest = await app.getLatestHead();
    const worldLatest = await world.getLatestHead();

    expect(appLatest).toEqual(worldLatest);
  });

  it('app.getHeads() throws before ready()', async () => {
    const app = createAppSync(config); // not yet ready

    await expect(app.getHeads()).rejects.toThrow(AppNotReadyError);
  });
});
```

---

## 8. Cross-Reference

| Document | Section | Change |
|----------|---------|--------|
| World SPEC v2.0.5 | §9.7 Head, §4 Head Query API | Source of `WorldHead` type and query semantics |
| App SPEC v2.3.0 | §6.2 App Public API | Base for this patch |
| App SPEC v2.3.0 | §17.2 AppRef | Confirmed unchanged |
| ADR-004 | App as thin facade | Justification for delegation pattern |

---

*End of App SPEC v2.3.1 Patch Document*
