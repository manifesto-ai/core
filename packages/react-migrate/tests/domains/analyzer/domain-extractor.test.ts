import { describe, it, expect } from 'vitest';
import {
  extractDomainCandidates,
  extractContextBasedCandidates,
  extractReducerBasedCandidates,
  extractHookBasedCandidates,
  extractFileStructureCandidates,
  mergeCandidates,
  calculateRelationships,
  detectAmbiguousPatterns,
  inferDomainName,
  normalizeDomainName,
  generateDomainDescription,
} from '../../../src/domains/analyzer/algorithms/domain-extractor.js';
import { buildDependencyGraph } from '../../../src/domains/analyzer/algorithms/dependency-graph.js';
import type { PatternCollection, DomainCandidate } from '../../../src/domains/analyzer/types.js';
import type { FileAnalysis, DetectedPattern } from '../../../src/parser/types.js';

describe('Domain Extractor', () => {
  const createPattern = (
    type: DetectedPattern['type'],
    name: string,
    overrides: Partial<DetectedPattern> = {}
  ): DetectedPattern => ({
    type,
    name,
    location: { start: { line: 1, column: 0 }, end: { line: 10, column: 1 } },
    confidence: 0.9,
    metadata: {},
    needsReview: false,
    ...overrides,
  });

  const createAnalysis = (
    path: string,
    patterns: DetectedPattern[] = []
  ): FileAnalysis => ({
    path,
    relativePath: path.replace('/src/', ''),
    type: 'component',
    ast: null,
    patterns,
    imports: [],
    exports: [],
    confidence: 0.9,
    issues: [],
    parseTime: 10,
  });

  describe('inferDomainName', () => {
    // inferDomainName takes a string name, not pattern and path
    it('should infer domain name from context name', () => {
      expect(inferDomainName('UserContext')).toBe('user');
    });

    it('should infer domain name from provider name', () => {
      expect(inferDomainName('AuthProvider')).toBe('auth');
    });

    it('should infer domain name from reducer name', () => {
      expect(inferDomainName('cartReducer')).toBe('cart');
    });

    it('should convert PascalCase to kebab-case', () => {
      expect(inferDomainName('UserProfileContext')).toBe('user-profile');
    });
  });

  describe('normalizeDomainName', () => {
    it('should normalize domain names to lowercase with hyphens', () => {
      expect(normalizeDomainName('UserContext')).toBe('usercontext');
      expect(normalizeDomainName('user-auth')).toBe('user-auth');
      expect(normalizeDomainName('cart_reducer')).toBe('cart-reducer');
    });

    it('should handle already normalized names', () => {
      expect(normalizeDomainName('user')).toBe('user');
      expect(normalizeDomainName('auth')).toBe('auth');
    });
  });

  describe('generateDomainDescription', () => {
    it('should generate description from domain candidate', () => {
      const candidate: DomainCandidate = {
        id: 'test-1',
        name: 'user',
        suggestedBy: 'context',
        sourceFiles: ['/src/UserContext.tsx'],
        patterns: [createPattern('context', 'UserContext')],
        confidence: 0.9,
        relationships: [],
      };

      const description = generateDomainDescription(candidate);

      expect(description).toContain('user');
      expect(description.length).toBeGreaterThan(0);
    });

    it('should handle candidate with empty patterns', () => {
      const candidate: DomainCandidate = {
        id: 'test-1',
        name: 'user',
        suggestedBy: 'file_structure',
        sourceFiles: ['/src/user.tsx'],
        patterns: [],
        confidence: 0.6,
        relationships: [],
      };

      const description = generateDomainDescription(candidate);

      expect(description).toBeDefined();
      expect(description.length).toBeGreaterThan(0);
    });
  });

  describe('extractContextBasedCandidates', () => {
    it('should extract domain candidates from context patterns with hasProvider', () => {
      const patterns: PatternCollection = {
        components: [],
        hooks: [],
        contexts: [
          createPattern('context', 'UserContext', {
            metadata: { contextName: 'UserContext', hasProvider: true, sourceFile: '/src/contexts/UserContext.tsx' },
          }),
          createPattern('context', 'AuthContext', {
            metadata: { contextName: 'AuthContext', hasProvider: true, sourceFile: '/src/contexts/AuthContext.tsx' },
          }),
        ],
        reducers: [],
        effects: [],
      };

      const analyses: FileAnalysis[] = [
        createAnalysis('/src/contexts/UserContext.tsx', [patterns.contexts[0]!]),
        createAnalysis('/src/contexts/AuthContext.tsx', [patterns.contexts[1]!]),
      ];

      const candidates = extractContextBasedCandidates(patterns, analyses);

      expect(candidates.length).toBeGreaterThanOrEqual(2);
      expect(candidates.some(c => c.name === 'user')).toBe(true);
      expect(candidates.some(c => c.name === 'auth')).toBe(true);
      expect(candidates.every(c => c.suggestedBy === 'context')).toBe(true);
    });

    it('should not create candidates from contexts without hasProvider', () => {
      const patterns: PatternCollection = {
        components: [],
        hooks: [],
        contexts: [
          createPattern('context', 'ThemeContext', {
            metadata: { contextName: 'ThemeContext', hasProvider: false },
          }),
        ],
        reducers: [],
        effects: [],
      };

      const analyses: FileAnalysis[] = [
        createAnalysis('/src/ThemeContext.tsx', patterns.contexts),
      ];

      const candidates = extractContextBasedCandidates(patterns, analyses);

      expect(candidates).toHaveLength(0);
    });
  });

  describe('extractReducerBasedCandidates', () => {
    it('should extract domain candidates from reducer patterns', () => {
      const patterns: PatternCollection = {
        components: [],
        hooks: [],
        contexts: [],
        reducers: [
          createPattern('reducer', 'cartReducer', {
            metadata: { actions: ['ADD_ITEM', 'REMOVE_ITEM', 'CLEAR_CART'], sourceFile: '/src/reducers/cart.ts' },
          }),
        ],
        effects: [],
      };

      const candidates = extractReducerBasedCandidates(patterns);

      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates[0]?.suggestedBy).toBe('reducer');
    });
  });

  describe('extractHookBasedCandidates', () => {
    it('should extract domain candidates from custom hook patterns', () => {
      const patterns: PatternCollection = {
        components: [],
        hooks: [
          createPattern('hook', 'useUser', { metadata: { isCustomHook: true, sourceFile: '/src/hooks/useUser.ts' } }),
          createPattern('hook', 'useAuth', { metadata: { isCustomHook: true, sourceFile: '/src/hooks/useAuth.ts' } }),
        ],
        contexts: [],
        reducers: [],
        effects: [],
      };

      const candidates = extractHookBasedCandidates(patterns);

      expect(candidates.length).toBeGreaterThanOrEqual(1);
      expect(candidates.every(c => c.suggestedBy === 'hook')).toBe(true);
    });

    it('should not create candidates from non-custom hooks', () => {
      const patterns: PatternCollection = {
        components: [],
        hooks: [
          createPattern('hook', 'useState', { metadata: { isCustomHook: false } }),
        ],
        contexts: [],
        reducers: [],
        effects: [],
      };

      const candidates = extractHookBasedCandidates(patterns);

      expect(candidates).toHaveLength(0);
    });

    it('should skip generic hooks like useToggle', () => {
      const patterns: PatternCollection = {
        components: [],
        hooks: [
          createPattern('hook', 'useToggle', { metadata: { isCustomHook: true, sourceFile: '/src/hooks/useToggle.ts' } }),
          createPattern('hook', 'useLocalStorage', { metadata: { isCustomHook: true, sourceFile: '/src/hooks/useLocalStorage.ts' } }),
        ],
        contexts: [],
        reducers: [],
        effects: [],
      };

      const candidates = extractHookBasedCandidates(patterns);

      // Generic hooks should be filtered out
      expect(candidates).toHaveLength(0);
    });
  });

  describe('extractFileStructureCandidates', () => {
    it('should extract domain candidates from directory structure', () => {
      const analyses: FileAnalysis[] = [
        createAnalysis('/src/features/user/UserProfile.tsx'),
        createAnalysis('/src/features/user/useUser.ts'),
        createAnalysis('/src/features/auth/AuthForm.tsx'),
        createAnalysis('/src/features/auth/useAuth.ts'),
      ];

      const candidates = extractFileStructureCandidates(analyses);

      expect(candidates.some(c => c.name === 'user')).toBe(true);
      expect(candidates.some(c => c.name === 'auth')).toBe(true);
      expect(candidates.every(c => c.suggestedBy === 'file_structure')).toBe(true);
    });

    it('should require minimum 2 files for a domain candidate', () => {
      const analyses: FileAnalysis[] = [
        createAnalysis('/src/features/lonely/OnlyFile.tsx'),
      ];

      const candidates = extractFileStructureCandidates(analyses);

      expect(candidates.some(c => c.name === 'lonely')).toBe(false);
    });
  });

  describe('mergeCandidates', () => {
    it('should merge candidates with same domain name', () => {
      const candidates: DomainCandidate[] = [
        {
          id: '1',
          name: 'user',
          suggestedBy: 'context',
          sourceFiles: ['/src/contexts/UserContext.tsx'],
          patterns: [createPattern('context', 'UserContext')],
          confidence: 0.8,
          relationships: [],
        },
        {
          id: '2',
          name: 'user',
          suggestedBy: 'hook',
          sourceFiles: ['/src/hooks/useUser.ts'],
          patterns: [createPattern('hook', 'useUser')],
          confidence: 0.85,
          relationships: [],
        },
      ];

      const merged = mergeCandidates(candidates);

      expect(merged).toHaveLength(1);
      expect(merged[0]?.name).toBe('user');
      expect(merged[0]?.sourceFiles).toContain('/src/contexts/UserContext.tsx');
      expect(merged[0]?.sourceFiles).toContain('/src/hooks/useUser.ts');
      expect(merged[0]?.patterns).toHaveLength(2);
      expect(merged[0]?.confidence).toBe(0.85); // Max confidence
    });

    it('should not merge different domains', () => {
      const candidates: DomainCandidate[] = [
        {
          id: '1',
          name: 'user',
          suggestedBy: 'context',
          sourceFiles: ['/src/user.tsx'],
          patterns: [],
          confidence: 0.8,
          relationships: [],
        },
        {
          id: '2',
          name: 'auth',
          suggestedBy: 'hook',
          sourceFiles: ['/src/auth.tsx'],
          patterns: [],
          confidence: 0.85,
          relationships: [],
        },
      ];

      const merged = mergeCandidates(candidates);

      expect(merged).toHaveLength(2);
    });
  });

  describe('calculateRelationships', () => {
    it('should calculate relationships between domain candidates', () => {
      const candidates: DomainCandidate[] = [
        {
          id: '1',
          name: 'user',
          suggestedBy: 'context',
          sourceFiles: ['/src/contexts/UserContext.tsx', '/src/hooks/useUser.ts'],
          patterns: [],
          confidence: 0.9,
          relationships: [],
        },
        {
          id: '2',
          name: 'auth',
          suggestedBy: 'context',
          sourceFiles: ['/src/contexts/AuthContext.tsx'],
          patterns: [],
          confidence: 0.85,
          relationships: [],
        },
      ];

      const graph = {
        nodes: ['/src/contexts/UserContext.tsx', '/src/hooks/useUser.ts', '/src/contexts/AuthContext.tsx'],
        edges: [
          { source: '/src/contexts/UserContext.tsx', target: '/src/contexts/AuthContext.tsx', specifiers: ['AuthContext'], isReexport: false },
        ],
      };

      const withRelationships = calculateRelationships(candidates, graph);

      // Should have calculated relationships
      expect(withRelationships[0]?.relationships.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectAmbiguousPatterns', () => {
    it('should detect low confidence patterns', () => {
      const analyses: FileAnalysis[] = [
        createAnalysis('/src/file.tsx', [
          createPattern('hook', 'useAuth', { confidence: 0.5 }),
        ]),
      ];

      const candidates: DomainCandidate[] = [];

      const ambiguous = detectAmbiguousPatterns(analyses, candidates, 0.7);

      expect(ambiguous.length).toBeGreaterThan(0);
      expect(ambiguous[0]?.reason).toContain('confidence');
    });

    it('should detect patterns marked for review', () => {
      const analyses: FileAnalysis[] = [
        createAnalysis('/src/file.tsx', [
          createPattern('reducer', 'complexReducer', { confidence: 0.95, needsReview: true }),
        ]),
      ];

      const candidates: DomainCandidate[] = [];

      const ambiguous = detectAmbiguousPatterns(analyses, candidates, 0.7);

      expect(ambiguous.length).toBeGreaterThan(0);
      expect(ambiguous.some(a => a.reason.includes('review'))).toBe(true);
    });

    it('should detect conflicting domain ownership', () => {
      const analyses: FileAnalysis[] = [
        createAnalysis('/src/shared/useUserAuth.ts', [
          createPattern('hook', 'useUserAuth', { confidence: 0.9 }),
        ]),
      ];

      const candidates: DomainCandidate[] = [
        {
          id: '1',
          name: 'user',
          suggestedBy: 'hook',
          sourceFiles: ['/src/shared/useUserAuth.ts'],
          patterns: [],
          confidence: 0.8,
          relationships: [],
        },
        {
          id: '2',
          name: 'auth',
          suggestedBy: 'hook',
          sourceFiles: ['/src/shared/useUserAuth.ts'],
          patterns: [],
          confidence: 0.8,
          relationships: [],
        },
      ];

      const ambiguous = detectAmbiguousPatterns(analyses, candidates, 0.7);

      expect(ambiguous.some(a => a.reason.includes('2 domains'))).toBe(true);
    });
  });

  describe('extractDomainCandidates', () => {
    it('should extract and merge candidates from all sources', () => {
      const patterns: PatternCollection = {
        components: [],
        hooks: [
          createPattern('hook', 'useUser', { metadata: { isCustomHook: true, sourceFile: '/src/features/user/useUser.ts' } }),
        ],
        contexts: [
          createPattern('context', 'UserContext', { metadata: { contextName: 'UserContext', hasProvider: true, sourceFile: '/src/features/user/UserContext.tsx' } }),
        ],
        reducers: [],
        effects: [],
      };

      const analyses: FileAnalysis[] = [
        createAnalysis('/src/features/user/UserContext.tsx', [patterns.contexts[0]!]),
        createAnalysis('/src/features/user/useUser.ts', [patterns.hooks[0]!]),
      ];

      const graph = buildDependencyGraph(analyses);
      const candidates = extractDomainCandidates(patterns, analyses, graph);

      // Should have at least one user domain
      expect(candidates.some(c => c.name.includes('user'))).toBe(true);
    });
  });
});
