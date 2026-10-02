import { describe, it, expect } from 'vitest';
import { getFormattedClock, formatMediaCaptureTime } from '../utils/dateUtils';

describe('Date & Clock Utilities', () => {
  it('formats current clock with 12-hour format including AM/PM and seconds', () => {
    const clock = getFormattedClock(true);
    expect(clock.timeString).toMatch(/^\d{1,2}:\d{2}$/);
    expect(['AM', 'PM']).toContain(clock.periodString);
    expect(clock.secondsString).toMatch(/^\d{2}$/);
    expect(clock.dateString).toBeDefined();
    expect(clock.dayName).toBeDefined();
    expect(clock.timeZone).toBeDefined();
  });

  it('formats current clock with 24-hour format', () => {
    const clock = getFormattedClock(false);
    expect(clock.timeString).toMatch(/^\d{2}:\d{2}$/);
    expect(clock.periodString).toBeUndefined();
  });

  it('formats ISO media creation time to human readable format', () => {
    const formatted = formatMediaCaptureTime('2025-11-14T06:45:00Z');
    // Locale-independent: compare against the runtime's own November rendering
    // rather than hardcoding the English abbreviation.
    const expectedMonth = new Date('2025-11-14T06:45:00Z').toLocaleDateString(undefined, {
      month: 'short',
    });
    expect(formatted).toContain('2025');
    expect(formatted).toContain(expectedMonth);
  });

  it('returns empty string for missing or invalid dates', () => {
    expect(formatMediaCaptureTime(undefined)).toBe('');
    expect(formatMediaCaptureTime('invalid-date')).toBe('');
  });
});
