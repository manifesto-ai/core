/**
 * Bridge
 *
 * Two-way binding between UI/external sources and Manifesto Domain.
 *
 * Per Intent & Projection Specification v1.0 / v1.1:
 * - Domain → UI: subscribe(callback) for SnapshotView changes
 * - UI → Domain: dispatch(body) for direct IntentBody submission
 * - UI → Domain: dispatchEvent(source) for Projection-based routing
 * - Action Catalog: projectActionCatalog() for LLM/UI context injection (v1.1)
 *
 * Bridge coordinates:
 * - ManifestoWorld for proposal submission
 * - ProjectionRegistry for SourceEvent → IntentBody routing
 * - ProjectionRecorder for audit logging
 * - IntentIssuer for IntentBody → IntentInstance conversion
 * - ActionCatalogProjector for action enumeration (v1.1)
 */
import type { Snapshot } from "@manifesto-ai/core";
import { getByPath } from "@manifesto-ai/core";
import type {
  ManifestoWorld,
  ActorRef,
  IntentBody,
  IntentInstance,
  WorldId,
} from "@manifesto-ai/world";
import type { SnapshotView } from "../schema/snapshot-view.js";
import type { SourceEvent } from "../schema/source-event.js";
import { type Projection, type ProjectionRequest, type ProjectionResult, noneResult } from "../schema/projection.js";
import { createUISourceEvent } from "../schema/source-event.js";
import { toSnapshotView } from "../utils/snapshot-adapter.js";
import type { ProjectionRegistry } from "../projection/registry.js";
import { createProjectionRegistry } from "../projection/registry.js";
import type { ProjectionRecorder } from "../projection/recorder.js";
import { createNoOpRecorder } from "../projection/recorder.js";
import type { IntentIssuer } from "../issuer/intent-issuer.js";
import { createIntentIssuer } from "../issuer/intent-issuer.js";
import {
  noActorConfigured,
  noWorldConfigured,
  noSnapshotAvailable,
  dispatchFailed,
} from "../errors.js";
import type {
  ActionCatalogProjector,
  ActionDescriptor,
  ActionCatalog,
  PruningOptions,
} from "../catalog/index.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Unsubscribe function returned by subscribe()
 */
export type Unsubscribe = () => void;

/**
 * Subscriber callback for snapshot changes
 */
export type SnapshotSubscriber = (snapshot: SnapshotView) => void;

/**
 * Bridge configuration
 */
export interface BridgeConfig {
  /** ManifestoWorld instance to use */
  world: ManifestoWorld;

  /** Schema hash for intentKey computation */
  schemaHash: string;

  /** Optional projection registry (default: creates new one) */
  registry?: ProjectionRegistry;

  /** Optional projection recorder (default: no-op) */
  recorder?: ProjectionRecorder;

  /** Optional intent issuer (default: creates new one) */
  issuer?: IntentIssuer;

  /** Default actor for dispatch operations */
  defaultActor?: ActorRef;

  /** Default projection ID for direct dispatch (default: "bridge:direct") */
  defaultProjectionId?: string;

  /**
   * Optional Action Catalog projector (v1.1)
   *
   * If provided, enables projectActionCatalog() method for LLM/UI context injection.
   * Per FDR-IP019, Bridge can omit this initially and LLM runtimes will use fallback.
   */
  catalogProjector?: ActionCatalogProjector;
}

// ============================================================================
// Bridge Class
// ============================================================================

/**
 * Bridge - Two-way binding between UI and Domain
 *
 * Features:
 * - subscribe(): Listen for SnapshotView changes
 * - get(): Read values by path
 * - dispatch(): Send IntentBody directly
 * - dispatchEvent(): Route SourceEvent through Projections
 * - set(): Convenience method for field.set
 * - registerProjection(): Add projections
 * - projectActionCatalog(): Enumerate available actions (v1.1)
 */
export class Bridge {
  private readonly world: ManifestoWorld;
  private readonly schemaHash: string;
  private readonly registry: ProjectionRegistry;
  private readonly recorder: ProjectionRecorder;
  private readonly issuer: IntentIssuer;
  private readonly defaultActor?: ActorRef;
  private readonly defaultProjectionId: string;
  private readonly catalogProjector?: ActionCatalogProjector;

  /** Current cached snapshot view */
  private currentSnapshot: SnapshotView | null = null;

  /** Current snapshot version for audit records */
  private currentSnapshotVersion: number | null = null;

  /** Current world ID for tracking */
  private currentWorldId: WorldId | null = null;

  /** Subscribers for snapshot changes */
  private readonly subscribers: Set<SnapshotSubscriber> = new Set();

  /** Whether bridge has been disposed */
  private disposed = false;

  constructor(config: BridgeConfig) {
    if (!config.world) {
      throw noWorldConfigured();
    }

    this.world = config.world;
    this.schemaHash = config.schemaHash;
    this.registry = config.registry ?? createProjectionRegistry();
    this.recorder = config.recorder ?? createNoOpRecorder();
    this.issuer = config.issuer ?? createIntentIssuer();
    this.defaultActor = config.defaultActor;
    this.defaultProjectionId = config.defaultProjectionId ?? "bridge:direct";
    this.catalogProjector = config.catalogProjector;
  }

