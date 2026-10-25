# Qualification review, 25 October 2026

Verdict: the bundled run A capture and its saved report are byte-identical to
the sealed 23 October originals, and the current app loads, labels and validates
them. This review does not promote qualification. `real_simulator_qualification`
stays `pending` in the capture, as written at capture time.

## Historical receipts (23 October 2026)

The receipts are owner-held evidence files, not part of this repository. They
are named here by folder and sha256 so they can be matched later.

| Receipt | sha256 | What it records |
|---|---|---|
| `f1tenth-platform-prime-import-20261023/RECEIPT.md` | `061835b949671821b2a98a80e60d8fadbf998e03941c82900b9a16189498951a` | Import-only diagnostic after the platform-metadata fix. Exit 0, 0 steps, guard unchanged. |
| `f1tenth-capture-run-a-20261023/RECEIPT.md` | `b88d672eadae9411d9050cf46c360e5833329ea8cb66c464c5f248bd37c29d16` | First run A attempt, rejected at finalize (environment drift). Run B not started. |
| `f1tenth-capture-6eca279-20261023/RECEIPT.md` | `d73e1ce9e144dfe3f4e9a1dca771ceb58c6c18f0aaf69146a1fcb9917616d30d` | Rerun A and B sealed, 600 samples each, `--compare` gave `identical_stable_fields`. |
| `nebius-run-a-20261023/RECEIPT.md` | `44ad5b4ceca32e8349f3b5322675f3ddf9259f66b16c28701561737536de0fd8` | One Nebius call on run A, HTTP 200, approval consumed. |

Key artifacts from those receipts:

| Artifact | sha256 | Copy in this repository |
|---|---|---|
| run A `session.json` | `4c2667dd19a367c5f6f154536b4e63bedbda24a4f68f7664f98a8be2584574fb` | `data/f1tenth-silverstone/run-a-session.json`, identical |
| run B `session.json` | `de45a8ed58dd6732cf41dc2264b3113e4899a6be9f7951883bb06e4df9a1d231` | not bundled |
| `run-a-nebius-report.json` | `ad3cb661f6fb38689064599152240a6dae7229eabc030c128901eda896fd1248` | `data/f1tenth-silverstone/run-a-nebius-report.json`, identical |
| `cost-proof.json` | `5dee8da1a0e020d1dd27281410d35af467e70ed646f0f5e917bfa8027606ed4c` | not bundled |

## Link to the current implementation

- **Capture runner.** The receipt names runner sha256 `ef92ee7f…6721` and core
  `3efedb9f…c8f8` at commit `6eca279`. History was rewritten for the public
  release; the same runner bytes are at public commit `5d28dde`
  (`git show 5d28dde:scripts/capture_f1tenth_reconstructed.py | sha256sum` gives
  `ef92ee7f2345e3141e4541ee4d963dc3ee4abdcb58d5cd8d3692994ad1176721`). The core
  is unchanged at HEAD (`3efedb9fe06ab1d27cd6919a566e494f51829e9bbba86ec9f31edad2970ac8f8`).
  The runner at HEAD (`edf8790975189af11fd9b2f09b1e0a19c89677f395b6426e2954880863ad4442`)
  differs only in the circuit provenance string and default paths, so a new
  capture with HEAD would carry a different runner hash than run A.
- **Manifest.** `fixtures/provenance.json` records both commits
  (`capture_runner_commit` `6eca279`, `capture_runner_public_commit` `5d28dde`)
  and the run A canonical digest
  `7008865c2a6439e82bf1cf60d8acbfcbaf4d1224fe3922e800b512d4f467ad14`.
- **App.** **Open recorded demo** fetches exactly the two files above and binds
  the report to the session by that canonical digest; there is no fallback to
  another session.

## Checks run on 25 October 2026

On ProBook, Node 24.22.0, branch `feat/demo-labels-docs`:

- `npm test`: 70 tests, 70 pass, 0 fail. This includes
  `tests/recordedDemo.test.ts`, which hashes every manifest entry against its
  file on disk and checks that the default demo is run A.
- `npm run typecheck`, `npm run lint`, `npm run build`: exit 0. The build emits
  both run A files as separate assets, not inlined into the JS bundle.
- Python runner and guard tests, `python3 -m unittest discover -s tests -p 'test_*.py'`:
  40 tests OK on Python 3.11 and on Python 3.14.
- Browser journey (Playwright Chromium against `vite preview` on the LAN
  address): banner and limits text shown, saved-report line and GPL-3.0
  distribution row shown, scrub to sample 600, in-app and browser back and
  forward, no duplicate history entry after opening twice and reloading, reload
  on a replay returns to history, a simulated 404 shows the specific message and
  stays on history. No external requests and no page errors.

Not checked: the Surface tablet itself, other browsers, and any new simulator
run or provider call (none was authorized or made).

## What the historical receipts did not retain

The 23 October build and browser checks were recorded as summaries in the
receipts (`npm test` 62/62, typecheck, lint and build rc 0, UI import and scrub
values) plus screenshots (`ui-replay-run-a.png`, `ui-run-a-nebius-report.png`).
The raw test, build and browser logs were not retained in those receipt folders.
The import diagnostic folder does keep its `stdout.log`, `stderr.log` and
`diagnostic.json`. Today's checks above are the reproducible ones.

## Still pending

- `real_simulator_qualification` remains `pending`. A successful run does not
  promote it, and this review does not either.
- `docs/f1tenth-reconstructed-runner.md` describes the runner before the
  23 October runs ("No real simulator was run"); that sentence is historical.
- The segment is 14.5 m of one straight, not a lap, with about 6 mm mean
  raceline deviation.
