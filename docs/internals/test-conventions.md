# Test Conventions

> **Status:** Normative
> **Last updated:** 2026-06-12

---

## File Naming

| Pattern | Use case | Example |
|---------|----------|---------|
| `*.test.ts` | Unit tests, integration tests | `expr.test.ts`, `compile-mel-patch.test.ts` |
| `*.spec.ts` | Compliance / contract tests | `snapshot.spec.ts`, `handler.spec.ts` |
| `*.golden.test.ts` | Golden file / trace replay | `trace-replay.golden.test.ts` |
| `*.golden.spec.ts` | Golden compliance tests | `determinism.golden.spec.ts` |

Both `.test.ts` and `.spec.ts` are valid test files. vitest discovers both.

## File Placement

| Location | When to use |
|----------|-------------|
| `src/__tests__/*.test.ts` | Default — tests for internal modules |
| `src/<module>/<module>.test.ts` | Co-located — test tightly coupled to one module |
| `__tests__/` (outside src) | Integration / E2E tests that span multiple modules |
| `src/__tests__/compliance/` | Package compliance suites |
| `src/__tests__/golden/` | Golden trace replay tests |

## Discovery Rules

vitest config in each package discovers:
```
src/**/*.test.ts
src/**/*.spec.ts
__tests__/**/*.test.ts  (compiler only — legacy, will converge)
```

Root vitest.config.ts discovers all packages for CI:
```
packages/**/src/**/*.{test,spec}.ts
packages/compiler/__tests__/**/*.{test,spec}.ts
```

## Adding New Tests

1. Use `*.test.ts` for new tests (default)
2. Use `*.spec.ts` only for compliance/contract suites
3. Place in `src/__tests__/` unless co-locating with a specific module
4. Name descriptively: `<feature>.test.ts`, not `test1.test.ts`

## CI Filtering

```bash
# All tests
pnpm -r test

# Single package
pnpm test --filter @manifesto-ai/core

# Specific file
pnpm --filter @manifesto-ai/host exec vitest run src/__tests__/compliance/
pnpm --filter @manifesto-ai/compiler exec vitest run src/__tests__/compliance/
```

## CTS Taxonomy

Compliance test suites (CTS) follow a two-tier taxonomy:

1. **Package CTS** — `packages/*/src/__tests__/compliance/`
   Verifies that package's own SPEC (e.g. Core CTS, Host HCTS, Compiler CCTS,
   Lineage LCTS, Governance GCTS). Package CTS may use internal adapters and
   package internals to observe behavior the public surface does not expose.
2. **Cross-package activation CTS** — `cts/activation-cts/`
   Verifies composed activation/decorator contracts (base runtime, lineage,
   governance) against public surfaces only. It must not import package
   internals.

`@manifesto-ai/cts-kit` (`cts/cts-kit/`) is the single shared compliance
framework for both tiers: rule/inventory/case/coverage types, the
`evaluateRule`/`passRule`/`failRule`/`expectCompliance`/`expectAllCompliance`
assertion helpers, and the rule-matrix validators
(`expectUniqueRuleIds`, `expectInventoryRegistryParity`,
`expectCoverageIntegrity`, `expectCoverageCompleteness`,
`expectSuiteRulePresence`). New compliance suites MUST consume cts-kit rather
than copying the skeleton; package-specific helpers (e.g. compiler diagnostic
evidence, host trace evidence) stay in the package's compliance directory.
