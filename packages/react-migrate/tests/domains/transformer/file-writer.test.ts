/**
 * File Writer Algorithm Tests
 */

import { describe, it, expect } from 'vitest';
import type { DomainFile, ManifestoDomainJson, SourceMapping, RollbackPoint } from '../../../src/domains/transformer/types.js';
import {
  createOutputStructure,
  serializeMigrationLog,
  serializeSourceMappings,
  getOutputFilePaths,
  createRestoreCommands,
  createWritePlan,
  summarizeWritePlan,
  calculateTotalSize,
} from '../../../src/domains/transformer/algorithms/file-writer.js';

// Test fixtures
function createMockSchema(domain: string): ManifestoDomainJson {
  return {
    $schema: 'https://manifesto.ai/schema/domain/1.0.0',
    domain,
    version: '1.0.0',
    entities: {
      Entity1: {
        type: 'object',
        fields: {
          field1: { type: 'string' },
        },
      },
    },
    state: {
      value: { type: 'string' },
    },
    intents: {
      action1: { type: 'command' },
    },
    metadata: {
      generatedAt: Date.now(),
      generatedBy: '@manifesto-ai/react-migrate',
      sourceFiles: [`src/${domain.toLowerCase()}.ts`],
      confidence: 0.9,
    },
  };
}

function createMockDomainFile(domain: string): DomainFile {
  return {
    id: `file-${domain}`,
    name: `${domain}.domain.json`,
    path: `./output/${domain}.domain.json`,
    content: createMockSchema(domain),
    sourceMappings: [
      {
        sourcePath: `src/${domain.toLowerCase()}.ts`,
        sourceLocation: { line: 1, column: 0 },
        targetPath: `${domain}.entities.Entity1`,
        confidence: 0.9,
        patternType: 'component',
      },
    ],
    writtenAt: null,
  };
}

