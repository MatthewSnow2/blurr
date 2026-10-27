import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadRecordedDemo, recordedDemoMessage, RecordedDemoError } from '../src/demo/recordedDemo.ts';
import { defaultDemoPair, labelForSession, parseDatasetManifest } from '../src/demo/datasets.ts';
import { importSealedSessionFile } from '../src/lib/sessionStore.ts';

const repo = (path: string) => new URL(`../${path}`, import.meta.url);
const manifest = parseDatasetManifest(readFileSync(repo('fixtures/provenance.json'), 'utf8'));
const { session: demoSession, report: demoReport } = defaultDemoPair(manifest);
const served = (files: Record<string, string>) => async (url: string) => {
  const path = files[url];
  const bytes = path ? new Uint8Array(readFileSync(repo(path))) : null;
  return { ok: bytes !== null, status: bytes ? 200 : 404,
    arrayBuffer: async () => bytes!.buffer.slice(bytes!.byteOffset, bytes!.byteOffset + bytes!.byteLength),
    text: async () => new TextDecoder().decode(bytes!) };
};
const demoFiles = { '/capture': demoSession.path, '/report': demoReport.path };

test('manifest hashes match the bundled files on disk', () => {
  for (const entry of manifest) {
    assert.equal(createHash('sha256').update(readFileSync(repo(entry.path))).digest('hex'), entry.sha256, entry.path);
  }
});

test('manifest default demo is run A and the app loads exactly those files', () => {
  assert.equal(demoSession.path, 'data/f1tenth-silverstone/run-a-session.json');
  assert.equal(demoReport.path, 'data/f1tenth-silverstone/run-a-nebius-report.json');
  // LocalApp imports the files via Vite ?url, which node cannot resolve; check the import paths instead.
  const app = readFileSync(repo('src/LocalApp.tsx'), 'utf8');
  assert.ok(app.includes(`'../${demoSession.path}?url&no-inline'`));
  assert.ok(app.includes(`'../${demoReport.path}?url&no-inline'`));
});

test('default demo loads, binds the report and is labeled as the recorded capture', async () => {
  const { session, validated } = await loadRecordedDemo(served(demoFiles), '/capture', '/report', 'run-a-session.json');
  assert.equal(session.canonicalSha256, demoSession.session_canonical_sha256);
  assert.equal(session.sampleCount, 600);
  assert.equal(validated.saved.responseId, 'chatcmpl-5516fe22d301bbadc21c6ab2002aec0f');
  const label = labelForSession(manifest, session.canonicalSha256);
  assert.equal(label.datasetClass, 'recorded_simulator_capture');
  assert.match(label.distribution ?? '', /GPL-3\.0/u);
});

test('missing capture or report fails with a specific error and no session', async () => {
  await assert.rejects(loadRecordedDemo(served({ '/report': demoReport.path }), '/capture', '/report', 'run-a-session.json'),
    (e: unknown) => e instanceof RecordedDemoError && e.code === 'DEMO_CAPTURE_MISSING' && e.detail === 'HTTP 404');
  await assert.rejects(loadRecordedDemo(served({ '/capture': demoSession.path }), '/capture', '/report', 'run-a-session.json'),
    (e: unknown) => e instanceof RecordedDemoError && e.code === 'DEMO_REPORT_MISSING');
});

test('a report for another session is rejected rather than shown against run A', async () => {
  const files = { '/capture': demoSession.path, '/report': 'fixtures/autodrive-synthetic-nebius-report.json' };
  const caught = await loadRecordedDemo(served(files), '/capture', '/report', 'run-a-session.json').catch((e: unknown) => e);
  assert.ok(caught instanceof RecordedDemoError && caught.code === 'DEMO_REPORT_INVALID' && caught.detail === 'REPORT_SESSION_MISMATCH');
  assert.match(recordedDemoMessage(caught, 'run-a-session.json', 'run-a-nebius-report.json'), /belongs to a different session/u);
});

test('a malformed capture is rejected before any report is considered', async () => {
  const files = { '/capture': 'fixtures/provenance.json', '/report': demoReport.path };
  await assert.rejects(loadRecordedDemo(served(files), '/capture', '/report', 'run-a-session.json'),
    (e: unknown) => e instanceof RecordedDemoError && e.code === 'DEMO_CAPTURE_INVALID');
});

