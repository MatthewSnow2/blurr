# Guard diagnosis — offline only, no policy relaxation

The original AlienPC failure remains unresolved at exact-event level. Its log
only says network/process creation forbidden. No further remote command, source
transfer or live run was made in this task. The staged b3865e9 source and failed
receipt/log copies are preserved separately.

## Evidence-supported finding and uncertainty

The pinned corrected EnvState imports NumPy at module import; actual gym imports
are deferred until load_track. The worker installs its broad guard before the
adapter import. The guard denies every `socket.*` audit event, including the
metadata query `socket.gethostname`, as well as process creation.

CPython3.12 platform.machine calls uname; without os.uname (the Windows path),
uname calls _node, which calls socket.gethostname. The guard therefore can reject
a platform metadata query without an attempted connection. An offline helper
reproduces this Windows-style fallback under the unchanged guard, and the new
record identifies socket.gethostname at platform._node/uname.

This proves a plausible false-positive path, not the cause of the real failed
attempt. Installed NumPy/dependency versions and the real call stack were not
recorded before failure. Public NumPy examples do not establish the installed
version or which dependency called platform. The denial may instead be another
socket/process event, during import or later capture/metadata/cleanup. No event
was allowed or retried merely because this hypothesis is plausible.

Primary reviewed source: CPython v3.12.0 Lib/platform.py (_node, uname, machine),
https://github.com/python/cpython/blob/v3.12.0/Lib/platform.py . The exact installed
3.12 patch version was not rechecked. Existing adapter source was read from the
preserved corrected snapshot; no simulator dependency code ran locally.

## Minimal instrumentation

The denial condition is AST-identical to b3865e9. It still raises the same
RuntimeError. A bounded JSON stderr record now includes:
- Known audit event name (unknown socket suffix becomes socket.other).
- Fixed enumerated phase: adapter import, gym import, adapter construction,
  capture loop, cleanup, metadata or candidate write.
- At most six module/function/line frames. No filenames, absolute paths, source
  lines, locals, event arguments, command arguments, endpoints or credentials.

Logging failures cannot permit the denied operation. The original generic error
remains after the record. The existing64 KiB worker/failure-log bounds apply.
No source/asset pin, timeout, controller, capture limit or permitted operation
was relaxed.

## Exact instrumented test still needed — NOT executed

A new small `probe_f1tenth_imports.py` entry defaults to plan-only. Its future
explicit --probe mode reuses source/resource checks, the same guard and a parent
supervisor with a20-second owned-worker limit. It imports only the adapter and
gym package and records their import phases. It never calls EnvState(),
gym.make(), load/reset/step or a server. Dependency import initializers still
execute and are the operation being diagnosed; no native sandbox is claimed.

If denial occurs, fresh `<output>.failed` logs contain the exact event, phase and
sanitized call site. If both imports pass, diagnostic.json records zero steps
and no capture. That result does not exonerate later constructor/loop/cleanup
phases; stop rather than expanding the probe into a capture. No sealed session or
qualification promotion is produced.

Current file hashes:
- capture_f1tenth_reconstructed.py: ae4d56c504a17231f2f5a7151b0cc8009d2b33879eb74f76b1d4b029a1cd7706
- f1tenth_capture_core.py (unchanged): 3efedb9fe06ab1d27cd6919a566e494f51829e9bbba86ec9f31edad2970ac8f8
- probe_f1tenth_imports.py: 75c506f98ea2145f703774827d42cfd24fdc3b38dfdf1cd968280da03aa25241

Proposed future staging root (not present/verified/staged by this task):
`C:\Users\matth\Documents\Codex\2026-10-16\blurr-f1tenth-guard-diagnostics-v1`

After separately reviewed staging of these exact three files and creation of
its outputs parent, ordinary AlienPC PowerShell would run:

```powershell
$Python = 'C:\Users\matth\projects\f1tenth-mcp\.venv\Scripts\python.exe'
$Diag = 'C:\Users\matth\Documents\Codex\2026-10-16\blurr-f1tenth-guard-diagnostics-v1'
$Probe = Join-Path $Diag 'scripts\probe_f1tenth_imports.py'
$Runner = Join-Path $Diag 'scripts\capture_f1tenth_reconstructed.py'
$Core = Join-Path $Diag 'scripts\f1tenth_capture_core.py'
$ProbeHash = '75c506f98ea2145f703774827d42cfd24fdc3b38dfdf1cd968280da03aa25241'
$RunnerHash = 'ae4d56c504a17231f2f5a7151b0cc8009d2b33879eb74f76b1d4b029a1cd7706'
$CoreHash = '3efedb9fe06ab1d27cd6919a566e494f51829e9bbba86ec9f31edad2970ac8f8'
if ((Get-FileHash $Probe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ProbeHash) { throw 'Probe hash mismatch' }
if ((Get-FileHash $Runner -Algorithm SHA256).Hash.ToLowerInvariant() -ne $RunnerHash) { throw 'Runner hash mismatch' }
if ((Get-FileHash $Core -Algorithm SHA256).Hash.ToLowerInvariant() -ne $CoreHash) { throw 'Core hash mismatch' }
& $Python -s $Probe --probe --source-root 'C:\Users\matth\Documents\Codex\2026-10-08\task\worktrees\f1tenth-raceline-reference' --gym-root 'C:\Users\matth\projects\f1tenth_gym' --output (Join-Path $Diag 'outputs\imports-only-attempt-1') --expected-probe-sha256 $ProbeHash --expected-runner-sha256 $RunnerHash --expected-core-sha256 $CoreHash
if ($LASTEXITCODE -ne 0) { throw 'Import probe stopped; preserve diagnostics, do not relax or retry' }
```

## Scope and verification

The proposed future test changes source hashes, adds a diagnostic entry point,
uses a new output root and changes the action from two simulator captures to one
imports-only diagnostic. It leaves permitted operations unchanged and requests
no simulator construction or step. Review/update that exact execution scope and
normal tool review before staging/execution; do not reuse the old b3865e9
hash-bound commands or overwrite its source/failure receipts. No new approval is
being requested in this offline task.

Offline tests cover unchanged predicate, sanitized records, logging-failure
fail-closed behavior, actual blocked socket creation and subprocess launch,
synthetic connect/bind audit events, Windows-style metadata denial, no simulator
construction by the import probe, default plan-only/wrong-hash behavior and
mocked20-second supervision. Socket/process attempts are denied before those
operations execute. Tests use standard-library helpers and fake modules only.
No NumPy/gym/runtime import probe was run. All original runner tests remain.
