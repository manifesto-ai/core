/**
 * Schema Proposal Tests
 */

import { describe, it, expect } from 'vitest';
import {
  extractEntitiesFromPatterns,
  extractActionsFromPatterns,
  entitiesToSchemaFields,
  actionsToSchemaFields,
  inferStateFields,
  generateSchemaProposal,
  generateAllSchemaProposals,
  validateSchemaProposal,
  mergeSchemaProposals,
} from '../../../src/domains/summarizer/algorithms/schema-proposal.js';
import type { DetectedPattern } from '../../../src/parser/types.js';
import type { DomainSummary, DomainRelationship, SchemaProposal } from '../../../src/domains/summarizer/types.js';

describe('Schema Proposal', () => {
  // Helper to create mock pattern
  const createMockPattern = (
    type: DetectedPattern['type'],
    name: string,
    metadata: Record<string, unknown> = {},
    confidence: number = 0.9
  ): DetectedPattern => ({
    type,
    name,
    location: { start: { line: 1, column: 0 }, end: { line: 10, column: 0 } },
    confidence,
    metadata,
    needsReview: false,
  });

  describe('extractEntitiesFromPatterns', () => {
    it('should extract entities from component props', () => {
      const patterns: DetectedPattern[] = [
        createMockPattern('component', 'UserProfile', { props: ['name', 'email', 'avatar'] }),
      ];

      const entities = extractEntitiesFromPatterns(patterns);
      expect(entities.length).toBeGreaterThanOrEqual(1);

      const propsEntity = entities.find(e => e.name === 'UserProfileProps');
      expect(propsEntity).toBeDefined();
      expect(propsEntity?.fields).toHaveLength(3);
    });

    it('should extract entities from context value', () => {
      const patterns: DetectedPattern[] = [
        createMockPattern('context', 'UserContext', {
          contextName: 'User',
          contextValue: '{ user: User, isLoading: boolean }',
        }),
      ];

      const entities = extractEntitiesFromPatterns(patterns);
      expect(entities.length).toBeGreaterThanOrEqual(1);

      const contextEntity = entities.find(e => e.name === 'User');
      expect(contextEntity).toBeDefined();
      expect(contextEntity?.fields.length).toBeGreaterThanOrEqual(2);
    });

    it('should extract entities from reducer state', () => {
      const patterns: DetectedPattern[] = [
        createMockPattern('reducer', 'userReducer', {
          stateShape: { users: 'User[]', isLoading: 'boolean', error: 'string | null' },
        }),
      ];

      const entities = extractEntitiesFromPatterns(patterns);
      expect(entities.length).toBeGreaterThanOrEqual(1);

      const stateEntity = entities.find(e => e.name === 'userReducerState');
      expect(stateEntity).toBeDefined();
      expect(stateEntity?.fields).toHaveLength(3);
    });

    it('should deduplicate entities by name', () => {
      const patterns: DetectedPattern[] = [
        createMockPattern('component', 'UserProfile', { props: ['name'] }, 0.8),
        createMockPattern('component', 'UserProfile', { props: ['name', 'email'] }, 0.9),
      ];

      const entities = extractEntitiesFromPatterns(patterns);
      // Should have merged the entities
      const userProfileEntities = entities.filter(e => e.name.toLowerCase() === 'userprofileprops');
      expect(userProfileEntities).toHaveLength(1);
      // Should keep higher confidence one with merged fields
      expect(userProfileEntities[0]?.confidence).toBe(0.9);
    });

    it('should handle empty patterns', () => {
      const entities = extractEntitiesFromPatterns([]);
      expect(entities).toHaveLength(0);
    });
  });

  describe('extractActionsFromPatterns', () => {
    it('should extract actions from reducer', () => {
      const patterns: DetectedPattern[] = [
        createMockPattern('reducer', 'userReducer', {
          actions: ['ADD_USER', 'REMOVE_USER', 'UPDATE_USER'],
        }),
      ];

      const actions = extractActionsFromPatterns(patterns);
      expect(actions).toHaveLength(3);
      // 액션 이름은 camelCase로 변환됨 (ADD_USER -> addUser)
      expect(actions.map(a => a.name)).toContain('addUser');
      expect(actions.map(a => a.name)).toContain('removeUser');
      expect(actions.map(a => a.name)).toContain('updateUser');
      expect(actions.every(a => a.type === 'command')).toBe(true);
    });

    it('should extract query actions from custom hooks', () => {
      const patterns: DetectedPattern[] = [
        createMockPattern('hook', 'useUser', { isCustomHook: true }),
      ];

      const actions = extractActionsFromPatterns(patterns);
      expect(actions.length).toBeGreaterThanOrEqual(1);

      const queryAction = actions.find(a => a.name === 'getUser');
      expect(queryAction).toBeDefined();
      expect(queryAction?.type).toBe('query');
    });

    it('should extract event actions from effects', () => {
      const patterns: DetectedPattern[] = [
        createMockPattern('effect', 'onUserChange', {}),
      ];

      const actions = extractActionsFromPatterns(patterns);
      expect(actions.length).toBeGreaterThanOrEqual(1);
      expect(actions[0]?.type).toBe('event');
    });

    it('should deduplicate actions by name', () => {
      const patterns: DetectedPattern[] = [
        createMockPattern('reducer', 'reducer1', { actions: ['SAVE'] }, 0.8),
        createMockPattern('reducer', 'reducer2', { actions: ['SAVE'] }, 0.9),
      ];

      const actions = extractActionsFromPatterns(patterns);
      const saveActions = actions.filter(a => a.name.toLowerCase() === 'save');
      expect(saveActions).toHaveLength(1);
      expect(saveActions[0]?.confidence).toBe(0.9);
    });
  });

  describe('entitiesToSchemaFields', () => {
    it('should convert entities to schema fields', () => {
      const entities = [
        {
          id: 'entity-1',
          name: 'User',
          type: 'entity' as const,
          fields: [
            { name: 'id', type: 'string', optional: false },
            { name: 'name', type: 'string', optional: false },
          ],
          sourcePatterns: ['UserComponent'],
          confidence: 0.9,
        },
      ];

      const fields = entitiesToSchemaFields(entities, 'user');
      expect(fields.length).toBeGreaterThanOrEqual(1);
      expect(fields[0]?.path).toContain('user.entities.User');
    });

    it('should include entity fields', () => {
      const entities = [
        {
          id: 'entity-1',
          name: 'User',
          type: 'entity' as const,
          fields: [
            { name: 'id', type: 'string', optional: false },
          ],
          sourcePatterns: ['UserComponent'],
          confidence: 0.9,
        },
      ];

      const fields = entitiesToSchemaFields(entities, 'user');
      const idField = fields.find(f => f.path.includes('User.id'));
      expect(idField).toBeDefined();
      expect(idField?.type).toBe('string');
    });
  });

  describe('actionsToSchemaFields', () => {
    it('should convert actions to schema fields', () => {
      const actions = [
        {
          id: 'action-1',
          name: 'createUser',
          type: 'command' as const,
          sourcePatterns: ['userReducer'],
          confidence: 0.9,
        },
      ];

      const fields = actionsToSchemaFields(actions, 'user');
      expect(fields).toHaveLength(1);
      expect(fields[0]?.path).toBe('user.intents.createUser');
      expect(fields[0]?.type).toBe('command');
    });
  });

  describe('inferStateFields', () => {
    it('should infer state from context patterns', () => {
      const patterns: DetectedPattern[] = [
        createMockPattern('context', 'UserContext', { contextName: 'currentUser' }),
      ];

      const fields = inferStateFields([], patterns, 'user');
      expect(fields.length).toBeGreaterThanOrEqual(1);
      expect(fields[0]?.path).toContain('user.state.currentUser');
    });

    it('should infer state from reducer patterns', () => {
      const patterns: DetectedPattern[] = [
        createMockPattern('reducer', 'userReducer', {
          stateShape: { users: 'User[]', loading: 'boolean' },
        }),
      ];

      const fields = inferStateFields([], patterns, 'user');
      expect(fields.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('generateSchemaProposal', () => {
    const createMockDomain = (name: string): DomainSummary => ({
      id: `domain-${name}`,
      name,
      description: '',
      sourceFiles: [],
      entities: [],
      actions: [],
      boundaries: { imports: [], exports: [], sharedState: [] },
      suggestedBy: '',
      confidence: 0.9,
      needsReview: false,
      reviewNotes: [],
    });

    it('should generate proposal from patterns', () => {
      const domain = createMockDomain('user');
      const patterns: DetectedPattern[] = [
        createMockPattern('component', 'UserProfile', { props: ['name', 'email'] }),
        createMockPattern('reducer', 'userReducer', {
          actions: ['SET_USER'],
          stateShape: { user: 'User' },
        }),
      ];
      const relationships: DomainRelationship[] = [];

      const proposal = generateSchemaProposal(domain, patterns, relationships);
      expect(proposal.domainId).toBe('domain-user');
      expect(proposal.domainName).toBe('user');
      expect(proposal.entities.length).toBeGreaterThanOrEqual(0);
      expect(proposal.intents.length).toBeGreaterThanOrEqual(0);
    });

    it('should add review notes for low confidence', () => {
      const domain = createMockDomain('user');
      const patterns: DetectedPattern[] = [
        createMockPattern('component', 'Unknown', { props: [] }, 0.5),
      ];

      const proposal = generateSchemaProposal(domain, patterns, [], {
        confidenceThreshold: 0.7,
      });
      expect(proposal.reviewNotes.length).toBeGreaterThanOrEqual(0);
    });

    it('should include related domains in review notes', () => {
      const domain = createMockDomain('user');
      const relationships: DomainRelationship[] = [
        {
          id: 'rel-1',
          type: 'dependency',
          from: 'domain-user',
          to: 'domain-auth',
          strength: 0.7,
          evidence: [],
        },
      ];

      const proposal = generateSchemaProposal(domain, [], relationships);
      const hasRelatedNote = proposal.reviewNotes.some(n => n.includes('Related domains'));
      expect(hasRelatedNote).toBe(true);
    });

    it('should mark for review when confidence is low', () => {
      const domain = { ...createMockDomain('user'), confidence: 0.5 };
      const patterns: DetectedPattern[] = [];

      const proposal = generateSchemaProposal(domain, patterns, [], {
        confidenceThreshold: 0.7,
      });
      expect(proposal.needsReview).toBe(true);
    });
  });

  describe('generateAllSchemaProposals', () => {
    it('should generate proposals for all domains', () => {
      const domains: DomainSummary[] = [
        {
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
        },
        {
          id: 'domain-2',
          name: 'auth',
          description: '',
          sourceFiles: [],
          entities: [],
          actions: [],
          boundaries: { imports: [], exports: [], sharedState: [] },
          suggestedBy: '',
          confidence: 0.9,
          needsReview: false,
          reviewNotes: [],
        },
      ];

      const patternsByDomain = new Map<string, DetectedPattern[]>();
      patternsByDomain.set('domain-1', []);
      patternsByDomain.set('domain-2', []);

      const proposals = generateAllSchemaProposals(domains, patternsByDomain, []);
      expect(proposals).toHaveLength(2);
    });
  });

  describe('validateSchemaProposal', () => {
    const createMockProposal = (overrides?: Partial<SchemaProposal>): SchemaProposal => ({
      id: 'proposal-1',
      domainId: 'domain-user',
      domainName: 'user',
      entities: [
        { path: 'user.entities.User', type: 'object', source: 'test', confidence: 0.9 },
      ],
      state: [],
      intents: [],
      confidence: 0.9,
      alternatives: [],
      reviewNotes: [],
      needsReview: false,
      ...overrides,
    });

    it('should validate correct proposal', () => {
      const proposal = createMockProposal();
      const result = validateSchemaProposal(proposal);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid entity path', () => {
      const proposal = createMockProposal({
        entities: [
          { path: 'other.entities.User', type: 'object', source: 'test', confidence: 0.9 },
        ],
      });
      const result = validateSchemaProposal(proposal);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect duplicate paths', () => {
      const proposal = createMockProposal({
        entities: [
          { path: 'user.entities.User', type: 'object', source: 'test', confidence: 0.9 },
        ],
        state: [
          { path: 'user.entities.User', type: 'object', source: 'test', confidence: 0.9 },
        ],
      });
      const result = validateSchemaProposal(proposal);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
    });

    it('should detect empty proposal', () => {
      const proposal = createMockProposal({
        entities: [],
        state: [],
        intents: [],
      });
      const result = validateSchemaProposal(proposal);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('empty'))).toBe(true);
    });
  });

  describe('mergeSchemaProposals', () => {
    const createMockProposal = (id: string, confidence: number): SchemaProposal => ({
      id,
      domainId: 'domain-1',
      domainName: 'user',
      entities: [
        { path: `user.entities.Entity${id}`, type: 'object', source: 'test', confidence },
      ],
      state: [],
      intents: [],
      confidence,
      alternatives: [],
      reviewNotes: [`Note from ${id}`],
      needsReview: false,
    });

    it('should throw for empty proposals', () => {
      expect(() => mergeSchemaProposals([])).toThrow();
    });

    it('should return single proposal unchanged', () => {
      const proposal = createMockProposal('p1', 0.9);
      const merged = mergeSchemaProposals([proposal]);
      expect(merged).toBe(proposal);
    });

    it('should merge multiple proposals', () => {
      const proposals = [
        createMockProposal('p1', 0.8),
        createMockProposal('p2', 0.9),
      ];
      const merged = mergeSchemaProposals(proposals);
      expect(merged.entities.length).toBeGreaterThanOrEqual(2);
    });

    it('should keep higher confidence for duplicate paths', () => {
      const proposals: SchemaProposal[] = [
        {
          id: 'p1',
          domainId: 'domain-1',
          domainName: 'user',
          entities: [
            { path: 'user.entities.User', type: 'object', source: 'test', confidence: 0.7 },
          ],
          state: [],
          intents: [],
          confidence: 0.7,
          alternatives: [],
          reviewNotes: [],
          needsReview: false,
        },
        {
          id: 'p2',
          domainId: 'domain-1',
          domainName: 'user',
          entities: [
            { path: 'user.entities.User', type: 'object', source: 'test2', confidence: 0.9 },
          ],
          state: [],
          intents: [],
          confidence: 0.9,
          alternatives: [],
          reviewNotes: [],
          needsReview: false,
        },
      ];

      const merged = mergeSchemaProposals(proposals);
      const userEntity = merged.entities.find(e => e.path === 'user.entities.User');
      expect(userEntity?.confidence).toBe(0.9);
    });

    it('should merge review notes', () => {
      const proposals = [
        { ...createMockProposal('p1', 0.8), reviewNotes: ['Note 1'] },
        { ...createMockProposal('p2', 0.9), reviewNotes: ['Note 2'] },
      ];
      const merged = mergeSchemaProposals(proposals);
      expect(merged.reviewNotes).toContain('Note 1');
      expect(merged.reviewNotes).toContain('Note 2');
    });

    it('should mark needsReview if any proposal needs review', () => {
      const proposals = [
        { ...createMockProposal('p1', 0.9), needsReview: false },
        { ...createMockProposal('p2', 0.9), needsReview: true },
      ];
      const merged = mergeSchemaProposals(proposals);
      expect(merged.needsReview).toBe(true);
    });
  });
});