test('sessions outside the manifest are labeled as unlisted imports', () => {
  assert.equal(labelForSession(manifest, '0'.repeat(64)).datasetClass, 'unlisted_import');
  assert.equal(labelForSession(manifest, '6752d098e909ae9d064641ff0721b045a4f0c285bf70989fb9c40e93a921a3fb').datasetClass, 'synthetic_fixture');
});

test('Circle run A imports through Import capture and is labeled from the manifest, not as the default demo', async () => {
  const entry = manifest.find(e => e.path === 'data/f1tenth-circle/run-a-session.json');
  assert.ok(entry);
  const bytes = new Uint8Array(readFileSync(repo(entry.path)));
  const session = await importSealedSessionFile({ name: entry.file, size: bytes.length, arrayBuffer: async () => bytes.buffer });
  assert.equal(session.canonicalSha256, entry.session_canonical_sha256);
  assert.equal(session.sampleCount, 600);
  assert.match(session.circuitName, /^Circle /u);
  const label = labelForSession(manifest, session.canonicalSha256);
  assert.equal(label.datasetClass, 'recorded_simulator_capture');
  assert.equal(label.distribution, 'Apache-2.0');
  assert.notEqual(demoSession.path, entry.path);
});

test('each circle and ladder run imports with its saved report and is labeled from the manifest', async () => {
  const pairs = [
    ['data/f1tenth-circle/run-a-session.json', 'data/f1tenth-circle/run-a-nebius-report.json', /^Circle /u],
    ['data/f1tenth-ladder/turn-run-a-session.json', 'data/f1tenth-ladder/turn-run-a-nebius-report.json', /^Turn /u],
    ['data/f1tenth-ladder/twoturns-run-a-session.json', 'data/f1tenth-ladder/twoturns-run-a-nebius-report.json', /^TwoTurns /u],
    ['data/f1tenth-ladder/chicane-run-a-session.json', 'data/f1tenth-ladder/chicane-run-a-nebius-report.json', /^Chicane /u],
  ] as const;
  for (const [capture, report, name] of pairs) {
    const sessionEntry = manifest.find(e => e.path === capture);
    const reportEntry = manifest.find(e => e.path === report);
    assert.ok(sessionEntry && reportEntry, capture);
    const { session, validated } = await loadRecordedDemo(served({ '/capture': capture, '/report': report }), '/capture', '/report', sessionEntry.file);
    assert.equal(session.canonicalSha256, sessionEntry.session_canonical_sha256);
    assert.equal(reportEntry.session_canonical_sha256, sessionEntry.session_canonical_sha256);
    assert.equal(session.sampleCount, 600);
    assert.match(session.circuitName, name);
    assert.ok(validated.saved.responseId.startsWith('chatcmpl-'));
    assert.equal(labelForSession(manifest, session.canonicalSha256).distribution, 'Apache-2.0');
    assert.ok(!sessionEntry.default_demo && !reportEntry.default_demo);
  }
});

test('the Silverstone baseline and retest laps import with their saved reports and keep GPL labels', async () => {
  // Retest uses the ladder-swept setting; it gets further (more samples) before the same kind of collision.
  const laps = [['baseline', 1214, 0.65, 14], ['retest', 2744, 1.05, 3]] as const;
  for (const [lap, samples, gain, lookahead] of laps) {
    const capture = `data/f1tenth-silverstone/${lap}-lap-session.json`;
    const report = `data/f1tenth-silverstone/${lap}-lap-nebius-report.json`;
    const sessionEntry = manifest.find(e => e.path === capture);
    const reportEntry = manifest.find(e => e.path === report);
    assert.ok(sessionEntry && reportEntry, capture);
    const { session, validated } = await loadRecordedDemo(served({ '/capture': capture, '/report': report }), '/capture', '/report', sessionEntry.file);
    assert.equal(session.canonicalSha256, sessionEntry.session_canonical_sha256);
    assert.equal(reportEntry.session_canonical_sha256, sessionEntry.session_canonical_sha256);
    assert.equal(session.sampleCount, samples);
    assert.ok(validated.saved.responseId.startsWith('chatcmpl-'));
    assert.match(labelForSession(manifest, session.canonicalSha256).distribution ?? '', /^GPL-3\.0 /u);
    assert.ok(!sessionEntry.default_demo && !reportEntry.default_demo);
    const sealed = JSON.parse(readFileSync(repo(capture), 'utf8'));
    assert.deepEqual([sealed.outcome.stop_reason, sealed.controller.steering_gain, sealed.controller.lookahead_points], ['terminated', gain, lookahead]);
  }
});
