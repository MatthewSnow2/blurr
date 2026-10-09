import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REPORT_CONTRACT_VERSION,
  TEMPLATE_CATALOGUE,
  lintTemplateCatalogue,
  validateAndRenderReport,
  type EvidenceStore,
  type TemplateDefinition,
} from '../src/coaching/reportContract.ts';

const evidence = (): EvidenceStore => ({
  metrics: {
    cte_lap_1: {
      id: 'cte_lap_1',
      label: 'Lap 1 mean cross-track error',
      unit: 'm',
      scope: 'lap',
      scopeId: 'lap-1',
      value: 0.42,
    },
    cte_lap_2: {
      id: 'cte_lap_2',
      label: 'Lap 2 mean cross-track error',
      unit: 'm',
      scope: 'lap',
      scopeId: 'lap-2',
      value: 0.31,
    },
    cte_series: {
      id: 'cte_series',
      label: 'Mean cross-track error',
      unit: 'm',
      scope: 'session',
      scopeId: 'session-1',
      value: 0.365,
      series: { granularity: 'lap', values: [0.42, 0.31] },
    },
    session_only_cte: {
      id: 'session_only_cte',
      label: 'Session mean cross-track error',
      unit: 'm',
      scope: 'session',
      scopeId: 'session-1',
      value: 0.365,
    },
  },
  events: {
    excursion_1: {
      id: 'excursion_1',
      label: 'Raceline excursion',
      classification: 'raceline_excursion',
      startSample: 40,
      endSample: 52,
    },
  },
  occurrences: {
    collision_status: {
      id: 'collision_status',
      label: 'Barrier contact',
      channel: 'collision',
      status: 'absent',
    },
  },
  capabilities: {
    collision: 'measured',
    brake: 'unavailable',
  },
});

const report = (claims: unknown[], interpretations: unknown[] = []) => ({
  contract_version: REPORT_CONTRACT_VERSION,
  claims,
  interpretations,
  drill_id: 'steady_line',
});

const codes = (result: ReturnType<typeof validateAndRenderReport>): string[] =>
  result.status === 'invalid' ? result.issues.map((issue) => issue.code) : [];

test('the reviewed built-in template catalogue passes automated supplemental lint', () => {
  assert.deepEqual(lintTemplateCatalogue(TEMPLATE_CATALOGUE), []);
});

test('catalogue lint rejects embedded premises and missing explicit review', () => {
  const unsafe = [{
    id: 'unsafe',
    version: 1,
    text: 'The higher value followed late braking: {claim}.',
    slots: { claim: { type: 'claim_ref' } },
    requiredChannels: {},
    review: { fixedTextReviewed: false, enumRenderingsReviewed: true, note: '' },
  }] as unknown as readonly TemplateDefinition[];

  assert.deepEqual(
    new Set(lintTemplateCatalogue(unsafe).map((issue) => issue.code)),
    new Set(['TEMPLATE_REVIEW_REQUIRED', 'EMBEDDED_PREMISE']),
  );
});

test('catalogue lint reviews enum renderings as well as fixed text', () => {
  const unsafe = [{
    id: 'unsafe_enum',
    version: 1,
    text: 'Suggestion: examine {claim} using {mode}.',
    slots: {
      claim: { type: 'claim_ref' },
      mode: { type: 'enum', values: { unsafe: 'higher-speed mode' } },
    },
    requiredChannels: {},
    review: { fixedTextReviewed: true, enumRenderingsReviewed: true, note: 'Reviewed for test.' },
  }] as const satisfies readonly TemplateDefinition[];

  assert.ok(lintTemplateCatalogue(unsafe).some((issue) => issue.code === 'ENUM_PREMISE'));
});

test('valid typed claims and reviewed templates render only server-derived facts', () => {
  const result = validateAndRenderReport(report([
    { id: 'metric', type: 'metric_value', evidence_id: 'cte_lap_2' },
    { id: 'comparison', type: 'comparison', left_evidence_id: 'cte_lap_1', right_evidence_id: 'cte_lap_2', direction: 'higher' },
    { id: 'trend', type: 'trend', evidence_id: 'cte_series', direction: 'decreasing' },
    { id: 'absence', type: 'absence', occurrence_id: 'collision_status' },
  ], [
    { template_id: 'review_claim_in_drill', slot_bindings: { claim: 'trend', drill: 'steady_line' } },
    { template_id: 'unverified_relationship', slot_bindings: { claim_a: 'comparison', claim_b: 'absence' } },
  ]), evidence());

  assert.equal(result.status, 'valid');
  if (result.status === 'valid') {
    assert.match(result.report.claims[0].rendered, /0\.31 m/u);
    assert.match(result.report.claims[2].rendered, /decreasing across lap scopes/u);
    assert.match(result.report.claims[3].rendered, /did not occur/u);
    assert.match(result.report.interpretations[1].rendered, /^Hypothesis \(unverified\):/u);
  }
});