describe('File Writer Algorithm', () => {
  describe('createOutputStructure', () => {
    it('creates output structure from domain files', () => {
      const files = [
        createMockDomainFile('User'),
        createMockDomainFile('Product'),
      ];

      const structure = createOutputStructure(files, './output');

      expect(structure.domains).toHaveLength(2);
      expect(structure.meta.migrationLog).toBeDefined();
      expect(structure.meta.sourceMappings).toBeDefined();
    });

    it('generates domain file info', () => {
      const files = [createMockDomainFile('User')];

      const structure = createOutputStructure(files, './output');

      expect(structure.domains[0]!.name).toBe('User.domain.json');
      expect(structure.domains[0]!.path).toBe('./output/User.domain.json');
      expect(structure.domains[0]!.content).toContain('"domain": "User"');
      expect(structure.domains[0]!.size).toBeGreaterThan(0);
    });

    it('generates migration log', () => {
      const files = [
        createMockDomainFile('User'),
        createMockDomainFile('Product'),
      ];

      const structure = createOutputStructure(files, './output');

      expect(structure.meta.migrationLog.version).toBe('1.0.0');
      expect(structure.meta.migrationLog.timestamp).toBeGreaterThan(0);
      expect(structure.meta.migrationLog.domains).toHaveLength(2);
      expect(structure.meta.migrationLog.summary.totalDomains).toBe(2);
    });

    it('calculates summary statistics', () => {
      const files = [createMockDomainFile('User')];

      const structure = createOutputStructure(files, './output');

      expect(structure.meta.migrationLog.summary.totalDomains).toBe(1);
      expect(structure.meta.migrationLog.summary.totalEntities).toBe(1);
      expect(structure.meta.migrationLog.summary.totalIntents).toBe(1);
      expect(structure.meta.migrationLog.summary.averageConfidence).toBe(0.9);
    });

    it('collects source mappings by domain', () => {
      const files = [
        createMockDomainFile('User'),
        createMockDomainFile('Product'),
      ];

      const structure = createOutputStructure(files, './output');

      expect(structure.meta.sourceMappings.mappings['User']).toHaveLength(1);
      expect(structure.meta.sourceMappings.mappings['Product']).toHaveLength(1);
    });

    it('handles empty files list', () => {
      const structure = createOutputStructure([], './output');

      expect(structure.domains).toHaveLength(0);
      expect(structure.meta.migrationLog.summary.totalDomains).toBe(0);
      expect(structure.meta.migrationLog.summary.averageConfidence).toBe(0);
    });
  });

  describe('serializeMigrationLog', () => {
    it('serializes migration log to JSON', () => {
      const files = [createMockDomainFile('User')];
      const structure = createOutputStructure(files, './output');

      const serialized = serializeMigrationLog(structure.meta.migrationLog);

      expect(typeof serialized).toBe('string');
      expect(() => JSON.parse(serialized)).not.toThrow();
    });

    it('formats with indentation', () => {
      const files = [createMockDomainFile('User')];
      const structure = createOutputStructure(files, './output');

      const serialized = serializeMigrationLog(structure.meta.migrationLog);

      expect(serialized).toContain('\n');
      expect(serialized).toContain('  ');
    });
  });

  describe('serializeSourceMappings', () => {
    it('serializes source mappings to JSON', () => {
      const files = [createMockDomainFile('User')];
      const structure = createOutputStructure(files, './output');

      const serialized = serializeSourceMappings(structure.meta.sourceMappings);

      expect(typeof serialized).toBe('string');
      expect(() => JSON.parse(serialized)).not.toThrow();
    });
  });

  describe('getOutputFilePaths', () => {
    it('generates file paths for domains', () => {
      const paths = getOutputFilePaths('./output', ['User', 'Product']);

      expect(paths).toContain('./output/User.domain.json');
      expect(paths).toContain('./output/Product.domain.json');
    });

    it('includes meta files', () => {
      const paths = getOutputFilePaths('./output', ['User']);

      expect(paths).toContain('./output/_meta/migration.log.json');
      expect(paths).toContain('./output/_meta/source-mapping.json');
    });

    it('handles empty domain list', () => {
      const paths = getOutputFilePaths('./output', []);

      expect(paths).toHaveLength(2); // Only meta files
      expect(paths).toContain('./output/_meta/migration.log.json');
      expect(paths).toContain('./output/_meta/source-mapping.json');
    });
  });

  describe('createRestoreCommands', () => {
    it('creates write commands for existing files', () => {
      const rollback: RollbackPoint = {
        id: 'rollback-1',
        timestamp: Date.now(),
        description: 'Test rollback',
        files: [
          { path: '/output/User.domain.json', content: '{}' },
        ],
      };

      const commands = createRestoreCommands(rollback);

      expect(commands).toHaveLength(1);
      expect(commands[0]!.action).toBe('write');
      expect(commands[0]!.path).toBe('/output/User.domain.json');
      expect(commands[0]!.content).toBe('{}');
    });

    it('creates delete commands for non-existing files', () => {
      const rollback: RollbackPoint = {
        id: 'rollback-1',
        timestamp: Date.now(),
        description: 'Test rollback',
        files: [
          { path: '/output/New.domain.json', content: null },
        ],
      };

      const commands = createRestoreCommands(rollback);

      expect(commands).toHaveLength(1);
      expect(commands[0]!.action).toBe('delete');
      expect(commands[0]!.path).toBe('/output/New.domain.json');
    });

    it('handles mixed file states', () => {
      const rollback: RollbackPoint = {
        id: 'rollback-1',
        timestamp: Date.now(),
        description: 'Test rollback',
        files: [
          { path: '/output/Existing.json', content: '{"existing": true}' },
          { path: '/output/New.json', content: null },
        ],
      };

      const commands = createRestoreCommands(rollback);

      expect(commands).toHaveLength(2);
      expect(commands[0]!.action).toBe('write');
      expect(commands[1]!.action).toBe('delete');
    });
  });

  describe('createWritePlan', () => {
    it('creates write plan from structure', () => {
      const files = [createMockDomainFile('User')];
      const structure = createOutputStructure(files, './output');

      const plan = createWritePlan(structure, './output');

      expect(plan.filesToWrite.length).toBeGreaterThan(0);
      expect(plan.directoriesToCreate.length).toBeGreaterThan(0);
      expect(plan.filesToBackup.length).toBeGreaterThan(0);
    });

    it('includes domain files', () => {
      const files = [createMockDomainFile('User'), createMockDomainFile('Product')];
      const structure = createOutputStructure(files, './output');

      const plan = createWritePlan(structure, './output');

      const domainFiles = plan.filesToWrite.filter(f => f.path.includes('.domain.json'));
      expect(domainFiles).toHaveLength(2);
    });

    it('includes meta files', () => {
      const files = [createMockDomainFile('User')];
      const structure = createOutputStructure(files, './output');

      const plan = createWritePlan(structure, './output');

      const metaFiles = plan.filesToWrite.filter(f => f.path.includes('_meta'));
      expect(metaFiles.length).toBeGreaterThanOrEqual(2);
    });

    it('extracts directories to create', () => {
      const files = [createMockDomainFile('User')];
      const structure = createOutputStructure(files, './output');

      const plan = createWritePlan(structure, './output');

      expect(plan.directoriesToCreate).toContain('./output/_meta');
    });

    it('lists files to backup', () => {
      const files = [createMockDomainFile('User')];
      const structure = createOutputStructure(files, './output');

      const plan = createWritePlan(structure, './output');

      expect(plan.filesToBackup).toContain('./output/User.domain.json');
    });
  });

  describe('summarizeWritePlan', () => {
    it('summarizes write plan', () => {
      const files = [createMockDomainFile('User')];
      const structure = createOutputStructure(files, './output');
      const plan = createWritePlan(structure, './output');

      const summary = summarizeWritePlan(plan);

      expect(summary).toContain('Files to write:');
      expect(summary).toContain('Directories to create:');
      expect(summary).toContain('User.domain.json');
      expect(summary).toContain('bytes');
    });

    it('handles empty plan', () => {
      const structure = createOutputStructure([], './output');
      const plan = createWritePlan(structure, './output');

      const summary = summarizeWritePlan(plan);

      expect(summary).toContain('Files to write:');
    });
  });

  describe('calculateTotalSize', () => {
    it('calculates total output size', () => {
      const files = [createMockDomainFile('User')];
      const structure = createOutputStructure(files, './output');

      const size = calculateTotalSize(structure);

      expect(size).toBeGreaterThan(0);
    });

    it('includes all files in size', () => {
      const files = [
        createMockDomainFile('User'),
        createMockDomainFile('Product'),
      ];
      const structure = createOutputStructure(files, './output');

      const size = calculateTotalSize(structure);

      // Total size should be greater than sum of domain files
      const domainFilesSize = structure.domains.reduce((sum, d) => sum + d.size, 0);
      expect(size).toBeGreaterThan(domainFilesSize);
    });

    it('handles empty structure', () => {
      const structure = createOutputStructure([], './output');

      const size = calculateTotalSize(structure);

      // Should still have size from meta files
      expect(size).toBeGreaterThan(0);
    });
  });
});
