/**
 * Manifesto World Orchestrator
 *
 * The main entry point for the World Protocol, coordinating:
 * - Actor registration and authority bindings
 * - Proposal submission and lifecycle management
 * - Authority evaluation and decisions
 * - World lineage tracking
 * - Persistence and queries
 *
 * Per Intent & Projection Specification v1.0:
 * - submitProposal takes IntentInstance (not simple Intent)
 * - Authority decisions include approvedScope
 * - DecisionRecord includes approvedScope
 *
 * Per World SPEC v2.0.2 (ADR-001 Layer Separation):
 * - World MUST NOT depend on Host package
 * - Uses HostExecutor interface (hexagonal port)
 * - Outcome derived from snapshot, not Host result
 *
 * World Protocol operates above Core and Host:
 * | Layer   | Responsibility                    |
 * |---------|-----------------------------------|
 * | Core    | Computes semantic truth           |
 * | Host    | Executes effects, applies patches |
 * | World   | Governs legitimacy, lineage       |
 */
import type { Intent, Snapshot } from "@manifesto-ai/core";
import type {
  World,
  WorldId,
  Proposal,
  ProposalId,
  DecisionRecord,
  ActorRef,
  AuthorityRef,
  AuthorityPolicy,
  ProposalTrace,
  IntentInstance,
  IntentScope,
} from "./schema/index.js";
import { IntentInstance as IntentInstanceSchema, computeIntentKey } from "./schema/intent.js";
import { createProposalId, createDecisionId } from "./schema/world.js";
import { createApprovedDecision, createRejectedDecision } from "./schema/decision.js";
import {
  generateProposalId,
  createGenesisWorld,
  createWorldFromExecution,
  createDecisionRecord,
  toHostIntent,
} from "./factories.js";
import { ActorRegistry, createActorRegistry } from "./registry/index.js";
import { ProposalQueue, createProposalQueue } from "./proposal/index.js";
import { AuthorityEvaluator, createAuthorityEvaluator } from "./authority/index.js";
import type { HITLNotificationCallback, CustomConditionEvaluator } from "./authority/index.js";
import { WorldLineage, createWorldLineage } from "./lineage/index.js";
import { createMemoryWorldStore } from "./persistence/index.js";
import type { WorldStore } from "./persistence/index.js";
import { createWorldError, WorldError } from "./errors.js";
import type { WorldEvent, WorldEventSink } from "./events/index.js";
import { createNoopWorldEventSink } from "./events/index.js";
import type {
  HostExecutor,
  ExecutionKey,
  ExecutionKeyPolicy,
} from "./types/index.js";
import { defaultExecutionKeyPolicy } from "./types/index.js";
import type { IngressContext } from "./ingress/index.js";
import { createIngressContext } from "./ingress/index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Proposal submission result
 */
export interface ProposalResult {
  proposal: Proposal;
  decision?: DecisionRecord;
  resultWorld?: World;
  error?: WorldError;
}

/**
 * Configuration for ManifestoWorld
 *
 * Per ADR-001:
 * - Uses HostExecutor interface, not Host package directly
 * - App provides HostExecutor adapter implementation
 */
export interface ManifestoWorldConfig {
  /** Domain schema hash for computing worldId */
  schemaHash: string;

  /**
   * Optional executor for executing intents
   *
   * Per ADR-001: App implements HostExecutor adapter that wraps actual Host.
   * If not provided, execution is caller's responsibility.
   */
  executor?: HostExecutor;

  /** Optional custom store implementation */
  store?: WorldStore;

  /** Optional HITL callback for human decisions */
  onHITLRequired?: HITLNotificationCallback;

  /** Optional custom condition evaluators */
  customEvaluators?: Record<string, CustomConditionEvaluator>;

  /**
   * Optional World event sink (App-owned event/listener layer)
   *
   * World emits governance events; App handles subscriptions and scheduling.
   */
  eventSink?: WorldEventSink;

  /**
   * Optional execution key policy
   *
   * Default: `${proposalId}:1` (single attempt)
   */
  executionKeyPolicy?: ExecutionKeyPolicy;
}

// ============================================================================
// ManifestoWorld Class
// ============================================================================

