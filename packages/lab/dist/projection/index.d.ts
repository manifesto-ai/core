/**
 * Projection Module
 *
 * Lab projection UI controller and Ink components.
 */
export { createProjectionController, createProjectionState, type ProjectionState, } from "./controller.js";
export { createRenderContext, formatElapsedTime, getLevelName, type CreateRenderContextOptions, } from "./context.js";
export { defaultHeaderRenderer, defaultFooterRenderer, defaultSnapshotRenderer, defaultActionRenderer, defaultProposalRenderer, defaultReasoningRenderer, defaultLayoutRenderer, mergeRenderers, renderAllSections, renderComplete, } from "./renderers.js";
export { App, Header, Progress, Proposals, HITLPanel, SnapshotView, StatusBar, } from "./components/index.js";
export type { AppProps, HeaderProps, ProgressProps, ProposalsProps, HITLPanelProps, SnapshotViewProps, StatusBarProps, } from "./components/index.js";
export { useLab } from "./hooks/index.js";
export type { LabUIState, UseLabResult } from "./hooks/index.js";
//# sourceMappingURL=index.d.ts.map