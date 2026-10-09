import type { StoredSession } from '../lib/sessionStore.ts';
import type { SealedEvidenceBundle } from './providerBoundary.ts';
import type { EvidenceStore, MetricEvidence } from './reportContract.ts';

const metric = (id: string, label: string, unit: string, value: number): MetricEvidence => ({
  id,
  label,
  unit,
  scope: 'session',
  scopeId: 'session',
  value,
});

export const buildSessionEvidence = (session: StoredSession): EvidenceStore => {
  const metrics: Record<string, MetricEvidence> = {
    sample_count: metric('sample_count', 'Recorded samples', 'samples', session.sampleCount),
    duration_s: metric(
      'duration_s',
      session.source === 'f1tenth' ? 'Simulator duration' : 'Monotonic reception duration',
      's',
      session.durationS,
    ),
    dropped_frames: metric('dropped_frames', 'Dropped capture frames', 'frames', session.droppedFrames),
  };

  if (session.source === 'f1tenth') {
    const speeds = session.samples.flatMap((sample) => sample.speedMps === null ? [] : [sample.speedMps]);
    metrics.mean_abs_lateral_deviation_m = metric(
      'mean_abs_lateral_deviation_m',
      'Mean absolute raceline deviation',
      'm',
      session.meanAbsLateralDeviationM!,
    );
    metrics.max_abs_lateral_deviation_m = metric(
      'max_abs_lateral_deviation_m',
      'Maximum absolute raceline deviation',
      'm',
      session.maxAbsLateralDeviationM!,
    );
    metrics.mean_speed_mps = metric(
      'mean_speed_mps',
      'Mean measured speed',
      'm/s',
      speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length,
    );
  }

  return {
    metrics,
    events: {},
    occurrences: {},
    capabilities: session.source === 'f1tenth'
      ? { pose: 'measured', speed: 'measured', steering: 'measured', reference: 'derived', braking: 'unavailable', collision: 'unavailable' }
      : { pose: 'unavailable', speed: 'unavailable', steering: 'unavailable', reference: 'unavailable', braking: 'unavailable', collision: 'unavailable' },
  };
};

export const buildSealedEvidenceBundle = (session: StoredSession): SealedEvidenceBundle => ({
  status: 'sealed',
  sessionId: session.id,
  sessionSha256: session.canonicalSha256,
  sealedAtUtc: session.capturedAtUtc,
  evidence: buildSessionEvidence(session),
});
