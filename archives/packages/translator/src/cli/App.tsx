/**
 * CLI App Component
 *
 * Main Ink component for the Translator CLI.
 */

import React, { useEffect } from "react";
import { Box, Text, useApp } from "ink";
import * as fs from "node:fs";
import type { AppProps } from "./types.js";
import type { DomainSchema } from "../domain/index.js";
import { useTranslator } from "./hooks/useTranslator.js";
import { Header } from "./components/Header.js";
import { StageProgress } from "./components/StageProgress.js";
import { StatusBar } from "./components/StatusBar.js";
import { AmbiguityPrompt } from "./components/AmbiguityPrompt.js";
import { Result } from "./components/Result.js";
import { Trace } from "./components/Trace.js";

/**
 * App component
 */
export function App(props: AppProps): React.ReactElement {
  const { exit } = useApp();

  const {
    state,
    progress,
    result,
    error,
    translate,
    resolve,
  } = useTranslator({
    worldId: props.worldId,
    schema: props.schema as DomainSchema | undefined,
    provider: props.provider,
    apiKey: props.apiKey,
    model: props.model,
  });

  // Start translation on mount
  useEffect(() => {
    translate(props.input);
  }, []);

  // Write output file when complete
  useEffect(() => {
    if (state === "complete" && result && props.outputFile) {
      try {
        fs.writeFileSync(
          props.outputFile,
          JSON.stringify(result, null, 2),
          "utf-8"
        );
      } catch (err) {
        // Ignore write errors in completion handler
      }
    }
  }, [state, result, props.outputFile]);

  // Write trace file when complete
  useEffect(() => {
    if ((state === "complete" || state === "error") && result?.trace && props.traceFile) {
      try {
        fs.writeFileSync(
          props.traceFile,
          JSON.stringify(result.trace, null, 2),
          "utf-8"
        );
      } catch (err) {
        // Ignore write errors
      }
    }
  }, [state, result, props.traceFile]);

  // Exit after completion (with delay for output)
  useEffect(() => {
    if (state === "complete" || state === "error") {
      const timer = setTimeout(() => {
        exit();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [state, exit]);

  // Handle ambiguity resolution
  const handleResolve = async (optionId: string) => {
    await resolve(optionId);
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      {props.verbosity !== "simple" && (
        <Header worldId={props.worldId} provider={props.provider} />
      )}

      {/* Stage Progress */}
      {props.verbosity !== "simple" && progress && state === "translating" && (
        <StageProgress progress={progress} />
      )}

      {/* Status Bar */}
      <StatusBar state={state} progress={progress} />

      {/* Ambiguity Prompt */}
      {state === "ambiguity" && result?.kind === "ambiguity" && (
        <AmbiguityPrompt
          report={result.report}
          onResolve={handleResolve}
        />
      )}

      {/* Result */}
      {state === "complete" && result && (
        <Result result={result} verbosity={props.verbosity} />
      )}

      {/* Error */}
      {state === "error" && error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error.message}</Text>
        </Box>
      )}

      {/* Trace (full verbosity) */}
      {props.verbosity === "full" && result?.trace && (
        <Trace trace={result.trace} />
      )}
    </Box>
  );
}
