import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileAttemptJournal } from '../server/attemptJournal.ts';
import { createBoundedNebiusExchange } from '../server/nebiusHttpExchange.ts';
import type { NebiusChatRequest } from '../server/nebiusAdapter.ts';

const endpoint = 'https://api.tokenfactory.us-central1.nebius.com/v1/chat/completions';
const body = (): NebiusChatRequest => ({ model: 'nvidia/synthetic-offline-fixture', max_tokens: 64,
  temperature: 0, stream: false, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: 'synthetic only' }] });
const jsonResponse = () => new Response('{"fixture":true}', { headers: { 'content-type': 'application/json', 'x-request-id': 'fixture-http-id' } });
const fixtureKey = 'fixture-credential-never-an-account-key';
const directory = () => mkdtempSync(join(tmpdir(), 'blurr-http-fixture-'));

test('injected HTTP exchange is bounded, redirected-denied, journaled and explicitly unverified', async () => {
  const root = directory();
  try {
    const transport = createBoundedNebiusExchange({ attempts: new FileAttemptJournal(root), credential: () => fixtureKey,
      fetcher: async (url, init) => { assert.equal(url, endpoint); assert.equal(init.method, 'POST');
        assert.equal(init.redirect, 'error'); assert.ok(init.signal); assert.equal((init.headers as Record<string, string>).Authorization, `Bearer ${fixtureKey}`);
        return jsonResponse(); } });
    assert.deepEqual(await transport.exchange(endpoint, body()), { fixture: true });
    assert.equal(transport.observation()?.sponsorRuntimeVerified, false);
    assert.equal(transport.observation()?.requestId, 'fixture-http-id');
    const contents = readFileSync(join(root, readdirSync(root)[0]), 'utf8');
    assert.equal(JSON.parse(contents).state, 'response_received');
    assert.ok(!contents.includes(fixtureKey)); assert.ok(!contents.includes('synthetic only'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the same request cannot be sent again after restart, success, or an uncertain failure', async () => {
  const root = directory(); let calls = 0;
  const options = { attempts: new FileAttemptJournal(root), credential: () => fixtureKey,
    fetcher: async () => { calls++; return jsonResponse(); } };
  try {
    await createBoundedNebiusExchange(options).exchange(endpoint, body());
    const restarted = createBoundedNebiusExchange({ ...options, attempts: new FileAttemptJournal(root) });
    await assert.rejects(restarted.exchange(endpoint, body()), /DUPLICATE_ATTEMPT_BLOCKED/u);
    assert.equal(calls, 1);
    const changed = { ...body(), max_tokens: 65 };
    const failing = createBoundedNebiusExchange({ ...options, fetcher: async () => { calls++; throw new Error('network failed'); } });
    await assert.rejects(failing.exchange(endpoint, changed), /DELIVERY_UNKNOWN/u);
    await assert.rejects(restarted.exchange(endpoint, changed), /DUPLICATE_ATTEMPT_BLOCKED/u);
    assert.equal(calls, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a reserved request remains blocked after a simulated crash', () => {
  const root = directory(); const key = 'a'.repeat(64);
  try {
    new FileAttemptJournal(root).reserve(key);
    assert.throws(() => new FileAttemptJournal(root).reserve(key), /DUPLICATE_ATTEMPT_BLOCKED/u);
    assert.throws(() => new FileAttemptJournal(root).reserve('../escape'), /ATTEMPT_KEY_INVALID/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('endpoint substitution is rejected before credential access or any fetch', async () => {
  const root = directory(); let credentials = 0, calls = 0;
  try {
    const transport = createBoundedNebiusExchange({ attempts: new FileAttemptJournal(root),
      credential: () => { credentials++; return fixtureKey; }, fetcher: async () => { calls++; return jsonResponse(); } });
    await assert.rejects(transport.exchange('https://evil.example/v1/chat/completions', body()), /ENDPOINT_NOT_ALLOWED/u);
    assert.equal(credentials, 0); assert.equal(calls, 0); assert.deepEqual(readdirSync(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('oversized stream is cancelled before JSON parse, even with a false small content length', async () => {
  const root = directory(); let cancelled = false;
  try {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode('x'.repeat(50))); }, cancel() { cancelled = true; } });
    const transport = createBoundedNebiusExchange({ attempts: new FileAttemptJournal(root), credential: () => fixtureKey,
      maxResponseBytes: 20, fetcher: async () => new Response(stream, { headers: { 'content-type': 'application/json', 'content-length': '1' } }) });
    await assert.rejects(transport.exchange(endpoint, body()), /RESPONSE_TOO_LARGE/u);
    assert.equal(cancelled, true); assert.equal(transport.observation()?.responseBytes, 50);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('stalled response stream aborts by deadline and cannot trigger an automatic retry', async () => {
  const root = directory(); let calls = 0, aborted = false;
  try {
    const transport = createBoundedNebiusExchange({ attempts: new FileAttemptJournal(root), credential: () => fixtureKey,
      timeoutMs: 15, fetcher: async (_url, init) => { calls++; init.signal?.addEventListener('abort', () => { aborted = true; });
        return new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } }); } });
    await assert.rejects(transport.exchange(endpoint, body()), /PROVIDER_TIMEOUT/u);
    assert.equal(aborted, true); assert.equal(calls, 1);
    await assert.rejects(transport.exchange(endpoint, body()), /DUPLICATE_ATTEMPT_BLOCKED/u);
    assert.equal(calls, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('HTTP errors cancel bodies without reading or exposing arbitrary response/credential text', async () => {
  const root = directory(); let cancelled = false;
  try {
    const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
    const transport = createBoundedNebiusExchange({ attempts: new FileAttemptJournal(root), credential: () => fixtureKey,
      fetcher: async () => new Response(stream, { status: 401, headers: { 'content-type': 'text/plain', 'x-request-id': fixtureKey } }) });
    await assert.rejects(transport.exchange(endpoint, body()), (error: Error) => error.message === 'PROVIDER_HTTP_ERROR' && !error.message.includes(fixtureKey));
    assert.equal(cancelled, true); assert.equal(transport.observation()?.requestId, null);
    assert.equal(transport.observation()?.outcome, 'http_error');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('redirected responses and invalid UTF-8 fail closed without revealing error text', async () => {
  for (const kind of ['redirect', 'utf8']) {
    const root = directory();
    try {
      const response = kind === 'utf8' ? new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } }) : jsonResponse();
      if (kind === 'redirect') Object.defineProperty(response, 'redirected', { value: true });
      const transport = createBoundedNebiusExchange({ attempts: new FileAttemptJournal(root), credential: () => fixtureKey, fetcher: async () => response });
      await assert.rejects(transport.exchange(endpoint, body()), /PROVIDER_(?:REDIRECT_REJECTED|RESPONSE_NOT_JSON)/u);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});
