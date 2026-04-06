# @manifesto-ai/world

> Canonical governed composition surface for Manifesto.

## Role

Top-level `@manifesto-ai/world` is the exact consumer-facing facade for:

- `createWorld()` and `WorldRuntime`
- the `GovernedWorldStore` contract and seal transaction seam
- the world-owned execution boundary (`WorldExecutor`)
- split-native lineage and governance service re-exports
- intent-instance helpers and governed bootstrap wiring

## Dependencies

- `uuid`
- Peer: `@manifesto-ai/core`

## Public API

### `createWorld(config): WorldInstance`

```typescript
interface WorldConfig {
  store: GovernedWorldStore;
  lineage: LineageService;
  governance: GovernanceService;
  eventDispatcher: GovernanceEventDispatcher;
  executor: WorldExecutor;
}
```

### `WorldInstance`

```typescript
interface WorldInstance {
  store: GovernedWorldStore;
  lineage: LineageService;
  governance: GovernanceService;
  coordinator: WorldCoordinator;
  runtime: WorldRuntime;
}
```

### `WorldRuntime`

```typescript
interface WorldRuntime {
  executeApprovedProposal(input: ExecuteApprovedProposalInput): Promise<WorldRuntimeCompletion>;
  resumeExecutingProposal(input: ResumeExecutingProposalInput): Promise<WorldRuntimeCompletion>;
}
```

### `WorldExecutor`

World defines its own execution seam and does not import `@manifesto-ai/host` directly:

```typescript
interface WorldExecutor {
  execute(
    key: ExecutionKey,
    snapshot: Snapshot,
    intent: Intent,
    opts?: WorldExecutionOptions,
  ): Promise<WorldExecutionResult>;

  abort?(key: ExecutionKey): void;
}
```

## Stores, Helpers, and Re-exports

Top-level exports include:

- `createWorld`
- `createLineageService`
- `createGovernanceService`
- `createGovernanceEventDispatcher`
- `createIntentInstance`, `createIntentInstanceSync`
- split-native lineage and governance types
- the facade-owned `GovernedWorldStore`, `WorldCoordinator`, and `WorldRuntime` types

Concrete store adapters live on subpaths:

- `@manifesto-ai/world/in-memory`
- `@manifesto-ai/world/indexeddb`
- `@manifesto-ai/world/sqlite`

## Event Model

Current world implementation emits governance-oriented events such as:

- `proposal:submitted`
- `proposal:evaluating`
- `proposal:decided`
- `proposal:superseded`
- `execution:completed`
- `execution:failed`
- `world:created`
- `world:forked`

## Current Structure

- Use top-level `@manifesto-ai/world` for consumer-facing governed composition.
- Use `@manifesto-ai/governance` or `@manifesto-ai/lineage` directly only when the task is intentionally scoped to one protocol layer.
- Use adapter subpaths only when you need a concrete store implementation.
