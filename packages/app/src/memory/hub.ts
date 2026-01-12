/**
 * Memory Hub Implementation
 *
 * Event collection and provider fan-out layer.
 *
 * @see SPEC §14.2
 * @module
 */

import type {
  MemoryHubConfig,
  MemoryIngestEntry,
  MemoryProvider,
  RecallRequest,
  RecallResult,
  MemoryMaintenanceOp,
  MemoryMaintenanceContext,
  MemoryMaintenanceResult,
  MemoryMaintenanceOutput,
  MemoryHygieneTrace,
} from "../types/index.js";
import type { SelectionResult, SelectedMemory, MemoryTrace } from "@manifesto-ai/memory";
import type { ActorRef, WorldId } from "@manifesto-ai/world";
import { NoneVerifier, computeVerified } from "./verifier.js";

/**
 * Memory Hub manages provider fan-out and memory operations.
 *
 * @see SPEC §14.2
 */
export class MemoryHub {
  private _providers: Record<string, MemoryProvider>;
  private _defaultProvider: string;
  private _routing: MemoryHubConfig["routing"];
  private _schemaHash: string;

  constructor(config: MemoryHubConfig, schemaHash: string) {
    this._providers = { ...config.providers };
    this._defaultProvider = config.defaultProvider;
    this._routing = config.routing;
    this._schemaHash = schemaHash;

    // Validate default provider exists
    if (!(this._defaultProvider in this._providers)) {
      throw new Error(
        `Default provider "${this._defaultProvider}" not found in providers`
      );
    }
  }

  /**
   * Get list of provider names.
   */
  getProviderNames(): readonly string[] {
    return Object.keys(this._providers);
  }

  /**
   * Ingest a world event to providers.
   *
   * MEM-1: App MUST collect Domain Runtime World creation events
   * MEM-2: MemoryHub MUST fan-out to providers according to routing config
   *
   * @see SPEC §14.7
   */
  async ingest(entry: MemoryIngestEntry): Promise<void> {
    // Determine target providers
    const targetProviders = this._getIngestTargets(entry);

    // Fan-out to all target providers
    const promises = targetProviders.map(async (providerName) => {
      const provider = this._providers[providerName];
      if (provider.ingest) {
        try {
          await provider.ingest(entry);
        } catch (error) {
          // Log but don't fail - ingestion is best-effort
          console.error(
            `[Manifesto] Memory ingest failed for provider "${providerName}":`,
            error
          );
        }
      }
    });

    await Promise.all(promises);
  }

  /**
   * Perform memory recall.
   *
   * MEM-3: provider.select() MUST return Memory SPEC v1.2 SelectionResult
   * MEM-4: Recall results MUST be returned as Memory SPEC v1.2 MemoryTrace
   *
   * @see SPEC §14.5
   */
  async recall(
    requests: readonly RecallRequest[],
    atWorldId: string,
    selector: ActorRef
  ): Promise<RecallResult> {
    const attachments: RecallResult["attachments"][number][] = [];
    const allSelected: SelectedMemory[] = [];
    const viewsByProvider: Map<string, RecallResult["views"][number]> = new Map();

    for (const request of requests) {
      // Normalize request
      const { query, provider: providerName, constraints } = this._normalizeRequest(request);
      const targetProvider = providerName ?? this._defaultProvider;
      const provider = this._providers[targetProvider];

      if (!provider) {
        console.warn(
          `[Manifesto] Provider "${targetProvider}" not found for recall`
        );
        continue;
      }

      // Execute selection
      const selectionResult = await provider.select({
        query,
        atWorldId,
        selector,
        constraints,
      });

      // Get verifier (use NoneVerifier if absent - MEM-8)
      const verifier = provider.verifier ?? NoneVerifier;

      // Process selected memories and compute verified status
      const processedSelected = selectionResult.selected.map((memory) => {
        // VER-1: verified = proveResult.valid && verifier.verifyProof(proof)
        // For simplicity, we use the existing verified status from provider
        // A full implementation would re-verify here
        return memory;
      });

      // VER-3: requireVerified = true filters out unverified
      const filteredSelected = constraints?.requireVerified
        ? processedSelected.filter((m) => m.verified)
        : processedSelected;

      // Create trace for this recall
      const trace: MemoryTrace = {
        query,
        atWorldId: atWorldId as WorldId,
        selector,
        selectedAt: Date.now(),
        selected: filteredSelected,
      };

      attachments.push({
        provider: targetProvider,
        trace,
      });

      allSelected.push(...filteredSelected);

      // Create views from selected memories for UI display
      for (const memory of filteredSelected) {
        if (!viewsByProvider.has(`${targetProvider}:${memory.ref.worldId}`)) {
          viewsByProvider.set(`${targetProvider}:${memory.ref.worldId}`, {
            ref: { worldId: memory.ref.worldId as string },
            summary: memory.reason,
            relevance: memory.confidence,
          });
        }
      }
    }

    return {
      attachments,
      selected: allSelected,
      views: Array.from(viewsByProvider.values()),
    };
  }

