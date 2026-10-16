import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { importRecordedFile, MAX_RECORDED_BYTES, parseRecordedSession } from '../src/lib/recordedSession.ts';
import { importSealedSessionFile } from '../src/lib/sessionStore.ts';

const raw = new Uint8Array(readFileSync(new URL('../fixtures/recorded-synthetic-session.json', import.meta.url)));
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const fixture = () => JSON.parse(new TextDecoder().decode(raw));
const parse = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return parseRecordedSession(bytes, digest(bytes));
};
const file = (bytes: Uint8Array) => ({ size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer });

test('recorded fixture preserves all samples, wall clock, provenance and source channels', async () => {
  const view = await parseRecordedSession(raw, digest(raw));
  assert.equal(view.samples.length, 3);
  assert.equal(view.wallSpanS, .2);
  assert.equal(view.samples[0].wallLabel, '2026_10_16_12_00_00_000');
  assert.match(view.evidenceLabel, /^Synthetic fixture/);
  assert.equal(view.samples[1].channels.find(c => c.label.startsWith('Local-Z'))?.value, '0');
  assert.equal(view.samples[2].channels.find(c => c.label.startsWith('Local-Z'))?.value, '-0.2');
  assert.equal(view.samples[2].channels.find(c => c.label.startsWith('Throttle'))?.value, '-0.1');
  assert.equal(view.fileSha256, digest(raw));
  assert.equal(view.fileBytes, raw.byteLength);
  assert.equal(view.inputSha256, fixture().input_sha256);
  assert.match(view.clockLabel, /not monotonic/);
  assert.match(view.timezoneLabel, /UTC acquisition time unavailable/);
  assert.ok(view.limitations.some(text => text.includes('source floats')));
  assert.ok(view.limitations.some(text => text.includes('Speed in m/s')));
});

test('recorded_unverified is never presented as genuine or live verified', async () => {
  const value = fixture(); value.declared_evidence_kind = 'recorded_unverified';
  const view = await parse(value);
  assert.match(view.evidenceLabel, /Unverified recording — genuine capture not established/);
  value.declared_evidence_kind = 'genuine_verified';
  await assert.rejects(parse(value), /Evidence kind/);
});

test('empty, malformed, non-UTF8 and digest-mismatched bytes fail with no fallback', async () => {
  for (const bytes of [new Uint8Array(), new TextEncoder().encode('{broken'), new Uint8Array([255])]) {
    await assert.rejects(parseRecordedSession(bytes, digest(bytes)));
  }
  await assert.rejects(parseRecordedSession(raw, '0'.repeat(64)), /SHA-256 does not match/);
  await assert.rejects(parseRecordedSession(raw, 'not-a-digest'), /lowercase SHA-256/);
});

test('file and sample bounds reject before reading or rendering', async () => {
  let reads = 0;
  for (const size of [0, MAX_RECORDED_BYTES + 1]) {
    await assert.rejects(importRecordedFile({ size, arrayBuffer: async () => { reads++; return new ArrayBuffer(0); } }, digest(raw)), /15 MiB/);
  }
  assert.equal(reads, 0);
  const value = fixture(); value.samples = []; value.sample_count = 0;
  await assert.rejects(parse(value), /1–50,000/);
  value.samples = Array(50_001).fill(null); value.sample_count = 50_001;
  await assert.rejects(parse(value), /1–50,000/);
  const mismatch = fixture(); mismatch.sample_count = 2;
  await assert.rejects(parse(mismatch), /matching count/);
});

test('unsupported sources, added capabilities and live claims fail closed', async () => {
  const mutations = [
    (v: ReturnType<typeof fixture>) => { v.schema_version = 'blurr.telemetry-session.v1'; },
    (v: ReturnType<typeof fixture>) => { v.source_contract_commit = '0'.repeat(40); },
    (v: ReturnType<typeof fixture>) => { v.provenance.live_capture_verified = true; },
    (v: ReturnType<typeof fixture>) => { v.provenance.physical_output_enabled = true; },
    (v: ReturnType<typeof fixture>) => { v.provenance.timezone = 'UTC'; },
    (v: ReturnType<typeof fixture>) => { v.capabilities.speed_mps = 'measured'; },
    (v: ReturnType<typeof fixture>) => { v.extra = 'unrecognized'; },
    (v: ReturnType<typeof fixture>) => { v.samples[0].telemetry.camera_path = '/never/read'; },
    (v: ReturnType<typeof fixture>) => { v.excluded_export_channels = []; },
  ];
  for (const mutate of mutations) { const value = fixture(); mutate(value); await assert.rejects(parse(value)); }
});

test('malformed numeric vectors, missing values and nonfinite numbers reject', async () => {
  for (const replacement of [null, [], [1, 2], [1, 2, '3'], [1, 2, null], [1, 2, Number.POSITIVE_INFINITY]]) {
    const value = fixture(); value.samples[0].telemetry.position_source = replacement;
    await assert.rejects(parse(value));
  }
  const value = fixture(); delete value.samples[0].telemetry.throttle_source;
  await assert.rejects(parse(value), /missing or unsupported/);
  const overflow = new TextEncoder().encode(new TextDecoder().decode(raw).replace('"throttle_source": 0.2', '"throttle_source": 1e309'));
  await assert.rejects(parseRecordedSession(overflow, digest(overflow)), /must be finite/);
});

test('calendar, sequence, offset, order and wall span are independently checked', async () => {
  const mutations = [
    (v: ReturnType<typeof fixture>) => { v.samples[0].recorded_wall_time = '2026_02_30_12_00_00_000'; },
    (v: ReturnType<typeof fixture>) => { v.samples[1].recorded_wall_time = v.samples[0].recorded_wall_time; },
    (v: ReturnType<typeof fixture>) => { v.samples[1].wall_offset_s = .15; },
    (v: ReturnType<typeof fixture>) => { v.samples[1].sequence = 8; },
    (v: ReturnType<typeof fixture>) => { v.wall_span_s = 999; },
  ];
  for (const mutate of mutations) { const value = fixture(); mutate(value); await assert.rejects(parse(value)); }
});

test('duplicate escaped JSON keys are rejected even with a matching byte digest', async () => {
  const text = new TextDecoder().decode(raw).replace('"sample_count": 3', '"sample_count": 3, "sample_\\u0063ount": 3');
  const bytes = new TextEncoder().encode(text);
  await assert.rejects(parseRecordedSession(bytes, digest(bytes)), /duplicate JSON field/);
});

test('valid one-sample recording and year below 100 retain calendar semantics', async () => {
  const value = fixture(); value.samples = [value.samples[0]]; value.sample_count = 1; value.wall_span_s = 0;
  value.samples[0].recorded_wall_time = '0099_01_02_03_04_05_006';
  const view = await parse(value);
  assert.equal(view.wallSpanS, 0);
  assert.equal(view.samples[0].wallLabel, '0099_01_02_03_04_05_006');
});

test('file read errors propagate and a subsequent valid import recovers', async () => {
  await assert.rejects(importRecordedFile({ size: 1, arrayBuffer: async () => { throw new Error('read denied'); } }, digest(raw)), /read denied/);
  await assert.rejects(importRecordedFile({ size: 1, arrayBuffer: async () => new ArrayBuffer(2) }, digest(raw)), /size changed/);
  assert.equal((await importRecordedFile(file(raw), digest(raw))).samples.length, 3);
});

test('recorded exports cannot enter the existing sealed-session coaching contract', async () => {
  await assert.rejects(importSealedSessionFile(new File([raw], 'recorded.json')));
});
