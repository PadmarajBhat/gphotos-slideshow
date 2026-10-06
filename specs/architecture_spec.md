# Architecture Specification: Ambient Google Photos TV Slideshow (GPicShow)

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
  - **Persisted state is limited to two `localStorage` keys**: `gpicshow_config` (slideshow preferences) and `gpicshow_client_id` (OAuth Client ID). Neither contains media or credentials.
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
    - `onError` advances immediately.
    - `stalled` is **not** a failure (revised 2026-10-06). Google's video server ignores byte-range requests, so a TV streams each clip from the start and the browser reports `stalled` within about 3s while a large file downloads; skipping on it threw away nearly every video on home Wi-Fi.
    - **Sources** (`videoSources`): Google's streaming renditions `=m37` (1080p), `=m22` (720p), `=m18` (360p) from googlevideo.com, then the original `=dv`. The original is often labelled H.264 level 3.0 whatever its resolution (a 1080×1920 clip measured so); phones play it, but a Bravia's decoder showed a blank screen, and then the next video too. The renditions are correctly labelled (1080p at level 4.0) and support byte ranges. A missing rendition (small clips lack 1080p) errors at once. An error or a 20s no-start moves to the next source; only the last source failing skips the video.
    - **Decoder release**: on leaving a video the element is paused, its `src` removed and `load()` called, because TV browsers keep a decoder until garbage collection and have few.
    - **Sound**: no `muted`/`autoPlay` attributes; the view sets `muted` from the `videoSound` setting and calls `play()`. A `NotAllowedError` (no user activation yet, e.g. after a reload) retries muted, shows "Press any button or tap for sound", and the next keydown or pointerdown unmutes inside that gesture and is swallowed (except exit keys) so OK doesn't also pause.
    - A 30s start watchdog on the last source advances if `playing` never fires.
    - A 30s no-progress watchdog advances a clip that started but stopped moving (no `timeupdate`).
    - A 10-minute ceiling in `useSlideshow` advances regardless.
    - A rejected `play()` promise advances.
- **Pause semantics**: pausing stops both the slide timer and the `<video>` element.
- **Image failures**: `onError` on the photo element advances, so an expired Google URL cannot strand the slideshow.
- **Failure back-off** (`useSlideshow`): the first three consecutive failures skip at once. After that every failure is assumed systemic (offline, or Google answering `429` to the network) and the next try waits 5s, 10s, 20s… capped at 60s, with an on-screen notice. Any successful `load` / `playing` resets it. Each item counts once however many error events it fires. Without this, a throttled network made the frame request hundreds of full-size images in seconds, deepening the throttle.
- **Screen wake lock** (`useWakeLock`): held while the slideshow is mounted and re-acquired on `visibilitychange`, because browsers drop it whenever the tab is hidden. Unsupported or refused is silently ignored.
- **Responsive HUD**: details and weather share one bottom flex row (`sm` and up) so they cannot overlap; the details card shrinks first. Below 640px the row becomes a column with the weather, compacted to temperature and condition, above the details. The control bar tightens below 640px and hides the fullscreen button where `requestFullscreen` is missing.

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

### Three media sources, deliberately unequal (superseded by section 9: shared albums now load completely, with videos)
| Source | Setup | Completeness | Videos | Static hosting |
|---|---|---|---|---|
| Ambient API | Pair from phone | Complete | Play | Needs the helper |
| Shared album link | None | Initial batch only | Thumbnails | Yes |
| Demo | None | Fixed | Play | Yes |

The shared-album limitation is inherent: Google embeds only an initial batch of photos in the album page and lazy-loads the rest through an undocumented internal RPC. It is retained as the zero-setup path, with its limits stated in the UI.

## 8. Deployment Topology (2026-10-04, superseded by section 9)

Two deployment targets, deliberately unequal:

- **GitHub Pages** (`.github/workflows/deploy-pages.yml`): static build with `VITE_STATIC_HOSTING=true`. Demo and shared-album sources only. The app skips `/api/ambient` entirely in this mode and explains that the full library needs the home version. Base path comes from the repository name.
- **Home device** (`npm start`): the helper serves the built app and `/api/ambient/*` from one process on port 4000, reachable on the LAN.

**The helper must never be exposed publicly.** It has no authentication and is single-tenant by design: one frame, one Google account, one refresh token. A public instance would serve the owner's photos to anyone with the URL. Remote access, if wanted, must go through an authenticating layer (e.g. Tailscale), never an open port.

Mobile install is via `public/manifest.webmanifest` (`display: fullscreen`). All manifest paths are relative so it resolves under both `/` and `/<repo>/`.

## 9. Shared Albums Through a Hosted Helper (2026-10-05)

The Ambient API turned out to be partner-only (`403` until accepted), so it is now behind `VITE_AMBIENT_API` (default off) and the shared-album link became the primary source, loaded **completely** by the helper.

### Topology
- **GitHub Pages** serves the app, built with `VITE_HELPER_URL` pointing at Cloud Run.
- **Cloud Run** (`us-central1`, the free-tier region; `maxScale 1` so the in-memory rate limiter is exact) runs `server/` from the `Dockerfile`. `.gcloudignore` uploads only the `Dockerfile` and `server/`.
- **Firestore** holds per-screen records. Every document carries `expireAt`, and TTL policies on `sessions`, `media`, `sendCodes` and `inboxes` delete them.

This replaces section 8's "never expose the helper" rule: the helper is now multi-tenant by design. Each screen authenticates with its own 32-byte random secret (`X-Frame-Session`), stored only as a SHA-256 hash, and nothing the helper holds lets one screen read another's data.

### Whole-album loading (`server/sharedAlbum.mjs`)
The album page's `AF_initDataCallback` block gives the first page of items, a continuation token and the album key. Further pages come from the internal `batchexecute` RPC `snAcKc`, using the session tokens from `WIZ_global_data` and the link's `key`. Limits: 40 pages, 10,000 items, 40s. Videos are flagged in the item metadata and play from `<base>=dv`. If parsing fails it falls back to scraping the page's photo URLs. A real 687-item album loads completely in about 5s.

### Phone-to-TV hand-off (`server/inbox.mjs`)
- The TV asks for a code (`/api/send-code`); the code is reused until two minutes before expiry, then replaced and the old one retired.
- Codes: 8 characters from a 31-symbol alphabet without look-alikes, 15-minute life, single use. `/api/send` is rate-limited to 10 attempts per address per 10 minutes, so guessing is infeasible.
- The phone's link is validated against the same host allowlist before the code is spent, then stored AES-256-GCM-encrypted as the inbox's pending link.
- The TV polls `/api/inbox` every 3s (also while the page reports itself hidden, as TV browsers do). A link is handed over once; one not collected within an hour is discarded.
- Firestore expiries: codes at their own expiry, inboxes a day after last use.

### Client address for rate limiting
Behind Cloud Run the socket peer is Google's front end, which **appends** the caller's address to `X-Forwarded-For`; anything earlier in the header is caller-controlled. `clientIp` therefore takes the last entry, and only when `K_SERVICE` is set. Elsewhere the header is ignored and the socket address is used. Trusting the first entry would let a caller dodge the limit by sending a different forged address on every request.