/**
 * ManifestoWorld - The World Protocol Orchestrator
 *
 * Coordinates all World Protocol components to provide a unified API for:
 * - Registering actors and setting up authority bindings
 * - Submitting proposals and managing their lifecycle
 * - Evaluating authority and recording decisions
 * - Executing approved intents via HostExecutor
 * - Maintaining world lineage
 */
export class ManifestoWorld {
  private readonly _schemaHash: string;
  private readonly store: WorldStore;
  private readonly registry: ActorRegistry;
  private readonly proposalQueue: ProposalQueue;
  private readonly authorityEvaluator: AuthorityEvaluator;
  private readonly lineage: WorldLineage;
  private readonly executor?: HostExecutor;
  private readonly eventSink: WorldEventSink;
  private readonly executionKeyPolicy: ExecutionKeyPolicy;
  private readonly ingressContext: IngressContext;

  constructor(config: ManifestoWorldConfig) {
    this._schemaHash = config.schemaHash;
    this.store = config.store ?? createMemoryWorldStore();
    this.executor = config.executor;
    this.executionKeyPolicy = config.executionKeyPolicy ?? defaultExecutionKeyPolicy;

    // Initialize components
    this.registry = createActorRegistry();
    this.proposalQueue = createProposalQueue();
    this.lineage = createWorldLineage();
    this.eventSink = config.eventSink ?? createNoopWorldEventSink();
    this.ingressContext = createIngressContext();

    // Initialize authority evaluator and configure callbacks
    this.authorityEvaluator = createAuthorityEvaluator();

    // Set up HITL notification callback
    if (config.onHITLRequired) {
      this.authorityEvaluator.getHITLHandler().onPendingDecision(config.onHITLRequired);
    }

    // Register custom evaluators
    if (config.customEvaluators) {
      const policyHandler = this.authorityEvaluator.getPolicyHandler();
      for (const [name, evaluator] of Object.entries(config.customEvaluators)) {
        policyHandler.registerCustomEvaluator(name, evaluator);
      }
    }
  }

  /**
   * Get the schema hash used for computing worldId
   */
  get schemaHash(): string {
    return this._schemaHash;
  }

  // ==========================================================================
  // Outcome Derivation (OUTCOME-*)
  // ==========================================================================

  /**
   * Derive execution outcome from terminal snapshot
   *
   * Per OUTCOME-*:
   * - World MUST derive outcome from snapshot, not Host result
   * - 'failed' if lastError exists or pendingRequirements non-empty
   * - 'completed' otherwise
   */
  private deriveOutcome(snapshot: Snapshot): "completed" | "failed" {
    // Check for errors
    if (snapshot.system.lastError != null) {
      return "failed";
    }

    // Check for pending requirements (execution incomplete)
    if (
      snapshot.system.pendingRequirements &&
      snapshot.system.pendingRequirements.length > 0
    ) {
      return "failed";
    }

    return "completed";
  }

  /**
   * Emit a governance event to the App-owned event sink
   */
  private emitEvent(event: WorldEvent): void {
    this.eventSink.emit(event);
  }

  // ==========================================================================
  // Actor Management
  // ==========================================================================

  /**
   * Register an actor with an authority policy
   *
   */
  registerActor(actor: ActorRef, policy: AuthorityPolicy): void {
    // Create authority reference from policy
    const authority: AuthorityRef = {
      authorityId: `auth-${actor.actorId}`,
      kind: policy.mode === "auto_approve"
        ? "auto"
        : policy.mode === "hitl"
        ? "human"
        : policy.mode === "policy_rules"
        ? "policy"
        : "tribunal",
    };

    // Register with registry
    this.registry.register(actor, authority, policy);
  }

  /**
   * Update an actor's authority binding
   *
   */
  updateActorBinding(actorId: string, policy: AuthorityPolicy): void {

    const binding = this.registry.getBinding(actorId);
    if (!binding) {
      throw createWorldError(
        "ACTOR_NOT_REGISTERED",
        `Actor '${actorId}' is not registered`
      );
    }

    // Update authority kind if policy mode changed
    const newAuthority: AuthorityRef = {
      authorityId: binding.authority.authorityId,
      kind: policy.mode === "auto_approve"
        ? "auto"
        : policy.mode === "hitl"
        ? "human"
        : policy.mode === "policy_rules"
        ? "policy"
        : "tribunal",
    };

    this.registry.updateBinding(actorId, newAuthority, policy);
  }

