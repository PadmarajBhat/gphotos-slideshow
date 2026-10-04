import type { IncomingMessage, ServerResponse } from 'node:http';

/** Throws unless the URL is https and on the Google Photos host allowlist. */
export function assertAllowedTarget(rawUrl: string): URL;

/** Fetches album HTML, re-validating every redirect hop against the allowlist. */
export function fetchAlbumHtml(
  target: URL,
  options?: { fetchImpl?: typeof fetch }
): Promise<string>;

/** Node http handler for GET /api/fetch-shared-album?url=... */
export function handleSharedAlbumRequest(req: IncomingMessage, res: ServerResponse): Promise<void>;
