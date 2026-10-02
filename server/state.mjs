import { config, assertConfigured, refreshConfig } from './env.mjs';
import { loadTokens, saveTokens, clearTokens } from './store.mjs';
import {
  requestDeviceCode,
  pollForToken,
  createTokenProvider,
  revokeToken,
} from './googleAuth.mjs';
import { createDevice, getDevice, listAllMediaItems, MEDIA_REFRESH_MS } from './ambient.mjs';

const DEVICE_POLL_MS = 5000;

/**
 * Owns the whole Ambient lifecycle: pairing, device creation, waiting for the
 * user to choose albums, and keeping the media list fresh. The browser only
 * ever reads a snapshot of this.
 */
export function createAmbientState() {
  const persisted = loadTokens();

  const state = {
    phase: 'disconnected',
    message: null,
    userCode: null,
    verificationUrl: null,
    settingsUri: null,
    mediaSourcesSet: false,
    itemCount: 0,
    lastRefreshedAt: null,
    requestsToday: 0,
  };

  let refreshToken = persisted.refreshToken;
  let deviceId = persisted.deviceId;
  let mediaItems = [];
  let pairingTimer = null;
  let devicePollTimer = null;
  let mediaTimer = null;
  let quotaDay = new Date().toDateString();

  const tokens = createTokenProvider({
    getRefreshToken: () => refreshToken,
    onRefreshFailed: (err) => {
      state.phase = 'disconnected';
      state.message = `${err.message} Pair the frame again.`;
    },
  });

  const configError = assertConfigured();
  if (configError) {
    state.phase = 'unconfigured';
    state.message = configError;
  }

  function countRequest(n = 1) {
    const today = new Date().toDateString();
    if (today !== quotaDay) {
      quotaDay = today;
      state.requestsToday = 0;
    }
    state.requestsToday += n;
  }

  function stopTimers() {
    for (const t of [pairingTimer, devicePollTimer, mediaTimer]) {
      if (t) clearTimeout(t), clearInterval(t);
    }
    pairingTimer = devicePollTimer = mediaTimer = null;
  }

  async function ensureDevice() {
    const accessToken = await tokens.get();
    if (!accessToken) return null;

    if (deviceId) {
      try {
        const device = await getDevice(accessToken, deviceId);
        countRequest();
        return device;
      } catch (err) {
        // A device deleted from the phone has to be recreated.
        if (err.status !== 404) throw err;
        deviceId = null;
      }
    }

    const device = await createDevice(accessToken);
    countRequest();
    deviceId = device.id;
    saveTokens({ refreshToken, deviceId });
    return device;
  }

  function applyDevice(device) {
    state.settingsUri = device.settingsUri;
    state.mediaSourcesSet = device.mediaSourcesSet;

    if (device.mediaSourcesSet) {
      state.phase = 'ready';
      state.message = null;
    } else {
      state.phase = 'awaiting_sources';
      state.message =
        'Choose which albums this frame may show. Open the settings link on your phone.';
    }
  }

  async function refreshMedia() {
    const accessToken = await tokens.get();
    if (!accessToken || !deviceId || !state.mediaSourcesSet) return;

    try {
      const { items, requests } = await listAllMediaItems(accessToken, deviceId);
      countRequest(requests);
      mediaItems = items;
      state.itemCount = items.length;
      state.lastRefreshedAt = new Date().toISOString();
      state.phase = 'ready';
      state.message = items.length === 0 ? 'No photos in the selected albums yet.' : null;
    } catch (err) {
      if (err.googleStatus === 'FAILED_PRECONDITION') {
        state.mediaSourcesSet = false;
        state.phase = 'awaiting_sources';
        state.message = 'No albums are selected for this frame yet.';
        startDevicePolling();
        return;
      }
      state.message = err.message;
      if (mediaItems.length === 0) state.phase = 'error';
    }
  }

  function startMediaRefresh() {
    if (mediaTimer) clearInterval(mediaTimer);
    refreshMedia();
    // baseUrls last 60 minutes; refresh inside that, within the daily budget.
    mediaTimer = setInterval(refreshMedia, MEDIA_REFRESH_MS);
  }

  function startDevicePolling() {
    if (devicePollTimer) clearInterval(devicePollTimer);

    devicePollTimer = setInterval(async () => {
      try {
        const device = await ensureDevice();
        if (!device) return;
        applyDevice(device);

        if (device.mediaSourcesSet) {
          clearInterval(devicePollTimer);
          devicePollTimer = null;
          startMediaRefresh();
        }
      } catch (err) {
        state.message = err.message;
      }
    }, DEVICE_POLL_MS);
  }

  async function beginPairing() {
    if (state.phase === 'unconfigured') return snapshot();

    stopTimers();
    state.phase = 'pairing';
    state.message = null;

    try {
      const code = await requestDeviceCode();
      state.userCode = code.userCode;
      state.verificationUrl = code.verificationUrl;

      const deadline = Date.now() + code.expiresIn * 1000;
      let intervalMs = code.intervalSeconds * 1000;

      const tick = async () => {
        if (Date.now() > deadline) {
          state.phase = 'disconnected';
          state.message = 'The pairing code expired. Select Connect to try again.';
          return;
        }

        const result = await pollForToken(code.deviceCode);

        if (result.status === 'granted') {
          refreshToken = result.refreshToken ?? refreshToken;
          tokens.set(result.accessToken, result.expiresAt);
          saveTokens({ refreshToken, deviceId });
          state.userCode = null;

          try {
            const device = await ensureDevice();
            applyDevice(device);
            if (device.mediaSourcesSet) startMediaRefresh();
            else startDevicePolling();
          } catch (err) {
            state.phase = 'error';
            state.message = err.message;
          }
          return;
        }

        if (result.status === 'slow_down') intervalMs += 5000;

        if (['denied', 'expired', 'error'].includes(result.status)) {
          state.phase = 'disconnected';
          state.message = result.message;
          state.userCode = null;
          return;
        }

        pairingTimer = setTimeout(tick, intervalMs);
      };

      pairingTimer = setTimeout(tick, intervalMs);
    } catch (err) {
      state.phase = 'error';
      state.message = err.message;
    }

    return snapshot();
  }

  async function disconnect() {
    stopTimers();
    const accessToken = await tokens.get().catch(() => null);
    await revokeToken(accessToken || refreshToken);

    refreshToken = null;
    deviceId = null;
    mediaItems = [];
    tokens.clear();
    clearTokens();

    Object.assign(state, {
      phase: assertConfigured() ? 'unconfigured' : 'disconnected',
      message: null,
      userCode: null,
      verificationUrl: null,
      settingsUri: null,
      mediaSourcesSet: false,
      itemCount: 0,
      lastRefreshedAt: null,
    });

    return snapshot();
  }

  function snapshot() {
    // Pick up a .env that was created after the helper started, so adding
    // credentials does not also require restarting the process.
    if (state.phase === 'unconfigured') {
      refreshConfig();
      const stillMissing = assertConfigured();
      if (!stillMissing) {
        state.phase = 'disconnected';
        state.message = null;
        resume();
      } else {
        state.message = stillMissing;
      }
    }
    return { ...state, deviceName: config.deviceName };
  }

  /** Resume a previously paired frame on start-up, with no user interaction. */
  async function resume() {
    if (state.phase === 'unconfigured' || !refreshToken) return;

    try {
      const device = await ensureDevice();
      if (!device) return;
      applyDevice(device);
      if (device.mediaSourcesSet) startMediaRefresh();
      else startDevicePolling();
    } catch (err) {
      state.phase = 'error';
      state.message = err.message;
    }
  }

  return {
    snapshot,
    beginPairing,
    disconnect,
    resume,
    getMedia: () => mediaItems,
    stop: stopTimers,
  };
}
