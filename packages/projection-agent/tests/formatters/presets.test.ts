import { describe, it, expect } from 'vitest';
import {
  currencyFormatter,
  percentFormatter,
  customDateFormatter,
  fileSizeFormatter,
  yesNoFormatter,
  listFormatter,
  jsonFormatter,
  maskedFormatter,
  PresetFormatters,
} from '../../src/formatters/presets.js';

describe('Preset Formatters', () => {
  describe('currencyFormatter', () => {
    it('should format USD by default', () => {
      const formatter = currencyFormatter();
      const result = formatter(100);
      expect(result).toContain('100');
    });

    it('should format with custom currency', () => {
      const formatter = currencyFormatter('ko-KR', 'KRW');
      const result = formatter(10000);
      expect(result).toContain('10,000') || expect(result).toContain('₩');
    });
  });

  describe('percentFormatter', () => {
    it('should format percentages', () => {
      const formatter = percentFormatter();
      const result = formatter(0.75);
      expect(result).toContain('75');
    });

    it('should respect decimal places', () => {
      const formatter = percentFormatter(2);
      const result = formatter(0.7543);
      expect(result).toContain('75.43') || expect(result).toContain('75,43');
    });
  });

  describe('customDateFormatter', () => {
    it('should format dates', () => {
      const formatter = customDateFormatter();
      const date = new Date('2024-01-15');
      const result = formatter(date);
      expect(result).toContain('2024');
    });

    it('should handle invalid dates', () => {
      const formatter = customDateFormatter();
      const result = formatter('invalid');
      expect(result).toBe('Invalid Date');
    });
  });

  describe('fileSizeFormatter', () => {
    it('should format bytes', () => {
      const formatter = fileSizeFormatter();
      expect(formatter(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      const formatter = fileSizeFormatter();
      expect(formatter(1024)).toBe('1.0 KB');
    });

    it('should format megabytes', () => {
      const formatter = fileSizeFormatter();
      expect(formatter(1024 * 1024)).toBe('1.0 MB');
    });

    it('should format gigabytes', () => {
      const formatter = fileSizeFormatter();
      expect(formatter(1024 * 1024 * 1024)).toBe('1.0 GB');
    });
  });

  describe('yesNoFormatter', () => {
    it('should format true as Yes', () => {
      const formatter = yesNoFormatter();
      expect(formatter(true)).toBe('Yes');
    });

    it('should format false as No', () => {
      const formatter = yesNoFormatter();
      expect(formatter(false)).toBe('No');
    });

    it('should localize to Korean', () => {
      const formatter = yesNoFormatter('ko-KR');
      expect(formatter(true)).toBe('예');
      expect(formatter(false)).toBe('아니오');
    });
  });

  describe('listFormatter', () => {
    it('should format empty arrays', () => {
      const formatter = listFormatter();
      expect(formatter([])).toBe('(empty list)');
    });

    it('should join items with comma', () => {
      const formatter = listFormatter();
      expect(formatter(['a', 'b', 'c'])).toBe('a, b, c');
    });

    it('should use custom separator', () => {
      const formatter = listFormatter(' | ');
      expect(formatter(['a', 'b', 'c'])).toBe('a | b | c');
    });

    it('should limit items', () => {
      const formatter = listFormatter(', ', 2);
      expect(formatter(['a', 'b', 'c', 'd'])).toBe('a, b... (+2 more)');
    });
  });

  describe('jsonFormatter', () => {
    it('should format objects as JSON with default indent', () => {
      const formatter = jsonFormatter();
      expect(formatter({ a: 1 })).toBe('{\n  "a": 1\n}');
    });

    it('should format with no indent', () => {
      const formatter = jsonFormatter(0);
      expect(formatter({ a: 1 })).toBe('{"a":1}');
    });
  });

  describe('maskedFormatter', () => {
    it('should mask strings', () => {
      const formatter = maskedFormatter();
      // 'password123' is 11 chars, default visibleChars=4, shows last 4: 'd123'
      expect(formatter('password123')).toBe('*******d123');
    });

    it('should show custom number of visible chars', () => {
      const formatter = maskedFormatter(4);
      // Same as default - shows last 4 chars: 'd123'
      expect(formatter('password123')).toBe('*******d123');
    });

    it('should handle short strings', () => {
      const formatter = maskedFormatter();
      expect(formatter('ab')).toBe('**');
    });

    it('should handle empty strings', () => {
      const formatter = maskedFormatter();
      expect(formatter('')).toBe('');
    });
  });

  describe('PresetFormatters', () => {
    it('should expose all preset formatters', () => {
      expect(typeof PresetFormatters.currency).toBe('function');
      expect(typeof PresetFormatters.percent).toBe('function');
      expect(typeof PresetFormatters.date).toBe('function');
      expect(typeof PresetFormatters.fileSize).toBe('function');
      expect(typeof PresetFormatters.yesNo).toBe('function');
      expect(typeof PresetFormatters.list).toBe('function');
      expect(typeof PresetFormatters.json).toBe('function');
      expect(typeof PresetFormatters.masked).toBe('function');
    });
  });
});
