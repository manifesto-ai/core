# App v2 Spec/FDR Test Matrix

Scope: packages/app
Legend: covered, partial, todo

## APP-SPEC v2.0.0 compliance (Section 20)

| Level | Area | Rules | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Minimal | App interface and lifecycle | SPEC 6-7 | `packages/app/src/__tests__/spec-compliance.test.ts`, `packages/app/src/__tests__/lifecycle.test.ts` | covered | Core API and lifecycle checks |
| Minimal | HostExecutor | SPEC 8, FDR-APP-INTEGRATION-001 HEXEC-* | `packages/app/src/__tests__/host-executor.test.ts` | partial | Missing restore-from-WorldStore, mailbox routing |
| Minimal | WorldStore core ops | SPEC 9, FDR-APP-INTEGRATION-001 STORE-* | `packages/app/src/__tests__/world-store.test.ts` | partial | Missing delta canonicalization and restore context |
| Minimal | Boundary rules | SPEC 4 | none | todo | AppConfig injection and boundary guard tests |
| Standard | PolicyService, ExecutionKey, scope | SPEC 10, FDR-APP-POLICY-001 | `packages/app/src/__tests__/policy-service.test.ts` | partial | App integration still missing |
| Standard | Branch management | SPEC 12 | `packages/app/src/__tests__/branch.test.ts`, `packages/app/src/__tests__/spec-compliance.test.ts` | covered | Branch creation, switch, lineage |
| Standard | Schema registry | SPEC 13 | `packages/app/src/__tests__/schema-api.test.ts` | covered | Schema load/resolve |
| Standard | Session | SPEC 14 | `packages/app/src/__tests__/session.test.ts` | covered | Actor and branch binding |
| Standard | ActionHandle | SPEC 16 | `packages/app/src/__tests__/action.test.ts`, `packages/app/src/__tests__/spec-compliance.test.ts` | covered | Phases, done/result |
| Standard | Hook system | SPEC 17 | `packages/app/src/__tests__/hooks.test.ts`, `packages/app/src/__tests__/publish-boundary.test.ts` | partial | AppRef integration missing |
| Full | Memory | SPEC 11 | `packages/app/src/__tests__/memory.test.ts`, `packages/app/src/__tests__/memory-architecture.test.ts` | partial | Missing context freezing |
| Full | System runtime | SPEC 15 | `packages/app/src/__tests__/system-runtime.test.ts`, `packages/app/src/__tests__/system-actions.test.ts` | covered | System schema and actions |
| Full | Plugin system | SPEC 18 | `packages/app/src/__tests__/plugins.test.ts`, `packages/app/src/__tests__/spec-compliance.test.ts` | covered | Install order and errors |
| Full | WorldStore maintenance | SPEC 9.1 | none | todo | Maintenance phases and constraints |

## FDR rule coverage (App v2)

| FDR | Rules | Status | Tests | Notes |
| --- | --- | --- | --- | --- |
| FDR-APP-INTEGRATION-001 | HEXEC-*, STORE-*, DELTA-GEN-* | partial | `packages/app/src/__tests__/host-executor.test.ts`, `packages/app/src/__tests__/world-store.test.ts` | Missing delta generation and restore context |
| FDR-APP-POLICY-001 | EXK-*, SCOPE-*, ROUTE-*, POLICY-SVC-* | partial | `packages/app/src/__tests__/policy-service.test.ts` | App-level enforcement missing |
| FDR-APP-PUB-001 | PUB-*, APP-WORLD-* | partial | `packages/app/src/__tests__/publish-boundary.test.ts` | Publish event not implemented |
| FDR-APP-EXT-001 | MEM-CTX-*, APP-INPUT-* | partial | `packages/app/src/__tests__/memory.test.ts` | Context freezing and input namespace |
| FDR-APP-RUNTIME-001 | LC-*, HOOK-*, PLUGIN-* | partial | `packages/app/src/__tests__/hooks.test.ts`, `packages/app/src/__tests__/plugins.test.ts`, `packages/app/src/__tests__/lifecycle.test.ts` | Hook error isolation and AppRef missing |
