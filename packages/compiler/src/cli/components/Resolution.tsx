/**
 * Resolution Component
 *
 * Interactive UI for resolving ambiguity during compilation.
 * Uses ink-select-input for option selection.
 */

import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { ResolutionProps } from "../types.js";

interface SelectItem {
  label: string;
  value: string;
}

export const Resolution: React.FC<ResolutionProps> = ({
  reason,
  options,
  onSelect,
  onSkip,
}) => {
  const items: SelectItem[] = [
    ...options.map((opt, index) => ({
      label: `${index + 1}. ${opt.description}`,
      value: opt.id,
    })),
    {
      label: "Skip (discard compilation)",
      value: "__skip__",
    },
  ];

  const handleSelect = (item: SelectItem) => {
    if (item.value === "__skip__") {
      onSkip();
    } else {
      onSelect(item.value);
    }
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <Box marginBottom={1}>
        <Text color="yellow" bold>Resolution Required</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Reason: </Text>
        <Text>{reason}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text bold>Select an option:</Text>
      </Box>

      <SelectInput items={items} onSelect={handleSelect} />

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          Use arrow keys to navigate, Enter to select
        </Text>
      </Box>
    </Box>
  );
};

export default Resolution;
