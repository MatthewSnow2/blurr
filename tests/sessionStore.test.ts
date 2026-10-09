import assert from 'node:assert/strict';
import test from 'node:test';

import { importSealedSessionFile, LocalSessionStore, MAX_SESSION_BYTES, type StorageLike } from '../src/lib/sessionStore.ts';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const fixture = (secondTime = 0.02) => ({
  schema_version: 'blurr.telemetry-session.v1',
  source_kind: 'f1tenth',
  status: 'sealed',
  captured_at_utc: '2026-10-09T00:00:00.000Z',
  circuit: { name: 'original-test-loop' },
  runtime: {
    simulator: 'f1tenth_gym',
    seed: 20261009,
    timestep_s: 0.01,
    analysis_version: 'raceline-v2',
    reference_kind: 'raceline',
  },
  outcome: {
    sample_count: 2,
    mean_abs_raceline_deviation_m: 0.15,
    max_abs_raceline_deviation_m: 0.2,
  },
  samples: [
    sample(1, 0.01, 0.1),
    sample(2, secondTime, -0.2),
  ],
});

function sample(step: number, time: number, lateral: number) {
  return {
    step_index: step,
    sim_time_s: time,
    observation: {
      pose_x_m: step,
      pose_y_m: step + 1,
      pose_theta_rad: 0.2,
      linear_vel_x_mps: 2.5,
      steering_delta_rad: 0.01,
    },
    analysis: {
      analysis_version: 'raceline-v2',
      reference_kind: 'raceline',
      lateral_dev_m: lateral,
      heading_dev_rad: 0.02,
      s_frenet: step * 0.1,
      speed_optimal_mps: 2.5,
      curvature_now: 0.03,
    },
  };
}

function jsonFile(value: unknown, name = 'capture.json') {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer,
  } as Pick<File, 'name' | 'size' | 'arrayBuffer'>;
}

const autodriveFixture = () => ({
  schema_version: 'blurr.telemetry-session.v1',
  source_kind: 'autodrive',
  status: 'sealed',
  captured_at_utc: '2026-10-09T00:00:00.000Z',
  runtime: {
    simulator: 'AutoDRIVE Simulator',
    vehicle_id: 'V1',
    receive_clock: 'python.time.monotonic',
    bridge_mode: 'telemetry_only_no_command_reply',
  },
  outcome: { sample_count: 2, dropped_frames: 0, max_frames: 100 },
  samples: [
    { sequence: 1, received_monotonic_s: 0.05, telemetry: { position: [1, 2, 0], throttle: 0.2, steering: 0.1 } },
    { sequence: 2, received_monotonic_s: 0.10, telemetry: { position: [1.1, 2.1, 0], throttle: 0.3, steering: 0.2 } },
  ],
});

test('imports, canonicalizes, and stores an idempotent sealed F1 session', async () => {
  const first = await importSealedSessionFile(jsonFile(fixture()), '2026-10-09T01:00:00.000Z');
  const second = await importSealedSessionFile(jsonFile(fixture()), '2026-10-09T02:00:00.000Z');
  assert.equal(first.id, second.id);
  assert.equal(first.canonicalSha256, second.canonicalSha256);
  assert.equal(first.durationS, 0.01);
  assert.equal(first.timestepS, 0.01);
  assert.equal(first.capabilities.braking, 'unavailable');

  const store = new LocalSessionStore(new MemoryStorage());
  assert.equal(store.save(first).importedAtUtc, '2026-10-09T01:00:00.000Z');
  assert.equal(store.save(second).importedAtUtc, '2026-10-09T01:00:00.000Z');
  assert.deepEqual(store.list().map((session) => session.id), [first.id]);
  assert.equal(store.load(first.id)?.samples.length, 2);
  store.remove(first.id);
  assert.equal(store.load(first.id), null);
});

test('history is readable through a fresh store instance after reload', async () => {
  const storage = new MemoryStorage();
  const session = await importSealedSessionFile(jsonFile(fixture()));
  new LocalSessionStore(storage).save(session);
  const reloaded = new LocalSessionStore(storage);
  assert.equal(reloaded.list()[0]?.id, session.id);
  assert.equal(reloaded.load(session.id)?.canonicalSha256, session.canonicalSha256);
});

test('imports AutoDRIVE frames without inventing units, speed, or reference metrics', async () => {
  const session = await importSealedSessionFile(jsonFile(autodriveFixture(), 'autodrive.json'));
  assert.match(session.id, /^autodrive:/);
  assert.equal(session.source, 'autodrive');
  assert.equal(session.durationS, 0.05);
  assert.equal(session.referenceKind, 'unavailable');
  assert.equal(session.meanAbsLateralDeviationM, null);
  assert.equal(session.samples[0].positionUnit, 'source_unit_unavailable');
  assert.equal(session.samples[0].speedMps, null);
  assert.equal(session.samples[0].poseXM, 1);
  assert.equal(session.capabilities.braking, 'unavailable');
});

test('rejects AutoDRIVE captures that could have emitted control replies', async () => {
  const unsafe = autodriveFixture();
  unsafe.runtime.bridge_mode = 'zero_command_reply';
  await assert.rejects(importSealedSessionFile(jsonFile(unsafe, 'autodrive.json')), /bridge_mode must equal telemetry_only_no_command_reply/);
});

test('rejects nonmonotonic simulator time and inconsistent summaries', async () => {
  await assert.rejects(importSealedSessionFile(jsonFile(fixture(0.01))), /sample time must be strictly increasing/);
  const bad = fixture();
  bad.outcome.max_abs_raceline_deviation_m = 99;
  await assert.rejects(importSealedSessionFile(jsonFile(bad)), /summary does not match samples/);
});

test('rejects unknown formats, changed byte counts, and oversized files', async () => {
  await assert.rejects(importSealedSessionFile(jsonFile(fixture(), 'capture.csv')), /Only sealed JSON/);
  const changed = jsonFile(fixture());
  await assert.rejects(importSealedSessionFile({ ...changed, size: changed.size + 1 }), /byte count changed/);
  await assert.rejects(importSealedSessionFile({ name: 'huge.json', size: MAX_SESSION_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) }), /byte limit/);
});

test('isolates corrupt history entries while retaining valid sessions', async () => {
  const storage = new MemoryStorage();
  storage.setItem('blurr.local-session.v1.corrupt', '{not json');
  const session = await importSealedSessionFile(jsonFile(fixture()));
  const store = new LocalSessionStore(storage);
  store.save(session);
  assert.deepEqual(store.list().map((entry) => entry.id), [session.id]);
});
