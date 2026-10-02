import { TransitionType } from '../types';

export const ALL_TRANSITIONS: Exclude<TransitionType, 'random'>[] = [
  'crossfade',
  'ken-burns',
  'slide-left',
  'scale-up',
];

export function getRandomTransition(): Exclude<TransitionType, 'random'> {
  const index = Math.floor(Math.random() * ALL_TRANSITIONS.length);
  return ALL_TRANSITIONS[index];
}

export function getTransitionClasses(transition: TransitionType, activeRandomEffect?: Exclude<TransitionType, 'random'>): string {
  const effect = transition === 'random' ? (activeRandomEffect || 'ken-burns') : transition;

  switch (effect) {
    case 'ken-burns':
      return 'animate-ken-burns transition-all duration-1000 ease-out';
    case 'slide-left':
      return 'animate-slide-left transition-all duration-700 ease-out';
    case 'scale-up':
      return 'animate-scale-up transition-all duration-700 ease-out';
    case 'crossfade':
    default:
      return 'animate-fade-in transition-opacity duration-1000 ease-in-out';
  }
}
