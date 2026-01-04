/**
 * SnapshotView Component
 *
 * Displays current world snapshot.
 * Detects BabyAI state and renders as a visual grid.
 */
import React from "react";
import type { Snapshot } from "@manifesto-ai/world";
export interface SnapshotViewProps {
    snapshot: Snapshot | null;
    enabled: boolean;
    mode?: "auto" | "grid" | "json";
}
export declare const SnapshotView: React.FC<SnapshotViewProps>;
export default SnapshotView;
//# sourceMappingURL=SnapshotView.d.ts.map