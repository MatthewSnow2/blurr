# Blurr simulator evidence lab

Blurr imports sealed F1TENTH/AutoDRIVE sessions, preserves browser-local history,
replays recorded samples, and derives bounded post-session evidence. AutoDRIVE
source units stay unspecified and unsupported measurements stay unavailable.
The current UI performs no cloud calls or robot control. It is not a physical
vehicle coach, video telemetry extractor or real-time voice system.

## Run and verify

Use installed Node24 with the locked dependencies. On a new machine `npm ci`
installs them; no dependency installation was performed in this checkpoint.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run preview -- --host <lan-ip> --port 8843
```

Open http://<lan-ip>:8843/ from another device on the network. Import either JSON fixture below, select/reverse samples,
return to history and refresh. Re-import is idempotent. Invalid JSON leaves
existing history intact. The LAN hashing fallback does not require browser
security flags. Sessions persist per browser/origin, not in a shared cloud.
The task independently retains raw fixtures, hashes and receipts on disk.

## Reproducible evidence fixtures

- `fixtures/f1tenth-original-synthetic-circuit.json`: retained output of a real
  f1tenth_gym run on an original analytic circuit on 9 October 2026, 600 samples;
  raceline-v2/SI units. Replay of prior simulator execution, not a fresh live run.
- `fixtures/autodrive-synthetic-session.json`: two-frame synthetic compatibility
  replay through the existing AutoDRIVE recorder, not a Unity capture.
- `fixtures/provenance.json`: raw-byte digests and origin labels. Neither file is
  physical robot data. Do not describe them as human driving or live AutoDRIVE.

## Offline NVIDIA/Nebius transport preparation

```sh
npm run test:nebius
npm run demo:nebius-offline -- fixtures/autodrive-synthetic-session.json
npm run demo:transport-offline -- fixtures/f1tenth-original-synthetic-circuit.json ./local-fixture-journal
```

The last command uses an in-memory HTTP Response and a fake test header; it makes
no network call. Repeating the same request/journal directory must fail before
exchange. Receipts remain `synthetic_fixture` and sponsorRuntimeVerified false.
No local model is required. No credentials are read/configured by these commands.

See `docs/runtime-safeguards.md` for streamed byte limits, timeout/cancellation,
redirect denial, error redaction and persistent duplicate-attempt protection.
One explicitly authorized synthetic request succeeded on 15 October 2026:
`nvidia/nemotron-3-super-120b-a12b`, HTTP200, 1182 input/655 output tokens
(including518reasoning), validated coaching-report.v1. Calculated usage cost
USD0.0009441 at official rates; the invoice charge was not observed. The paid
allowance is consumed. Further provider calls require fresh authorization.
The server-only one-shot runner is separate from the browser build; never put
provider keys in VITE/browser code or rerun a consumed attempt.

## Saved coaching experience

Choose **Open recorded demo** in local history. This loads the bundled two-frame
synthetic replay and its actual saved Nebius response without any network call.
The report shows evidence-backed claims, the reviewed suggestion, reported model,
response ID, response time, usage and the exact session digest. Refresh/reopen
preserves the report in browser-local history. The browser validates claims and
file/session digests; imported provider metadata is attributed to the file, not
cryptographically authenticated by the browser.

For manual import: import `fixtures/autodrive-synthetic-session.json`, then use
**Import saved report** with `fixtures/autodrive-synthetic-nebius-report.json`.
A report for another session, changed bytes, unsupported claims, malformed usage
or files over128KiB fail closed. An invalid import preserves the previous report.
The F1 fixture has no provider report; its local replay remains available.
`docs/saved-report-format.md` describes the format and evidence limits.

## Submission status

Deadline: 30 October 2026, 17:00 UTC. Official rules require an NVIDIA open model
and a real runtime Token Factory call or AI Cloud execution, a public licensed
source repository, setup/testing instructions, feedback/update explanation and
an English demo video shorter than three minutes. Simulation is allowed in the
Physical AI track, with at least one minute of key modules operating.
https://nebiusglobalaihackathon.devpost.com/rules
https://nebiusglobalaihackathon.devpost.com/details/faqs

This repository is not ready to submit: public code/license/rights and judge-access/video gates remain open. The saved
response documents genuine sponsor runtime. A fresh AutoDRIVE stream is an
optional product goal, not required just to enter a simulation-only project. Root license
selection is an owner decision. No public push, release or submission occurred.
Unused legacy images are excluded from builds and the review-source bundle;
their rights are not assumed. Archived vision/hardware notes are preserved in
`docs/historical-vision.md` and are not current demo claims.

## License

Original code and documentation are licensed under the Apache License 2.0
(`LICENSE`). The Silverstone run A capture and its saved report in
`data/f1tenth-silverstone/` are derived from GPL-3.0 track assets and are
licensed under GPL-3.0 (`data/f1tenth-silverstone/LICENSE`). Bundled
third-party notices are in `THIRD-PARTY-NOTICES.txt`.
