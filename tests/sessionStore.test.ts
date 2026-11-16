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

test('cached evidence edits are isolated on reload and repaired only by a valid reimport', async () => {
  const imported = await importSealedSessionFile(jsonFile(fixture()));
  const storage = new MemoryStorage();
  const store = new LocalSessionStore(storage);
  store.save(imported);
  const key = storage.key(0)!;
  const changed = JSON.parse(storage.getItem(key)!); changed.durationS = 999;
  storage.setItem(key, JSON.stringify(changed));
  assert.equal(new LocalSessionStore(storage).list().length, 0);
  assert.throws(() => new LocalSessionStore(storage).load(imported.id), /corrupt/u);
  assert.throws(() => store.save(changed), /SESSION_INTEGRITY_INVALID/u);
  assert.equal(store.save(imported).durationS, imported.durationS);
  assert.equal(new LocalSessionStore(storage).list().length, 1);
});

const accSample = (sequence: number, time: number, extra: Record<string, unknown> = {}) => ({
  sequence,
  received_monotonic_s: time,
  telemetry: {
    speed_mps: 50, throttle: 0.5, brake: 0, steering: 0.1, gear_raw: 4, rpm: 7000,
    spline: 0.25 + sequence * 0.01, lap: 1, lap_time_ms: 1000 + sequence * 16, is_valid_lap: true, ...extra,
  },
});

const accFixture = () => ({
  schema_version: 'blurr.telemetry-session.v1',
  source_kind: 'acc',
  status: 'sealed',
  captured_at_utc: '2026-11-15T18:32:54Z',
  runtime: {
    simulator: 'Assetto Corsa Competizione',
    receive_clock: 'python.time.perf_counter',
    ingest: 'shared_memory',
    export_rate_hz: 60,
  },
  circuit: { name: 'nurburgring' },
  vehicle: { model: 'test_car' },
  outcome: {
    sample_count: 3,
    source_row_count: 1200,
    dropped_frames: 0,
    pause_gaps: [{ start_s: 0.01667, duration_s: 60 }],
    laps: [],
  },
  samples: [
    accSample(0, 0),
    accSample(1, 0.01667, { brake: 0.8, throttle: 0 }),
    accSample(2, 60.01667, { position: [181.07, 62.05, -384.65], heading_rad: 0.81 }),
  ],
});

test('imports an ACC session with speed, pedals, lap position and pauses, without claiming a pose', async () => {
  const first = await importSealedSessionFile(jsonFile(accFixture(), 'acc.json'), '2026-11-15T19:00:00.000Z');
  const second = await importSealedSessionFile(jsonFile(accFixture(), 'acc.json'), '2026-11-15T20:00:00.000Z');
  assert.match(first.id, /^acc:/);
  assert.equal(first.id, second.id);
  assert.equal(first.source, 'acc');
  assert.equal(first.simulator, 'Assetto Corsa Competizione');
  assert.equal(first.circuitName, 'nurburgring');
  assert.equal(first.sampleCount, 3);
  assert.equal(first.durationS, 60.01667);
  assert.deepEqual(first.pauseGaps, [{ startS: 0.01667, durationS: 60 }]);
  assert.equal(first.samples[0].speedMps, 50);
  assert.equal(first.samples[1].brake, 0.8);
  assert.equal(first.samples[1].throttle, 0);
  assert.equal(first.samples[0].trackPosition, 0.25);
  assert.equal(first.samples[0].lap, 1);
  assert.equal(first.capabilities.speed, 'measured_mps');
  assert.equal(first.capabilities.braking, 'reported_source_unit');
  assert.equal(first.capabilities.pose, 'unavailable');
  assert.equal(first.capabilities.reference, 'unavailable');
  // The recorded world position is present in the file but its axes are unverified.
  assert.equal(first.samples[2].poseXM, null);
  assert.equal(first.samples[2].headingRad, null);
  assert.equal(first.meanAbsLateralDeviationM, null);

  const storage = new MemoryStorage();
  new LocalSessionStore(storage).save(first);
  const reloaded = new LocalSessionStore(storage).load(first.id);
  assert.deepEqual(reloaded?.pauseGaps, first.pauseGaps);
  assert.equal(reloaded?.canonicalSha256, first.canonicalSha256);
});

