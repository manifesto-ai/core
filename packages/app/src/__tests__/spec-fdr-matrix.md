# App v2 Spec/FDR Test Matrix

Scope: packages/app
Legend: covered, partial, todo

## APP-SPEC v2.0.0 compliance (Section 20)

| Level | Area | Rules | Tests | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Minimal | App interface and lifecycle | SPEC 6-7 | `packages/app/src/__tests__/spec-compliance.test.ts`, `packages/app/src/__tests__/lifecycle.test.ts` | covered | Core API and lifecycle checks |
| Minimal | HostExecutor | SPEC 8, FDR-APP-INTEGRATION-001 HEXEC-* | `packages/app/src/__tests__/host-executor.test.ts`, `packages/app/src/__tests__/v2-standard-integration.test.ts` | partial | AppConfig path not using injected Host |
| Minimal | WorldStore core ops | SPEC 9, FDR-APP-INTEGRATION-001 STORE-* | `packages/app/src/__tests__/world-store.test.ts`, `packages/app/src/__tests__/v2-standard-integration.test.ts` | partial | WorldStore not integrated in App execution |
| Minimal | Boundary rules | SPEC 4 | `packages/app/src/__tests__/v2-boundary.test.ts`, `packages/app/src/__tests__/v2-standard-integration.test.ts` | partial | AppConfig injection not enforced |
| Standard | PolicyService, ExecutionKey, scope | SPEC 10, FDR-APP-POLICY-001 | `packages/app/src/__tests__/policy-service.test.ts`, `packages/app/src/__tests__/v2-standard-integration.test.ts` | partial | App-level enforcement missing |
| Standard | Branch management | SPEC 12 | `packages/app/src/__tests__/branch.test.ts`, `packages/app/src/__tests__/spec-compliance.test.ts` | covered | Branch creation, switch, lineage |
| Standard | Schema registry | SPEC 13 | `packages/app/src/__tests__/schema-api.test.ts` | covered | Schema load/resolve |
| Standard | Session | SPEC 14 | `packages/app/src/__tests__/session.test.ts` | covered | Actor and branch binding |
| Standard | ActionHandle | SPEC 16 | `packages/app/src/__tests__/action.test.ts`, `packages/app/src/__tests__/spec-compliance.test.ts`, `packages/app/src/__tests__/timing-compliance.test.ts` | covered | Phases, done/result |
| Standard | Hook system | SPEC 17 | `packages/app/src/__tests__/hooks.test.ts`, `packages/app/src/__tests__/publish-boundary.test.ts`, `packages/app/src/__tests__/v2-standard-integration.test.ts`, `packages/app/src/__tests__/timing-compliance.test.ts` | partial | AppRef and hook isolation missing |
| Full | Memory | SPEC 11 | `packages/app/src/__tests__/memory.test.ts`, `packages/app/src/__tests__/memory-architecture.test.ts`, `packages/app/src/__tests__/context-freezing.test.ts` | partial | Context freezing helpers covered; integration gaps remain |
| Full | System runtime | SPEC 15 | `packages/app/src/__tests__/system-runtime.test.ts`, `packages/app/src/__tests__/system-actions.test.ts` | covered | System schema and actions |
| Full | Plugin system | SPEC 18 | `packages/app/src/__tests__/plugins.test.ts`, `packages/app/src/__tests__/spec-compliance.test.ts` | covered | Install order and errors |
| Full | WorldStore maintenance | SPEC 9.1 | none | todo | Maintenance phases and constraints |

## FDR rule coverage (App v2)

| FDR | Rules | Status | Tests | Notes |
| --- | --- | --- | --- | --- |
| FDR-APP-INTEGRATION-001 | HEXEC-*, STORE-*, DELTA-GEN-* | partial | `packages/app/src/__tests__/host-executor.test.ts`, `packages/app/src/__tests__/world-store.test.ts`, `packages/app/src/__tests__/v2-standard-integration.test.ts` | Missing delta generation and restore context |
| FDR-APP-POLICY-001 | EXK-*, SCOPE-*, ROUTE-*, POLICY-SVC-* | partial | `packages/app/src/__tests__/policy-service.test.ts`, `packages/app/src/__tests__/v2-standard-integration.test.ts` | App-level enforcement missing |
| FDR-APP-PUB-001 | PUB-*, APP-WORLD-* | partial | `packages/app/src/__tests__/publish-boundary.test.ts` | Publish event not implemented |
| FDR-APP-EXT-001 | MEM-CTX-*, APP-INPUT-* | partial | `packages/app/src/__tests__/memory.test.ts`, `packages/app/src/__tests__/context-freezing.test.ts` | Context freezing covered; input namespace still partial |
| FDR-APP-RUNTIME-001 | LC-*, HOOK-*, PLUGIN-* | partial | `packages/app/src/__tests__/hooks.test.ts`, `packages/app/src/__tests__/plugins.test.ts`, `packages/app/src/__tests__/lifecycle.test.ts`, `packages/app/src/__tests__/timing-compliance.test.ts` | Hook error isolation and AppRef missing |
