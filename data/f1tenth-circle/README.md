# F1TENTH constant-radius circle (Apache-2.0)

Rung 2 of the training ladder: one closed circle of constant radius, so every
point on the lap asks the same thing of the driver. The geometry is original,
drawn by `make_circle.py`, and is covered by the repository's Apache-2.0
license. No third-party track data is used.

- Centerline radius 8.0 m, half-width 1.1 m each side (Silverstone's value),
  lap length 50.27 m, counter-clockwise from (8, 0) heading +y.
- Map 480 x 480 px at 0.05 m/px, origin (-12, -12): 8-bit grayscale, 255 free
  inside the ring, 0 occupied everywhere else, including the infield.
- `Circle_centerline.csv`: 500 points, `x_m, y_m, w_tr_right_m, w_tr_left_m`,
  no repeated closing point (the gym closes the loop itself).
- `Circle_raceline.csv`: the same 500 points as `s; x; y; psi; kappa; vx; ax`.
  `psi` is the tangent heading in [0, 2pi); `kappa` is +0.125 1/m (left turn,
  same sign convention as Silverstone, where kappa = dpsi/ds); `vx` is 2.5 m/s,
  the runner's target speed; `ax` is 0.

To regenerate: `python3 make_circle.py`. The output is byte-identical on every
run. sha256 of the files in `Circle/`:

```
09a050710f582863624c95b8c942720b289275df43b7b84e06a7d9f54b9b37f2  Circle_map.png
5f54a8dcfb63545a8b48a5c265614c7ea42028f2474a5d211559a144060a5c87  Circle_map.yaml
d9a2ad5954d94d13888e102b2f6ff9a943ce3aeeaaa5a490f62d4b6e99040659  Circle_centerline.csv
f05fa3dec2cef90dc49a44633040948e1faec7fa0528ffe685dcf66c3dad1c7a  Circle_raceline.csv
```

Checked offline only: PNG values {0, 255}, free area 110.57 m2 against the
ideal ring's 110.58 m2, walls 0.06 m outside each edge occupied all the way
round, `s` strictly increasing, `psi` within 6e-7 rad of the neighbour
tangent. Not yet loaded in the gym or driven. To use it, copy `Circle/` into
the gym's `maps/` folder and load the track by the name `Circle`; the runner
currently hardcodes Silverstone and its asset hashes, so it needs a change
before it can drive this track.
