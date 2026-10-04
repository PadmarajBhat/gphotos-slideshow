import { requestDeviceCode, pollForToken, refreshAccessToken, revokeToken } from './googleAuth.mjs';
import {
  createDevice,
  getDevice,
  listAllMediaItems,
  MEDIA_REFRESH_MS,
  DAILY_REQUEST_BUDGET,
} from './ambient.mjs';
import { encrypt, decrypt } from './crypto.mjs';

/**
 * One pairing per TV, keyed by a hash of a secret the TV generated itself.
 *
 * Nothing runs in the background: Cloud Run sleeps between requests, so all
 * progress (checking whether the phone approved, whether albums were picked,
 * whether media URLs need renewing) happens when the TV checks in.
 */

const ACCESS_MARGIN_MS = 5 * 60 * 1000;
const PAIRING_REUSE_MARGIN_MS = 60 * 1000;
const MIN_DEVICE_CHECK_MS = 10 * 1000;
/** Leave headroom under Google's 240/day so a pairing check is never refused. */
const QUOTA_HEADROOM = 10;

const fresh = () => ({ phase: 'disconnected', message: null });

function utcDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function parseSeconds(duration) {
  const seconds = parseFloat(String(duration ?? ''));
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
}

export function createSessionService({
  store,
  encryptionKey,
  configError = () => null,
  now = () => Date.now(),
}) {
  /** Serialise work per TV, so a status poll and a connect can't interleave. */
  const locks = new Map();
  function withLock(id, fn) {
    const run = (locks.get(id) ?? Promise.resolve()).then(fn, fn);
    const tail = run.catch(() => {});
    locks.set(id, tail);
    tail.then(() => {
      if (locks.get(id) === tail) locks.delete(id);
    });
    return run;
  }

  const seal = (value) => encrypt(value, encryptionKey);
  const open = (value) => decrypt(value, encryptionKey);

  function countRequests(rec, n) {
    const today = utcDay(now());
    if (rec.quotaDay !== today) {
      rec.quotaDay = today;
      rec.requestsToday = 0;
    }
    rec.requestsToday = (rec.requestsToday ?? 0) + n;
  }

  function overBudget(rec) {
    return rec.quotaDay === utcDay(now()) && (rec.requestsToday ?? 0) >= DAILY_REQUEST_BUDGET - QUOTA_HEADROOM;
  }

  function snapshot(rec) {
    return {
      phase: rec.phase,
      message: rec.message ?? null,
      userCode: rec.phase === 'pairing' ? rec.userCode ?? null : null,
      verificationUrl: rec.phase === 'pairing' ? rec.verificationUrl ?? null : null,
      settingsUri: rec.settingsUri ?? null,
      mediaSourcesSet: Boolean(rec.mediaSourcesSet),
      itemCount: rec.itemCount ?? 0,
      lastRefreshedAt: rec.mediaRefreshedAt ? new Date(rec.mediaRefreshedAt).toISOString() : null,
      requestsToday: rec.quotaDay === utcDay(now()) ? rec.requestsToday ?? 0 : 0,
      deviceName: 'Photo Frame',
    };
  }

  function unconfigured(message) {
    return { ...snapshot(fresh()), phase: 'unconfigured', message };
  }

  /** Drop everything tied to Google, e.g. when an approval is revoked. */
  function signedOut(message) {
    return { ...fresh(), message };
  }

  async function accessToken(rec) {
    if (rec.accessToken && now() < rec.accessExpiresAt - ACCESS_MARGIN_MS) {
      return { rec, token: open(rec.accessToken) };
    }
    if (!rec.refreshToken) return { rec: signedOut(null), token: null };
    try {
      const fresher = await refreshAccessToken(open(rec.refreshToken));
      return {
        rec: { ...rec, accessToken: seal(fresher.accessToken), accessExpiresAt: fresher.expiresAt },
        token: fresher.accessToken,
      };
    } catch {
      // Revoked from the Google account, or expired (7 days while the OAuth
      // app is in Testing mode). The TV shows a fresh QR.
      return { rec: signedOut('Google access ended. Scan the code to connect again.'), token: null };
    }
  }

  function applyDevice(rec, device) {
    const interval = Math.max(MIN_DEVICE_CHECK_MS, parseSeconds(device.pollingConfig?.pollInterval));
    return {
      ...rec,
      deviceId: device.id,
      settingsUri: device.settingsUri,
      mediaSourcesSet: device.mediaSourcesSet,
      phase: device.mediaSourcesSet ? 'ready' : 'awaiting_sources',
      message: null,
      nextDeviceCheckAt: now() + interval,
    };
  }

  async function ensureDevice(rec, token) {
    if (rec.deviceId) {
      try {
        const device = await getDevice(token, rec.deviceId);
        countRequests(rec, 1);
        return applyDevice(rec, device);
      } catch (err) {
        countRequests(rec, 1);
        if (err.status !== 404) throw err;
        // Deleted from the phone: make a new one below.
      }
    }
    const device = await createDevice(token);
    countRequests(rec, 1);
    return applyDevice(rec, device);
  }

  /** Move a TV's pairing forward as far as Google allows right now. */
  async function advance(rec) {
    if (rec.phase === 'pairing') {
      if (!rec.deviceCode || now() > rec.pairingExpiresAt) {
        return { ...fresh(), message: null };
      }
      if (now() < rec.nextTokenPollAt) return rec;

      const result = await pollForToken(open(rec.deviceCode));
      if (result.status === 'pending') return { ...rec, nextTokenPollAt: now() + rec.pollIntervalMs };
      if (result.status === 'slow_down') {
        const pollIntervalMs = rec.pollIntervalMs + 5000;
        return { ...rec, pollIntervalMs, nextTokenPollAt: now() + pollIntervalMs };
      }
      if (result.status !== 'granted') return { ...fresh(), message: result.message ?? null };

      const paired = {
        phase: 'awaiting_sources',
        message: null,
        refreshToken: seal(result.refreshToken),
        accessToken: seal(result.accessToken),
        accessExpiresAt: result.expiresAt,
        quotaDay: rec.quotaDay,
        requestsToday: rec.requestsToday,
      };
      try {
        return await ensureDevice(paired, result.accessToken);
      } catch (err) {
        return { ...paired, phase: 'error', message: err.message };
      }
    }

    if (rec.phase === 'awaiting_sources') {
      if (now() < (rec.nextDeviceCheckAt ?? 0) || overBudget(rec)) return rec;
      const { rec: withToken, token } = await accessToken(rec);
      if (!token) return withToken;
      try {
        return await ensureDevice(withToken, token);
      } catch (err) {
        return { ...withToken, message: err.message, nextDeviceCheckAt: now() + MIN_DEVICE_CHECK_MS };
      }
    }

    return rec;
  }

  async function load(id) {
    return (await store.getSession(id)) ?? fresh();
  }

  async function saveIfChanged(id, before, after) {
    if (JSON.stringify(before) !== JSON.stringify(after)) await store.putSession(id, after);
  }

  return {
    status(id) {
      const problem = configError();
      if (problem) return Promise.resolve(unconfigured(problem));
      return withLock(id, async () => {
        const before = await load(id);
        const after = await advance(before);
        await saveIfChanged(id, before, after);
        return snapshot(after);
      });
    },

    connect(id) {
      const problem = configError();
      if (problem) return Promise.resolve(unconfigured(problem));
      return withLock(id, async () => {
        const rec = await load(id);
        if (rec.phase === 'ready' || rec.phase === 'awaiting_sources') return snapshot(rec);
        // Reuse a live code: the home screen asks automatically, and a new
        // code would invalidate the one already on the TV.
        if (rec.phase === 'pairing' && rec.userCode && now() < rec.pairingExpiresAt - PAIRING_REUSE_MARGIN_MS) {
          return snapshot(rec);
        }

        let next;
        try {
          const code = await requestDeviceCode();
          next = {
            phase: 'pairing',
            message: null,
            deviceCode: seal(code.deviceCode),
            userCode: code.userCode,
            verificationUrl: code.verificationUrl,
            pairingExpiresAt: now() + code.expiresIn * 1000,
            pollIntervalMs: code.intervalSeconds * 1000,
            nextTokenPollAt: now() + code.intervalSeconds * 1000,
            quotaDay: rec.quotaDay,
            requestsToday: rec.requestsToday,
          };
        } catch (err) {
          next = { ...fresh(), phase: 'error', message: err.message };
        }
        await store.putSession(id, next);
        return snapshot(next);
      });
    },

    media(id) {
      return withLock(id, async () => {
        const rec = await load(id);
        if (rec.phase !== 'ready') return { items: [], phase: rec.phase, lastRefreshedAt: null };

        const cached = await store.getMedia(id);
        const isFresh = cached && now() - cached.refreshedAt < MEDIA_REFRESH_MS;
        if (isFresh || (cached && overBudget(rec))) {
          return { items: cached.items, phase: 'ready', lastRefreshedAt: new Date(cached.refreshedAt).toISOString() };
        }

        const { rec: withToken, token } = await accessToken(rec);
        if (!token) {
          await store.putSession(id, withToken);
          await store.deleteMedia(id);
          return { items: [], phase: withToken.phase, lastRefreshedAt: null };
        }

        try {
          const { items, requests } = await listAllMediaItems(token, withToken.deviceId);
          const refreshedAt = now();
          countRequests(withToken, requests);
          const updated = { ...withToken, itemCount: items.length, mediaRefreshedAt: refreshedAt, message: null };
          await store.putMedia(id, { refreshedAt, items });
          await store.putSession(id, updated);
          return { items, phase: 'ready', lastRefreshedAt: new Date(refreshedAt).toISOString() };
        } catch (err) {
          if (err.googleStatus === 'FAILED_PRECONDITION') {
            // Albums were deselected on the phone.
            const updated = { ...withToken, phase: 'awaiting_sources', mediaSourcesSet: false, nextDeviceCheckAt: 0 };
            await store.putSession(id, updated);
            return { items: [], phase: 'awaiting_sources', lastRefreshedAt: null };
          }
          await store.putSession(id, { ...withToken, message: err.message });
          return cached
            ? { items: cached.items, phase: 'ready', lastRefreshedAt: new Date(cached.refreshedAt).toISOString() }
            : { items: [], phase: 'ready', lastRefreshedAt: null };
        }
      });
    },

    disconnect(id) {
      return withLock(id, async () => {
        const rec = await store.getSession(id);
        if (rec?.refreshToken) {
          try {
            await revokeToken(open(rec.refreshToken));
          } catch {
            // Best effort: the stored copy is deleted regardless.
          }
        }
        await store.deleteMedia(id);
        await store.deleteSession(id);
        const problem = configError();
        return problem ? unconfigured(problem) : snapshot(fresh());
      });
    },
  };
}
