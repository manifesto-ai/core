/**
 * Header Component
 *
 * Displays Lab metadata: runId, necessity level, and start time.
 */
import React from "react";
import type { NecessityLevel } from "../../types.js";
export interface HeaderProps {
    runId: string;
    necessityLevel: NecessityLevel;
    startedAt: number;
}
export declare const Header: React.FC<HeaderProps>;
export default Header;
//# sourceMappingURL=Header.d.ts.map