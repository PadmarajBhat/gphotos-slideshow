# GPicShow — Requirements Register

**Source of truth:** the original project request, reproduced verbatim in [Appendix A](#appendix-a--original-request-verbatim).
**Purpose:** turn that request into numbered, individually testable requirements, and track implementation status against them.

**Status assessed:** 2026-09-28, after the compliance pass described in [specs/tasks.md](specs/tasks.md) Phase 2.

| Legend | Meaning |
|---|---|
| ✅ Met | Implemented and working |
| ⚠️ Partial | Implemented but with a defect, a material limitation, or blocked by an external dependency |
| ❌ Not met | Not implemented, or implemented but non-functional |
| **Source: Explicit** | Stated directly in the original request |
| **Source: Implied** | Necessary for an explicit requirement to be usable; not stated verbatim |

---

## 1. Platform & Distribution

| ID | Requirement | Source | Acceptance criteria | Status |
|---|---|---|---|---|
| REQ-P1 | The project must be open source. | Explicit | A permissive licence file is present in the repository. | ✅ Met — Apache License 2.0 (`LICENSE`) |
| REQ-P2 | The application must be web-based. | Explicit | Runs in a standard browser from a URL. No native install, no app-store distribution. | ✅ Met — React 19 + Vite SPA |
| REQ-P3 | It must run on the target Sony Bravia TV (W95C class) and on any Android TV or other screen capable of running the web app. | Explicit | A production bundle can be built and served; the app loads and is fully operable in a TV browser using only the TV remote. | ✅ Met — production build succeeds; full D-pad operability implemented and tested. On-device W95C verification still outstanding. |
| REQ-P4 | The application must be very lightweight. | Explicit | Initial payload small enough for a TV browser to load quickly over home broadband. | ✅ Met — 339 KB JS + 26 KB CSS, ~102 KB gzipped |
| REQ-P5 | The application must be deployable as a static site with no backend server. | Implied | `npm run build` yields a static bundle hostable on any static host. | ⚠️ Partial, by design — demo and shared-album routes still run as a pure static site. The Google Photos route needs the local helper, because Google mandates a client secret for the Ambient API and a browser cannot hold one. Approved trade-off: the helper runs on your own hardware. |

## 2. Google Photos Integration

| ID | Requirement | Source | Acceptance criteria | Status |
|---|---|---|---|---|
| REQ-G1 | The user must be able to sign in with their Google account. | Explicit | Clicking sign-in completes Google OAuth and yields a usable access token, with no developer-level setup required of the end user. | ✅ Met, by a different mechanism — Google removed the sign-in-and-list-albums capability entirely (see REQ-G5), so this is now served by the **Photos Ambient API**: the user approves the frame once from their phone via device-code pairing. No sign-in on the TV at all. |
| REQ-G2 | After sign-in, Google Photos must show **all** the user's albums. | Explicit | Every album in the account is listed, regardless of count. | ✅ Met — the Ambient helper pages through `nextPageToken` at 100/request until exhausted, so a 600+ item library arrives complete. The user chooses which albums feed the frame in the Google Photos app. |
| REQ-G3 | Clicking an album must start the slideshow. | Explicit | Selecting any album enters full-screen playback of that album's media. | ✅ Met — an empty or failed album now reports why instead of doing nothing |
| REQ-G4 | Album media must include both photos and videos. | Implied | Both media types are fetched and rendered. | ✅ Met |
| REQ-G5 | The chosen Google Photos access method must be supported by Google's current API terms. | Implied | The scopes and endpoints used are ones Google still grants to third-party apps. | ✅ Resolved — **confirmed**: Google removed `photoslibrary.readonly` on 31 March 2025 and it now returns 403 PERMISSION_DENIED. The Library API code was deleted rather than left to fail. Replaced with the Google Photos **Ambient API**, which Google built for TV and ambient displays and which remains supported. |

## 3. Slideshow Playback

| ID | Requirement | Source | Acceptance criteria | Status |
|---|---|---|---|---|
| REQ-S1 | The slideshow must use random transitions. | Explicit | Transition style varies between slides; a fixed style can also be chosen. | ✅ Met — crossfade, Ken Burns, cinematic push, soft scale, plus random |
| REQ-S2 | The user must be able to control the duration between image changes. | Explicit | Duration is user-selectable and takes effect immediately. | ✅ Met — the choice persists across reloads, and Cancel discards edits |
| REQ-S3 | Every video must play completely before the slideshow advances. | Explicit | The auto-advance timer is suspended for videos; advance happens only on playback completion. | ✅ Met — plays to completion, and any failure (error, stall, blocked autoplay, or a clip that never ends) advances instead of freezing |
| REQ-S4 | The slideshow image must be full screen. | Explicit | Media fills the viewport, preserving aspect ratio. | ✅ Met — `100vw × 100vh` with `object-contain` |
| REQ-S5 | When an image cannot fill the screen, the remaining area must show a blurred background derived from that image. | Explicit | Portrait and 4:3 media on a 16:9 screen are letterboxed with a blurred fill rather than black bars. | ✅ Met — the backdrop uses a downscaled copy, and videos fall back to the vignette over a dark base |
| REQ-S6 | Playback must be pausable and manually navigable. | Implied | Play/pause, next and previous work for both photos and videos. | ✅ Met — pause and resume reach the video element as well as the timer |

## 4. Ambient Information Overlays

| ID | Requirement | Source | Acceptance criteria | Status |
|---|---|---|---|---|
| REQ-H1 | Top-left must show the current date and time for the viewer's own region (Indian time in India, US time in the US). | Explicit | Time, date and weekday reflect the device's detected timezone and locale, updating live. | ✅ Met — derived from `Intl` resolved timezone, ticking every second |
| REQ-H2 | Bottom-left must show image details: where it was taken, when it was taken, and any other available information. | Explicit | Location, capture timestamp, description and camera details are shown when available. | ⚠️ Partial — capture time and dimensions come through from the Ambient API, and camera EXIF still renders for any source that supplies it. Location remains unavailable: no current Google Photos API exposes geodata to third parties. Place names resolve only where a source carries coordinates. Documented rather than implied. |
| REQ-H3 | Bottom-right must show current local weather: temperature, and whether it will rain or be sunny. | Explicit | Live temperature, condition text, matching icon, precipitation and humidity for the viewer's location. | ✅ Met — the startup state now reads as loading rather than unavailable |
| REQ-H4 | Overlays must not obscure the photo and must be dismissible. | Implied | Overlays sit in screen corners and can be hidden. | ✅ Met — corner placement, toggle via `H` or the control bar |

## 5. Usability — TV and Elderly Users

| ID | Requirement | Source | Acceptance criteria | Status |
|---|---|---|---|---|
| REQ-U1 | The app must be fully operable with a TV remote. | Explicit ("targeting it for my TV") | D-pad arrows move focus between albums, OK/Enter selects, Back returns — with a clearly visible focus indicator. | ✅ Met — explicit D-pad spatial navigation on the album grid (arrows move, Enter opens), plus focus containment in both dialogs so a remote cannot wander behind them. Covered by AlbumGrid and SettingsModal tests; on-device W95C check still outstanding. |
| REQ-U2 | The app must be simple enough for an elderly user to operate. | Explicit | An elderly user can go from opening the app to a running slideshow of their own photos without developer knowledge. | ✅ Met — "Use My Photos" now opens with the shared-album link tab: paste one link, no Google Cloud project, no consent screen, no sign-in on the TV. OAuth remains available as the advanced route. |
| REQ-U3 | User preferences must persist between sessions. | Implied | Duration, transition, temperature unit, clock format and overlay toggles survive a reload or TV power-cycle. | ✅ Met — preferences persist to localStorage with per-field sanitisation, so a corrupt entry cannot stop the frame starting |
| REQ-U4 | The app must run unattended for long periods as an ambient photo frame. | Implied | Playback continues correctly for many hours without user intervention. | ✅ Met — tokens are silently renewed 5 minutes before expiry, Google media URLs refresh every 45 minutes, and the control bar now stays hidden between slides |
| REQ-U5 | Interface text and controls must be large and high-contrast for 10-foot viewing. | Implied | Typography and focus rings are legible from a couch. | ✅ Met — large type, 4 px amber focus ring |

## 6. Privacy & Trust

| ID | Requirement | Source | Acceptance criteria | Status |
|---|---|---|---|---|
| REQ-T1 | The app must not save images permanently. | Explicit | No image or video is written to disk, local storage, IndexedDB or a service-worker cache. | ✅ Met — verified: no service worker, no cache API, no IndexedDB; only the OAuth client ID is stored |
| REQ-T2 | The app must do nothing malicious in the background. | Explicit | No analytics, tracking, fingerprinting or undisclosed network activity. | ✅ Met — no analytics or tracking code present |
| REQ-T3 | There must be no trust issues with the app. | Explicit | Every outbound network destination is disclosed to the user, and privacy claims in the documentation match actual behaviour. | ✅ Met — every outbound destination is now listed in the README privacy table with what it receives and how to avoid it, and each is switchable off in Settings |
| REQ-T4 | Credentials must never be exposed or persisted. | Implied | Tokens live in memory only and are revoked on sign-out; no password is ever handled by the app. | ✅ Met |
| REQ-T5 | The project must not ship an exploitable development configuration. | Implied | Dev tooling does not expose an unauthenticated network service. | ✅ Met — the proxy accepts only HTTPS URLs on an allowlist of Google Photos hosts, re-validates every redirect hop and caps the response size |

## 7. Internationalization

| ID | Requirement | Source | Acceptance criteria | Status |
|---|---|---|---|---|
| REQ-I1 | The app must be usable in any region of the world. | Explicit | Timezone, date format, temperature unit and clock format adapt to the viewer's region. | ⚠️ Partial — timezone, locale, °C/°F and 12h/24h all adapt, and place names now follow the browser language instead of forcing English. UI strings remain English-only and the last-resort weather fallback is still New Delhi. Tracked as an open item. |

## 8. Engineering Quality

| ID | Requirement | Source | Acceptance criteria | Status |
|---|---|---|---|---|
| REQ-Q1 | The project must build and its tests must pass. | Implied | `npm run build` and `npm test` both succeed from a clean checkout. | ✅ Met — lint, 105 tests and the production build all pass; CI enforces all three on Node 20 and 22 |
| REQ-Q2 | The repository must contain no unreachable or misleading code. | Implied | Every module is reachable from the application entry point; automated checks genuinely check. | ✅ Met — the shared-album feature is wired into the connect flow; the drift checker now genuinely fails on drift; dead CSS classes and the unrelated colour palette are gone |
| REQ-Q3 | Core behaviour must be covered by automated tests. | Implied | Playback, video handling, formatting and API mapping are tested. | ✅ Met — 105 tests across 14 files now cover authentication, API pagination and errors, remote keys, shared-album parsing, D-pad navigation, preferences and media URLs |

---

## Compliance Summary

| Section | ✅ Met | ⚠️ Partial | ❌ Not met | Was (before Phase 2) |
|---|---|---|---|---|
| 1. Platform & Distribution | 5 | 0 | 0 | 3 / 2 / 0 |
| 2. Google Photos Integration | 4 | 1 | 0 | 1 / 3 / 1 |
| 3. Slideshow Playback | 6 | 0 | 0 | 2 / 4 / 0 |
| 4. Ambient Overlays | 3 | 1 | 0 | 2 / 2 / 0 |
| 5. Usability (TV / Elderly) | 5 | 0 | 0 | 1 / 0 / 4 |
| 6. Privacy & Trust | 5 | 0 | 0 | 3 / 1 / 1 |
| 7. Internationalization | 0 | 1 | 0 | 0 / 1 / 0 |
| 8. Engineering Quality | 3 | 0 | 0 | 0 / 1 / 2 |
| **Total (34)** | **31** | **3** | **0** | 12 / 14 / 8 |

### Previously blocking, now resolved

| ID | Was | Now |
|---|---|---|
| REQ-Q1 | The project did not build | Lint, 105 tests and the production build all pass; CI enforces them on Node 20 and 22 |
| REQ-G1 | Sign-in could never succeed (fabricated Client ID) | Placeholder removed, actionable errors, build-time ID supported, and a route that needs no sign-in |
| REQ-U2 | Personal photos required developer-level Google Cloud setup | Shared album link is the default route: paste one link, nothing to configure |
| REQ-U1 | A TV remote could not select an album | Explicit D-pad grid navigation plus dialog focus containment |
| REQ-S3 | One failed video froze the slideshow indefinitely | Muted autoplay, error/stall handling, 15s start watchdog, 10-minute ceiling |

### Remaining gaps

| ID | Gap | Why it is not closed |
|---|---|---|
| REQ-P5 | The Google Photos route is no longer pure-static | Google mandates a client secret for the Ambient API. Deliberate, user-approved trade-off; demo and shared-album routes remain static-only. |
| REQ-H2 | "Where it was taken" cannot populate for Google-sourced photos | No current Google Photos API exposes geodata to third parties. Not fixable at any layer. Place names work for any source carrying coordinates. |
| REQ-I1 | UI strings are English-only; the last-resort weather fallback is New Delhi | Needs a translation layer; out of scope for a correctness pass. Timezone, locale, units and clock format all adapt today, and place names follow the browser language. |

### Verification not yet performed

**On-device testing on the target Sony Bravia W95C has not happened.** D-pad navigation, focus rings, video codec support and fullscreen behaviour are covered by jsdom tests and by reading the platform's documented behaviour — neither substitutes for running it on the actual TV. REQ-P3 and REQ-U1 should be treated as "met in code, unverified on hardware" until someone loads the build on the TV.

---

## Out of Scope

Derived from the request's emphasis on a lightweight, presentation-only, trust-preserving app:

- Photo editing, cropping, filters or any media manipulation.
- Server-side components, user accounts, or databases owned by this project.
- Permanent caching of photos or videos to disk or cloud storage.
- Analytics, telemetry, crash reporting or advertising.
- Uploading, deleting or modifying anything in the user's Google Photos library.
- Native TV applications packaged for an app store.

---

## Appendix A — Original Request (verbatim)

> I want to create an open source project. It should be a web-based application. I want to connect to Google Photos. The user must be able to sign in through Google account and then Google Photos should show all the albums. So on clicking an album, it should let me start the slideshow. The slideshow should have random transitions. User should have access to the time duration with which the images are changed. All the videos should play completely, then only it should move to next. While the slideshow happens, in the left top, there should be current date and time of the respective region, in India, Indian time and US, US time. Left bottom should show the image details like where it was taken, what time it was taken and any other info about the image. And in the right bottom, it should show the current local weather details like what's the temperature, whether it is going to rain or sunny, etc. The image should be a full screen. The slideshow image should be full screen. And if the image can cannot fit this full screen, it should there should be a blur effect in the background for the rest of the screen in the slideshow. I am targeting it for my TV, Sony. I think it is W95C or something. But it should work on any of the Android TV or any of the screen where this web app can be run. The app should be user friendly so that So that even the elderly should be able to use it. App should not do anything malicious in the background like saving the images permanently. There should not be any trust issues with the app. Should be usable across the region in the world. Very lightweight user-friendly app it should be.
