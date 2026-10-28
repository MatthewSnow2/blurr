Replaces #3, which GitHub closed unmerged when #2 was squash-merged and its base branch `feat/f1tenth-ladder-rungs-3-4` was deleted. This branch starts from current `main` (`be1ab6e`) and carries #3's three commits, cherry-picked with `-x`:

- `76b3813` -> `15ed34a` feat: allow bounded gain/lookahead sweeps and full-lap captures
- `7d4e295` -> `8d71bd9` feat: add the ladder sweep selection rule
- `7fb66e1` -> `116d943` feat: bundle the ladder sweep and Silverstone baseline/retest laps

The cherry-picks applied without conflicts. The resulting tree equals #3's head `7fb66e1` except for the README lines from `3545b02` (recorded-call inventory), which main already has and this branch keeps.

After `116d943` the branch adds docs-only commits (`4fe0c6b` onward): README and submission-package wording matched to the verified replay, the video check, a submission readiness review, a judge-access and live-call reproduction guide, and the owner decisions recorded so far. They change no code, data or build output: `git diff --stat 116d943..HEAD` touches only `README.md` and `docs/`, and the build still produces `main-Dttd0-9S.js`. Delta against main: 30 files (29 at `2c1f21e`, plus this description, `docs/pr-4-description.md`). No new captures, provider calls or code changes beyond #3.

## What changes (code and data unchanged from #3)

- The capture runner accepts bounded `--gain` (0.1 to 2.0) and `--lookahead` (1 to 60 points), sealed in `controller`. The step cap rises from 600 to 20,000 and the timeout to 1200 s, so a full Silverstone lap fits. Timestep, speed and steering limit stay fixed.
- `scripts/select_sweep_setting.py` implements the selection rule. A setting stays in only if it completed every rung; the winner has the lowest mean of its per-rung mean |raceline deviation|. Ties go to the lower gain.
- `data/f1tenth-sweep/` holds 4 x 100 run summaries, `selection.json` and a README. The Windows harnesses are in `scripts/f1tenth-sweep/`.
- `data/f1tenth-silverstone/{baseline,retest}-lap-*` holds two lap attempts with one saved Nebius report each, GPL-3.0. Both are in the manifest; run A remains the default demo.

## Results (offline tuning, not learning)

All 400 ladder runs completed. The selection chose gain 1.05 with a 6-point lookahead (0.6 m), which is 3 points on Silverstone. The default 0.65 / 14 ranked 38th.

| Silverstone (held out) | Setting | Episode ended | Distance along raceline | Mean / max \|dev\| |
|---|---|---|---|---|
| Baseline | 0.65 / 14 (2.8 m) | step 1,214 (12.14 s) | 30.258 m of 446.2 m | 0.039 / 0.182 m |
| Retest | 1.05 / 3 (0.6 m) | step 2,744 (27.44 s) | 68.457 m of 446.2 m | 0.002 / 0.007 m |

Limits:
- Both attempts ended when the simulator terminated the episode; neither completed a lap. Each capture records only `stop_reason: "terminated"`. The manifest labels both "collided", but the captures carry no separate collision record, so this PR does not call either a crash.
- The zero speed and pose in each final sample come from the upstream environment reset on termination. They are not evidence of a spin.
- One deterministic run per condition; run B matched run A on both.
- Gain and lookahead distance change together.
- Why the retest terminated, about 4 mm from the line at a radius-3 m corner entry, is not diagnosed.
- Nothing persists except the chosen setting, and the reports do not feed back into the controller. This does not show learned driving or a coaching-caused improvement.

## Nemotron and Token Factory (replay disclosed)

The two Nebius calls for these laps were made on 26 October for #3 by `server/runApprovedVerification.ts`, about USD 0.0023 at published rates, each with its own approval constant. This PR makes no new calls. The hosted app makes no live call: it replays and validates the saved reports.

## Validation

Fresh, 28 October 2026, about 06:05 to 06:20 UTC (01:05 to 01:20 CDT), on Linux (ProBook), Node v24.22.0, Python 3.14.4, at `8bc5d86` with the existing `node_modules` (no fresh `npm ci`):

- `npm test`: 73/73 passed, 0 skipped.
- `npm run typecheck`, `npm run lint`, `npm run build`: exit 0; bundle `main-Dttd0-9S.js`.
- `python3 -m unittest discover -s tests -p 'test_*.py'`: 53 OK.

Not rerun after `8bc5d86`: later commits change only `docs/`.

Saved, at `116d943` (26 to 27 October):

- The same suites passed after `npm ci --ignore-scripts`, including the Silverstone lap import test and the test that the bundled summaries reproduce `selection.json` and the retest setting.
- The four Silverstone lap files matched their pinned sha256 values in `fixtures/provenance.json`; no data file has changed since.
- Chromium (Playwright) rehearsal and recorded video draft against a `vite preview` of the `116d943` build, which is the same bundle (`docs/demo-sequence-draft.md`).

Checks on GitHub: the Netlify deploy-preview check passed at `8bc5d86`. The repo has no test workflow, so there is no CI test run.

Not run: Firefox, Safari, Windows, any simulation rerun, any provider call.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
