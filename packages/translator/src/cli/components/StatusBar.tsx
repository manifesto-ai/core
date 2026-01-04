/**
 * StatusBar Component
 *
 * Displays current status with spinner.
 */

import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { CLIState, TranslationProgress } from "../types.js";

export interface StatusBarProps {
  state: CLIState;
  progress: TranslationProgress | null;
}

export function StatusBar({ state, progress }: StatusBarProps): React.ReactElement {
  if (state === "idle") {
    return (
      <Box>
        <Text color="gray">Ready</Text>
      </Box>
    );
  }

  if (state === "translating") {
    return (
      <Box>
        <Text color="green">
          <Spinner type="dots" />
        </Text>
        <Text> </Text>
        <Text color="yellow">
          {progress?.stageName ?? "Processing"}...
        </Text>
      </Box>
    );
  }

  if (state === "ambiguity") {
    return (
      <Box>
        <Text color="yellow">⚠</Text>
        <Text> Human decision required</Text>
      </Box>
    );
  }

  if (state === "complete") {
    return (
      <Box>
        <Text color="green">✓</Text>
        <Text> Translation complete</Text>
      </Box>
    );
  }

  if (state === "error") {
    return (
      <Box>
        <Text color="red">✗</Text>
        <Text color="red"> Translation failed</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color="gray">Unknown state</Text>
    </Box>
  );
}
