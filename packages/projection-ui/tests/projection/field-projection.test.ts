import { describe, it, expect, beforeEach } from 'vitest';
import type { ResolvedFieldPolicy, SemanticPath } from '@manifesto-ai/core';
import {
  projectFieldPolicy,
  projectFieldPolicies,
  createFieldProjectionDiff,
  isFieldStateEqual,
  mergeFieldStates,
  filterVisibleFields,
  filterEnabledFields,
  getRequiredFields,
  defaultVisibilityResolver,
  defaultEnabledResolver,
} from '../../src/projection/field-projection.js';
import type { UIFieldState, UIFieldStateMap } from '../../src/types.js';

describe('field-projection', () => {
  describe('defaultVisibilityResolver', () => {
    it('should return true when relevant', () => {
      const policy: ResolvedFieldPolicy = {
        relevant: true,
        editable: true,
        required: false,
      };
      expect(defaultVisibilityResolver(policy)).toBe(true);
    });

    it('should return false when not relevant', () => {
      const policy: ResolvedFieldPolicy = {
        relevant: false,
        editable: true,
        required: false,
        relevantReason: 'Field is not applicable',
      };
      expect(defaultVisibilityResolver(policy)).toBe(false);
    });
  });

  describe('defaultEnabledResolver', () => {
    it('should return true when relevant and editable', () => {
      const policy: ResolvedFieldPolicy = {
        relevant: true,
        editable: true,
        required: false,
      };
      expect(defaultEnabledResolver(policy)).toBe(true);
    });

    it('should return false when not relevant', () => {
      const policy: ResolvedFieldPolicy = {
        relevant: false,
        editable: true,
        required: false,
      };
      expect(defaultEnabledResolver(policy)).toBe(false);
    });

    it('should return false when not editable', () => {
      const policy: ResolvedFieldPolicy = {
        relevant: true,
        editable: false,
        required: false,
        editableReason: 'Read-only field',
      };
      expect(defaultEnabledResolver(policy)).toBe(false);
    });

    it('should return false when neither relevant nor editable', () => {
      const policy: ResolvedFieldPolicy = {
        relevant: false,
        editable: false,
        required: false,
      };
      expect(defaultEnabledResolver(policy)).toBe(false);
    });
  });

  describe('projectFieldPolicy', () => {
    it('should project a fully enabled field', () => {
      const policy: ResolvedFieldPolicy = {
        relevant: true,
        editable: true,
        required: true,
        requiredReason: 'This field is mandatory',
      };

      const state = projectFieldPolicy('data.name', policy);

      expect(state.path).toBe('data.name');
      expect(state.visible).toBe(true);
      expect(state.enabled).toBe(true);
      expect(state.required).toBe(true);
      expect(state.requiredReason).toBe('This field is mandatory');
      expect(state.disabledReason).toBeUndefined();
      expect(state.hiddenReason).toBeUndefined();
      expect(state.updatedAt).toBeGreaterThan(0);
    });

    it('should project a hidden field', () => {
      const policy: ResolvedFieldPolicy = {
        relevant: false,
        relevantReason: 'Not applicable for this mode',
        editable: true,
        required: false,
      };

      const state = projectFieldPolicy('data.optional', policy);

      expect(state.visible).toBe(false);
      expect(state.enabled).toBe(false);
      expect(state.hiddenReason).toBe('Not applicable for this mode');
    });

    it('should project a disabled field', () => {
      const policy: ResolvedFieldPolicy = {
        relevant: true,
        editable: false,
        editableReason: 'Locked by admin',
        required: false,
      };

      const state = projectFieldPolicy('data.locked', policy);

      expect(state.visible).toBe(true);
      expect(state.enabled).toBe(false);
      expect(state.disabledReason).toBe('Locked by admin');
    });

    it('should use custom visibility resolver', () => {
      const policy: ResolvedFieldPolicy = {
        relevant: false, // Not relevant
        editable: true,
        required: false,
      };

      // Custom resolver that always shows the field
      const state = projectFieldPolicy('data.alwaysShow', policy, {
        visibilityResolver: () => true,
      });

      expect(state.visible).toBe(true);
    });

    it('should use custom enabled resolver', () => {
      const policy: ResolvedFieldPolicy = {
        relevant: true,
        editable: false, // Not editable
        required: false,
      };

      // Custom resolver that ignores editable
      const state = projectFieldPolicy('data.alwaysEnabled', policy, {
        enabledResolver: (p) => p.relevant,
      });

      expect(state.enabled).toBe(true);
    });
  });

  describe('projectFieldPolicies', () => {
    it('should project multiple policies', () => {
      const policies = new Map<SemanticPath, ResolvedFieldPolicy>([
        ['data.name', { relevant: true, editable: true, required: true }],
        ['data.email', { relevant: true, editable: true, required: false }],
        ['data.phone', { relevant: false, editable: false, required: false }],
      ]);

      const states = projectFieldPolicies(policies);

      expect(states.size).toBe(3);
      expect(states.get('data.name')?.visible).toBe(true);
      expect(states.get('data.name')?.required).toBe(true);
      expect(states.get('data.email')?.required).toBe(false);
      expect(states.get('data.phone')?.visible).toBe(false);
    });

    it('should return empty map for empty input', () => {
      const policies = new Map<SemanticPath, ResolvedFieldPolicy>();
      const states = projectFieldPolicies(policies);
      expect(states.size).toBe(0);
    });
  });

  describe('isFieldStateEqual', () => {
    const baseState: UIFieldState = {
      path: 'data.name',
      visible: true,
      enabled: true,
      required: false,
      updatedAt: 1000,
    };

    it('should return true for equal states', () => {
      const other: UIFieldState = { ...baseState, updatedAt: 2000 };
      expect(isFieldStateEqual(baseState, other)).toBe(true);
    });

    it('should return false when visible differs', () => {
      const other: UIFieldState = { ...baseState, visible: false };
      expect(isFieldStateEqual(baseState, other)).toBe(false);
    });

    it('should return false when enabled differs', () => {
      const other: UIFieldState = { ...baseState, enabled: false };
      expect(isFieldStateEqual(baseState, other)).toBe(false);
    });

    it('should return false when required differs', () => {
      const other: UIFieldState = { ...baseState, required: true };
      expect(isFieldStateEqual(baseState, other)).toBe(false);
    });

    it('should return false when disabledReason differs', () => {
      const other: UIFieldState = { ...baseState, disabledReason: 'Locked' };
      expect(isFieldStateEqual(baseState, other)).toBe(false);
    });

    it('should return false when path differs', () => {
      const other: UIFieldState = { ...baseState, path: 'data.email' };
      expect(isFieldStateEqual(baseState, other)).toBe(false);
    });
  });

  describe('createFieldProjectionDiff', () => {
    it('should detect added paths', () => {
      const previous: UIFieldStateMap = new Map();
      const current: UIFieldStateMap = new Map([
        ['data.name', { path: 'data.name', visible: true, enabled: true, required: false, updatedAt: 1000 }],
      ]);

      const diff = createFieldProjectionDiff(previous, current);
      expect(diff).toContain('data.name');
    });

    it('should detect removed paths', () => {
      const previous: UIFieldStateMap = new Map([
        ['data.name', { path: 'data.name', visible: true, enabled: true, required: false, updatedAt: 1000 }],
      ]);
      const current: UIFieldStateMap = new Map();

      const diff = createFieldProjectionDiff(previous, current);
      expect(diff).toContain('data.name');
    });

    it('should detect changed values', () => {
      const previous: UIFieldStateMap = new Map([
        ['data.name', { path: 'data.name', visible: true, enabled: true, required: false, updatedAt: 1000 }],
      ]);
      const current: UIFieldStateMap = new Map([
        ['data.name', { path: 'data.name', visible: false, enabled: true, required: false, updatedAt: 2000 }],
      ]);

      const diff = createFieldProjectionDiff(previous, current);
      expect(diff).toContain('data.name');
    });

    it('should return empty array when nothing changed', () => {
      const state: UIFieldState = { path: 'data.name', visible: true, enabled: true, required: false, updatedAt: 1000 };
      const previous: UIFieldStateMap = new Map([['data.name', state]]);
      const current: UIFieldStateMap = new Map([['data.name', { ...state, updatedAt: 2000 }]]);

      const diff = createFieldProjectionDiff(previous, current);
      expect(diff).toHaveLength(0);
    });
  });

  describe('mergeFieldStates', () => {
    it('should merge multiple maps', () => {
      const map1: UIFieldStateMap = new Map([
        ['data.name', { path: 'data.name', visible: true, enabled: true, required: false, updatedAt: 1000 }],
      ]);
      const map2: UIFieldStateMap = new Map([
        ['data.email', { path: 'data.email', visible: true, enabled: true, required: false, updatedAt: 1000 }],
      ]);

      const merged = mergeFieldStates(map1, map2);

      expect(merged.size).toBe(2);
      expect(merged.has('data.name')).toBe(true);
      expect(merged.has('data.email')).toBe(true);
    });

    it('should override earlier values with later ones', () => {
      const map1: UIFieldStateMap = new Map([
        ['data.name', { path: 'data.name', visible: true, enabled: true, required: false, updatedAt: 1000 }],
      ]);
      const map2: UIFieldStateMap = new Map([
        ['data.name', { path: 'data.name', visible: false, enabled: false, required: true, updatedAt: 2000 }],
      ]);

      const merged = mergeFieldStates(map1, map2);

      expect(merged.get('data.name')?.visible).toBe(false);
      expect(merged.get('data.name')?.required).toBe(true);
    });
  });

  describe('filterVisibleFields', () => {
    it('should filter to only visible fields', () => {
      const states: UIFieldStateMap = new Map([
        ['data.name', { path: 'data.name', visible: true, enabled: true, required: false, updatedAt: 1000 }],
        ['data.hidden', { path: 'data.hidden', visible: false, enabled: false, required: false, updatedAt: 1000 }],
      ]);

      const visible = filterVisibleFields(states);

      expect(visible.size).toBe(1);
      expect(visible.has('data.name')).toBe(true);
      expect(visible.has('data.hidden')).toBe(false);
    });
  });

  describe('filterEnabledFields', () => {
    it('should filter to only enabled fields', () => {
      const states: UIFieldStateMap = new Map([
        ['data.name', { path: 'data.name', visible: true, enabled: true, required: false, updatedAt: 1000 }],
        ['data.disabled', { path: 'data.disabled', visible: true, enabled: false, required: false, updatedAt: 1000 }],
      ]);

      const enabled = filterEnabledFields(states);

      expect(enabled.size).toBe(1);
      expect(enabled.has('data.name')).toBe(true);
      expect(enabled.has('data.disabled')).toBe(false);
    });
  });

  describe('getRequiredFields', () => {
    it('should get only required fields', () => {
      const states: UIFieldStateMap = new Map([
        ['data.name', { path: 'data.name', visible: true, enabled: true, required: true, updatedAt: 1000 }],
        ['data.optional', { path: 'data.optional', visible: true, enabled: true, required: false, updatedAt: 1000 }],
      ]);

      const required = getRequiredFields(states);

      expect(required.size).toBe(1);
      expect(required.has('data.name')).toBe(true);
      expect(required.has('data.optional')).toBe(false);
    });
  });
});
