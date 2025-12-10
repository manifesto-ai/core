/**
 * Clustering Algorithm Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFileSimilarity,
  clusterFiles,
  mapCandidatesToClusters,
  mergeClusters,
  clustersToDomainSummaries,
  performClustering,
} from '../../../src/domains/summarizer/algorithms/clustering.js';
import type { DependencyGraph, DomainCandidate } from '../../../src/domains/analyzer/types.js';

describe('Clustering Algorithm', () => {
  // Mock dependency graph
  const createMockGraph = (edges: Array<{ source: string; target: string }>): DependencyGraph => ({
    nodes: [...new Set(edges.flatMap(e => [e.source, e.target]))],
    edges: edges.map((e, i) => ({
      source: e.source,
      target: e.target,
      type: 'import' as const,
      weight: 1,
    })),
    entryPoints: [],
  });

  describe('calculateFileSimilarity', () => {
    it('should return high similarity for same directory', () => {
      const graph = createMockGraph([]);
      const similarity = calculateFileSimilarity(
        'src/user/profile.ts',
        'src/user/settings.ts',
        graph
      );
      expect(similarity).toBeGreaterThanOrEqual(0.3);
    });

    it('should return partial similarity for nested directories', () => {
      const graph = createMockGraph([]);
      const similarity = calculateFileSimilarity(
        'src/user/profile.ts',
        'src/user/components/avatar.ts',
        graph
      );
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(0.3);
    });

    it('should add similarity for direct import relationship', () => {
      const graph = createMockGraph([
        { source: 'src/user/profile.ts', target: 'src/user/api.ts' },
      ]);
      const withImport = calculateFileSimilarity(
        'src/user/profile.ts',
        'src/user/api.ts',
        graph
      );
      const withoutImport = calculateFileSimilarity(
        'src/user/profile.ts',
        'src/user/settings.ts',
        graph
      );
      expect(withImport).toBeGreaterThan(withoutImport);
    });

    it('should add similarity for similar naming', () => {
      const graph = createMockGraph([]);
      const similarity = calculateFileSimilarity(
        'src/UserProfile.ts',
        'src/UserSettings.ts',
        graph
      );
      // 'User' is common prefix
      expect(similarity).toBeGreaterThan(0);
    });

    it('should not exceed 1', () => {
      const graph = createMockGraph([
        { source: 'src/user/profile.ts', target: 'src/user/api.ts' },
      ]);
      const similarity = calculateFileSimilarity(
        'src/user/profile.ts',
        'src/user/api.ts',
        graph
      );
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('clusterFiles', () => {
    it('should cluster files with high similarity', () => {
      const files = [
        'src/user/profile.ts',
        'src/user/settings.ts',
        'src/auth/login.ts',
        'src/auth/logout.ts',
      ];
      const graph = createMockGraph([
        { source: 'src/user/profile.ts', target: 'src/user/settings.ts' },
        { source: 'src/auth/login.ts', target: 'src/auth/logout.ts' },
      ]);

      const result = clusterFiles(files, graph, 2, 0.3);
      expect(result.clusters.length).toBeGreaterThanOrEqual(1);
    });

    it('should put isolated files in noise', () => {
      const files = ['src/single.ts'];
      const graph = createMockGraph([]);

      const result = clusterFiles(files, graph, 2, 0.5);
      expect(result.noise).toContain('src/single.ts');
    });

    it('should respect minClusterSize', () => {
      const files = ['src/a.ts', 'src/b.ts'];
      const graph = createMockGraph([
        { source: 'src/a.ts', target: 'src/b.ts' },
      ]);

      const result = clusterFiles(files, graph, 3, 0.3);
      // Can't form cluster of size 3 with only 2 files
      expect(result.clusters).toHaveLength(0);
      expect(result.noise).toHaveLength(2);
    });

    it('should respect similarityThreshold', () => {
      const files = ['src/user/a.ts', 'src/auth/b.ts'];
      const graph = createMockGraph([]);

      // High threshold - different directories won't cluster
      const result = clusterFiles(files, graph, 2, 0.9);
      expect(result.clusters).toHaveLength(0);
    });
  });

  describe('mapCandidatesToClusters', () => {
    it('should map candidates to clusters', () => {
      const clusters = [
        {
          id: 'cluster-1',
          files: ['src/user/profile.ts', 'src/user/settings.ts'],
          centroid: 'src/user/profile.ts',
          density: 0.8,
          domainCandidates: [],
        },
      ];

      const candidates: DomainCandidate[] = [
        {
          id: 'candidate-1',
          name: 'user',
          sourceFiles: ['src/user/profile.ts'],
          confidence: 0.9,
          patterns: [],
          boundaries: { imports: [], exports: [] },
        },
      ];

      const mapped = mapCandidatesToClusters(candidates, clusters);
      expect(mapped[0]?.domainCandidates).toContain('candidate-1');
    });

    it('should not map unrelated candidates', () => {
      const clusters = [
        {
          id: 'cluster-1',
          files: ['src/user/profile.ts'],
          centroid: 'src/user/profile.ts',
          density: 0.8,
          domainCandidates: [],
        },
      ];

      const candidates: DomainCandidate[] = [
        {
          id: 'candidate-1',
          name: 'auth',
          sourceFiles: ['src/auth/login.ts'],
          confidence: 0.9,
          patterns: [],
          boundaries: { imports: [], exports: [] },
        },
      ];

      const mapped = mapCandidatesToClusters(candidates, clusters);
      expect(mapped[0]?.domainCandidates).toHaveLength(0);
    });
  });

  describe('mergeClusters', () => {
    it('should merge clusters sharing domain candidates', () => {
      // 같은 feature 디렉토리에 있는 클러스터들은 병합됨
      const clusters = [
        {
          id: 'cluster-1',
          files: ['src/features/user/profile.ts'],
          centroid: 'src/features/user/profile.ts',
          density: 0.8,
          domainCandidates: ['candidate-1'],
        },
        {
          id: 'cluster-2',
          files: ['src/features/user/settings.ts'],
          centroid: 'src/features/user/settings.ts',
          density: 0.7,
          domainCandidates: ['candidate-1'],
        },
      ];

      const merged = mergeClusters(clusters);
      expect(merged).toHaveLength(1);
      expect(merged[0]?.files).toContain('src/features/user/profile.ts');
      expect(merged[0]?.files).toContain('src/features/user/settings.ts');
    });

    it('should not merge clusters with different candidates', () => {
      const clusters = [
        {
          id: 'cluster-1',
          files: ['src/user/profile.ts'],
          centroid: 'src/user/profile.ts',
          density: 0.8,
          domainCandidates: ['candidate-1'],
        },
        {
          id: 'cluster-2',
          files: ['src/auth/login.ts'],
          centroid: 'src/auth/login.ts',
          density: 0.7,
          domainCandidates: ['candidate-2'],
        },
      ];

      const merged = mergeClusters(clusters);
      expect(merged).toHaveLength(2);
    });
  });

  describe('clustersToDomainSummaries', () => {
    it('should create summaries from clusters with candidates', () => {
      const clusters = [
        {
          id: 'cluster-1',
          files: ['src/user/profile.ts', 'src/user/settings.ts'],
          centroid: 'src/user/profile.ts',
          density: 0.8,
          domainCandidates: ['candidate-1'],
        },
      ];

      const candidates: DomainCandidate[] = [
        {
          id: 'candidate-1',
          name: 'user',
          sourceFiles: ['src/user/profile.ts'],
          confidence: 0.9,
          patterns: [],
          boundaries: { imports: [], exports: [] },
        },
      ];

      const summaries = clustersToDomainSummaries(clusters, candidates);
      expect(summaries).toHaveLength(1);
      expect(summaries[0]?.name).toBe('user');
      expect(summaries[0]?.sourceFiles).toContain('src/user/profile.ts');
      expect(summaries[0]?.sourceFiles).toContain('src/user/settings.ts');
    });

    it('should create inferred summary for cluster without candidates', () => {
      const clusters = [
        {
          id: 'cluster-1',
          files: ['src/utils/helper.ts'],
          centroid: 'src/utils/helper.ts',
          density: 0.5,
          domainCandidates: [],
        },
      ];

      const summaries = clustersToDomainSummaries(clusters, []);
      expect(summaries).toHaveLength(1);
      expect(summaries[0]?.name).toBe('helper');
      expect(summaries[0]?.needsReview).toBe(true);
    });
  });

  describe('performClustering', () => {
    it('should perform full clustering pipeline', () => {
      const candidates: DomainCandidate[] = [
        {
          id: 'candidate-1',
          name: 'user',
          sourceFiles: ['src/user/profile.ts', 'src/user/settings.ts'],
          confidence: 0.9,
          patterns: [],
          boundaries: { imports: [], exports: [] },
        },
        {
          id: 'candidate-2',
          name: 'auth',
          sourceFiles: ['src/auth/login.ts', 'src/auth/logout.ts'],
          confidence: 0.85,
          patterns: [],
          boundaries: { imports: [], exports: [] },
        },
      ];

      const graph = createMockGraph([
        { source: 'src/user/profile.ts', target: 'src/user/settings.ts' },
        { source: 'src/auth/login.ts', target: 'src/auth/logout.ts' },
      ]);

      const result = performClustering(candidates, graph, 2);
      expect(result.mergedDomains.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty candidates', () => {
      const graph = createMockGraph([]);
      const result = performClustering([], graph, 2);
      expect(result.clusters).toHaveLength(0);
      expect(result.mergedDomains).toHaveLength(0);
    });
  });
});
