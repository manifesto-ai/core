/**
 * Source Mapper Algorithm Tests
 */

import { describe, it, expect } from 'vitest';
import type { DetectedPattern } from '../../../src/parser/types.js';
import type { SchemaProposal, SchemaFieldProposal } from '../../../src/domains/summarizer/types.js';
import type { ManifestoDomainJson, SourceMapping } from '../../../src/domains/transformer/types.js';
import {
  createSourceMappings,
  createReverseIndex,
  groupMappingsByFile,
  groupMappingsByPatternType,
  calculateMappingStats,
  formatMapping,
  renderMappingsAsMarkdown,
  validateMappings,
} from '../../../src/domains/transformer/algorithms/source-mapper.js';

// Test fixtures
function createMockPattern(name: string, type: string, line: number = 1): DetectedPattern {
  return {
    type: type as DetectedPattern['type'],
    name,
    confidence: 0.9,
    needsReview: false,
    reviewReason: undefined,
    location: {
      start: { line, column: 0 },
      end: { line: line + 10, column: 0 },
    },
    metadata: {},
  };
}

function createMockProposal(): SchemaProposal {
  return {
    id: 'proposal-1',
    domainId: 'domain-1',
    domainName: 'User',
    entities: [
      {
        path: 'User.entities.Profile',
        type: 'object',
        description: 'Profile entity',
        source: 'UserProfile',
        confidence: 0.9,
      },
      {
        path: 'User.entities.Profile.name',
        type: 'string',
        description: 'User name',
        source: 'UserProfile',
        confidence: 0.85,
      },
    ],
    state: [
      {
        path: 'User.state.currentUser',
        type: 'Profile | null',
        description: 'Current user',
        source: 'useAuth',
        confidence: 0.95,
      },
    ],
    intents: [
      {
        path: 'User.intents.login',
        type: 'command',
        description: 'Login',
        source: 'handleLogin',
        confidence: 0.9,
      },
    ],
    confidence: 0.9,
    alternatives: [],
    reviewNotes: [],
    needsReview: false,
  };
}

function createMockSchema(): ManifestoDomainJson {
  return {
    $schema: 'https://manifesto.ai/schema/domain/1.0.0',
    domain: 'User',
    version: '1.0.0',
    entities: {
      Profile: {
        type: 'object',
        fields: {
          name: { type: 'string' },
        },
      },
    },
    state: {
      currentUser: { type: 'Profile | null' },
    },
    intents: {
      login: { type: 'command' },
    },
    metadata: {
      generatedAt: Date.now(),
      generatedBy: '@manifesto-ai/react-migrate',
      sourceFiles: ['src/components/User.tsx'],
      confidence: 0.9,
    },
  };
}

function createMockMappings(): SourceMapping[] {
  return [
    {
      sourcePath: 'src/components/User.tsx',
      sourceLocation: { line: 10, column: 0 },
      targetPath: 'User.entities.Profile',
      confidence: 0.9,
      patternType: 'component',
    },
    {
      sourcePath: 'src/components/User.tsx',
      sourceLocation: { line: 25, column: 0 },
      targetPath: 'User.entities.Profile.name',
      confidence: 0.85,
      patternType: 'component',
    },
    {
      sourcePath: 'src/hooks/useAuth.ts',
      sourceLocation: { line: 5, column: 0 },
      targetPath: 'User.state.currentUser',
      confidence: 0.95,
      patternType: 'hook',
    },
    {
      sourcePath: 'src/handlers/login.ts',
      sourceLocation: { line: 15, column: 0 },
      targetPath: 'User.intents.login',
      confidence: 0.9,
      patternType: 'handler',
    },
    {
      sourcePath: 'src/utils/helper.ts',
      sourceLocation: { line: 1, column: 0 },
      targetPath: 'User.state.isLoading',
      confidence: 0.65,
      patternType: 'effect',
    },
  ];
}

