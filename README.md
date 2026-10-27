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
The app has no button to clear history; use the browser's site-data controls.

### Viewing the Silverstone baseline and retest lap attempts

These two captures are bundled but not opened by the demo button. Import each
session first, then its report; the report is refused until its own session is
open.

1. **Import capture** -> `data/f1tenth-silverstone/baseline-lap-session.json`.
   Expect the label "Recorded F1TENTH simulator capture: Silverstone baseline lap
   attempt (gain 0.65, lookahead 14), collided at 12.14 s", 1,214 samples, mean
   |raceline deviation| 0.038774 m and max 0.182421 m.
2. **Import saved report** -> `data/f1tenth-silverstone/baseline-lap-nebius-report.json`.
   Expect response `chatcmpl-29bd4e657c1abfde41231d6c810805a8`, 1362 input and
   890 output tokens, three validated claims (two measurements and one
   mean-below-max comparison) and one reviewed suggestion.
3. Back to history, **Import capture** -> `retest-lap-session.json`. Expect the
   retest label (gain 1.05, lookahead 3, collided at 27.44 s), 2,744 samples,
   mean 0.002096 m and max 0.006944 m.
4. **Import saved report** -> `retest-lap-nebius-report.json`. Expect response
   `chatcmpl-d153e03a0258dd5907332011d4bd9fa1`, 1360 input and 765 output
   tokens, three validated measurements and three reviewed suggestions.

Importing the baseline report while the retest is open is refused with "This
report belongs to a different session" and the current report stays. History
cards for the three Silverstone sessions share one title; tell them apart by
sample count and digest.

The last sample of each lap attempt shows zero speed and zero heading while
the position stays where the car stopped. Those zeros come from the simulator
resetting state on termination; they are not evidence of a spin.

## Bundled data

Every bundled capture and report is listed in `fixtures/provenance.json` with
its path, raw-byte sha256, `dataset_class`, label and license. The app labels a
loaded session from this manifest by its canonical digest; a file that is not in
the manifest is shown as an unlisted import.

| File | `dataset_class` | What it is |
|---|---|---|
| `data/f1tenth-silverstone/run-a-session.json` | `recorded_simulator_capture` | 600 steps (5.99 s simulated) of f1tenth_gym on Silverstone, about 14.5 m of one straight, captured 23 October 2026. Not a lap. Default demo. |
| `data/f1tenth-silverstone/run-a-nebius-report.json` | `saved_provider_report` | The saved report from one real Nebius call on run A. Default demo. |
| `data/f1tenth-circle/run-a-session.json` | `recorded_simulator_capture` | 600 steps (5.99 s simulated) of f1tenth_gym on the original 8 m circle, about 14.5 m (30%) of the lap, captured 26 October 2026. |
| `data/f1tenth-circle/run-a-nebius-report.json` | `saved_provider_report` | The saved report from one real Nebius call on the circle run A (26 October). |
| `data/f1tenth-ladder/{turn,twoturns,chicane}-run-a-session.json` | `recorded_simulator_capture` | 600 steps each of f1tenth_gym on the original rung 3 (one turn), 4.1 (hairpin) and 4.2 (chicane) tracks, captured 26 October 2026. |
| `data/f1tenth-ladder/{turn,twoturns,chicane}-run-a-nebius-report.json` | `saved_provider_report` | One saved report per ladder run, each from one real Nebius call on 26 October. |
| `data/f1tenth-silverstone/{baseline,retest}-lap-session.json` | `recorded_simulator_capture` | Full-lap attempts on Silverstone (26 October), before and after the ladder sweep. Both collide: the baseline at 12.14 s (about 30 m), the retest at 27.44 s (about 68 m). |
| `data/f1tenth-silverstone/{baseline,retest}-lap-nebius-report.json` | `saved_provider_report` | One saved report per lap attempt, each from one real Nebius call on 26 October. |
| `fixtures/f1tenth-original-synthetic-circuit.json` | `legacy_example` | An earlier f1tenth_gym run (9 October 2026) on an original analytic circuit. |
| `fixtures/autodrive-synthetic-session.json` | `synthetic_fixture` | Two-frame AutoDRIVE compatibility replay. Not a Unity capture. |
| `fixtures/autodrive-synthetic-nebius-report.json` | `saved_provider_report` | Saved report from one earlier Nebius call (15 October) on that synthetic replay. |
| `fixtures/recorded-synthetic-session.json` | `synthetic_fixture` | Three-sample input for the separate `recorded.html` inspection page. |

The sweep summaries in `data/f1tenth-sweep/` are not sessions and are not in the
manifest; see the next section.

None of these is physical robot data or human driving. To import a pair by hand,
use **Import capture** with a session file, then **Import saved report** with its
report. A report for another session, changed bytes, unsupported claims,
malformed usage or a file over 128 KiB fails closed and keeps the previous view.


## Controller sweep and Silverstone retest (offline tuning, not learning)

