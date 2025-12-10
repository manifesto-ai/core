/**
 * Preset Formatters
 *
 * Common formatting patterns for typical use cases.
 */

import type { ValueFormatter } from '../types.js';

// =============================================================================
// Currency Formatter
// =============================================================================

/**
 * Create a currency formatter.
 */
export function currencyFormatter(
  locale = 'en-US',
  currency = 'USD'
): ValueFormatter<number> {
  return (value) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(value);
  };
}

// =============================================================================
// Percent Formatter
// =============================================================================

/**
 * Create a percent formatter.
 */
export function percentFormatter(decimals = 0): ValueFormatter<number> {
  return (value) => {
    return `${(value * 100).toFixed(decimals)}%`;
  };
}

// =============================================================================
// Date Formatters
// =============================================================================

/**
 * Create a date formatter with custom format.
 */
export function customDateFormatter(
  format = 'medium',
  locale = 'en-US'
): ValueFormatter<Date | string> {
  return (value) => {
    const date = typeof value === 'string' ? new Date(value) : value;

    if (Number.isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    switch (format) {
      case 'short':
        return date.toLocaleDateString(locale, { dateStyle: 'short' });
      case 'long':
        return date.toLocaleDateString(locale, { dateStyle: 'long' });
      case 'full':
        return date.toLocaleDateString(locale, { dateStyle: 'full' });
      case 'time':
        return date.toLocaleTimeString(locale, { timeStyle: 'short' });
      case 'datetime':
        return date.toLocaleString(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
      case 'iso':
        return date.toISOString();
      case 'medium':
      default:
        return date.toLocaleDateString(locale, { dateStyle: 'medium' });
    }
  };
}

/**
 * Create a relative time formatter (e.g., "2 hours ago").
 */
export function relativeTimeFormatter(locale = 'en-US'): ValueFormatter<Date | string> {
  return (value) => {
    const date = typeof value === 'string' ? new Date(value) : value;

    if (Number.isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    const now = Date.now();
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (days > 0) return rtf.format(-days, 'day');
    if (hours > 0) return rtf.format(-hours, 'hour');
    if (minutes > 0) return rtf.format(-minutes, 'minute');
    return rtf.format(-seconds, 'second');
  };
}

// =============================================================================
// File Size Formatter
// =============================================================================

/**
 * Create a file size formatter.
 */
export function fileSizeFormatter(): ValueFormatter<number> {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];

  return (bytes) => {
    if (bytes === 0) return '0 B';
    if (bytes < 0) return '-' + formatSize(-bytes);

    return formatSize(bytes);

    function formatSize(b: number): string {
      const i = Math.floor(Math.log(b) / Math.log(1024));
      const size = b / Math.pow(1024, i);
      return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
    }
  };
}

// =============================================================================
// Phone Number Formatter
// =============================================================================

/**
 * Create a phone number formatter.
 */
export function phoneNumberFormatter(countryCode = 'US'): ValueFormatter<string> {
  return (value) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');

    // Simple US formatting
    if (countryCode === 'US' && digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }

    // Simple KR formatting
    if (countryCode === 'KR' && digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }

    // Default: return as-is
    return value;
  };
}

// =============================================================================
// Yes/No Formatter
// =============================================================================

/**
 * Create a localized yes/no formatter.
 */
export function yesNoFormatter(locale = 'en-US'): ValueFormatter<boolean> {
  return (value) => {
    if (locale.startsWith('ko')) {
      return value ? '예' : '아니오';
    }
    if (locale.startsWith('ja')) {
      return value ? 'はい' : 'いいえ';
    }
    if (locale.startsWith('zh')) {
      return value ? '是' : '否';
    }
    if (locale.startsWith('de')) {
      return value ? 'Ja' : 'Nein';
    }
    if (locale.startsWith('fr')) {
      return value ? 'Oui' : 'Non';
    }
    if (locale.startsWith('es')) {
      return value ? 'Sí' : 'No';
    }

    return value ? 'Yes' : 'No';
  };
}

// =============================================================================
// List Formatter
// =============================================================================

/**
 * Create a list formatter.
 */
export function listFormatter(
  separator = ', ',
  limit?: number
): ValueFormatter<unknown[]> {
  return (value) => {
    if (value.length === 0) return '(empty list)';

    const items = limit ? value.slice(0, limit) : value;
    const formatted = items.map((item) => String(item)).join(separator);

    if (limit && value.length > limit) {
      return `${formatted}... (+${value.length - limit} more)`;
    }

    return formatted;
  };
}

// =============================================================================
// JSON Formatter
// =============================================================================

/**
 * Create a JSON formatter (for debugging).
 */
export function jsonFormatter(indent = 2): ValueFormatter<unknown> {
  return (value) => {
    try {
      return JSON.stringify(value, null, indent);
    } catch {
      return '[Circular or Invalid JSON]';
    }
  };
}

// =============================================================================
// Masked Formatter
// =============================================================================

/**
 * Create a masked formatter (for sensitive data).
 */
export function maskedFormatter(visibleChars = 4): ValueFormatter<string> {
  return (value) => {
    if (value.length <= visibleChars) {
      return '*'.repeat(value.length);
    }

    const visible = value.slice(-visibleChars);
    const masked = '*'.repeat(value.length - visibleChars);
    return masked + visible;
  };
}

// =============================================================================
// Preset Formatters Collection
// =============================================================================

/**
 * Collection of preset formatter factories.
 */
export const PresetFormatters = {
  currency: currencyFormatter,
  percent: percentFormatter,
  date: customDateFormatter,
  relativeTime: relativeTimeFormatter,
  fileSize: fileSizeFormatter,
  phoneNumber: phoneNumberFormatter,
  yesNo: yesNoFormatter,
  list: listFormatter,
  json: jsonFormatter,
  masked: maskedFormatter,
};
