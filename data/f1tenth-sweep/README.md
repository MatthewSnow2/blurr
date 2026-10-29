# Ladder controller sweep (26 October 2026)

Offline tuning of the reconstructed F1TENTH controller, not learning. Each file
`{circle,turn,twoturns,chicane}.jsonl` has 100 rows, one per gain and lookahead
setting (gain 0.35 to 1.25 step 0.1, lookahead 6 to 24 raceline points step 2).
Every run used seed 20261009, 600 steps, 0.01 s timestep, 2.5 m/s and a
0.35 rad steering limit. A row gives the setting, exit code, sample count, stop
reason, mean and max |raceline deviation| and the sha256 of that run's
`session.json`. The 400 sessions themselves are not bundled. The files were
written by PowerShell and start with a UTF-8 byte order mark.

`selection.json` is the output of

```sh
python3 scripts/select_sweep_setting.py Circle=data/f1tenth-sweep/circle.jsonl \
  Turn=data/f1tenth-sweep/turn.jsonl TwoTurns=data/f1tenth-sweep/twoturns.jsonl \
  Chicane=data/f1tenth-sweep/chicane.jsonl
```

A setting stays in the running only if it completed every rung; the winner has
the lowest mean of its per-rung mean |deviation|. All 100 completed all four
rungs. Chosen: gain 1.05, lookahead 6 points (0.6 m), which is 3 points on
Silverstone's wider waypoint spacing. `tests/test_select_sweep_setting.py`
checks that these files reproduce `selection.json` and the retest controller.

Harnesses (Windows, ALIENPC paths): `scripts/f1tenth-sweep/rung-sweep.ps1` and
`scripts/f1tenth-sweep/silverstone-pair.ps1`. Licensed Apache-2.0 like the
ladder tracks; the Silverstone captures are in `../f1tenth-silverstone/`.
