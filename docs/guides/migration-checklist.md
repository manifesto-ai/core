# Migration Checklist

> **Goal:** Operational checklist for upgrading an existing early-v2 project to the current Manifesto DX

---

## A. Pre-Migration Audit

- [ ] Create a dedicated migration branch.
- [ ] Freeze feature merges during migration window.
- [ ] Capture current behavior baselines (key actions, snapshots, effects).
- [ ] Inventory legacy API usage (`worldStore`, `services`, legacy hook patterns).
- [ ] Confirm current CI is green before changing dependencies.

---

## B. Dependency Upgrade

- [ ] Upgrade Manifesto packages to current target versions.
- [ ] Reinstall lockfile dependencies.
- [ ] Regenerate build artifacts and typed outputs.

Suggested commands:

```bash
pnpm add @manifesto-ai/app@^2.2.0 @manifesto-ai/core@^2.2.0 @manifesto-ai/host@^2.2.0 @manifesto-ai/world@^2.2.0 @manifesto-ai/compiler@^1.5.0 @manifesto-ai/intent-ir@^0.3.0 @manifesto-ai/translator@^0.2.0
pnpm install
pnpm build
```

---

## C. Code Migration

- [ ] Convert app bootstrap to effects-first `createApp({ schema, effects })`.
- [ ] Move legacy service handlers into the `effects` map.
- [ ] Update app-level effect handler signature to `(params, ctx)`.
- [ ] Replace manual idempotency flags with `onceIntent` where safe.
- [ ] Remove business reliance on platform namespaces (`$host`, `$mel`).
- [ ] If custom storage is required, inject a configured `world` explicitly.

---

## D. Validation

- [ ] `pnpm build` passes.
- [ ] `pnpm test` passes.
- [ ] Core action smoke tests match baseline outcomes.
- [ ] No re-entry loops in migrated flows.
- [ ] Effect failures are represented as state/patch values (not hidden throws).
- [ ] Persistence logic excludes platform namespaces from canonical hash inputs.

---

## E. Rollout

- [ ] Release behind feature flag or canary route.
- [ ] Monitor action failure rate and retry volume.
- [ ] Compare trace snapshots between old and new runtime paths.
- [ ] Roll out gradually by module/team boundary.
- [ ] Keep rollback switch until parity is stable.

---

## F. Done Criteria

- [ ] No legacy migration markers remain in code.
- [ ] Team runbook updated with new app/effects conventions.
- [ ] Onboarding docs point to current migration guides.
- [ ] Post-migration retrospective logged.

---

## PR Template (Copy)

```markdown
## Manifesto v2 DX Migration

### Scope
- [ ] App bootstrap migrated
- [ ] Effects map migrated
- [ ] Re-entry safety updated
- [ ] Custom world/persistence updated

### Validation
- [ ] pnpm build
- [ ] pnpm test
- [ ] Smoke scenarios

### Risks
- [ ] Effect type mismatches
- [ ] Re-entry regressions
- [ ] Snapshot hash/persistence drift

### Rollback
- [ ] Feature flag available
- [ ] Prior runtime path preserved
```

---

## Related Guides

- [Migration Playbook](./migration-from-v2-early)
- [Migration API Cookbook](./migration-api-cookbook)
- [Debugging](./debugging)
