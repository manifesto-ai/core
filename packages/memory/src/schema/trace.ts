/**
 * Memory Trace Schema
 *
 * Defines the MemoryTrace type for audit trail recording.
 * Attached to Proposal.trace.context.memory.
 *
 * @see SPEC-1.2v §5.1.5
 */
import { z } from "zod";
import { WorldId, ActorRef } from "@manifesto-ai/world";
import { SelectedMemory } from "./selection.js";

/**
 * Record of memory selection for audit.
 * Attached to Proposal.trace.context.memory.
 *
 * Constraints:
 * - selector MUST be valid ActorRef per Intent & Projection §3.1
 * - query MUST be non-empty string
 * - selectedAt MUST be positive integer
 * - atWorldId MUST be valid WorldId
 * - selected MUST be array (MAY be empty)
 * - selected[*] Each element MUST satisfy SelectedMemory constraints
 */
export const MemoryTrace = z.object({
  /** Who performed the selection */
  selector: ActorRef,
  /** What was being searched for */
  query: z.string().min(1),
  /** When selection was performed (Unix timestamp ms) */
  selectedAt: z.number().int().positive(),
  /** World context at selection time */
  atWorldId: WorldId,
  /** What was selected */
  selected: z.array(SelectedMemory),
});

export type MemoryTrace = z.infer<typeof MemoryTrace>;

/**
 * Key used for storing MemoryTrace in Proposal.trace.context
 */
export const MEMORY_TRACE_KEY = "memory" as const;
