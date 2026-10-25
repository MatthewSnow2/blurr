/** Dataset identity from fixtures/provenance.json, the single manifest for bundled captures and reports. */
export type DatasetClass = 'recorded_simulator_capture' | 'synthetic_fixture' | 'legacy_example' | 'saved_provider_report';

export interface DatasetEntry {
  file: string;
  path: string;
  sha256: string;
  dataset_class: DatasetClass;
  label?: string;
  session_canonical_sha256?: string;
  recorded_utc?: string | null;
  distribution: string;
  default_demo?: boolean;
}

export interface DatasetLabel { label: string; datasetClass: DatasetClass | 'unlisted_import'; distribution: string | null }

const CLASSES: readonly DatasetClass[] = ['recorded_simulator_capture', 'synthetic_fixture', 'legacy_example', 'saved_provider_report'];

export const parseDatasetManifest = (text: string): DatasetEntry[] => {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('MANIFEST_INVALID');
  return parsed.map((entry: unknown) => {
    const e = entry as Partial<DatasetEntry>;
    if (typeof e.file !== 'string' || typeof e.path !== 'string' || typeof e.sha256 !== 'string'
      || !CLASSES.includes(e.dataset_class as DatasetClass) || typeof e.distribution !== 'string') throw new Error('MANIFEST_INVALID');
    return e as DatasetEntry;
  });
};

/** The one session and report pair marked default_demo, bound to each other by canonical session digest. */
export const defaultDemoPair = (entries: DatasetEntry[]) => {
  const demo = entries.filter(e => e.default_demo);
  const session = demo.filter(e => e.dataset_class !== 'saved_provider_report');
  const report = demo.filter(e => e.dataset_class === 'saved_provider_report');
  if (session.length !== 1 || report.length !== 1 || !session[0].session_canonical_sha256
    || session[0].session_canonical_sha256 !== report[0].session_canonical_sha256) throw new Error('MANIFEST_DEFAULT_DEMO_INVALID');
  return { session: session[0], report: report[0] };
};

/** Label a loaded session by its canonical digest; anything not in the manifest is an unlisted import, never a guess. */
export const labelForSession = (entries: DatasetEntry[], canonicalSha256: string): DatasetLabel => {
  const match = entries.find(e => e.dataset_class !== 'saved_provider_report' && e.session_canonical_sha256 === canonicalSha256);
  return match
    ? { label: match.label ?? match.file, datasetClass: match.dataset_class, distribution: match.distribution }
    : { label: 'Imported capture, not in the bundled dataset manifest', datasetClass: 'unlisted_import', distribution: null };
};
