import { sha256 } from './sha256.ts';

export const MAX_RECORDED_BYTES = 15 * 1024 * 1024;
export const MAX_RECORDED_SAMPLES = 50_000;
export const RECORDER_CONTRACT = '635dbb6d86ec98e25ea845a97188f7bbe85a09e8';

// Presentation is independent of a simulator, transport or coaching provider.
// Source adapters must validate their own semantics before producing this view.
export interface RecordedView {
  evidenceLabel: string;
  sourceLabel: string;
  contract: string;
  inputSha256: string;
  fileSha256: string;
  fileBytes: number;
  wallSpanS: number;
  clockLabel: string;
  timezoneLabel: string;
  limitations: string[];
  samples: { sequence: number; wallLabel: string; wallOffsetS: number; channels: { label: string; value: string }[] }[];
}

const record = (value: unknown, name: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
};
const keys = (value: Record<string, unknown>, expected: string[], name: string) => {
  if (Object.keys(value).length !== expected.length || expected.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error(`${name} has missing or unsupported fields`);
  }
};
const exact = (value: unknown, expected: unknown, name: string) => {
  if (value !== expected) throw new Error(`${name} is unsupported`);
};
const finite = (value: unknown, name: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
};
const hash = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${name} must be a lowercase SHA-256`);
  return value;
};

// Local labels are calendar-checked using UTC arithmetic only. This never
// identifies the source timezone or reconstructs a UTC acquisition timestamp.
const wallMilliseconds = (value: unknown): number => {
  if (typeof value !== 'string' || !/^\d{4}(?:_\d{2}){5}_\d{3}$/.test(value)) throw new Error('Invalid recorder wall-clock label');
  const parts = value.split('_').map(Number);
  const [year, month, day, hour, minute, second, millisecond] = parts;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);
  const actual = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()];
  if (year < 1 || actual.some((number, index) => number !== parts[index])) throw new Error('Invalid wall-clock calendar value');
  return date.getTime();
};

// JSON.parse validates the grammar; this iterative token pass rejects ambiguous
// duplicate object fields without recursively traversing arbitrary input.
const parseUnique = (text: string): unknown => {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Recording must contain valid JSON'); }
  const stack: { names: Set<string> | null; expectKey: boolean }[] = [];
  for (const token of text.matchAll(/"(?:[^"\\]|\\.)*"|[{}[\],:]/g)) {
    const word = token[0];
    if (word === '{' || word === '[') stack.push({ names: word === '{' ? new Set() : null, expectKey: word === '{' });
    else if (word === '}' || word === ']') stack.pop();
    else if (word === ',') { if (stack[stack.length - 1]?.names) stack[stack.length - 1]!.expectKey = true; }
    else if (word.startsWith('"')) {
      const frame = stack[stack.length - 1];
      if (frame?.names && frame.expectKey) {
        const name = JSON.parse(word) as string;
        if (frame.names.has(name)) throw new Error('Recording contains a duplicate JSON field');
        frame.names.add(name); frame.expectKey = false;
      }
    }
  }
  return value;
};

export const parseRecordedSession = async (bytes: Uint8Array, expectedSha256: string): Promise<RecordedView> => {
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_RECORDED_BYTES) throw new Error('Recording must be between 1 byte and 15 MiB');
  const expected = hash(expectedSha256, 'Expected file digest');
  const fileSha256 = await sha256(bytes);
  if (fileSha256 !== expected) throw new Error('Recording SHA-256 does not match the supplied receipt');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('Recording must be UTF-8'); }
  const root = record(parseUnique(text), 'Recording');
  keys(root, ['schema_version', 'status', 'source_kind', 'source_format', 'source_contract_commit', 'input_sha256', 'declared_evidence_kind', 'provenance', 'capabilities', 'excluded_export_channels', 'sample_count', 'wall_span_s', 'samples'], 'Recording');
  exact(root.schema_version, 'blurr.autodrive-recorded-session.v1', 'Recorded schema');
  exact(root.status, 'imported_recorded_file', 'Status');
  exact(root.source_kind, 'autodrive_recorded_csv', 'Source kind');
  exact(root.source_format, 'autodrive_0.3.0_vehicle_csv_21_columns', 'Source format');
  exact(root.source_contract_commit, RECORDER_CONTRACT, 'Source contract');
  if (root.declared_evidence_kind !== 'synthetic_fixture' && root.declared_evidence_kind !== 'recorded_unverified') throw new Error('Evidence kind is unsupported');
  const provenance = record(root.provenance, 'Provenance');
  const expectedProvenance = { mode: 'post_session_recorded_file', clock: 'unity_DateTime.Now_local_wall_clock', timezone: 'unrecorded', utc_reconstruction: false, monotonic_reception_verified: false, live_capture_verified: false, physical_output_enabled: false, producer_authentication: 'not_established' };
  keys(provenance, Object.keys(expectedProvenance), 'Provenance');
  for (const [key, value] of Object.entries(expectedProvenance)) exact(provenance[key], value, `Provenance ${key}`);
  const capabilities = record(root.capabilities, 'Capabilities');
  const expectedCapabilities = { numeric_channels: 'reported_source_units_unverified', encoder_counts: 'source_float_precision_not_exact_count_proof', speed_mps: 'unavailable', reference: 'unavailable', braking: 'unavailable', collision: 'unavailable' };
  keys(capabilities, Object.keys(expectedCapabilities), 'Capabilities');
  for (const [key, value] of Object.entries(expectedCapabilities)) exact(capabilities[key], value, `Capability ${key}`);
  if (JSON.stringify(root.excluded_export_channels) !== JSON.stringify(['front_camera_path', 'rear_camera_path', 'export_time_lidar_ranges'])) throw new Error('Excluded export channels are unsupported');
  if (!Array.isArray(root.samples) || root.samples.length < 1 || root.samples.length > MAX_RECORDED_SAMPLES || root.sample_count !== root.samples.length) throw new Error('Recording must contain 1–50,000 samples with a matching count');
  const descriptors: [string, string, number][] = [
    ['throttle_source', 'Throttle · source unit unspecified', 1], ['steering_source', 'Steering · source unit unspecified', 1],
    ['encoder_ticks_reported_float', 'Encoder values · source floats', 2], ['position_source', 'Position XYZ · source unit unspecified', 3],
    ['orientation_euler_source', 'Orientation · source unit unspecified', 3], ['velocity_local_z_source', 'Local-Z velocity · source unit unspecified', 1],
    ['angular_velocity_source', 'Angular velocity · source unit unspecified', 3], ['linear_acceleration_source', 'Acceleration · source unit unspecified', 3],
  ];
  let first = 0, previous = 0;
  const samples = root.samples.map((value: unknown, index: number) => {
    const row = record(value, `Sample ${index + 1}`);
    keys(row, ['sequence', 'recorded_wall_time', 'wall_offset_s', 'telemetry'], 'Sample');
    exact(row.sequence, index + 1, 'Sequence');
    const wall = wallMilliseconds(row.recorded_wall_time);
    if (index === 0) first = wall;
    else if (wall <= previous) throw new Error('Wall-clock labels must strictly increase');
    previous = wall;
    const offset = (wall - first) / 1000;
    exact(row.wall_offset_s, offset, 'Wall-clock offset');
    const telemetry = record(row.telemetry, 'Telemetry');
    keys(telemetry, descriptors.map(([key]) => key), 'Telemetry');
    const channels = descriptors.map(([key, label, size]) => {
      const values = size === 1 ? [telemetry[key]] : telemetry[key];
      if (!Array.isArray(values) || values.length !== size) throw new Error(`${key} has an invalid dimension`);
      return { label, value: values.map(value => String(finite(value, key))).join(', ') };
    });
    return { sequence: index + 1, wallLabel: row.recorded_wall_time as string, wallOffsetS: offset, channels };
  });
  exact(root.wall_span_s, samples[samples.length - 1].wallOffsetS, 'Wall span');
  return {
    evidenceLabel: root.declared_evidence_kind === 'synthetic_fixture' ? 'Synthetic fixture — not a genuine recording' : 'Unverified recording — genuine capture not established',
    sourceLabel: 'AutoDRIVE recorded CSV', contract: RECORDER_CONTRACT,
    inputSha256: hash(root.input_sha256, 'Original CSV digest'), fileSha256, fileBytes: bytes.byteLength,
    clockLabel: 'Recorder local wall clock; not monotonic reception or simulator time', timezoneLabel: 'Unrecorded; UTC acquisition time unavailable',
    wallSpanS: samples[samples.length - 1].wallOffsetS, samples,
    limitations: ['Live capture: unverified. Producer authentication: not established.',
      'Numeric source units are unverified. Encoder values were source floats; exact original counts are not established.',
      'Speed in m/s, reference deviation, braking and collision evidence are unavailable.',
      'Camera paths and export-time LiDAR are excluded. No referenced files are read.',
      'Digest checks establish byte integrity against your supplied receipt, not producer identity or genuine capture.'],
  };
};

export const importRecordedFile = async (file: Pick<File, 'size' | 'arrayBuffer'>, expectedSha256: string): Promise<RecordedView> => {
  if (file.size < 1 || file.size > MAX_RECORDED_BYTES) throw new Error('Recording must be between 1 byte and 15 MiB');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size) throw new Error('File size changed during import');
  return parseRecordedSession(bytes, expectedSha256);
};
