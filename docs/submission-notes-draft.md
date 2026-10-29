# Submission notes: private draft, not an entry

Blurr is a simulator evidence lab for reviewing a sealed session before acting
on a coaching suggestion. It imports F1TENTH and AutoDRIVE JSON, replays recorded
samples and preserves browser-local history. Unsupported units and channels stay
unavailable. A typed report validator resolves every displayed claim to session
evidence and renders suggestions only through reviewed templates.

The current recorded demo opens the 600-sample F1TENTH Silverstone run A
session (sealed 23 October 2026, reconstructed runner, qualification pending)
with the real archived Nemotron report generated for that exact session. One
authorized Token Factory API request used NVIDIA's
`nvidia/nemotron-3-super-120b-a12b`; 1362input/594output tokens (USD0.0009432 at
official rates) and valid coaching-report.v1. The app revalidates the saved
report locally when opened, and opening it issues no inference request. Since
28 October the hosted site also has a "Run live coaching" button that makes
one capped Token Factory call for a bundled session (README "Live coaching
on the hosted site"). The earlier two-frame synthetic AutoDRIVE replay and its 15 October
response still import manually, and a retained 600-sample fixture shows an
earlier f1tenth_gym execution on an original analytic synthetic circuit. None
of these is physical robot telemetry.

Intended track for owner review: Physical AI, simulation-only. The official FAQ
allows simulation, so a physical Wheelie demonstration is unnecessary for this
version. The rules require at least one minute of key modules operating when
hardware is absent. The 2:50 video plan in `demo-sequence-draft.md` meets the length target but must
still be recorded and checked. No video has been uploaded by this task.

The October work adds sealed import/history/replay, byte-identical LAN-safe
hashing, grounded report contracts, bounded/journaled server exchange, one actual
NVIDIA/Nebius response and a saved-response UI. This documents concrete updates
during the submission window; the owner must confirm original-project dates and
authorship before submitting an existing-project explanation.

Draft tool feedback: the OpenAI-compatible response and explicit reasoning-token
usage supported this bounded verification. Public machine-readable model prices
were available at `/api/public/models_info`, while the interactive catalog was
less accessible to plain web retrieval. Explicit separation of response
provenance from claim validity helped avoid treating a fixture as provider proof.
Eight requests were observed between 15 and 27 October 2026 (UTC), one per saved
report, about USD 0.0088 in total at published rates (inventory in
`submission-package.md`). No latency/quality/general reliability benchmark or
driver-improvement claim is supported.

Owner gates settled: root license Apache-2.0 with the Silverstone data under
GPL-3.0, asset redistribution cleared 23 October 2026, and the public repository
https://github.com/MatthewSnow2/blurr. Owner gates still open: eligibility/track
decision, judge access check on the published build, public YouTube video
strictly shorter than 3 minutes, final English description, feedback and update
explanation, and owner submission/legal acceptance. Each paid call needs its own
approval constant; every allowance so far is consumed (the synthetic fixture,
Silverstone run A, and on 26 October the circle, the three ladder runs, and the
Silverstone baseline and retest lap attempts).

## Claim-to-evidence list

Status: **verified** means checked against files or a run on 25 October 2026
(`qualification-review-2026-10-25.md`); **recorded** means taken from an
owner-held 23 October receipt and not re-run; **open** means not yet true.

| Claim | Source | Limitation | Status |
|---|---|---|---|
| The default demo is F1TENTH Silverstone run A, 600 steps, 5.99 s simulated | `fixtures/provenance.json`, `data/f1tenth-silverstone/run-a-session.json`, `tests/recordedDemo.test.ts` | About 14.5 m of one straight, not a lap | verified |
| The bundled run A files are byte-identical to the sealed originals | sha256 in the manifest and the qualification review | Receipts are not in the repository | verified |
| Run A was reproduced by run B with identical stable fields | capture receipt `f1tenth-capture-6eca279-20261023` | Simulated only; `real_simulator_qualification` pending | recorded |
| One real Nebius Token Factory call used `nvidia/nemotron-3-super-120b-a12b` on run A | `run-a-nebius-report.json`, receipt `nebius-run-a-20261023` | Provider metadata is attributed to the file, not authenticated by the browser | recorded |
| That call cost USD 0.0009432 | receipt `cost-proof.json`, 1362 input and 594 output tokens at 0.30 and 0.90 USD per million | Calculated from published rates; invoice not observed | recorded |
| Every displayed report claim resolves to session evidence | `docs/report-contract.md`, `tests/reportContract.test.ts`, `tests/savedProviderReport.test.ts` | Validates claims, not coaching quality | verified |
| Viewing the demo makes no provider call and no external request | `src/demo/recordedDemo.ts`, browser journey | Checked in Chromium only | verified |
| A missing or mismatched demo file fails closed with a specific message | `tests/recordedDemo.test.ts`, browser 404 check | | verified |
| AutoDRIVE input is supported | `fixtures/autodrive-synthetic-session.json` | Synthetic two-frame fixture; no live stream | verified (import only) |
| A ladder-swept controller setting got further on held-out Silverstone than the default (68 m vs 30 m before the run terminated; manifest label: collided) | `data/f1tenth-sweep/`, `data/f1tenth-silverstone/{baseline,retest}-lap-*`, `tests/test_select_sweep_setting.py` | Offline tuning, not learning; one deterministic run per condition; gain and lookahead distance change together; neither completed a lap; retest termination not diagnosed | verified |
| The app shows proven driving improvement | none | Not claimed | not claimed |
| Eight Nebius calls in total, about USD 0.0088 | the eight saved `*-nebius-report.json` files (model, response ID, usage) | Calculated from published rates; invoices not observed | verified (files) |
| Baseline and retest lap attempts import and validate in the app | browser QA on 27 October 2026 at commit `116d943`, `submission-package.md` | Chromium only | verified |
| Demo video under 3 minutes | `docs/demo-sequence-draft.md` | Not recorded | open |

Official sources rechecked 2026-10-27T04:38Z (rules and FAQ):
https://nebiusglobalaihackathon.devpost.com/rules
https://nebiusglobalaihackathon.devpost.com/details/faqs
Deadline 30 October 2026 at 10:00 PDT = 17:00 UTC. No registration, submission, terms
acceptance, publication or physical action occurred in this checkpoint.
