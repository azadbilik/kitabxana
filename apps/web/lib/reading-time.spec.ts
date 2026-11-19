import { describe, expect, it } from 'vitest';
import { formatReadingTime, readingMinutes, roundReadingTime } from './reading-time';

describe('readingMinutes', () => {
  it('reads verse slower than prose', () => {
    expect(readingMinutes(360, 'POEM')).toBe(3);
    expect(readingMinutes(360, 'PROSE')).toBe(2);
    expect(readingMinutes(360, 'PLAY')).toBe(2);
  });
  it('is nothing for a text without words', () => {
    expect(readingMinutes(0, 'POEM')).toBe(0);
    expect(readingMinutes(null)).toBe(0);
  });
});

describe('roundReadingTime', () => {
  it('gives at least a minute', () => expect(roundReadingTime(0.2)).toEqual({ minutes: 1 }));
  it('gives nothing for no time', () => expect(roundReadingTime(0)).toBeNull());
  it('keeps whole minutes under an hour', () => expect(roundReadingTime(59.4)).toEqual({ minutes: 59 }));
  it('rounds hours to five minutes', () => {
    expect(roundReadingTime(83)).toEqual({ hours: 1, minutes: 25 });
    expect(roundReadingTime(121)).toEqual({ hours: 2 });
    expect(roundReadingTime(178)).toEqual({ hours: 3 });
  });
  it('gives whole hours from ten', () => expect(roundReadingTime(700)).toEqual({ hours: 12 }));
});

describe('formatReadingTime', () => {
  const t = (key: string, v: Record<string, number>) => `${key}:${Object.values(v).join(',')}`;
  it('picks the message', () => {
    expect(formatReadingTime(t, 4)).toBe('time_min:4');
    expect(formatReadingTime(t, 90)).toBe('time_hm:1,30');
    expect(formatReadingTime(t, 240)).toBe('time_h:4');
    expect(formatReadingTime(t, 0)).toBeNull();
  });
});
