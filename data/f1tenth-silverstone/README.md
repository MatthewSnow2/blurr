# F1TENTH Silverstone captures (GPL-3.0)

This directory is licensed under the GNU General Public License v3.0 (see
`LICENSE`), not the Apache-2.0 license that covers the rest of the repository.

- `run-a-session.json`: sealed 600-sample F1TENTH gym capture driven on the
  Silverstone track from `f1tenth/f1tenth_racetracks@b95c4eff766f6367d66b310ea20cd2c9563712c0`
  (GPL-3.0). sha256 `4c2667dd19a367c5f6f154536b4e63bedbda24a4f68f7664f98a8be2584574fb`.
- `run-a-nebius-report.json`: the saved coaching report from one Nebius call
  (`nvidia/nemotron-3-super-120b-a12b`, 23 October 2026) on that session.
  sha256 `ad3cb661f6fb38689064599152240a6dae7229eabc030c128901eda896fd1248`.

Lap attempts from 26 October 2026 (runner commit `76b3813`, 18,600-step cap,
seed 20261009, same track assets):

- `baseline-lap-session.json`: default controller (gain 0.65, lookahead 14
  points). Collided at 12.14 s, about 30 m in. sha256
  `1cbb327c4ff758ee0deff0b4b80982fd84b556abf081dc2edaa84543f19dd7d6`.
- `retest-lap-session.json`: the setting chosen by the ladder sweep (gain 1.05,
  lookahead 3 points, see `../f1tenth-sweep/`). Collided at 27.44 s, about
  68 m in. sha256
  `732370d3e92d36d2f4d98e2546019635f59bc49f69e3a114b5852c61b0566d63`.
- `baseline-lap-nebius-report.json` and `retest-lap-nebius-report.json`: one
  saved report per attempt, each from one Nebius call on 26 October.

Each attempt was run twice; run B matched run A on every stable field. Only
run A is bundled.

All these files are byte-identical copies of the sealed originals, so their hashes
and the report's session binding still verify. Fields written at capture time,
such as `circuit.distributable_fixture: false` and the provenance note, predate
the redistribution decision and are left unchanged on purpose. Redistribution
of the Silverstone assets under GPL-3.0 was cleared on 23 October 2026; source
attribution and pinned asset hashes are in `../../THIRD-PARTY-NOTICES.txt`.

To view one, run the app, import a `*-session.json`, then use **Import saved
report** with the matching `*-nebius-report.json`.