On 26 October the same controller was run 100 times on each ladder rung
(circle, turn, hairpin, chicane), one run per gain and lookahead on a 10 x 10
grid: gain 0.35 to 1.25, lookahead 6 to 24 raceline points. Seed, timestep,
2.5 m/s speed, 0.35 rad steering limit and 600 steps were the same for every
run, so only the setting differed. All 400 runs completed without a collision.
`scripts/select_sweep_setting.py` keeps settings that completed every rung and
picks the lowest mean |raceline deviation| across rungs: gain 1.05, lookahead 6
points (0.6 m). The default 0.65 / 14 ranked 38th. Nothing else carries over:
no weights, memory or model state, and the coaching reports do not feed back
into the controller.

Silverstone was held out of the sweep. Its waypoints are about twice as far
apart, so the chosen lookahead becomes 3 points there (the same 0.6 m).

| Silverstone lap attempt | Setting | Stopped | Distance | Mean / max \|deviation\| |
|---|---|---|---|---|
| Baseline | 0.65 / 14 points (2.8 m) | terminated at 12.14 s (manifest: collided) | about 30 m of 446 m | 0.039 / 0.182 m |
| Retest | 1.05 / 3 points (0.6 m) | terminated at 27.44 s (manifest: collided) | about 68 m of 446 m | 0.002 / 0.007 m |

Read the table with these limits. The baseline cut inside the first right-hander
(0.18 m off the line when the run ended). The retest stayed within 7 mm of the line and
still ended at the entry to a tight right-hander (radius about 3 m); that
cause is not diagnosed yet. Deviation means over runs of different length are
not comparable, so distance reached comes first. The comparison changes gain and
lookahead distance together, each condition is one deterministic run (run B
reproduced run A), and neither attempt completed a lap. This shows offline
tuning on simple tracks carrying over to a held-out track in simulation; it is
not a learned driver, not coaching that caused the change, and not evidence
about human drivers.

## How Nemotron and Token Factory are used

Nebius Token Factory is the only inference provider, and
`nvidia/nemotron-3-super-120b-a12b` is the only model. The call happens on a
server, after a session is sealed, never during replay:

1. `server/runApprovedVerification.ts` (server-only, needs a Nebius key and a
   one-time approval constant) sends the session's sealed evidence bundle,
   the reviewed template catalogue and the report schema to
   `https://api.tokenfactory.nebius.com/v1/chat/completions` at temperature 0.
2. Nemotron returns a `coaching-report.v1` JSON object. It chooses which
   evidence IDs to cite as typed claims and which reviewed template and drill
   to attach; it writes no prose that the app displays.
3. The runner refuses a reused approval and records the attempt before
   sending, allows one dispatch with no retry, checks the endpoint, model and
   response size, and the result is saved with model, response ID, token usage
   and the session's sha256.
4. The browser (this app) re-validates every claim against the session it has
   open and renders the claims and templates with local code. It makes no
   provider call.

What Token Factory contributed: an OpenAI-compatible endpoint for an NVIDIA
open model, deterministic settings, and usage fields (including reasoning
tokens) that let each call be costed and audited. Eight calls were made in
total, one per bundled report, between 15 and 27 October 2026 (UTC). Their saved
reports are the only model output in the repository.

**Offline vs live:** everything a viewer does is offline replay of saved
files. Generating a new report is a separate, credentialed, approved server
step and is not exposed in the app.

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
npm test            # Node test runner, 73 tests
npm run typecheck
npm run lint
npm run build
python3 -m unittest discover -s tests -p 'test_*.py'   # 53 runner, guard and sweep tests, Python 3.11 to 3.14
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
  or browser code. See `docs/submission-notes-draft.md` for the recorded-call
  inventory and consumed approval allowances; saved reports do not authorize new calls.
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
- Eight provider calls in total, one per saved report; no latency, quality or
  reliability benchmark is claimed.
- Calculated cost for all eight is about USD 0.0088 at the published 0.30 and
  0.90 USD per million input and output tokens (run A alone: USD 0.0009432); the
  invoice charges were not observed.
- The coaching content is thin: saved reports cite three to six typed claims and
  attach a reviewed drill suggestion. They do not explain a crash or suggest a
  controller change, and nothing feeds a report back into the controller.
- Braking and collision are not telemetry channels, so the report panel lists
  them as unavailable even for attempts the manifest labels as collided. The
  capture records only `stop_reason: terminated` before a lap was completed;
  "collided" is the manifest's reading of that, not a sample channel.
- Archived vision and hardware notes are in `docs/historical-vision.md` and are
  not current demo claims.

## License

Original code and documentation are licensed under the Apache License 2.0
(`LICENSE`). The Silverstone captures and their saved reports in
`data/f1tenth-silverstone/` are derived from GPL-3.0 track assets and are
licensed under GPL-3.0 (`data/f1tenth-silverstone/LICENSE`). Bundled third-party
notices are in `THIRD-PARTY-NOTICES.txt`.
