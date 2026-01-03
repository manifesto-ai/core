/**
 * Result Monad Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  Ok,
  Err,
  isOk,
  isErr,
  map,
  flatMap,
  flatMapAsync,
  mapError,
  match,
  getOrElse,
  getOrElseW,
  fromNullable,
  tryCatch,
  tryCatchAsync,
  Do,
  type Result,
} from '../result';

describe('Result Monad', () => {
  describe('Constructors', () => {
    it('Ok creates a success result', () => {
      const result = Ok(42);
      expect(result._tag).toBe('Ok');
      expect(result.value).toBe(42);
    });

    it('Err creates a failure result', () => {
      const result = Err('error');
      expect(result._tag).toBe('Err');
      expect(result.error).toBe('error');
    });
  });

  describe('Type Guards', () => {
    it('isOk returns true for Ok', () => {
      expect(isOk(Ok(1))).toBe(true);
      expect(isOk(Err('error'))).toBe(false);
    });

    it('isErr returns true for Err', () => {
      expect(isErr(Err('error'))).toBe(true);
      expect(isErr(Ok(1))).toBe(false);
    });
  });

  describe('map', () => {
    it('transforms Ok value', () => {
      const result = map((x: number) => x * 2)(Ok(5));
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(10);
      }
    });

    it('passes through Err unchanged', () => {
      const result = map((x: number) => x * 2)(Err('error') as Result<number, string>);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('error');
      }
    });
  });

  describe('flatMap', () => {
    const safeDivide = (n: number): Result<number, string> =>
      n === 0 ? Err('division by zero') : Ok(10 / n);

    it('chains Ok values', () => {
      const result = flatMap(safeDivide)(Ok(2));
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(5);
      }
    });

    it('short-circuits on error', () => {
      const result = flatMap(safeDivide)(Ok(0));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('division by zero');
      }
    });

    it('passes through Err unchanged', () => {
      const result = flatMap(safeDivide)(Err('previous error') as Result<number, string>);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('previous error');
      }
    });
  });

  describe('flatMapAsync', () => {
    const asyncSafeDivide = async (n: number): Promise<Result<number, string>> =>
      n === 0 ? Err('division by zero') : Ok(10 / n);

    it('chains async Ok values', async () => {
      const result = await flatMapAsync(asyncSafeDivide)(Ok(2));
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(5);
      }
    });

    it('short-circuits on async error', async () => {
      const result = await flatMapAsync(asyncSafeDivide)(Ok(0));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('division by zero');
      }
    });

    it('passes through Err unchanged', async () => {
      const result = await flatMapAsync(asyncSafeDivide)(Err('previous error') as Result<number, string>);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('previous error');
      }
    });
  });

  describe('mapError', () => {
    it('transforms Err value', () => {
      const result = mapError((e: string) => new Error(e))(Err('oops'));
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it('passes through Ok unchanged', () => {
      const result = mapError((e: string) => new Error(e))(Ok(42) as Result<number, string>);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe('match', () => {
    it('calls onOk for Ok', () => {
      const result = match(
        (e: string) => `Error: ${e}`,
        (v: number) => `Value: ${v}`
      )(Ok(42) as Result<number, string>);
      expect(result).toBe('Value: 42');
    });

    it('calls onErr for Err', () => {
      const result = match(
        (e: string) => `Error: ${e}`,
        (v: number) => `Value: ${v}`
      )(Err('failed') as Result<number, string>);
      expect(result).toBe('Error: failed');
    });
  });

  describe('getOrElse', () => {
    it('returns value for Ok', () => {
      expect(getOrElse(0)(Ok(42))).toBe(42);
    });

    it('returns default for Err', () => {
      expect(getOrElse(0)(Err('error') as Result<number, string>)).toBe(0);
    });
  });

  describe('getOrElseW', () => {
    it('returns value for Ok', () => {
      expect(getOrElseW(() => 'default')(Ok(42) as Result<number, string>)).toBe(42);
    });

    it('calls function for Err', () => {
      expect(getOrElseW((e: string) => `Error: ${e}`)(Err('failed'))).toBe('Error: failed');
    });
  });

  describe('fromNullable', () => {
    it('returns Ok for non-null value', () => {
      const result = fromNullable('not found')(42);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('returns Err for null', () => {
      const result = fromNullable('not found')(null);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('not found');
      }
    });

    it('returns Err for undefined', () => {
      const result = fromNullable('not found')(undefined);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('not found');
      }
    });
  });

  describe('tryCatch', () => {
    it('returns Ok for successful function', () => {
      const result = tryCatch(
        () => JSON.parse('{"a": 1}'),
        () => 'Parse error'
      );
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({ a: 1 });
      }
    });

    it('returns Err for throwing function', () => {
      const result = tryCatch(
        () => JSON.parse('invalid'),
        () => 'Parse error'
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('Parse error');
      }
    });
  });

  describe('tryCatchAsync', () => {
    it('returns Ok for successful async function', async () => {
      const result = await tryCatchAsync(
        async () => Promise.resolve(42),
        () => 'error'
      );
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42);
      }
    });

    it('returns Err for rejecting async function', async () => {
      const result = await tryCatchAsync(
        async () => Promise.reject(new Error('fail')),
        () => 'async error'
      );
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('async error');
      }
    });
  });

  describe('Do notation', () => {
    it('chains multiple bindings', () => {
      const result = Do<{ x: number }, string>(Ok({ x: 1 }))
        .bind('a', (ctx) => Ok(ctx.x + 1))
        .bind('b', (ctx) => Ok(ctx.a * 2))
        .return((ctx) => ctx.a + ctx.b);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(6); // a=2, b=4, result=6
      }
    });

    it('short-circuits on error', () => {
      const result = Do<{ x: number }, string>(Ok({ x: 1 }))
        .bind('a', (): Result<number, string> => Err('error'))
        .bind('b', (ctx) => Ok((ctx as { a: number }).a * 2))
        .return((ctx) => (ctx as { b: number }).b);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toBe('error');
      }
    });
  });
});
