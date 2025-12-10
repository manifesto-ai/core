import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateDomain, type ValidateDomainOptions } from '../../src/domain/validate.js';
import { defineDomain, defineSource, defineDerived, defineAsync, defineAction } from '../../src/domain/define.js';
import type { ManifestoDomain } from '../../src/domain/types.js';

describe('validateDomain', () => {
  // Helper to create minimal valid domain
  function createValidDomain(): ManifestoDomain<{ name: string }, { loading: boolean }> {
    return defineDomain({
      id: 'test-domain',
      name: 'Test Domain',
      description: 'A test domain',
      dataSchema: z.object({ name: z.string() }),
      stateSchema: z.object({ loading: z.boolean() }),
      initialState: { loading: false },
      paths: {
        sources: {
          'data.name': defineSource({
            schema: z.string(),
            semantic: { type: 'input', description: 'Name input' },
          }),
        },
        derived: {},
        async: {},
      },
      actions: {},
    });
  }

  // ===========================================
  // Basic Field Validation
  // ===========================================
  describe('basic field validation', () => {
    it('should pass for valid domain', () => {
      const domain = createValidDomain();
      const result = validateDomain(domain);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should fail when domain id is missing', () => {
      const domain = createValidDomain();
      (domain as any).id = '';

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'DOMAIN_ID_REQUIRED',
          path: 'id',
          severity: 'error',
        })
      );
    });

    it('should fail when domain id is whitespace only', () => {
      const domain = createValidDomain();
      (domain as any).id = '   ';

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'DOMAIN_ID_REQUIRED',
        })
      );
    });

    it('should fail when domain name is missing', () => {
      const domain = createValidDomain();
      (domain as any).name = '';

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'DOMAIN_NAME_REQUIRED',
          path: 'name',
          severity: 'error',
        })
      );
    });

    it('should fail when domain name is whitespace only', () => {
      const domain = createValidDomain();
      (domain as any).name = '   ';

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'DOMAIN_NAME_REQUIRED',
        })
      );
    });

    it('should report multiple errors', () => {
      const domain = createValidDomain();
      (domain as any).id = '';
      (domain as any).name = '';

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
      expect(result.issues.some(i => i.code === 'DOMAIN_ID_REQUIRED')).toBe(true);
      expect(result.issues.some(i => i.code === 'DOMAIN_NAME_REQUIRED')).toBe(true);
    });
  });

  // ===========================================
  // Missing Dependencies
  // ===========================================
  describe('missing dependencies', () => {
    it('should detect missing dependency in derived path', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ value: z.number() }),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {
            'data.value': defineSource({
              schema: z.number(),
              semantic: { type: 'number', description: 'Value' },
            }),
          },
          derived: {
            'derived.double': defineDerived({
              deps: ['data.value', 'data.missing'], // data.missing doesn't exist
              expr: ['*', ['get', 'data.value'], 2],
              semantic: { type: 'computed', description: 'Double' },
            }),
          },
          async: {},
        },
        actions: {},
      });

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_DEPENDENCY',
          path: 'derived.double',
          severity: 'error',
        })
      );
      expect(result.issues[0]?.message).toContain('data.missing');
    });

    it('should detect missing dependency in async path', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ region: z.string() }),
        stateSchema: z.object({ cities: z.array(z.string()) }),
        initialState: { cities: [] },
        paths: {
          sources: {
            'data.region': defineSource({
              schema: z.string(),
              semantic: { type: 'select', description: 'Region' },
            }),
          },
          derived: {},
          async: {
            'async.cities': defineAsync({
              deps: ['data.region', 'data.nonexistent'], // data.nonexistent doesn't exist
              effect: {
                _tag: 'ApiCall',
                endpoint: '/api/cities',
                method: 'GET',
                description: 'Fetch cities',
              },
              resultPath: 'state.cities',
              loadingPath: 'state.loading.cities',
              errorPath: 'state.error.cities',
              semantic: { type: 'async', description: 'Load cities' },
            }),
          },
        },
        actions: {},
      });

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_DEPENDENCY',
          path: 'async.cities',
        })
      );
    });

    it('should detect missing dependency in action', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ name: z.string() }),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {
            'data.name': defineSource({
              schema: z.string(),
              semantic: { type: 'input', description: 'Name' },
            }),
          },
          derived: {},
          async: {},
        },
        actions: {
          submit: defineAction({
            deps: ['data.name', 'data.unknown'], // data.unknown doesn't exist
            effect: {
              _tag: 'SetValue',
              path: 'data.name',
              value: '',
              description: 'Clear name',
            },
            semantic: {
              verb: 'submit',
              type: 'action',
              description: 'Submit form',
            },
          }),
        },
      });

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_DEPENDENCY',
          path: 'actions.submit',
        })
      );
    });

    it('should allow built-in paths starting with $', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ items: z.array(z.number()) }),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {
            'data.items': defineSource({
              schema: z.array(z.number()),
              semantic: { type: 'array', description: 'Items' },
            }),
          },
          derived: {
            'derived.sum': defineDerived({
              deps: ['data.items'],
              expr: ['sum', ['map', ['get', 'data.items'], ['get', '$']]],
              semantic: { type: 'computed', description: 'Sum' },
            }),
          },
          async: {},
        },
        actions: {},
      });

      const result = validateDomain(domain);

      // $ is a built-in path, should not cause error
      const missingDepIssues = result.issues.filter(i => i.code === 'MISSING_DEPENDENCY');
      expect(missingDepIssues.length).toBe(0);
    });

    it('should skip check when checkMissingDeps is false', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ value: z.number() }),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {
            'data.value': defineSource({
              schema: z.number(),
              semantic: { type: 'number', description: 'Value' },
            }),
          },
          derived: {
            'derived.computed': defineDerived({
              deps: ['data.missing'], // Missing dependency
              expr: ['get', 'data.missing'],
              semantic: { type: 'computed', description: 'Computed' },
            }),
          },
          async: {},
        },
        actions: {},
      });

      const result = validateDomain(domain, { checkMissingDeps: false });

      const missingDepIssues = result.issues.filter(i => i.code === 'MISSING_DEPENDENCY');
      expect(missingDepIssues.length).toBe(0);
    });
  });

  // ===========================================
  // Cyclic Dependencies
  // ===========================================
  describe('cyclic dependencies', () => {
    it('should detect simple cycle (A -> B -> A)', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({}),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {},
          derived: {
            'derived.a': defineDerived({
              deps: ['derived.b'],
              expr: ['get', 'derived.b'],
              semantic: { type: 'computed', description: 'A' },
            }),
            'derived.b': defineDerived({
              deps: ['derived.a'],
              expr: ['get', 'derived.a'],
              semantic: { type: 'computed', description: 'B' },
            }),
          },
          async: {},
        },
        actions: {},
      });

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'CYCLIC_DEPENDENCY',
          severity: 'error',
        })
      );
    });

    it('should detect longer cycle (A -> B -> C -> A)', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({}),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {},
          derived: {
            'derived.a': defineDerived({
              deps: ['derived.c'],
              expr: ['get', 'derived.c'],
              semantic: { type: 'computed', description: 'A' },
            }),
            'derived.b': defineDerived({
              deps: ['derived.a'],
              expr: ['get', 'derived.a'],
              semantic: { type: 'computed', description: 'B' },
            }),
            'derived.c': defineDerived({
              deps: ['derived.b'],
              expr: ['get', 'derived.b'],
              semantic: { type: 'computed', description: 'C' },
            }),
          },
          async: {},
        },
        actions: {},
      });

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === 'CYCLIC_DEPENDENCY')).toBe(true);
    });

    it('should detect self-referencing cycle (A -> A)', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({}),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {},
          derived: {
            'derived.self': defineDerived({
              deps: ['derived.self'],
              expr: ['get', 'derived.self'],
              semantic: { type: 'computed', description: 'Self' },
            }),
          },
          async: {},
        },
        actions: {},
      });

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === 'CYCLIC_DEPENDENCY')).toBe(true);
    });

    it('should not report false positive for diamond dependency', () => {
      // Diamond: A depends on B and C, B and C both depend on D
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ value: z.number() }),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {
            'data.value': defineSource({
              schema: z.number(),
              semantic: { type: 'number', description: 'Value' },
            }),
          },
          derived: {
            'derived.d': defineDerived({
              deps: ['data.value'],
              expr: ['get', 'data.value'],
              semantic: { type: 'computed', description: 'D' },
            }),
            'derived.b': defineDerived({
              deps: ['derived.d'],
              expr: ['+', ['get', 'derived.d'], 1],
              semantic: { type: 'computed', description: 'B' },
            }),
            'derived.c': defineDerived({
              deps: ['derived.d'],
              expr: ['*', ['get', 'derived.d'], 2],
              semantic: { type: 'computed', description: 'C' },
            }),
            'derived.a': defineDerived({
              deps: ['derived.b', 'derived.c'],
              expr: ['+', ['get', 'derived.b'], ['get', 'derived.c']],
              semantic: { type: 'computed', description: 'A' },
            }),
          },
          async: {},
        },
        actions: {},
      });

      const result = validateDomain(domain);

      const cycleIssues = result.issues.filter(i => i.code === 'CYCLIC_DEPENDENCY');
      expect(cycleIssues.length).toBe(0);
    });

    it('should skip check when checkCycles is false', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({}),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {},
          derived: {
            'derived.a': defineDerived({
              deps: ['derived.b'],
              expr: ['get', 'derived.b'],
              semantic: { type: 'computed', description: 'A' },
            }),
            'derived.b': defineDerived({
              deps: ['derived.a'],
              expr: ['get', 'derived.a'],
              semantic: { type: 'computed', description: 'B' },
            }),
          },
          async: {},
        },
        actions: {},
      });

      const result = validateDomain(domain, { checkCycles: false });

      const cycleIssues = result.issues.filter(i => i.code === 'CYCLIC_DEPENDENCY');
      expect(cycleIssues.length).toBe(0);
    });
  });

  // ===========================================
  // Action Validation
  // ===========================================
  describe('action validation', () => {
    it('should detect invalid precondition path', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ name: z.string() }),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {
            'data.name': defineSource({
              schema: z.string(),
              semantic: { type: 'input', description: 'Name' },
            }),
          },
          derived: {
            'derived.isValid': defineDerived({
              deps: ['data.name'],
              expr: ['>', ['length', ['get', 'data.name']], 0],
              semantic: { type: 'condition', description: 'Is valid' },
            }),
          },
          async: {},
        },
        actions: {
          submit: defineAction({
            deps: ['data.name'],
            preconditions: [
              { path: 'derived.isValid', expect: 'true', reason: 'Name required' },
              { path: 'derived.nonexistent', expect: 'true', reason: 'Missing condition' },
            ],
            effect: {
              _tag: 'SetValue',
              path: 'data.name',
              value: '',
              description: 'Clear',
            },
            semantic: {
              verb: 'submit',
              type: 'action',
              description: 'Submit',
            },
          }),
        },
      });

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_PRECONDITION_PATH',
          path: 'actions.submit',
        })
      );
    });

    it('should warn when action verb is missing', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ name: z.string() }),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {
            'data.name': defineSource({
              schema: z.string(),
              semantic: { type: 'input', description: 'Name' },
            }),
          },
          derived: {},
          async: {},
        },
        actions: {
          submit: defineAction({
            deps: ['data.name'],
            effect: {
              _tag: 'SetValue',
              path: 'data.name',
              value: '',
              description: 'Clear',
            },
            semantic: {
              verb: '', // Empty verb
              type: 'action',
              description: 'Submit',
            },
          }),
        },
      });

      const result = validateDomain(domain);

      // Warning doesn't make domain invalid
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'ACTION_VERB_REQUIRED',
          severity: 'warning',
        })
      );
    });

    it('should warn when action verb is whitespace only', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ name: z.string() }),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {
            'data.name': defineSource({
              schema: z.string(),
              semantic: { type: 'input', description: 'Name' },
            }),
          },
          derived: {},
          async: {},
        },
        actions: {
          submit: defineAction({
            deps: ['data.name'],
            effect: {
              _tag: 'SetValue',
              path: 'data.name',
              value: '',
              description: 'Clear',
            },
            semantic: {
              verb: '   ', // Whitespace only
              type: 'action',
              description: 'Submit',
            },
          }),
        },
      });

      const result = validateDomain(domain);

      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: 'ACTION_VERB_REQUIRED',
          severity: 'warning',
        })
      );
    });

    it('should pass with valid action', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ name: z.string() }),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {
            'data.name': defineSource({
              schema: z.string(),
              semantic: { type: 'input', description: 'Name' },
            }),
          },
          derived: {
            'derived.isValid': defineDerived({
              deps: ['data.name'],
              expr: ['>', ['length', ['get', 'data.name']], 0],
              semantic: { type: 'condition', description: 'Is valid' },
            }),
          },
          async: {},
        },
        actions: {
          submit: defineAction({
            deps: ['data.name'],
            preconditions: [
              { path: 'derived.isValid', expect: 'true', reason: 'Name required' },
            ],
            effect: {
              _tag: 'SetValue',
              path: 'data.name',
              value: '',
              description: 'Clear',
            },
            semantic: {
              verb: 'submit',
              type: 'action',
              description: 'Submit form',
            },
          }),
        },
      });

      const result = validateDomain(domain);

      expect(result.valid).toBe(true);
    });
  });

  // ===========================================
  // Async Path Collection
  // ===========================================
  describe('async path collection', () => {
    it('should include resultPath, loadingPath, errorPath in known paths', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ query: z.string() }),
        stateSchema: z.object({
          results: z.array(z.string()),
          loading: z.boolean(),
          error: z.string().nullable(),
        }),
        initialState: { results: [], loading: false, error: null },
        paths: {
          sources: {
            'data.query': defineSource({
              schema: z.string(),
              semantic: { type: 'input', description: 'Search query' },
            }),
          },
          derived: {
            // This derived depends on the async result path
            'derived.hasResults': defineDerived({
              deps: ['state.results'], // Uses async resultPath
              expr: ['>', ['length', ['get', 'state.results']], 0],
              semantic: { type: 'condition', description: 'Has results' },
            }),
          },
          async: {
            'async.search': defineAsync({
              deps: ['data.query'],
              effect: {
                _tag: 'ApiCall',
                endpoint: '/api/search',
                method: 'GET',
                description: 'Search',
              },
              resultPath: 'state.results',
              loadingPath: 'state.loading',
              errorPath: 'state.error',
              semantic: { type: 'async', description: 'Search' },
            }),
          },
        },
        actions: {},
      });

      const result = validateDomain(domain);

      // state.results is a valid path because it's defined as resultPath
      const missingDepIssues = result.issues.filter(
        i => i.code === 'MISSING_DEPENDENCY' && i.message?.includes('state.results')
      );
      expect(missingDepIssues.length).toBe(0);
    });
  });

  // ===========================================
  // Options
  // ===========================================
  describe('validation options', () => {
    it('should use default options when not provided', () => {
      const domain = createValidDomain();
      const result = validateDomain(domain);

      expect(result.valid).toBe(true);
    });

    it('should allow disabling all checks', () => {
      const domain = defineDomain({
        id: '', // Would fail basic check
        name: '', // Would fail basic check
        description: 'Test',
        dataSchema: z.object({}),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {},
          derived: {
            'derived.a': defineDerived({
              deps: ['derived.b'], // Cyclic
              expr: ['get', 'derived.b'],
              semantic: { type: 'computed', description: 'A' },
            }),
            'derived.b': defineDerived({
              deps: ['derived.a'], // Cyclic
              expr: ['get', 'derived.a'],
              semantic: { type: 'computed', description: 'B' },
            }),
          },
          async: {},
        },
        actions: {},
      });

      // Basic validation still runs (id/name), but cycles and deps skipped
      const result = validateDomain(domain, {
        checkCycles: false,
        checkMissingDeps: false,
        checkUnused: false,
      });

      // Should still have id and name errors
      expect(result.issues.some(i => i.code === 'DOMAIN_ID_REQUIRED')).toBe(true);
      expect(result.issues.some(i => i.code === 'DOMAIN_NAME_REQUIRED')).toBe(true);
      // Should not have cycle errors
      expect(result.issues.some(i => i.code === 'CYCLIC_DEPENDENCY')).toBe(false);
    });
  });

  // ===========================================
  // Validity Determination
  // ===========================================
  describe('validity determination', () => {
    it('should be valid when only warnings exist', () => {
      const domain = defineDomain({
        id: 'test',
        name: 'Test',
        description: 'Test',
        dataSchema: z.object({ name: z.string() }),
        stateSchema: z.object({}),
        initialState: {},
        paths: {
          sources: {
            'data.name': defineSource({
              schema: z.string(),
              semantic: { type: 'input', description: 'Name' },
            }),
          },
          derived: {},
          async: {},
        },
        actions: {
          submit: defineAction({
            deps: ['data.name'],
            effect: {
              _tag: 'SetValue',
              path: 'data.name',
              value: '',
              description: 'Clear',
            },
            semantic: {
              verb: '', // Missing verb - warning
              type: 'action',
              description: 'Submit',
            },
          }),
        },
      });

      const result = validateDomain(domain);

      // Has warning but no errors, so valid is true
      expect(result.valid).toBe(true);
      expect(result.issues.some(i => i.severity === 'warning')).toBe(true);
    });

    it('should be invalid when any error exists', () => {
      const domain = createValidDomain();
      (domain as any).id = ''; // Error

      const result = validateDomain(domain);

      expect(result.valid).toBe(false);
    });
  });
});