  /**
   * Get actor binding
   */
  getActorBinding(actorId: string) {
    return this.registry.getBinding(actorId);
  }

  /**
   * Get all registered actors
   */
  getRegisteredActors(): ActorRef[] {
    return this.registry.listActors();
  }

  /**
   * Register a HITL pending callback
   *
   * App/observers can use this to surface human-in-the-loop decisions.
   */
  onHITLRequired(handler: HITLNotificationCallback): () => void {
    return this.authorityEvaluator.getHITLHandler().onPendingDecision(handler);
  }

  // ==========================================================================
  // Genesis
  // ==========================================================================

  /**
   * Create the genesis world
   */
  async createGenesis(initialSnapshot: Snapshot): Promise<World> {

    // Check if genesis already exists
    const existingGenesis = await this.store.getGenesis();
    if (existingGenesis) {
      throw createWorldError(
        "GENESIS_ALREADY_EXISTS",
        `Genesis world already exists: '${existingGenesis.worldId}'`
      );
    }

    // Create genesis world
    const world = await createGenesisWorld(this._schemaHash, initialSnapshot);

    // Save to store
    const saveResult = await this.store.saveWorld(world);
    if (!saveResult.success) {
      throw createWorldError("INTERNAL_ERROR", saveResult.error ?? "Failed to save genesis world");
    }

    // Save snapshot
    await this.store.saveSnapshot(world.worldId, initialSnapshot);

    // Set as genesis
    await this.store.setGenesis(world.worldId);

    // Add to lineage
    this.lineage.setGenesis(world);

    // Emit world:created event (genesis case)
    this.emitEvent({
      type: "world:created",
      timestamp: Date.now(),
      world,
      from: null,
      proposalId: null,
      outcome: "completed",
    });

    return world;
  }

  // ==========================================================================
  // Branch Management (EPOCH-*)
  // ==========================================================================

  /**
   * Switch to a new branch (base world)
   *
   * Per EPOCH-2~5:
   * - EPOCH-2: Increment epoch on branch switch
   * - EPOCH-3: Ingress-stage proposals with stale epoch MAY be dropped
   * - EPOCH-4: Late-arriving results for stale proposals MUST be discarded
   * - EPOCH-5: proposal:superseded event emitted for dropped proposals
   *
   * @param newBaseWorld - The new base world to switch to
   */
  async switchBranch(newBaseWorld: WorldId): Promise<void> {

    // Validate new base world exists
    const newWorld = await this.store.getWorld(newBaseWorld);
    if (!newWorld) {
      throw createWorldError(
        "WORLD_NOT_FOUND",
        `Cannot switch to non-existent world '${newBaseWorld}'`
      );
    }

    // EPOCH-2: Increment epoch
    this.ingressContext.incrementEpoch();
    const currentEpoch = this.ingressContext.epoch;

    // EPOCH-3: Drop ingress-stage proposals with stale epoch
    const ingressProposals = this.proposalQueue.getIngressStage();
    for (const proposal of ingressProposals) {
      if (this.ingressContext.isStale(proposal.epoch)) {
        // Drop proposal from active queue and store
        this.proposalQueue.remove(proposal.proposalId);
        const deleteResult = await this.store.deleteProposal(proposal.proposalId);
        if (!deleteResult.success) {
          throw createWorldError(
            "INTERNAL_ERROR",
            deleteResult.error ?? "Failed to delete stale proposal",
            { proposalId: proposal.proposalId }
          );
        }

        // EPOCH-5: Emit proposal:superseded event
        this.emitEvent({
          type: "proposal:superseded",
          timestamp: Date.now(),
          proposalId: proposal.proposalId,
          currentEpoch,
          proposalEpoch: proposal.epoch,
          reason: "branch_switch",
        });
      }
    }
  }

  /**
   * Get the current epoch
   *
   * Useful for checking if a proposal is stale.
   */
  get epoch(): number {
    return this.ingressContext.epoch;
  }

