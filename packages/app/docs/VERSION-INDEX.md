# Manifesto App Documentation Index

> **Package:** `@manifesto-ai/app`
> **Last Updated:** 2026-02-05

---

## Latest Version

- **SPEC:** [v2.2.0](APP-SPEC-v2.2.0.md) (Full - implements ADR-APP-002)
- **Architecture:** [APP-ARCHITECTURE-OVERVIEW.md](APP-ARCHITECTURE-OVERVIEW.md)

**Note:** v2.2.0 is a full specification. For createApp API simplification details, see [ADR-APP-002](ADR-APP-002-v0.1.0.md).

---

## All Versions

| Version | SPEC | FDR | Type | Status |
|---------|------|-----|------|--------|
| v2.2.0 | [SPEC](APP-SPEC-v2.2.0.md) | [ADR-APP-002](#adrs) | Full | Draft |
| v2.1.0 | [SPEC](APP-SPEC-v2.1.0-patch.md) | — | Patch (Base: v2.0.0) | Draft |
| v2.0.0 | [SPEC](APP-SPEC-v2.0.0.md) | [Multiple FDRs](#fdrs) | Full | Accepted |

---

## ADRs

| ADR | Version | Status | Scope |
|-----|---------|--------|-------|
| [ADR-APP-002](ADR-APP-002-v0.1.0.md) | v0.1.0 | Proposed | createApp Public API simplification |

---

## FDRs

| FDR | Version | Scope |
|-----|---------|-------|
| [FDR-APP-PUB-001](FDR-APP-PUB-001-v0.3.0.md) | v0.3.0 | Tick definition, publish boundary |
| [FDR-APP-RUNTIME-001](FDR-APP-RUNTIME-001-v0.2.0.md) | v0.2.0 | Lifecycle, hooks, plugins |
| [FDR-APP-INTEGRATION-001](FDR-APP-INTEGRATION-001-v0.4.0.md) | v0.4.0 | HostExecutor, WorldStore, maintenance |
| [FDR-APP-POLICY-001](FDR-APP-POLICY-001-v0.2.3.md) | v0.2.3 | ExecutionKey, authority, scope |
| [FDR-APP-EXT-001](FDR-APP-EXT-001-v0.4.0.md) | v0.4.0 | MemoryStore, context freezing |

---

## Reading Guide

### For Latest (v2.2.0)

1. Read [APP-SPEC-v2.2.0.md](APP-SPEC-v2.2.0.md) (complete specification with createApp DX simplification)
2. For ADR rationale: [ADR-APP-002](ADR-APP-002-v0.1.0.md)
3. For architecture overview: [APP-ARCHITECTURE-OVERVIEW.md](APP-ARCHITECTURE-OVERVIEW.md)

### For v2.1.0

1. Read [APP-SPEC-v2.0.0.md](APP-SPEC-v2.0.0.md) (full base specification)
2. Read [APP-SPEC-v2.1.0-patch.md](APP-SPEC-v2.1.0-patch.md) (ADR-002: platform namespace injection, `$mel` support)
3. For architecture overview: [APP-ARCHITECTURE-OVERVIEW.md](APP-ARCHITECTURE-OVERVIEW.md)

### For v2.0.0

1. Read [APP-SPEC-v2.0.0.md](APP-SPEC-v2.0.0.md) (complete)
2. For architecture overview: [APP-ARCHITECTURE-OVERVIEW.md](APP-ARCHITECTURE-OVERVIEW.md)

---

## Additional Documents

- [APP-TEST-SPEC-v2.0.0.md](APP-TEST-SPEC-v2.0.0.md) - Test specification
- [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md) - Migration guide from v0.4.x to v2.0
