# Functional Specification: Ambient Google Photos TV Slideshow (GPicShow)

## 1. Intent & Business Goals
The goal of this open-source project is to provide a lightweight, zero-trust, elderly-friendly ambient photo & video slideshow web application designed primarily for TVs (Sony Android TV / Google TV, smart screens, desktop, tablet, phone) showing Google Photos albums.

Key objectives:
- **Minimal, auditable backend**: the app is a static site plus a small dependency-free helper. The helper never downloads or stores photos; it reads a shared album's item list from Google and passes album links from phone to TV. Ambient features (weather, reverse geocoding) contact named third-party services; the full list, what each receives and how to avoid it is in the README "Privacy: what leaves your device" table.
- **Elderly-Friendly & 10ft UI**: Clean, high-contrast, uncluttered interface with large fonts, minimal text and simple TV remote navigation (D-pad: Up/Down/Left/Right, Enter, Back/Escape, Space).
- **Ambient Smart Display Experience**:
  - Fullscreen media presentation with dynamic blurred backdrop for non-fitting aspect ratios (e.g. portrait or 4:3 photos on a 16:9 widescreen TV).
  - Configurable random transitions: crossfade, Ken Burns, cinematic push (slide-left), soft scale (scale-up).
  - Configurable slide duration for photos (default: 10s; options: 5s, 10s, 15s, 30s, 60s).
  - Uninterrupted video playback: videos must play in their entirety before transitioning. Playback is muted (browsers refuse unmuted timer-driven autoplay), and any failure - decode error, stall, blocked autoplay, or a clip that never ends - must advance the slideshow rather than freeze it.
  - Informative ambient HUD overlays:
    - **Top-Left**: Current local date and time formatted for the user's region (auto-detects local timezone, e.g., IST in India, EST/PST in US).
    - **Bottom-Left**: Image details (capture date/time, description, camera details, and location where the source supplies coordinates).
    - **Bottom-Right**: Live local weather details (temperature in °C/°F, condition text, weather glyph, rain/sun forecast) using free, privacy-friendly Open-Meteo API.
    - On screens narrower than 640px the overlays compact and the weather stacks above the details, so no overlay covers another.
- **Instant Demo Mode**: a curated demo album so users can test immediately without any credentials.
- **Zero-Setup Personal Photos**: a Google Photos shared album link, sent from a phone by scanning the TV's QR code, must load the **whole album, photos and videos**, with no Google Cloud project, no consent screen and no sign-in.
- **Works on every screen size**: TV, tablet and phone. On phones and tablets the screen is kept awake during a slideshow.
- **Unattended Operation**: the frame must keep running for days, and must degrade gracefully when photos stop loading (back off and retry, never race through the album).
- **Persistent Preferences**: slide duration, transition, units and overlay choices must survive a reload or TV power-cycle.

## 2. Boundaries & Non-Goals
- **Non-Goals**:
  - No permanent caching or saving of photos to disk, cloud storage, or external databases.
  - No third-party tracking scripts, analytics, or fingerprinting.
  - No complex editing or photo manipulation tools (this is a presentation & ambient frame viewer, not a photo editor).
  - No user accounts. A screen is identified only by a random secret it generates itself.

## 3. User Journeys & Workflows
1. **Home screen** (opened on the TV):
   - Title "Your Photo Frame" and a one-sentence tagline.
   - **Continue**: the last three albums played on that screen, the most recent pre-focused so one press of OK resumes it.
   - **Try the demo** on the left; on the right a **QR code** with "Scan to send an album" and a readable one-time code.
   - Settings (gear): slide interval, transition, temperature unit, clock format, overlays, play a shared link directly, clear recently played.
   - On a TV-sized screen (at least 768×480) the whole home screen fits without scrolling, because a TV browser can't really scroll. Continue sits above the demo in the left column, so the QR on the right keeps its full height however many albums there are; it shrinks to fit short screens (170px at 960×540, 260px at most). Smaller screens scroll inside a viewport-height box, since the page itself is locked for the slideshow.
2. **Send an album from a phone**:
   - Scanning (or, on a phone or tablet, tapping) the QR opens `?send=<code>` on the phone.
   - The phone page explains *Share → Create link* in Google Photos, takes the pasted link and sends it.
   - The TV picks the link up within about three seconds, shows "Album received", loads the album and starts the slideshow.
   - Codes expire after 15 minutes and are single-use; the TV renews its code before expiry, so the QR on screen is always valid.
3. **Ambient Slideshow Playback**:
   - Enters full screen.
   - Top-Left: Digital clock and calendar date updating every second.
   - Bottom-Left: Photo capture date, time, and location (with reverse-geocoded place names).
   - Bottom-Right: Live weather widget based on browser geolocation or IP location.
   - Image renders in center with `object-fit: contain`; remaining screen edges render a mirrored, scaled, heavily blurred version of the photo (`backdrop-blur`).
   - If media is a video, playback starts automatically with sound muted; the timer is suspended until the video finishes (`onEnded`), then proceeds.
   - If photos keep failing to load, a short "Photos aren't loading right now" notice shows while the slideshow waits progressively longer between tries.
   - Interactive remote keys:
     - `Space` / `Center Button`: Pause / Resume slideshow, including any playing video.
     - `Right Arrow`: Next photo.
     - `Left Arrow`: Previous photo.
     - `Escape` / `Back Button`: Return to the home screen.
     - `H`: Toggle ambient HUD overlay visibility.
     - `F`: Toggle full screen (the on-screen button is hidden where the browser has no fullscreen, e.g. iPhone).

## 4. Interface Contracts & External APIs
- **Photo helper** (`VITE_HELPER_URL`, Cloud Run in production):
  - `POST /api/shared-album` `{url}` → `{title, items, complete}`: the whole shared album, paginated server-side.
  - `POST /api/send-code` (header `X-Frame-Session`) → `{code, expiresAt}`.
  - `GET /api/inbox` (header `X-Frame-Session`) → `{url | null}`, each link handed over once.
  - `POST /api/send` `{code, url}` (no session; rate-limited per address) → `{ok}`, `404` for an expired or spent code, `400` for a non-Google link.
- **Weather API (Open-Meteo)**:
  - `GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`
  - Free, open source, zero API key required, zero tracking.
- **Geocoding API**:
  - Reverse geocoding via OpenStreetMap Nominatim, client-side, cached and throttled to the policy limit of one request per second.
- **Shared Album Links**:
  - Only HTTPS URLs on `photos.app.goo.gl`, `photos.google.com` and `goo.gl` are accepted, validated in the browser before sending and again on the server before any request.

## 5. Google Photos API Availability (resolved 2026-10-05)
- The Library API's `photoslibrary.readonly` scope was removed on 31 March 2025.
- The Picker API's scope is rejected by the OAuth device flow that TVs use, and picked items expire.
- The Ambient API requires acceptance into Google's partner program (`403` otherwise). Its integration is kept behind `VITE_AMBIENT_API`, off by default.

The shared-album link is therefore the primary and, for now, only route to personal photos.