  // ==========================================================================
  // Proposal Flow
  // ==========================================================================

  /**
   * Submit a proposal for a change
   *
   * Per spec: submitProposal takes IntentInstance (not simple Intent)
   *
   * This is the main entry point for making changes to the world.
   * The proposal goes through:
   * 1. Actor validation
   * 2. Authority evaluation
   * 3. Decision recording (includes approvedScope)
   * 4. Execution via HostExecutor (if approved and executor configured)
   * 5. World creation
   */
  async submitProposal(
    actorId: string,
    intent: IntentInstance,
    baseWorld: WorldId,
    trace?: ProposalTrace
  ): Promise<ProposalResult> {
    // 1. Validate actor is registered
    const binding = this.registry.getBinding(actorId);
    if (!binding) {
      throw createWorldError(
        "ACTOR_NOT_REGISTERED",
        `Actor '${actorId}' is not registered`
      );
    }

    // 2. Validate base world exists
    const baseWorldEntity = await this.store.getWorld(baseWorld);
    if (!baseWorldEntity) {
      throw createWorldError(
        "WORLD_NOT_FOUND",
        `Base world '${baseWorld}' not found`
      );
    }

    // 2a. WORLD-BASE-* validation
    const baseSnapshot = await this.store.getSnapshot(baseWorld);
    if (baseSnapshot) {
      // WORLD-BASE-1: World with non-empty pendingRequirements MUST NOT be used as baseWorld
      if (
        baseSnapshot.system.pendingRequirements &&
        baseSnapshot.system.pendingRequirements.length > 0
      ) {
        throw createWorldError(
          "INVALID_BASE_WORLD",
          `Base world '${baseWorld}' has pending requirements and cannot be used as baseWorld (WORLD-BASE-1)`,
          { pendingCount: baseSnapshot.system.pendingRequirements.length }
        );
      }

      // WORLD-BASE-2/3: Warn if using a failed world (lastError exists)
      // Note: We don't throw here as it's NOT RECOMMENDED, not MUST NOT
      if (baseSnapshot.system.lastError != null) {
        console.warn(
          `Warning: Using failed world '${baseWorld}' as baseWorld is not recommended (WORLD-BASE-3)`
        );
      }
    }

    // 3. Validate intent instance + actor consistency
    const intentValidation = IntentInstanceSchema.safeParse(intent);
    if (!intentValidation.success) {
      throw createWorldError(
        "INVALID_ARGUMENT",
        "IntentInstance is invalid",
        { issues: intentValidation.error.issues }
      );
    }

    const originActor = intent.meta.origin.actor;
    if (originActor.actorId !== binding.actor.actorId || originActor.kind !== binding.actor.kind) {
      throw createWorldError(
        "INVALID_ARGUMENT",
        "Intent origin actor must match proposal actor",
        { originActor, proposalActor: binding.actor }
      );
    }

    const expectedIntentKey = await computeIntentKey(this._schemaHash, intent.body);
    if (expectedIntentKey !== intent.intentKey) {
      throw createWorldError(
        "INVALID_ARGUMENT",
        "IntentInstance intentKey does not match computed value",
        { expectedIntentKey, intentKey: intent.intentKey }
      );
    }

    // 4. Create proposal with executionKey (EPOCH-1, WORLD-EXK-1~2)
    const proposalId = generateProposalId();
    const executionKey = this.executionKeyPolicy({
      proposalId,
      actorId: binding.actor.actorId,
      baseWorld,
      attempt: 1,
    });
    const proposal = this.proposalQueue.submit(
      proposalId,
      executionKey,
      binding.actor,
      intent,
      baseWorld,
      trace,
      this.ingressContext.epoch
    );

    // 5. Emit proposal:submitted event
    this.emitEvent({
      type: "proposal:submitted",
      timestamp: Date.now(),
      proposalId: proposal.proposalId,
      actorId: binding.actor.actorId,
      baseWorld,
      intent: toHostIntent(intent),
      executionKey: proposal.executionKey,
      epoch: proposal.epoch,
    });

    // 6. Save to store
    await this.store.saveProposal(proposal);

    // 7. Transition to evaluating and emit proposal:evaluating
    const evaluatingProposal = this.proposalQueue.transition(proposal.proposalId, "evaluating");
    await this.store.updateProposal(proposal.proposalId, { status: "evaluating" });

    this.emitEvent({
      type: "proposal:evaluating",
      timestamp: Date.now(),
      proposalId: proposal.proposalId,
      authorityId: binding.authority.authorityId,
    });

    // 8. Check if this is a blocking authority (HITL/tribunal)
    const isBlocking = binding.policy.mode === "hitl" || binding.policy.mode === "tribunal";
    if (isBlocking) {
      // Start async evaluation (will block on HITL promise internally)
      this.authorityEvaluator.evaluate(evaluatingProposal, binding).catch(() => {
        // Errors handled by the handler
      });

      return { proposal: evaluatingProposal };
    }

    // 9. For non-blocking authorities, evaluate synchronously
    const evaluationResult = await this.authorityEvaluator.evaluate(
      evaluatingProposal,
      binding
    );

    // 10. Handle evaluation result (pending should not create DecisionRecord)
    if (evaluationResult.kind === "pending") {
      return { proposal: evaluatingProposal };
    }

    if (this.ingressContext.isStale(evaluatingProposal.epoch)) {
      return {
        proposal: evaluatingProposal,
        error: createWorldError(
          "INVALID_ARGUMENT",
          "Proposal is stale for current epoch",
          {
            proposalId: evaluatingProposal.proposalId,
            proposalEpoch: evaluatingProposal.epoch,
            currentEpoch: this.ingressContext.epoch,
          }
        ),
      };
    }

    // 11. Record terminal decision with approvedScope
    const isApproved = evaluationResult.kind === "approved";
    const reason = evaluationResult.kind === "rejected" ? evaluationResult.reason : undefined;
    const approvedScope = isApproved
      ? (evaluationResult.approvedScope !== undefined
        ? evaluationResult.approvedScope
        : evaluatingProposal.intent.body.scopeProposal ?? null)
      : undefined;

    const decision = createDecisionRecord(
      evaluatingProposal.proposalId,
      binding.authority,
      isApproved ? createApprovedDecision() : createRejectedDecision(reason ?? "Rejected"),
      approvedScope,
      reason
    );

    await this.store.saveDecision(decision);

    // Emit proposal:decided event
    this.emitEvent({
      type: "proposal:decided",
      timestamp: Date.now(),
      proposalId: evaluatingProposal.proposalId,
      decisionId: decision.decisionId,
      decision: isApproved ? "approved" : "rejected",
      authorityId: binding.authority.authorityId,
      reason,
    });

    // 12. Update proposal with decision and approvedScope
    const newStatus = isApproved ? "approved" : "rejected";

    this.proposalQueue.transition(evaluatingProposal.proposalId, newStatus, {
      decisionId: decision.decisionId,
      decidedAt: decision.decidedAt,
      approvedScope: approvedScope,
    });
    await this.store.updateProposal(evaluatingProposal.proposalId, {
      status: newStatus,
      decisionId: decision.decisionId,
      decidedAt: decision.decidedAt,
      approvedScope: approvedScope,
    });

    // 13. If rejected, we're done
    if (!isApproved) {
      const updatedProposal = this.proposalQueue.get(evaluatingProposal.proposalId);
      return {
        proposal: updatedProposal!,
        decision,
      };
    }

    // 14. Execute if executor is configured
    if (this.executor) {
      return this.executeProposal(evaluatingProposal.proposalId, decision);
    }

    // 15. If no executor, return approved proposal (execution is caller's responsibility)
    const updatedProposal = this.proposalQueue.get(evaluatingProposal.proposalId);
    return {
      proposal: updatedProposal!,
      decision,
    };
  }

