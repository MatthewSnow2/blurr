# F1TENTH ladder tracks, rungs 3 to 4.2 (Apache-2.0)

The next rungs after the rung-2 circle (`data/f1tenth-circle/`). Each track is a
closed loop of straights and constant-radius arcs, drawn by `make_ladder.py`.
The geometry is original and covered by the repository's Apache-2.0 license.
No third-party track data is used.

The gym starts the car within the first 1 m of the raceline, and a 600-step
capture at 2.5 m/s covers about 14.5 m. So each track puts its feature in its
first 14 m, and the rest of the loop only closes it.

| Track | Rung | Feature in the first 14 m | Lap | Map |
|---|---|---|---|---|
| `Turn` | 3 | 5 m straight, one 90° left turn at R 3 m, then straight | 58.85 m | 425 x 424 px |
| `TwoTurns` | 4.1 | 3 m straight, two 90° left turns at R 3 m, 1.5 m apart (a hairpin) | 45.85 m | 464 x 255 px |
| `Chicane` | 4.2 | 4 m straight, 45° left then 45° right at R 4 m (2.34 m sideways), then straight | 84.10 m | 745 x 392 px |

All three share the Silverstone and circle conventions:

- Half-width 1.1 m each side, 0.05 m/px, 8-bit grayscale PNG with 255 free and 0
  occupied. The margin is 1.5 m around the bounding box.
- `<Name>_centerline.csv`: `x_m, y_m, w_tr_right_m, w_tr_left_m`, with waypoints
  about 0.1 m apart and no repeated closing point.
- `<Name>_raceline.csv`: the same points as `s; x; y; psi; kappa; vx; ax`.
  `psi` is in [0, 2pi), `kappa` is +1/R on left arcs, -1/R on right arcs and 0
  on straights, `vx` is 2.5 m/s and `ax` is 0.
- The car starts at (0, 0) heading +x.

To regenerate, run `python3 make_ladder.py`. The output is byte-identical on every
run, and `tests/test_f1tenth_capture_runner.py` checks it against the runner's
pins.

## Offline checks

These were checked on 26 October 2026, before any simulator run:

| Track | Loop closure | PNG values | Free area against ideal tube | Closest far-apart points |
|---|---|---|---|---|
| `Turn` | 1.9e-13 m | {0, 255} | 129.45 m² / 129.47 m² | 5.94 m |
| `TwoTurns` | 1.3e-13 m | {0, 255} | 100.85 m² / 100.87 m² | 5.94 m |
| `Chicane` | 2.8e-13 m | {0, 255} | 185.04 m² / 185.02 m² | 6.29 m |

"Closest far-apart points" is the nearest approach between two points more than
7 m apart along the loop. It stays well above the 2.2 m track width, so no two
corridors merge.

A stdlib kinematic-bicycle preview ran the runner's controller (lookahead 14
points, gain 0.65, limit 0.35 rad) for 600 steps on each track. Every track kept
within 0.09 m of the line, against 0.95 m of room to the wall. That preview is
not the gym's dynamics. The gym captures below are the evidence.

To use a track, copy `<Name>/` into the gym's `maps/` folder. Then run the
capture runner with `--track <Name>`, which pins the four hashes.

sha256 of the track files:

```
8ad960f2dfad77ee7e8ce004a6fd4c51fa90a43aec761f28b34077c5716b91ea  Turn/Turn_centerline.csv
d875b18a1ac03075e3d7d2b6be4e313a8748a4f4bcc01d5a4dcebba61e4896ba  Turn/Turn_map.png
6b62117e2f0e859fe3ce5c64685831a89c83ae363fffc8f69c5c1ceff5c21ffa  Turn/Turn_map.yaml
73d78f765710594f0ecdc92e2bcf8d68ae9395bd3f9d656de669a0e6fa602292  Turn/Turn_raceline.csv
9213a5285d10c596741786aa13025c4ca730b92b1f90535b2884eb8a4cf59760  TwoTurns/TwoTurns_centerline.csv
819f8aec83ea10f888c05db2282ea9821ab9adce3c29ff0c832b7ed6252df85d  TwoTurns/TwoTurns_map.png
9ae3dba749805efe69dcc2768573460b0c647af273cf65528ddff2f3eb3aa2a5  TwoTurns/TwoTurns_map.yaml
e97d7e4675f8b6bdd1a3e0353b13fccc94efc0f141180e59ee97d606915c7403  TwoTurns/TwoTurns_raceline.csv
6bcc1a635d8ef2723a84c09d774925b69eae62014c3b32d0f7633fc96ae288b4  Chicane/Chicane_centerline.csv
d4972c5dc551ac617c4d9f5cc35cb9dc60ea6f368047f032de6897b5be8a467c  Chicane/Chicane_map.png
a5a431c0f31f1607b08e90ef037ed6f5ea42e7fd1ff09a79b37e4416b1d09ad5  Chicane/Chicane_map.yaml
776d3b9e89c91e016f88d28b51aede833aaa8e4d3f241dfdb66271efcc43fea9  Chicane/Chicane_raceline.csv
```
