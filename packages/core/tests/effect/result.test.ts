import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  flatMap,
  all,
  any,
  tryCatch,
} from '../../src/effect/result.js';

describe('Result', () => {
  describe('constructors', () => {
    it('should create ok result', () => {
      const result = ok(42);
      expect(result).toEqual({ ok: true, value: 42 });
    });

    it('should create err result', () => {
      const result = err('error');
      expect(result).toEqual({ ok: false, error: 'error' });
    });
  });

  describe('type guards', () => {
    it('should identify ok result', () => {
      expect(isOk(ok(42))).toBe(true);
      expect(isOk(err('error'))).toBe(false);
    });

    it('should identify err result', () => {
      expect(isErr(ok(42))).toBe(false);
      expect(isErr(err('error'))).toBe(true);
    });
  });

  describe('unwrap', () => {
    it('should unwrap ok result', () => {
      expect(unwrap(ok(42))).toBe(42);
    });

    it('should throw on err result', () => {
      expect(() => unwrap(err('error'))).toThrow('error');
    });
  });

  describe('unwrapOr', () => {
    it('should return value for ok result', () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it('should return default for err result', () => {
      expect(unwrapOr(err('error'), 0)).toBe(0);
    });
  });

  describe('map', () => {
    it('should map ok value', () => {
      const result = map(ok(2), (x) => x * 2);
      expect(result).toEqual({ ok: true, value: 4 });
    });

    it('should pass through err', () => {
      const result = map(err('error') as any, (x: number) => x * 2);
      expect(result).toEqual({ ok: false, error: 'error' });
    });
  });

  describe('flatMap', () => {
    it('should chain ok results', () => {
      const result = flatMap(ok(2), (x) => ok(x * 2));
      expect(result).toEqual({ ok: true, value: 4 });
    });

    it('should short-circuit on err', () => {
      const result = flatMap(err('first') as any, (x: number) => ok(x * 2));
      expect(result).toEqual({ ok: false, error: 'first' });
    });

    it('should propagate inner err', () => {
      const result = flatMap(ok(2), () => err('inner'));
      expect(result).toEqual({ ok: false, error: 'inner' });
    });
  });

  describe('all', () => {
    it('should combine all ok results', () => {
      const results = [ok(1), ok(2), ok(3)];
      const result = all(results);
      expect(result).toEqual({ ok: true, value: [1, 2, 3] });
    });

    it('should return first err', () => {
      const results = [ok(1), err('error'), ok(3)];
      const result = all(results as any);
      expect(result).toEqual({ ok: false, error: 'error' });
    });
  });

  describe('any', () => {
    it('should return first ok', () => {
      const results = [err('a'), ok(2), err('c')];
      const result = any(results as any);
      expect(result).toEqual({ ok: true, value: 2 });
    });

    it('should collect all errors if no ok', () => {
      const results = [err('a'), err('b'), err('c')];
      const result = any(results);
      expect(result).toEqual({ ok: false, error: ['a', 'b', 'c'] });
    });
  });

  describe('tryCatch', () => {
    it('should return ok for successful function', () => {
      const result = tryCatch(() => 42);
      expect(result).toEqual({ ok: true, value: 42 });
    });

    it('should return err for throwing function', () => {
      const result = tryCatch(() => {
        throw new Error('oops');
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('oops');
      }
    });

    it('should use custom error mapper', () => {
      const result = tryCatch(
        () => {
          throw 'string error';
        },
        () => new Error('mapped')
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toBe('mapped');
      }
    });
  });
});
