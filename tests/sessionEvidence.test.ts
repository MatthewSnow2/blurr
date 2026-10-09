import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSealedEvidenceBundle, buildSessionEvidence } from '../src/coaching/sessionEvidence.ts';
import type { StoredSession } from '../src/lib/sessionStore.ts';

const base = (): StoredSession => ({
  schemaVersion: 'blurr.local-session.v1',
  id: 'f1tenth:fixture',
  source: 'f1tenth',
  simulator: 'f1tenth_gym',
  circuitName: 'fixture',
  capturedAtUtc: '2026-10-09T00:00:00.000Z',
  importedAtUtc: '2026-10-09T00:01:00.000Z',
  sourceFileName: 'fixture.json',
  sourceFileBytes: 10,
  sourceFileSha256: '1'.repeat(64),
  canonicalSha256: '2'.repeat(64),
  analysisVersion: 'raceline-v2',
  referenceKind: 'raceline',
  seed: 1,
  timestepS: 0.01,
  durationS: 0.01,
  sampleCount: 2,
  meanAbsLateralDeviationM: 0.15,
  maxAbsLateralDeviationM: 0.2,
  droppedFrames: 0,
  capabilities: {
    pose: 'measured_m', speed: 'measured_mps', steering: 'measured_rad', throttle: 'unavailable',
    reference: 'raceline', braking: 'unavailable', collision: 'unavailable',
  },
  samples: [0.1, 0.2].map((deviation, index) => ({
    sequence: index + 1,
    timeS: (index + 1) * 0.01,
    positionUnit: 'm',
    poseXM: index,
    poseYM: index,
    headingRad: 0,
    speedMps: index + 2,
    steeringRad: 0,
    throttle: null,
    lateralDeviationM: deviation,
    headingDeviationRad: 0,
    referenceSM: index,
    optimalSpeedMps: 2.5,
    curvaturePerM: 0.1,
  })),
});

test('builds deterministic F1 evidence with explicit units and unavailable channels', () => {
  const evidence = buildSessionEvidence(base());
  assert.equal(evidence.metrics.mean_abs_lateral_deviation_m.value, 0.15);
  assert.equal(evidence.metrics.mean_abs_lateral_deviation_m.unit, 'm');
  assert.equal(evidence.metrics.mean_speed_mps.value, 2.5);
  assert.equal(evidence.capabilities.braking, 'unavailable');
  assert.deepEqual(evidence.events, {});
});

test('builds a sealed provider bundle from the canonical local digest', () => {
  const session = base();
  const bundle = buildSealedEvidenceBundle(session);
  assert.equal(bundle.status, 'sealed');
  assert.equal(bundle.sessionId, session.id);
  assert.equal(bundle.sessionSha256, '2'.repeat(64));
  assert.equal(bundle.sealedAtUtc, session.capturedAtUtc);
});

test('AutoDRIVE evidence exposes only unit-safe counts and reception duration', () => {
  const session = base();
  session.source = 'autodrive';
  session.simulator = 'AutoDRIVE Simulator';
  session.analysisVersion = 'raw-v1';
  session.referenceKind = 'unavailable';
  session.seed = null;
  session.timestepS = null;
  session.meanAbsLateralDeviationM = null;
  session.maxAbsLateralDeviationM = null;
  const evidence = buildSessionEvidence(session);
  assert.equal(evidence.metrics.mean_abs_lateral_deviation_m, undefined);
  assert.equal(evidence.metrics.duration_s.unit, 's');
  assert.equal(evidence.capabilities.pose, 'unavailable');
});
