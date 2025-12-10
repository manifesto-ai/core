import { describe, it, expect } from 'vitest';
import type { SemanticPath } from '@manifesto-ai/core';
import {
  isAgentDomainInfo,
  isAgentPathInfo,
  isAgentActionInfo,
  isAgentSuggestion,
  isAgentContext,
} from '../src/types.js';

describe('Type Guards', () => {
  describe('isAgentDomainInfo', () => {
    it('should return true for valid domain info', () => {
      const domain = {
        id: 'test',
        name: 'Test Domain',
        description: 'A test domain',
      };
      expect(isAgentDomainInfo(domain)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isAgentDomainInfo(null)).toBe(false);
      expect(isAgentDomainInfo(undefined)).toBe(false);
      expect(isAgentDomainInfo({})).toBe(false);
      expect(isAgentDomainInfo({ id: 'test' })).toBe(false);
    });
  });

  describe('isAgentPathInfo', () => {
    it('should return true for valid path info', () => {
      const path = {
        path: 'data.test' as SemanticPath,
        value: 'value',
        displayValue: 'value',
        semantic: { type: 'input', description: 'Test' },
        validity: { valid: true, issues: [] },
        policy: { relevant: true, editable: true, required: false, visible: true },
      };
      expect(isAgentPathInfo(path)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isAgentPathInfo(null)).toBe(false);
      expect(isAgentPathInfo({})).toBe(false);
      expect(isAgentPathInfo({ path: 'test' })).toBe(false);
    });
  });

  describe('isAgentActionInfo', () => {
    it('should return true for valid action info', () => {
      const action = {
        id: 'action.test',
        verb: 'test',
        description: 'Test action',
        canExecute: true,
        blockedReasons: [],
        willDo: [],
        risk: 'low',
        requiresInput: false,
      };
      expect(isAgentActionInfo(action)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isAgentActionInfo(null)).toBe(false);
      expect(isAgentActionInfo({})).toBe(false);
      expect(isAgentActionInfo({ id: 'test' })).toBe(false);
    });

    it('should validate risk level', () => {
      const action = {
        id: 'test',
        verb: 'test',
        description: 'test',
        canExecute: true,
        blockedReasons: [],
        willDo: [],
        risk: 'invalid',
        requiresInput: false,
      };
      expect(isAgentActionInfo(action)).toBe(false);
    });
  });

  describe('isAgentSuggestion', () => {
    it('should return true for valid suggestion', () => {
      const suggestion = {
        action: 'action.test',
        reason: 'Because it is available',
        confidence: 0.85,
      };
      expect(isAgentSuggestion(suggestion)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isAgentSuggestion(null)).toBe(false);
      expect(isAgentSuggestion({})).toBe(false);
    });

    it('should validate confidence range', () => {
      expect(isAgentSuggestion({ action: 'test', reason: 'test', confidence: -0.1 })).toBe(false);
      expect(isAgentSuggestion({ action: 'test', reason: 'test', confidence: 1.1 })).toBe(false);
      expect(isAgentSuggestion({ action: 'test', reason: 'test', confidence: 0 })).toBe(true);
      expect(isAgentSuggestion({ action: 'test', reason: 'test', confidence: 1 })).toBe(true);
    });
  });

  describe('isAgentContext', () => {
    it('should return true for valid context', () => {
      const context = {
        domain: { id: 'test', name: 'Test', description: 'Test domain' },
        summary: 'Test summary',
        paths: [],
        availableActions: [],
        generatedAt: Date.now(),
        snapshotVersion: 1,
      };
      expect(isAgentContext(context)).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isAgentContext(null)).toBe(false);
      expect(isAgentContext({})).toBe(false);
    });

    it('should validate nested domain info', () => {
      const context = {
        domain: { id: 'test' }, // Invalid domain
        summary: 'Test',
        paths: [],
        availableActions: [],
        generatedAt: Date.now(),
        snapshotVersion: 1,
      };
      expect(isAgentContext(context)).toBe(false);
    });
  });
});
