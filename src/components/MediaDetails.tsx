import React, { useState, useEffect } from 'react';
import { MediaItem } from '../types';
import { MapPin, Calendar, Camera, Info } from 'lucide-react';
import { formatMediaCaptureTime } from '../utils/dateUtils';
import { reverseGeocodeCoordinates } from '../api/reverseGeocode';

interface MediaDetailsProps {
  item: MediaItem;
}

export const MediaDetails: React.FC<MediaDetailsProps> = ({ item }) => {
  const [resolvedLocation, setResolvedLocation] = useState<string | null>(
    item.location?.placeName || null
  );

  useEffect(() => {
    let isCancelled = false;
    const location = item.location;

    // If explicit placeName is already set, use it
    if (location?.placeName) {
      setResolvedLocation(location.placeName);
      return;
    }

    // Clear the previous slide's place name so it never sits over a new photo
    // while this lookup is in flight.
    setResolvedLocation(null);

    // Compare against null explicitly: latitude 0 is a valid coordinate.
    if (location?.latitude != null && location?.longitude != null) {
      reverseGeocodeCoordinates(location.latitude, location.longitude)
        .then((loc) => {
          if (!isCancelled && loc.placeName) {
            setResolvedLocation(loc.placeName);
          }
        })
        .catch(() => {});
    }

    return () => {
      isCancelled = true;
    };
  }, [item.id, item.location]);

  const captureTime = formatMediaCaptureTime(item.mediaMetadata?.creationTime);
  const photoMeta = item.mediaMetadata?.photo;
  const cameraName = [photoMeta?.cameraMake, photoMeta?.cameraModel].filter(Boolean).join(' ');
  const cameraDetails = [
    cameraName,
    photoMeta?.focalLength ? `${photoMeta.focalLength}mm` : null,
    photoMeta?.apertureFNumber ? `ƒ/${photoMeta.apertureFNumber}` : null,
    photoMeta?.exposureTime || null,
    photoMeta?.isoEquivalent ? `ISO ${photoMeta.isoEquivalent}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const titleOrDesc = item.description || item.filename;

  return (
    <div
      aria-label="Image Details"
      className="ambient-glass rounded-2xl p-5 max-w-lg select-none pointer-events-none transition-all duration-300 shadow-2xl flex flex-col gap-2"
    >
      {/* Location */}
      {resolvedLocation ? (
        <div className="flex items-center gap-2 text-amber-300 font-semibold text-lg lg:text-xl drop-shadow">
          <MapPin className="w-5 h-5 shrink-0" />
          <span className="truncate">{resolvedLocation}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-slate-300 font-semibold text-base lg:text-lg">
          <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
          <span>Location not recorded</span>
        </div>
      )}

      {/* Capture Date & Time */}
      {captureTime && (
        <div className="flex items-center gap-2 text-slate-200 text-sm lg:text-base font-medium">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <span>{captureTime}</span>
        </div>
      )}

      {/* Description or title */}
      {titleOrDesc && (
        <div className="flex items-start gap-2 text-slate-100 text-sm lg:text-base font-normal line-clamp-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
          <p className="leading-snug">{titleOrDesc}</p>
        </div>
      )}

      {/* Camera gear info badge */}
      {cameraDetails && (
        <div className="flex items-center gap-2 mt-1 text-xs lg:text-sm text-slate-300 opacity-80 font-mono">
          <Camera className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{cameraDetails}</span>
        </div>
      )}
    </div>
  );
};