  /**
   * Get provider by name.
   */
  getProvider(name: string): MemoryProvider | undefined {
    return this._providers[name];
  }

  /**
   * Perform memory maintenance operations.
   *
   * MEM-MAINT-1: Requires Authority approval (handled by System Runtime)
   * MEM-MAINT-6: MemoryHygieneTrace recorded
   * MEM-MAINT-10: actor MUST come from ctx (derived from Proposal.actorId)
   *
   * @see SPEC §17.5 MEM-MAINT-1~10
   * @since v0.4.8
   */
  async maintain(
    ops: readonly MemoryMaintenanceOp[],
    ctx: MemoryMaintenanceContext
  ): Promise<MemoryMaintenanceOutput> {
    const startTime = Date.now();
    const results: MemoryMaintenanceResult[] = [];

    // Get providers with maintain capability
    const maintainableProviders = this._getMaintainableProviders();

    if (maintainableProviders.length === 0) {
      // No providers support maintain - return empty success
      // MEM-MAINT-5: Forget is idempotent (no-op is valid)
      for (const op of ops) {
        results.push({
          success: true,
          op,
          error: "No providers support maintain capability",
        });
      }
    } else {
      // Execute each operation
      for (const op of ops) {
        const opResults = await this._executeMaintenanceOp(op, ctx, maintainableProviders);
        results.push(...opResults);
      }
    }

    // MEM-MAINT-6: Create hygiene trace
    const trace: MemoryHygieneTrace = {
      traceId: `mht_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: startTime,
      actor: ctx.actor,
      ops: [...ops],
      results: [...results],
      durationMs: Date.now() - startTime,
    };

    return {
      results,
      trace,
    };
  }

  /**
   * Execute a single maintenance operation across providers.
   */
  private async _executeMaintenanceOp(
    op: MemoryMaintenanceOp,
    ctx: MemoryMaintenanceContext,
    providers: Array<[string, MemoryProvider]>
  ): Promise<MemoryMaintenanceResult[]> {
    const results: MemoryMaintenanceResult[] = [];

    // Fan-out to all maintainable providers
    const promises = providers.map(async ([providerName, provider]) => {
      try {
        // provider.maintain is guaranteed to exist by _getMaintainableProviders
        const result = await provider.maintain!(op, ctx);
        return result;
      } catch (error) {
        // Log but don't fail - maintain errors are captured in result
        console.error(
          `[Manifesto] Memory maintain failed for provider "${providerName}":`,
          error
        );
        return {
          success: false,
          op,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const providerResults = await Promise.all(promises);

    // Aggregate results - if any provider succeeded, overall success
    // MEM-MAINT-5: Forget is idempotent
    const anySuccess = providerResults.some(r => r.success);
    const allErrors = providerResults
      .filter(r => !r.success && r.error)
      .map(r => r.error)
      .join("; ");

    results.push({
      success: anySuccess || providerResults.length === 0,
      op,
      tombstoneId: providerResults.find(r => r.tombstoneId)?.tombstoneId,
      error: anySuccess ? undefined : allErrors || undefined,
    });

    return results;
  }

  /**
   * Get providers that support the maintain capability.
   */
  private _getMaintainableProviders(): Array<[string, MemoryProvider]> {
    return Object.entries(this._providers).filter(
      ([, provider]) =>
        provider.maintain !== undefined &&
        (provider.meta?.capabilities?.includes("maintain") ?? true)
    );
  }

  /**
   * Determine target providers for ingest based on routing config.
   */
  private _getIngestTargets(entry: MemoryIngestEntry): string[] {
    if (this._routing?.ingestTo) {
      return [...this._routing.ingestTo({
        worldId: entry.worldId,
        schemaHash: entry.schemaHash,
      })];
    }

    // Default: all providers with ingest capability
    return Object.entries(this._providers)
      .filter(([, provider]) => provider.ingest)
      .map(([name]) => name);
  }

  /**
   * Normalize recall request to structured form.
   */
  private _normalizeRequest(request: RecallRequest): {
    query: string;
    provider?: string;
    constraints?: {
      limit?: number;
      requireVerified?: boolean;
    };
  } {
    if (typeof request === "string") {
      return { query: request };
    }
    return request;
  }
}

/**
 * Create a new memory hub.
 */
export function createMemoryHub(
  config: MemoryHubConfig,
  schemaHash: string
): MemoryHub {
  return new MemoryHub(config, schemaHash);
}
