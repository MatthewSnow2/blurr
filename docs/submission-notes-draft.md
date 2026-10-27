# Submission notes — private draft, not an entry

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
report locally when opened. It does not issue a new inference request during
replay. The earlier two-frame synthetic AutoDRIVE replay and its 15 October
response still import manually, and a retained 600-sample fixture shows an
earlier f1tenth_gym execution on an original analytic synthetic circuit. None
of these is physical robot telemetry.

Intended track for owner review: Physical AI, simulation-only. The official FAQ
allows simulation, so a physical Wheelie demonstration is unnecessary for this
version. The rules require at least one minute of key modules operating when
hardware is absent. The existing2:40 video plan meets the length target but must
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
Two requests were observed (15 and 23 October); no latency/quality/general reliability benchmark
or driver-improvement claim is supported.

Owner gates settled: root license Apache-2.0 with the Silverstone data under
GPL-3.0, asset redistribution cleared 23 October 2026, and the public repository
https://github.com/MatthewSnow2/blurr. Owner gates still open: eligibility/track
decision, judge access check on the published build, public YouTube video
strictly shorter than 3 minutes, final English description, feedback and update
explanation, and owner submission/legal acceptance. Each paid call needs its own
approval constant; every allowance so far is consumed (the synthetic fixture,
Silverstone run A, and on 26 October the circle and the three ladder runs).

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
| The app shows proven driving improvement | none | Not claimed | not claimed |
| Demo video under 3 minutes | `docs/demo-sequence-draft.md` | Not recorded | open |

Official sources rechecked15October2026:
https://nebiusglobalaihackathon.devpost.com/rules
https://nebiusglobalaihackathon.devpost.com/details/faqs
Deadline30October2026 at10:00PDT =17:00UTC. No registration, submission, terms
acceptance, publication or physical action occurred in this checkpoint.
