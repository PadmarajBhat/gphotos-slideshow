# Functional Specification: Ambient Google Photos TV Slideshow (LuminaFrame)

## 1. Intent & Business Goals
The goal of this open-source project is to provide a lightweight, zero-trust, elderly-friendly ambient photo & video slideshow web application designed primarily for TVs (Sony Android TV / Google TV, smart screens, desktop, tablet) connected to Google Photos.

Key objectives:
- **Client-Side Privacy**: 100% client-side execution with no backend of our own. Photos and tokens are kept in transient memory only and are never persisted. Ambient features (weather, reverse geocoding, shared-album loading) do contact named third-party services; the full list, what each receives and how to avoid it is in the README "Privacy: what leaves your device" table.
- **Elderly-Friendly & 10ft UI**: Clean, high-contrast, uncluttered interface with large fonts and simple TV remote navigation (D-pad: Up/Down/Left/Right, Enter, Back/Escape, Space).
- **Ambient Smart Display Experience**:
  - Fullscreen media presentation with dynamic blurred backdrop for non-fitting aspect ratios (e.g. portrait or 4:3 photos on a 16:9 widescreen TV).
  - Configurable random transitions: crossfade, Ken Burns, cinematic push (slide-left), soft scale (scale-up).
  - Configurable slide duration for photos (default: 10s; options: 5s, 10s, 15s, 30s, 60s).
  - Uninterrupted video playback: videos must play in their entirety before transitioning. Playback is muted (browsers refuse unmuted timer-driven autoplay), and any failure - decode error, stall, blocked autoplay, or a clip that never ends - must advance the slideshow rather than freeze it.
  - Informative ambient HUD overlays:
    - **Top-Left**: Current local date and time formatted for the user's region (auto-detects local timezone, e.g., IST in India, EST/PST in US).
    - **Bottom-Left**: Image details (capture date/time, description, camera details, and location where the source supplies coordinates). Note: the Google Photos Library API does not return geodata, so place names appear only for demo content or sources that carry coordinates.
    - **Bottom-Right**: Live local weather details (temperature in °C/°F, condition text, weather glyph, rain/sun forecast) using free, privacy-friendly Open-Meteo API.
- **Instant Demo Mode**: a curated demo album so users can test immediately without any credentials.
- **Zero-Setup Personal Photos**: a Google Photos shared album link must work with no Google Cloud project, no OAuth consent screen and no sign-in. This is the primary route for the elderly-user goal; OAuth sign-in is the advanced alternative.
- **Unattended Operation**: the frame must keep running for days. Access tokens and Google media URLs both expire after roughly an hour and must be renewed automatically.
- **Persistent Preferences**: slide duration, transition, units and overlay choices must survive a reload or TV power-cycle.

## 2. Boundaries & Non-Goals
- **Non-Goals**:
  - No permanent caching or saving of photos to disk, cloud storage, or external databases.
  - No third-party tracking scripts, analytics, or fingerprinting.
  - No complex editing or photo manipulation tools (this is a presentation & ambient frame viewer, not a photo editor).
  - No server-side backend required for deployment; hosts as a static site (GitHub Pages, Vercel, Netlify, Cloudflare Pages, or local web server).

## 3. User Journeys & Workflows
1. **Launch & Setup**:
   - User opens the web app on their TV browser or smart screen.
   - Screen presents:
     - "Connect Google Photos" (OAuth 2.0 Sign In with Google).
     - "Try Demo Album" (Instant access for testing/evaluation).
     - Settings (Slide interval, transition style, temperature unit °C/°F, clock format 12h/24h, Google Client ID input).
2. **Album Selection**:
   - Grid of photo albums fetched via Google Photos Library API (or curated demo albums in demo mode).
   - Visual focus ring highlighting the active album card for remote control navigation.
   - Enter/Click initiates the slideshow.
3. **Ambient Slideshow Playback**:
   - Enters full screen.
   - Top-Left: Digital clock and calendar date updating every second.
   - Bottom-Left: Photo capture date, time, and location (with reverse-geocoded place names).
   - Bottom-Right: Live weather widget based on browser geolocation or IP location.
   - Image renders in center with `object-fit: contain`; remaining screen edges render a mirrored, scaled, heavily blurred version of the photo (`backdrop-blur`).
   - If media is a video, playback starts automatically with sound muted or controlled; timer is paused until the video finishes (`onEnded`), then proceeds.
   - Interactive remote keys:
     - `Space` / `Center Button`: Pause / Resume slideshow, including any playing video.
     - `Right Arrow`: Next photo.
     - `Left Arrow`: Previous photo.
     - `Escape` / `Back Button`: Return to album selection.
     - `H`: Toggle ambient HUD overlay visibility.
     - `F`: Toggle full screen.

## 4. Interface Contracts & External APIs
- **Google Identity Services (GIS)**:
  - OAuth 2.0 Token Client: Scope `https://www.googleapis.com/auth/photoslibrary.readonly`.
- **Google Photos Library API**:
  - `GET https://photoslibrary.googleapis.com/v1/albums`: Fetch user's albums.
  - `POST https://photoslibrary.googleapis.com/v1/mediaItems:search`: Fetch media items by `albumId`.
- **Weather API (Open-Meteo)**:
  - `GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`
  - Free, open source, zero API key required, zero tracking.
- **Geocoding API**:
  - Reverse geocoding via OpenStreetMap Nominatim, client-side, cached and throttled to the policy limit of one request per second.
- **Shared Album Links** (no authentication):
  - The album page is fetched and parsed in the browser. In development the request passes through the Vite dev-server proxy; on a hosted static build it passes through the public `api.allorigins.win` gateway, since browsers cannot fetch `photos.google.com` cross-origin.
  - Only HTTPS URLs on `photos.app.goo.gl`, `photos.google.com` and `goo.gl` are accepted, validated before any request is issued.

## 5. Known Risk: Google Photos API Availability
Google restricted broad `photoslibrary.readonly` access for third-party applications in 2025. New Cloud projects may be limited to app-created data, with user-selected media served through the newer Picker API instead.

If this restriction applies, the OAuth route (section 3, "Launch & Setup") cannot list a user's albums no matter how the Cloud project is configured, and the shared-album link becomes the only working route to personal photos. **This must be verified against Google's current documentation before further investment in the OAuth path.** The shared-album route is specified as primary partly for this reason.
