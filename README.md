# GPicShow 🖼️✨
> **An Ambient Google Photos Slideshow for Smart TVs & Screens**

[![CI](https://github.com/PadmarajBhat/gphotos-slideshow/actions/workflows/ci.yml/badge.svg)](https://github.com/PadmarajBhat/gphotos-slideshow/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)

**GPicShow** turns a Smart TV (Sony Android TV / Google TV, Samsung, LG, Fire TV), a tablet, a phone or any connected display into an ambient photo frame for your **Google Photos** albums, videos included.

Built for **elderly ease-of-use**, **10-foot TV ergonomics**, and nothing to install or sign in to.

**Use it now:** open **https://padmarajbhat.github.io/gphotos-slideshow/** on the TV.

---

## 📲 How it works

1. **On the TV**, open the site. The home screen shows a QR code.
2. **On your phone**, in Google Photos, open an album and tap **Share → Create link**, then copy the link.
3. **Scan the QR** on the TV, paste the link and tap **Send to TV**.
4. The TV loads **the whole album, photos and videos**, and starts the slideshow within a few seconds.

Next time, the album is waiting under **Continue** at the top of the home screen. One press of OK resumes it.

No account, no app to install, and nothing to type on the TV. On a phone or tablet, tap the QR instead of scanning it.

### Why shared links?

Google has closed the other doors for independent apps:

- On **31 March 2025** Google removed the `photoslibrary.readonly` scope, so apps can no longer list your albums.
- The **Picker API** can't be used from a TV: Google's device sign-in flow rejects its scope, and picked items expire.
- The **[Ambient API](https://developers.google.com/photos/ambient)**, built for photo frames, is open only to members of Google's partner program.

A shared-album link is the one route that works everywhere and loads a complete album. The Ambient integration is still in the code, switched off behind `VITE_AMBIENT_API`, for the day the app is accepted.

| Source | Setup | Gets | Videos play |
|---|---|---|---|
| **Shared album link** | Send from your phone | The whole album | ✅ Yes |
| **Demo** | None | Curated samples | ✅ Yes |
| **Google Photos (Ambient API)** | Partner program only, off by default | Albums you choose | ✅ Yes |

---

## 🌟 Features

- 📺 **Full D-pad navigation**: arrow keys move, OK opens, Back exits. Large type, high-contrast focus rings.
- 📱 **Send from your phone**: scan, paste, send. The TV picks it up by itself.
- ⏯️ **Continue where you left off**: the last three albums sit at the top of the home screen, the latest already focused.
- 🖼️ **Full-screen with blur backdrop**: photos that don't match the screen shape are letterboxed against a blurred copy of themselves.
- 🎬 **Videos play to completion, with sound**, before advancing. They stream as Google Photos' own 1080p, 720p or 360p versions, falling back through them, so TVs that stall on an original file still play it. On a TV the app keeps videos within 1920×1080, which is what older TV decoders handle: bigger portrait videos play their 360p version there, and phones still get full quality. A clip slow to start on home Wi-Fi is given time; one that never starts or stops moving is skipped instead of freezing the frame. If the browser wants a press before allowing sound, the first press turns it on. The speaker on the control bar (or **M**) mutes.
- 🔀 **Album order, newest first, oldest first or shuffle** (Settings → Order). Shuffle plays everything once before any repeat. Every album carries on from where it was, even after the TV is switched off, and **Back** always steps through what was actually shown.
- ⚙️ **Settings without leaving the slideshow**: the gear on the control bar (or Menu / S on the remote) opens them over the paused slideshow; changes apply when you close them.
- ⏳ **Says what it's doing**: loading an album or a slow photo or video shows how long it has taken and what to expect.
- 🎞️ **Photos, videos or both**: Settings → Play chooses what an album shows. The Continue cards say how many photos and videos each album holds.
- 🔀 **Cinematic transitions**: Ken Burns, crossfade, cinematic push, soft scale, or random. Slide duration 5–60s.
- 🕒 **Ambient overlays**: regional clock (top-left), photo details (bottom-left), live weather (bottom-right). Each can be switched off. On phones the layout tightens so nothing overlaps. A photo's location shows only when it has one.
- 🌗 **Overlays that come and go**: the weather shows for 10 seconds every 2 minutes; the clock and photo info show for a third of each photo's time, half as it arrives and half before it changes (a video uses its own length). The screen never feels frozen, and an OLED TV left on all day isn't burned by fixed elements. Pausing, or any press of the remote, shows them all. Switch it off under **Settings → Fade them in and out now and then**.
- 🔆 **Keeps the screen on** during a slideshow on phones and tablets.
- 🛟 **Copes with bad networks**: when photos stop loading, it slows down and retries instead of racing through the album.

---

## 🎮 TV Remote & Keyboard

### Home screen
| Key | Action |
|---|---|
| **Arrow keys** | Move between albums |
| **OK / Enter** | Open the focused album |
| **Escape / Back** | Close a dialog |

### During the slideshow
| Key | Action |
|---|---|
| **→** / Next Track | Next photo or video |
| **←** / Prev Track | Previous |
| **Space** / OK / Play-Pause | Pause / resume (pauses video too) |
| **Escape** / Back / Backspace | Return to the home screen |
| **F** | Fullscreen |
| **H** | Show / hide overlays |
| **M** | Video sound on / off |
| **Menu** / **S** | Settings, over the slideshow (paused while open) |
| **↓** / **↑** | Onto the control bar / off it (TVs show "▼ for buttons"). On the bar, **←** **→** move between buttons and **OK** presses |

---

## 📱 Running on a TV, tablet or phone

- **Android TV / Google TV** (e.g. Sony Bravia): install a browser such as *Open Browser* or *Puffin TV* from the Play Store, open the address, and use the remote's D-pad.
- **Phone or tablet**: open the site and choose **Add to Home Screen**. It launches full-screen like an app. Prop it on a stand: the screen stays on while the slideshow plays.
- **Cast**: open the site on a laptop and cast the tab to the TV.

---

## 🏗️ Architecture

| Part | Where | Job |
|---|---|---|
| **Web app** (`src/`) | GitHub Pages | Everything you see. Photos and videos stream straight from Google to the screen. |
| **Photo helper** (`server/`) | Google Cloud Run, `us-central1` | Reads a shared album from Google (a browser can't, because of CORS), and passes album links from phone to TV. |
| **Database** | Firestore | One-time send codes and links in transit, each with a short expiry. |

The helper is dependency-free Node. It never downloads or stores a photo; it returns the album's list of items and the screen loads each one from Google.

### Security model

- **Per-screen secret.** Each screen generates 32 random bytes on first run and sends them as `X-Frame-Session`. The server files records under a SHA-256 hash of that value, never the value itself.
- **Send codes** are 8 characters from a 31-symbol alphabet (about 8.5 × 10¹¹ combinations), valid for 15 minutes, single use. Sending is rate-limited to 10 tries per 10 minutes per address, so guessing a code is infeasible.
- **Links in transit** are encrypted with AES-256-GCM (key in Secret Manager), handed over once, and discarded after an hour if no screen collects them.
- **Fetches are locked to Google**: only Google Photos hosts over HTTPS, with every redirect re-checked, so the helper can't be used to reach anything else.
- **CORS** admits only the published site (and localhost for development).

---

## 🚀 Development

### Prerequisites
- Node.js 18+ (CI covers 20 and 22)

### Run locally
```bash
git clone https://github.com/PadmarajBhat/gphotos-slideshow.git
cd gphotos-slideshow
npm install
```

Two terminals:

```bash
npm run helper
```

```bash
npm run dev
```

Open `http://localhost:3000`. Vite proxies the send routes to the helper on port 4000. Locally the helper stores its data under `server/.data/` (gitignored) and generates its own encryption key there.

### Commands
```bash
npm run dev       # Vite dev server on :3000
npm run helper    # photo helper on :4000
npm run lint      # ESLint
npm test          # Vitest
npm run build     # type check + production bundle
npm run verify    # lint + test + build
```

`tools/spec_drift_check.py` fails when `src/` changes without a matching update under `specs/`. CI runs it on pull requests.

The dev server binds to all interfaces so a TV on the same Wi-Fi can reach it. Don't expose it to an untrusted network.

---

## 🌍 Deployment

### Web app: GitHub Pages

Wired up in `.github/workflows/deploy-pages.yml`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Every push to `master` then tests, builds and publishes. The workflow sets the base path from the repository name and points the app at the helper through `VITE_HELPER_URL`.

### Photo helper: Cloud Run

Cloud Run's free tier covers a personal frame comfortably, but only in `us-central1`, `us-east1` and `us-west1`.

One-time setup, in a project of your own:

```bash
gcloud services enable run.googleapis.com firestore.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com
gcloud firestore databases create --location=us-central1
```

1. Create a service account with **Cloud Datastore User** and **Secret Manager Secret Accessor**, and nothing else.
2. Store a 32-byte key as a secret. Generate it with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
3. Turn on automatic deletion for each collection the helper writes:

```bash
for g in sendCodes inboxes sessions media; do gcloud firestore fields ttls update expireAt --collection-group=$g --enable-ttl --async; done
```

Deploy (only the `Dockerfile` and `server/` are uploaded, see `.gcloudignore`):

```bash
gcloud run deploy photo-frame-helper --source . --region us-central1 --allow-unauthenticated --max-instances 1 --service-account <helper-account> --set-env-vars "ALLOWED_ORIGINS=https://<you>.github.io,FIRESTORE_PROJECT=<project>" --set-secrets "TOKEN_ENCRYPTION_KEY=<key-secret>:latest"
```

`--max-instances 1` keeps the in-memory rate limiter accurate.

### Or self-host on a home device

Any always-on machine works: a Raspberry Pi, an old laptop, a mini PC behind the TV. One process serves the built app and the helper together:

```bash
npm ci
npm run build
npm start
```

Open `http://<that-machine's-LAN-IP>:4000` on the TV. To keep it running across reboots, run it as a systemd service on Linux or a Task Scheduler task on Windows.

---

## 🛡️ Privacy: what leaves your device

Photos and videos stream from Google to your screen and are never stored. The full policy is at [privacy.html](https://padmarajbhat.github.io/gphotos-slideshow/privacy.html).

| Destination | When | What it receives | How to avoid it |
|---|---|---|---|
| `lh3.googleusercontent.com` | Always | Requests for the album's photo and video files | Unavoidable: this is where the media lives |
| Photo helper (Cloud Run) | Sending or playing a shared album | The album link, the screen's random id, the send code. The link is held encrypted only until the screen collects it | Self-host the helper |
| `api.open-meteo.com` | Weather overlay on | Approximate latitude/longitude. No API key | Turn off **Weather** in Settings |
| `freeipapi.com` | Weather on **and** browser geolocation unavailable | Your public IP, to estimate the city | Turn off **Weather**, or allow precise geolocation |
| `nominatim.openstreetmap.org` | A photo carries GPS coordinates | Those coordinates, to resolve a place name | Turn off **Photo info** in Settings |

**Stored on the screen** (`localStorage`): slideshow preferences (`gpicshow_config`), the last three albums played including their shared links (`gpicshow_recent`), and the screen's random id (`gpicshow_session`). Clear the albums under **Settings → Clear recently played**.

**Video troubleshooting** (off by default): with **Settings → Video details** on, each video's playback facts (which version played, its size, frame counts, errors, the browser's name, the screen size) go to the photo service's log. No links, photos or personal details.

**Stored on the server**: send codes (15 minutes) and links waiting to be collected (at most an hour), both encrypted where they hold a link, and deleted from Firestore automatically.

Anyone with a shared-album link can view that album. Use an album made for the frame, and switch link sharing off in Google Photos to revoke it at any time.

---

<details>
<summary><b>Google Photos Ambient API</b>: for partner-program members</summary>

The Ambient API pairs a screen with a Google account through the device-code flow and returns the albums the user picks for it in the Google Photos app. It needs an OAuth client of type *TVs and Limited Input devices*, whose secret only the helper holds.

1. In the Google Cloud Console, enable the **Google Photos Ambient API** and create the OAuth client.
2. Put the credentials in `.env` (see `.env.example`) locally, or as `GOOGLE_CLIENT_ID` and a `GOOGLE_CLIENT_SECRET` secret on Cloud Run.
3. Build the web app with `VITE_AMBIENT_API=true`. The home screen's right-hand panel then offers pairing instead of sending.

Tokens are stored encrypted per screen and removed by **Settings → Disconnect Google Photos**. Google limits the API to 240 requests per device per day; the helper refreshes the media list every 50 minutes, inside the 60-minute expiry of Google's media links.
</details>

---

## 📄 License
Licensed under the [Apache License 2.0](LICENSE).
