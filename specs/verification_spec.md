# Verification Specification: Ambient Google Photos TV Slideshow (GPicShow)

Requirement IDs in the last column refer to [`requirement.md`](../requirement.md).

## 1. Acceptance Criteria & Test Matrix

| ID | Requirement | Verification Method | Pass Criteria | Req |
|---|---|---|---|---|
| AC-01 | Send an album from a phone | `inbox.test.mjs`, `app.test.mjs`, `SendPanel.test.tsx`, `SendToFrame.test.tsx`, live run against Cloud Run | The TV shows a QR with a valid code and renews it before expiry; the phone's link reaches only the TV that showed the code, once; spent, expired and non-Google submissions are refused | REQ-G1, REQ-U2 |
| AC-02 | Instant Demo Mode | Manual | Curated album with photos and video plays with no credentials | REQ-G4 |
| AC-03 | Whole shared album | `sharedAlbum.test.mjs` + live run | Every page is followed until the continuation token runs out; videos are recognised; a 687-item album arrives complete | REQ-G2, REQ-G4 |
| AC-04 | Fullscreen Slideshow | `BlurredBackdrop.test.tsx` | Fills the viewport; non-fitting photos get a blurred backdrop from a downscaled copy | REQ-S4, REQ-S5 |
| AC-05 | Configurable Duration | `useSlideshow.test.ts`, `storage.test.ts` | Slides advance on the chosen interval, and the choice survives a reload | REQ-S2, REQ-U3 |
| AC-06 | Full Video Playback | `useSlideshow.test.ts` | Timer suspended during video; advances on `ended` | REQ-S3 |
| AC-07 | Media Failure Recovery | `useSlideshow.test.ts`, `SlideshowView.test.tsx` | A brief `stalled` does not skip a video; one that never starts (30s) or stops making progress (30s) is skipped; a video that never ends is force-advanced; up to three failures skip at once, after which retries back off from 5s to 60s; one item's repeated error events count once; a successful load resets | REQ-S3, REQ-U4 |
| AC-08 | Random Transitions | `transitions.test.ts` | Random never returns `random`; each effect maps to its animation class | REQ-S1 |
| AC-09 | Top-Left Ambient Clock | `dateUtils.test.ts` | Time, AM/PM, seconds, day and date in the viewer's own locale and timezone | REQ-H1 |
| AC-10 | Bottom-Left Media Info | `MediaDetails.test.tsx` | Capture date/time, description and camera metadata; place name when coordinates exist | REQ-H2 |
| AC-11 | Bottom-Right Weather | `weather.test.ts` | Temperature (°C/°F), condition icon, description, rain and humidity | REQ-H3 |
| AC-12 | TV Remote Navigation | `HomeScreen.test.tsx`, `useSpatialNavigation.test.ts`, `useTvRemote.test.ts` | Arrow keys move focus, Enter selects, the latest album is pre-focused, Space pauses, Escape/Back returns | REQ-U1 |
| AC-13 | Dialog Focus Containment | `SettingsModal.test.tsx` | Focus enters the dialog, Tab cycles inside it, Escape and Back close it | REQ-U1 |
| AC-14 | Preference Persistence | `storage.test.ts`, `recentAlbums.test.ts` | Preferences and the last three albums round-trip; a corrupt payload falls back without throwing | REQ-U3 |
| AC-15 | Unattended Operation | `useSharedAlbumRefresh.test.ts`, `useWakeLock.test.ts` | A playing shared album reloads every 6 hours and keeps its list if a reload fails; the screen stays awake and the lock is retaken when the tab returns | REQ-U4, REQ-P3 |
| AC-16 | Privacy Disclosure | Manual network audit against the README table | No media is persisted; every outbound host is documented | REQ-T1, REQ-T3 |
| AC-17 | Fetch Hardening | `sharedAlbum.test.mjs`, `sharedAlbum.test.ts` | Non-Google hosts and plain HTTP are refused before any request; every redirect hop is re-validated | REQ-T5 |
| AC-18 | Abuse Resistance | `app.test.mjs`, `inbox.test.mjs` + live run | Codes are single-use and expire; an address is cut off after 10 send attempts in 10 minutes, and forging `X-Forwarded-For` does not reset the count; links in transit are stored encrypted | REQ-T4, REQ-T5 |
| AC-19 | Build & Lint Gate | CI | `npm run lint`, `npm test` and `npm run build` all pass on Node 20 and 22 | REQ-Q1 |
| AC-20 | Every Screen Size | Manual, measured in the browser preview | Clock, details and weather never overlap and the control bar fits at 360×740, 375×812, 812×375, 768×1024 and 1920×1080 | REQ-P3, REQ-H4 |
| AC-24 | Play Order and Resume | `playOrder.test.ts`, `playProgress.test.ts`, `useSlideshow.test.ts`, `SettingsModal.test.tsx` | Newest/oldest sort by date with undated last; shuffle covers every item once per pass, is reproducible from its seed, keeps its order as photos are added, and spreads videos through the album; progress resumes per album and filter; Back steps into the previous pass and Next returns | REQ-S1, REQ-U4 |
| AC-25 | Video Sources, Sound and TV Decoders | `SlideshowView.test.tsx` | 1080p, 720p, 360p, then the original are tried in turn; the decoder is released on leaving a video; a stream that plays sound but decodes no frames gives way to the next; video has no CSS effects; sound plays when allowed, otherwise the first press enables it without pausing; muting holds | REQ-S3 |
| AC-26 | TV-Reachable Settings and Hints | `SettingsModal.test.tsx`, `LoadingAlbum.test.tsx`, `SlideshowView.test.tsx` | Arrow keys reach Save; Save sits outside the scrolling options; loading shows elapsed seconds and expectations; remote presses reveal the controls wherever focus is | REQ-U1, REQ-U2 |
| AC-27 | Settings During the Slideshow | `SlideshowView.test.tsx` | The gear, Menu and S open Settings; the slideshow pauses while it is open, ignores the remote's keys, and resumes after; Down reaches the bar, Left/Right move along it without changing slides, Up leaves it | REQ-U1, REQ-U2 |
| AC-23 | Photos, Videos or Both | `mediaUrls.test.ts`, `SettingsModal.test.tsx`, `storage.test.ts`, `HomeScreen.test.tsx`, `recentAlbums.test.ts` | The filter plays only the chosen kind and falls back to everything when an album has none; Continue cards read e.g. "627 photos · 60 videos"; older saved entries still load | REQ-G4, REQ-U2 |
| AC-22 | Fading Overlays | `useOverlayRhythm.test.ts`, `SlideshowView.test.tsx`, `SettingsModal.test.tsx`, `storage.test.ts` | Weather shows 10s every 2 minutes; clock and photo info show the first sixth after a photo loads and the last sixth before it changes (a video's own length for videos); short slides keep them up; pausing or remote activity shows all; the setting persists and switching it off holds everything steady | REQ-H4 |
| AC-21 | Home Screen Always Reachable | `HomeScreen.test.tsx` + measured in the browser preview | With three albums in Continue, the QR and its code are fully on screen with no scrolling at 960×540, 1280×720, 1920×1080 and 768×1024; phones and landscape phones scroll to reach them | REQ-P3, REQ-U1, REQ-U2 |

## 2. Test Suites
Vitest + React Testing Library, 286 tests across 32 files.

| File | Covers |
|---|---|
| `useSlideshow.test.ts` | Timer, video completion, media-error recovery and back-off, watchdog, item-count changes |
| `SlideshowView.test.tsx` | Source fallback, decoder release, sound, slow/stuck/never-starting videos, loading hints, remote reveals controls |
| `playOrder.test.ts`, `playProgress.test.ts` | Orders, shuffle properties, saved progress |
| `LoadingAlbum.test.tsx` | Album loading hints |
| `useSharedAlbumRefresh.test.ts` | Periodic reload of a playing shared album, failure tolerance, cleanup |
| `useOverlayRhythm.test.ts` | Overlay fade rhythms, offsets, caps, short slides, switched off |
| `useWakeLock.test.ts` | Acquire, release, re-acquire on visibility, unsupported browsers |
| `SendPanel.test.tsx` | QR and code, inbox polling, code renewal, unavailable helper |
| `SendToFrame.test.tsx` | Link validation, send, confirmation, expired-code message |
| `HomeScreen.test.tsx` | Layout, Continue row, initial focus, right-hand panel slot |
| `useSpatialNavigation.test.ts`, `useTvRemote.test.ts` | D-pad focus movement and every key mapping |
| `SettingsModal.test.tsx` | Save, cancel-discards, reopen state, focus trap, Escape/Back |
| `sharedAlbum.test.ts` | Client-side link validation and the helper request |
| `storage.test.ts`, `recentAlbums.test.ts` | Preference and recent-album persistence and sanitisation |
| `mediaUrls.test.ts`, `BlurredBackdrop.test.tsx` | Backdrop downscaling, video detection |
| `transitions.test.ts`, `weather.test.ts`, `dateUtils.test.ts`, `MediaDetails.test.tsx` | Effects, weather codes, clock formatting, metadata rendering |
| `ambient.test.ts`, `ambientMapping.test.ts`, `PhotosPanel.test.tsx` | The Ambient integration kept for partner approval |
| `server/test/inbox.test.mjs` | Codes, delivery, one-time collection, expiry, encryption, isolation between TVs |
| `server/test/sharedAlbum.test.mjs` | Album parsing, pagination, videos, host allowlist, redirects |
| `server/test/app.test.mjs` | Routes, CORS, sessions, rate limits, forged headers, error hiding |
| `server/test/stores.test.mjs`, `crypto.test.mjs`, `sessions.test.mjs` | Firestore mapping and expiries, encryption, Ambient pairing |

## 3. Known Gaps
- **Shared-album link lifetime** is undocumented by Google and has not been measured over several days. AC-15's 6-hour reload is the mitigation.
- **AC-16** requires a manual browser network-panel audit; there is no automated assertion that the set of outbound hosts matches the README.
- **On-device verification** on a Sony Bravia W95C has not been performed. D-pad handling is covered by jsdom tests, which cannot model a real TV browser's key codes or focus quirks.
