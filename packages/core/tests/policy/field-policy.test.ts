import { describe, it, expect } from 'vitest';
import {
  evaluateFieldPolicy,
  policyToUIState,
  extractFieldPolicyDependencies,
  evaluateMultipleFieldPolicies,
  explainFieldPolicy,
  type FieldPolicyEvaluation,
} from '../../src/policy/field-policy.js';
import type { FieldPolicy, ConditionRef } from '../../src/domain/types.js';
import type { EvaluationContext } from '../../src/expression/types.js';

describe('field-policy', () => {
  // Helper to create evaluation context
  const createContext = (values: Record<string, unknown>): EvaluationContext => ({
    get: (path) => values[path],
  });

  // ===========================================
  // evaluateFieldPolicy
  // ===========================================
  describe('evaluateFieldPolicy', () => {
    it('should return defaults when policy is undefined', () => {
      const result = evaluateFieldPolicy(undefined, createContext({}));

      expect(result.relevant).toBe(true);
      expect(result.editable).toBe(true);
      expect(result.required).toBe(false);
    });

    it('should return defaults when policy has no conditions', () => {
      const policy: FieldPolicy = {};
      const result = evaluateFieldPolicy(policy, createContext({}));

      expect(result.relevant).toBe(true);
      expect(result.editable).toBe(true);
      expect(result.required).toBe(false);
    });

    describe('relevantWhen', () => {
      it('should be relevant when all conditions are satisfied', () => {
        const policy: FieldPolicy = {
          relevantWhen: [
            { path: 'derived.showField', expect: 'true', reason: 'Field must be shown' },
          ],
        };
        const ctx = createContext({ 'derived.showField': true });

        const result = evaluateFieldPolicy(policy, ctx);

        expect(result.relevant).toBe(true);
        expect(result.relevantReason).toBeUndefined();
      });

      it('should not be relevant when condition is not satisfied', () => {
        const policy: FieldPolicy = {
          relevantWhen: [
            { path: 'derived.showField', expect: 'true', reason: 'Field must be shown' },
          ],
        };
        const ctx = createContext({ 'derived.showField': false });

        const result = evaluateFieldPolicy(policy, ctx);

        expect(result.relevant).toBe(false);
        expect(result.relevantReason).toBe('Field must be shown');
      });

      it('should require all conditions to be satisfied', () => {
        const policy: FieldPolicy = {
          relevantWhen: [
            { path: 'derived.a', expect: 'true' },
            { path: 'derived.b', expect: 'true' },
          ],
        };
        const ctx = createContext({
          'derived.a': true,
          'derived.b': false,
        });

        const result = evaluateFieldPolicy(policy, ctx);

        expect(result.relevant).toBe(false);
      });

      it('should include condition details', () => {
        const policy: FieldPolicy = {
          relevantWhen: [
            { path: 'derived.check', expect: 'true', reason: 'Test' },
          ],
        };
        const ctx = createContext({ 'derived.check': true });

        const result = evaluateFieldPolicy(policy, ctx);

        expect(result.relevantConditions).toHaveLength(1);
        expect(result.relevantConditions?.[0]?.satisfied).toBe(true);
        expect(result.relevantConditions?.[0]?.actualValue).toBe(true);
      });
    });

    describe('editableWhen', () => {
      it('should be editable when all conditions are satisfied', () => {
        const policy: FieldPolicy = {
          editableWhen: [
            { path: 'derived.canEdit', expect: 'true', reason: 'Must have permission' },
          ],
        };
        const ctx = createContext({ 'derived.canEdit': true });

        const result = evaluateFieldPolicy(policy, ctx);

        expect(result.editable).toBe(true);
        expect(result.editableReason).toBeUndefined();
      });

      it('should not be editable when condition fails', () => {
        const policy: FieldPolicy = {
          editableWhen: [
            { path: 'derived.canEdit', expect: 'true', reason: 'No permission' },
          ],
        };
        const ctx = createContext({ 'derived.canEdit': false });

        const result = evaluateFieldPolicy(policy, ctx);

        expect(result.editable).toBe(false);
        expect(result.editableReason).toBe('No permission');
      });

      it('should handle expect:false condition', () => {
        const policy: FieldPolicy = {
          editableWhen: [
            { path: 'derived.isLocked', expect: 'false', reason: 'Field is locked' },
          ],
        };
        const ctx = createContext({ 'derived.isLocked': false });

        const result = evaluateFieldPolicy(policy, ctx);

        expect(result.editable).toBe(true);
      });
    });

    describe('requiredWhen', () => {
      it('should be required when conditions are satisfied', () => {
        const policy: FieldPolicy = {
          requiredWhen: [
            { path: 'derived.needsValue', expect: 'true', reason: 'Value is required' },
          ],
        };
        const ctx = createContext({ 'derived.needsValue': true });

        const result = evaluateFieldPolicy(policy, ctx);

        expect(result.required).toBe(true);
      });

      it('should not be required when conditions are not satisfied', () => {
        const policy: FieldPolicy = {
          requiredWhen: [
            { path: 'derived.needsValue', expect: 'true' },
          ],
        };
        const ctx = createContext({ 'derived.needsValue': false });

        const result = evaluateFieldPolicy(policy, ctx);

        expect(result.required).toBe(false);
      });

      it('should default to not required when no conditions', () => {
        const policy: FieldPolicy = {};
        const result = evaluateFieldPolicy(policy, createContext({}));

        expect(result.required).toBe(false);
      });
    });

    describe('combined policies', () => {
      it('should evaluate all policy types together', () => {
        const policy: FieldPolicy = {
          relevantWhen: [{ path: 'derived.show', expect: 'true' }],
          editableWhen: [{ path: 'derived.canEdit', expect: 'true' }],
          requiredWhen: [{ path: 'derived.isRequired', expect: 'true' }],
        };
        const ctx = createContext({
          'derived.show': true,
          'derived.canEdit': false,
          'derived.isRequired': true,
        });

        const result = evaluateFieldPolicy(policy, ctx);

        expect(result.relevant).toBe(true);
        expect(result.editable).toBe(false);
        expect(result.required).toBe(true);
      });

      it('should capture first unsatisfied reason', () => {
        const policy: FieldPolicy = {
          relevantWhen: [
            { path: 'derived.a', expect: 'true', reason: 'First reason' },
            { path: 'derived.b', expect: 'true', reason: 'Second reason' },
          ],
        };
        const ctx = createContext({
          'derived.a': false,
          'derived.b': false,
        });

        const result = evaluateFieldPolicy(policy, ctx);

        expect(result.relevantReason).toBe('First reason');
      });
    });
  });

  // ===========================================
  // policyToUIState
  // ===========================================
  describe('policyToUIState', () => {
    it('should show visible and enabled field', () => {
      const evaluation: FieldPolicyEvaluation = {
        relevant: true,
        editable: true,
        required: false,
      };

      const uiState = policyToUIState(evaluation);

      expect(uiState.visible).toBe(true);
      expect(uiState.enabled).toBe(true);
      expect(uiState.showRequired).toBe(false);
      expect(uiState.disabledReason).toBeUndefined();
      expect(uiState.hiddenReason).toBeUndefined();
    });

    it('should hide field when not relevant', () => {
      const evaluation: FieldPolicyEvaluation = {
        relevant: false,
        relevantReason: 'Not applicable',
        editable: true,
        required: false,
      };

      const uiState = policyToUIState(evaluation);

      expect(uiState.visible).toBe(false);
      expect(uiState.hiddenReason).toBe('Not applicable');
    });

    it('should disable field when not editable', () => {
      const evaluation: FieldPolicyEvaluation = {
        relevant: true,
        editable: false,
        editableReason: 'No permission',
        required: false,
      };

      const uiState = policyToUIState(evaluation);

      expect(uiState.visible).toBe(true);
      expect(uiState.enabled).toBe(false);
      expect(uiState.disabledReason).toBe('No permission');
    });

    it('should disable when not relevant (even if editable)', () => {
      const evaluation: FieldPolicyEvaluation = {
        relevant: false,
        editable: true,
        required: false,
      };

      const uiState = policyToUIState(evaluation);

      expect(uiState.enabled).toBe(false);
    });

    it('should show required indicator', () => {
      const evaluation: FieldPolicyEvaluation = {
        relevant: true,
        editable: true,
        required: true,
      };

      const uiState = policyToUIState(evaluation);

      expect(uiState.showRequired).toBe(true);
    });

    it('should not show required when not relevant', () => {
      const evaluation: FieldPolicyEvaluation = {
        relevant: false,
        editable: true,
        required: true,
      };

      const uiState = policyToUIState(evaluation);

      expect(uiState.showRequired).toBe(false);
    });
  });

  // ===========================================
  // extractFieldPolicyDependencies
  // ===========================================
  describe('extractFieldPolicyDependencies', () => {
    it('should extract all unique paths', () => {
      const policy: FieldPolicy = {
        relevantWhen: [{ path: 'derived.a' }],
        editableWhen: [{ path: 'derived.b' }],
        requiredWhen: [{ path: 'derived.c' }],
      };

      const deps = extractFieldPolicyDependencies(policy);

      expect(deps).toHaveLength(3);
      expect(deps).toContain('derived.a');
      expect(deps).toContain('derived.b');
      expect(deps).toContain('derived.c');
    });

    it('should deduplicate paths', () => {
      const policy: FieldPolicy = {
        relevantWhen: [{ path: 'derived.shared' }],
        editableWhen: [{ path: 'derived.shared' }], // same path
        requiredWhen: [{ path: 'derived.shared' }], // same path
      };

      const deps = extractFieldPolicyDependencies(policy);

      expect(deps).toHaveLength(1);
      expect(deps[0]).toBe('derived.shared');
    });

    it('should handle empty policy', () => {
      const policy: FieldPolicy = {};

      const deps = extractFieldPolicyDependencies(policy);

      expect(deps).toEqual([]);
    });

    it('should handle multiple conditions per type', () => {
      const policy: FieldPolicy = {
        relevantWhen: [
          { path: 'derived.a' },
          { path: 'derived.b' },
        ],
      };

      const deps = extractFieldPolicyDependencies(policy);

      expect(deps).toContain('derived.a');
      expect(deps).toContain('derived.b');
    });
  });

  // ===========================================
  // evaluateMultipleFieldPolicies
  // ===========================================
  describe('evaluateMultipleFieldPolicies', () => {
    it('should evaluate multiple field policies', () => {
      const policies: Record<string, FieldPolicy | undefined> = {
        'data.name': {
          relevantWhen: [{ path: 'derived.showName', expect: 'true' }],
        },
        'data.email': {
          editableWhen: [{ path: 'derived.canEditEmail', expect: 'true' }],
        },
        'data.phone': undefined, // no policy
      };
      const ctx = createContext({
        'derived.showName': true,
        'derived.canEditEmail': false,
      });

      const results = evaluateMultipleFieldPolicies(policies, ctx);

      expect(Object.keys(results)).toHaveLength(3);
      expect(results['data.name']?.relevant).toBe(true);
      expect(results['data.email']?.editable).toBe(false);
      expect(results['data.phone']?.relevant).toBe(true); // default
    });

    it('should handle empty policies object', () => {
      const results = evaluateMultipleFieldPolicies({}, createContext({}));

      expect(Object.keys(results)).toHaveLength(0);
    });
  });

  // ===========================================
  // explainFieldPolicy
  // ===========================================
  describe('explainFieldPolicy', () => {
    it('should explain fully satisfied policy', () => {
      const evaluation: FieldPolicyEvaluation = {
        relevant: true,
        editable: true,
        required: false,
      };

      const explanation = explainFieldPolicy('data.name', evaluation);

      expect(explanation).toContain('Field: data.name');
      expect(explanation).toContain('Relevant: Yes');
      expect(explanation).toContain('Editable: Yes');
      expect(explanation).toContain('Required: No');
    });

    it('should explain non-relevant field', () => {
      const evaluation: FieldPolicyEvaluation = {
        relevant: false,
        relevantReason: 'Option not selected',
        relevantConditions: [
          {
            condition: { path: 'derived.showField', expect: 'true' },
            actualValue: false,
            satisfied: false,
          },
        ],
        editable: true,
        required: false,
      };

      const explanation = explainFieldPolicy('data.details', evaluation);

      expect(explanation).toContain('Relevant: No');
      expect(explanation).toContain('Reason: Option not selected');
      expect(explanation).toContain('derived.showField');
    });

    it('should explain non-editable field', () => {
      const evaluation: FieldPolicyEvaluation = {
        relevant: true,
        editable: false,
        editableReason: 'No permission',
        editableConditions: [
          {
            condition: { path: 'derived.canEdit', expect: 'true', reason: 'Need admin' },
            actualValue: false,
            satisfied: false,
          },
        ],
        required: false,
      };

      const explanation = explainFieldPolicy('data.protected', evaluation);

      expect(explanation).toContain('Editable: No');
      expect(explanation).toContain('No permission');
      expect(explanation).toContain('derived.canEdit');
    });

    it('should explain required field', () => {
      const evaluation: FieldPolicyEvaluation = {
        relevant: true,
        editable: true,
        required: true,
        requiredConditions: [
          {
            condition: { path: 'derived.isRequired', expect: 'true' },
            actualValue: true,
            satisfied: true,
          },
        ],
      };

      const explanation = explainFieldPolicy('data.mandatoryField', evaluation);

      expect(explanation).toContain('Required: Yes');
      expect(explanation).toContain('Because:');
      expect(explanation).toContain('derived.isRequired');
    });

    it('should use default reason when none provided', () => {
      const evaluation: FieldPolicyEvaluation = {
        relevant: false,
        relevantConditions: [
          {
            condition: { path: 'derived.show' }, // no reason
            actualValue: false,
            satisfied: false,
          },
        ],
        editable: true,
        required: false,
      };

      const explanation = explainFieldPolicy('data.field', evaluation);

      expect(explanation).toContain('Condition not met');
    });
  });
});
