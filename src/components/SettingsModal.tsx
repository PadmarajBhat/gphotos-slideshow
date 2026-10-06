import React, { useState } from 'react';
import { MediaFilter, PlayOrder, SlideshowConfig, TransitionType } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { X, Clock, Shuffle, Thermometer, Sliders, Eye, Link2, Unplug, History, Film, ListOrdered } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  config: SlideshowConfig;
  onSaveConfig: (updated: SlideshowConfig) => void;
  onOpenSharedLink?: () => void;
  googleConnected?: boolean;
  onDisconnectGoogle?: () => void;
  hasRecent?: boolean;
  onClearRecent?: () => void;
}

const MEDIA_FILTERS: { id: MediaFilter; label: string }[] = [
  { id: 'all', label: 'Photos & videos' },
  { id: 'photos', label: 'Photos only' },
  { id: 'videos', label: 'Videos only' },
];

const PLAY_ORDERS: { id: PlayOrder; label: string }[] = [
  { id: 'album', label: 'Album order' },
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'shuffle', label: 'Shuffle' },
];

const HUD_TOGGLES: { key: keyof SlideshowConfig; label: string }[] = [
  { key: 'showClock', label: 'Clock' },
  { key: 'showDetails', label: 'Photo info' },
  { key: 'showWeather', label: 'Weather' },
];

/**
 * Rendered only while open (see App). Local edit state is therefore created
 * fresh on every open, which is what makes Cancel actually discard changes.
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  config,
  onSaveConfig,
  onOpenSharedLink,
  googleConnected = false,
  onDisconnectGoogle,
  hasRecent = false,
  onClearRecent,
}) => {
  const [localConfig, setLocalConfig] = useState<SlideshowConfig>(config);
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose);

  const handleSave = () => {
    onSaveConfig(localConfig);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
    >
      <div
        ref={dialogRef}
        // Header and Save stay put while the options scroll between them, so
        // Save is always on screen. On a TV the options use two columns,
        // which fits them without scrolling at all.
        className="w-full max-w-xl tv:max-w-4xl max-h-full flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="shrink-0 flex items-center justify-between border-b border-slate-800 px-6 pt-5 pb-3">
          <div className="flex items-center gap-2 text-white">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h2 id="settings-title" className="text-xl font-bold">Slideshow Settings</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 tv-focus-target"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-5 tv:grid tv:grid-cols-2 tv:gap-x-8 tv:gap-y-4 tv:content-start">
        {/* 1. Slide Duration */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Slide Duration (Seconds per photo)</span>
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[5, 10, 15, 30, 60].map((sec) => (
              <button
                key={sec}
                type="button"
                aria-pressed={localConfig.durationSeconds === sec}
                onClick={() => setLocalConfig((p) => ({ ...p, durationSeconds: sec }))}
                className={`py-1.5 text-xs font-bold rounded-xl border transition tv-focus-target ${
                  localConfig.durationSeconds === sec
                    ? 'bg-amber-400 text-slate-950 border-amber-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* 2. Transition Effect */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Shuffle className="w-3.5 h-3.5 text-amber-400" />
            <span>Transition Effect</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'random', label: 'Random (Dynamic)' },
              { id: 'ken-burns', label: 'Ken Burns' },
              { id: 'crossfade', label: 'Crossfade' },
              { id: 'slide-left', label: 'Cinematic Push' },
              { id: 'scale-up', label: 'Soft Scale' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={localConfig.transitionEffect === t.id}
                onClick={() => setLocalConfig((p) => ({ ...p, transitionEffect: t.id as TransitionType }))}
                className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition text-center tv-focus-target ${
                  localConfig.transitionEffect === t.id
                    ? 'bg-amber-400 text-slate-950 border-amber-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* What to play */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Film className="w-3.5 h-3.5 text-amber-400" />
            <span>Play</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MEDIA_FILTERS.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={localConfig.mediaFilter === m.id}
                onClick={() => setLocalConfig((p) => ({ ...p, mediaFilter: m.id }))}
                className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition text-center tv-focus-target ${
                  localConfig.mediaFilter === m.id
                    ? 'bg-amber-400 text-slate-950 border-amber-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Order */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
            <span>Order</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PLAY_ORDERS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={localConfig.playOrder === o.id}
                onClick={() => setLocalConfig((p) => ({ ...p, playOrder: o.id }))}
                className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition text-center tv-focus-target ${
                  localConfig.playOrder === o.id
                    ? 'bg-amber-400 text-slate-950 border-amber-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">Each album carries on from where it was, even after the TV is switched off.</p>
        </div>

        {/* 3. Units & Formats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-400" />
              <span>Weather</span>
            </label>
            <div className="flex gap-2">
              {(['celsius', 'fahrenheit'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  aria-pressed={localConfig.tempUnit === u}
                  onClick={() => setLocalConfig((p) => ({ ...p, tempUnit: u }))}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg border transition tv-focus-target ${
                    localConfig.tempUnit === u ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {u === 'celsius' ? '°C' : '°F'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Clock</span>
            </label>
            <div className="flex gap-2">
              {(['12h', '24h'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  aria-pressed={localConfig.clockFormat === fmt}
                  onClick={() => setLocalConfig((p) => ({ ...p, clockFormat: fmt }))}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg border transition tv-focus-target ${
                    localConfig.clockFormat === fmt ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. On-screen overlays */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Show On Screen</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {HUD_TOGGLES.map(({ key, label }) => {
              const enabled = Boolean(localConfig[key]);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={enabled}
                  onClick={() => setLocalConfig((p) => ({ ...p, [key]: !p[key] }))}
                  className={`py-1.5 px-2 text-xs font-semibold rounded-xl border transition tv-focus-target ${
                    enabled
                      ? 'bg-amber-400 text-slate-950 border-amber-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-pressed={localConfig.fadeOverlays}
            onClick={() => setLocalConfig((p) => ({ ...p, fadeOverlays: !p.fadeOverlays }))}
            className={`mt-1 py-1.5 px-2 text-xs font-semibold rounded-xl border transition tv-focus-target ${
              localConfig.fadeOverlays
                ? 'bg-amber-400 text-slate-950 border-amber-400'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            Fade them in and out now and then
          </button>
        </div>

        {/* 5. Sources and history - the controls the simplified home screen hides */}
        <div className="flex flex-col gap-2">
          {onOpenSharedLink && (
            <button
              type="button"
              onClick={onOpenSharedLink}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold tv-focus-target"
            >
              <Link2 className="w-4 h-4 text-amber-400" />
              Play a shared album link
            </button>
          )}
          {googleConnected && onDisconnectGoogle && (
            <button
              type="button"
              onClick={onDisconnectGoogle}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold hover:text-red-300 tv-focus-target"
            >
              <Unplug className="w-4 h-4 text-amber-400" />
              Disconnect Google Photos
            </button>
          )}
          {hasRecent && onClearRecent && (
            <button
              type="button"
              onClick={onClearRecent}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold tv-focus-target"
            >
              <History className="w-4 h-4 text-amber-400" />
              Clear recently played
            </button>
          )}
        </div>

        </div>

        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white tv-focus-target rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs shadow-lg tv-focus-target"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
