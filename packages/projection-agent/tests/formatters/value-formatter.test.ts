import { describe, it, expect } from 'vitest';
import {
  stringFormatter,
  numberFormatter,
  booleanFormatter,
  dateFormatter,
  arrayFormatter,
  objectFormatter,
  nullFormatter,
  undefinedFormatter,
  formatUnknown,
  createFormatterRegistry,
  formatValue,
  registerFormatter,
  mergeRegistries,
} from '../../src/formatters/value-formatter.js';

describe('Value Formatters', () => {
  describe('stringFormatter', () => {
    it('should format strings', () => {
      expect(stringFormatter('hello')).toBe('hello');
    });

    it('should handle empty strings', () => {
      expect(stringFormatter('')).toBe('(empty)');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(100);
      expect(stringFormatter(longString, { truncateLength: 10 })).toBe('aaaaaaaaaa...');
    });
  });

  describe('numberFormatter', () => {
    it('should format numbers', () => {
      expect(numberFormatter(1234.56)).toContain('1');
    });

    it('should handle NaN', () => {
      expect(numberFormatter(NaN)).toBe('NaN');
    });

    it('should handle infinity', () => {
      expect(numberFormatter(Infinity)).toBe('∞');
      expect(numberFormatter(-Infinity)).toBe('-∞');
    });
  });

  describe('booleanFormatter', () => {
    it('should format true', () => {
      expect(booleanFormatter(true)).toBe('Yes');
    });

    it('should format false', () => {
      expect(booleanFormatter(false)).toBe('No');
    });

    it('should localize for Korean', () => {
      expect(booleanFormatter(true, { locale: 'ko-KR' })).toBe('예');
      expect(booleanFormatter(false, { locale: 'ko-KR' })).toBe('아니오');
    });
  });

  describe('dateFormatter', () => {
    it('should format Date objects', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = dateFormatter(date);
      expect(result).toContain('2024');
    });

    it('should format date strings', () => {
      const result = dateFormatter('2024-01-15');
      expect(result).toContain('2024');
    });

    it('should handle invalid dates', () => {
      expect(dateFormatter('invalid')).toBe('Invalid Date');
    });
  });

  describe('arrayFormatter', () => {
    it('should format empty arrays', () => {
      expect(arrayFormatter([])).toBe('(empty list)');
    });

    it('should format arrays with items', () => {
      expect(arrayFormatter([1, 2, 3])).toBe('1, 2, 3');
    });

    it('should format long arrays', () => {
      const longArray = Array.from({ length: 20 }, (_, i) => i);
      const result = arrayFormatter(longArray);
      expect(result).toContain('0, 1');
    });
  });

  describe('objectFormatter', () => {
    it('should format empty objects', () => {
      expect(objectFormatter({})).toBe('(empty object)');
    });

    it('should format objects', () => {
      expect(objectFormatter({ a: 1 })).toBe('{"a":1}');
    });
  });

  describe('nullFormatter', () => {
    it('should format null', () => {
      expect(nullFormatter(null)).toBe('(none)');
    });

    it('should use custom display', () => {
      expect(nullFormatter(null, { nullDisplay: 'N/A' })).toBe('N/A');
    });
  });

  describe('undefinedFormatter', () => {
    it('should format undefined', () => {
      expect(undefinedFormatter(undefined)).toBe('(not set)');
    });

    it('should use custom display', () => {
      expect(undefinedFormatter(undefined, { undefinedDisplay: '-' })).toBe('-');
    });
  });

  describe('formatUnknown', () => {
    it('should handle null', () => {
      expect(formatUnknown(null)).toBe('(none)');
    });

    it('should handle undefined', () => {
      expect(formatUnknown(undefined)).toBe('(not set)');
    });

    it('should handle strings', () => {
      expect(formatUnknown('test')).toBe('test');
    });

    it('should handle numbers', () => {
      expect(formatUnknown(42)).toContain('42');
    });

    it('should handle booleans', () => {
      expect(formatUnknown(true)).toBe('Yes');
    });
  });
});

describe('Formatter Registry', () => {
  describe('createFormatterRegistry', () => {
    it('should create a registry with default formatters', () => {
      const registry = createFormatterRegistry();
      expect(registry.formatters.has('string')).toBe(true);
      expect(registry.formatters.has('number')).toBe(true);
      expect(registry.formatters.has('boolean')).toBe(true);
    });
  });

  describe('registerFormatter', () => {
    it('should add a new formatter', () => {
      const registry = createFormatterRegistry();
      const customFormatter = () => 'custom';
      registerFormatter(registry, 'custom', customFormatter);
      expect(registry.formatters.has('custom')).toBe(true);
    });
  });

  describe('mergeRegistries', () => {
    it('should merge two registries', () => {
      const registry1 = createFormatterRegistry();
      const registry2 = createFormatterRegistry();
      registry2.formatters.set('custom', () => 'value');

      const merged = mergeRegistries(registry1, registry2);
      expect(merged.formatters.has('custom')).toBe(true);
    });
  });

  describe('formatValue', () => {
    it('should use semantic type hint', () => {
      const registry = createFormatterRegistry();
      const semantic = { type: 'input', description: 'test' };
      const result = formatValue('hello', semantic, registry);
      expect(result).toBe('hello');
    });

    it('should handle unknown values', () => {
      const registry = createFormatterRegistry();
      const semantic = { type: 'input', description: 'test' };
      const result = formatValue({ complex: 'value' }, semantic, registry);
      expect(result).toContain('complex');
    });
  });
});
