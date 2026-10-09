export const REPORT_CONTRACT_VERSION = 'coaching-report.v1' as const;

export type ChannelCapability = 'measured' | 'derived' | 'commanded' | 'unavailable';
export type EvidenceScope = 'session' | 'lap' | 'segment';
export type TrendGranularity = 'lap' | 'segment';

export interface MetricEvidence {
  id: string;
  label: string;
  unit: string;
  scope: EvidenceScope;
  scopeId: string;
  value: number;
  series?: {
    granularity: TrendGranularity;
    values: number[];
  };
}

export interface EventEvidence {
  id: string;
  label: string;
  classification: string;
  startSample: number;
  endSample: number;
}

export interface OccurrenceEvidence {
  id: string;
  label: string;
  channel: string;
  status: 'occurred' | 'absent' | 'unavailable';
  eventId?: string;
}

export interface EvidenceStore {
  metrics: Record<string, MetricEvidence>;
  events: Record<string, EventEvidence>;
  occurrences: Record<string, OccurrenceEvidence>;
  capabilities: Record<string, ChannelCapability>;
}

export type ClaimType =
  | 'metric_value'
  | 'comparison'
  | 'trend'
  | 'event_occurrence'
  | 'occurrence'
  | 'absence';

export interface ValidatedClaim {
  id: string;
  type: ClaimType;
  evidenceIds: string[];
  rendered: string;
}

export interface RenderedInterpretation {
  templateId: string;
  rendered: string;
}

export interface RenderedCoachingReport {
  contractVersion: typeof REPORT_CONTRACT_VERSION;
  claims: ValidatedClaim[];
  interpretations: RenderedInterpretation[];
  drillId: DrillId;
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export type ReportValidationResult =
  | { status: 'valid'; report: RenderedCoachingReport }
  | { status: 'invalid'; issues: ValidationIssue[] };

type SlotDefinition =
  | { type: 'claim_ref'; allowedClaimTypes?: ClaimType[] }
  | { type: 'evidence_ref' }
  | { type: 'enum'; values: Record<string, string> };

export interface TemplateDefinition {
  id: string;
  version: 1;
  text: string;
  slots: Record<string, SlotDefinition>;
  requiredChannels: Record<string, ChannelCapability>;
  review: {
    fixedTextReviewed: true;
    enumRenderingsReviewed: true;
    note: string;
  };
}

const DRILLS = {
  steady_line: 'steady-line',
  repeatable_corners: 'repeatable-corners',
  controlled_inputs: 'controlled-inputs',
} as const;

export type DrillId = keyof typeof DRILLS;

export const TEMPLATE_CATALOGUE: readonly TemplateDefinition[] = [
  {
    id: 'review_claim_in_drill',
    version: 1,
    text: 'Suggestion: examine {claim} during the {drill} simulator drill.',
    slots: {
      claim: { type: 'claim_ref' },
      drill: { type: 'enum', values: DRILLS },
    },
    requiredChannels: {},
    review: {
      fixedTextReviewed: true,
      enumRenderingsReviewed: true,
      note: 'Imperative suggestion only; every session-specific fact is supplied by the validated claim slot.',
    },
  },
  {
    id: 'unverified_relationship',
    version: 1,
    text: 'Hypothesis (unverified): {claim_a} may be related to {claim_b}.',
    slots: {
      claim_a: { type: 'claim_ref' },
      claim_b: { type: 'claim_ref' },
    },
    requiredChannels: {},
    review: {
      fixedTextReviewed: true,
      enumRenderingsReviewed: true,
      note: 'Explicitly unverified relationship; both factual premises are server-rendered validated claims.',
    },
  },
] as const;

const PREMISE_LEXICON = [
  'absent',
  'brake',
  'braked',
  'braking',
  'collision',
  'contact',
  'decreased',
  'earlier',
  'faster',
  'higher',
  'improved',
  'increased',
  'later',
  'lower',
  'occurred',
  'slower',
  'spun',
  'understeer',
  'worse',
  'worsened',
] as const;

class ContractViolation extends Error {
  readonly code: string;
  readonly path: string;

  constructor(code: string, path: string, message: string) {
    super(message);
    this.code = code;
    this.path = path;
  }

  asIssue(): ValidationIssue {
    return { code: this.code, path: this.path, message: this.message };
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, path: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new ContractViolation('INVALID_OBJECT', path, 'Expected an object.');
  }
  return value;
};

const requireString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ContractViolation('INVALID_STRING', path, 'Expected a non-empty string.');
  }
  return value;
};

