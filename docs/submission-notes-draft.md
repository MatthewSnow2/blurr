# Submission notes — private draft, not an entry

Blurr is a simulator evidence lab for reviewing a sealed session before acting
on a coaching suggestion. It imports F1TENTH and AutoDRIVE JSON, replays recorded
samples and preserves browser-local history. Unsupported units and channels stay
unavailable. A typed report validator resolves every displayed claim to session
evidence and renders suggestions only through reviewed templates.

The current recorded demo combines a two-frame synthetic AutoDRIVE replay with
the real archived Nemotron response generated for that exact session. One
authorized Token Factory API request used NVIDIA's
`nvidia/nemotron-3-super-120b-a12b`; HTTP200, 1182input/655output tokens and valid
coaching-report.v1. The app revalidates the saved response locally when opened.
It does not issue a new inference request during replay. A separate retained
600-sample fixture shows a genuine earlier f1tenth_gym execution on an original
analytic synthetic circuit. Neither fixture is physical robot telemetry.

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
Only one request was observed; no latency/quality/general reliability benchmark
or driver-improvement claim is supported.

Owner gates still open: eligibility/track decision, source/asset rights and root
open-source license, public repository and reproducible judge access/test build,
public YouTube video strictly shorter than3minutes, final English description,
feedback and update explanation, and owner submission/legal acceptance. Further
paid calls need new approval; the one-request allowance is consumed.

Official sources rechecked15October2026:
https://nebiusglobalaihackathon.devpost.com/rules
https://nebiusglobalaihackathon.devpost.com/details/faqs
Deadline30October2026 at10:00PDT =17:00UTC. No registration, submission, terms
acceptance, publication or physical action occurred in this checkpoint.