test('valid evidence IDs cannot support a trend without scoped series evidence', () => {
  const result = validateAndRenderReport(report([
    { id: 'unsupported', type: 'trend', evidence_id: 'session_only_cte', direction: 'decreasing' },
  ]), evidence());

  assert.deepEqual(codes(result), ['TREND_SERIES_REQUIRED']);
});

test('comparison direction is checked against evidence values', () => {
  const result = validateAndRenderReport(report([
    { id: 'wrong', type: 'comparison', left_evidence_id: 'cte_lap_1', right_evidence_id: 'cte_lap_2', direction: 'lower' },
  ]), evidence());

  assert.deepEqual(codes(result), ['COMPARISON_NOT_SUPPORTED']);
});

test('causal prose cannot be smuggled in as a factual claim type', () => {
  const result = validateAndRenderReport(report([
    { id: 'cause', type: 'causal', evidence_id: 'cte_lap_1' },
  ]), evidence());

  assert.deepEqual(codes(result), ['UNSUPPORTED_CLAIM_TYPE']);
});

test('numberless collision occurrence contradicting measured absence rejects the whole report', () => {
  const result = validateAndRenderReport(report([
    { id: 'contact', type: 'occurrence', occurrence_id: 'collision_status' },
  ]), evidence());

  assert.deepEqual(codes(result), ['OCCURRENCE_NOT_SUPPORTED']);
});

test('an unavailable collision channel cannot support occurrence or absence', () => {
  const store = evidence();
  store.capabilities.collision = 'unavailable';
  store.occurrences.collision_status.status = 'unavailable';

  const result = validateAndRenderReport(report([
    { id: 'contact', type: 'absence', occurrence_id: 'collision_status' },
  ]), store);

  assert.deepEqual(codes(result), ['CHANNEL_NOT_MEASURED']);
});

test('free report prose is structurally rejected', () => {
  const withSummary = { ...report([]), summary: 'Contact with the barrier occurred.' };
  assert.deepEqual(codes(validateAndRenderReport(withSummary, evidence())), ['INVALID_KEYS']);

  const withInterpretationText = report([], [
    { template_id: 'review_claim_in_drill', slot_bindings: {}, text: 'Contact with the barrier occurred.' },
  ]);
  assert.deepEqual(codes(validateAndRenderReport(withInterpretationText, evidence())), ['INVALID_KEYS']);
});

test('unknown templates, unresolved claim slots, and free numeric slots fail closed', () => {
  const unknown = validateAndRenderReport(report([], [
    { template_id: 'late_braking_may_explain', slot_bindings: {} },
  ]), evidence());
  assert.deepEqual(codes(unknown), ['UNKNOWN_TEMPLATE']);

  const unresolved = validateAndRenderReport(report([], [
    { template_id: 'review_claim_in_drill', slot_bindings: { claim: 'missing', drill: 'steady_line' } },
  ]), evidence());
  assert.deepEqual(codes(unresolved), ['CLAIM_REFERENCE_NOT_FOUND']);

  const freeNumber = validateAndRenderReport(report([
    { id: 'metric', type: 'metric_value', evidence_id: 'cte_lap_1' },
  ], [
    { template_id: 'review_claim_in_drill', slot_bindings: { claim: 'metric', drill: 120 } },
  ]), evidence());
  assert.deepEqual(codes(freeNumber), ['INVALID_STRING']);
});

test('event classification must match the recorded event', () => {
  const result = validateAndRenderReport(report([
    { id: 'event', type: 'event_occurrence', event_id: 'excursion_1', classification: 'collision' },
  ]), evidence());

  assert.deepEqual(codes(result), ['EVENT_CLASSIFICATION_MISMATCH']);
});
