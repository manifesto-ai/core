import { useState, useEffect, useCallback } from 'react';
import type {
  OrchestratorData,
  OrchestratorState,
  HITLRequest,
  DiscoveredDomain,
  MigrationPhase,
} from '../../domains/types.js';
import type { OrchestratorRuntime } from '../../runtime/orchestrator-runtime.js';

/**
 * Orchestrator 상태 훅 반환값
 */
export interface UseOrchestratorStateResult {
  // Data
  phase: MigrationPhase;
  progress: OrchestratorData['progress'];
  rootDir: string;
  outputDir: string;
  domains: DiscoveredDomain[];

  // State
  hitlRequest: HITLRequest | null;
  hitlPending: boolean;

  // Meta
  model: string;
  contextUsage: number;
  attempts: number;
  lastError: string | null;

  // Derived
  confidence: number;
  canProceed: boolean;
  estimatedTimeRemaining: number;

  // Actions
  resolveHitl: (optionId: string, customInput?: string) => Promise<void>;
  upgradeModel: (model: 'gpt-4o-mini' | 'gpt-4o' | 'claude-sonnet') => Promise<void>;
}

/**
 * Orchestrator 상태 관리 훅
 */
export function useOrchestratorState(
  runtime: OrchestratorRuntime
): UseOrchestratorStateResult {
  const [data, setData] = useState<OrchestratorData>(runtime.getData());
  const [state, setState] = useState<OrchestratorState>(runtime.getState());
  const [derived, setDerived] = useState(runtime.getDerived());

  // 스냅샷 변경 구독
  useEffect(() => {
    const unsubscribe = runtime.subscribe((newData, newState, newDerived) => {
      setData(newData);
      setState(newState);
      setDerived(newDerived);
    });

    return unsubscribe;
  }, [runtime]);

  // HITL 해결
  const resolveHitl = useCallback(
    async (optionId: string, customInput?: string) => {
      await runtime.resolveHumanInput(optionId, customInput);
    },
    [runtime]
  );

  // 모델 업그레이드
  const upgradeModel = useCallback(
    async (model: 'gpt-4o-mini' | 'gpt-4o' | 'claude-sonnet') => {
      await runtime.upgradeModel(model);
    },
    [runtime]
  );

  return {
    // Data
    phase: data.phase,
    progress: data.progress,
    rootDir: data.rootDir,
    outputDir: data.outputDir,
    domains: data.discoveredDomains,

    // State
    hitlRequest: state.hitl.request,
    hitlPending: state.hitl.pending,

    // Meta
    model: state.meta.currentModel,
    contextUsage: state.meta.contextUsage,
    attempts: state.meta.attempts,
    lastError: state.meta.lastError,

    // Derived
    confidence: derived.confidence,
    canProceed: derived.canProceed,
    estimatedTimeRemaining: derived.estimatedTimeRemaining,

    // Actions
    resolveHitl,
    upgradeModel,
  };
}
