import { HAS_HELPER, HELPER_URL, getFrameSession } from './ambient';

/**
 * Sends one video's troubleshooting record to the photo service's log. Only
 * used while Settings → "Video details" is on; numbers and short words only,
 * never a link. Failures are ignored: troubleshooting must not disturb the
 * slideshow.
 */
export function sendVideoReport(report: Record<string, unknown>): void {
  if (!HAS_HELPER) return;
  fetch(`${HELPER_URL}/api/video-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Frame-Session': getFrameSession() },
    body: JSON.stringify(report),
  }).catch(() => {});
}
