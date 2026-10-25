# Blurr simulator evidence lab

Blurr opens a sealed simulator session, replays its recorded samples, and shows a
saved coaching report only after checking that every claim in it resolves to that
session's evidence. The bundled demo is a recorded F1TENTH gym capture on the
Silverstone track with the one real NVIDIA Nemotron report generated for it
through Nebius Token Factory.

It is a replay and review tool. Viewing makes no provider call, no network
request outside its own origin, and sends no robot or simulator control. It is
not a physical vehicle coach, a video telemetry extractor or a real-time voice
system, and it does not show proven driving improvement.

## Quick start

Prerequisites: Node 24 (verified with 24.22.0) and npm. No credentials, Python,
simulator or GPU are needed to run the app.

```sh
npm ci
npm run build
npm run preview -- --host <lan-ip> --port 8843
```

Open `http://<lan-ip>:8843/` from any device on the network. Use `--host` with
the machine's LAN address so another device can reach it; omit it to serve on
this machine only.

**First screen:** "Sealed simulator sessions", with an **Import capture** button
and a **Recorded Nebius demo** card. Choose **Open recorded demo**.

**What you should see:**

- A banner reading "Recorded replay · not live simulation or inference", then
  "Recorded F1TENTH simulator capture: Silverstone run A · 5.99 s simulated over
  600 steps at 0.01 s".
- A scrubber over all 600 samples (position, speed, raceline deviation).
- The saved report, marked "Saved report, not a fresh response", with three
  validated measurements, one reviewed suggestion, the model
  `nvidia/nemotron-3-super-120b-a12b`, response ID
  `chatcmpl-5516fe22d301bbadc21c6ab2002aec0f` and the session digest.
- Provenance rows naming the dataset and its distribution license (GPL-3.0).

Back (in-app or browser) returns to history. Opening the demo again does not
duplicate it. History is stored per browser and origin, not in a shared cloud.

## Bundled data

Every bundled capture and report is listed in `fixtures/provenance.json` with
its path, raw-byte sha256, `dataset_class`, label and license. The app labels a
loaded session from this manifest by its canonical digest; a file that is not in
the manifest is shown as an unlisted import.

| File | `dataset_class` | What it is |
|---|---|---|
| `data/f1tenth-silverstone/run-a-session.json` | `recorded_simulator_capture` | 600 steps (5.99 s simulated) of f1tenth_gym on Silverstone, about 14.5 m of one straight, captured 23 October 2026. Not a lap. Default demo. |
| `data/f1tenth-silverstone/run-a-nebius-report.json` | `saved_provider_report` | The saved report from one real Nebius call on run A. Default demo. |
| `fixtures/f1tenth-original-synthetic-circuit.json` | `legacy_example` | An earlier f1tenth_gym run (9 October 2026) on an original analytic circuit. |
| `fixtures/autodrive-synthetic-session.json` | `synthetic_fixture` | Two-frame AutoDRIVE compatibility replay. Not a Unity capture. |
| `fixtures/autodrive-synthetic-nebius-report.json` | `saved_provider_report` | Saved report from one earlier Nebius call (15 October) on that synthetic replay. |
| `fixtures/recorded-synthetic-session.json` | `synthetic_fixture` | Three-sample input for the separate `recorded.html` inspection page. |

None of these is physical robot data or human driving. To import a pair by hand,
use **Import capture** with a session file, then **Import saved report** with its
report. A report for another session, changed bytes, unsupported claims,
malformed usage or a file over 128 KiB fails closed and keeps the previous view.

## Simulators: what is and is not here

- **F1TENTH (f1tenth_gym):** the working path. Run A was captured with the
  reconstructed runner in `scripts/` as of commit `5d28dde`, sealed, and
  reproduced by a second run with identical stable fields. The runner has since
  changed only its provenance string and default paths, so its bytes no longer
  match the capture receipt. `real_simulator_qualification` stays `pending` in
  the capture by design.
- **AutoDRIVE:** import compatibility only, shown with a synthetic two-frame
  fixture. Source units stay unspecified and unsupported channels stay
  unavailable. No live AutoDRIVE stream is part of this build.
- **Unity:** not required to run anything here and not complete.

## Troubleshooting

The demo files are served as separate same-origin assets. If **Open recorded
demo** fails, the app stays on history and shows one of these:

- "Recorded demo capture run-a-session.json could not be loaded (HTTP 404)..."
  or the same for the report: the build is missing `data/f1tenth-silverstone/`.
  Rebuild from a full checkout.
- "...failed validation: ...": the file's bytes or structure changed. Restore it
  from git; the hashes in `fixtures/provenance.json` must match.
- "...belongs to a different session": the report does not bind to the capture.
  Restore both files from the same commit.

An invalid manual import also leaves existing history intact. Reload on a replay
returns to history; reopen the session from there.

## Checks

```sh
npm test            # Node test runner, 70 tests
npm run typecheck
npm run lint
npm run build
python3 -m unittest discover -s tests -p 'test_*.py'   # runner and guard tests, Python 3.11 to 3.14
```

The Python tests use fake adapters and standard-library helpers only; they need
no simulator.

## Optional developer workflows (credentials or a simulator required)

None of these is needed to run or judge the app.

- **Offline provider transport:** `npm run test:nebius`,
  `npm run demo:nebius-offline -- fixtures/autodrive-synthetic-session.json` and
  `npm run demo:transport-offline -- fixtures/f1tenth-original-synthetic-circuit.json ./local-fixture-journal`
  read no credentials and make no network call. See `docs/nebius-offline-adapter.md`
  and `docs/runtime-safeguards.md`.
- **Real provider call:** `server/runApprovedVerification.ts` is a server-only,
  one-shot runner that needs a Nebius key and an explicit per-call approval. Each
  approval is journaled and cannot be reused. Never put provider keys in `VITE_`
  or browser code. Both recorded calls (15 and 23 October) are consumed.
- **New F1TENTH capture:** `scripts/capture_f1tenth_reconstructed.py` needs a
  host with f1tenth_gym installed and Python 3.11 to 3.13. See
  `docs/f1tenth-reconstructed-runner.md` and `docs/f1tenth-guard-diagnostics.md`.
- **Recorded display page:** `npm run build:recorded` builds `recorded.html`
  alone. See `docs/recorded-display.md`.

## Evidence

- `docs/submission-notes-draft.md`: claim-to-evidence list (claim, source,
  limitation, status).
- `docs/qualification-review-2026-10-25.md`: links the 23 October capture and
  provider receipts to this implementation and to the checks run on 25 October.
- `docs/saved-report-format.md` and `docs/report-contract.md`: the report format
  and how claims are validated.

Provider metadata in a saved report (model, response ID, usage) is attributed to
the file and its receipt; the browser validates claims and digests but does not
cryptographically authenticate the provider.

## Known limits

- The demo segment is short: 14.5 m of one straight with about 6 mm mean raceline
  deviation, so the coaching signal is weak.
- Two provider calls in total were observed; no latency, quality or reliability
  benchmark is claimed.
- Calculated cost for the run A call is USD 0.0009432 at published rates; the
  invoice charge was not observed.
- Archived vision and hardware notes are in `docs/historical-vision.md` and are
  not current demo claims.

## License

Original code and documentation are licensed under the Apache License 2.0
(`LICENSE`). The Silverstone run A capture and its saved report in
`data/f1tenth-silverstone/` are derived from GPL-3.0 track assets and are
licensed under GPL-3.0 (`data/f1tenth-silverstone/LICENSE`). Bundled third-party
notices are in `THIRD-PARTY-NOTICES.txt`.
