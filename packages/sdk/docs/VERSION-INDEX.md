# SDK Version Index

## Current Contract

| Version | Document | ADR | Notes | Status |
|---------|----------|-----|-------|--------|
| v3.0.0 | [SPEC](sdk-SPEC.md) | [ADR-017](../../../docs/internals/adr/017-capability-decorator-pattern.md) | Activation-first SDK with `activate()`, typed `createIntent()`, `dispatchAsync()`, availability queries, action metadata inspection, and the public provider authoring seam | Current |

## Reading Order

1. Read [../README.md](../README.md) for package entrypoint guidance.
2. Read [GUIDE.md](GUIDE.md) for current usage and decorator/provider authoring boundaries.
3. Read [sdk-SPEC.md](sdk-SPEC.md) for the current living SDK contract.

## Historical Note

Superseded SDK v0-v2 spec files were removed from the working tree. If you need pre-activation archaeology, use `git log -- packages/sdk/docs` or GitHub history instead of treating those old files as active package docs.
