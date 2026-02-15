/**
 * Memory Facade Implementation
 *
 * Public API for memory operations.
 *
 * @see SPEC §14.5
 * @module
 */

import type {
  MemoryFacade,
  MemoryHubConfig,
  RecallRequest,
  RecallResult,
  MemoryMaintenanceOp,
  MemoryMaintenanceContext,
  MemoryMaintenanceOutput,
} from "../types/index.js";
import type { ActorRef } from "@manifesto-ai/world";
import { MemoryDisabledError, BranchNotFoundError } from "../errors/index.js";
import { MemoryHub } from "./hub.js";

/**
 * Context provider for memory operations.
 */
export interface MemoryFacadeContext {
  getDefaultActorId(): string;
  getCurrentBranchId(): string;
  getBranchHead(branchId: string): string | undefined;
  branchExists(branchId: string): boolean;
}

/**
 * Enabled Memory Facade - when memory is configured.
 *
 * @see SPEC §14.5
 */
export class EnabledMemoryFacade implements MemoryFacade {
  private _hub: MemoryHub;
  private _context: MemoryFacadeContext;

  constructor(hub: MemoryHub, context: MemoryFacadeContext) {
    this._hub = hub;
    this._context = context;
  }

  /**
   * Check if memory is enabled.
   */
  enabled(): boolean {
    return true;
  }

  /**
   * Perform memory recall.
   *
   * MEM-REC-1: atWorldId MUST be ctx.branchId's head if provided, else currentBranch().head()
   * MEM-REC-4: selector MUST be ctx.actorId or ActorPolicy default
   * MEM-REC-5: If ctx.branchId doesn't exist, throw BranchNotFoundError
   *
   * @see SPEC §14.10
   */
  async recall(
    req: RecallRequest | readonly RecallRequest[],
    ctx?: { actorId?: string; branchId?: string }
  ): Promise<RecallResult> {
    // Normalize requests to array
    const requests = Array.isArray(req) ? req : [req];

    // MEM-DIS-8: Empty array is "no recall"
    if (requests.length === 0) {
      return {
        attachments: [],
        selected: [],
        views: [],
      };
    }

    // Determine branch and validate
    const branchId = ctx?.branchId ?? this._context.getCurrentBranchId();

    // MEM-REC-5: Validate branch exists
    if (ctx?.branchId && !this._context.branchExists(branchId)) {
      throw new BranchNotFoundError(branchId);
    }

    // MEM-REC-1: Get atWorldId from branch head
    const atWorldId = this._context.getBranchHead(branchId);
    if (!atWorldId) {
      throw new BranchNotFoundError(branchId);
    }

    // MEM-REC-4: Determine selector
    const actorId = ctx?.actorId ?? this._context.getDefaultActorId();
    const selector: ActorRef = { actorId, kind: "human" };

    // Perform recall via hub
    return this._hub.recall(requests, atWorldId, selector);
  }

  /**
   * Get list of provider names.
   */
  providers(): readonly string[] {
    return this._hub.getProviderNames();
  }

  /**
   * Backfill historical worlds to memory providers.
   *
   * @see SPEC §14.2
   */
  async backfill(opts: { worldId: string; depth?: number }): Promise<void> {
    // TODO: Implement backfill traversal
    // This requires World lineage traversal which depends on World integration
    console.warn("[Manifesto] Memory backfill not yet fully implemented");
  }

  /**
   * Perform memory maintenance operations.
   *
   * @see SPEC §17.5 MEM-MAINT-1~10
   * @since v0.4.8
   */
  async maintain(
    ops: readonly MemoryMaintenanceOp[],
    ctx: MemoryMaintenanceContext
  ): Promise<MemoryMaintenanceOutput> {
    return this._hub.maintain(ops, ctx);
  }

  /**
   * Get the underlying hub (for internal use).
   * @internal
   */
  getHub(): MemoryHub {
    return this._hub;
  }
}

/**
 * Disabled Memory Facade - when memory is disabled.
 *
 * MEM-DIS-1~4: All operations throw or return appropriate disabled values.
 *
 * @see SPEC §14.9
 */
export class DisabledMemoryFacade implements MemoryFacade {
  /**
   * MEM-DIS-1: enabled() MUST return false
   */
  enabled(): boolean {
    return false;
  }

  /**
   * MEM-DIS-2: recall() MUST throw MemoryDisabledError
   */
  async recall(
    req: RecallRequest | readonly RecallRequest[],
    ctx?: { actorId?: string; branchId?: string }
  ): Promise<RecallResult> {
    throw new MemoryDisabledError("recall");
  }

  /**
   * MEM-DIS-4: providers() MUST return empty array
   */
  providers(): readonly string[] {
    return [];
  }

  /**
   * MEM-DIS-3: backfill() MUST throw MemoryDisabledError
   */
  async backfill(opts: { worldId: string; depth?: number }): Promise<void> {
    throw new MemoryDisabledError("backfill");
  }

  /**
   * MEM-DIS-5: maintain() MUST throw MemoryDisabledError
   *
   * @since v0.4.8
   */
  async maintain(
    ops: readonly MemoryMaintenanceOp[],
    ctx: MemoryMaintenanceContext
  ): Promise<MemoryMaintenanceOutput> {
    throw new MemoryDisabledError("maintain");
  }
}

/**
 * Create a memory facade based on configuration.
 */
export function createMemoryFacade(
  config: false | MemoryHubConfig | undefined,
  schemaHash: string,
  context: MemoryFacadeContext
): MemoryFacade {
  if (config === false || config === undefined) {
    return new DisabledMemoryFacade();
  }

  const hub = new MemoryHub(config, schemaHash);
  return new EnabledMemoryFacade(hub, context);
}
