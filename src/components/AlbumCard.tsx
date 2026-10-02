import React from 'react';
import { Album } from '../types';
import { Images, Play, Sparkles } from 'lucide-react';

interface AlbumCardProps {
  album: Album;
  onSelect: (album: Album) => void;
  index: number;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onSelect, index }) => {
  return (
    <button
      onClick={() => onSelect(album)}
      tabIndex={0}
      data-album-card
      data-index={index}
      className="group relative flex flex-col text-left rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-amber-400 focus:border-amber-400 outline-none transition-all duration-300 shadow-lg tv-focus-target hover:scale-[1.02] cursor-pointer"
      aria-label={`Open album ${album.title} with ${album.mediaItemsCount} items`}
    >
      {/* Cover Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-800">
        {album.coverPhotoBaseUrl ? (
          <img
            src={album.coverPhotoBaseUrl}
            alt={album.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
            <Images className="w-12 h-12" />
          </div>
        )}

        {/* Demo badge if applicable */}
        {album.isDemo && (
          <div className="absolute top-3 left-3 bg-amber-500/90 text-slate-950 font-bold text-xs uppercase px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Curated Demo</span>
          </div>
        )}

        {/* Hover/Focus Play Icon Overlay */}
        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 group-focus:scale-100 transition-transform">
            <Play className="w-7 h-7 fill-current ml-1" />
          </div>
        </div>
      </div>

      {/* Album Title & Metadata */}
      <div className="p-4 flex flex-col gap-1">
        <h3 className="font-bold text-lg text-white group-hover:text-amber-300 transition-colors line-clamp-1">
          {album.title}
        </h3>
        <p className="text-sm text-slate-400 flex items-center gap-1.5">
          <Images className="w-3.5 h-3.5" />
          <span>{album.mediaItemsCount} photos & videos</span>
        </p>
      </div>
    </button>
  );
};
