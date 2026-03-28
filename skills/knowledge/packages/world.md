# @manifesto-ai/world

> Current monolithic World Protocol implementation in this repo.

## Role

In the current codebase, `@manifesto-ai/world` is the active implementation target for:

- actor registration and authority bindings
- proposal submission and lifecycle
- authority evaluation, including HITL and policy rules
- lineage DAG helpers
- world persistence interfaces and in-memory storage
- governance event emission
- `HostExecutor` boundary definition

Future split docs for `@manifesto-ai/governance` and `@manifesto-ai/lineage` exist, but those packages are not implemented as code in this repo yet.

## Dependencies

- `uuid`
- Peer: `@manifesto-ai/core`

## Public API

### `createManifestoWorld(config): ManifestoWorld`

```typescript
interface ManifestoWorldConfig {
  schemaHash: string;
  executor?: HostExecutor;
  store?: WorldStore;
  onHITLRequired?: HITLNotificationCallback;
  customEvaluators?: Record<string, CustomConditionEvaluator>;
  eventSink?: WorldEventSink;
  executionKeyPolicy?: ExecutionKeyPolicy;
}
```

### `ManifestoWorld`

```typescript
class ManifestoWorld {
  registerActor(actor: ActorRef, policy: AuthorityPolicy): void;
  updateActorBinding(actorId: string, policy: AuthorityPolicy): void;
  getActorBinding(actorId: string): ActorAuthorityBinding | null;
  getRegisteredActors(): ActorRef[];
  onHITLRequired(handler: HITLNotificationCallback): () => void;

  createGenesis(initialSnapshot: Snapshot): Promise<World>;
  switchBranch(newBaseWorld: WorldId): Promise<void>;
  get epoch(): number;

  submitProposal(
    actorId: string,
    intent: IntentInstance,
    baseWorld: WorldId,
    trace?: ProposalTrace,
  ): Promise<ProposalResult>;

  processHITLDecision(
    proposalId: string,
    decision: "approved" | "rejected",
    reasoning?: string,
    approvedScope?: IntentScope | null,
  ): Promise<ProposalResult>;

  getWorld(worldId: WorldId): Promise<World | null>;
  getSnapshot(worldId: WorldId): Promise<Snapshot | null>;
  getGenesis(): Promise<World | null>;
  getProposal(proposalId: string): Promise<Proposal | null>;
  getEvaluatingProposals(): Promise<Proposal[]>;
  getDecision(decisionId: string): Promise<DecisionRecord | null>;
  getDecisionByProposal(proposalId: string): Promise<DecisionRecord | null>;
  getLineage(): WorldLineage;
}
```

### `ProposalResult`

```typescript
type ProposalResult = {
  proposal: Proposal;
  decision?: DecisionRecord;
  resultWorld?: World;
  error?: WorldError;
};
```

### `HostExecutor`

World defines its own execution seam and does not import `@manifesto-ai/host` directly:

```typescript
interface HostExecutor {
  execute(
    key: ExecutionKey,
    baseSnapshot: Snapshot,
    intent: Intent,
    opts?: HostExecutionOptions,
  ): Promise<HostExecutionResult>;

  abort?(key: ExecutionKey): void;
}
```

## Stores, Helpers, and Re-exports

Key currently implemented exports include:

- `WorldStore`, `createMemoryWorldStore`
- `createExecutionKey`, `defaultExecutionKeyPolicy`
- actor registry helpers
- proposal queue helpers
- authority handlers and evaluator
- lineage helpers
- world event types and `createNoopWorldEventSink`
- factories such as `createGenesisWorld`, `createWorldFromExecution`, `createIntentInstance`

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

## Current vs Future Structure

- **Current code target**: `@manifesto-ai/world`
- **Future design references**: `@manifesto-ai/governance`, `@manifesto-ai/lineage`, `world-facade-spec-v1.0.0`

If you are changing code in this repo today, start from `packages/world/src/index.ts` and `packages/world/src/world.ts`.
