import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { importSealedSessionFile } from '../src/lib/sessionStore.ts';
import { isLiveEligible, LIVE_COACH_PATH, LiveCoachingError, liveCoachingMessage, requestLiveCoaching } from '../src/coaching/liveCoaching.ts';
import { createLiveCoachHandler, LIVE_MODEL } from '../server/liveCoaching.ts';
import { LIVE_REPORT_SCHEMA, LIVE_SESSIONS } from '../server/liveCoachingData.ts';

const repo = (path: string) => new URL(`../${path}`, import.meta.url);
const load = async (path: string) => {
  const raw = new Uint8Array(readFileSync(repo(path)));
  return importSealedSessionFile({ name: path.split('/').pop()!, size: raw.length, arrayBuffer: async () => raw.buffer });
};
const saved = JSON.parse(readFileSync(repo('data/f1tenth-silverstone/run-a-nebius-report.json'), 'utf8')) as { reportJson: string };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The real server handler behind a fake provider, so the client is tested against what the function actually returns. */
const serverFetcher = (providerContent = saved.reportJson) => {
  const handler = createLiveCoachHandler({
    env: (name) => ({ LIVE_COACHING_ENABLED: 'true', NEBIUS_API_KEY: 'fixture-credential-never-an-account-key' } as Record<string, string>)[name],
    sessions: LIVE_SESSIONS, schema: LIVE_REPORT_SCHEMA, reserveSlot: async () => true,
    fetcher: async () => json({ id: 'chatcmpl-live-fixture', model: LIVE_MODEL,
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: providerContent } }],
      usage: { prompt_tokens: 1362, completion_tokens: 594, total_tokens: 1956, completion_tokens_details: { reasoning_tokens: 410 } } }),
  });
  const calls: string[] = [];
  return { calls, fetcher: async (url: string, init: RequestInit) => { calls.push(url); return handler(new Request(`https://blurr.example${url}`, init)); } };
};

test('the client posts the session digest and shows only a report that validates against that session', async () => {
  const session = await load('data/f1tenth-silverstone/run-a-session.json');
  assert.equal(isLiveEligible(session), true);
  const { calls, fetcher } = serverFetcher();
  const result = await requestLiveCoaching(session, fetcher);
  assert.deepEqual(calls, [LIVE_COACH_PATH]);
  assert.equal(result.validated.saved.sessionSha256, session.canonicalSha256);
  assert.equal(result.validated.saved.model, LIVE_MODEL);
  assert.ok(result.validated.report.claims.length > 0);
  assert.equal(result.live.requestSha256, LIVE_SESSIONS[session.canonicalSha256].requestSha256);
});

test('a report the session cannot support is refused in the browser too', async () => {
  const session = await load('data/f1tenth-silverstone/run-a-session.json');
  const report = JSON.parse(saved.reportJson) as { claims: { metricId: string }[] };
  report.claims[0].metricId = 'not_a_metric';
  await assert.rejects(requestLiveCoaching(session, serverFetcher(JSON.stringify(report)).fetcher), (error: unknown) => error instanceof LiveCoachingError);
});

test('server refusals and transport failures map to fixed codes and plain messages', async () => {
  const session = await load('data/f1tenth-silverstone/run-a-session.json');
  const cases: [() => Promise<Response>, string][] = [
    [async () => json({ error: 'DAILY_CAP_REACHED' }, 429), 'DAILY_CAP_REACHED'],
    [async () => new Response('Rate limit exceeded', { status: 429 }), 'HTTP_429'],
    [async () => new Response('<!doctype html>', { status: 404 }), 'HTTP_404'],
    [async () => json({ error: 'provider said <script>' }, 502), 'HTTP_502'],
    [async () => { throw new TypeError('network'); }, 'LIVE_UNREACHABLE'],
    [async () => json({ report: null, live: null }), 'LIVE_RESPONSE_INVALID'],
    [async () => new Response('x'.repeat(300 * 1024)), 'LIVE_RESPONSE_INVALID'],
  ];
  for (const [respond, code] of cases) {
    const error = await requestLiveCoaching(session, respond).then(() => null, (e: unknown) => e);
    assert.ok(error instanceof LiveCoachingError);
    assert.equal(error.code, code);
    assert.ok(!liveCoachingMessage(error).includes('<script>'));
  }
  assert.match(liveCoachingMessage(new LiveCoachingError('DAILY_CAP_REACHED')), /00:00 UTC/u);
});

test('an imported capture outside the bundled set never calls the server', async () => {
  const session = await load('data/f1tenth-silverstone/run-a-session.json');
  const other = { ...session, canonicalSha256: 'f'.repeat(64) };
  let called = false;
  assert.equal(isLiveEligible(other), false);
  await assert.rejects(requestLiveCoaching(other, async () => { called = true; return json({}); }), /SESSION_NOT_LIVE_ELIGIBLE/u);
  assert.equal(called, false);
});
