import { useState, useEffect } from 'react';
import { ClockState } from '../types';
import { getFormattedClock } from '../utils/dateUtils';

export function useClock(format12h = true): ClockState {
  const [clock, setClock] = useState<ClockState>(() => getFormattedClock(format12h));

  useEffect(() => {
    // Initial sync
    setClock(getFormattedClock(format12h));

    const timer = setInterval(() => {
      setClock(getFormattedClock(format12h));
    }, 1000);

    return () => clearInterval(timer);
  }, [format12h]);

  return clock;
}
