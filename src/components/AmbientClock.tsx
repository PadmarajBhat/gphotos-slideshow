import React from 'react';
import { useClock } from '../hooks/useClock';
import { Globe } from 'lucide-react';

interface AmbientClockProps {
  format12h?: boolean;
}

export const AmbientClock: React.FC<AmbientClockProps> = ({ format12h = true }) => {
  const clock = useClock(format12h);

  return (
    <div
      aria-label="Current Date and Time"
      className="ambient-glass rounded-2xl px-4 py-3 sm:px-6 sm:py-4 flex flex-col gap-1 select-none pointer-events-none transition-all duration-300 shadow-2xl"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white drop-shadow-md">
          {clock.timeString}
        </span>
        {clock.periodString && (
          <span className="text-lg sm:text-xl lg:text-2xl font-bold text-amber-300 drop-shadow">
            {clock.periodString}
          </span>
        )}
        <span className="text-sm lg:text-base font-mono text-slate-300 opacity-80">
          :{clock.secondsString}
        </span>
      </div>

      <div className="flex items-center gap-2 text-slate-200 text-sm lg:text-base font-medium">
        <span>{clock.dayName}</span>
        <span className="text-slate-400">•</span>
        <span>{clock.dateString}</span>
      </div>

      <div className="flex items-center gap-1.5 mt-0.5 text-xs lg:text-sm text-slate-300 font-normal">
        <Globe className="w-3.5 h-3.5 text-amber-300 shrink-0" />
        <span className="truncate max-w-[200px]" title={clock.timeZone}>
          {clock.cityRegion} ({clock.timeZone})
        </span>
      </div>
    </div>
  );
};
