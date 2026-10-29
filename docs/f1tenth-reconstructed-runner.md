# Newly reconstructed F1TENTH capture runner

This diagnostic descendant changes runner bytes and adds an imports-only probe.
The command hashes below are the preserved historical b3865e9 capture handoff;
they do not authorize or match the diagnostic successor. See
`f1tenth-guard-diagnostics.md` for the new diagnostic scope and current hashes.

This is new implementation, not recovery of the historical capture harness. It
is qualified only by offline mocked-adapter tests. No real simulator was run.
The existing original-circuit capture and original deliverables are preserved.

Later note (25 October 2026): the two sentences above predate the 23 October
Silverstone runs A and B, which this runner captured. Qualification is still
pending. See `qualification-review-2026-10-25.md`.

## Scope and behavior

The runner uses the reviewed b3525a0 EnvState public load/reset/step/raceline/
analysis methods. Since that API loads named tracks, this first reconstruction
uses only the existing, hash-pinned Silverstone assets. `--track Circle` (added
26 October 2026) selects the rung-2 circle from `data/f1tenth-circle/Circle/`,
copied into the gym's `maps/Circle/` and pinned the same way. `--track Turn`,
`--track TwoTurns` and `--track Chicane` (rungs 3, 4.1 and 4.2, same day) select the
ladder tracks from `data/f1tenth-ladder/` the same way. Silverstone stays
the default. It does not recreate the
old original analytic circuit or claim identical historical controller behavior.
The new controller selects the nearest waypoint, targets 14 points ahead, wraps
heading error, applies gain0.65 and clamps steering to0.35 rad at a2.5 m/s target.
Since 26 October `--gain` (0.1 to 2.0) and `--lookahead` (1 to 60 points) may be
set per run; both are sealed in `controller`. Timestep, speed and steering limit
stay fixed. The sweep and lap harnesses are in `scripts/f1tenth-sweep/`.
Controls go only to the pinned in-process Python simulator adapter in a future
authorized worker. No MCP server, network listener or physical output path exists.

`f1tenth_capture_core.py` is standard-library, dependency-injected capture logic.
`capture_f1tenth_reconstructed.py` is the explicit opt-in supervisor/worker and
receipt publisher. Running without `--run` only prints a plan. `--compare` only
reads completed bundles; it never imports the simulator.

## Bounds, validation and provenance

- Seed defaults20261009; steps1..20,000 (raised from 600 on 26 October so a full
  Silverstone lap fits; worker timeout up to 1200 s); timestep0.01 checked from the actual raw gym
  instance before stepping. Simulator-relative time counts adapter steps after
  reset returns; it does not fabricate wall-clock or network reception timing.
- Root/HEAD/clean-tracked-source checks pin adapter b3525a0 and gym5a301bd;
  module byte hash and all four asset hashes of the selected track are checked before
  imports. Runtime imported module paths are checked. Missing/changed assets
  fail before load_track can download them. Existing untracked smoke files are
  not executed or changed.
- The worker imports no server. Python audit events deny socket operations and
  further child creation after source preflight. This is a process-local guard,
  not a native-code/network sandbox proof. No firewall or permissions change.
- Only the reviewed Windows ALIENPC host can pass the real resource preflight:
  CPU snapshot <=25%, available memory>=8 GiB. It reads host counters; it does
  not start a service. Thread environment limits are1; rendering isNone, with
  dummy SDL video/audio drivers. No model, cloud or GPU rendering is requested.
  Numba cache stays in the owned worker temporary directory, preserving source/
  installation caches. These are preflight/configuration checks, not a sustained
  CPU/GPU quota proof.
- A parent bounds the owned worker to at most120 seconds, including worker
  import/load/reset/step/close. Each preflight Git command separately has a
  10-second timeout; the whole CLI is not promised to finish within120 seconds.
  The soft deadline also checks operation boundaries. Blocked calls cannot
  outlive the parent's worker timeout. Parent kills/waits for its owned worker;
  arbitrary native-code descendants are not OS-container-isolated by this code.
- Stop immediately on terminated/truncated, nonfinite values, invalid sequence,
  deadline, invalid source/reference/timestep or cleanup failure. Raw close is
  attempted before adapter close so the adapter cannot silently swallow its
  error. Cleanup may be attempted twice by the pinned adapter; live behavior is
  still unqualified. A hard-killed worker cannot complete Python finally.
- Worker output is only a candidate. Parent waits for exit0, checks numeric
  values, timing/sequence, source/configuration, actions, terminal reason and
  recomputed summaries, then writes a fresh exclusive bundle. Existing output
  is never replaced. JSON limit15 MiB; logs64 KiB. Supervision polls log size;
  a log can overshoot between polls, but persisted failure logs are truncated.
- Bundle: `session.json` + independent `receipt.json` raw-byte hash/byte count.
  File writes are exclusive, not a claim of crash-atomic directory publication.
  Consumers must require and verify the completed receipt. On ordinary failure,
  own partial publication is removed; bounded diagnostics go to a fresh sibling
  `<output>.failed` and are explicitly failed/unsealed. Existing failure evidence
  is preserved. Interrupted process/crash recovery must inspect receipts.
- Every session name visibly includes reconstructed/qualification-pending, and
  provenance keeps `real_simulator_qualification: pending`, code/module/asset/
  geometry hashes, actual executable/package versions, runtime configuration,
  source clock method, no human/physical/live claim and resource observation.
  A successful run does not automatically promote qualification.
