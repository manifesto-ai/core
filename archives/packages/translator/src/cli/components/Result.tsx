/**
 * Result Component
 *
 * Displays translation result.
 */

import React from "react";
import { Box, Text } from "ink";
import type { TranslationResult, PatchFragment, PatchOp } from "../../domain/index.js";
import type { Verbosity } from "../types.js";

export interface ResultProps {
  result: TranslationResult;
  verbosity: Verbosity;
}

/**
 * Get display path from PatchOp
 */
function getOpPath(op: PatchOp): string {
  switch (op.kind) {
    case "defineType":
      return `types.${op.typeName}`;
    case "addField":
    case "addConstraint":
    case "setDefaultValue":
    case "widenFieldType":
    case "addComputed":
      return op.path;
    case "addAction":
    case "addActionParam":
    case "addActionAvailable":
    case "addActionGuard":
      return `actions.${op.actionName}`;
    default:
      return "(unknown)";
  }
}

/**
 * Get proposed value preview from PatchOp
 */
function getOpValue(op: PatchOp): string | undefined {
  switch (op.kind) {
    case "addField":
      if (op.defaultValue !== undefined) {
        return JSON.stringify(op.defaultValue);
      }
      return undefined;
    case "setDefaultValue":
      return JSON.stringify(op.value);
    default:
      return undefined;
  }
}

export function Result({ result, verbosity }: ResultProps): React.ReactElement {
  if (result.kind === "error") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="red">Translation Error:</Text>
        <Text color="red">{result.error.message}</Text>
      </Box>
    );
  }

  if (result.kind === "ambiguity") {
    // Ambiguity should be handled by AmbiguityPrompt
    return (
      <Box marginTop={1}>
        <Text color="yellow">Ambiguity detected (see prompt above)</Text>
      </Box>
    );
  }

  // Fragment result
  const { fragments } = result;

  if (verbosity === "simple") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="green">{fragments.length} fragment(s) generated</Text>
        {fragments.map((fragment) => (
          <Box key={fragment.fragmentId} marginLeft={2}>
            <Text color="gray">• </Text>
            <Text>{getOpPath(fragment.op)}</Text>
            <Text color="gray"> ({fragment.op.kind})</Text>
          </Box>
        ))}
      </Box>
    );
  }

  // Verbose or full output
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box marginBottom={1}>
        <Text bold color="green">Translation Result</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Fragments: </Text>
        <Text>{fragments.length}</Text>
      </Box>

      {fragments.map((fragment, index) => {
        const valuePrev = getOpValue(fragment.op);
        return (
          <Box key={fragment.fragmentId} flexDirection="column" marginBottom={1} marginLeft={2}>
            <Box>
              <Text color="cyan">[{index + 1}] </Text>
              <Text bold>{getOpPath(fragment.op)}</Text>
            </Box>
            <Box marginLeft={2}>
              <Text color="gray">Op: </Text>
              <Text color="yellow">{fragment.op.kind}</Text>
            </Box>
            <Box marginLeft={2}>
              <Text color="gray">Confidence: </Text>
              <Text>{Math.round(fragment.confidence * 100)}%</Text>
            </Box>
            {valuePrev !== undefined && (
              <Box marginLeft={2}>
                <Text color="gray">Value: </Text>
                <Text>{valuePrev}</Text>
              </Box>
            )}
            {verbosity === "full" && (
              <Box marginLeft={2}>
                <Text color="gray">ID: </Text>
                <Text dimColor>{fragment.fragmentId}</Text>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
