/** Writes server/liveCoachingData.ts and src/coaching/liveEligibleSessions.ts. */
import { writeFileSync } from 'node:fs';
import { renderLiveCoachingData } from './liveCoachingData.ts';

const { server, client } = await renderLiveCoachingData();
writeFileSync(new URL('../server/liveCoachingData.ts', import.meta.url), server);
writeFileSync(new URL('../src/coaching/liveEligibleSessions.ts', import.meta.url), client);
console.log('LIVE_COACHING_DATA_WRITTEN');