  /**
   * Process a HITL decision
   *
   * @param proposalId - The proposal to decide
   * @param decision - The decision (approved or rejected)
   * @param reasoning - Optional reasoning
   * @param approvedScope - Optional approved scope (only for approved decisions)
   *                        If undefined, uses scopeProposal from the proposal
   */
  async processHITLDecision(
    proposalId: string,
    decision: "approved" | "rejected",
    reasoning?: string,
    approvedScope?: IntentScope | null
  ): Promise<ProposalResult> {

    const pid = createProposalId(proposalId);
    const proposal = this.proposalQueue.get(pid);

    if (!proposal) {
      throw createWorldError("PROPOSAL_NOT_FOUND", `Proposal '${proposalId}' not found`);
    }

    if (proposal.status !== "evaluating") {
      throw createWorldError(
        "HITL_NOT_PENDING",
        `Proposal '${proposalId}' is not evaluating HITL decision (status: ${proposal.status})`
      );
    }

    if (this.ingressContext.isStale(proposal.epoch)) {
      return {
        proposal,
        error: createWorldError(
          "INVALID_ARGUMENT",
          "Proposal is stale for current epoch",
          {
            proposalId: proposal.proposalId,
            proposalEpoch: proposal.epoch,
            currentEpoch: this.ingressContext.epoch,
          }
        ),
      };
    }

    // Get binding
    const binding = this.registry.getBinding(proposal.actor.actorId);
    if (!binding) {
      throw createWorldError(
        "ACTOR_NOT_REGISTERED",
        `Actor '${proposal.actor.actorId}' is not registered`
      );
    }

    // Determine the approved scope
    // If approved and no explicit scope provided, use scopeProposal from intent
    const finalApprovedScope = decision === "approved"
      ? (approvedScope !== undefined ? approvedScope : proposal.intent.body.scopeProposal ?? null)
      : undefined;

    // Submit decision to HITL handler (this will resolve the pending promise)
    this.authorityEvaluator.submitHITLDecision(proposalId, decision, reasoning, finalApprovedScope);

    // Create decision record with approvedScope
    const finalDecision = decision === "approved"
      ? createApprovedDecision()
      : createRejectedDecision(reasoning ?? "Rejected by human reviewer");

    const decisionRecord = createDecisionRecord(
      pid,
      binding.authority,
      finalDecision,
      finalApprovedScope,
      reasoning
    );

    await this.store.saveDecision(decisionRecord);

    // Emit proposal:decided event (final decision after HITL)
    this.emitEvent({
      type: "proposal:decided",
      timestamp: Date.now(),
      proposalId: pid,
      decisionId: decisionRecord.decisionId,
      decision: decision,
      authorityId: binding.authority.authorityId,
      reason: reasoning,
    });

    // Update proposal
    const newStatus = decision === "approved" ? "approved" : "rejected";
    this.proposalQueue.transition(pid, newStatus, {
      decisionId: decisionRecord.decisionId,
      decidedAt: decisionRecord.decidedAt,
      approvedScope: finalApprovedScope,
    });
    await this.store.updateProposal(pid, {
      status: newStatus,
      decisionId: decisionRecord.decisionId,
      decidedAt: decisionRecord.decidedAt,
      approvedScope: finalApprovedScope,
    });

    // If rejected, we're done
    if (decision === "rejected") {
      const updatedProposal = this.proposalQueue.get(pid);
      return {
        proposal: updatedProposal!,
        decision: decisionRecord,
      };
    }

    // Execute if approved and executor configured
    if (this.executor) {
      return this.executeProposal(pid, decisionRecord);
    }

    const updatedProposal = this.proposalQueue.get(pid);
    return {
      proposal: updatedProposal!,
      decision: decisionRecord,
    };
  }

