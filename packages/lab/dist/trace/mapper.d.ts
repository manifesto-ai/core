/**
 * World Event to Lab Trace Event Mapper
 *
 * Maps World Protocol events to Lab trace events.
 * Per SPEC Section 8.7.
 */
import type { WorldEvent } from "@manifesto-ai/world";
import type { LabTraceEvent } from "../types.js";
/**
 * Map a World event to a Lab trace event.
 *
 * @param event - The World event to map
 * @param seq - Sequence number for the trace event
 * @returns The corresponding Lab trace event
 */
export declare function mapWorldEventToTraceEvent(event: WorldEvent, seq: number): LabTraceEvent | null;
//# sourceMappingURL=mapper.d.ts.map