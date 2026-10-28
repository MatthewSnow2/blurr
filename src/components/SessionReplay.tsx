import React, { useMemo, useState } from 'react';
import { ArrowLeft, Database, Video } from 'lucide-react';
import SavedProviderReport from './SavedProviderReport';
import LiveCoaching from './LiveCoaching';
import type { ReplaySample, StoredSession } from '../lib/sessionStore';
import type { DatasetLabel } from '../demo/datasets';

interface SessionReplayProps {
  session: StoredSession;
  datasetLabel: DatasetLabel;
  videoUrl: string | null;
  onBack: () => void;
}

type PositionedSample = ReplaySample & { poseXM: number; poseYM: number };

const isPositioned = (sample: ReplaySample): sample is PositionedSample =>
  sample.poseXM !== null && sample.poseYM !== null;

const SessionReplay: React.FC<SessionReplayProps> = ({ session, datasetLabel, videoUrl, onBack }) => {
  const [sampleIndex, setSampleIndex] = useState(0);
  const sample = session.samples[sampleIndex];
  const trace = useMemo(() => {
    const positioned = session.samples.filter(isPositioned);
    if (positioned.length === 0) return { points: '', selected: null as [number, number] | null };
    const xs = positioned.map((entry) => entry.poseXM);
    const ys = positioned.map((entry) => entry.poseYM);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(maxX - minX, Number.EPSILON);
    const height = Math.max(maxY - minY, Number.EPSILON);
    const point = (entry: PositionedSample): [number, number] => [
      10 + 280 * (entry.poseXM - minX) / width,
      190 - 180 * (entry.poseYM - minY) / height,
    ];
    const selected = isPositioned(sample) ? point(sample) : null;
    return {
      points: positioned.map((entry) => point(entry).join(',')).join(' '),
      selected,
    };
  }, [sample, session]);

  const isF1 = session.source === 'f1tenth';
  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      <button onClick={onBack} className="flex items-center text-electric-400 hover:text-electric-300">
        <ArrowLeft className="h-5 w-5 mr-2" />
        Back to local history
      </button>

      <div role="note" aria-label="Recorded replay notice" className="glass-card p-4 border border-amber-400/40 text-sm">
        <p className="font-semibold text-amber-300 uppercase tracking-wider">Recorded replay · not live simulation or inference</p>
        <p className="mt-1 text-chrome-200">
          {datasetLabel.label} · {isF1
            ? `${session.durationS.toFixed(2)} s simulated over ${session.sampleCount} steps${session.timestepS === null ? '' : ` at ${session.timestepS} s`}`
            : `${session.durationS.toFixed(3)} s reception span over ${session.sampleCount} frames`}
        </p>
        <p className="mt-1 text-chrome-400">This demonstrates ingestion and reporting, not proven driving improvement or a completed lap.</p>
      </div>

      <div className="carbon-card p-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-electric-400">Recorded {session.source} session</div>
            <h1 className="mt-2 text-4xl font-display font-bold text-white">{session.circuitName}</h1>
            <p className="mt-2 text-chrome-400">
              Reference: {session.referenceKind} · Analysis: {session.analysisVersion} · Seed: {session.seed ?? 'unavailable'}
            </p>
          </div>
          <div className="font-mono text-xs text-chrome-500 break-all max-w-md">canonical {session.canonicalSha256}</div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          <Metric label="Samples" value={String(session.sampleCount)} />
          {isF1 ? (
            <>
              <Metric label="Mean absolute lateral deviation" value={`${session.meanAbsLateralDeviationM!.toFixed(6)} m`} />
              <Metric label="Maximum absolute lateral deviation" value={`${session.maxAbsLateralDeviationM!.toFixed(6)} m`} />
            </>
          ) : (
            <>
              <Metric label="Reception-clock duration" value={`${session.durationS.toFixed(3)} s`} />
              <Metric label="Dropped frames" value={String(session.droppedFrames)} />
            </>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="carbon-card p-6">
          <h2 className="text-xl font-display font-bold text-white mb-2">Position trace</h2>
          <p className="text-xs text-chrome-400 mb-4">
            {isF1 ? 'Metric simulator pose.' : 'Raw simulator coordinates; the baseline connector does not declare their physical unit.'}
          </p>
          {trace.points ? (
            <svg viewBox="0 0 300 200" className="w-full h-72 bg-carbon-900 rounded-lg" role="img" aria-label="Recorded vehicle position trace">
              <polyline points={trace.points} fill="none" stroke="#3b82f6" strokeWidth="2" />
              {trace.selected && <circle cx={trace.selected[0]} cy={trace.selected[1]} r="4" fill="#22c55e" />}
            </svg>
          ) : (
            <div className="w-full h-72 bg-carbon-900 rounded-lg flex items-center justify-center text-chrome-500">Position unavailable</div>
          )}
          <input
            aria-label="Replay sample"
            className="w-full mt-4"
            type="range"
            min={0}
            max={session.samples.length - 1}
            value={sampleIndex}
            onChange={(event) => setSampleIndex(Number(event.target.value))}
          />
        </div>

        <div className="carbon-card p-6">
          <h2 className="text-xl font-display font-bold text-white mb-4">Selected evidence sample</h2>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Sequence" value={String(sample.sequence)} />
            <Metric label={isF1 ? 'Simulator time' : 'Monotonic reception time'} value={`${sample.timeS.toFixed(3)} s`} />
            <Metric label="Position" value={formatPosition(sample)} />
            {isF1 ? (
              <>
                <Metric label="Speed" value={formatNumber(sample.speedMps, 'm/s')} />
                <Metric label="Lateral deviation" value={formatNumber(sample.lateralDeviationM, 'm', 6)} />
                <Metric label="Heading deviation" value={formatNumber(sample.headingDeviationRad, 'rad', 6)} />
                <Metric label="Raceline distance" value={formatNumber(sample.referenceSM, 'm')} />
                <Metric label="Curvature" value={formatNumber(sample.curvaturePerM, '1/m', 6)} />
              </>
            ) : (
              <>
                <Metric label="Throttle" value={formatSourceValue(sample.throttle)} />
                <Metric label="Steering" value={formatSourceValue(sample.steeringRad)} />
                <Metric label="Speed" value="unavailable" />
                <Metric label="Reference deviation" value="unavailable" />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-6 border border-electric-500/20">
        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2"><Database className="h-5 w-5 text-electric-400" />Provenance</h2>
        <dl className="mt-4 grid md:grid-cols-2 gap-3 text-sm">
          <Provenance label="Source file" value={`${session.sourceFileName} (${session.sourceFileBytes} bytes)`} />
          <Provenance label="Source SHA-256" value={session.sourceFileSha256} />
          <Provenance label="Captured" value={session.capturedAtUtc} />
          <Provenance label="Imported" value={session.importedAtUtc} />
          <Provenance label="Dataset" value={datasetLabel.label} />
          <Provenance label="Distribution" value={datasetLabel.distribution ?? 'not listed in the bundled manifest'} />
        </dl>
      </div>

      {videoUrl && (
        <div className="carbon-card p-6">
          <h2 className="text-xl font-display font-bold text-white flex items-center gap-2 mb-4"><Video className="h-5 w-5 text-electric-400" />Local context video</h2>
          <video src={videoUrl} className="w-full rounded-lg" controls />
          <p className="mt-2 text-sm text-chrome-400">This object URL is revoked when leaving the replay and is not evidence.</p>
        </div>
      )}

      <SavedProviderReport key={session.canonicalSha256} session={session} />
      <LiveCoaching key={`live-${session.canonicalSha256}`} session={session} />
    </div>
  );
};

const formatNumber = (value: number | null, unit: string, digits = 3): string =>
  value === null ? 'unavailable' : `${value.toFixed(digits)} ${unit}`;

const formatSourceValue = (value: number | null): string =>
  value === null ? 'unavailable' : `${value} (source unit unspecified)`;

const formatPosition = (sample: ReplaySample): string => {
  if (sample.poseXM === null || sample.poseYM === null) return 'unavailable';
  return sample.positionUnit === 'm'
    ? `${sample.poseXM.toFixed(3)}, ${sample.poseYM.toFixed(3)} m`
    : `${sample.poseXM}, ${sample.poseYM} (source unit unspecified)`;
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="glass-card p-3">
    <div className="text-xs text-chrome-400">{label}</div>
    <div className="mt-1 text-white font-semibold break-words">{value}</div>
  </div>
);

const Provenance: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-chrome-400">{label}</dt>
    <dd className="font-mono text-xs text-chrome-200 break-all">{value}</dd>
  </div>
);

export default SessionReplay;