  /**
   * Execute an approved proposal
   *
   * Per ADR-001:
   * - Uses HostExecutor interface (not Host directly)
   * - Derives outcome from snapshot (not Host result)
   * - Emits only terminal events (not telemetry)
   */
  private async executeProposal(
    proposalId: ProposalId,
    decision: DecisionRecord
  ): Promise<ProposalResult> {
    if (!this.executor) {
      throw createWorldError("EXECUTOR_NOT_CONFIGURED", "Executor is not configured for execution");
    }

    const proposal = this.proposalQueue.get(proposalId);
    if (!proposal) {
      throw createWorldError("PROPOSAL_NOT_FOUND", `Proposal '${proposalId}' not found`);
    }

    // Get base snapshot
    const baseSnapshot = await this.store.getSnapshot(proposal.baseWorld);
    if (!baseSnapshot) {
      throw createWorldError("SNAPSHOT_NOT_FOUND", `Snapshot for base world '${proposal.baseWorld}' not found`);
    }

    // Use fixed execution key from proposal
    const executionKey: ExecutionKey = proposal.executionKey;

    // Transition to executing
    this.proposalQueue.transition(proposalId, "executing");
    await this.store.updateProposal(proposalId, {
      status: "executing",
    });

    try {
      // Per spec: Extract type, input, intentId from IntentInstance for Host
      const intent: Intent = toHostIntent(proposal.intent);

      // Execute via HostExecutor
      const result = await this.executor.execute(
        executionKey,
        baseSnapshot,
        intent,
        {
          approvedScope: proposal.approvedScope,
        }
      );

      // Derive outcome from terminal snapshot (OUTCOME-*)
      const derivedOutcome = this.deriveOutcome(result.terminalSnapshot);

      // Create new world (attach trace ref if provided)
      const createdWorld = await createWorldFromExecution(
        this._schemaHash,
        result.terminalSnapshot,
        proposalId
      );
      const newWorld = result.traceRef
        ? { ...createdWorld, executionTraceRef: result.traceRef }
        : createdWorld;

      // Check if world already exists (content-addressable: same data = same worldId)
      const existingWorld = await this.store.getWorld(newWorld.worldId);
      let forked = false;

      if (existingWorld) {
        // World already exists - this is valid for content-addressable systems
        await this.store.saveSnapshot(newWorld.worldId, result.terminalSnapshot);
      } else {
        // New world - save everything
        await this.store.saveWorld(newWorld);
        await this.store.saveSnapshot(newWorld.worldId, result.terminalSnapshot);

        // Add to lineage
        forked = this.lineage.hasChildren(proposal.baseWorld);
        this.lineage.addWorldWithEdge(
          newWorld,
          proposal.baseWorld,
          proposalId,
          decision.decisionId
        );

        // Save edge to store
        const parentEdge = this.lineage.getParentEdge(newWorld.worldId);
        if (parentEdge) {
          await this.store.saveEdge(parentEdge);
        }
      }

      // Determine final status from derived outcome
      const finalStatus = derivedOutcome === "completed" ? "completed" : "failed";

      // Emit world:created (governance result)
      this.emitEvent({
        type: "world:created",
        timestamp: Date.now(),
        world: newWorld,
        from: proposal.baseWorld,
        proposalId,
        outcome: finalStatus,
      });

      if (forked) {
        this.emitEvent({
          type: "world:forked",
          timestamp: Date.now(),
          parentWorldId: proposal.baseWorld,
          childWorldId: newWorld.worldId,
          proposalId,
        });
      }

      // Emit terminal event (outcome, not telemetry)
      if (finalStatus === "completed") {
        this.emitEvent({
          type: "execution:completed",
          timestamp: Date.now(),
          proposalId,
          executionKey,
          resultWorld: newWorld.worldId,
        });
      } else {
        const pendingIds = result.terminalSnapshot.system.pendingRequirements?.map(
          (req) => req.id
        ) ?? [];
        const errorDetails = result.terminalSnapshot.system.errors ?? [];
        const summary =
          result.error?.message ??
          result.terminalSnapshot.system.lastError?.message ??
          "Execution failed";

        this.emitEvent({
          type: "execution:failed",
          timestamp: Date.now(),
          proposalId,
          executionKey,
          error: {
            summary,
            details: errorDetails,
            pendingRequirements: pendingIds.length > 0 ? pendingIds : undefined,
          },
          resultWorld: newWorld.worldId,
        });
      }

      // Update proposal
      this.proposalQueue.transition(proposalId, finalStatus, {
        resultWorld: newWorld.worldId,
        completedAt: Date.now(),
      });
      await this.store.updateProposal(proposalId, {
        status: finalStatus,
        resultWorld: newWorld.worldId,
        completedAt: Date.now(),
      });

      const updatedProposal = this.proposalQueue.get(proposalId);
      return {
        proposal: updatedProposal!,
        decision,
        resultWorld: newWorld,
      };
    } catch (error) {
      const terminalSnapshot = baseSnapshot;
      const failedWorld = await createWorldFromExecution(
        this._schemaHash,
        terminalSnapshot,
        proposalId
      );

      const existingWorld = await this.store.getWorld(failedWorld.worldId);
      let forked = false;

      if (existingWorld) {
        await this.store.saveSnapshot(failedWorld.worldId, terminalSnapshot);
      } else {
        await this.store.saveWorld(failedWorld);
        await this.store.saveSnapshot(failedWorld.worldId, terminalSnapshot);

        forked = this.lineage.hasChildren(proposal.baseWorld);
        this.lineage.addWorldWithEdge(
          failedWorld,
          proposal.baseWorld,
          proposalId,
          decision.decisionId
        );

        const parentEdge = this.lineage.getParentEdge(failedWorld.worldId);
        if (parentEdge) {
          await this.store.saveEdge(parentEdge);
        }
      }

      // Emit world:created before execution:failed (WORLD-EXEC-EVT-3)
      this.emitEvent({
        type: "world:created",
        timestamp: Date.now(),
        world: failedWorld,
        from: proposal.baseWorld,
        proposalId,
        outcome: "failed",
      });

      if (forked) {
        this.emitEvent({
          type: "world:forked",
          timestamp: Date.now(),
          parentWorldId: proposal.baseWorld,
          childWorldId: failedWorld.worldId,
          proposalId,
        });
      }

      const pendingIds = terminalSnapshot.system.pendingRequirements?.map(
        (req) => req.id
      ) ?? [];
      const errorDetails = terminalSnapshot.system.errors ?? [];
      const summary = error instanceof Error ? error.message : String(error);

      // Emit execution:failed for infrastructure errors
      this.emitEvent({
        type: "execution:failed",
        timestamp: Date.now(),
        proposalId,
        executionKey,
        error: {
          summary,
          details: errorDetails,
          pendingRequirements: pendingIds.length > 0 ? pendingIds : undefined,
        },
        resultWorld: failedWorld.worldId,
      });

      // Transition to failed
      this.proposalQueue.transition(proposalId, "failed", {
        resultWorld: failedWorld.worldId,
        completedAt: Date.now(),
      });
      await this.store.updateProposal(proposalId, {
        status: "failed",
        resultWorld: failedWorld.worldId,
        completedAt: Date.now(),
      });

      const updatedProposal = this.proposalQueue.get(proposalId);
      return {
        proposal: updatedProposal!,
        decision,
        error: error instanceof WorldError
          ? error
          : createWorldError("EXECUTOR_ERROR", String(error)),
      };
    }
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get a world by ID
   */
  async getWorld(worldId: WorldId): Promise<World | null> {
    return this.store.getWorld(worldId);
  }

  /**
   * Get the snapshot for a world
   */
  async getSnapshot(worldId: WorldId): Promise<Snapshot | null> {
    return this.store.getSnapshot(worldId);
  }

  /**
   * Get the genesis world
   */
  async getGenesis(): Promise<World | null> {
    return this.store.getGenesis();
  }

  /**
   * Get a proposal by ID
   */
  async getProposal(proposalId: string): Promise<Proposal | null> {
    return this.store.getProposal(createProposalId(proposalId));
  }

  /**
   * Get evaluating proposals
   */
  async getEvaluatingProposals(): Promise<Proposal[]> {
    return this.store.getEvaluatingProposals();
  }

  /**
   * Get a decision by ID
   */
  async getDecision(decisionId: string): Promise<DecisionRecord | null> {
    return this.store.getDecision(createDecisionId(decisionId));
  }

  /**
   * Get the decision for a proposal
   */
  async getDecisionByProposal(proposalId: string): Promise<DecisionRecord | null> {
    return this.store.getDecisionByProposal(createProposalId(proposalId));
  }

  /**
   * Get the world lineage
   */
  getLineage(): WorldLineage {
    return this.lineage;
  }

  /**
   * Get store for advanced queries
   */
  getStore(): WorldStore {
    return this.store;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new ManifestoWorld instance
 */
export function createManifestoWorld(config: ManifestoWorldConfig): ManifestoWorld {
  return new ManifestoWorld(config);
}
