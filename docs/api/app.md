# @manifesto-ai/app (Removed)

> **Status:** Removed in R2.
> **Decision:** [ADR-008](/internals/adr/008-sdk-first-transition-and-app-retirement)

---

## Status

`@manifesto-ai/app` was the temporary compatibility facade during the SDK-first transition.
The package was retired in R2 and is no longer part of the workspace release set.

- Canonical public entry point: `@manifesto-ai/sdk`
- Compatibility package lifecycle: R1 deprecated, R2 removed
- npm deprecation notice remains for historical consumers

---

## Migration Target

Use `@manifesto-ai/sdk` for all application-facing APIs.

- Migration guide: [Migrate app imports to sdk](/guides/migrate-app-to-sdk)
- Runtime internals: [@manifesto-ai/runtime](./runtime)

---

## Historical References

- Kickoff policy and staged locking: [ADR-007](/internals/adr/007-sdk-runtime-split-kickoff)
- Transition and retirement decision: [ADR-008](/internals/adr/008-sdk-first-transition-and-app-retirement)

This page is retained only as a retirement record.
