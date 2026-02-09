# @manifesto-ai/world v2.3.0

> Governance, Authority, and Lineage layer. World Protocol.

## Role

World governs: proposals, authority evaluation, decision recording, lineage DAG. MUST NOT execute effects, apply patches, or compute transitions.

## Dependencies

- `uuid` ^13.0.0
- Peer: `@manifesto-ai/core` ^2.0.0

## Public API

### `createManifestoWorld(config): ManifestoWorld`

```typescript
interface ManifestoWorldConfig {
  schemaHash: string;                              // Required
  executor?: HostExecutor;                         // Optional — set by App
  store?: WorldStore;                              // Optional — default: in-memory
  onHITLRequired?: HITLNotificationCallback;       // Optional
  customEvaluators?: Record<string, CustomConditionEvaluator>; // Optional
  eventSink?: WorldEventSink;                      // Optional
  executionKeyPolicy?: ExecutionKeyPolicy;         // Optional
}
```

### ManifestoWorld (class)

```typescript
class ManifestoWorld {
  // Actor management
  registerActor(actor, authority, policy): void;
  getActorBinding(actorId): ActorBinding | null;

  // Genesis
  createGenesis(initialSnapshot): Promise<World>;

  // Proposals (core governance flow)
  submitProposal(actorId, intent, baseWorld, trace?): Promise<ProposalResult>;

  // HITL (human-in-the-loop)
  processHITLDecision(proposalId, decision, reasoning?, scope?): Promise<ProposalResult>;

  // Queries
  getWorld(): World | null;
  getSnapshot(): Snapshot | null;
  getProposal(id): Proposal | undefined;
  getLineage(): WorldLineage;

  // Branch switching
  switchBranch(newBaseWorld): Promise<void>;
  get epoch(): number;
}
```

## Key Types

### World (Content-Addressable)

```typescript
type World = {
  worldId: WorldId;          // hash(schemaHash, snapshotHash) — deterministic
  schemaHash: string;
  snapshotHash: string;
  createdAt: number;
  createdBy: ProposalId | null;  // null for genesis
};
```

### Proposal Lifecycle

```
submitted → evaluating → approved → executing → completed
                       → rejected
                                                → failed
```

### Authority Modes & Handlers

```typescript
createAutoApproveHandler(): AutoApproveHandler         // Always approves
createHITLHandler(callback): HITLHandler               // Blocks for human decision
createPolicyRulesHandler(rules): PolicyRulesHandler     // Custom condition evaluators
createTribunalHandler(config): TribunalHandler          // Multiple reviewers
createAuthorityEvaluator(): AuthorityEvaluator          // Orchestrates above
```

### ProposalResult

```typescript
type ProposalResult = {
  proposal: Proposal;
  decision?: DecisionRecord;
  resultWorld?: World;
  error?: WorldError;
};
```

### Hexagonal Port

World uses `HostExecutor` interface (implemented by App) to execute approved intents. World never imports Host directly.

```typescript
interface HostExecutor {
  execute(executionKey, baseSnapshot, intent, options): Promise<HostExecutionResult>;
}
```

## Factories

```typescript
createProposal(actorId, intent, baseWorldId): Proposal
createDecisionRecord(proposalId, verdict, reasoning?): DecisionRecord
createGenesisWorld(schemaHash, snapshotHash): World
createWorldFromExecution(schemaHash, snapshotHash, proposalId): World
createIntentInstance(type, input?, intentId?): Promise<IntentInstance>
createIntentInstanceSync(type, input?, intentId?): IntentInstance
computeSnapshotHash(snapshot): string
computeWorldId(schemaHash, snapshotHash): WorldId
```

## Lineage & Storage

```typescript
createWorldLineage(): WorldLineage
createMemoryWorldStore(): MemoryWorldStore    // In-memory default
createActorRegistry(): ActorRegistry
createProposalQueue(): ProposalQueue
```

## Events

`ProposalSubmittedEvent`, `ProposalEvaluatingEvent`, `ProposalDecidedEvent`, `ProposalSupersededEvent`, `ExecutionCompletedEvent`, `ExecutionFailedEvent`, `WorldCreatedEvent`, `WorldForkedEvent`

## Design Principles

- **Content-addressable**: WorldId = hash(schemaHash, snapshotHash)
- **Immutable**: Worlds never mutate after creation
- **Accountability**: Every change → Proposal → Decision → World lineage
- **Epoch-based branching**: Ingress proposals dropped on branch switch