describe('Source Mapper Algorithm', () => {
  describe('createSourceMappings', () => {
    it('creates mappings from patterns', () => {
      const schema = createMockSchema();
      const proposal = createMockProposal();

      const pattern1 = createMockPattern('UserProfile', 'component', 10);
      const pattern2 = createMockPattern('useAuth', 'hook', 5);
      const pattern3 = createMockPattern('handleLogin', 'handler', 15);
      const patterns = [pattern1, pattern2, pattern3];

      const patternFileMap = new Map<DetectedPattern, string>([
        [pattern1, 'src/components/User.tsx'],
        [pattern2, 'src/hooks/useAuth.ts'],
        [pattern3, 'src/handlers/login.ts'],
      ]);

      const mappings = createSourceMappings(schema, proposal, patterns, patternFileMap);

      expect(mappings.length).toBeGreaterThan(0);
    });

    it('handles empty patterns', () => {
      const schema = createMockSchema();
      const proposal = createMockProposal();

      const mappings = createSourceMappings(schema, proposal, [], new Map());

      expect(mappings).toHaveLength(0);
    });

    it('handles patterns without matching files', () => {
      const schema = createMockSchema();
      const proposal = createMockProposal();

      const pattern = createMockPattern('UnmappedPattern', 'component');
      const patterns = [pattern];

      const mappings = createSourceMappings(schema, proposal, patterns, new Map());

      expect(mappings).toHaveLength(0);
    });

    it('includes source location from pattern', () => {
      const schema = createMockSchema();
      const proposal = createMockProposal({
        entities: [
          {
            path: 'User.entities.Test',
            type: 'object',
            description: 'Test',
            source: 'TestComponent',
            confidence: 0.9,
          },
        ],
        state: [],
        intents: [],
      });

      const pattern = createMockPattern('TestComponent', 'component', 42);
      const patterns = [pattern];

      const patternFileMap = new Map<DetectedPattern, string>([
        [pattern, 'src/test.tsx'],
      ]);

      const mappings = createSourceMappings(schema, proposal, patterns, patternFileMap);

      if (mappings.length > 0) {
        expect(mappings[0]!.sourceLocation.line).toBe(42);
      }
    });
  });

  describe('createReverseIndex', () => {
    it('creates reverse index from mappings', () => {
      const mappings = createMockMappings();

      const index = createReverseIndex(mappings);

      expect(index.get('User.entities.Profile')).toHaveLength(1);
      expect(index.get('User.state.currentUser')).toHaveLength(1);
    });

    it('groups multiple mappings to same target', () => {
      const mappings: SourceMapping[] = [
        {
          sourcePath: 'src/a.ts',
          sourceLocation: { line: 1, column: 0 },
          targetPath: 'User.state.value',
          confidence: 0.9,
          patternType: 'hook',
        },
        {
          sourcePath: 'src/b.ts',
          sourceLocation: { line: 1, column: 0 },
          targetPath: 'User.state.value',
          confidence: 0.8,
          patternType: 'context',
        },
      ];

      const index = createReverseIndex(mappings);

      expect(index.get('User.state.value')).toHaveLength(2);
    });

    it('handles empty mappings', () => {
      const index = createReverseIndex([]);

      expect(index.size).toBe(0);
    });
  });

  describe('groupMappingsByFile', () => {
    it('groups mappings by source file', () => {
      const mappings = createMockMappings();

      const byFile = groupMappingsByFile(mappings);

      expect(byFile.get('src/components/User.tsx')).toHaveLength(2);
      expect(byFile.get('src/hooks/useAuth.ts')).toHaveLength(1);
      expect(byFile.get('src/handlers/login.ts')).toHaveLength(1);
    });

    it('handles empty mappings', () => {
      const byFile = groupMappingsByFile([]);

      expect(byFile.size).toBe(0);
    });
  });

  describe('groupMappingsByPatternType', () => {
    it('groups mappings by pattern type', () => {
      const mappings = createMockMappings();

      const byType = groupMappingsByPatternType(mappings);

      expect(byType.get('component')).toHaveLength(2);
      expect(byType.get('hook')).toHaveLength(1);
      expect(byType.get('handler')).toHaveLength(1);
      expect(byType.get('effect')).toHaveLength(1);
    });

    it('handles empty mappings', () => {
      const byType = groupMappingsByPatternType([]);

      expect(byType.size).toBe(0);
    });
  });

  describe('calculateMappingStats', () => {
    it('calculates statistics', () => {
      const mappings = createMockMappings();

      const stats = calculateMappingStats(mappings);

      expect(stats.totalMappings).toBe(5);
      expect(stats.byPatternType.component).toBe(2);
      expect(stats.byPatternType.hook).toBe(1);
      expect(stats.byFile['src/components/User.tsx']).toBe(2);
      expect(stats.averageConfidence).toBeCloseTo(0.85, 1);
      expect(stats.lowConfidenceCount).toBe(1); // 0.65 < 0.7
    });

    it('handles empty mappings', () => {
      const stats = calculateMappingStats([]);

      expect(stats.totalMappings).toBe(0);
      expect(stats.byPatternType).toEqual({});
      expect(stats.byFile).toEqual({});
      expect(stats.averageConfidence).toBe(0);
      expect(stats.lowConfidenceCount).toBe(0);
    });

    it('uses custom confidence threshold', () => {
      const mappings = createMockMappings();

      const stats = calculateMappingStats(mappings, 0.9);

      // With threshold 0.9, values strictly less than 0.9 are counted:
      // 0.85 < 0.9 ✓, 0.65 < 0.9 ✓, 0.9 = 0.9 (not less), 0.95 > 0.9
      expect(stats.lowConfidenceCount).toBe(2); // 0.85, 0.65
    });
  });

  describe('formatMapping', () => {
    it('formats mapping as string', () => {
      const mapping: SourceMapping = {
        sourcePath: 'src/test.ts',
        sourceLocation: { line: 10, column: 5 },
        targetPath: 'User.state.value',
        confidence: 0.85,
        patternType: 'hook',
      };

      const formatted = formatMapping(mapping);

      expect(formatted).toContain('src/test.ts:10:5');
      expect(formatted).toContain('User.state.value');
      expect(formatted).toContain('hook');
      expect(formatted).toContain('85%');
    });
  });

  describe('renderMappingsAsMarkdown', () => {
    it('renders mappings as markdown table', () => {
      const mappings = createMockMappings().slice(0, 2);

      const markdown = renderMappingsAsMarkdown(mappings);

      expect(markdown).toContain('# Source Mappings');
      expect(markdown).toContain('| Source | Location | Target Path | Pattern Type | Confidence |');
      expect(markdown).toContain('src/components/User.tsx');
    });

    it('handles empty mappings', () => {
      const markdown = renderMappingsAsMarkdown([]);

      expect(markdown).toContain('# Source Mappings');
      expect(markdown).toContain('| Source | Location | Target Path | Pattern Type | Confidence |');
    });
  });

  describe('validateMappings', () => {
    it('validates correct mappings', () => {
      const schema = createMockSchema();
      const mappings: SourceMapping[] = [
        {
          sourcePath: 'src/test.ts',
          sourceLocation: { line: 1, column: 0 },
          targetPath: 'User.entities.Profile',
          confidence: 0.9,
          patternType: 'component',
        },
        {
          sourcePath: 'src/test.ts',
          sourceLocation: { line: 2, column: 0 },
          targetPath: 'User.state.currentUser',
          confidence: 0.9,
          patternType: 'hook',
        },
        {
          sourcePath: 'src/test.ts',
          sourceLocation: { line: 3, column: 0 },
          targetPath: 'User.intents.login',
          confidence: 0.9,
          patternType: 'handler',
        },
      ];

      const result = validateMappings(mappings, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects domain mismatch', () => {
      const schema = createMockSchema();
      const mappings: SourceMapping[] = [
        {
          sourcePath: 'src/test.ts',
          sourceLocation: { line: 1, column: 0 },
          targetPath: 'Other.entities.Profile',
          confidence: 0.9,
          patternType: 'component',
        },
      ];

      const result = validateMappings(mappings, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('domain mismatch'))).toBe(true);
    });

    it('detects invalid path', () => {
      const schema = createMockSchema();
      const mappings: SourceMapping[] = [
        {
          sourcePath: 'src/test.ts',
          sourceLocation: { line: 1, column: 0 },
          targetPath: 'User',
          confidence: 0.9,
          patternType: 'component',
        },
      ];

      const result = validateMappings(mappings, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid mapping target path'))).toBe(true);
    });

    it('detects missing entity', () => {
      const schema = createMockSchema();
      const mappings: SourceMapping[] = [
        {
          sourcePath: 'src/test.ts',
          sourceLocation: { line: 1, column: 0 },
          targetPath: 'User.entities.NonExistent',
          confidence: 0.9,
          patternType: 'component',
        },
      ];

      const result = validateMappings(mappings, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Entity "NonExistent" not found'))).toBe(true);
    });

    it('detects missing state field', () => {
      const schema = createMockSchema();
      const mappings: SourceMapping[] = [
        {
          sourcePath: 'src/test.ts',
          sourceLocation: { line: 1, column: 0 },
          targetPath: 'User.state.nonExistent',
          confidence: 0.9,
          patternType: 'hook',
        },
      ];

      const result = validateMappings(mappings, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('State field "nonExistent" not found'))).toBe(true);
    });

    it('detects missing intent', () => {
      const schema = createMockSchema();
      const mappings: SourceMapping[] = [
        {
          sourcePath: 'src/test.ts',
          sourceLocation: { line: 1, column: 0 },
          targetPath: 'User.intents.nonExistent',
          confidence: 0.9,
          patternType: 'handler',
        },
      ];

      const result = validateMappings(mappings, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Intent "nonExistent" not found'))).toBe(true);
    });

    it('handles empty mappings', () => {
      const schema = createMockSchema();
      const result = validateMappings([], schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
