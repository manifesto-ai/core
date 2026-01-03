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
 * World Protocol operates above Core and Host:
 * | Layer   | Responsibility                    |
 * |---------|-----------------------------------|
 * | Core    | Computes semantic truth           |
 * | Host    | Executes effects, applies patches |
 * | World   | Governs legitimacy, lineage       |
 */
import type { Intent, Snapshot, TraceGraph } from "@manifesto-ai/core";
import type { HostLoopOptions } from "@manifesto-ai/host";
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
import { isApprovedDecision, createApprovedDecision, createRejectedDecision } from "./schema/decision.js";
import {
  createGenesisWorld,
  createWorldFromExecution,
  createDecisionRecord,
} from "./factories.js";
import { ActorRegistry, createActorRegistry } from "./registry/index.js";
import { ProposalQueue, createProposalQueue } from "./proposal/index.js";
import { AuthorityEvaluator, createAuthorityEvaluator } from "./authority/index.js";
import type { HITLNotificationCallback, CustomConditionEvaluator } from "./authority/index.js";
import { WorldLineage, createWorldLineage } from "./lineage/index.js";
import { createMemoryWorldStore } from "./persistence/index.js";
import type { WorldStore } from "./persistence/index.js";
import { createWorldError, WorldError } from "./errors.js";
import {
  WorldEventBus,
  createWorldEventBus,
  createHostExecutionListener,
  type WorldEventHandler,
  type WorldEventType,
  type Unsubscribe,
} from "./events/index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Host interface - minimal contract for executing intents
 *
 * Note: Host receives simple Intent (type, input, intentId), not IntentInstance
 */
export interface HostInterface {
  /**
   * Execute an intent and return the result snapshot
   *
   * @param intent - The intent to execute
   * @param loopOptions - Optional loop options for event callbacks
   */
  dispatch(intent: Intent, loopOptions?: Partial<HostLoopOptions>): Promise<HostResult>;
}

/**
 * Host execution result
 */
export interface HostResult {
  status: "complete" | "halted" | "error";
  snapshot: Snapshot;
  traces?: TraceGraph[];
  error?: unknown;
}

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
 */
export interface ManifestoWorldConfig {
  /** Domain schema for computing worldId */
  schemaHash: string;

  /** Optional host for executing intents */
  host?: HostInterface;

  /** Optional custom store implementation */
  store?: WorldStore;

  /** Optional HITL callback for human decisions */
  onHITLRequired?: HITLNotificationCallback;

  /** Optional custom condition evaluators */
  customEvaluators?: Record<string, CustomConditionEvaluator>;
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
 * - Executing approved intents via Host
 * - Maintaining world lineage
 */
export class ManifestoWorld {
  private readonly _schemaHash: string;
  private readonly store: WorldStore;
  private readonly registry: ActorRegistry;
  private readonly proposalQueue: ProposalQueue;
  private readonly authorityEvaluator: AuthorityEvaluator;
  private readonly lineage: WorldLineage;
  private readonly host?: HostInterface;
  private readonly eventBus: WorldEventBus;

