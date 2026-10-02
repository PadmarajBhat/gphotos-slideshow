# Architecture Specification: Ambient Google Photos TV Slideshow (LuminaFrame)

## 1. Stack Baselines & Architecture Overview
- **Framework**: React 19 + TypeScript (strict mode) + Vite.
- **Styling**: Tailwind CSS with custom keyframes for transitions and 10ft TV UI scaling.
- **Icons**: Lucide React.
- **Data Fetching & State**:
  - TanStack Query (React Query) for API interactions (Google Photos albums, album media, Open-Meteo weather).
  - React local state for active slide index, playback status, transition style and config.
- **Client-Only Architecture**:
  - The application is a 100% static client-side web application with no backend of its own.
  - Google OAuth runs in the browser via Google Identity Services (`google.accounts.oauth2.initTokenClient`).
  - Google API queries are dispatched directly from the browser with the user's ephemeral bearer token.
  - Tokens and photo URLs are kept in memory only.
  - **Persisted state is limited to two `localStorage` keys**: `luminaframe_config` (slideshow preferences) and `luminaframe_client_id` (OAuth Client ID). Neither contains media or credentials.
  - **Third-party services** are enumerated in the README "Privacy: what leaves your device" table, which is the authoritative list.

## 2. Component Boundaries & Directory Structure
Adhering to the rule of keeping source files under 250 lines:
```
src/
├── api/
│   ├── googlePhotos.ts      # Google Photos API client, paginated (albums, media items)
│   ├── sharedAlbum.ts       # Shared-link album parser with host and payload validation
│   ├── weather.ts           # Open-Meteo weather client & condition code mappers
│   ├── reverseGeocode.ts    # Throttled reverse geocoding for photo coordinates
│   └── demoData.ts          # Curated demo albums for instant out-of-the-box testing
├── components/
│   ├── AmbientClock.tsx     # Top-Left: Digital clock, date, region timezone
│   ├── BlurredBackdrop.tsx  # Downscaled blurred backdrop for non-fitting aspect ratios
│   ├── MediaDetails.tsx     # Bottom-Left: Location, capture date/time, camera info
│   ├── WeatherWidget.tsx    # Bottom-Right: Current weather, temperature, condition
│   ├── SlideshowControls.tsx# Ambient on-screen TV controls
│   ├── SlideshowView.tsx    # Main slideshow viewport & transition orchestrator
│   ├── AlbumCard.tsx        # TV-friendly album selection card with focus states
│   ├── AlbumGrid.tsx        # Album grid with explicit D-pad spatial navigation
│   ├── SettingsModal.tsx    # Preferences; mounted only while open
│   ├── GoogleAuthModal.tsx  # Connect flow: shared album link, or OAuth sign-in
│   ├── GoogleAuthInfo.tsx   # Explains the OAuth model inside Settings
│   └── Header.tsx           # Top navigation bar with account/demo status
├── hooks/
│   ├── useGoogleAuth.ts     # GIS OAuth 2.0, token expiry tracking, silent renewal
│   ├── useWeather.ts        # TanStack query hook for local weather
│   ├── useClock.ts          # Localized time & date hook updating every second
│   ├── useSlideshow.ts      # Playback timer, transitions, video & media-error handling
│   ├── useTvRemote.ts       # TV remote key bindings (D-pad, Enter, Back, Space)
│   └── useFocusTrap.ts      # Dialog focus containment, restore, Escape/Back to close
├── types/
│   └── index.ts             # TypeScript definitions for Album, MediaItem, Weather, Config
├── utils/
│   ├── transitions.ts       # Transition animation class definitions
│   ├── mediaUrls.ts         # Media type detection, backdrop downscaling, preloading
│   ├── storage.ts           # Preference persistence with per-field sanitisation
│   └── dateUtils.ts         # Internationalization date & time formatters
├── App.tsx                  # Top-level view router & state
├── vite-env.d.ts            # Vite client types, incl. typed import.meta.env
└── main.tsx                 # Application entry point
```

## 3. Slideshow Mechanics & Video Handling
- **Aspect Ratio & Blurred Backdrop**:
  - Outer container fills 100vw x 100vh.
  - Background: a **downscaled** copy of the photo (`=w480-h270`, or `w=480` for query-sized URLs) scaled to cover with `blur-3xl brightness-50` and `scale-110`. Decoding the full-resolution original twice per slide is the main cause of stutter on TV-class GPUs.
  - Videos render no backdrop image; the vignette over a dark base is used instead.
  - Foreground: media centred with `max-w-full max-h-full object-contain drop-shadow-2xl`.
- **Transitions**:
  - Supported: `crossfade`, `ken-burns`, `slide-left`, `scale-up`, plus `random`.
  - `ken-burns` is defined once, in `index.css` as `kenburns-motion`.
