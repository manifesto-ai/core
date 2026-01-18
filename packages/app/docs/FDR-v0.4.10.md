# Manifesto App Foundational Design Rationale (FDR)

**Version:** 0.4.10  
**Status:** Legacy (pre-v2)  
**Date:** 2026-01-07  
**Companion:** manifesto-ai-app__v0.4.10__SPEC.md

> **Note:** This FDR predates the v2 architecture. App v2 FDR is TBD.

## Abstract

This document records the design rationale, critical issue resolutions, and architectural decisions made during the v0.4.x specification development cycle. Each decision includes the problem context, alternatives considered, chosen solution, and justification.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Critical Issue Resolution Log](#2-critical-issue-resolution-log)
3. [Architectural Decisions](#3-architectural-decisions)
4. [Rule Justifications](#4-rule-justifications)
5. [Cross-Reference Matrix](#5-cross-reference-matrix)

---

## 1. Overview

### 1.1 Specification Evolution

The v0.4.x specification evolved through 11 review iterations (v0.4.0 → v0.4.10), each addressing critical issues identified through runtime modeling and protocol compliance verification.

| Version | Primary Focus | Critical Issues Resolved |
|---------|---------------|-------------------------|
| v0.4.0 | System Runtime Model, Reserved Namespaces | Initial architecture |
| v0.4.1 | World Protocol Compliance (rejected handling) | 2 |
| v0.4.2 | System Action recall anchor, Invocation restriction | 1 |
| v0.4.3 | branchId semantics, Memory disabled behavior | 3 |
| v0.4.4 | preparation_failed phase, Error code consistency | 2 |
| v0.4.5 | Standalone recall anchor, system.get built-in | 2 |
| v0.4.6 | NS-EFF-2 conflict, Fork bypass, Session actor | 3 |
| v0.4.7 | NoneVerifier security, Edge case clarifications | 1 |
| v0.4.8 | Memory Maintenance (forget-only) | Feature addition |
| v0.4.9 | Memory Maintenance actor context | 1 |
| **v0.4.10** | **Plugin schema access (getDomainSchema)** | **1** |

**Total Critical Issues Resolved: 16**
**Feature Additions: 2** (Memory Maintenance, getDomainSchema)

### 1.2 Design Principles Applied

Throughout the v0.4.x cycle, these principles guided decisions:

1. **Protocol Compliance**: No modification to World Protocol, Core, Host, or Memory SPEC semantics
2. **Determinism**: All state changes must be reproducible and auditable
3. **Type Consistency**: Types across package boundaries must be exactly aligned
4. **Implementation Non-Divergence**: Specifications must be unambiguous to prevent implementation fragmentation
5. **Security by Default**: Reserved namespaces and built-in handlers prevent privilege escalation
6. **Plugin Interoperability**: Guaranteed access to domain artifacts regardless of timing (v0.4.10)

---

## 2. Critical Issue Resolution Log

*(Sections 2.1–2.18 unchanged from v0.4.9, numbers preserved)*

### 2.1–2.18

*(FDR-CRIT-001 through FDR-CRIT-018 unchanged from v0.4.9)*

---

### 2.19 FDR-CRIT-019: Plugin Schema Access Timing & Multi-Schema Compatibility (v0.4.10) (NEW)

**Problem**: Mind Protocol Plugin SPEC v0.2.1 requires reliable access to DomainSchema for schema-first LLM integration. Three interrelated issues exist:

#### Issue A: Hook Timing

1. Plugin initialization happens during `app.ready()`
2. `domain:resolved` hook may emit before plugin code executes
3. If plugin misses the hook, it cannot reliably obtain schema

#### Issue B: Multi-Schema Scenarios

4. App supports schema-changing forks (FORK-1: `ForkOptions.domain` creates new Runtime)
5. `switchBranch()` can switch to a branch with different schemaHash
6. A naive "return ready-time schema" API would be incorrect after schema change

#### Issue C: READY-1 vs Plugin Execution Timing (Critical)

7. READY-1 states: "APIs before ready() resolve MUST throw AppNotReadyError"
8. Plugins execute DURING ready(), before it resolves
9. If `getDomainSchema()` followed READY-1, plugins couldn't call it—contradicting the purpose

**Options Considered**:

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A1. Fixed ready-time schema | `getDomainSchema()` returns initial schema | Simple | **Breaks multi-schema** |
| A2. Current branch schema | `getDomainSchema()` returns current branch's schema | Correct | Slightly more complex |
| B. Replayable hook | `domain:resolved` replays on subscribe | No new API | Complex semantics |
| C. SCHEMA-2 follows READY-1 | Throw before ready() resolves | Consistent | **Blocks plugin use** |
| **D. SCHEMA-2 keyed to schema resolution** | Throw before schema cached | **Enables plugins** | Requires exception |

**Decision**:
- Option A2 for multi-schema support
- Option D for timing: SCHEMA-2 keyed to "schema resolved", not "ready resolved"
- READY-1a as explicit exception for `getDomainSchema()`

**Key Design Choices**:

1. **SCHEMA-2 condition changed**: "ready() resolve 전" → "schema resolve/cache 전"
    - This aligns with READY-6 (schema cached before plugins)
    - Plugins can call `getDomainSchema()` during initialization

2. **READY-1a exception**: Explicit carve-out for `getDomainSchema()`
    - Most APIs still require ready() to fully resolve
    - Only `getDomainSchema()` is available earlier (after READY-6)

3. **Current branch's schemaHash**: After `switchBranch()` or schema-changing fork, `getDomainSchema()` returns the schema for the new branch's schemaHash.

4. **Referential identity per schemaHash**: Repeated calls for the same schemaHash return the same cached object instance.

**Resulting Rules**: SCHEMA-1~6, READY-1a, READY-6

**Cross-Reference**: This decision directly addresses Mind Protocol Plugin SPEC v0.2.1's requirement (FDR-MIND-CRIT-009).

---

## 3. Architectural Decisions

*(Section 3 unchanged from v0.4.9)*

---

## 4. Rule Justifications

*(Section 4.1–4.15 unchanged from v0.4.9)*

### 4.19 SCHEMA-1~6, READY-1a, READY-6: getDomainSchema() API (NEW)

| Rule | Justification |
|------|---------------|
| SCHEMA-1 | Returns current branch's schema - aligns with getState() semantics |
| SCHEMA-2 | Keyed to "schema resolved" (not "ready resolved") - enables plugin access |
| SCHEMA-3 | Never returns undefined once resolved - eliminates null checks |
| SCHEMA-4 | Referential identity per schemaHash - enables cheap equality checks |
| SCHEMA-5 | MEL text compiled - transparent to callers |
| SCHEMA-6 | Updates on branch switch - ensures correctness in multi-schema scenarios |
| READY-1a | Exception for getDomainSchema() - enables plugin use during ready() |
| READY-6 | Schema resolved before plugins - guarantees getDomainSchema() availability |

---

## 5. Cross-Reference Matrix

### 5.1 SPEC to FDR Mapping

| SPEC Section | SPEC Rules | FDR Reference |
|--------------|------------|---------------|
| §6.2 getDomainSchema() | SCHEMA-1~6, READY-6 | FDR-CRIT-019 |
| §11.5 Hook Events | domain:resolved, domain:schema:added | FDR-CRIT-019 |
| §16 System Runtime | SYSRT-1~9 | FDR-CRIT-001 |
| §17 System Actions | SYS-1~9 | FDR-CRIT-001, FDR-CRIT-002 |
| §18 Reserved Namespaces | NS-ACT-1~3, NS-EFF-1~4 | FDR-CRIT-003, FDR-ARCH-002 |

### 5.2 External Dependency Cross-Reference

| Dependent Spec | Required App Feature | FDR Reference |
|----------------|---------------------|---------------|
| Mind Protocol Plugin v0.2.1 | `getDomainSchema()` | FDR-CRIT-019 |
| Mind Protocol Plugin v0.2.1 | `domain:resolved` hook | (existing) |
| Mind Protocol Plugin v0.2.1 | `memory.recall()` API | (existing) |

---

## Appendix A: Decision Log Summary

| Decision ID | Version | Summary |
|-------------|---------|---------|
| FDR-CRIT-001 | v0.4.0 | System Runtime separation |
| FDR-CRIT-002 | v0.4.1 | Rejected System Actions create no World |
| FDR-CRIT-003 | v0.4.1 | Action type namespace reservation |
| FDR-CRIT-004 | v0.4.2 | System Action recall uses Domain anchor |
| FDR-CRIT-005 | v0.4.2 | Best-effort audit with hooks |
| FDR-CRIT-006 | v0.4.2 | System Actions via app.act() only |
| FDR-CRIT-007 | v0.4.3 | branchId dual semantics |
| FDR-CRIT-008 | v0.4.3 | Optional branchId in hook payloads |
| FDR-CRIT-009 | v0.4.3 | Memory disabled strict failure mode |
| FDR-CRIT-010 | v0.4.4 | preparation_failed phase addition |
| FDR-CRIT-011 | v0.4.4 | ErrorValue.code for MEM-DIS-6 |
| FDR-CRIT-012 | v0.4.5 | Standalone recall anchor rules |
| FDR-CRIT-013 | v0.4.6 | Session actorId/branchId override rules |
| FDR-CRIT-014 | v0.4.6 | NS-EFF-2/SYSGET conflict resolution |
| FDR-CRIT-015 | v0.4.7 | NoneVerifier security |
| FDR-CRIT-016 | v0.4.6 | SESS-ACT-4 session actor binding |
| FDR-CRIT-017 | v0.4.8 | Memory Maintenance forget-only |
| FDR-CRIT-018 | v0.4.9 | Memory Maintenance actor context |
| **FDR-CRIT-019** | **v0.4.10** | **getDomainSchema() with multi-schema support + READY-1a exception** |

---

## Appendix B: Upstream Invariants

*(Unchanged from v0.4.9)*

---

## Appendix C: Implementation Guidance

*(Unchanged from v0.4.9)*

---

**End of FDR**
