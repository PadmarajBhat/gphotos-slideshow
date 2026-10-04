# LuminaFrame 🖼️✨
> **An Ambient Google Photos Slideshow for Smart TVs & Screens**

[![CI](https://github.com/your-username/google-photos-slideshow/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/google-photos-slideshow/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**LuminaFrame** turns a Smart TV (Sony Android TV / Google TV, Samsung, LG, Fire TV) or any connected display into an ambient digital photo frame powered by your **Google Photos** library.

Built for **elderly ease-of-use**, **10-foot TV ergonomics**, and keeping your photos on your own hardware.

---

## ⚠️ Read this first: how Google Photos access works now

On **31 March 2025 Google removed** the `photoslibrary.readonly` scope. Any app using it now receives `403 PERMISSION_DENIED`. Third-party apps can no longer list a user's albums with the Library API, and **no OAuth configuration can bring that back**.

LuminaFrame therefore uses the **[Google Photos Ambient API](https://developers.google.com/photos/ambient)**, which Google built specifically for shared ambient displays such as TVs and photo frames. It returns photos, videos and motion photos, and it is paginated, so large libraries arrive complete.

The Ambient API requires an OAuth client of type *TVs and Limited Input devices*, which comes with a **client secret**. A browser cannot hold a secret, so LuminaFrame ships a **small helper process** that runs on the same machine as the display. It holds the credential, performs the device-code pairing, and talks to Google. Your photos still stream straight from Google to the screen.

| Source | Setup | Gets | Videos play |
|---|---|---|---|
| **Google Photos (Ambient API)** | Pair once from your phone | Everything you select, complete | ✅ Yes |
| **Shared album link** | Paste a link, nothing to configure | First few hundred photos only | ❌ Thumbnails only |
| **Demo albums** | None | Curated samples | ✅ Yes |

---

## 🌟 Features

- 📺 **Full D-pad navigation** — arrow keys move between albums, OK opens, Back exits. Large type, high-contrast focus rings.
- 📱 **Pair from your phone** — the TV shows a QR code; you approve and pick albums on your phone. Nothing to type on the TV.
- 🖼️ **Full-screen with blur backdrop** — photos that don't match the screen shape are letterboxed against a blurred, downscaled copy of themselves.
- 🎬 **Videos play to completion** before advancing — with error, stall and timeout handling so a broken clip skips instead of freezing the frame.
- 🔀 **Cinematic transitions** — Ken Burns, crossfade, cinematic push, soft scale, or random. Slide duration 5–60s.
- 🕒 **Ambient overlays** — regional clock (top-left), photo details (bottom-left), live weather (bottom-right). Each can be switched off.
- ⚡ **Runs unattended** — tokens refresh silently, and media URLs are renewed inside Google's 60-minute expiry window.
- 💾 **Preferences persist** across reboots.

---

## 🎮 TV Remote & Keyboard

### Album screen
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
| **Escape** / Back / Backspace | Return to albums |
| **F** | Fullscreen |
| **H** | Show / hide overlays |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (CI covers 20 and 22)
- A modern browser

### Install
```bash
npm install
```

### Try it immediately, no setup
```bash
npm run dev
```
Open `http://localhost:3000` and select **Launch Demo Now**. Demo albums and shared-album links work without the helper.

### Build for production
```bash
npm run build
```

---

## 🔑 Connecting your own Google Photos

### 1. Create the Google credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. **APIs & Services → Library** → enable the **Google Photos Ambient API**.
3. **APIs & Services → OAuth consent screen** → fill in the app name and support email, and add your account under **Test users**.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   Application type: **TVs and Limited Input devices**.
5. Copy the **Client ID** and **Client secret**.

### 2. Configure the helper

```bash
cp .env.example .env
```

Then edit `.env`:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

`.env` is gitignored. The secret never reaches the browser.

### 3. Run it

**Development** — two terminals:

```bash
npm run helper
```

```bash
npm run dev
```

Vite proxies `/api/ambient` to the helper on port 4000.

**Production / on the TV box** — one process serves the built app and the API together:

```bash
npm run build
npm start
```

Then open `http://localhost:4000`, or the machine's LAN address from the TV.

### 4. Pair the frame

1. Select **Use My Photos**, then **Pair This Frame**.
2. Scan the QR code with your phone and enter the short code shown on the TV.
3. Scan the second QR code to open this frame's settings in the Google Photos app, and choose which albums it may show.
4. The screen updates by itself. Your albums appear as **Your Google Photos**.

To change albums later, scan the settings QR code again from the dialog. To revoke this machine's access, select **Disconnect This Frame**.

---

## 🌍 Deployment

LuminaFrame deploys in two parts, on purpose.

| | Public site (GitHub Pages) | Home device |
|---|---|---|
| Reachable from | Anywhere, any TV or phone | Devices on your home Wi-Fi |
| Demo + shared-album links | ✅ | ✅ |
| Your Google Photos + videos | ❌ | ✅ |
| Cost | Free | Free on hardware you own |

### ⚠️ Never expose the helper to the internet

The helper has **no login**. It is built for one frame and one Google account. Hosted on a public URL, **anyone who finds that URL would see your photos**. Keep it on your home network. If you want it reachable while away, put it behind something that authenticates first, such as [Tailscale](https://tailscale.com/), rather than opening a port.

### Public site — GitHub Pages

Already wired up in `.github/workflows/deploy-pages.yml`. One-time setup:

1. In your repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`.

Every push to `main` runs the tests, builds, and publishes to `https://<your-username>.github.io/<repo-name>/`. The workflow sets the base path from the repository name automatically, so renaming the repo just works.

On the public site, **Use My Photos** explains that the full library needs the home version, and offers the shared-album link instead.

### Home device

Any always-on machine on your Wi-Fi works: a Raspberry Pi, an old laptop, or a mini PC behind the TV.

```bash
npm ci
npm run build
npm start
```

Then on the TV or phone, open `http://<that-machine's-LAN-IP>:4000`. Find the IP with `ipconfig` (Windows) or `hostname -I` (Linux).

**Keep it running across reboots.** A photo frame that stops after a power cut isn't much of a frame:

<details>
<summary><b>Raspberry Pi / Linux</b> — systemd service</summary>

Create `/etc/systemd/system/luminaframe.service`:

```ini
[Unit]
Description=LuminaFrame
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/home/pi/luminaframe
ExecStart=/usr/bin/npm start
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now luminaframe
```
</details>

<details>
<summary><b>Windows</b> — start on login with Task Scheduler</summary>

1. Open **Task Scheduler → Create Task**.
2. **Triggers → New → At log on**.
3. **Actions → New → Start a program**: `npm`, arguments `start`, start in: your LuminaFrame folder.
4. **Settings**: tick *If the task fails, restart every 1 minute*.
</details>

## 📱 Running on a TV or phone

- **Phone or tablet** — open the site and choose **Add to Home Screen**. It launches full-screen like an app.
- **Android TV / Google TV** (e.g. Sony Bravia) — install a browser such as *Open Browser* or *Puffin TV* from the Play Store, open the address, and use the remote's D-pad.
- **Cast** — open the site on a laptop and cast the tab to the TV.
- **Kiosk** — a Raspberry Pi on HDMI running both the helper and a full-screen browser is the most reliable frame of all.

---

## 🛡️ Privacy: what leaves your device

LuminaFrame has no cloud service. The helper runs on your hardware. Photos stream from Google to your screen and are never stored.

| Destination | When | What it receives | How to avoid it |
|---|---|---|---|
| `oauth2.googleapis.com` | Pairing and token refresh | Your client ID/secret and refresh token | Don't use the Google Photos source |
| `photosambient.googleapis.com` | Google Photos source active | Your access token; returns your selected media | Don't use the Google Photos source |
| `lh3.googleusercontent.com` | Always | Requests for your own photo and video files | Unavoidable — this is where the media lives |
| `api.open-meteo.com` | Weather overlay on | Approximate latitude/longitude. No API key | Turn off **Weather** in Settings |
| `freeipapi.com` | Weather on **and** browser geolocation unavailable | Your public IP, to estimate the city | Turn off **Weather**, or allow precise geolocation |
| `nominatim.openstreetmap.org` | A photo carries GPS coordinates | Those coordinates, to resolve a place name | Turn off **Photo info** in Settings |
| `api.allorigins.win` | Shared-album link on a **hosted** build | The shared album URL | Run locally, where the dev proxy is used instead |

**Never stored:** photos, videos, thumbnails, access tokens. No service worker, no image cache.

**Stored locally:**
- `localStorage` — your slideshow preferences (`luminaframe_config`)
- `server/.tokens.json` — the Google **refresh token** and this frame's device id, written with `0600` permissions so the frame survives a reboot without re-pairing. Gitignored. Delete the file, or select **Disconnect This Frame**, to remove it.

---

## 🧪 Development

```bash
npm run dev       # Vite dev server on :3000
npm run helper    # Ambient helper on :4000
npm run lint      # ESLint
npm test          # Vitest (102 tests)
npm run build     # type check + production bundle
npm run verify    # lint + test + build
```

`tools/spec_drift_check.py` fails when `src/` changes without a matching update under `specs/`. CI runs it on pull requests.

### Notes

- The dev server binds to all interfaces so a TV on the same Wi-Fi can reach it. Its shared-album proxy is restricted to Google Photos hostnames over HTTPS with per-hop redirect revalidation. Don't widen that allowlist or expose the dev server to an untrusted network.
- Google limits the Ambient API to **240 requests per device per day**. The helper refreshes the full media list every 50 minutes, which keeps a 600-item library at roughly 173 requests/day while staying inside the 60-minute `baseUrl` expiry.

---

## 📄 License
MIT — see [LICENSE](LICENSE).
