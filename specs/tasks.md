# Tasks Breakdown: Ambient Google Photos TV Slideshow (LuminaFrame)

## Phase 1 — Initial build

- [x] **Task 1: Project Scaffolding & Setup**
  - Scaffold React 19 + TypeScript + Vite; install Tailwind, TanStack Query, lucide-react, Vitest, Testing Library
  - Configure Tailwind tokens and custom animation utilities

- [x] **Task 2: Types & API Layer Definition**
  - Define `Album`, `MediaItem`, `WeatherData`, `SlideshowConfig`
  - Implement `googlePhotos.ts`, `weather.ts`, `reverseGeocode.ts`, `demoData.ts`

- [x] **Task 3: Core Hooks & Services**
  - `useGoogleAuth.ts`, `useClock.ts`, `useWeather.ts`, `useSlideshow.ts`, `useTvRemote.ts`

- [x] **Task 4: Ambient HUD Components**
  - `AmbientClock.tsx`, `MediaDetails.tsx`, `WeatherWidget.tsx`, `BlurredBackdrop.tsx`, `SlideshowControls.tsx`

- [x] **Task 5: Slideshow View & Transition Engine**
  - `SlideshowView.tsx` integrating video handling, HUD overlays and transitions

- [x] **Task 6: Album Selection & Settings View**
  - `AlbumCard.tsx`, `AlbumGrid.tsx`, `SettingsModal.tsx`, `Header.tsx`

- [x] **Task 7: Automated Tests**
  - Vitest coverage for slideshow timing, weather parsing and HUD rendering

- [x] **Task 8: Documentation**
  - `README.md` with TV setup and OAuth instructions

## Phase 2 — Requirements compliance pass

A review against [`requirement.md`](../requirement.md) found the build broken, sign-in non-functional, and the TV and elderly-user requirements unmet. Phase 2 addressed every finding.

- [x] **Task 9: Restore the build**
  - Add `src/vite-env.d.ts` so `import.meta.env` type-checks (`npm run build` previously failed)
  - Add ESLint 9 flat config, `npm run lint` and `npm run verify`
  - Add GitHub Actions CI running lint, tests and build on Node 20 and 22

- [x] **Task 10: Make authentication honest and workable** *(REQ-G1, REQ-U2)*
  - Remove the fabricated default Client ID; restore an actionable missing-ID message
  - Support a build-time `VITE_GOOGLE_CLIENT_ID`
  - Wire up `GoogleAuthModal` so the zero-setup shared-album route is the default path
  - Map `invalid_client`, `access_denied` and popup failures to specific guidance

- [x] **Task 11: TV remote operability** *(REQ-U1)*
  - Implement explicit D-pad spatial navigation in `AlbumGrid`
  - Add `useFocusTrap` for both dialogs: focus entry, Tab containment, restore, Escape/Back to close
  - Stop the grid stealing focus from an open dialog

- [x] **Task 12: Unattended operation** *(REQ-U3, REQ-U4)*
  - Persist preferences to `localStorage` with per-field sanitisation
  - Silently renew the access token before expiry
  - Refresh Google media URLs every 45 minutes
  - Stop the control bar reappearing on every slide change

- [x] **Task 13: Playback robustness** *(REQ-S3, REQ-S6)*
  - Muted autoplay; `onError`, `onStalled`, a 15s start watchdog and a 10-minute ceiling
  - Route pause/resume to the `<video>` element, not just the timer
  - Advance past images that fail to load
  - Track real fullscreen state via `fullscreenchange`

- [x] **Task 14: Correctness and performance** *(REQ-G2, REQ-S5, REQ-H3)*
  - Paginate albums and media items
  - Downscale the blurred backdrop; skip it for videos
  - Preload the next photo
  - Use `isPending` for the weather loading state
  - Fix the falsy-zero latitude bug and stale location text in `MediaDetails`
  - Throttle Nominatim to its 1 req/s policy and bound the cache

- [x] **Task 15: Security and trust** *(REQ-T3, REQ-T5)*
  - Restrict the dev proxy to an HTTPS Google-host allowlist with per-hop redirect validation and a size cap
  - Validate shared-album URLs client-side and verify the response is a real album page
  - Document every third-party destination in the README privacy table

- [x] **Task 16: Test and tooling debt** *(REQ-Q2, REQ-Q3)*
  - 20 tests across 5 files grew to 105 across 14
  - Replace the no-op `spec_drift_check.py` with one that actually fails on drift
  - Remove dead CSS classes, the duplicate Ken Burns keyframes and the unrelated colour palette

## Open items

- [ ] **Confirm Google Photos API availability** *(REQ-G5)* — verify whether `photoslibrary.readonly` still grants third-party library access, or whether the Picker API is now required. This decides how much future investment Option B deserves.
- [ ] **On-device verification** — run the build on a Sony Bravia W95C and confirm D-pad key codes, focus rings and video codec support. jsdom cannot stand in for this.
- [ ] **Internationalization** *(REQ-I1)* — UI strings are English-only.