- **Video Playback Handling**:
  - Videos are detected via `videoUrl`, `mimeType` or `mediaMetadata.video` (`utils/mediaUrls.isVideoItem`).
  - `<video>` is `autoPlay muted playsInline`. **Muted is mandatory**: slides advance on a timer, not a user gesture, so unmuted autoplay is refused by browser policy.
  - The photo timer is suspended; advance normally happens on `onEnded`.
  - **Failure handling is required**, because a video that never ends would otherwise freeze the frame permanently:
    - `onError` / `onStalled` advance immediately.
    - A 15s start watchdog advances if `playing` never fires.
    - A 10-minute ceiling in `useSlideshow` advances regardless.
    - A rejected `play()` promise advances.
- **Pause semantics**: pausing stops both the slide timer and the `<video>` element.
- **Image failures**: `onError` on the photo element advances, so an expired Google URL cannot strand the slideshow.

## 4. Long-Running Operation
An ambient frame is expected to run for days, which outlives several Google expiry windows:
- **Access tokens** (~1 hour): `useGoogleAuth` reads `expires_in` and silently re-requests with `prompt: ''` five minutes before expiry.
- **Media `baseUrl` values** (~60 minutes): the album media query re-fetches every 45 minutes for Google-backed albums. Demo and shared albums are exempt.
- A failed refresh of an already-playing album is ignored rather than ejecting the viewer.

## 5. Performance & Memory Budgets
- Frame rate target: 60 FPS on 1080p and 4K displays using GPU-accelerated CSS transforms.
- Network efficiency: the next photo is preloaded as soon as the current slide begins.
- Memory: backdrops are downscaled; no media is cached to disk, and there is no service worker.
- Bundle budget: under 150 kB gzipped for JS (currently ~102 kB).

## 6. Security Boundaries
- The dev-server shared-album proxy accepts **only** HTTPS URLs on an allowlist of Google Photos hosts, follows redirects manually and re-validates every hop, and caps the response size. The dev server binds to all interfaces so a TV can reach it, which makes this allowlist load-bearing.
- `sharedAlbum.ts` validates the target host client-side before any request, and validates that the returned body is actually a Google Photos page — a static host answers unknown paths with the SPA shell and HTTP 200.

## 7. Google Photos Access (revised 2026-09-28)

### Why the original design had to change
Google removed the `photoslibrary.readonly` scope on **31 March 2025**. Calls using it return `403 PERMISSION_DENIED`, and third-party apps may now only reach media their own app created. The `src/api/googlePhotos.ts` Library API client and the `useGoogleAuth` GIS hook were therefore **deleted**, not repaired: they could only ever fail.

### Replacement: Google Photos Ambient API
`https://photosambient.googleapis.com/v1` — built by Google for shared ambient displays such as TVs and photo frames.

- Scope: `profile https://www.googleapis.com/auth/photosambient.mediaitems`
- OAuth client type: **TVs and Limited Input devices** (device-code flow, **requires a client secret**)
- `mediaItems.list` is paginated (`pageSize` max 100) and returns photos, videos and motion photos
- `baseUrl` is valid for 60 minutes
- **Quota: 240 requests per device per day**

### Consequence: a local helper process
A browser cannot hold a client secret, so the app is no longer purely client-side for this route. `server/` contains a dependency-free Node helper:

```
server/
├── index.mjs        # HTTP routing, static serving of dist/, /api/ambient/*
├── state.mjs        # Pairing, device lifecycle, media refresh loop
├── googleAuth.mjs   # Device-code flow, token refresh, revocation
├── ambient.mjs      # Ambient API client and AmbientMediaItem mapping
├── store.mjs        # Refresh token + device id persistence (0600)
└── env.mjs          # .env loading and configuration
```

The browser calls only `/api/ambient/{status,connect,disconnect,media}`. Vite proxies these to port 4000 in development; in production `npm start` serves both the built app and the API from one process.

**Media still streams directly from Google to the browser.** The helper handles credentials and metadata only; photo bytes never pass through it.

### Refresh cadence versus quota
`baseUrl` expires at 60 minutes, but only 240 requests/device/day are allowed. A 600-item library costs 6 paged requests per full refresh, so the helper refreshes every **50 minutes**: about 173 requests/day, inside both limits. `ambientMapping.test.ts` asserts this arithmetic so a future change to either constant fails the build.

### Three media sources, deliberately unequal
| Source | Setup | Completeness | Videos | Static hosting |
|---|---|---|---|---|
| Ambient API | Pair from phone | Complete | Play | Needs the helper |
| Shared album link | None | Initial batch only | Thumbnails | Yes |
| Demo | None | Fixed | Play | Yes |

The shared-album limitation is inherent: Google embeds only an initial batch of photos in the album page and lazy-loads the rest through an undocumented internal RPC. It is retained as the zero-setup path, with its limits stated in the UI.
