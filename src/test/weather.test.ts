import { describe, it, expect } from 'vitest';
import { mapWmoCodeToCondition } from '../api/weather';

describe('Weather API WMO Code Mapping', () => {
  it('maps clear sky code 0 to sunny', () => {
    const result = mapWmoCodeToCondition(0);
    expect(result.text).toBe('Clear & Sunny');
    expect(result.icon).toBe('sun');
  });

  it('maps codes 1-3 to partly cloudy', () => {
    expect(mapWmoCodeToCondition(1).text).toBe('Partly Cloudy');
    expect(mapWmoCodeToCondition(2).icon).toBe('cloud');
    expect(mapWmoCodeToCondition(3).text).toBe('Partly Cloudy');
  });

  it('maps rain showers and drizzle to rain icon', () => {
    expect(mapWmoCodeToCondition(51).icon).toBe('rain');
    expect(mapWmoCodeToCondition(61).icon).toBe('rain');
    expect(mapWmoCodeToCondition(80).text).toBe('Rain Showers');
  });

  it('maps snow codes to snow icon', () => {
    expect(mapWmoCodeToCondition(71).icon).toBe('snow');
    expect(mapWmoCodeToCondition(73).text).toBe('Snowy Flurries');
  });

  it('maps thunderstorm codes to thunder icon', () => {
    expect(mapWmoCodeToCondition(95).icon).toBe('thunder');
    expect(mapWmoCodeToCondition(95).text).toBe('Thunderstorm');
  });

  it('maps fog codes to fog icon', () => {
    expect(mapWmoCodeToCondition(45).icon).toBe('fog');
    expect(mapWmoCodeToCondition(45).text).toBe('Foggy Mist');
  });
});
