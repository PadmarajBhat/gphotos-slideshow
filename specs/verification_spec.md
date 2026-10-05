# Verification Specification: Ambient Google Photos TV Slideshow (GPicShow)

Requirement IDs in the last column refer to [`requirement.md`](../requirement.md).

## 1. Acceptance Criteria & Test Matrix

| ID | Requirement | Verification Method | Pass Criteria | Req |
|---|---|---|---|---|
| AC-01 | Sign in with Google | `useGoogleAuth.test.ts` + manual OAuth run | Missing Client ID yields an actionable message and no Google call; a returned token authenticates | REQ-G1 |
| AC-02 | Instant Demo Mode | Manual | Curated album with photos and video plays with no credentials | REQ-G4 |
| AC-03 | Album Listing | `googlePhotos.test.ts` | All pages are followed via `nextPageToken`; grid shows cover, title, count | REQ-G2 |
| AC-04 | Fullscreen Slideshow | `BlurredBackdrop.test.tsx` | Fills the viewport; non-fitting photos get a blurred backdrop from a downscaled copy | REQ-S4, REQ-S5 |
| AC-05 | Configurable Duration | `useSlideshow.test.ts`, `storage.test.ts` | Slides advance on the chosen interval, and the choice survives a reload | REQ-S2, REQ-U3 |
| AC-06 | Full Video Playback | `useSlideshow.test.ts` | Timer suspended during video; advances on `ended` | REQ-S3 |
| AC-07 | Video Failure Recovery | `useSlideshow.test.ts` | A video that never ends is force-advanced; a media error skips forward | REQ-S3, REQ-U4 |
| AC-08 | Random Transitions | `transitions.test.ts` | Random never returns `random`; each effect maps to its animation class | REQ-S1 |
| AC-09 | Top-Left Ambient Clock | `dateUtils.test.ts` | Time, AM/PM, seconds, day and date in the viewer's own locale and timezone | REQ-H1 |
| AC-10 | Bottom-Left Media Info | `MediaDetails.test.tsx` | Capture date/time, description and camera metadata; place name when coordinates exist | REQ-H2 |
| AC-11 | Bottom-Right Weather | `weather.test.ts` | Temperature (°C/°F), condition icon, description, rain and humidity | REQ-H3 |
| AC-12 | TV Remote Navigation | `AlbumGrid.test.tsx`, `useTvRemote.test.ts` | Arrow keys move focus between albums, Enter selects, Space pauses, Escape/Back returns | REQ-U1 |
| AC-13 | Dialog Focus Containment | `SettingsModal.test.tsx` | Focus enters the dialog, Tab cycles inside it, Escape and Back close it | REQ-U1 |
| AC-14 | Preference Persistence | `storage.test.ts` | Preferences round-trip; a corrupt payload falls back per field without throwing | REQ-U3 |
| AC-15 | Unattended Operation | `useGoogleAuth.test.ts` | The token is silently renewed before expiry; media URLs refresh on a 45-minute cycle | REQ-U4 |
| AC-16 | Privacy Disclosure | Manual network audit against the README table | No media or token is persisted; every outbound host is documented and avoidable | REQ-T1, REQ-T3 |
| AC-17 | Proxy Hardening | `sharedAlbum.test.ts` | Non-Google hosts and plain HTTP are refused before any request is made | REQ-T5 |
| AC-18 | Shared Album Fallback | `sharedAlbum.test.ts` | An SPA shell response is rejected and the public gateway is tried instead | REQ-P5, REQ-U2 |
| AC-19 | Build & Lint Gate | CI | `npm run lint`, `npm test` and `npm run build` all pass on Node 20 and 22 | REQ-Q1 |

## 2. Test Suites
Vitest + React Testing Library, 105 tests across 14 files:

| File | Covers |
|---|---|
| `useSlideshow.test.ts` | Timer, video completion, media-error recovery, watchdog, item-count changes |
| `useGoogleAuth.test.ts` | Missing/invalid Client ID, token flow, silent renewal, sign-out, persistence |
| `useTvRemote.test.ts` | Every key mapping, text-input guard, enable/disable, listener cleanup |
| `googlePhotos.test.ts` | Album and media pagination, URL mapping, 401/403 error messages |
| `sharedAlbum.test.ts` | Host allowlist, HTML validation, title/photo extraction, gateway fallback |
| `AlbumGrid.test.tsx` | D-pad navigation, initial focus, edge behaviour, dialog focus safety |
| `SettingsModal.test.tsx` | Save, cancel-discards, reopen state, focus trap, Escape/Back |
| `storage.test.ts` | Preference round-trip and per-field sanitisation |
| `mediaUrls.test.ts` | Backdrop downscaling for Google and query-sized URLs, video detection |
| `transitions.test.ts` | Random selection and class mapping |
| `weather.test.ts` | Open-Meteo WMO code mapping |
| `dateUtils.test.ts` | Locale-independent date and clock formatting |
| `MediaDetails.test.tsx` | Metadata rendering and fallbacks |
| `BlurredBackdrop.test.tsx` | Downscaled source, video handling, vignette |

## 3. Known Gaps
- **AC-01 end-to-end** cannot be automated here: it needs a real Google account and Client ID. The hook is unit-tested against a stubbed GIS client; the live flow is manual.
- **AC-16** requires a manual browser network-panel audit; there is no automated assertion that the set of outbound hosts matches the README.
- **On-device verification** on a Sony Bravia W95C has not been performed. D-pad handling is covered by jsdom tests, which cannot model a real TV browser's key codes or focus quirks.