- `--compare` requires two complete600-sample, nonterminal bundles with matching
  receipts. It compares all JSON fields except capture-start timestamp and
  resource preflight sample; any other difference fails. It keeps qualification
  pending. The F1TENTH Blurr importer accepts the output shape; this was checked
  using a clearly labeled offline mocked fixture, not actual simulator output.

## Exact future invocation — not authorized or staged by this task

The following proposed staging/output locations are explicit scope for a later
approved task, not files asserted to exist on AlienPC. Nothing was transferred.
Stage only these exact two script bytes through a separately permitted process;
create/approve the output parent separately. Do not reuse a denied transfer/test
route. Exact runner/core hashes must be verified externally before Python starts.
The real adapter requires Python>=3.11,<3.14; the known environment was historically
Python3.12 and is rechecked by the worker. No reinstall or global environment edit.

```powershell
$ErrorActionPreference = 'Stop'
$Python = 'C:\Users\<you>\projects\f1tenth-mcp\.venv\Scripts\python.exe'
$ProofRoot = 'C:\Users\<you>\Documents\Codex\2026-10-16\blurr-f1tenth-proof'
$Runner = Join-Path $ProofRoot 'scripts\capture_f1tenth_reconstructed.py'
$Core = Join-Path $ProofRoot 'scripts\f1tenth_capture_core.py'
$Outputs = Join-Path $ProofRoot 'outputs'
$Source = 'C:\Users\<you>\Documents\Codex\2026-10-08\task\worktrees\f1tenth-raceline-reference'
$Gym = 'C:\Users\<you>\projects\f1tenth_gym'
$RunnerHash = '4c47aa08789465257f3e4ef0781a9dc262392355c5962400cdfc47ccf99157f5'
$CoreHash = '3efedb9fe06ab1d27cd6919a566e494f51829e9bbba86ec9f31edad2970ac8f8'
if ((Get-FileHash -LiteralPath $Runner -Algorithm SHA256).Hash.ToLowerInvariant() -ne $RunnerHash) { throw 'Runner bytes differ from review' }
if ((Get-FileHash -LiteralPath $Core -Algorithm SHA256).Hash.ToLowerInvariant() -ne $CoreHash) { throw 'Core bytes differ from review' }
$Common = @('--run','--source-root',$Source,'--gym-root',$Gym,'--seed','20261009','--steps','600','--timeout','120','--expected-runner-sha256',$RunnerHash,'--expected-core-sha256',$CoreHash)

# Simulation run A, after exact scoped authorization and resource coordination.
& $Python -s $Runner @Common --output (Join-Path $Outputs 'run-a')
if ($LASTEXITCODE -ne 0) { throw 'Run A failed; do not launch B' }
$A = Get-Content -LiteralPath (Join-Path $Outputs 'run-a\session.json') -Raw | ConvertFrom-Json
$AReceipt = Get-Content -LiteralPath (Join-Path $Outputs 'run-a\receipt.json') -Raw | ConvertFrom-Json
if ((Get-FileHash -LiteralPath (Join-Path $Outputs 'run-a\session.json') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $AReceipt.sha256) { throw 'Run A receipt mismatch' }
if ($A.outcome.sample_count -ne 600 -or $A.outcome.terminated -or $A.outcome.truncated) { throw 'Run A stopped early; review before any extension or repeat' }

# Simulation run B, serially. Its own resource/source preflight runs again.
& $Python -s $Runner @Common --output (Join-Path $Outputs 'run-b')
if ($LASTEXITCODE -ne 0) { throw 'Run B failed' }

# Read-only comparison; no simulator imports or paid calls.
& $Python -s $Runner --compare (Join-Path $Outputs 'run-a') (Join-Path $Outputs 'run-b')
if ($LASTEXITCODE -ne 0) { throw 'Capture comparison failed; qualification remains pending' }
```

The controller may terminate early or diverge on Silverstone. Do not silently
change controller/track/limits to force a successful run. Inspect source/runtime
receipts and failure diagnostics and scope any fix separately. The Silverstone
track assets come from `f1tenth/f1tenth_racetracks` at `b95c4ef` under GPL-3.0
and are cleared for redistribution with that license (see `THIRD-PARTY-NOTICES.txt`).

## Offline verification and remaining real qualification

```sh
python3 -m unittest discover -s tests -p 'test_f1tenth_capture_runner.py' -v
python3.11 -m unittest discover -s tests -p 'test_f1tenth_capture_runner.py' -v
python3 scripts/capture_f1tenth_reconstructed.py
```

Tests use fake adapters and tiny standard-library Python child helpers only.
They cover deterministic bounds, stationary/negative samples, terminal stop,
load/page/step/numeric/reference/clock/cleanup failure, resource rejection,
source/asset pins, hard timeout, process exit, output/log capacity, receipt
integrity, exclusive publication/rollback/recovery, default plan-only behavior,
mocked full CLI orchestration, two-run comparison and existing Blurr import.
No source is installed or transferred; no real EnvState/gym import is executed.

Unrun: actual Windows resource counters, real dependency imports/audit guard,
headless named-track load, real controller trajectory, raw/adapter close behavior,
600-step repeatability, actual resource use and complete end-to-end live-host
capture. A source-bound real run and separate staging authorization are still
required. Current instruction explicitly excludes them; earlier broad approvals
or a past Checkmate consensus do not override that boundary. The previous denied
AutoDRIVE private-source transfer/compatibility test is neither retried nor
implicitly authorized by this new implementation.

Review performed here is implementer source review plus tests, not independent
human review or actual simulator qualification. The historical runner's absence
is no longer an implementation blocker; real-host staging/authorization and
qualification remain.