  constructor(config: ManifestoWorldConfig) {
    this._schemaHash = config.schemaHash;
    this.store = config.store ?? createMemoryWorldStore();
    this.host = config.host;

    // Initialize components
    this.registry = createActorRegistry();
    this.proposalQueue = createProposalQueue();
    this.lineage = createWorldLineage();
    this.eventBus = createWorldEventBus();

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
  // Event Subscription (World Protocol Event System v1.1)
  // ==========================================================================

  /**
   * Subscribe to world events.
   *
   * @param handler - Callback invoked for each event
   * @returns Unsubscribe function
   *
   * Events are delivered synchronously in causal order.
   * Handler MUST NOT throw; exceptions are logged and ignored.
   * Handler MUST NOT modify world state.
   */
  subscribe(handler: WorldEventHandler): Unsubscribe;

  /**
   * Subscribe to specific event types.
   *
   * @param types - Event types to subscribe to
   * @param handler - Callback invoked for matching events
   * @returns Unsubscribe function
   */
  subscribe(types: WorldEventType[], handler: WorldEventHandler): Unsubscribe;

  subscribe(
    typesOrHandler: WorldEventType[] | WorldEventHandler,
    maybeHandler?: WorldEventHandler
  ): Unsubscribe {
    if (typeof typesOrHandler === "function") {
      return this.eventBus.subscribe(typesOrHandler);
    }
    return this.eventBus.subscribe(typesOrHandler, maybeHandler!);
  }

  // ==========================================================================
  // Actor Management
  // ==========================================================================

  /**
   * Register an actor with an authority policy
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
    this.eventBus.emit({
      type: "world:created",
      timestamp: Date.now(),
      world,
      proposalId: null, // Genesis has no proposal
      parentWorldId: null, // Genesis has no parent
    });

    return world;
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
   * 4. Host execution (if approved and host configured)
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

    // 4. Create proposal using queue's submit method
    const proposal = this.proposalQueue.submit(binding.actor, intent, baseWorld, trace);

    // 5. Emit proposal:submitted event
    this.eventBus.emit({
      type: "proposal:submitted",
      timestamp: Date.now(),
      proposal,
      actor: binding.actor,
    });

    // 6. Save to store
    await this.store.saveProposal(proposal);

    // 7. Check if this is a blocking authority (HITL/tribunal)
    const isBlocking = binding.policy.mode === "hitl" || binding.policy.mode === "tribunal";

    // Emit proposal:evaluating event
    this.eventBus.emit({
      type: "proposal:evaluating",
      timestamp: Date.now(),
      proposalId: proposal.proposalId,
      authorityId: binding.authority.authorityId,
    });

    if (isBlocking) {
      // For HITL/tribunal, don't await - transition to pending and return
      this.proposalQueue.transition(proposal.proposalId, "pending");
      await this.store.updateProposal(proposal.proposalId, { status: "pending" });

      // Emit proposal:decided with pending (will be resolved later via processHITLDecision)
      this.eventBus.emit({
        type: "proposal:decided",
        timestamp: Date.now(),
        proposalId: proposal.proposalId,
        authorityId: binding.authority.authorityId,
        decision: "pending",
      });

      // Start async evaluation (will block on HITL promise internally)
      this.authorityEvaluator.evaluate(proposal, binding).catch(() => {
        // Errors handled by the handler
      });

      const updatedProposal = this.proposalQueue.get(proposal.proposalId);
      return { proposal: updatedProposal! };
    }

    // 8. For non-blocking authorities, evaluate synchronously
    const evaluationResult = await this.authorityEvaluator.evaluate(proposal, binding);

    // 9. Handle evaluation result
    if (evaluationResult.kind === "pending") {
      // Shouldn't happen for non-blocking, but handle anyway
      this.proposalQueue.transition(proposal.proposalId, "pending");
      await this.store.updateProposal(proposal.proposalId, { status: "pending" });

      // Emit proposal:decided with pending
      this.eventBus.emit({
        type: "proposal:decided",
        timestamp: Date.now(),
        proposalId: proposal.proposalId,
        authorityId: binding.authority.authorityId,
        decision: "pending",
      });

      const updatedProposal = this.proposalQueue.get(proposal.proposalId);
      return { proposal: updatedProposal! };
    }

    // 10. Record terminal decision with approvedScope
    const isApproved = evaluationResult.kind === "approved";
    const reason = evaluationResult.kind === "rejected" ? evaluationResult.reason : undefined;
    const approvedScope = isApproved
      ? (evaluationResult.approvedScope !== undefined
        ? evaluationResult.approvedScope
        : proposal.intent.body.scopeProposal ?? null)
      : undefined;

    const decision = createDecisionRecord(
      proposal.proposalId,
      binding.authority,
      isApproved ? createApprovedDecision() : createRejectedDecision(reason ?? "Rejected"),
      approvedScope,
      reason
    );

    await this.store.saveDecision(decision);

    // Emit proposal:decided event
    this.eventBus.emit({
      type: "proposal:decided",
      timestamp: Date.now(),
      proposalId: proposal.proposalId,
      authorityId: binding.authority.authorityId,
      decision: isApproved ? "approved" : "rejected",
      decisionRecord: decision,
    });

    // 11. Update proposal with decision and approvedScope
    const newStatus = isApproved ? "approved" : "rejected";

    this.proposalQueue.transition(proposal.proposalId, newStatus, {
      decisionId: decision.decisionId,
      decidedAt: decision.decidedAt,
      approvedScope: approvedScope,
    });
    await this.store.updateProposal(proposal.proposalId, {
      status: newStatus,
      decisionId: decision.decisionId,
      decidedAt: decision.decidedAt,
      approvedScope: approvedScope,
    });

    // 12. If rejected, we're done
    if (!isApproved) {
      const updatedProposal = this.proposalQueue.get(proposal.proposalId);
      return {
        proposal: updatedProposal!,
        decision,
      };
    }

    // 13. Execute if host is configured
    if (this.host) {
      return this.executeProposal(proposal.proposalId, decision);
    }

    // 14. If no host, return approved proposal (execution is caller's responsibility)
    const updatedProposal = this.proposalQueue.get(proposal.proposalId);
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

    if (proposal.status !== "pending") {
      throw createWorldError(
        "HITL_NOT_PENDING",
        `Proposal '${proposalId}' is not pending HITL decision (status: ${proposal.status})`
      );
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
    this.eventBus.emit({
      type: "proposal:decided",
      timestamp: Date.now(),
      proposalId: pid,
      authorityId: binding.authority.authorityId,
      decision: decision,
      decisionRecord: decisionRecord,
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

    // Execute if approved and host configured
    if (this.host) {
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
   */
  private async executeProposal(
    proposalId: ProposalId,
    decision: DecisionRecord
  ): Promise<ProposalResult> {
    if (!this.host) {
      throw createWorldError("HOST_NOT_CONFIGURED", "Host is not configured for execution");
    }

    const proposal = this.proposalQueue.get(proposalId);
    if (!proposal) {
      throw createWorldError("PROPOSAL_NOT_FOUND", `Proposal '${proposalId}' not found`);
    }

    // Get base snapshot for execution:started event
    const baseSnapshot = await this.store.getSnapshot(proposal.baseWorld);
    if (!baseSnapshot) {
      throw createWorldError("SNAPSHOT_NOT_FOUND", `Snapshot for base world '${proposal.baseWorld}' not found`);
    }

    // Transition to executing
    this.proposalQueue.transition(proposalId, "executing");
    await this.store.updateProposal(proposalId, { status: "executing" });

    // Emit execution:started event
    this.eventBus.emit({
      type: "execution:started",
      timestamp: Date.now(),
      proposalId,
      intentId: proposal.intent.intentId,
      baseSnapshot,
    });

    // Create execution listener for Host callbacks
    const executionListener = createHostExecutionListener(
      this.eventBus,
      proposalId,
      proposal.intent.intentId
    );

    try {
      // Per spec: Extract type, input, intentId from IntentInstance for Host
      // Host receives simple Intent format, not IntentInstance
      const intent: Intent = {
        type: proposal.intent.body.type,
        input: proposal.intent.body.input,
        intentId: proposal.intent.intentId,
      };

      // Execute via host with execution listener callbacks
      const result = await this.host.dispatch(intent, {
        ...executionListener.options,
        approvedScope: proposal.approvedScope,
      });

      // Get execution stats from listener
      const listenerState = executionListener.getState();

      // Create new world
      const newWorld = await createWorldFromExecution(
        this._schemaHash,
        result.snapshot,
        proposalId
      );

      // Check if world already exists (content-addressable: same data = same worldId)
      // This can happen when state returns to a previous value (e.g., filter: all -> active -> all)
      const existingWorld = await this.store.getWorld(newWorld.worldId);
      let forked = false;

      if (existingWorld) {
        // World already exists - this is valid for content-addressable systems
        // The data is identical, so we don't need to save the world again
        // But we should still update the snapshot (in case computed values differ)
        await this.store.saveSnapshot(newWorld.worldId, result.snapshot);

        // Don't add to lineage - the world is already there
        // This represents a "convergent" transition back to a known state
      } else {
        // New world - save everything
        await this.store.saveWorld(newWorld);
        await this.store.saveSnapshot(newWorld.worldId, result.snapshot);

        // Add to lineage using addWorldWithEdge
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

      // Determine final status
      const finalStatus = result.status === "complete" ? "completed" : "failed";

      // Emit execution:completed or execution:failed
      if (finalStatus === "completed") {
        this.eventBus.emit({
          type: "execution:completed",
          timestamp: Date.now(),
          proposalId,
          intentId: proposal.intent.intentId,
          finalSnapshot: result.snapshot,
          totalPatches: listenerState.totalPatches,
          totalEffects: listenerState.totalEffects,
        });
      } else {
        this.eventBus.emit({
          type: "execution:failed",
          timestamp: Date.now(),
          proposalId,
          intentId: proposal.intent.intentId,
          error: { code: "EXECUTION_FAILED", message: "Host execution failed" },
          partialSnapshot: result.snapshot,
        });
      }

      // Emit world:created only for new worlds (not for convergent transitions)
      if (!existingWorld) {
        this.eventBus.emit({
          type: "world:created",
          timestamp: Date.now(),
          world: newWorld,
          proposalId,
          parentWorldId: proposal.baseWorld,
        });

        if (forked) {
          this.eventBus.emit({
            type: "world:forked",
            timestamp: Date.now(),
            parentWorldId: proposal.baseWorld,
            childWorldId: newWorld.worldId,
            proposalId,
          });
        }
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
      // Emit execution:failed
      this.eventBus.emit({
        type: "execution:failed",
        timestamp: Date.now(),
        proposalId,
        intentId: proposal.intent.intentId,
        error: {
          code: "HOST_EXECUTION_ERROR",
          message: error instanceof Error ? error.message : String(error),
        },
        partialSnapshot: baseSnapshot,
      });

      // Transition to failed
      this.proposalQueue.transition(proposalId, "failed", {
        completedAt: Date.now(),
      });
      await this.store.updateProposal(proposalId, {
        status: "failed",
        completedAt: Date.now(),
      });

      const updatedProposal = this.proposalQueue.get(proposalId);
      return {
        proposal: updatedProposal!,
        decision,
        error: error instanceof WorldError
          ? error
          : createWorldError("HOST_EXECUTION_ERROR", String(error)),
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
   * Get pending proposals
   */
  async getPendingProposals(): Promise<Proposal[]> {
    return this.store.getPendingProposals();
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
