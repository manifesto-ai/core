// Types
export type {
  MigrationPhase,
  AgentStatus,
  AgentRef,
  HITLOption,
  HITLRequest,
  HITLHistoryEntry,
  Progress,
  DiscoveredDomain,
  OrchestratorData,
  OrchestratorState,
  OrchestratorSnapshot,
  ResolveHITLInput,
  UpgradeModelInput,
  StartAnalysisInput,
} from './types.js';

// Orchestrator Domain
export {
  OrchestratorDataSchema,
  OrchestratorStateSchema,
  createInitialData,
  createInitialState,
  calculateConfidence,
  calculateCanProceed,
  calculateEstimatedTimeRemaining,
  startAnalysis,
  updateProgress,
  setPhase,
  requestHITL,
  resolveHITL,
  upgradeModel,
  setError,
  addDiscoveredDomain,
  updateDiscoveredDomain,
  complete,
} from './orchestrator.js';

// Analyzer Domain
export * as analyzer from './analyzer/index.js';

// Summarizer Domain
export * as summarizer from './summarizer/index.js';

// Transformer Domain
export * as transformer from './transformer/index.js';
