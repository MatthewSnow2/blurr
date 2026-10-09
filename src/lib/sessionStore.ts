export const MAX_SESSION_BYTES = 15 * 1024 * 1024;
export const MAX_SESSION_SAMPLES = 50_000;

const STORAGE_PREFIX = 'blurr.local-session.v1.';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ReplaySample {
  sequence: number;
  timeS: number;
  positionUnit: 'm' | 'source_unit_unavailable';
  poseXM: number | null;
  poseYM: number | null;
  headingRad: number | null;
  speedMps: number | null;
  steeringRad: number | null;
  throttle: number | null;
  lateralDeviationM: number | null;
  headingDeviationRad: number | null;
  referenceSM: number | null;
  optimalSpeedMps: number | null;
  curvaturePerM: number | null;
}

export interface SessionCapabilities {
  pose: 'measured_m' | 'reported_source_unit' | 'unavailable';
  speed: 'measured_mps' | 'unavailable';
  steering: 'measured_rad' | 'reported_source_unit' | 'unavailable';
  throttle: 'reported_source_unit' | 'unavailable';
  reference: 'raceline' | 'unavailable';
  braking: 'unavailable';
  collision: 'unavailable';
}

export interface StoredSession {
  schemaVersion: 'blurr.local-session.v1';
  id: string;
  source: 'f1tenth' | 'autodrive';
  simulator: 'f1tenth_gym' | 'AutoDRIVE Simulator';
  circuitName: string;
  capturedAtUtc: string;
  importedAtUtc: string;
  sourceFileName: string;
  sourceFileBytes: number;
  sourceFileSha256: string;
  canonicalSha256: string;
  analysisVersion: 'raceline-v2' | 'raw-v1';
  referenceKind: 'raceline' | 'unavailable';
  seed: number | null;
  timestepS: number | null;
  durationS: number;
  sampleCount: number;
  meanAbsLateralDeviationM: number | null;
  maxAbsLateralDeviationM: number | null;
  droppedFrames: number;
  capabilities: SessionCapabilities;
  samples: ReplaySample[];
}

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordAt = (value: unknown, path: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
};

const arrayAt = (value: unknown, path: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
};

const stringAt = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${path} must be a non-empty string`);
  return value;
};

const numberAt = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path} must be a finite number`);
  return value;
};

const integerAt = (value: unknown, path: string): number => {
  const parsed = numberAt(value, path);
  if (!Number.isInteger(parsed)) throw new Error(`${path} must be an integer`);
  return parsed;
};

const optionalNumberAt = (value: unknown, path: string): number | null =>
  value === null || value === undefined ? null : numberAt(value, path);

const optionalVectorAt = (value: unknown, path: string, minimumLength: number): number[] | null => {
  if (value === null || value === undefined) return null;
  const vector = arrayAt(value, path);
  if (vector.length < minimumLength || vector.length > 4) throw new Error(`${path} has an unsupported vector length`);
  return vector.map((entry, index) => numberAt(entry, `${path}[${index}]`));
};

const assertExact = (actual: unknown, expected: string, path: string): void => {
  if (actual !== expected) throw new Error(`${path} must equal ${expected}`);
};

