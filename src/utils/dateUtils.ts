import { ClockState } from '../types';

export function getFormattedClock(format12h = true): ClockState {
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Extract region / city from timezone (e.g., Asia/Kolkata -> Kolkata, India)
  const tzParts = timeZone.split('/');
  const cityRegion = tzParts.length > 1 ? tzParts[tzParts.length - 1].replace(/_/g, ' ') : timeZone;

  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const secondsString = now.getSeconds().toString().padStart(2, '0');

  let timeString = '';
  let periodString: string | undefined = undefined;

  if (format12h) {
    const displayHours = hours % 12 || 12;
    timeString = `${displayHours}:${minutes}`;
    periodString = hours >= 12 ? 'PM' : 'AM';
  } else {
    timeString = `${hours.toString().padStart(2, '0')}:${minutes}`;
  }

  const dayName = now.toLocaleDateString(undefined, { weekday: 'long' });
  const dateString = now.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    timeString,
    secondsString,
    periodString,
    dateString,
    dayName,
    timeZone,
    cityRegion,
  };
}

export function formatMediaCaptureTime(creationTime?: string): string {
  if (!creationTime) return '';
  const date = new Date(creationTime);
  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
