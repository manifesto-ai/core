import { describe, it, expect } from 'vitest';
import type { ActionDefinition, Effect, SemanticPath } from '@manifesto-ai/core';
import {
  getRiskFromSemantic,
  assessEffectRisk,
  analyzeRiskFactors,
  generateRiskMitigations,
  assessActionRisk,
  compareRiskLevels,
  maxRiskLevel,
} from '../../src/analyzers/risk-assessor.js';

describe('Risk Assessor', () => {
  describe('getRiskFromSemantic', () => {
    it('should map none to low', () => {
      expect(getRiskFromSemantic('none')).toBe('low');
    });

    it('should map low to low', () => {
      expect(getRiskFromSemantic('low')).toBe('low');
    });

    it('should map medium to medium', () => {
      expect(getRiskFromSemantic('medium')).toBe('medium');
    });

    it('should map high to high', () => {
      expect(getRiskFromSemantic('high')).toBe('high');
    });

    it('should map critical to high', () => {
      expect(getRiskFromSemantic('critical')).toBe('high');
    });

    it('should default to low', () => {
      expect(getRiskFromSemantic(undefined)).toBe('low');
    });
  });

  describe('assessEffectRisk', () => {
    it('should assess SetValue as low risk', () => {
      const effect: Effect = {
        _tag: 'SetValue',
        path: 'data.name' as SemanticPath,
        value: 'John',
      };
      expect(assessEffectRisk(effect)).toBe('low');
    });

    it('should assess ApiCall as high risk', () => {
      const effect: Effect = {
        _tag: 'ApiCall',
        endpoint: '/api/users',
        method: 'POST',
        description: 'Create user',
      };
      expect(assessEffectRisk(effect)).toBe('high');
    });

    it('should assess Navigate as medium risk', () => {
      const effect: Effect = {
        _tag: 'Navigate',
        to: '/dashboard',
        description: 'Go to dashboard',
      };
      expect(assessEffectRisk(effect)).toBe('medium');
    });

    it('should assess Delay as low risk', () => {
      const effect: Effect = {
        _tag: 'Delay',
        ms: 1000,
        description: 'Wait',
      };
      expect(assessEffectRisk(effect)).toBe('low');
    });

    it('should assess EmitEvent as low risk', () => {
      const effect: Effect = {
        _tag: 'EmitEvent',
        channel: 'notifications',
        payload: { type: 'info' },
        description: 'Notify',
      };
      expect(assessEffectRisk(effect)).toBe('low');
    });

    it('should take max risk in Sequence', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1 },
          { _tag: 'ApiCall', endpoint: '/api', method: 'GET', description: 'Fetch' },
        ],
      };
      expect(assessEffectRisk(effect)).toBe('high');
    });

    it('should count multiple effects for risk', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1 },
          { _tag: 'SetValue', path: 'data.b' as SemanticPath, value: 2 },
          { _tag: 'SetValue', path: 'data.c' as SemanticPath, value: 3 },
        ],
      };
      expect(assessEffectRisk(effect)).toBe('medium');
    });

    it('should assess high risk for many effects', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as SemanticPath, value: 1 },
          { _tag: 'SetValue', path: 'data.b' as SemanticPath, value: 2 },
          { _tag: 'SetValue', path: 'data.c' as SemanticPath, value: 3 },
          { _tag: 'SetValue', path: 'data.d' as SemanticPath, value: 4 },
          { _tag: 'SetValue', path: 'data.e' as SemanticPath, value: 5 },
        ],
      };
      expect(assessEffectRisk(effect)).toBe('high');
    });
  });

  describe('analyzeRiskFactors', () => {
    it('should detect API call factor', () => {
      const action: ActionDefinition = {
        semantic: { verb: 'fetch', type: 'action', description: 'Fetch data' },
        effect: {
          _tag: 'ApiCall',
          endpoint: '/api',
          method: 'GET',
          description: 'Fetch',
        },
      };
      const factors = analyzeRiskFactors(action);
      expect(factors.some((f) => f.includes('API'))).toBe(true);
    });

    it('should detect navigation factor', () => {
      const action: ActionDefinition = {
        semantic: { verb: 'navigate', type: 'action', description: 'Go to page' },
        effect: {
          _tag: 'Navigate',
          to: '/other',
          description: 'Navigate',
        },
      };
      const factors = analyzeRiskFactors(action);
      expect(factors.some((f) => f.includes('navigation'))).toBe(true);
    });

    it('should detect delete verb', () => {
      const action: ActionDefinition = {
        semantic: { verb: 'delete', type: 'action', description: 'Delete item' },
      };
      const factors = analyzeRiskFactors(action);
      expect(factors.some((f) => f.includes('Delete'))).toBe(true);
    });

    it('should detect submit verb', () => {
      const action: ActionDefinition = {
        semantic: { verb: 'submit', type: 'action', description: 'Submit form' },
      };
      const factors = analyzeRiskFactors(action);
      expect(factors.some((f) => f.includes('Finalizes'))).toBe(true);
    });

    it('should detect high-risk semantic', () => {
      const action: ActionDefinition = {
        semantic: { verb: 'delete', type: 'action', description: 'Delete', risk: 'high' },
      };
      const factors = analyzeRiskFactors(action);
      expect(factors.some((f) => f.includes('high-risk'))).toBe(true);
    });
  });

  describe('generateRiskMitigations', () => {
    it('should suggest mitigations for API calls', () => {
      const action: ActionDefinition = {
        semantic: { verb: 'fetch', type: 'action', description: 'Fetch' },
      };
      const factors = ['Makes external API call'];
      const mitigations = generateRiskMitigations(action, factors);
      expect(mitigations.some((m) => m.includes('network'))).toBe(true);
    });

    it('should suggest mitigations for delete actions', () => {
      const action: ActionDefinition = {
        semantic: { verb: 'delete', type: 'action', description: 'Delete' },
      };
      const factors = ['Deletes data'];
      const mitigations = generateRiskMitigations(action, factors);
      expect(mitigations.some((m) => m.includes('Confirm'))).toBe(true);
    });
  });

  describe('assessActionRisk', () => {
    it('should assess low-risk action', () => {
      const action: ActionDefinition = {
        semantic: { verb: 'view', type: 'action', description: 'View details' },
      };
      const assessment = assessActionRisk(action);
      expect(assessment.level).toBe('low');
    });

    it('should assess high-risk action', () => {
      const action: ActionDefinition = {
        semantic: { verb: 'delete', type: 'action', description: 'Delete', risk: 'high' },
        effect: {
          _tag: 'ApiCall',
          endpoint: '/api/delete',
          method: 'DELETE',
          description: 'Delete resource',
        },
      };
      const assessment = assessActionRisk(action);
      expect(assessment.level).toBe('high');
      expect(assessment.mitigations).toBeDefined();
    });

    it('should upgrade risk based on factors', () => {
      const action: ActionDefinition = {
        semantic: { verb: 'deleteAll', type: 'action', description: 'Delete all items' },
        effect: {
          _tag: 'Sequence',
          effects: [
            { _tag: 'ApiCall', endpoint: '/api/delete', method: 'DELETE', description: 'Delete' },
            { _tag: 'Navigate', to: '/home', description: 'Go home' },
            { _tag: 'EmitEvent', channel: 'audit', payload: { type: 'deleted' }, description: 'Log' },
          ],
        },
      };
      const assessment = assessActionRisk(action);
      expect(assessment.factors.length).toBeGreaterThan(0);
    });
  });

  describe('compareRiskLevels', () => {
    it('should compare equal levels', () => {
      expect(compareRiskLevels('low', 'low')).toBe(0);
      expect(compareRiskLevels('medium', 'medium')).toBe(0);
      expect(compareRiskLevels('high', 'high')).toBe(0);
    });

    it('should compare different levels', () => {
      expect(compareRiskLevels('low', 'high')).toBeLessThan(0);
      expect(compareRiskLevels('high', 'low')).toBeGreaterThan(0);
      expect(compareRiskLevels('medium', 'high')).toBeLessThan(0);
    });
  });

  describe('maxRiskLevel', () => {
    it('should return higher level', () => {
      expect(maxRiskLevel('low', 'high')).toBe('high');
      expect(maxRiskLevel('high', 'low')).toBe('high');
      expect(maxRiskLevel('low', 'medium')).toBe('medium');
      expect(maxRiskLevel('medium', 'high')).toBe('high');
    });

    it('should return same level when equal', () => {
      expect(maxRiskLevel('low', 'low')).toBe('low');
      expect(maxRiskLevel('medium', 'medium')).toBe('medium');
      expect(maxRiskLevel('high', 'high')).toBe('high');
    });
  });
});
