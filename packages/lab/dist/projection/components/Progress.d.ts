/**
 * Progress Component
 *
 * Displays experiment progress: proposals, approvals, rejections, events.
 */
import React from "react";
export interface ProgressProps {
    proposalCount: number;
    approvedCount: number;
    rejectedCount: number;
    eventCount: number;
    elapsed: number;
    isRunning: boolean;
}
export declare const Progress: React.FC<ProgressProps>;
export default Progress;
//# sourceMappingURL=Progress.d.ts.map