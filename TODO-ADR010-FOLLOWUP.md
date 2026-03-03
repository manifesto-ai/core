# ADR-010 Follow-up Tasks

> These tasks were identified during the ADR-010 Protocol-First SDK Reconstruction.
> Create GitHub issues from these descriptions.

---

## Issue 1: Migrate Policy modules from retired Runtime to World package

**Title:** `feat(world): Migrate Policy modules from retired Runtime to World package`

**Labels:** `enhancement`, `world`

### Context

ADR-010 retired `@manifesto-ai/runtime`. Its Policy modules (`DefaultPolicyService`, `builtInPolicies`, `ExecutionKey`, `ApprovedScope`) were identified as World-domain responsibilities (plan §5b) but were not migrated before the package was deleted.

### Task

Re-implement the following in `@manifesto-ai/world`:

- `DefaultPolicyService` — policy evaluation service
- `builtInPolicies` — default, actor-serial, global-serial, branch-serial policies
- `ApprovedScope` — scope validation for authority decisions
- Related types: `PolicyService`, `ExecutionKey`, `AuthorityDecision`

### Source Reference

Original code was in `packages/runtime/src/policy/` (deleted in commit `5283b18`). Refer to git history:

```bash
git show 5283b18^:packages/runtime/src/policy/service.ts
git show 5283b18^:packages/runtime/src/policy/types.ts
git show 5283b18^:packages/runtime/src/policy/execution-key.ts
git show 5283b18^:packages/runtime/src/policy/approved-scope.ts
```

### Acceptance Criteria

- [ ] Policy types and service are available from `@manifesto-ai/world`
- [ ] Built-in policies (default, actor-serial, global-serial, branch-serial) work as before
- [ ] World package tests cover policy evaluation
- [ ] SDK can optionally consume World policy service via `ManifestoConfig`

### Related

- ADR-010: Protocol-First SDK Reconstruction
- SDK SPEC v1.0.0 §2.5

---

## Issue 2: Design Memory/Branch/Migration as standalone extensions

**Title:** `feat: Design Memory, Branch, and Migration as standalone extensions`

**Labels:** `enhancement`, `architecture`

### Context

ADR-010 retired `@manifesto-ai/runtime`. The following subsystems were explicitly deferred (plan §5d) as out of SDK SPEC v1.0.0 scope:

- **MemoryHub + MemoryFacade** — provider fan-out for ingest/recall, context freezing
- **BranchManager** — branch creation/switching, schema-changing fork
- **MigrationLink** — schema migration between versions

These capabilities are valuable but should be re-introduced as composable extensions rather than built-in SDK features.

### Task

1. **Design phase**: Determine the right packaging strategy:
   - Separate packages (`@manifesto-ai/memory`, `@manifesto-ai/branch`)?
   - Extension modules within existing packages?
   - Plugin architecture via `ManifestoConfig` extension points?

2. **Memory**: Re-implement context freezing and provider fan-out as an optional extension
3. **Branch**: Re-implement branch management on top of WorldStore
4. **Migration**: Design schema migration for DomainSchema version changes

### Source Reference

Original code (deleted in commit `5283b18`):

```bash
git show 5283b18^:packages/runtime/src/memory/
git show 5283b18^:packages/runtime/src/storage/branch/
```

### Acceptance Criteria

- [ ] Architecture decision documented (ADR or FDR)
- [ ] Extension points defined in SDK SPEC (if needed)
- [ ] Memory extension can be plugged into `createManifesto()`
- [ ] Branch management works with WorldStore abstraction

### Related

- ADR-010: Protocol-First SDK Reconstruction
- SDK SPEC v1.0.0 §6.7 (explicit exclusions)
