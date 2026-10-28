/** POST /api/live-coach: live Nemotron coaching on Nebius Token Factory for a bundled session. */
import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { createLiveCoachHandler } from '../../server/liveCoaching.ts';
import { reserveDailySlot, type CapStore } from '../../server/liveCoachCap.ts';
import { LIVE_REPORT_SCHEMA, LIVE_SESSIONS } from '../../server/liveCoachingData.ts';

// Site-wide store: one cap shared by production, deploy previews and drafts.
const capStore = (): CapStore => {
  const store = getStore({ name: 'live-coach-cap', consistency: 'strong' });
  return {
    list: async (prefix) => (await store.list({ prefix })).blobs.map((blob) => blob.key),
    createIfNew: async (key, value) => (await store.set(key, value, { onlyIfNew: true })).modified,
    read: (key) => store.get(key, { consistency: 'strong', type: 'text' }),
  };
};

export default createLiveCoachHandler({
  env: (name) => Netlify.env.get(name),
  sessions: LIVE_SESSIONS,
  schema: LIVE_REPORT_SCHEMA,
  reserveSlot: (utcDate, cap) => reserveDailySlot(capStore(), utcDate, cap, crypto.randomUUID()),
  fetcher: (url, init) => fetch(url, init),
});

export const config: Config = {
  path: '/api/live-coach',
  method: 'POST',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip', 'domain'], windowSize: 60, windowLimit: 3 },
};
