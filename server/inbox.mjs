import { randomInt } from 'node:crypto';
import { encrypt, decrypt } from './crypto.mjs';
import { assertAllowedTarget } from './sharedAlbum.mjs';

/**
 * Lets a phone hand a shared-album link to a TV, so nothing is typed on the TV.
 *
 * The TV asks for a short code and shows it as a QR. The phone opens that QR,
 * pastes a link and sends it with the code; the TV collects it on its next
 * check-in. Codes are one-time, expire after 15 minutes, and come from a
 * 31-symbol alphabet over 8 characters (about 8.5 x 10^11 possibilities),
 * which, with per-address rate limiting, makes guessing someone's code
 * infeasible within its lifetime.
 */

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const CODE_LENGTH = 8;
export const CODE_TTL_MS = 15 * 60 * 1000;
/** Don't hand out a code with under two minutes left; mint a fresh one. */
const CODE_REUSE_MARGIN_MS = 2 * 60 * 1000;
/** A link the TV hasn't picked up by then is dropped rather than played later. */
export const PENDING_LINK_TTL_MS = 60 * 60 * 1000;
/** Firestore deletes an idle TV's inbox after this; the TV recreates it on demand. */
const INBOX_TTL_MS = 24 * 60 * 60 * 1000;

const INBOXES = 'inboxes';
const CODES = 'sendCodes';

export function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function normaliseCode(raw) {
  const code = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

export function createInbox({ store, encryptionKey, now = () => Date.now() }) {
  return {
    /** A code the TV can show, reused while it is still comfortably valid. */
    async issueCode(sessionId) {
      const inbox = (await store.getDoc(INBOXES, sessionId)) ?? {};
      if (inbox.code && now() < inbox.codeExpiresAt - CODE_REUSE_MARGIN_MS) {
        return { code: inbox.code, expiresAt: new Date(inbox.codeExpiresAt).toISOString() };
      }
      if (inbox.code) await store.deleteDoc(CODES, inbox.code);

      const code = generateCode();
      const codeExpiresAt = now() + CODE_TTL_MS;
      await store.putDoc(CODES, code, { sessionId, expiresAt: codeExpiresAt }, { expireAt: codeExpiresAt });
      await store.putDoc(INBOXES, sessionId, { ...inbox, code, codeExpiresAt }, { expireAt: now() + INBOX_TTL_MS });
      return { code, expiresAt: new Date(codeExpiresAt).toISOString() };
    },

    /** The phone's half: deliver a link to whichever TV owns this code. */
    async deliver(rawCode, rawUrl) {
      const code = normaliseCode(rawCode);
      if (!code) return { ok: false, reason: 'invalid_code' };

      const entry = await store.getDoc(CODES, code);
      if (!entry || now() > entry.expiresAt) {
        if (entry) await store.deleteDoc(CODES, code);
        return { ok: false, reason: 'expired_code' };
      }

      // Same rules the album loader applies; fail before touching the inbox.
      const url = assertAllowedTarget(String(rawUrl ?? '').trim());
      if (url.hostname === 'lh3.googleusercontent.com') throw new Error('Paste the album link, not a photo link.');

      // One-time: the code is spent, and the TV will show a fresh one.
      await store.deleteDoc(CODES, code);
      const inbox = (await store.getDoc(INBOXES, entry.sessionId)) ?? {};
      await store.putDoc(
        INBOXES,
        entry.sessionId,
        {
          ...inbox,
          code: null,
          codeExpiresAt: 0,
          pendingLink: encrypt(url.toString(), encryptionKey),
          deliveredAt: now(),
        },
        { expireAt: now() + INBOX_TTL_MS }
      );
      return { ok: true };
    },

    /** The TV's half: collect a delivered link, once. */
    async collect(sessionId) {
      const inbox = await store.getDoc(INBOXES, sessionId);
      if (!inbox?.pendingLink) return { url: null };
      await store.putDoc(INBOXES, sessionId, { ...inbox, pendingLink: null }, { expireAt: now() + INBOX_TTL_MS });
      if (now() - inbox.deliveredAt > PENDING_LINK_TTL_MS) return { url: null };
      return { url: decrypt(inbox.pendingLink, encryptionKey) };
    },
  };
}
