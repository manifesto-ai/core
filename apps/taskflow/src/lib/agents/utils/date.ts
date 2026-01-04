/**
 * Date utilities for agent system
 *
 * Uses Intl.DateTimeFormat for timezone-aware date formatting.
 * Default timezone can be overridden by passing client's timezone.
 */

export interface DateContext {
  today: string;      // YYYY-MM-DD
  tomorrow: string;   // YYYY-MM-DD
  dayAfterTomorrow: string;
  dayOfWeek: string;  // e.g., "Saturday"
}

/**
 * Get date context for LLM prompts
 *
 * @param timezone - IANA timezone string (e.g., 'Asia/Seoul', 'America/New_York')
 *                   If not provided, uses server's local timezone
 */
export function getDateContext(timezone?: string): DateContext {
  const now = new Date();

  const formatDate = (date: Date): string => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timezone,
    });
    return formatter.format(date); // Returns YYYY-MM-DD format
  };

  const getDayOfWeek = (date: Date): string => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: timezone,
    });
    return formatter.format(date);
  };

  // Calculate tomorrow and day after tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayAfterTomorrow = new Date(now);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  return {
    today: formatDate(now),
    tomorrow: formatDate(tomorrow),
    dayAfterTomorrow: formatDate(dayAfterTomorrow),
    dayOfWeek: getDayOfWeek(now),
  };
}

/**
 * Format a single date to YYYY-MM-DD
 */
export function formatDateISO(date: Date, timezone?: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  });
  return formatter.format(date);
}

/**
 * Build date context string for LLM prompts
 */
export function buildDateContextString(timezone?: string): string {
  const ctx = getDateContext(timezone);
  return `Today: ${ctx.today} (${ctx.dayOfWeek})
Tomorrow: ${ctx.tomorrow}
Day after tomorrow: ${ctx.dayAfterTomorrow}`;
}
