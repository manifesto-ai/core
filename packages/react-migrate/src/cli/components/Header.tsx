import React from 'react';
import { Box, Text } from 'ink';

export interface HeaderProps {
  version: string;
}

export function Header({ version }: HeaderProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={0}
    >
      <Text bold color="cyan">
        @manifesto-ai/react-migrate v{version}
      </Text>
      <Text color="gray">
        React to Manifesto Domain Migration Tool
      </Text>
    </Box>
  );
}
