/**
 * Projection Registry
 *
 * Manages registration and routing of Projections.
 *
 * Per Intent & Projection Specification v1.0 (Section 7):
 * - Projections map (SourceEvent, SnapshotView, Actor) to IntentBody (or none)
 * - Registry provides first-match and all-match routing
 */
import type { Projection, ProjectionRequest, ProjectionResult } from "../schema/projection.js";
import { noneResult } from "../schema/projection.js";
import {
  projectionNotFound,
  projectionAlreadyRegistered,
} from "../errors.js";

// ============================================================================
// Projection Registry Interface
// ============================================================================

/**
 * Projection registry interface
 */
export interface ProjectionRegistry {
  /**
   * Register a projection
   * @throws BridgeError if projection with same ID already registered
   */
  register(projection: Projection): void;

  /**
   * Unregister a projection by ID
   * @returns true if projection was removed, false if not found
   */
  unregister(projectionId: string): boolean;

  /**
   * Get a projection by ID
   * @returns Projection or undefined if not found
   */
  get(projectionId: string): Projection | undefined;

  /**
   * List all registered projections
   * @returns Array of all projections
   */
  list(): Projection[];

  /**
   * Route a request through projections (first-match)
   *
   * Returns the first non-none result, or none if all projections return none.
   * Projections are tried in registration order.
   *
   * @param req - Projection request
   * @returns First matching ProjectionResult or none
   */
  route(req: ProjectionRequest): ProjectionResult;

  /**
   * Route a request through all projections
   *
   * Returns results from all projections that produce non-none results.
   *
   * @param req - Projection request
   * @returns Array of all non-none ProjectionResults
   */
  routeAll(req: ProjectionRequest): ProjectionResult[];
}

// ============================================================================
// In-Memory Implementation
// ============================================================================

/**
 * In-memory projection registry implementation
 *
 * Projections are stored in a Map for O(1) lookup by ID.
 * Registration order is preserved for routing.
 */
export class InMemoryProjectionRegistry implements ProjectionRegistry {
  /** Registered projections by ID */
  private readonly projections: Map<string, Projection> = new Map();

  /** Registration order for routing */
  private readonly order: string[] = [];

  /**
   * Register a projection
   * @throws BridgeError if projection with same ID already registered
   */
  register(projection: Projection): void {
    if (this.projections.has(projection.projectionId)) {
      throw projectionAlreadyRegistered(projection.projectionId);
    }

    this.projections.set(projection.projectionId, projection);
    this.order.push(projection.projectionId);
  }

  /**
   * Unregister a projection by ID
   * @returns true if projection was removed, false if not found
   */
  unregister(projectionId: string): boolean {
    if (!this.projections.has(projectionId)) {
      return false;
    }

    this.projections.delete(projectionId);
    const index = this.order.indexOf(projectionId);
    if (index !== -1) {
      this.order.splice(index, 1);
    }

    return true;
  }

  /**
   * Get a projection by ID
   */
  get(projectionId: string): Projection | undefined {
    return this.projections.get(projectionId);
  }

  /**
   * List all registered projections in registration order
   */
  list(): Projection[] {
    return this.order.map((id) => this.projections.get(id)!);
  }

  /**
   * Route a request through projections (first-match)
   *
   * Returns the first non-none result, or none if all projections return none.
   */
  route(req: ProjectionRequest): ProjectionResult {
    for (const projectionId of this.order) {
      const projection = this.projections.get(projectionId)!;
      const result = projection.project(req);

      if (result.kind === "intent") {
        return result;
      }
    }

    return noneResult("No projection matched");
  }

  /**
   * Route a request through all projections
   *
   * Returns results from all projections that produce non-none results.
   */
  routeAll(req: ProjectionRequest): ProjectionResult[] {
    const results: ProjectionResult[] = [];

    for (const projectionId of this.order) {
      const projection = this.projections.get(projectionId)!;
      const result = projection.project(req);

      if (result.kind === "intent") {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Get a projection by ID, throwing if not found
   * @throws BridgeError if projection not found
   */
  getRequired(projectionId: string): Projection {
    const projection = this.projections.get(projectionId);
    if (!projection) {
      throw projectionNotFound(projectionId);
    }
    return projection;
  }

  /**
   * Clear all projections
   */
  clear(): void {
    this.projections.clear();
    this.order.length = 0;
  }

  /**
   * Get the number of registered projections
   */
  get size(): number {
    return this.projections.size;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new in-memory projection registry
 */
export function createProjectionRegistry(): ProjectionRegistry {
  return new InMemoryProjectionRegistry();
}
