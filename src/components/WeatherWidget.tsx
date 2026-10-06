import React from 'react';
import { useWeather } from '../hooks/useWeather';
import {
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  CloudLightning,
  CloudFog,
  Droplets,
  CloudSun,
  Moon,
} from 'lucide-react';

interface WeatherWidgetProps {
  tempUnit?: 'celsius' | 'fahrenheit';
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ tempUnit = 'celsius' }) => {
  const { data: weather, isPending, isError, formatTemp } = useWeather(tempUnit);

  const renderWeatherIcon = () => {
    if (!weather) return <Sun className="w-8 h-8 text-amber-300 animate-pulse" />;
    switch (weather.icon) {
      case 'cloud':
        return <Cloud className="w-9 h-9 text-slate-300" />;
      case 'rain':
        return <CloudRain className="w-9 h-9 text-blue-400" />;
      case 'snow':
        return <Snowflake className="w-9 h-9 text-sky-200" />;
      case 'thunder':
        return <CloudLightning className="w-9 h-9 text-amber-400" />;
      case 'moon':
        return <Moon className="w-9 h-9 text-slate-200" />;
      case 'fog':
        return <CloudFog className="w-9 h-9 text-slate-400" />;
      case 'sun':
      default:
        return <Sun className="w-9 h-9 text-amber-300" />;
    }
  };

  // isPending rather than isLoading: while coordinates are still being
  // detected the weather query is disabled, and a disabled query reports
  // isLoading === false, which showed "unavailable" during normal startup.
  if (isPending && !isError) {
    return (
      <div className="ambient-glass rounded-2xl px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-3 text-slate-300 shadow-2xl">
        <CloudSun className="w-7 h-7 text-amber-300 animate-pulse" />
        <span className="text-sm font-medium">Checking local weather...</span>
      </div>
    );
  }

  if (isError || !weather) {
    return (
      <div className="ambient-glass rounded-2xl px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-2 text-slate-400 shadow-2xl text-xs">
        <span>Weather temporarily unavailable</span>
      </div>
    );
  }

  return (
    <div
      aria-label="Local Weather Details"
      className="ambient-glass rounded-2xl px-4 py-3 sm:p-5 select-none pointer-events-none transition-all duration-300 shadow-2xl flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="shrink-0">{renderWeatherIcon()}</div>
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight drop-shadow">
              {formatTemp(weather.temperature)}
            </span>
          </div>
          <span className="text-xs sm:text-sm lg:text-base font-semibold text-amber-300 drop-shadow">
            {weather.conditionText}
          </span>
        </div>
      </div>

      {/* Precipitation / Rain indicators & humidity. Left out on phones, where
          the card shares the bottom corner with the image details. */}
      <div className="hidden sm:flex items-center gap-3 mt-1 text-xs lg:text-sm text-slate-300 font-medium">
        <div className="flex items-center gap-1">
          <Droplets className="w-3.5 h-3.5 text-blue-300 shrink-0" />
          <span>{weather.precipitation > 0 ? `${weather.precipitation} mm rain` : 'No rain forecast'}</span>
        </div>
        <span className="text-slate-400">•</span>
        <span>{weather.humidity}% humidity</span>
      </div>

      {/* City or Region tag */}
      {weather.city && (
        <div className="hidden sm:block text-xs text-slate-400 truncate max-w-[200px]">
          {weather.city}
          {weather.region ? `, ${weather.region}` : ''}
        </div>
      )}
    </div>
  );
};