const requireExactKeys = (value: Record<string, unknown>, keys: readonly string[], path: string): void => {
  const expected = new Set(keys);
  const unexpected = Object.keys(value).filter((key) => !expected.has(key));
  const missing = keys.filter((key) => !(key in value));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new ContractViolation(
      'INVALID_KEYS',
      path,
      `Unexpected keys: ${unexpected.join(', ') || '(none)'}; missing keys: ${missing.join(', ') || '(none)'}.`,
    );
  }
};

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    throw new ContractViolation('NONFINITE_EVIDENCE', 'evidence', 'Evidence values must be finite.');
  }
  return value.toFixed(3).replace(/\.?0+$/u, '');
};

const formatMetric = (metric: MetricEvidence): string => `${formatNumber(metric.value)} ${metric.unit}`;

const claimId = (claim: Record<string, unknown>, path: string): string => requireString(claim.id, `${path}.id`);

const metric = (store: EvidenceStore, id: unknown, path: string): MetricEvidence => {
  const evidenceId = requireString(id, path);
  const found = store.metrics[evidenceId];
  if (!found) {
    throw new ContractViolation('EVIDENCE_NOT_FOUND', path, `Metric evidence ${evidenceId} was not found.`);
  }
  return found;
};

const event = (store: EvidenceStore, id: unknown, path: string): EventEvidence => {
  const evidenceId = requireString(id, path);
  const found = store.events[evidenceId];
  if (!found) {
    throw new ContractViolation('EVIDENCE_NOT_FOUND', path, `Event evidence ${evidenceId} was not found.`);
  }
  return found;
};

const occurrence = (store: EvidenceStore, id: unknown, path: string): OccurrenceEvidence => {
  const evidenceId = requireString(id, path);
  const found = store.occurrences[evidenceId];
  if (!found) {
    throw new ContractViolation('EVIDENCE_NOT_FOUND', path, `Occurrence evidence ${evidenceId} was not found.`);
  }
  return found;
};

const directionMatches = (left: number, right: number, direction: string): boolean => {
  const tolerance = 1e-9;
  if (direction === 'higher') return left > right + tolerance;
  if (direction === 'lower') return left < right - tolerance;
  if (direction === 'equal') return Math.abs(left - right) <= tolerance;
  return false;
};

const seriesDirectionMatches = (values: number[], direction: string): boolean => {
  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) return false;
  const tolerance = 1e-9;
  const deltas = values.slice(1).map((value, index) => value - values[index]);
  if (direction === 'increasing') return deltas.every((delta) => delta >= -tolerance) && deltas.some((delta) => delta > tolerance);
  if (direction === 'decreasing') return deltas.every((delta) => delta <= tolerance) && deltas.some((delta) => delta < -tolerance);
  if (direction === 'stable') return deltas.every((delta) => Math.abs(delta) <= tolerance);
  return false;
};

const validateClaim = (input: unknown, store: EvidenceStore, path: string): ValidatedClaim => {
  const claim = requireRecord(input, path);
  const type = requireString(claim.type, `${path}.type`) as ClaimType;
  const id = claimId(claim, path);

  if (type === 'metric_value') {
    requireExactKeys(claim, ['id', 'type', 'evidence_id'], path);
    const found = metric(store, claim.evidence_id, `${path}.evidence_id`);
    return { id, type, evidenceIds: [found.id], rendered: `${found.label}: ${formatMetric(found)}.` };
  }

  if (type === 'comparison') {
    requireExactKeys(claim, ['id', 'type', 'left_evidence_id', 'right_evidence_id', 'direction'], path);
    const left = metric(store, claim.left_evidence_id, `${path}.left_evidence_id`);
    const right = metric(store, claim.right_evidence_id, `${path}.right_evidence_id`);
    const direction = requireString(claim.direction, `${path}.direction`);
    if (left.unit !== right.unit) {
      throw new ContractViolation('UNIT_MISMATCH', path, 'Comparison operands must use the same unit.');
    }
    if (!directionMatches(left.value, right.value, direction)) {
      throw new ContractViolation('COMPARISON_NOT_SUPPORTED', path, 'The evidence does not support the asserted comparison direction.');
    }
    return {
      id,
      type,
      evidenceIds: [left.id, right.id],
      rendered: `${left.label} (${formatMetric(left)}) was ${direction} than ${right.label} (${formatMetric(right)}).`,
    };
  }

  if (type === 'trend') {
    requireExactKeys(claim, ['id', 'type', 'evidence_id', 'direction'], path);
    const found = metric(store, claim.evidence_id, `${path}.evidence_id`);
    const direction = requireString(claim.direction, `${path}.direction`);
    if (!found.series) {
      throw new ContractViolation('TREND_SERIES_REQUIRED', path, 'Trend claims require a stored scoped series.');
    }
    if (!seriesDirectionMatches(found.series.values, direction)) {
      throw new ContractViolation('TREND_NOT_SUPPORTED', path, 'The stored series does not support the asserted trend.');
    }
    return {
      id,
      type,
      evidenceIds: [found.id],
      rendered: `${found.label} was ${direction} across ${found.series.granularity} scopes.`,
    };
  }

  if (type === 'event_occurrence') {
    requireExactKeys(claim, ['id', 'type', 'event_id', 'classification'], path);
    const found = event(store, claim.event_id, `${path}.event_id`);
    const classification = requireString(claim.classification, `${path}.classification`);
    if (found.classification !== classification) {
      throw new ContractViolation('EVENT_CLASSIFICATION_MISMATCH', path, 'The event classification does not match the evidence.');
    }
    return {
      id,
      type,
      evidenceIds: [found.id],
      rendered: `${found.label} occurred from sample ${found.startSample} through ${found.endSample}.`,
    };
  }

  if (type === 'occurrence' || type === 'absence') {
    requireExactKeys(claim, ['id', 'type', 'occurrence_id'], path);
    const found = occurrence(store, claim.occurrence_id, `${path}.occurrence_id`);
    if (store.capabilities[found.channel] !== 'measured' || found.status === 'unavailable') {
      throw new ContractViolation('CHANNEL_NOT_MEASURED', path, `Channel ${found.channel} is not measured for this session.`);
    }
    const expected = type === 'occurrence' ? 'occurred' : 'absent';
    if (found.status !== expected) {
      throw new ContractViolation('OCCURRENCE_NOT_SUPPORTED', path, `The channel records ${found.status}, not ${expected}.`);
    }
    return {
      id,
      type,
      evidenceIds: [found.id, ...(found.eventId ? [found.eventId] : [])],
      rendered: type === 'occurrence' ? `${found.label} occurred.` : `${found.label} did not occur.`,
    };
  }

  throw new ContractViolation('UNSUPPORTED_CLAIM_TYPE', `${path}.type`, `Claim type ${type} is not allowed.`);
};

