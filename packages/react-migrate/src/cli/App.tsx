import React from 'react';
import { Box, Text } from 'ink';
import { Header } from './components/Header.js';
import { Progress } from './components/Progress.js';
import { PhaseIndicator } from './components/PhaseIndicator.js';
import { DomainList } from './components/DomainList.js';
import { HITLPrompt } from './components/HITLPrompt.js';
import { StatusBar } from './components/StatusBar.js';
import { ErrorDisplay } from './components/ErrorDisplay.js';
import { useOrchestratorState } from './hooks/useOrchestratorState.js';
import type { OrchestratorRuntime } from '../runtime/orchestrator-runtime.js';

export interface AppProps {
  runtime: OrchestratorRuntime;
  version?: string;
}

export function App({ runtime, version = '0.1.0' }: AppProps) {
  const {
    phase,
    progress,
    domains,
    hitlRequest,
    hitlPending,
    model,
    contextUsage,
    attempts,
    lastError,
    resolveHitl,
  } = useOrchestratorState(runtime);

  // HITL 해결 핸들러
  const handleHitlResolve = async (optionId: string, customInput?: string) => {
    await resolveHitl(optionId, customInput);
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* 헤더 */}
      <Header version={version} />

      {/* Phase 표시 */}
      <Box marginY={1}>
        <PhaseIndicator phase={phase} />
      </Box>

      {/* 진행률 */}
      <Box marginY={1}>
        <Progress
          completed={progress.completed}
          total={progress.total}
          blocked={progress.blocked}
          skipped={progress.skipped}
        />
      </Box>

      {/* 도메인 목록 */}
      <Box marginY={1}>
        <DomainList domains={domains} />
      </Box>

      {/* HITL 프롬프트 */}
      {hitlPending && hitlRequest && (
        <Box marginY={1}>
          <HITLPrompt
            request={hitlRequest}
            onResolve={handleHitlResolve}
          />
        </Box>
      )}

      {/* 에러 표시 */}
      {phase === 'FAILED' && lastError && (
        <Box marginY={1}>
          <ErrorDisplay
            error={lastError}
            suggestion="Check the log files for more details."
          />
        </Box>
      )}

      {/* 완료 메시지 */}
      {phase === 'COMPLETE' && (
        <Box marginY={1} borderStyle="round" borderColor="green" paddingX={2}>
          <Text color="green" bold>
            v Migration complete! Check the output directory for generated domain files.
          </Text>
        </Box>
      )}

      {/* 상태바 */}
      <StatusBar
        model={model}
        contextUsage={contextUsage}
        attempts={attempts}
        error={lastError}
      />
    </Box>
  );
}
