# Offline Nebius transport preparation

This server module continues the existing sealed evidence/report validator. It
does not add a browser provider client, default HTTP transport, key access, or
automatic retries. The running LAN UI remains metrics/replay-only. No inference
request, NVIDIA model execution, credit use, or sponsor-runtime receipt happened.

`prepareNebiusAdapter(config, exchange, existingReportSchema)` serializes a bounded
OpenAI-compatible chat request. It includes the existing coaching-report schema,
reviewed templates and minimized evidence, not raw frames, footage or filesystem
paths. Only the documented generic and us-central1 Token Factory HTTPS chat
endpoints are accepted. An NVIDIA namespace is required, but that is not proof of
model availability, license, owner choice or account access. JSON mode support
must be verified for the eventual live model.

One request may be active per adapter instance. Failed/uncertain delivery is not
retried; failure releases the slot for a later explicit decision. Single-flight
is not persistent idempotency or a cross-process spending lock. A future live
server must retain request keys and reconcile uncertain charged requests before
any retry.

Responses need the exact requested model identity, one complete stop-finished
choice, bounded JSON, valid usage when present, and supported factual claims.
Truncation, malformed JSON, invented evidence and substituted models fail closed.
No report prose/numbers bypass the existing validator. Receipts retain endpoint,
requested/reported model, IDs, prompt version, session/request/response hashes,
timestamps, token usage if supplied and validation status, never auth headers.
They always have `sponsorRuntimeVerified: false`; a parsed response alone is not
independent proof of an authorized real provider call.

Run with existing Node >=24, without installing anything in this task:

```sh
npm run test:nebius
npm run demo:nebius-offline -- /path/to/retained-synthetic-session.json
```

The demo uses `nvidia/synthetic-offline-fixture`, a deliberately fictional ID and
a local response fixture. It prints `evidenceKind: synthetic_fixture`; it is not
a substitute for required sponsor usage. All artifacts should keep that label.

Current nonsecret metadata: no Nebius configuration/variable names were found in
the relevant scoped project roots/current SSH environments. Account, credits,
existing key availability and selected live model remain unknown. This is not a
claim that no account exists elsewhere; no secret files/values were inspected.
The original plan candidate `nvidia/nemotron-3-super-120b-a12b` remains visible in
the official regional Nemotron example on 13 October 2026; it is a public
candidate, not a confirmed available/authorized account choice.

Ready next: inspect fixture receipts, approve a minimized synthetic payload and
exact endpoint/model/spending limit, then bind an authenticated server-only HTTP
exchange with timeout/cancellation, pre-parse response-byte cap, redirect denial,
request-ID capture and persistent idempotency. No new SDK is required; an existing
server/runtime can provide the exchange. Do not put a key in VITE/browser code.
Real account/terms/access, outbound payload/spend and any publication/entry stay
owner actions. Further relevant source reads and offline fixture tests need no
new approval.

Primary sources checked:
- https://docs.tokenfactory.nebius.com/quickstart
- https://nebius.com/services/token-factory/nemotron
- https://docs.tokenfactory.nebius.com/ai-models-inference/json
- https://nebiusglobalaihackathon.devpost.com/rules
