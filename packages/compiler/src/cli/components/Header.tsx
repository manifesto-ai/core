/**
 * Header Component
 *
 * Displays CLI title, version, and input preview.
 */

import React from "react";
import { Box, Text } from "ink";
import type { HeaderProps } from "../types.js";

const MAX_INPUT_LENGTH = 60;

export const Header: React.FC<HeaderProps> = ({ version, input }) => {
  const truncatedInput =
    input.length > MAX_INPUT_LENGTH
      ? input.substring(0, MAX_INPUT_LENGTH) + "..."
      : input;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">
        manifesto-compile{" "}
        <Text color="gray">v{version}</Text>
      </Text>
      <Box marginTop={1}>
        <Text color="gray">Input: </Text>
        <Text>{truncatedInput}</Text>
      </Box>
    </Box>
  );
};

export default Header;
