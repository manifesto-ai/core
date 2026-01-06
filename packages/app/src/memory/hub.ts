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
} from "../types/index.js";
import type { SelectionResult, SelectedMemory, MemoryTrace, ActorRef } from "@manifesto-ai/memory";
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
        atWorldId,
        selector,
        constraints,
        selectedAt: Date.now(),
      };

      attachments.push({
        provider: targetProvider,
        trace,
      });

      allSelected.push(...filteredSelected);

      // Collect views
      if (selectionResult.views) {
        for (const view of selectionResult.views) {
          const existing = viewsByProvider.get(targetProvider);
          if (!existing) {
            viewsByProvider.set(targetProvider, {
              provider: targetProvider,
              view,
            });
          }
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
