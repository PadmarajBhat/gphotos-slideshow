import React from 'react';
import { MediaItem } from '../types';
import { getBackdropUrl } from '../utils/mediaUrls';

interface BlurredBackdropProps {
  item: MediaItem;
}

export const BlurredBackdrop: React.FC<BlurredBackdropProps> = ({ item }) => {
  // A tiny variant of the same photo: it is blurred past recognition anyway,
  // and decoding the 2560px original twice per slide is what makes TV
  // browsers and Raspberry Pi stutter. Videos have no still to sample.
  const backdropSource = getBackdropUrl(item);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 bg-slate-950"
    >
      {backdropSource && (
        <img
          src={backdropSource}
          alt=""
          className="w-full h-full object-cover filter blur-3xl brightness-50 contrast-125 scale-110 transform-gpu transition-all duration-1000 ease-in-out opacity-80"
          loading="eager"
        />
      )}

      {/* Subtle vignette gradient overlay to enhance center photo focus and text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/60" />
      <div className="absolute inset-0 bg-vignette" />
    </div>
  );
};
