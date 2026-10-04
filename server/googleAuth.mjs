import { config } from './env.mjs';

const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export const AMBIENT_SCOPE = 'profile https://www.googleapis.com/auth/photosambient.mediaitems';


async function postForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  return { ok: res.ok, status: res.status, body };
}

/**
 * Step 1 of the device flow: ask Google for a short code the TV can display.
 */
export async function requestDeviceCode() {
  const { ok, body } = await postForm(DEVICE_CODE_URL, {
    client_id: config.clientId,
    scope: AMBIENT_SCOPE,
  });

  if (!ok) {
    const detail = body.error_description || body.error || 'unknown error';
    throw new Error(
      `Google refused the device-code request (${detail}). ` +
      'Confirm the OAuth client is of type "TVs and Limited Input devices".'
    );
  }

  return {
    deviceCode: body.device_code,
    userCode: body.user_code,
    verificationUrl: body.verification_url || body.verification_uri,
    expiresIn: body.expires_in,
    intervalSeconds: body.interval || 5,
  };
}

/**
 * Step 2: exchange the device code once the user has approved on their phone.
 * Returns null while still pending so the caller can keep polling.
 */
export async function pollForToken(deviceCode) {
  const { ok, body } = await postForm(TOKEN_URL, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });

  if (ok) {
    return {
      status: 'granted',
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
  }

  switch (body.error) {
    case 'authorization_pending':
      return { status: 'pending' };
    case 'slow_down':
      return { status: 'slow_down' };
    case 'access_denied':
      return { status: 'denied', message: 'Access was declined on the phone.' };
    case 'expired_token':
      return { status: 'expired', message: 'The pairing code expired. Start again.' };
    default:
      return {
        status: 'error',
        message: body.error_description || body.error || 'Token exchange failed.',
      };
  }
}

export async function refreshAccessToken(refreshToken) {
  const { ok, body } = await postForm(TOKEN_URL, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  if (!ok) {
    const detail = body.error_description || body.error || 'unknown error';
    throw new Error(`Could not refresh the Google token (${detail}).`);
  }

  return {
    accessToken: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
}

export async function revokeToken(token) {
  if (!token) return;
  try {
    await postForm(REVOKE_URL, { token });
  } catch {
    // Best effort: the local copy is dropped regardless.
  }
}