const stableStringify = (value: JsonValue): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(',')}}`;
};

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const asJsonValue = (value: unknown): JsonValue => value as JsonValue;

const nearlyEqual = (left: number, right: number, tolerance = 1e-12): boolean =>
  Math.abs(left - right) <= tolerance * Math.max(1, Math.abs(left), Math.abs(right));

interface NormalizedCore {
  schemaVersion: 'blurr.local-session.v1';
  source: 'f1tenth' | 'autodrive';
  simulator: 'f1tenth_gym' | 'AutoDRIVE Simulator';
  circuitName: string;
  capturedAtUtc: string;
  analysisVersion: 'raceline-v2' | 'raw-v1';
  referenceKind: 'raceline' | 'unavailable';
  seed: number | null;
  timestepS: number | null;
  durationS: number;
  sampleCount: number;
  meanAbsLateralDeviationM: number | null;
  maxAbsLateralDeviationM: number | null;
  droppedFrames: number;
  capabilities: SessionCapabilities;
  samples: ReplaySample[];
}

const normalizeF1Capture = (input: unknown): NormalizedCore => {
  const root = recordAt(input, 'capture');
  const runtime = recordAt(root.runtime, 'runtime');
  const circuit = recordAt(root.circuit, 'circuit');
  const outcome = recordAt(root.outcome, 'outcome');
  const rawSamples = arrayAt(root.samples, 'samples');

  assertExact(root.schema_version, 'blurr.telemetry-session.v1', 'schema_version');
  assertExact(root.source_kind, 'f1tenth', 'source_kind');
  assertExact(root.status, 'sealed', 'status');
  assertExact(runtime.simulator, 'f1tenth_gym', 'runtime.simulator');
  assertExact(runtime.analysis_version, 'raceline-v2', 'runtime.analysis_version');
  assertExact(runtime.reference_kind, 'raceline', 'runtime.reference_kind');
  const timestepS = numberAt(runtime.timestep_s, 'runtime.timestep_s');
  if (timestepS <= 0) throw new Error('runtime.timestep_s must be positive');

  if (rawSamples.length === 0) throw new Error('samples must not be empty');
  if (rawSamples.length > MAX_SESSION_SAMPLES) {
    throw new Error(`samples exceeds the ${MAX_SESSION_SAMPLES} sample limit`);
  }

  let previousSequence = -1;
  let previousTime = -1;
  const samples = rawSamples.map((value, index): ReplaySample => {
    const sample = recordAt(value, `samples[${index}]`);
    const observation = recordAt(sample.observation, `samples[${index}].observation`);
    const analysis = recordAt(sample.analysis, `samples[${index}].analysis`);
    const sequence = integerAt(sample.step_index, `samples[${index}].step_index`);
    const timeS = numberAt(sample.sim_time_s, `samples[${index}].sim_time_s`);
    if (sequence <= previousSequence) throw new Error('sample sequence must be strictly increasing');
    if (timeS <= previousTime) throw new Error('sample time must be strictly increasing');
    if (!nearlyEqual(timeS, sequence * timestepS)) throw new Error('sample time does not match sequence and runtime timestep');
    previousSequence = sequence;
    previousTime = timeS;
    assertExact(analysis.analysis_version, 'raceline-v2', `samples[${index}].analysis.analysis_version`);
    assertExact(analysis.reference_kind, 'raceline', `samples[${index}].analysis.reference_kind`);

    return {
      sequence,
      timeS,
      positionUnit: 'm',
      poseXM: numberAt(observation.pose_x_m, `samples[${index}].observation.pose_x_m`),
      poseYM: numberAt(observation.pose_y_m, `samples[${index}].observation.pose_y_m`),
      headingRad: numberAt(observation.pose_theta_rad, `samples[${index}].observation.pose_theta_rad`),
      speedMps: numberAt(observation.linear_vel_x_mps, `samples[${index}].observation.linear_vel_x_mps`),
      steeringRad: numberAt(observation.steering_delta_rad, `samples[${index}].observation.steering_delta_rad`),
      throttle: null,
      lateralDeviationM: numberAt(analysis.lateral_dev_m, `samples[${index}].analysis.lateral_dev_m`),
      headingDeviationRad: numberAt(analysis.heading_dev_rad, `samples[${index}].analysis.heading_dev_rad`),
      referenceSM: numberAt(analysis.s_frenet, `samples[${index}].analysis.s_frenet`),
      optimalSpeedMps: numberAt(analysis.speed_optimal_mps, `samples[${index}].analysis.speed_optimal_mps`),
      curvaturePerM: numberAt(analysis.curvature_now, `samples[${index}].analysis.curvature_now`),
    };
  });

  const sampleCount = integerAt(outcome.sample_count, 'outcome.sample_count');
  if (sampleCount !== samples.length) throw new Error('outcome.sample_count does not match samples');
  const computedMean = samples.reduce((sum, sample) => sum + Math.abs(sample.lateralDeviationM!), 0) / samples.length;
  const computedMax = Math.max(...samples.map((sample) => Math.abs(sample.lateralDeviationM!)));
  const reportedMean = numberAt(outcome.mean_abs_raceline_deviation_m, 'outcome.mean_abs_raceline_deviation_m');
  const reportedMax = numberAt(outcome.max_abs_raceline_deviation_m, 'outcome.max_abs_raceline_deviation_m');
  if (!nearlyEqual(computedMean, reportedMean) || !nearlyEqual(computedMax, reportedMax)) {
    throw new Error('reported lateral-deviation summary does not match samples');
  }

  const capturedAtUtc = stringAt(root.captured_at_utc, 'captured_at_utc');
  if (!Number.isFinite(Date.parse(capturedAtUtc))) throw new Error('captured_at_utc must be an ISO timestamp');

  return {
    schemaVersion: 'blurr.local-session.v1',
    source: 'f1tenth',
    simulator: 'f1tenth_gym',
    circuitName: stringAt(circuit.name, 'circuit.name'),
    capturedAtUtc,
    analysisVersion: 'raceline-v2',
    referenceKind: 'raceline',
    seed: integerAt(runtime.seed, 'runtime.seed'),
    timestepS,
    durationS: samples[samples.length - 1].timeS - samples[0].timeS,
    sampleCount,
    meanAbsLateralDeviationM: reportedMean,
    maxAbsLateralDeviationM: reportedMax,
    droppedFrames: 0,
    capabilities: {
      pose: 'measured_m',
      speed: 'measured_mps',
      steering: 'measured_rad',
      throttle: 'unavailable',
      reference: 'raceline',
      braking: 'unavailable',
      collision: 'unavailable',
    },
    samples,
  };
};

const normalizeAutoDriveCapture = (input: unknown): NormalizedCore => {
  const root = recordAt(input, 'capture');
  const runtime = recordAt(root.runtime, 'runtime');
  const outcome = recordAt(root.outcome, 'outcome');
  const rawSamples = arrayAt(root.samples, 'samples');
  assertExact(root.schema_version, 'blurr.telemetry-session.v1', 'schema_version');
  assertExact(root.source_kind, 'autodrive', 'source_kind');
  assertExact(root.status, 'sealed', 'status');
  assertExact(runtime.simulator, 'AutoDRIVE Simulator', 'runtime.simulator');
  assertExact(runtime.receive_clock, 'python.time.monotonic', 'runtime.receive_clock');
  assertExact(runtime.bridge_mode, 'telemetry_only_no_command_reply', 'runtime.bridge_mode');

  if (rawSamples.length === 0) throw new Error('samples must not be empty');
  if (rawSamples.length > MAX_SESSION_SAMPLES) throw new Error(`samples exceeds the ${MAX_SESSION_SAMPLES} sample limit`);
  let previousSequence = -1;
  let previousTime = -1;
  const samples = rawSamples.map((value, index): ReplaySample => {
    const sample = recordAt(value, `samples[${index}]`);
    const telemetry = recordAt(sample.telemetry, `samples[${index}].telemetry`);
    const sequence = integerAt(sample.sequence, `samples[${index}].sequence`);
    const timeS = numberAt(sample.received_monotonic_s, `samples[${index}].received_monotonic_s`);
    if (sequence <= previousSequence) throw new Error('sample sequence must be strictly increasing');
    if (timeS < 0 || timeS <= previousTime) throw new Error('sample receive time must be nonnegative and strictly increasing');
    previousSequence = sequence;
    previousTime = timeS;
    const position = optionalVectorAt(telemetry.position, `samples[${index}].telemetry.position`, 2);
    // Validate bounded orientation vectors if present, but make no angle-unit claim.
    optionalVectorAt(telemetry.orientation_euler, `samples[${index}].telemetry.orientation_euler`, 3);
    optionalVectorAt(telemetry.orientation_quaternion, `samples[${index}].telemetry.orientation_quaternion`, 4);
    return {
      sequence,
      timeS,
      positionUnit: 'source_unit_unavailable',
      poseXM: position?.[0] ?? null,
      poseYM: position?.[1] ?? null,
      headingRad: null,
      speedMps: null,
      steeringRad: optionalNumberAt(telemetry.steering, `samples[${index}].telemetry.steering`),
      throttle: optionalNumberAt(telemetry.throttle, `samples[${index}].telemetry.throttle`),
      lateralDeviationM: null,
      headingDeviationRad: null,
      referenceSM: null,
      optimalSpeedMps: null,
      curvaturePerM: null,
    };
  });

  const sampleCount = integerAt(outcome.sample_count, 'outcome.sample_count');
  if (sampleCount !== samples.length) throw new Error('outcome.sample_count does not match samples');
  const droppedFrames = integerAt(outcome.dropped_frames, 'outcome.dropped_frames');
  if (droppedFrames < 0) throw new Error('outcome.dropped_frames must be nonnegative');
  const capturedAtUtc = stringAt(root.captured_at_utc, 'captured_at_utc');
  if (!Number.isFinite(Date.parse(capturedAtUtc))) throw new Error('captured_at_utc must be an ISO timestamp');
  const vehicleId = stringAt(runtime.vehicle_id, 'runtime.vehicle_id');

  return {
    schemaVersion: 'blurr.local-session.v1',
    source: 'autodrive',
    simulator: 'AutoDRIVE Simulator',
    circuitName: `AutoDRIVE ${vehicleId} telemetry`,
    capturedAtUtc,
    analysisVersion: 'raw-v1',
    referenceKind: 'unavailable',
    seed: null,
    timestepS: null,
    durationS: samples[samples.length - 1].timeS - samples[0].timeS,
    sampleCount,
    meanAbsLateralDeviationM: null,
    maxAbsLateralDeviationM: null,
    droppedFrames,
    capabilities: {
      pose: samples.some((sample) => sample.poseXM !== null && sample.poseYM !== null) ? 'reported_source_unit' : 'unavailable',
      speed: 'unavailable',
      steering: 'reported_source_unit',
      throttle: 'reported_source_unit',
      reference: 'unavailable',
      braking: 'unavailable',
      collision: 'unavailable',
    },
    samples,
  };
};

export const importSealedSessionFile = async (
  file: Pick<File, 'name' | 'size' | 'arrayBuffer'>,
  importedAtUtc = new Date().toISOString(),
): Promise<StoredSession> => {
  if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Only sealed JSON capture files are supported');
  if (file.size <= 0) throw new Error('Session file is empty');
  if (file.size > MAX_SESSION_BYTES) throw new Error(`Session exceeds the ${MAX_SESSION_BYTES} byte limit`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size) throw new Error('Session byte count changed while reading');
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('Session is not valid UTF-8 JSON');
  }
  const root = recordAt(parsed, 'capture');
  const core = root.source_kind === 'f1tenth'
    ? normalizeF1Capture(parsed)
    : root.source_kind === 'autodrive'
      ? normalizeAutoDriveCapture(parsed)
      : (() => { throw new Error('source_kind must be f1tenth or autodrive'); })();
  const canonicalBytes = new TextEncoder().encode(stableStringify(asJsonValue(core)));
  const [sourceFileSha256, canonicalSha256] = await Promise.all([sha256(bytes), sha256(canonicalBytes)]);
  return {
    ...core,
    id: `${core.source}:${canonicalSha256.slice(0, 24)}`,
    importedAtUtc,
    sourceFileName: file.name,
    sourceFileBytes: bytes.byteLength,
    sourceFileSha256,
    canonicalSha256,
  };
};

const isStoredSession = (value: unknown): value is StoredSession => {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 'blurr.local-session.v1'
    && typeof value.id === 'string'
    && typeof value.canonicalSha256 === 'string'
    && Array.isArray(value.samples)
    && value.sampleCount === value.samples.length;
};

export class LocalSessionStore {
  private readonly storage: StorageLike;

  constructor(storage: StorageLike) {
    this.storage = storage;
  }

  save(session: StoredSession): StoredSession {
    const key = `${STORAGE_PREFIX}${session.id}`;
    const existing = this.storage.getItem(key);
    if (existing !== null) {
      const parsed: unknown = JSON.parse(existing);
      if (!isStoredSession(parsed) || parsed.canonicalSha256 !== session.canonicalSha256) {
        throw new Error(`Stored session collision for ${session.id}`);
      }
      return parsed;
    }
    this.storage.setItem(key, JSON.stringify(session));
    return session;
  }

  list(): StoredSession[] {
    const sessions: StoredSession[] = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      const raw = this.storage.getItem(key);
      if (raw === null) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isStoredSession(parsed)) sessions.push(parsed);
      } catch {
        // Corrupt entries are isolated and omitted; a valid session is never replaced by them.
      }
    }
    return sessions.sort((left, right) => right.capturedAtUtc.localeCompare(left.capturedAtUtc));
  }

  load(id: string): StoredSession | null {
    const raw = this.storage.getItem(`${STORAGE_PREFIX}${id}`);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredSession(parsed)) throw new Error(`Stored session ${id} is corrupt`);
    return parsed;
  }

  remove(id: string): void {
    this.storage.removeItem(`${STORAGE_PREFIX}${id}`);
  }
}
