/**
 * Stage 0: Deterministic Chunking
 *
 * Segments long inputs into smaller sections using rule-based logic.
 * MUST be deterministic (no LLM).
 */

import type { Section, ChunkingTrace } from "../domain/index.js";
import type { PipelineState, StageResult } from "./types.js";

/**
 * Default maximum section length in characters
 */
const DEFAULT_MAX_SECTION_LENGTH = 2000;

/**
 * Patterns to split on (in order of preference)
 */
const SPLIT_PATTERNS = [
  /\n\n+/g, // Double newlines (paragraphs)
  /\n/g, // Single newlines
  /[.!?]+\s+/g, // Sentence boundaries
  /[,;:]\s+/g, // Clause boundaries
];

/**
 * Execute chunking stage
 *
 * @param input - Raw input text
 * @param _state - Pipeline state (unused in this stage)
 * @param maxLength - Maximum section length
 * @returns Chunking result with sections
 */
export async function executeChunking(
  input: string,
  _state: PipelineState,
  maxLength: number = DEFAULT_MAX_SECTION_LENGTH
): Promise<StageResult<Section[]>> {
  const startTime = Date.now();

  try {
    const sections = chunkText(input, maxLength);
    const durationMs = Date.now() - startTime;

    return {
      success: true,
      data: sections,
      durationMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Chunk text into sections
 *
 * Rules:
 * 1. If input is short enough, return as single section
 * 2. Split on paragraph boundaries first
 * 3. If sections are still too long, split on sentences
 * 4. Continue with finer splits as needed
 */
function chunkText(input: string, maxLength: number): Section[] {
  // Short input: single section
  if (input.length <= maxLength) {
    return [createSection(0, input, 0, input.length)];
  }

  // Start with the full text
  let chunks = [input];

  // Try each split pattern until all chunks are small enough
  for (const pattern of SPLIT_PATTERNS) {
    if (chunks.every((c) => c.length <= maxLength)) {
      break;
    }

    chunks = chunks.flatMap((chunk) => {
      if (chunk.length <= maxLength) {
        return [chunk];
      }
      return splitByPattern(chunk, pattern, maxLength);
    });
  }

  // Force split any remaining long chunks
  chunks = chunks.flatMap((chunk) => {
    if (chunk.length <= maxLength) {
      return [chunk];
    }
    return forceSplit(chunk, maxLength);
  });

  // Create sections with proper offsets
  const sections: Section[] = [];
  let currentOffset = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const startOffset = input.indexOf(chunk, currentOffset);
    const endOffset = startOffset + chunk.length;

    sections.push(createSection(i, chunk, startOffset, endOffset));
    currentOffset = endOffset;
  }

  return sections;
}

/**
 * Split text by a pattern
 */
function splitByPattern(
  text: string,
  pattern: RegExp,
  maxLength: number
): string[] {
  const parts = text.split(pattern);
  const result: string[] = [];
  let current = "";

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 1 <= maxLength) {
      current = current ? `${current} ${trimmed}` : trimmed;
    } else {
      if (current) {
        result.push(current);
      }
      current = trimmed;
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

/**
 * Force split long text at word boundaries
 */
function forceSplit(text: string, maxLength: number): string[] {
  const result: string[] = [];
  const words = text.split(/\s+/);
  let current = "";

  for (const word of words) {
    if (current.length + word.length + 1 <= maxLength) {
      current = current ? `${current} ${word}` : word;
    } else {
      if (current) {
        result.push(current);
      }
      // If single word is too long, split it
      if (word.length > maxLength) {
        for (let i = 0; i < word.length; i += maxLength) {
          result.push(word.slice(i, i + maxLength));
        }
        current = "";
      } else {
        current = word;
      }
    }
  }

  if (current) {
    result.push(current);
  }

  return result;
}

/**
 * Create a section object
 */
function createSection(
  index: number,
  text: string,
  startOffset: number,
  endOffset: number
): Section {
  return {
    sectionId: `section-${index}`,
    startOffset,
    endOffset,
    text: text.trim(),
  };
}

/**
 * Create chunking trace
 */
export function createChunkingTrace(
  sections: Section[],
  durationMs: number
): ChunkingTrace {
  return {
    sectionCount: sections.length,
    durationMs,
  };
}
