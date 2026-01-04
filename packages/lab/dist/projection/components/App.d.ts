/**
 * Lab App Component
 *
 * Main Ink application for Lab projection UI.
 * Orchestrates all UI components based on projection mode.
 */
import React from "react";
import type { LabWorld, ProjectionMode } from "../../types.js";
import type { Snapshot } from "@manifesto-ai/world";
export interface AppProps {
    labWorld: LabWorld;
    mode: ProjectionMode;
    snapshot?: Snapshot | null;
    onAbort?: () => void;
}
export declare const App: React.FC<AppProps>;
export default App;
//# sourceMappingURL=App.d.ts.map