# @manifesto-ai/lineage

> Continuity and history decorator runtime for Manifesto.

## Role

Lineage decorates a composable manifesto to add:

- sealing continuity
- restore
- stored world snapshot lookup
- branch/head queries
- commit semantics over the current SDK runtime

## Public API

### `withLineage(manifesto, config): LineageComposableManifesto<T>`

```typescript
const manifesto = createManifesto(schema, effects);
const lineage = withLineage(manifesto, {
  store: createInMemoryLineageStore(),
});
const runtime = lineage.activate();
```

### `LineageInstance<T>`

```typescript
interface LineageInstance<T> extends Omit<ManifestoBaseInstance<T>, "dispatchAsync"> {
  commitAsync(intent): Promise<Snapshot<T["state"]>>;
  restore(worldId): Promise<void>;
  getWorld(worldId): Promise<World | null>;
  getWorldSnapshot(worldId): Promise<CanonicalSnapshot<T["state"]> | null>;
  getLineage(): Promise<WorldLineage>;
  getLatestHead(): Promise<WorldHead | null>;
  getHeads(): Promise<readonly WorldHead[]>;
  getBranches(): Promise<readonly BranchInfo[]>;
  getActiveBranch(): Promise<BranchInfo>;
  switchActiveBranch(branchId): Promise<BranchSwitchResult>;
  createBranch(name, fromWorldId?): Promise<BranchId>;
}
```

## Notes

- `getSnapshot()` remains the projected runtime read inherited from SDK.
- `getCanonicalSnapshot()` reads the current visible canonical substrate.
- `getWorldSnapshot(worldId)` reads the stored sealed canonical snapshot for a specific world.
- Current living contract is `packages/lineage/docs/lineage-SPEC.md`.
