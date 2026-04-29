# Core SPEC Compliance Test Suite

> **Purpose:** Define the compliance harness for `@manifesto-ai/core` against the current living Core SPEC.

Core CTS exists to make Core SPEC compliance executable. It does not replace unit tests; it adds a rule-id matrix and acceptance probes that keep the normative Core contract visible during ADR and SPEC work.

## Layout

```text
packages/core/src/__tests__/compliance/
  core-cts-types.ts
  core-cts-spec-inventory.ts
  core-cts-rules.ts
  core-cts-coverage.ts
  core-cts-matrix.spec.ts
  suite/
    helpers.ts
    schema.spec.ts
    snapshot.spec.ts
    patch-and-system.spec.ts
    compute-and-flow.spec.ts
    expr.spec.ts
    availability-dispatchability.spec.ts
    trace-and-hash.spec.ts
```

## Rule Lifecycle

- `blocking` rules are enforced by executable CTS cases.
- `informational` rules remain visible in the registry when the SPEC text is advisory, `MAY`, or cross-package ownership makes direct Core assertion inappropriate.
- If a current Core MUST rule is not implemented, add an executable failing CTS case. Do not hide it behind `it.todo`.

## Running

```bash
pnpm --filter @manifesto-ai/core test -- src/__tests__/compliance
pnpm --filter @manifesto-ai/core test
```

## Maintenance

When `core-SPEC.md` adds or changes a normative rule:

1. update `core-cts-spec-inventory.ts`
2. update `core-cts-rules.ts`
3. add or adjust a case in `core-cts-coverage.ts`
4. add or adjust an executable suite probe

If a rule is not in the registry, it is not visible to compliance review.
