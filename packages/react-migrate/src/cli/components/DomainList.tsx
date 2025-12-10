import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { DiscoveredDomain } from '../../domains/types.js';

export interface DomainListProps {
  domains: DiscoveredDomain[];
  maxDisplay?: number;
}

function getStatusIndicator(status: DiscoveredDomain['status']) {
  switch (status) {
    case 'done':
      return { symbol: 'v', color: 'green' as const };
    case 'analyzing':
      return { symbol: '>', color: 'yellow' as const };
    case 'pending':
      return { symbol: 'o', color: 'gray' as const };
  }
}

function formatConfidence(confidence: number): string {
  return (confidence * 100).toFixed(0) + '%';
}

export function DomainList({ domains, maxDisplay = 10 }: DomainListProps) {
  if (domains.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>Domains identified: </Text>
        <Text color="gray">  (none yet)</Text>
      </Box>
    );
  }

  const displayDomains = domains.slice(0, maxDisplay);
  const remaining = domains.length - maxDisplay;

  return (
    <Box flexDirection="column">
      <Text bold>Domains identified: {domains.length}</Text>

      {displayDomains.map((domain) => {
        const { symbol, color } = getStatusIndicator(domain.status);
        const isAnalyzing = domain.status === 'analyzing';

        return (
          <Box key={domain.name} paddingLeft={2}>
            {isAnalyzing ? (
              <Text color="yellow">
                <Spinner type="dots" />
              </Text>
            ) : (
              <Text color={color}>{symbol}</Text>
            )}
            <Text> </Text>
            <Text color={color}>{domain.name}</Text>
            <Text color="gray">
              {' '}({domain.files.length} files, confidence: {formatConfidence(domain.confidence)})
            </Text>
          </Box>
        );
      })}

      {remaining > 0 && (
        <Box paddingLeft={2}>
          <Text color="gray">  ... and {remaining} more</Text>
        </Box>
      )}
    </Box>
  );
}
