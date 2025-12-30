/**
 * Result Component
 *
 * Displays compilation result.
 */

import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ResultProps } from "../types.js";

export const Result: React.FC<ResultProps> = ({
  result,
  verbosity,
  outputFile,
}) => {
  const jsonOutput = JSON.stringify(result, null, 2);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [written, setWritten] = useState(false);

  // Write to file synchronously on first render
  useEffect(() => {
    if (outputFile && !written) {
      try {
        const outputPath = path.isAbsolute(outputFile)
          ? outputFile
          : path.join(process.cwd(), outputFile);
        fs.writeFileSync(outputPath, jsonOutput, "utf-8");
        setWritten(true);
      } catch (error) {
        setWriteError(error instanceof Error ? error.message : String(error));
      }
    }
  }, [outputFile, jsonOutput, written]);

  // Simple mode: just success message
  if (verbosity === "simple") {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="green">✓ Done</Text>
          {outputFile && written && (
            <Text color="gray"> (saved to {outputFile})</Text>
          )}
        </Box>
        {writeError && (
          <Text color="red">Error writing file: {writeError}</Text>
        )}
      </Box>
    );
  }

  // Verbose/Full mode: show result summary
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="green" bold>✓ Compilation Successful</Text>
      </Box>

      {writeError ? (
        <Text color="red">Error writing file: {writeError}</Text>
      ) : outputFile ? (
        <Box>
          <Text color="gray">Result saved to: </Text>
          <Text color="cyan">{path.isAbsolute(outputFile) ? outputFile : path.join(process.cwd(), outputFile)}</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text color="gray" bold>Result:</Text>
          <Box marginTop={1} borderStyle="single" paddingX={1}>
            <Text>{jsonOutput}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Result;
