# Publishing to production: Google OAuth verification

Everything needed to move the Google Cloud project `gphotos-slideshow-510611` out of
**Testing** mode. Values are ready to paste.

Console: [Google Auth Platform](https://console.cloud.google.com/auth/overview?project=gphotos-slideshow-510611)

---

## 0. Right now: add yourself as a test user

**Audience → Test users → + Add users** → `padmarajbhat@gmail.com` → Save.

While in Testing mode, only listed accounts can pair, and Google ends each approval after
7 days (the frame then shows a fresh QR by itself).

---

## 1. Branding

**Branding** page:

| Field | Value |
|---|---|
| App name | `Your Photo Frame` |
| User support email | `padmarajbhat@gmail.com` |
| App logo | [`public/logo-120.png`](../public/logo-120.png) (120×120 PNG) |
| Application home page | `https://padmarajbhat.github.io/gphotos-slideshow/` |
| Application privacy policy link | `https://padmarajbhat.github.io/gphotos-slideshow/privacy.html` |
| Application terms of service link | `https://padmarajbhat.github.io/gphotos-slideshow/terms.html` |
| Authorized domains | `padmarajbhat.github.io` |
| Developer contact information | `padmarajbhat@gmail.com` |

Uploading a logo means Google must verify the branding before it is shown, which is
needed anyway for production.

---

## 2. Prove you own the domain

Google only accepts an authorized domain that you have verified in
[Google Search Console](https://search.google.com/search-console).

`padmarajbhat.github.io` is its own domain (github.io is on the Public Suffix List), but
the app lives under `/gphotos-slideshow/`, while Search Console needs its verification
file at the **root**: `https://padmarajbhat.github.io/google….html`. A project repository
can't serve the root. The free way to do that is a GitHub *user site*:

1. Create a public repository named exactly **`PadmarajBhat.github.io`**.
2. In Search Console: **Add property → URL prefix** → `https://padmarajbhat.github.io/`
   → choose **HTML file**, download the `google….html` file.
3. Commit that file to the root of the `PadmarajBhat.github.io` repository and enable
   Pages for it (Settings → Pages → Deploy from branch → `main` / root).
4. Back in Search Console, click **Verify**.

Use the same Google account for Search Console as the one that owns the Cloud project.

---

## 3. Data access

**Data access** page → **Add or remove scopes**. The app requests:

| Scope | Why |
|---|---|
| `https://www.googleapis.com/auth/photosambient.mediaitems` | List and display the media the user selected for the frame |
| `profile` | Part of Google's sign-in for TV and limited-input devices; not stored or used |

Check how the console classifies `photosambient.mediaitems`. It sorts scopes into
**non-sensitive**, **sensitive** and **restricted**. Sensitive needs the review below.
Restricted additionally needs a paid third-party security assessment (CASA); if it's
listed as restricted, stop and reconsider before submitting.

**Scope justification** (paste into the form):

> Your Photo Frame is an ambient photo-frame app for TVs and other shared displays. The
> photosambient.mediaitems scope lets the app retrieve only the photos and videos in the
> albums the user explicitly selects for their frame in the Google Photos app, so it can
> show them full-screen as a slideshow on that screen. The app does not access any other
> Google data, does not store photo or video files (they stream directly from Google to
> the screen), and uses the data for no purpose other than displaying it to the user who
> connected the frame. Users can disconnect in Settings, which revokes access and deletes
> stored data; records for screens unused for 90 days are deleted automatically.

---

## 4. Demo video

Upload to YouTube as **Unlisted**, 2–4 minutes, English. Reviewers reject videos that
skip the consent screen or don't show the client ID.

1. Open `https://padmarajbhat.github.io/gphotos-slideshow/`. Show the app name and logo
   matching the consent screen, and the **Privacy** link in the footer.
2. Show the QR code and pairing code on the screen.
3. On a phone (screen recording) or a second browser: open `google.com/device`, enter
   the code, sign in.
4. **Pause on the consent screen.** Show the app name, the requested permission, and the
   address bar including `client_id=127793539988-…` (tap the address bar to reveal it).
5. Approve. Show the second QR, open Google Photos' frame settings, pick an album.
6. Back on the screen: the slideshow plays your photos, then a video plays to the end.
7. Open **Settings → Disconnect Google Photos**, and show the frame return to the QR.

---

## 5. Publish and submit

1. **Audience → Publish app** → status becomes *In production*.
2. On the **Verification centre**, submit for verification with the justification and
   the video link.

Until Google approves, the consent screen shows *"Google hasn't verified this app"*
(users choose **Advanced → Go to Your Photo Frame**), and new sign-ins are capped at 100
users. **Approvals no longer expire after 7 days once the app is in production**, so the
frame stops asking for a weekly re-scan even before verification completes.

Review typically takes from a few days to several weeks; Google may email follow-up
questions to the developer contact.
