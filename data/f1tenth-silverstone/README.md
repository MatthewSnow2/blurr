# F1TENTH Silverstone run A (GPL-3.0)

This directory is licensed under the GNU General Public License v3.0 (see
`LICENSE`), not the Apache-2.0 license that covers the rest of the repository.

- `run-a-session.json`: sealed 600-sample F1TENTH gym capture driven on the
  Silverstone track from `f1tenth/f1tenth_racetracks@b95c4eff766f6367d66b310ea20cd2c9563712c0`
  (GPL-3.0). sha256 `4c2667dd19a367c5f6f154536b4e63bedbda24a4f68f7664f98a8be2584574fb`.
- `run-a-nebius-report.json`: the saved coaching report from one Nebius call
  (`nvidia/nemotron-3-super-120b-a12b`, 23 October 2026) on that session.
  sha256 `ad3cb661f6fb38689064599152240a6dae7229eabc030c128901eda896fd1248`.

Both files are byte-identical copies of the sealed originals, so their hashes
and the report's session binding still verify. Fields written at capture time,
such as `circuit.distributable_fixture: false` and the provenance note, predate
the redistribution decision and are left unchanged on purpose. Redistribution
of the Silverstone assets under GPL-3.0 was cleared on 23 October 2026; source
attribution and pinned asset hashes are in `../../THIRD-PARTY-NOTICES.txt`.

To view them, run the app, import `run-a-session.json`, then use
**Import saved report** with `run-a-nebius-report.json`.
