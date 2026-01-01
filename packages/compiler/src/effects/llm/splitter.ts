/**
 * @manifesto-ai/compiler v1.1 Input Splitter
 *
 * Splits input text into segments for parallel processing.
 * Uses line breaks as the primary splitting mechanism.
 */

import type { FragmentType } from "../../domain/types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// §1 Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface Segment {
  content: string;
  index: number;
  startOffset: number;
  endOffset: number;
}

export interface SplitResult {
  segments: Segment[];
  batches: Segment[][];
}

export interface SplitOptions {
  /** Minimum segment length (shorter segments merged with previous) */
  minLength?: number;
  /** Number of segments per batch */
  batchSize?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 Splitter Implementation
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_OPTIONS: Required<SplitOptions> = {
  minLength: 10,
  batchSize: 3,
};

/**
 * Split input text into segments based on line breaks
 *
 * @param content - Input text to split
 * @param options - Split options
 * @returns Split result with segments and batches
 */
export function splitInput(content: string, options: SplitOptions = {}): SplitResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Split by line breaks
  const lines = content.split(/\n+/);

  // Build segments with offsets
  const rawSegments: Segment[] = [];
  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.length > 0) {
      rawSegments.push({
        content: trimmed,
        index: rawSegments.length,
        startOffset: currentOffset,
        endOffset: currentOffset + line.length,
      });
    }

    currentOffset += line.length + 1; // +1 for newline
  }

  // Merge short segments with previous
  const segments: Segment[] = [];
  for (const seg of rawSegments) {
    if (segments.length > 0 && seg.content.length < opts.minLength) {
      // Merge with previous
      const prev = segments[segments.length - 1];
      prev.content = prev.content + "\n" + seg.content;
      prev.endOffset = seg.endOffset;
    } else {
      segments.push({ ...seg, index: segments.length });
    }
  }

  // Create batches
  const batches: Segment[][] = [];
  for (let i = 0; i < segments.length; i += opts.batchSize) {
    batches.push(segments.slice(i, i + opts.batchSize));
  }

  return { segments, batches };
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3 Dependency Inference
// ═══════════════════════════════════════════════════════════════════════════════

export interface ClassifiedSegment {
  content: string;
  type: FragmentType;
  index: number;
}

export interface ChunkWithDependencies {
  content: string;
  expectedType: FragmentType;
  dependencies: Array<{
    kind: "requires";
    targetChunkId: string;
    reason?: string;
  }>;
  sourceSpan?: { start: number; end: number };
}

/**
 * Infer dependencies between classified segments
 *
 * Rules:
 * - action depends on related state
 * - computed depends on referenced state
 * - constraint depends on related state/action
 * - effect depends on triggering action
 * - flow depends on related actions
 */
export function inferDependencies(
  classified: ClassifiedSegment[]
): ChunkWithDependencies[] {
  // Find state segments (these are typically depended upon)
  const stateIndices = classified
    .filter((c) => c.type === "state")
    .map((c) => c.index);

  // Find action segments
  const actionIndices = classified
    .filter((c) => c.type === "action")
    .map((c) => c.index);

  return classified.map((seg, idx) => {
    const dependencies: ChunkWithDependencies["dependencies"] = [];

    switch (seg.type) {
      case "action":
        // Actions depend on state they might modify
        // Use the closest preceding state as dependency
        const precedingStates = stateIndices.filter((i) => i < idx);
        if (precedingStates.length > 0) {
          const closestState = precedingStates[precedingStates.length - 1];
          dependencies.push({
            kind: "requires",
            targetChunkId: `chunk_${closestState}`,
            reason: "Action may modify this state",
          });
        }
        break;

      case "computed":
        // Computed values depend on all preceding states
        for (const stateIdx of stateIndices.filter((i) => i < idx)) {
          dependencies.push({
            kind: "requires",
            targetChunkId: `chunk_${stateIdx}`,
            reason: "Computed value derives from state",
          });
        }
        break;

      case "constraint":
        // Constraints depend on related state and actions
        const relevantStates = stateIndices.filter((i) => i < idx);
        const relevantActions = actionIndices.filter((i) => i < idx);

        if (relevantStates.length > 0) {
          dependencies.push({
            kind: "requires",
            targetChunkId: `chunk_${relevantStates[relevantStates.length - 1]}`,
            reason: "Constraint applies to state",
          });
        }
        if (relevantActions.length > 0) {
          dependencies.push({
            kind: "requires",
            targetChunkId: `chunk_${relevantActions[relevantActions.length - 1]}`,
            reason: "Constraint applies to action",
          });
        }
        break;

      case "effect":
        // Effects depend on triggering actions
        const triggerActions = actionIndices.filter((i) => i < idx);
        if (triggerActions.length > 0) {
          dependencies.push({
            kind: "requires",
            targetChunkId: `chunk_${triggerActions[triggerActions.length - 1]}`,
            reason: "Effect triggered by action",
          });
        }
        break;

      case "flow":
        // Flows depend on related actions
        for (const actionIdx of actionIndices.filter((i) => i < idx)) {
          dependencies.push({
            kind: "requires",
            targetChunkId: `chunk_${actionIdx}`,
            reason: "Flow includes this action",
          });
        }
        break;

      case "state":
        // State has no dependencies (it's the foundation)
        break;
    }

    return {
      content: seg.content,
      expectedType: seg.type,
      dependencies,
    };
  });
}