const fixedText = (template: string): string => template.replace(/\{[a-z_]+\}/gu, ' ');

export const lintTemplateCatalogue = (catalogue: readonly TemplateDefinition[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  catalogue.forEach((template, index) => {
    const path = `catalogue[${index}]`;
    if (seen.has(template.id)) {
      issues.push({ code: 'DUPLICATE_TEMPLATE', path, message: `Template ${template.id} is duplicated.` });
    }
    seen.add(template.id);
    if (!template.review.fixedTextReviewed || !template.review.enumRenderingsReviewed || template.review.note.trim() === '') {
      issues.push({ code: 'TEMPLATE_REVIEW_REQUIRED', path, message: 'Fixed text and enum renderings require explicit catalogue review.' });
    }

    const renderedFixedText = fixedText(template.text).toLowerCase();
    for (const premise of PREMISE_LEXICON) {
      if (new RegExp(`\\b${premise}\\b`, 'u').test(renderedFixedText)) {
        issues.push({
          code: 'EMBEDDED_PREMISE',
          path: `${path}.text`,
          message: `Fixed template text contains premise-bearing token ${premise}; render it from a validated claim slot instead.`,
        });
      }
    }

    for (const [slotName, slot] of Object.entries(template.slots)) {
      if (!template.text.includes(`{${slotName}}`)) {
        issues.push({ code: 'UNUSED_TEMPLATE_SLOT', path: `${path}.slots.${slotName}`, message: 'Declared slot is not present in template text.' });
      }
      if (slot.type === 'enum') {
        for (const renderedValue of Object.values(slot.values)) {
          for (const premise of PREMISE_LEXICON) {
            if (new RegExp(`\\b${premise}\\b`, 'u').test(renderedValue.toLowerCase())) {
              issues.push({
                code: 'ENUM_PREMISE',
                path: `${path}.slots.${slotName}`,
                message: `Enum rendering contains premise-bearing token ${premise}; bind it to a validated claim instead.`,
              });
            }
          }
        }
      }
    }
  });

  return issues;
};

const catalogueIssues = lintTemplateCatalogue(TEMPLATE_CATALOGUE);
if (catalogueIssues.length > 0) {
  throw new Error(`Invalid built-in coaching template catalogue: ${catalogueIssues.map((issue) => issue.message).join('; ')}`);
}

const findEvidenceLabel = (store: EvidenceStore, id: string): string | undefined =>
  store.metrics[id]?.label ?? store.events[id]?.label ?? store.occurrences[id]?.label;

const validateInterpretation = (
  input: unknown,
  claims: ReadonlyMap<string, ValidatedClaim>,
  store: EvidenceStore,
  path: string,
): RenderedInterpretation => {
  const item = requireRecord(input, path);
  requireExactKeys(item, ['template_id', 'slot_bindings'], path);
  const templateId = requireString(item.template_id, `${path}.template_id`);
  const template = TEMPLATE_CATALOGUE.find((candidate) => candidate.id === templateId);
  if (!template) {
    throw new ContractViolation('UNKNOWN_TEMPLATE', `${path}.template_id`, `Template ${templateId} is not in the reviewed catalogue.`);
  }
  for (const [channel, required] of Object.entries(template.requiredChannels)) {
    if (store.capabilities[channel] !== required) {
      throw new ContractViolation('TEMPLATE_CHANNEL_UNAVAILABLE', path, `Template ${templateId} requires ${channel}=${required}.`);
    }
  }

  const bindings = requireRecord(item.slot_bindings, `${path}.slot_bindings`);
  requireExactKeys(bindings, Object.keys(template.slots), `${path}.slot_bindings`);
  const renderedSlots: Record<string, string> = {};

  for (const [slotName, definition] of Object.entries(template.slots)) {
    const value = requireString(bindings[slotName], `${path}.slot_bindings.${slotName}`);
    if (definition.type === 'claim_ref') {
      const claim = claims.get(value);
      if (!claim) {
        throw new ContractViolation('CLAIM_REFERENCE_NOT_FOUND', `${path}.slot_bindings.${slotName}`, `Validated claim ${value} was not found.`);
      }
      if (definition.allowedClaimTypes && !definition.allowedClaimTypes.includes(claim.type)) {
        throw new ContractViolation('CLAIM_TYPE_MISMATCH', `${path}.slot_bindings.${slotName}`, `Claim ${value} has the wrong type for this slot.`);
      }
      renderedSlots[slotName] = claim.rendered.replace(/[.]$/u, '');
    } else if (definition.type === 'evidence_ref') {
      const label = findEvidenceLabel(store, value);
      if (!label) {
        throw new ContractViolation('EVIDENCE_NOT_FOUND', `${path}.slot_bindings.${slotName}`, `Evidence ${value} was not found.`);
      }
      renderedSlots[slotName] = label;
    } else {
      const rendered = definition.values[value];
      if (!rendered) {
        throw new ContractViolation('ENUM_VALUE_NOT_ALLOWED', `${path}.slot_bindings.${slotName}`, `Enum value ${value} is not allowed.`);
      }
      renderedSlots[slotName] = rendered;
    }
  }

  const rendered = template.text.replace(/\{([a-z_]+)\}/gu, (_match, slotName: string) => renderedSlots[slotName]);
  return { templateId, rendered };
};

export const validateAndRenderReport = (input: unknown, store: EvidenceStore): ReportValidationResult => {
  try {
    const report = requireRecord(input, 'report');
    requireExactKeys(report, ['contract_version', 'claims', 'interpretations', 'drill_id'], 'report');
    if (report.contract_version !== REPORT_CONTRACT_VERSION) {
      throw new ContractViolation('CONTRACT_VERSION_MISMATCH', 'report.contract_version', `Expected ${REPORT_CONTRACT_VERSION}.`);
    }
    if (!Array.isArray(report.claims) || report.claims.length > 12) {
      throw new ContractViolation('INVALID_CLAIMS', 'report.claims', 'Claims must be an array with at most 12 entries.');
    }
    if (!Array.isArray(report.interpretations) || report.interpretations.length > 6) {
      throw new ContractViolation('INVALID_INTERPRETATIONS', 'report.interpretations', 'Interpretations must be an array with at most 6 entries.');
    }

    const claims = report.claims.map((claim, index) => validateClaim(claim, store, `report.claims[${index}]`));
    const claimsById = new Map<string, ValidatedClaim>();
    for (const claim of claims) {
      if (claimsById.has(claim.id)) {
        throw new ContractViolation('DUPLICATE_CLAIM_ID', 'report.claims', `Claim ID ${claim.id} is duplicated.`);
      }
      claimsById.set(claim.id, claim);
    }

    const interpretations = report.interpretations.map((item, index) =>
      validateInterpretation(item, claimsById, store, `report.interpretations[${index}]`),
    );
    const drillId = requireString(report.drill_id, 'report.drill_id') as DrillId;
    if (!(drillId in DRILLS)) {
      throw new ContractViolation('UNKNOWN_DRILL', 'report.drill_id', `Drill ${drillId} is not in the safe simulator-only catalogue.`);
    }

    return {
      status: 'valid',
      report: { contractVersion: REPORT_CONTRACT_VERSION, claims, interpretations, drillId },
    };
  } catch (error) {
    if (error instanceof ContractViolation) {
      return { status: 'invalid', issues: [error.asIssue()] };
    }
    throw error;
  }
};
