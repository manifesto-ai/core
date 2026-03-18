# Manifesto Scaffold

This directory is reserved for the rebuilt SDK integration layer.

Planned files:

- `instance.ts`
- `hooks.ts`
- `provider.tsx`
- `effects/persistence.ts`
- `__tests__/taskflow.test.ts`

Guidelines:

- `instance.ts` owns `createManifesto()` and any local dispatch utility
- `hooks.ts` owns React bindings based on `useSyncExternalStore`
- `provider.tsx` owns lifecycle and restoration glue
- `effects/` stays host-side only
- tests should verify domain behavior, not old demo architecture
