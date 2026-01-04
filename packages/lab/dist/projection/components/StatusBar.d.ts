/**
 * StatusBar Component
 *
 * Bottom status bar showing current lab status with spinner.
 */
import React from "react";
import type { LabStatus } from "../../types.js";
export interface StatusBarProps {
    status: LabStatus;
    isSpinning: boolean;
    message?: string;
}
export declare const StatusBar: React.FC<StatusBarProps>;
export default StatusBar;
//# sourceMappingURL=StatusBar.d.ts.map