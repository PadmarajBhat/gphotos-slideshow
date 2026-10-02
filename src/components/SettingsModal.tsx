import React, { useState } from 'react';
import { SlideshowConfig, TransitionType } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { X, Clock, Shuffle, Thermometer, Sliders, KeyRound, Eye } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  config: SlideshowConfig;
  onSaveConfig: (updated: SlideshowConfig) => void;
}

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
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
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
        </div>

        {/* 5. Where Google credentials now live */}
        <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 leading-relaxed">
          <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>
            Google sign-in is handled by the LuminaFrame helper on this machine, not by this
            page — a browser is not allowed to hold the credentials the Photos Ambient API
            requires. Use <strong className="text-slate-300">Use My Photos</strong> to pair or
            unpair this frame.
          </span>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
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
