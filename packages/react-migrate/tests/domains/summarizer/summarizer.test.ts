/**
 * Summarizer Domain Tests
 *
 * Summarizer 도메인의 순수 함수 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SUMMARIZER_CONFIG,
  createInitialData,
  createInitialState,
  addDomain,
  updateDomain,
  removeDomain,
  createDomainSummary,
  addRelationship,
  addRelationships,
  getRelationshipsForDomain,
  getRelationshipBetween,
  addConflict,
  resolveConflict,
  getUnresolvedConflicts,
  createOwnershipConflict,
  createNamingConflict,
  addSchemaProposal,
  updateSchemaProposal,
  markProposalReviewed,
  setClusteringState,
  startClustering,
  completeClustering,
  incrementAttempts,
  incrementLLMCalls,
  setLastProcessedDomain,
  updateProcessingRate,
  addError,
  calculateDerived,
  isSummarizationComplete,
  needsReview,
  generateId,
} from '../../../src/domains/summarizer/summarizer.js';
import type {
  DomainSummary,
  DomainRelationship,
  DomainConflict,
  SchemaProposal,
  ConflictResolution,
} from '../../../src/domains/summarizer/types.js';
import type { DomainCandidate } from '../../../src/domains/analyzer/types.js';

describe('Summarizer Domain', () => {
  describe('Default Config', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_SUMMARIZER_CONFIG).toEqual({
        minClusterSize: 2,
        confidenceThreshold: 0.7,
        enableLLMEnrichment: true,
        maxAlternatives: 3,
      });
    });
  });

  describe('createInitialData', () => {
    it('should create empty data with default config', () => {
      const data = createInitialData('analyzer-123');
      expect(data.analyzerRef).toBe('analyzer-123');
      expect(data.domains).toEqual({});
      expect(data.conflicts).toEqual([]);
      expect(data.config).toEqual(DEFAULT_SUMMARIZER_CONFIG);
    });

    it('should merge custom config', () => {
      const data = createInitialData('analyzer-123', { minClusterSize: 5 });
      expect(data.config.minClusterSize).toBe(5);
      expect(data.config.confidenceThreshold).toBe(0.7);
    });
  });

  describe('createInitialState', () => {
    it('should create empty state', () => {
      const state = createInitialState();
      expect(state.relationships).toEqual({
        dependencies: [],
        sharedState: [],
        eventFlows: [],
      });
      expect(state.schemaProposals).toEqual({});
      expect(state.clustering.status).toBe('idle');
      expect(state.ambiguous).toEqual([]);
      expect(state.meta.attempts).toBe(0);
      expect(state.meta.llmCallCount).toBe(0);
    });
  });

  describe('Domain Management', () => {
    const mockDomain: DomainSummary = {
      id: 'domain-1',
      name: 'user',
      description: 'User domain',
      sourceFiles: ['src/user.ts'],
      entities: [],
      actions: [],
      boundaries: { imports: [], exports: [], sharedState: [] },
      suggestedBy: 'candidate-1',
      confidence: 0.9,
      needsReview: false,
      reviewNotes: [],
    };

    it('should add domain', () => {
      const data = createInitialData();
      const updated = addDomain(data, mockDomain);
      expect(updated.domains['domain-1']).toEqual(mockDomain);
    });

    it('should update domain with partial updates', () => {
      let data = createInitialData();
      data = addDomain(data, mockDomain);
      const updated = updateDomain(data, 'domain-1', { confidence: 0.95 });
      expect(updated.domains['domain-1']?.confidence).toBe(0.95);
      expect(updated.domains['domain-1']?.name).toBe('user');
    });

    it('should update domain with full replacement', () => {
      let data = createInitialData();
      data = addDomain(data, mockDomain);
      const newDomain: DomainSummary = { ...mockDomain, name: 'updated-user' };
      const updated = updateDomain(data, newDomain);
      expect(updated.domains['domain-1']?.name).toBe('updated-user');
    });

    it('should remove domain', () => {
      let data = createInitialData();
      data = addDomain(data, mockDomain);
      const updated = removeDomain(data, 'domain-1');
      expect(updated.domains['domain-1']).toBeUndefined();
    });

    it('should not fail when updating non-existent domain', () => {
      const data = createInitialData();
      const updated = updateDomain(data, 'non-existent', { confidence: 0.5 });
      expect(updated).toEqual(data);
    });
  });

  describe('createDomainSummary', () => {
    it('should create summary from candidate', () => {
      const candidate: DomainCandidate = {
        id: 'candidate-1',
        name: 'auth',
        sourceFiles: ['src/auth.ts', 'src/login.ts'],
        confidence: 0.85,
        patterns: [],
        boundaries: { imports: [], exports: [] },
      };

      const summary = createDomainSummary(candidate, 'Authentication domain');
      expect(summary.id).toBe('summary-candidate-1');
      expect(summary.name).toBe('auth');
      expect(summary.description).toBe('Authentication domain');
      expect(summary.sourceFiles).toEqual(['src/auth.ts', 'src/login.ts']);
      expect(summary.confidence).toBe(0.85);
      expect(summary.needsReview).toBe(false); // 0.85 >= 0.7
    });

    it('should mark low confidence domains for review', () => {
      const candidate: DomainCandidate = {
        id: 'candidate-1',
        name: 'unknown',
        sourceFiles: [],
        confidence: 0.5,
        patterns: [],
        boundaries: { imports: [], exports: [] },
      };

      const summary = createDomainSummary(candidate);
      expect(summary.needsReview).toBe(true);
    });
  });

  describe('Relationship Management', () => {
    const mockRelationship: DomainRelationship = {
      id: 'rel-1',
      type: 'dependency',
      from: 'domain-1',
      to: 'domain-2',
      strength: 0.7,
      evidence: ['file1 imports file2'],
    };

    it('should add relationship to correct category', () => {
      const state = createInitialState();
      const updated = addRelationship(state, mockRelationship);
      expect(updated.relationships.dependencies).toContainEqual(mockRelationship);
      expect(updated.relationships.sharedState).toHaveLength(0);
    });

    it('should add shared_state relationship to correct category', () => {
      const state = createInitialState();
      const rel: DomainRelationship = { ...mockRelationship, type: 'shared_state' };
      const updated = addRelationship(state, rel);
      expect(updated.relationships.sharedState).toContainEqual(rel);
    });

    it('should add event_flow relationship to correct category', () => {
      const state = createInitialState();
      const rel: DomainRelationship = { ...mockRelationship, type: 'event_flow' };
      const updated = addRelationship(state, rel);
      expect(updated.relationships.eventFlows).toContainEqual(rel);
    });

    it('should not add duplicate relationship', () => {
      let state = createInitialState();
      state = addRelationship(state, mockRelationship);
      state = addRelationship(state, mockRelationship);
      expect(state.relationships.dependencies).toHaveLength(1);
    });

    it('should add multiple relationships', () => {
      const state = createInitialState();
      const rels: DomainRelationship[] = [
        mockRelationship,
        { ...mockRelationship, id: 'rel-2', type: 'shared_state' },
        { ...mockRelationship, id: 'rel-3', type: 'event_flow' },
      ];
      const updated = addRelationships(state, rels);
      expect(updated.relationships.dependencies).toHaveLength(1);
      expect(updated.relationships.sharedState).toHaveLength(1);
      expect(updated.relationships.eventFlows).toHaveLength(1);
    });

    it('should get relationships for domain', () => {
      let state = createInitialState();
      state = addRelationship(state, mockRelationship);
      state = addRelationship(state, {
        ...mockRelationship,
        id: 'rel-2',
        from: 'domain-2',
        to: 'domain-3',
      });

      const rels = getRelationshipsForDomain(state, 'domain-1');
      expect(rels).toHaveLength(1);
      expect(rels[0]?.id).toBe('rel-1');
    });

    it('should get relationship between two domains', () => {
      let state = createInitialState();
      state = addRelationship(state, mockRelationship);

      const rel = getRelationshipBetween(state, 'domain-1', 'domain-2');
      expect(rel?.id).toBe('rel-1');

      const rel2 = getRelationshipBetween(state, 'domain-2', 'domain-1');
      expect(rel2?.id).toBe('rel-1'); // Should work both ways

      const rel3 = getRelationshipBetween(state, 'domain-1', 'domain-3');
      expect(rel3).toBeNull();
    });
  });

  describe('Conflict Management', () => {
    it('should add conflict', () => {
      const data = createInitialData();
      const conflict: DomainConflict = {
        id: 'conflict-1',
        type: 'ownership',
        domains: ['domain-1', 'domain-2'],
        file: 'shared.ts',
        description: 'File claimed by multiple domains',
        suggestedResolutions: [],
      };

      const updated = addConflict(data, conflict);
      expect(updated.conflicts).toContainEqual(conflict);
    });

    it('should not add duplicate conflict', () => {
      let data = createInitialData();
      const conflict: DomainConflict = {
        id: 'conflict-1',
        type: 'ownership',
        domains: ['domain-1', 'domain-2'],
        description: 'Test conflict',
        suggestedResolutions: [],
      };

      data = addConflict(data, conflict);
      data = addConflict(data, conflict);
      expect(data.conflicts).toHaveLength(1);
    });

    it('should resolve conflict', () => {
      let data = createInitialData();
      const conflict: DomainConflict = {
        id: 'conflict-1',
        type: 'ownership',
        domains: ['domain-1', 'domain-2'],
        description: 'Test conflict',
        suggestedResolutions: [],
      };
      data = addConflict(data, conflict);

      const resolution: ConflictResolution = {
        id: 'res-1',
        label: 'Assign to domain-1',
        action: 'assign',
        params: { domainId: 'domain-1' },
        confidence: 0.9,
      };

      const updated = resolveConflict(data, 'conflict-1', resolution);
      expect(updated.conflicts).toHaveLength(0);
    });

    it('should get unresolved conflicts', () => {
      let data = createInitialData();
      const conflict: DomainConflict = {
        id: 'conflict-1',
        type: 'ownership',
        domains: ['domain-1', 'domain-2'],
        description: 'Test conflict',
        suggestedResolutions: [],
      };
      data = addConflict(data, conflict);

      const unresolved = getUnresolvedConflicts(data);
      expect(unresolved).toHaveLength(1);
    });

    it('should create ownership conflict', () => {
      const conflict = createOwnershipConflict('shared.ts', ['domain-1', 'domain-2']);
      expect(conflict.type).toBe('ownership');
      expect(conflict.file).toBe('shared.ts');
      expect(conflict.domains).toEqual(['domain-1', 'domain-2']);
    });

    it('should create naming conflict', () => {
      const conflict = createNamingConflict(['domain-1', 'domain-2']);
      expect(conflict.type).toBe('naming');
      expect(conflict.domains).toEqual(['domain-1', 'domain-2']);
    });
  });

  describe('Schema Proposal Management', () => {
    const mockProposal: SchemaProposal = {
      id: 'proposal-1',
      domainId: 'domain-1',
      domainName: 'user',
      entities: [],
      state: [],
      intents: [],
      confidence: 0.85,
      alternatives: [],
      reviewNotes: [],
      needsReview: false,
    };

    it('should add schema proposal', () => {
      const state = createInitialState();
      const updated = addSchemaProposal(state, mockProposal);
      expect(updated.schemaProposals['domain-1']).toEqual(mockProposal);
    });

    it('should update schema proposal', () => {
      let state = createInitialState();
      state = addSchemaProposal(state, mockProposal);
      const updated = updateSchemaProposal(state, 'domain-1', { confidence: 0.95 });
      expect(updated.schemaProposals['domain-1']?.confidence).toBe(0.95);
    });

    it('should mark proposal as reviewed', () => {
      let state = createInitialState();
      state = addSchemaProposal(state, { ...mockProposal, needsReview: true });
      const updated = markProposalReviewed(state, 'domain-1');
      expect(updated.schemaProposals['domain-1']?.needsReview).toBe(false);
    });
  });

  describe('Clustering State', () => {
    it('should set clustering state', () => {
      const state = createInitialState();
      const updated = setClusteringState(state, { status: 'clustering', progress: 50 });
      expect(updated.clustering.status).toBe('clustering');
      expect(updated.clustering.progress).toBe(50);
    });

    it('should start clustering', () => {
      const state = createInitialState();
      const updated = startClustering(state);
      expect(updated.clustering.status).toBe('clustering');
      expect(updated.clustering.progress).toBe(0);
    });

    it('should complete clustering', () => {
      let state = createInitialState();
      state = startClustering(state);
      const updated = completeClustering(state);
      expect(updated.clustering.status).toBe('done');
      expect(updated.clustering.progress).toBe(100);
    });
  });

  describe('Meta Updates', () => {
    it('should increment attempts', () => {
      const state = createInitialState();
      const updated = incrementAttempts(state);
      expect(updated.meta.attempts).toBe(1);
    });

    it('should increment LLM calls', () => {
      const state = createInitialState();
      const updated = incrementLLMCalls(state);
      expect(updated.meta.llmCallCount).toBe(1);
    });

    it('should set last processed domain', () => {
      const state = createInitialState();
      const updated = setLastProcessedDomain(state, 'domain-1');
      expect(updated.meta.lastProcessedDomain).toBe('domain-1');
    });

    it('should update processing rate', () => {
      const state = createInitialState();
      const updated = updateProcessingRate(state, 10, 5);
      expect(updated.meta.processingRate).toBe(2); // 10 domains / 5 seconds
    });

    it('should handle zero elapsed time', () => {
      const state = createInitialState();
      const updated = updateProcessingRate(state, 10, 0);
      expect(updated.meta.processingRate).toBe(0);
    });

    it('should add error as string', () => {
      const state = createInitialState();
      const updated = addError(state, 'Test error', 'domain-1');
      expect(updated.meta.errors).toHaveLength(1);
      expect(updated.meta.errors[0]?.error).toBe('Test error');
      expect(updated.meta.errors[0]?.domain).toBe('domain-1');
    });

    it('should add error as object', () => {
      const state = createInitialState();
      const updated = addError(state, {
        code: 'ERR_TEST',
        message: 'Test error message',
        recoverable: true,
      });
      expect(updated.meta.errors).toHaveLength(1);
      expect(updated.meta.errors[0]?.error).toBe('Test error message');
    });
  });

  describe('calculateDerived', () => {
    it('should calculate derived values for empty state', () => {
      const data = createInitialData();
      const state = createInitialState();
      const derived = calculateDerived(data, state);

      expect(derived.domainsTotal).toBe(0);
      expect(derived.domainsProcessed).toBe(0);
      expect(derived.conflictsUnresolved).toBe(0);
      expect(derived.proposalsReady).toBe(0);
      expect(derived.overallConfidence).toBe(0);
      expect(derived.progress).toBe(0);
    });

    it('should calculate derived values with domains and proposals', () => {
      let data = createInitialData();
      let state = createInitialState();

      // Add domains
      const domain1: DomainSummary = {
        id: 'domain-1',
        name: 'user',
        description: '',
        sourceFiles: [],
        entities: [],
        actions: [],
        boundaries: { imports: [], exports: [], sharedState: [] },
        suggestedBy: '',
        confidence: 0.8,
        needsReview: false,
        reviewNotes: [],
      };
      const domain2: DomainSummary = { ...domain1, id: 'domain-2', confidence: 0.9 };
      data = addDomain(data, domain1);
      data = addDomain(data, domain2);

      // Add proposal for one domain
      const proposal: SchemaProposal = {
        id: 'proposal-1',
        domainId: 'domain-1',
        domainName: 'user',
        entities: [],
        state: [],
        intents: [],
        confidence: 0.85,
        alternatives: [],
        reviewNotes: [],
        needsReview: false,
      };
      state = addSchemaProposal(state, proposal);

      const derived = calculateDerived(data, state);
      expect(derived.domainsTotal).toBe(2);
      expect(derived.domainsProcessed).toBe(1);
      expect(derived.proposalsReady).toBe(1);
      expect(derived.overallConfidence).toBeCloseTo(0.85, 5); // (0.8 + 0.9) / 2
      expect(derived.progress).toBe(50); // 1/2 * 100
    });
  });

  describe('Utilities', () => {
    it('should check summarization complete', () => {
      let data = createInitialData();
      let state = createInitialState();

      // Empty state is not complete
      expect(isSummarizationComplete(data, state)).toBe(false);

      // Add domain
      const domain: DomainSummary = {
        id: 'domain-1',
        name: 'user',
        description: '',
        sourceFiles: [],
        entities: [],
        actions: [],
        boundaries: { imports: [], exports: [], sharedState: [] },
        suggestedBy: '',
        confidence: 0.9,
        needsReview: false,
        reviewNotes: [],
      };
      data = addDomain(data, domain);

      // Still not complete - no proposal
      expect(isSummarizationComplete(data, state)).toBe(false);

      // Add proposal
      const proposal: SchemaProposal = {
        id: 'proposal-1',
        domainId: 'domain-1',
        domainName: 'user',
        entities: [],
        state: [],
        intents: [],
        confidence: 0.85,
        alternatives: [],
        reviewNotes: [],
        needsReview: false,
      };
      state = addSchemaProposal(state, proposal);

      // Now complete
      expect(isSummarizationComplete(data, state)).toBe(true);

      // Add conflict - not complete anymore
      const conflict: DomainConflict = {
        id: 'conflict-1',
        type: 'ownership',
        domains: ['domain-1'],
        description: 'Test',
        suggestedResolutions: [],
      };
      data = addConflict(data, conflict);
      expect(isSummarizationComplete(data, state)).toBe(false);
    });

    it('should check if domain needs review', () => {
      const domain: DomainSummary = {
        id: 'domain-1',
        name: 'user',
        description: '',
        sourceFiles: [],
        entities: [],
        actions: [],
        boundaries: { imports: [], exports: [], sharedState: [] },
        suggestedBy: '',
        confidence: 0.8,
        needsReview: false,
        reviewNotes: [],
      };

      expect(needsReview(domain, 0.7)).toBe(false);
      expect(needsReview(domain, 0.9)).toBe(true); // below threshold
      expect(needsReview({ ...domain, needsReview: true }, 0.5)).toBe(true); // flagged
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate ID with prefix', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test-/);
    });
  });
});
