/**
 * @manifesto-ai/agent - Effect Validation Tests
 *
 * Rigorous tests for effect structure validation.
 */

import { describe, it, expect } from 'vitest';
import {
  validateEffectStructure,
  validateAgentDecision,
} from '../../src/session/validate-effect.js';
import { generateEffectId } from '../../src/types/effect.js';

describe('Effect Structure Validation', () => {
  describe('validateEffectStructure', () => {
    describe('common validation', () => {
      it('should reject null effect', () => {
        const result = validateEffectStructure(null);
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('null');
      });

      it('should reject undefined effect', () => {
        const result = validateEffectStructure(undefined);
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('undefined');
      });

      it('should reject non-object effect', () => {
        expect(validateEffectStructure('string').ok).toBe(false);
        expect(validateEffectStructure(123).ok).toBe(false);
        expect(validateEffectStructure(true).ok).toBe(false);
        expect(validateEffectStructure([]).ok).toBe(false);
      });

      it('should reject effect without type field', () => {
        const result = validateEffectStructure({ id: 'test' });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('type');
      });

      it('should reject effect with non-string type', () => {
        const result = validateEffectStructure({ type: 123, id: 'test' });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('string');
      });

      it('should reject effect without id field', () => {
        const result = validateEffectStructure({ type: 'log.emit' });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('id');
      });

      it('should reject effect with non-string id', () => {
        const result = validateEffectStructure({ type: 'log.emit', id: 123 });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('string');
      });

      it('should reject unknown effect type', () => {
        const result = validateEffectStructure({
          type: 'unknown.type',
          id: generateEffectId(),
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('Unknown effect type');
      });
    });

    describe('tool.call validation', () => {
      it('should accept valid tool.call effect', () => {
        const result = validateEffectStructure({
          type: 'tool.call',
          id: generateEffectId(),
          tool: 'search',
          input: { query: 'test' },
        });
        expect(result.ok).toBe(true);
      });

      it('should reject tool.call without tool field', () => {
        const result = validateEffectStructure({
          type: 'tool.call',
          id: generateEffectId(),
          input: {},
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('tool');
      });

      it('should reject tool.call with non-string tool', () => {
        const result = validateEffectStructure({
          type: 'tool.call',
          id: generateEffectId(),
          tool: 123,
          input: {},
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('string');
      });

      it('should reject tool.call without input field', () => {
        const result = validateEffectStructure({
          type: 'tool.call',
          id: generateEffectId(),
          tool: 'search',
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('input');
      });

      it('should accept tool.call with null input', () => {
        const result = validateEffectStructure({
          type: 'tool.call',
          id: generateEffectId(),
          tool: 'search',
          input: null,
        });
        expect(result.ok).toBe(true);
      });
    });

    describe('snapshot.patch validation', () => {
      it('should accept valid snapshot.patch effect', () => {
        const result = validateEffectStructure({
          type: 'snapshot.patch',
          id: generateEffectId(),
          ops: [{ op: 'set', path: 'data.value', value: 42 }],
        });
        expect(result.ok).toBe(true);
      });

      it('should reject snapshot.patch without ops field', () => {
        const result = validateEffectStructure({
          type: 'snapshot.patch',
          id: generateEffectId(),
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('ops');
      });

      it('should reject snapshot.patch with non-array ops', () => {
        const result = validateEffectStructure({
          type: 'snapshot.patch',
          id: generateEffectId(),
          ops: 'not an array',
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('array');
      });

      it('should accept snapshot.patch with empty ops array', () => {
        const result = validateEffectStructure({
          type: 'snapshot.patch',
          id: generateEffectId(),
          ops: [],
        });
        expect(result.ok).toBe(true);
      });

      it('should reject invalid op in ops array', () => {
        const result = validateEffectStructure({
          type: 'snapshot.patch',
          id: generateEffectId(),
          ops: [{ op: 'delete', path: 'data.x' }],
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('set');
      });

      it('should reject op without path', () => {
        const result = validateEffectStructure({
          type: 'snapshot.patch',
          id: generateEffectId(),
          ops: [{ op: 'set', value: 42 }],
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('path');
      });

      it('should reject op without value', () => {
        const result = validateEffectStructure({
          type: 'snapshot.patch',
          id: generateEffectId(),
          ops: [{ op: 'set', path: 'data.x' }],
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('value');
      });

      it('should accept both set and append ops', () => {
        const result = validateEffectStructure({
          type: 'snapshot.patch',
          id: generateEffectId(),
          ops: [
            { op: 'set', path: 'data.x', value: 1 },
            { op: 'append', path: 'data.items', value: 'new' },
          ],
        });
        expect(result.ok).toBe(true);
      });
    });

    describe('log.emit validation', () => {
      it('should accept valid log.emit effect', () => {
        const result = validateEffectStructure({
          type: 'log.emit',
          id: generateEffectId(),
          level: 'info',
          message: 'Test message',
        });
        expect(result.ok).toBe(true);
      });

      it('should reject log.emit without level', () => {
        const result = validateEffectStructure({
          type: 'log.emit',
          id: generateEffectId(),
          message: 'Test',
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('level');
      });

      it('should reject log.emit with invalid level', () => {
        const result = validateEffectStructure({
          type: 'log.emit',
          id: generateEffectId(),
          level: 'critical',
          message: 'Test',
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('debug');
      });

      it('should accept all valid levels', () => {
        const levels = ['debug', 'info', 'warn', 'error'] as const;
        for (const level of levels) {
          const result = validateEffectStructure({
            type: 'log.emit',
            id: generateEffectId(),
            level,
            message: 'Test',
          });
          expect(result.ok).toBe(true);
        }
      });

      it('should reject log.emit without message', () => {
        const result = validateEffectStructure({
          type: 'log.emit',
          id: generateEffectId(),
          level: 'info',
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('message');
      });

      it('should reject log.emit with non-string message', () => {
        const result = validateEffectStructure({
          type: 'log.emit',
          id: generateEffectId(),
          level: 'info',
          message: 123,
        });
        expect(result.ok).toBe(false);
        expect(result.issue).toContain('string');
      });

      it('should accept log.emit with optional data', () => {
        const result = validateEffectStructure({
          type: 'log.emit',
          id: generateEffectId(),
          level: 'info',
          message: 'Test',
          data: { extra: 'info' },
        });
        expect(result.ok).toBe(true);
      });
    });
  });

  describe('validateAgentDecision', () => {
    it('should accept valid decision', () => {
      const result = validateAgentDecision({
        effects: [
          { type: 'log.emit', id: generateEffectId(), level: 'info', message: 'Test' },
        ],
      });
      expect(result.ok).toBe(true);
    });

    it('should accept decision with empty effects', () => {
      const result = validateAgentDecision({ effects: [] });
      expect(result.ok).toBe(true);
    });

    it('should reject null decision', () => {
      const result = validateAgentDecision(null);
      expect(result.ok).toBe(false);
      expect(result.issue).toContain('null');
    });

    it('should reject decision without effects field', () => {
      const result = validateAgentDecision({});
      expect(result.ok).toBe(false);
      expect(result.issue).toContain('effects');
    });

    it('should reject decision with non-array effects', () => {
      const result = validateAgentDecision({ effects: 'not an array' });
      expect(result.ok).toBe(false);
      expect(result.issue).toContain('array');
    });

    it('should reject decision with invalid effect in array', () => {
      const result = validateAgentDecision({
        effects: [
          { type: 'log.emit', id: generateEffectId(), level: 'info', message: 'Valid' },
          { type: 'invalid', id: generateEffectId() },
        ],
      });
      expect(result.ok).toBe(false);
      expect(result.issue).toContain('effects[1]');
    });

    it('should accept decision with trace', () => {
      const result = validateAgentDecision({
        effects: [],
        trace: {
          model: 'gpt-4',
          tokensIn: 100,
          tokensOut: 50,
        },
      });
      expect(result.ok).toBe(true);
    });
  });
});
