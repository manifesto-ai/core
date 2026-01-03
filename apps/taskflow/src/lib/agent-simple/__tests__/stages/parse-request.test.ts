/**
 * Parse Request Stage Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { parseRequest } from '../../stages/parse-request';
import { isOk, isErr } from '../../result';
import type { SimpleAgentError } from '../../types';

describe('parseRequest', () => {
  const validSnapshot = {
    data: { tasks: [] },
    state: {
      viewMode: 'kanban',
      dateFilter: null,
      selectedTaskId: null,
    },
  };

  describe('valid inputs', () => {
    it('parses valid request body', () => {
      const result = parseRequest({
        instruction: 'Create a task',
        snapshot: validSnapshot,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.instruction).toBe('Create a task');
        expect(result.value.snapshot).toEqual(validSnapshot);
      }
    });

    it('trims instruction whitespace', () => {
      const result = parseRequest({
        instruction: '  Create a task  ',
        snapshot: validSnapshot,
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.instruction).toBe('Create a task');
      }
    });
  });

  describe('invalid inputs', () => {
    it('returns error for null body', () => {
      const result = parseRequest(null);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('validation');
        if (result.error.kind === 'validation') {
          expect(result.error.field).toBe('body');
        }
      }
    });

    it('returns error for undefined body', () => {
      const result = parseRequest(undefined);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('validation');
      }
    });

    it('returns error for missing instruction', () => {
      const result = parseRequest({
        snapshot: validSnapshot,
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('validation');
        if (result.error.kind === 'validation') {
          expect(result.error.field).toBe('instruction');
        }
      }
    });

    it('returns error for non-string instruction', () => {
      const result = parseRequest({
        instruction: 123,
        snapshot: validSnapshot,
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('validation');
        if (result.error.kind === 'validation') {
          expect(result.error.field).toBe('instruction');
        }
      }
    });

    it('returns error for missing snapshot', () => {
      const result = parseRequest({
        instruction: 'Create a task',
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('validation');
        if (result.error.kind === 'validation') {
          expect(result.error.field).toBe('snapshot');
        }
      }
    });

    it('returns error for invalid snapshot structure (missing data)', () => {
      const result = parseRequest({
        instruction: 'Create a task',
        snapshot: { state: {} },
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('validation');
        if (result.error.kind === 'validation') {
          expect(result.error.field).toBe('snapshot.data');
        }
      }
    });

    it('returns error for invalid snapshot structure (missing state)', () => {
      const result = parseRequest({
        instruction: 'Create a task',
        snapshot: { data: { tasks: [] } },
      });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.kind).toBe('validation');
        if (result.error.kind === 'validation') {
          expect(result.error.field).toBe('snapshot.state');
        }
      }
    });
  });
});
