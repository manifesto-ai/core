/**
 * Main App Component (v1.1)
 *
 * Orchestrates the CLI UI based on compiler state.
 */

import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { useCompiler } from "./hooks/useCompiler.js";
import { Header } from "./components/Header.js";
import { Progress } from "./components/Progress.js";
import { StatusBar } from "./components/StatusBar.js";
import { Metrics } from "./components/Metrics.js";
import { Resolution } from "./components/Resolution.js";
import { Result } from "./components/Result.js";
import { Error } from "./components/Error.js";
import type { AppProps } from "./types.js";

const VERSION = "1.1.0";

export const App: React.FC<AppProps> = ({
  input,
  provider,
  apiKey,
  model,
  verbosity,
  outputFile,
}) => {
  const { exit } = useApp();
  const { state, start, acceptPlan, rejectPlan, resolveConflict, reset } = useCompiler({
    provider,
    apiKey,
    model,
    verbosity,
  });
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Start compilation on mount
  useEffect(() => {
    if (!started) {
      setStarted(true);
      start(input).catch((error) => {
        console.error("Compilation error:", error);
      });
    }
  }, [input, start, started]);

  // Update elapsed time
  useEffect(() => {
    if (state.status !== "idle" && state.status !== "success" && state.status !== "failed") {
      const interval = setInterval(() => {
        setElapsed(Date.now() - state.metrics.startTime);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [state.status, state.metrics.startTime]);

  // Exit on terminal state
  useEffect(() => {
    if (state.status === "success" || state.status === "failed") {
      // Delay to allow final render and file write
      const timeout = setTimeout(() => {
        exit();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [state.status, exit]);

  // Resolution pending -> show interactive UI
  if (state.resolutionPending) {
    return (
      <Box flexDirection="column">
        {verbosity !== "simple" && <Header version={VERSION} input={input} />}
        <Resolution
          reason={state.resolutionPending.reason}
          options={state.resolutionPending.options}
          onSelect={(optionId) => {
            // Handle plan acceptance/rejection or conflict resolution
            if (state.status === "awaiting_plan_decision") {
              if (optionId === "accept") {
                acceptPlan();
              } else if (optionId === "reject") {
                rejectPlan("User rejected the plan");
              }
            } else if (state.status === "awaiting_conflict_resolution") {
              // Use the first pending resolution if available
              resolveConflict("pending", optionId);
            }
          }}
          onSkip={() => reset()}
        />
      </Box>
    );
  }

  // Terminal states
  if (state.status === "success") {
    return (
      <Box flexDirection="column">
        {verbosity !== "simple" && <Header version={VERSION} input={input} />}
        {verbosity !== "simple" && <Progress status={state.status} currentPhase={state.phase} />}
        {verbosity === "full" && <Metrics metrics={state.metrics} status={state.status} />}
        <Result result={state.result} verbosity={verbosity} outputFile={outputFile} />
      </Box>
    );
  }

  if (state.status === "failed") {
    return (
      <Box flexDirection="column">
        {verbosity !== "simple" && <Header version={VERSION} input={input} />}
        {verbosity !== "simple" && <Progress status={state.status} currentPhase={state.phase} />}
        {verbosity === "full" && <Metrics metrics={state.metrics} status={state.status} />}
        <Error reason={state.error} />
      </Box>
    );
  }

  // Simple mode: just spinner and status
  if (verbosity === "simple") {
    return (
      <Box>
        <StatusBar
          status={state.status}
          phase={state.phase}
          isSpinning={state.status !== "idle"}
        />
        {elapsed > 0 && (
          <Text color="gray"> ({(elapsed / 1000).toFixed(1)}s)</Text>
        )}
      </Box>
    );
  }

  // Verbose/Full mode: show progress
  return (
    <Box flexDirection="column">
      <Header version={VERSION} input={input} />
      <Progress status={state.status} currentPhase={state.phase} />
      <StatusBar
        status={state.status}
        phase={state.phase}
        isSpinning={state.status !== "idle"}
      />
      {verbosity === "full" && <Metrics metrics={state.metrics} status={state.status} />}
      {elapsed > 0 && (
        <Box marginTop={1}>
          <Text color="gray">Elapsed: {(elapsed / 1000).toFixed(1)}s</Text>
        </Box>
      )}
    </Box>
  );
};

export default App;
