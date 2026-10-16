import { importRecordedFile, parseRecordedSession, type RecordedView } from './lib/recordedSession.ts';
import fixture from '../fixtures/recorded-synthetic-session.json?raw';
import './recorded.css';

const element = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing recorded view element: ${id}`);
  return node as T;
};
const form = element<HTMLFormElement>('recorded-form');
const fileInput = element<HTMLInputElement>('recorded-file');
const digest = element<HTMLInputElement>('recorded-digest');
const slider = element<HTMLInputElement>('sample-slider');
const error = element('import-error');
const status = element('import-status');
element('sealed-history-link').hidden = import.meta.env.VITE_RECORDED_STANDALONE === 'true';
let selected: RecordedView | null = null;
let generation = 0;

const details = (id: string, fields: [string, string][]) => {
  const target = element(id);
  target.replaceChildren();
  for (const [label, value] of fields) {
    const term = document.createElement('dt'), description = document.createElement('dd');
    term.textContent = label; description.textContent = value;
    target.append(term, description);
  }
};
const renderSample = () => {
  if (!selected) return;
  const sample = selected.samples[Number(slider.value)];
  details('sample-details', [['Sequence', String(sample.sequence)], ['Original wall-clock label', sample.wallLabel],
    ['Wall-clock offset', `${sample.wallOffsetS} s`], ...sample.channels.map(({ label, value }): [string, string] => [label, value])]);
};
const render = (view: RecordedView) => {
  selected = view;
  element('recording').hidden = false; element('empty-recording').hidden = true;
  element('evidence-label').textContent = view.evidenceLabel;
  details('recording-summary', [['Samples', String(view.samples.length)], ['Wall-clock span', `${view.wallSpanS} s`],
    ['Clock', view.clockLabel], ['Timezone', view.timezoneLabel], ['Physical outputs', 'Disabled; file inspection only']]);
  const limits = element('recording-limits'); limits.replaceChildren();
  for (const text of view.limitations) { const item = document.createElement('li'); item.textContent = text; limits.append(item); }
  details('recording-provenance', [['Source', view.sourceLabel], ['Source contract commit', view.contract],
    ['Original CSV SHA-256 · declared by importer', view.inputSha256], ['Imported JSON SHA-256 · checked against supplied receipt', view.fileSha256],
    ['Imported JSON bytes', String(view.fileBytes)]]);
  slider.max = String(view.samples.length - 1); slider.value = '0'; slider.disabled = view.samples.length === 1;
  renderSample();
};
const open = async (load: () => Promise<RecordedView>) => {
  const current = ++generation;
  error.hidden = true; error.textContent = ''; status.textContent = 'Validating recording…';
  try {
    const view = await load();
    if (current !== generation) return;
    render(view); status.textContent = 'Recording opened locally. No live capture is verified.';
  } catch (caught) {
    if (current !== generation) return;
    error.textContent = `${caught instanceof Error ? caught.message : 'Recording could not be opened'}. ${selected ? 'The previous validated recording remains visible.' : 'No recording was opened.'}`;
    error.hidden = false; status.textContent = '';
  }
};
form.addEventListener('submit', event => {
  event.preventDefault();
  const file = fileInput.files?.[0];
  void open(() => {
    if (!file) throw new Error('Select a recorded session JSON file');
    return importRecordedFile(file, digest.value);
  });
});
element('open-fixture').addEventListener('click', () => {
  void open(() => parseRecordedSession(new TextEncoder().encode(fixture), '68e7f67b63071c0a52feb7432f1b971bbf71dbf05474ae74aebc10d23aacf2b8'));
});
element('clear-recording').addEventListener('click', () => {
  generation += 1; selected = null; form.reset();
  element('recording').hidden = true; element('empty-recording').hidden = false;
  error.hidden = true; error.textContent = ''; status.textContent = 'Recording cleared.';
  for (const id of ['recording-summary', 'sample-details', 'recording-provenance', 'recording-limits']) element(id).replaceChildren();
  element('evidence-label').textContent = '';
});
slider.addEventListener('input', renderSample);
