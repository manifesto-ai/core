import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { HITLRequest } from '../../domains/types.js';

export interface HITLPromptProps {
  request: HITLRequest;
  onResolve: (optionId: string, customInput?: string) => void;
}

interface SelectItem {
  label: string;
  value: string;
}

export function HITLPrompt({ request, onResolve }: HITLPromptProps) {
  const items: SelectItem[] = request.options.map((opt, index) => ({
    label: `[${index + 1}] ${opt.label}`,
    value: opt.id,
  }));

  // 항상 마지막에 Skip 옵션 추가
  items.push({
    label: `[${items.length + 1}] Skip and mark for manual review`,
    value: '__skip__',
  });

  const handleSelect = (item: SelectItem) => {
    onResolve(item.value);
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="yellow">
        ! Human input needed:
      </Text>

      <Box marginY={1} flexDirection="column">
        <Box>
          <Text>File: </Text>
          <Text color="cyan">{request.file}</Text>
        </Box>

        {request.pattern && (
          <Box marginTop={0}>
            <Text>Pattern: </Text>
            <Text color="gray">{request.pattern}</Text>
          </Box>
        )}
      </Box>

      <Box marginY={1}>
        <Text>{request.question}</Text>
      </Box>

      <Box marginTop={1}>
        <SelectInput items={items} onSelect={handleSelect} />
      </Box>
    </Box>
  );
}
