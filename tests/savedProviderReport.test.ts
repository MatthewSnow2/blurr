import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { importSealedSessionFile, type StorageLike } from '../src/lib/sessionStore.ts';
import { sha256Portable } from '../src/lib/sha256.ts';
import { LocalProviderReportStore, MAX_SAVED_REPORT_BYTES, parseSavedProviderReport, readSavedProviderReportFile } from '../src/coaching/savedProviderReport.ts';

const capture = new Uint8Array(readFileSync(new URL('../fixtures/autodrive-synthetic-session.json', import.meta.url)));
const session = await importSealedSessionFile({ name: 'fixture.json', size: capture.length, arrayBuffer: async () => capture.buffer });
const raw = readFileSync(new URL('../fixtures/autodrive-synthetic-nebius-report.json', import.meta.url), 'utf8');
const fixture = () => JSON.parse(raw);
const hash = (s: string) => sha256Portable(new TextEncoder().encode(s));
const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: k => { data.delete(k); } };
};

test('actual saved provider report revalidates against the matching synthetic capture', () => {
  const parsed = parseSavedProviderReport(raw, session);
  assert.equal(parsed.saved.usage.inputTokens, 1182);
  assert.equal(parsed.saved.usage.outputTokens, 655);
  assert.equal(parsed.report.claims[0].rendered, 'Recorded samples: 2 samples.');
  assert.equal(parsed.report.claims.length, 3);
});

test('default demo pair: Silverstone run A report revalidates against its sealed session', async () => {
  const runA = new Uint8Array(readFileSync(new URL('../data/f1tenth-silverstone/run-a-session.json', import.meta.url)));
  const runASession = await importSealedSessionFile({ name: 'run-a-session.json', size: runA.length, arrayBuffer: async () => runA.buffer });
  const runAReport = readFileSync(new URL('../data/f1tenth-silverstone/run-a-nebius-report.json', import.meta.url), 'utf8');
  const parsed = parseSavedProviderReport(runAReport, runASession);
  assert.equal(runASession.canonicalSha256, '7008865c2a6439e82bf1cf60d8acbfcbaf4d1224fe3922e800b512d4f467ad14');
  assert.equal(runASession.sampleCount, 600);
  assert.equal(parsed.saved.usage.inputTokens, 1362);
  assert.equal(parsed.saved.usage.outputTokens, 594);
  assert.equal(parsed.report.claims.length, 3);
  // The synthetic report must not attach to the run A session.
  assert.throws(() => parseSavedProviderReport(raw, runASession), /SESSION_MISMATCH/u);
});

test('wrong session, altered report bytes and rehashed unsupported claims fail closed', async () => {
  const changedCapture = JSON.parse(new TextDecoder().decode(capture));
  changedCapture.captured_at_utc = '2026-10-14T00:00:00Z';
  const bytes = new TextEncoder().encode(JSON.stringify(changedCapture));
  const other = await importSealedSessionFile({ name: 'other.json', size: bytes.length, arrayBuffer: async () => bytes.buffer });
  assert.throws(() => parseSavedProviderReport(raw, other), /SESSION_MISMATCH/u);
  const changed = fixture(); changed.reportJson += ' ';
  assert.throws(() => parseSavedProviderReport(JSON.stringify(changed), session), /DIGEST_MISMATCH/u);
  const unsupported = fixture(); const report = JSON.parse(unsupported.reportJson);
  report.claims[0].evidence_id = 'invented_speed';
  unsupported.reportJson = JSON.stringify(report); unsupported.reportSha256 = hash(unsupported.reportJson);
  assert.throws(() => parseSavedProviderReport(JSON.stringify(unsupported), session), /CLAIMS_UNSUPPORTED/u);
});

test('bad usage, malformed metadata and oversized imports are rejected before storage', async () => {
  for (const mutate of [
    (r: ReturnType<typeof fixture>) => { r.usage.totalTokens++; },
    (r: ReturnType<typeof fixture>) => { r.usage.reasoningTokens = 656; },
    (r: ReturnType<typeof fixture>) => { r.model = 'other/model'; },
    (r: ReturnType<typeof fixture>) => { r.completedAtUtc = '2026-99-99T00:00:00Z'; },
    (r: ReturnType<typeof fixture>) => { r.telemetryKind = 'live_physical_robot'; },
  ]) { const r = fixture(); mutate(r); assert.throws(() => parseSavedProviderReport(JSON.stringify(r), session), /REPORT_/u); }
  let reads = 0;
  await assert.rejects(readSavedProviderReportFile({ size: MAX_SAVED_REPORT_BYTES + 1, text: async () => { reads++; return raw; } }, session), /TOO_LARGE/u);
  assert.equal(reads, 0);
  assert.throws(() => parseSavedProviderReport(' '.repeat(MAX_SAVED_REPORT_BYTES + 1), session), /TOO_LARGE/u);
  assert.throws(() => parseSavedProviderReport('{broken', session), /FILE_INVALID/u);
});

test('history reload revalidates; invalid imports preserve the previous saved report and unknown metadata is discarded', () => {
  const storage = memory(), store = new LocalProviderReportStore(storage);
  assert.equal(store.read(session), null);
  const extra = { ...fixture(), unneededPrivateMetadata: 'discard-me' };
  store.save(JSON.stringify(extra), session);
  const snapshot = [...storage.data.entries()];
  assert.ok(!snapshot[0][1].includes('discard-me'));
  assert.equal(new LocalProviderReportStore(storage).read(session)?.report.claims.length, 3);
  assert.throws(() => store.save('{}', session));
  assert.deepEqual([...storage.data.entries()], snapshot);
  storage.data.set(snapshot[0][0], '{broken');
  assert.throws(() => new LocalProviderReportStore(storage).read(session), /FILE_INVALID/u);
});

test('changing cached evidence with the original digest cannot rebind an archived report', () => {
  assert.throws(() => parseSavedProviderReport(raw, { ...session, durationS: 999 }), /SESSION_INTEGRITY_INVALID/u);
  const samples = session.samples.map(s => ({ ...s })); samples[0].poseXM = 999;
  assert.throws(() => parseSavedProviderReport(raw, { ...session, samples }), /SESSION_INTEGRITY_INVALID/u);
});
