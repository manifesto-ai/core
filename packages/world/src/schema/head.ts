/**
 * WorldHead Schema
 *
 * Defines the WorldHead type — a branch pointer representing the latest
 * completed World in a Branch.
 *
 * HEAD-1: Head = World referenced by Branch.head (not lineage leaf)
 * HEAD-3: All Heads are completed (guaranteed by BRANCH-7)
 *
 * @see World SPEC v2.0.5 §9.7
 */
import { z } from "zod";
import { WorldId } from "./world.js";

/**
 * WorldHead — branch pointer with metadata for query and resume.
 *
 * Fields:
 * - worldId: Head World's ID (the branch pointer target)
 * - branchId: Branch that owns this head
 * - branchName: Human-readable branch name
 * - createdAt: Head World's creation time (for temporal ordering)
 * - schemaHash: Branch's current schemaHash (for resume migration checks)
 */
export const WorldHead = z.object({
  worldId: WorldId,
  branchId: z.string(),
  branchName: z.string(),
  createdAt: z.number(),
  schemaHash: z.string(),
});
export type WorldHead = z.infer<typeof WorldHead>;
