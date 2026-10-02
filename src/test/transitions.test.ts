import { describe, it, expect } from 'vitest';
import { ALL_TRANSITIONS, getRandomTransition, getTransitionClasses } from '../utils/transitions';

describe('Transition engine', () => {
  it('only ever returns a concrete effect, never "random"', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(ALL_TRANSITIONS).toContain(getRandomTransition());
    }
  });

  it('eventually produces more than one effect', () => {
    const seen = new Set(Array.from({ length: 200 }, () => getRandomTransition()));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('maps each named effect to its animation class', () => {
    expect(getTransitionClasses('ken-burns')).toContain('animate-ken-burns');
    expect(getTransitionClasses('slide-left')).toContain('animate-slide-left');
    expect(getTransitionClasses('scale-up')).toContain('animate-scale-up');
    expect(getTransitionClasses('crossfade')).toContain('animate-fade-in');
  });

  it('uses the supplied effect when the mode is random', () => {
    expect(getTransitionClasses('random', 'slide-left')).toContain('animate-slide-left');
  });

  it('falls back to ken-burns if no random effect has been picked yet', () => {
    expect(getTransitionClasses('random')).toContain('animate-ken-burns');
  });
});
