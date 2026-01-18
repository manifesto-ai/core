/**
 * Simple Keyword-Based Selector Implementation
 *
 * A basic MemorySelector implementation using keyword matching.
 * Demonstrates the correct Selector pattern per SPEC-1.2v.
 *
 * NOT for production use - use LLM/embedding-based selectors instead.
 *
 * @see SPEC-1.2v §6.3, Appendix D.3
 */
import type { WorldId } from "@manifesto-ai/world";
import type { MemorySelector } from "../interfaces/selector.js";
import type { MemoryStore } from "../interfaces/store.js";
import type { MemoryVerifier } from "../interfaces/verifier.js";
import type {
  SelectionRequest,
  SelectionResult,
  SelectedMemory,
} from "../schema/selection.js";
import type { VerificationEvidence } from "../schema/proof.js";
import { createMemoryRef } from "../schema/ref.js";

/**
 * Entry in the keyword index.
 */
export interface KeywordIndexEntry {
  /** World ID this entry refers to */
  worldId: WorldId;
  /** Keywords associated with this World */
  keywords: string[];
  /** Optional metadata for additional filtering */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for keyword-based World indexing.
 */
export interface KeywordIndex {
  /**
   * Find entries by keyword matching.
   *
   * @param keywords - Keywords to search for
   * @returns Matching entries
   */
  findByKeywords(keywords: string[]): KeywordIndexEntry[];

  /**
   * Add an entry to the index.
   *
   * @param entry - Entry to add
   */
  add(entry: KeywordIndexEntry): void;

  /**
   * Remove an entry from the index.
   *
   * @param worldId - World ID to remove
   */
  remove(worldId: WorldId): void;

  /**
   * Clear all entries.
   */
  clear(): void;

  /**
   * Get number of entries.
   */
  readonly size: number;
}

/**
 * In-memory keyword index implementation.
 *
 * Features:
 * - Case-insensitive matching
 * - Partial keyword overlap scoring
 * - O(n) search complexity
 */
export class InMemoryKeywordIndex implements KeywordIndex {
  private readonly entries: Map<string, KeywordIndexEntry> = new Map();

  findByKeywords(keywords: string[]): KeywordIndexEntry[] {
    if (keywords.length === 0) {
      return [];
    }

    const normalizedQuery = keywords.map((k) => k.toLowerCase());
    const matches: KeywordIndexEntry[] = [];

    for (const entry of this.entries.values()) {
      const normalizedEntryKeywords = entry.keywords.map((k) => k.toLowerCase());
      const hasMatch = normalizedQuery.some((qk) =>
        normalizedEntryKeywords.some((ek) => ek.includes(qk) || qk.includes(ek))
      );
      if (hasMatch) {
        matches.push(entry);
      }
    }

    return matches;
  }

  add(entry: KeywordIndexEntry): void {
    this.entries.set(entry.worldId, entry);
  }

