/**
 * Header Component
 *
 * Displays CLI header with world ID and provider info.
 */

import React from "react";
import { Box, Text } from "ink";
import type { Provider } from "../types.js";

export interface HeaderProps {
  worldId: string;
  provider: Provider;
}

export function Header({ worldId, provider }: HeaderProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">Manifesto Translator</Text>
        <Text color="gray"> v1.1.1</Text>
      </Box>
      <Box>
        <Text color="gray">World: </Text>
        <Text color="yellow">{worldId}</Text>
        <Text color="gray"> | Provider: </Text>
        <Text color="green">{provider}</Text>
      </Box>
    </Box>
  );
}
