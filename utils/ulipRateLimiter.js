/**
 * ULIP API Rate Limiter
 *
 * Enforces a max of ULIP_RATE_LIMIT_PER_SECOND calls per second across
 * ALL ULIP API calls in the process (RTO + Challan, batch + on-demand).
 *
 * Uses a slot-pool algorithm: N slots, each reusable after 1000ms.
 * Node.js is single-threaded so the slot read+write is atomic between await points.
 */
require('dotenv').config();

const MAX_PER_SECOND = parseInt(process.env.ULIP_RATE_LIMIT_PER_SECOND, 10) || 8;

// Each slot holds the earliest timestamp at which it may be reused.
// Initialised to 0 so all slots are immediately available on startup.
const slots = Array(MAX_PER_SECOND).fill(0);

/**
 * Acquire a rate-limit slot before making a ULIP API call.
 * Waits until a slot is free within the per-second budget then
 * reserves it for the next 1000 ms.
 */
async function acquireSlot() {
  // Find the slot with the earliest available time (atomic in JS event loop)
  let minIdx = 0;
  for (let i = 1; i < slots.length; i++) {
    if (slots[i] < slots[minIdx]) minIdx = i;
  }

  const now = Date.now();
  const availableAt = slots[minIdx];
  const waitMs = Math.max(0, availableAt - now);

  // Reserve the slot: mark it busy for the next 1000 ms from when it fires
  slots[minIdx] = Math.max(now, availableAt) + 1000;

  if (waitMs > 0) {
    console.log(`[ULIP RateLimit] slot=${minIdx} waiting ${waitMs}ms (limit=${MAX_PER_SECOND}/s)`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}

module.exports = { acquireSlot, MAX_PER_SECOND };
