# Upgrade to the Next Major

> Moving onto the hard-cut governed runtime surface.

This guide captures the practical changes needed to move onto the current next-major surface after the hard-cut align work.

## Runtime Choice

Use one of these two public entry paths:

- `@manifesto-ai/sdk` with `createManifesto()` for direct dispatch
- `@manifesto-ai/world` for governed composition, lineage, sealing, and recovery

Do not mix them into a single bootstrap story.

## Hard-Cut Changes

If you are moving old governed code forward, align to these surfaces:

- use `GovernedWorldStore` instead of older store naming
- use `runInSealTransaction()` as the canonical seal persistence seam
- use `WorldExecutor` as the execution abstraction owner
- use `WorldRuntime.executeApprovedProposal()` for the governed happy path
- use `WorldRuntime.resumeExecutingProposal()` for recovery and replay convergence
- use async store and service APIs throughout lineage, governance, and world

## Store Migration

Pick the durable adapter that matches the runtime you are building:

- Node-local app: `@manifesto-ai/world/sqlite`
- Browser app: `@manifesto-ai/world/indexeddb`
- Tests or ephemeral local composition: `@manifesto-ai/world/in-memory`

The assembly story stays the same. Only the store factory changes.

## Governed Bootstrap

The current governed path is:

1. Create the store
2. Create `lineage` and `governance` services
3. Create the governance event dispatcher
4. Create the `world`
5. Seal genesis
6. Persist an `executing` proposal and decision record
7. Call `world.runtime.executeApprovedProposal()`

For a runnable reference, use the repo example at `examples/governed-minimal-node`.

## What Not to Carry Forward

Do not reintroduce the removed transition surfaces from earlier drafts:

- `CommitCapableWorldStore`
- `WriteSet`
- `commitSeal()` as a public store contract
- governance-owned execution abstractions
- sync persistence assumptions for lineage, governance, or world stores

## See Also

- [Governed Composition](./governed-composition)
- [Release Hardening](./release-hardening)
- [World API](/api/world)
- [SDK API](/api/sdk)
