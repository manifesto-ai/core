/**
 * HITL Controller
 *
 * Manages Human-in-the-Loop decisions for Lab experiments.
 * Per SPEC Section 10 and FDR-N013.
 *
 * Key principles:
 * - HITL decisions flow through Authority, not direct modification
 * - Auto-approve conditions can bypass human intervention
 * - Timeouts trigger configured behavior (approve/reject/abort)
 */
import type { ManifestoWorld, ProposalDecidedEvent } from "@manifesto-ai/world";
import type { HITLOptions, HITLController } from "../types.js";
/**
 * Create a HITL controller.
 *
 * @param options - HITL options
 * @param world - ManifestoWorld instance for processing decisions
 * @returns HITLController instance
 */
export declare function createHITLController(options: HITLOptions | undefined, world: ManifestoWorld): HITLController;
/**
 * Extended HITL controller with internal handlePending method.
 */
export interface HITLControllerInternal extends HITLController {
    /** Returns true if proposal was added to pending, false otherwise */
    handlePending(event: ProposalDecidedEvent): Promise<boolean>;
}
//# sourceMappingURL=controller.d.ts.map