  // ==========================================================================
  // Subscription (Domain → UI)
  // ==========================================================================

  /**
   * Subscribe to snapshot changes
   *
   * The callback will be called with the current snapshot immediately (if available)
   * and whenever the snapshot changes.
   *
   * @param callback - Function to call with SnapshotView
   * @returns Unsubscribe function
   */
  subscribe(callback: SnapshotSubscriber): Unsubscribe {
    if (this.disposed) {
      throw dispatchFailed("Bridge has been disposed");
    }

    this.subscribers.add(callback);

    // Call immediately with current snapshot if available
    if (this.currentSnapshot) {
      callback(this.currentSnapshot);
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get a value by path from the current snapshot
   *
   * @param path - Semantic path (e.g., "data.user.name")
   * @returns Value at path, or undefined if not found
   */
  get(path: string): unknown {
    if (!this.currentSnapshot) {
      return undefined;
    }

    // Try data first, then computed
    const dataResult = getByPath(this.currentSnapshot.data as object, path);
    if (dataResult !== undefined) {
      return dataResult;
    }

    // Check computed if path starts with "computed."
    if (path.startsWith("computed.")) {
      const computedPath = path.slice("computed.".length);
      return getByPath(this.currentSnapshot.computed as object, computedPath);
    }

    return getByPath(this.currentSnapshot.computed as object, path);
  }

  /**
   * Get the current snapshot view
   *
   * @returns Current SnapshotView or null if not available
   */
  getSnapshot(): SnapshotView | null {
    return this.currentSnapshot;
  }

  /**
   * Get the current world ID
   *
   * @returns Current WorldId or null if not available
   */
  getWorldId(): WorldId | null {
    return this.currentWorldId;
  }

  /**
   * Manually refresh the snapshot from the world
   *
   * Call this after world changes to update the cached snapshot.
   */
  async refresh(): Promise<void> {
    if (this.disposed) {
      return;
    }

    // Get genesis or latest world
    const genesis = await this.world.getGenesis();
    if (!genesis) {
      return;
    }

    // Find the latest world (for now, just use genesis)
    // In a more complete implementation, we'd track the current world
    const worldId = this.currentWorldId ?? genesis.worldId;
    const snapshot = await this.world.getSnapshot(worldId);

    if (snapshot) {
      this.updateSnapshot(snapshot, worldId);
    }
  }

  // ==========================================================================
  // Dispatch (UI → Domain)
  // ==========================================================================

  /**
   * Dispatch an IntentBody directly
   *
   * This bypasses the projection system and submits the intent directly.
   *
   * @param body - IntentBody to dispatch
   * @param source - Optional source event (default: generated UI event)
   * @param actor - Optional actor (default: defaultActor)
   */
  async dispatch(
    body: IntentBody,
    source?: SourceEvent,
    actor?: ActorRef
  ): Promise<void> {
    if (this.disposed) {
      throw dispatchFailed("Bridge has been disposed");
    }

    const effectiveActor = actor ?? this.defaultActor;
    if (!effectiveActor) {
      throw noActorConfigured();
    }

    // Get current world
    if (!this.currentWorldId) {
      const genesis = await this.world.getGenesis();
      if (!genesis) {
        throw noSnapshotAvailable();
      }
      this.currentWorldId = genesis.worldId;
    }

    // Create source event if not provided
    const effectiveSource = source ?? createUISourceEvent(
      `direct-${crypto.randomUUID()}`,
      { body }
    );

    // Create IntentInstance
    const intent = await this.issuer.issue({
      projectionId: this.defaultProjectionId,
      schemaHash: this.schemaHash,
      actor: effectiveActor,
      source: effectiveSource,
      body,
    });

    // Record the dispatch
    this.recorder.record(
      this.defaultProjectionId,
      effectiveActor,
      effectiveSource,
      { kind: "intent", body },
      {
        snapshotVersion: this.currentSnapshotVersion ?? undefined,
        intentId: intent.intentId,
        intentKey: intent.intentKey,
      }
    );

    // Submit proposal to world
    const result = await this.world.submitProposal(
      effectiveActor.actorId,
      intent,
      this.currentWorldId
    );

    // Update current world if completed
    if (result.resultWorld) {
      this.currentWorldId = result.resultWorld.worldId;

      // Refresh snapshot
      const snapshot = await this.world.getSnapshot(result.resultWorld.worldId);
      if (snapshot) {
        this.updateSnapshot(snapshot, result.resultWorld.worldId);
      }
    }
  }

  /**
   * Dispatch a SourceEvent through the projection system
   *
   * The source event will be routed through registered projections.
   * If a projection returns an intent, it will be dispatched.
   *
   * @param source - SourceEvent to dispatch
   * @param actor - Optional actor (default: defaultActor)
   * @returns Projection result (none or intent)
   */
  async dispatchEvent(
    source: SourceEvent,
    actor?: ActorRef
  ): Promise<ProjectionResult> {
    if (this.disposed) {
      throw dispatchFailed("Bridge has been disposed");
    }

    const effectiveActor = actor ?? this.defaultActor;
    if (!effectiveActor) {
      throw noActorConfigured();
    }

    // Ensure we have a snapshot
    if (!this.currentSnapshot) {
      await this.refresh();
      if (!this.currentSnapshot) {
        throw noSnapshotAvailable();
      }
    }

    // Create projection request
    const request: ProjectionRequest = {
      schemaHash: this.schemaHash,
      snapshot: this.currentSnapshot,
      actor: effectiveActor,
      source,
    };

    const projections = this.registry.list();
    let selectedResult: ProjectionResult | null = null;

    for (const projection of projections) {
      const projectionResult = projection.project(request);
      this.recorder.record(
        projection.projectionId,
        effectiveActor,
        source,
        projectionResult,
        {
          snapshotVersion: this.currentSnapshotVersion ?? undefined,
        }
      );

      if (!selectedResult && projectionResult.kind === "intent") {
        selectedResult = projectionResult;
      }
    }

    const result = selectedResult ?? noneResult("No projection matched");

    // If we got an intent, dispatch it
    if (result.kind === "intent") {
      await this.dispatch(result.body, source, effectiveActor);
    }

    return result;
  }

  /**
   * Set a value at a path (convenience method)
   *
   * Creates a field.set intent for the given path and value.
   *
   * @param path - Path to set
   * @param value - Value to set
   */
  async set(path: string, value: unknown): Promise<void> {
    await this.dispatch({
      type: "field.set",
      input: { path, value },
    });
  }

  // ==========================================================================
  // Projection Management
  // ==========================================================================

  /**
   * Register a projection
   *
   * @param projection - Projection to register
   */
  registerProjection(projection: Projection): void {
    this.registry.register(projection);
  }

  /**
   * Unregister a projection
   *
   * @param projectionId - ID of projection to unregister
   * @returns true if removed, false if not found
   */
  unregisterProjection(projectionId: string): boolean {
    return this.registry.unregister(projectionId);
  }

  /**
   * Get the projection registry
   */
  getRegistry(): ProjectionRegistry {
    return this.registry;
  }

  /**
   * Get the projection recorder
   */
  getRecorder(): ProjectionRecorder {
    return this.recorder;
  }

  // ==========================================================================
  // Action Catalog (v1.1)
  // ==========================================================================

  /**
   * Project action catalog for LLM/UI context injection (v1.1)
   *
   * Per Intent & Projection Specification v1.1 (§7.4):
   * This projection enumerates currently relevant actions based on
   * state-dependent availability evaluation.
   *
   * IMPORTANT: Action Catalog is NOT a security boundary (FDR-IP015).
   * Final enforcement is Authority governance + Core runtime validation.
   *
   * Per FDR-IP019: If catalogProjector is not configured, returns null.
   * LLM runtimes should fall back to schema-defined static action list.
   *
   * @param actions - Source action descriptors (typically from schema)
   * @param options - Optional mode and pruning configuration
   * @returns ActionCatalog or null if projector not configured
   */
  async projectActionCatalog(
    actions: readonly ActionDescriptor[],
    options?: {
      mode?: "llm" | "ui" | "debug";
      pruning?: PruningOptions;
    }
  ): Promise<ActionCatalog | null> {
    // Per FDR-IP019: Optional method fallback
    if (!this.catalogProjector) {
      return null;
    }

    // Need snapshot for availability evaluation
    const snapshot = this.getSnapshot();
    if (!snapshot) {
      return null;
    }

    // Need actor for availability context
    const actor = this.defaultActor;
    if (!actor) {
      return null;
    }

    return this.catalogProjector.projectActionCatalog({
      schemaHash: this.schemaHash,
      snapshot,
      actor,
      actions,
      mode: options?.mode,
      pruning: options?.pruning,
    });
  }

  /**
   * Check if Action Catalog projection is available
   *
   * @returns true if catalogProjector is configured
   */
  hasActionCatalog(): boolean {
    return !!this.catalogProjector;
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Dispose the bridge
   *
   * Clears all subscribers and marks the bridge as disposed.
   * Further operations will throw.
   */
  dispose(): void {
    this.disposed = true;
    this.subscribers.clear();
    this.currentSnapshot = null;
    this.currentWorldId = null;
  }

  /**
   * Check if the bridge has been disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Update the cached snapshot and notify subscribers
   */
  private updateSnapshot(snapshot: Snapshot, worldId: WorldId): void {
    this.currentSnapshot = toSnapshotView(snapshot);
    this.currentSnapshotVersion = snapshot.meta.version;
    this.currentWorldId = worldId;

    // Notify all subscribers
    for (const subscriber of this.subscribers) {
      try {
        subscriber(this.currentSnapshot);
      } catch {
        // Ignore subscriber errors
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Bridge instance
 */
export function createBridge(config: BridgeConfig): Bridge {
  return new Bridge(config);
}