  remove(worldId: WorldId): void {
    this.entries.delete(worldId);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * Simple keyword-based MemorySelector.
 *
 * Selection Process:
 * 1. Extract keywords from query
 * 2. Find candidates from index
 * 3. Calculate confidence (keyword overlap ratio)
 * 4. Fetch World from Store, call Verifier.prove()
 * 5. Create VerificationEvidence (M-9)
 * 6. Apply constraints
 * 7. Return SelectionResult
 *
 * This is an IMPURE layer - calls Store, adds timestamps.
 */
export class SimpleSelector implements MemorySelector {
  constructor(
    private readonly store: MemoryStore,
    private readonly verifier: MemoryVerifier,
    private readonly index: KeywordIndex
  ) {}

  async select(request: SelectionRequest): Promise<SelectionResult> {
    const { query, selector, constraints } = request;
    const selectedAt = Date.now();

    // 1. Extract keywords from query (simple split)
    const queryKeywords = this.extractKeywords(query);

    // 2. Find candidates from index
    const candidates = this.index.findByKeywords(queryKeywords);

    // 3. Process each candidate
    const selected: SelectedMemory[] = [];

    for (const candidate of candidates) {
      // Calculate confidence based on keyword overlap
      const confidence = this.calculateConfidence(
        queryKeywords,
        candidate.keywords
      );

      // Apply minConfidence constraint early
      if (constraints?.minConfidence !== undefined) {
        if (confidence < constraints.minConfidence) {
          continue;
        }
      }

      // Fetch World from Store
      const world = await this.store.get(candidate.worldId);
      if (!world) {
        continue; // World not found, skip
      }

      // Call Verifier.prove()
      const ref = createMemoryRef(candidate.worldId);
      const proveResult = this.verifier.prove(ref, world);

      // Apply requireVerified constraint
      if (constraints?.requireVerified === true && !proveResult.valid) {
        continue;
      }

      // Create VerificationEvidence (M-9: Selector wraps proof)
      let evidence: VerificationEvidence | undefined;
      if (proveResult.proof) {
        evidence = {
          method: proveResult.proof.method,
          proof: proveResult.proof.proof,
          verifiedAt: selectedAt,
          verifiedBy: selector,
        };
      }

      // Apply requireEvidence constraint
      if (constraints?.requireEvidence === true) {
        if (!evidence || evidence.method === "none") {
          continue;
        }
      }

      // Build reason string
      const reason = this.buildReason(queryKeywords, candidate.keywords);

      selected.push({
        ref,
        reason,
        confidence,
        verified: proveResult.valid,
        evidence,
      });
    }

    // Sort by confidence (descending)
    selected.sort((a, b) => b.confidence - a.confidence);

    // Apply maxResults constraint
    const maxResults = constraints?.maxResults;
    const finalSelected =
      maxResults !== undefined ? selected.slice(0, maxResults) : selected;

    return {
      selected: finalSelected,
      selectedAt,
    };
  }

  /**
   * Extract keywords from a query string.
   * Simple implementation: split by whitespace, lowercase, filter short words.
   */
  private extractKeywords(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 2)
      .filter((word) => !this.isStopWord(word));
  }

  /**
   * Check if a word is a stop word.
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "to",
      "of",
      "in",
      "for",
      "on",
      "with",
      "at",
      "by",
      "from",
      "as",
      "or",
      "and",
      "but",
      "if",
      "then",
      "so",
      "than",
      "that",
      "this",
      "it",
    ]);
    return stopWords.has(word);
  }

  /**
   * Calculate confidence based on keyword overlap.
   * Returns a value between 0 and 1.
   */
  private calculateConfidence(
    queryKeywords: string[],
    entryKeywords: string[]
  ): number {
    if (queryKeywords.length === 0 || entryKeywords.length === 0) {
      return 0;
    }

    const normalizedQuery = new Set(queryKeywords.map((k) => k.toLowerCase()));
    const normalizedEntry = entryKeywords.map((k) => k.toLowerCase());

    let matchCount = 0;
    for (const qk of normalizedQuery) {
      for (const ek of normalizedEntry) {
        if (ek.includes(qk) || qk.includes(ek)) {
          matchCount++;
          break;
        }
      }
    }

    return matchCount / normalizedQuery.size;
  }

  /**
   * Build a reason string explaining the match.
   */
  private buildReason(queryKeywords: string[], entryKeywords: string[]): string {
    const matchedKeywords: string[] = [];
    const normalizedQuery = queryKeywords.map((k) => k.toLowerCase());

    for (const ek of entryKeywords) {
      const normalizedEk = ek.toLowerCase();
      if (
        normalizedQuery.some(
          (qk) => normalizedEk.includes(qk) || qk.includes(normalizedEk)
        )
      ) {
        matchedKeywords.push(ek);
      }
    }

    if (matchedKeywords.length === 0) {
      return "Matched by index search";
    }

    return `Matched keywords: ${matchedKeywords.join(", ")}`;
  }
}

/**
 * Factory function to create a SimpleSelector.
 *
 * @param store - MemoryStore for fetching Worlds
 * @param verifier - MemoryVerifier for generating proofs
 * @param index - KeywordIndex for candidate search
 */
export function createSimpleSelector(
  store: MemoryStore,
  verifier: MemoryVerifier,
  index: KeywordIndex
): SimpleSelector {
  return new SimpleSelector(store, verifier, index);
}

/**
 * Factory function to create an InMemoryKeywordIndex.
 */
export function createKeywordIndex(): InMemoryKeywordIndex {
  return new InMemoryKeywordIndex();
}