test('a stored ACC session with edited pauses or samples is rejected on reload', async () => {
  const imported = await importSealedSessionFile(jsonFile(accFixture(), 'acc.json'));
  for (const tamper of [
    (session: Record<string, unknown>) => { session.pauseGaps = []; },
    (session: Record<string, unknown>) => { delete session.pauseGaps; },
    (session: Record<string, unknown>) => { (session.samples as Array<Record<string, unknown>>)[1].brake = 0; },
  ]) {
    const storage = new MemoryStorage();
    const store = new LocalSessionStore(storage);
    store.save(imported);
    const key = storage.key(0)!;
    const changed = JSON.parse(storage.getItem(key)!);
    tamper(changed);
    storage.setItem(key, JSON.stringify(changed));
    assert.equal(new LocalSessionStore(storage).list().length, 0);
    assert.throws(() => store.save(changed), /SESSION_INTEGRITY_INVALID/u);
  }
});

test('rejects malformed ACC captures', async () => {
  const cases: Array<[(capture: ReturnType<typeof accFixture>) => void, RegExp]> = [
    [(c) => { c.runtime.ingest = 'udp'; }, /runtime\.ingest must equal shared_memory/],
    [(c) => { c.runtime.receive_clock = 'python.time.time'; }, /runtime\.receive_clock must equal python\.time\.perf_counter/],
    [(c) => { c.runtime.simulator = 'Assetto Corsa'; }, /runtime\.simulator must equal Assetto Corsa Competizione/],
    [(c) => { c.circuit.name = ''; }, /circuit\.name must be a non-empty string/],
    [(c) => { c.samples[1].telemetry.brake = 1.2; }, /samples\[1\]\.telemetry\.brake must be between 0 and 1/],
    [(c) => { c.samples[1].telemetry.throttle = -0.1; }, /samples\[1\]\.telemetry\.throttle must be between 0 and 1/],
    [(c) => { c.samples[1].telemetry.spline = 1.5; }, /samples\[1\]\.telemetry\.spline must be between 0 and 1/],
    [(c) => { c.samples[1].telemetry.speed_mps = -1; }, /speed_mps must be nonnegative/],
    [(c) => { (c.samples[1].telemetry as Record<string, unknown>).speed_mps = null; }, /speed_mps must be a finite number/],
    [(c) => { delete (c.samples[1].telemetry as Record<string, unknown>).steering; }, /steering must be a finite number/],
    [(c) => { c.samples[0].telemetry.lap = 2; }, /samples\[1\]\.telemetry\.lap must not decrease/],
    [(c) => { c.samples[1].telemetry.lap = 1.5; }, /lap must be an integer/],
    [(c) => { c.samples[2].received_monotonic_s = 0.01667; }, /receive time must be nonnegative and strictly increasing/],
    [(c) => { c.samples[2].sequence = 1; }, /sequence must be strictly increasing/],
    [(c) => { c.outcome.sample_count = 4; }, /sample_count does not match samples/],
    [(c) => { c.outcome.dropped_frames = -1; }, /dropped_frames must be nonnegative/],
    [(c) => { delete (c.outcome as Record<string, unknown>).pause_gaps; }, /outcome\.pause_gaps must be an array/],
    [(c) => { c.outcome.pause_gaps[0].duration_s = 0; }, /pause_gaps\[0\] must have a nonnegative start and a positive duration/],
    [(c) => { c.outcome.pause_gaps[0].duration_s = 600; }, /pause_gaps exceed the session duration/],
    [(c) => { (c.samples[2].telemetry as Record<string, unknown>).position = [1, 2]; }, /position has an unsupported vector length/],
    [(c) => { c.captured_at_utc = 'yesterday'; }, /captured_at_utc must be an ISO timestamp/],
    [(c) => { c.samples = []; }, /samples must not be empty/],
  ];
  for (const [mutate, message] of cases) {
    const capture = accFixture();
    mutate(capture);
    await assert.rejects(importSealedSessionFile(jsonFile(capture, 'acc.json')), message);
  }
  const unknown = { ...accFixture(), source_kind: 'iracing' };
  await assert.rejects(importSealedSessionFile(jsonFile(unknown, 'x.json')), /source_kind must be f1tenth, autodrive or acc/);
});

test('adding the ACC source leaves existing F1TENTH and AutoDRIVE digests unchanged', async () => {
  // Digests computed from main at 343e019, before ACC support. Saved reports and
  // local history are keyed by these, so the optional ACC fields must not leak in.
  const f1 = await importSealedSessionFile(jsonFile(fixture()));
  const autodrive = await importSealedSessionFile(jsonFile(autodriveFixture(), 'autodrive.json'));
  assert.equal(f1.canonicalSha256, 'cbaef091eddbea82e4b29ca9171aae9e77d48cf1f602e522752bd08cb8509e58');
  assert.equal(autodrive.canonicalSha256, 'f415dc1f28f3edd4c028883ce13e0f085aa41d20c3403bcbc36a8e542a618c87');
  assert.equal('pauseGaps' in f1, false);
  assert.equal('brake' in f1.samples[0], false);
  assert.equal('brake' in autodrive.samples[0], false);
});
