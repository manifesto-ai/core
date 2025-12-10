import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  defineDomain,
  defineSource,
  defineDerived,
  defineAction,
  condition,
  fieldPolicy,
} from '../../src/domain/define.js';
import { validateDomain } from '../../src/domain/validate.js';

describe('Domain Definition', () => {
  describe('defineDomain', () => {
    it('should create a valid domain', () => {
      const domain = defineDomain({
        id: 'test-domain',
        name: 'Test Domain',
        description: 'A test domain',
        dataSchema: z.object({
          name: z.string(),
          age: z.number(),
        }),
        stateSchema: z.object({
          loading: z.boolean(),
        }),
        initialState: { loading: false },
      });

      expect(domain.id).toBe('test-domain');
      expect(domain.name).toBe('Test Domain');
      expect(domain.paths.sources).toEqual({});
      expect(domain.paths.derived).toEqual({});
      expect(domain.actions).toEqual({});
    });

    it('should create domain with paths', () => {
      const domain = defineDomain({
        id: 'order-domain',
        name: 'Order Domain',
        description: 'Order management domain',
        dataSchema: z.object({
          selectedIds: z.array(z.string()),
        }),
        stateSchema: z.object({
          orders: z.array(z.object({ id: z.string(), status: z.string() })),
        }),
        initialState: { orders: [] },
        paths: {
          sources: {
            'data.selectedIds': defineSource({
              schema: z.array(z.string()),
              defaultValue: [],
              semantic: {
                type: 'selection',
                description: '선택된 주문 ID 목록',
              },
            }),
          },
          derived: {
            'derived.hasSelection': defineDerived({
              deps: ['data.selectedIds'],
              expr: ['>', ['length', ['get', 'data.selectedIds']], 0],
              semantic: {
                type: 'condition',
                description: '선택된 항목 존재 여부',
              },
            }),
          },
        },
      });

      expect(domain.paths.sources['data.selectedIds']).toBeDefined();
      expect(domain.paths.derived['derived.hasSelection']).toBeDefined();
    });
  });

  describe('defineSource', () => {
    it('should create source with default readable/writable', () => {
      const source = defineSource({
        schema: z.string(),
        semantic: {
          type: 'input',
          description: 'User name input',
        },
      });

      expect(source.semantic.readable).toBe(true);
      expect(source.semantic.writable).toBe(true);
    });

    it('should respect explicit readable/writable', () => {
      const source = defineSource({
        schema: z.string(),
        semantic: {
          type: 'input',
          description: 'Read-only field',
          readable: true,
          writable: false,
        },
      });

      expect(source.semantic.readable).toBe(true);
      expect(source.semantic.writable).toBe(false);
    });

    it('should include field policy', () => {
      const source = defineSource({
        schema: z.string(),
        policy: fieldPolicy({
          relevantWhen: [condition('derived.showField')],
          editableWhen: [condition('derived.canEdit')],
          requiredWhen: [condition('derived.isRequired')],
        }),
        semantic: {
          type: 'input',
          description: 'Conditional field',
        },
      });

      expect(source.policy?.relevantWhen).toHaveLength(1);
      expect(source.policy?.editableWhen).toHaveLength(1);
      expect(source.policy?.requiredWhen).toHaveLength(1);
    });
  });

  describe('defineDerived', () => {
    it('should create derived with readonly semantic', () => {
      const derived = defineDerived({
        deps: ['data.a', 'data.b'],
        expr: ['+', ['get', 'data.a'], ['get', 'data.b']],
        semantic: {
          type: 'calculation',
          description: 'Sum of a and b',
        },
      });

      expect(derived.semantic.readable).toBe(true);
      expect(derived.semantic.writable).toBe(false);
    });
  });

  describe('defineAction', () => {
    it('should create action with preconditions', () => {
      const action = defineAction({
        deps: ['data.selectedIds'],
        effect: {
          _tag: 'Sequence',
          effects: [],
          description: 'Empty action',
        },
        preconditions: [
          condition('derived.hasSelection', { reason: 'No items selected' }),
          condition('derived.allPending', { reason: 'Not all items are pending' }),
        ],
        semantic: {
          type: 'action',
          description: 'Bulk ship action',
          verb: 'ship',
          risk: 'medium',
        },
      });

      expect(action.preconditions).toHaveLength(2);
      expect(action.semantic.verb).toBe('ship');
      expect(action.semantic.risk).toBe('medium');
    });
  });

  describe('condition helper', () => {
    it('should create condition with default expect', () => {
      const cond = condition('derived.canSubmit');
      expect(cond.path).toBe('derived.canSubmit');
      expect(cond.expect).toBe('true');
    });

    it('should create condition with false expect', () => {
      const cond = condition('derived.isLoading', { expect: 'false' });
      expect(cond.expect).toBe('false');
    });

    it('should create condition with reason', () => {
      const cond = condition('derived.canSubmit', { reason: 'Form is incomplete' });
      expect(cond.reason).toBe('Form is incomplete');
    });
  });
});

describe('Domain Validation', () => {
  it('should validate a correct domain', () => {
    const domain = defineDomain({
      id: 'valid-domain',
      name: 'Valid Domain',
      description: 'A valid domain',
      dataSchema: z.object({ value: z.string() }),
      stateSchema: z.object({}),
      initialState: {},
      paths: {
        sources: {
          'data.value': defineSource({
            schema: z.string(),
            semantic: { type: 'input', description: 'Value' },
          }),
        },
        derived: {
          'derived.hasValue': defineDerived({
            deps: ['data.value'],
            expr: ['!=', ['get', 'data.value'], ''],
            semantic: { type: 'condition', description: 'Has value' },
          }),
        },
      },
    });

    const result = validateDomain(domain);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect missing id', () => {
    const domain = defineDomain({
      id: '',
      name: 'Test',
      description: 'Test',
      dataSchema: z.object({}),
      stateSchema: z.object({}),
      initialState: {},
    });

    const result = validateDomain(domain);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'DOMAIN_ID_REQUIRED')).toBe(true);
  });

  it('should detect missing dependencies', () => {
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
          'derived.test': defineDerived({
            deps: ['data.missing'],
            expr: ['get', 'data.missing'],
            semantic: { type: 'test', description: 'Test' },
          }),
        },
      },
    });

    const result = validateDomain(domain);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'MISSING_DEPENDENCY')).toBe(true);
  });
});
