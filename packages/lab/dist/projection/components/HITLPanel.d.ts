/**
 * HITLPanel Component
 *
 * Interactive panel for Human-in-the-Loop decisions.
 * Displays pending proposals and allows approval/rejection.
 */
import React from "react";
import type { Proposal } from "@manifesto-ai/world";
export interface HITLPanelProps {
    pending: Proposal[];
    onApprove: (proposalId: string) => Promise<void>;
    onReject: (proposalId: string, reason: string) => Promise<void>;
    enabled: boolean;
}
export declare const HITLPanel: React.FC<HITLPanelProps>;
export default HITLPanel;
//# sourceMappingURL=HITLPanel.d.ts.map