"""Draw the rung-3 and rung-4 ladder tracks as F1TENTH gym maps.

Stdlib only, deterministic: the same arguments always produce the same bytes.
Each track is a closed loop of straights and constant-radius arcs. The gym
starts the car within the first 1 m of the raceline and a 600-step capture
covers about 14.5 m, so each track puts its feature in its first 14 m and the
rest of the loop only closes it. Output per track follows the Silverstone layout:
<Name>_map.png (8-bit grayscale), <Name>_map.yaml, <Name>_centerline.csv,
<Name>_raceline.csv.

Usage: python3 make_ladder.py [out_root]
"""

import math
import struct
import sys
import zlib
from pathlib import Path

HALF_WIDTH_M = 1.1  # same as Silverstone's w_tr_right_m / w_tr_left_m
RESOLUTION_M = 0.05  # metres per pixel
MARGIN_M = 1.5  # occupied border around the track's bounding box
STEP_M = 0.1  # target waypoint spacing
SPEED_MPS = 2.5  # matches the runner's target speed
CHICANE_DEG = 45.0

# ("S", length_m) is a straight; ("A", radius_m, degrees) is an arc, left if degrees > 0.
# The car starts at (0, 0) heading +x.
TRACKS = {
    # Rung 3: 5 m straight, one 90-degree left turn of radius 3 m, then a 10 m straight.
    "Turn": [("S", 5.0), ("A", 3.0, 90), ("S", 10.0), ("A", 3.0, 90), ("S", 10.0),
             ("A", 3.0, 90), ("S", 10.0), ("A", 3.0, 90), ("S", 5.0)],
    # Rung 4.1: two 90-degree left turns of radius 3 m, 1.5 m apart (a hairpin).
    "TwoTurns": [("S", 3.0), ("A", 3.0, 90), ("S", 1.5), ("A", 3.0, 90), ("S", 12.0),
                 ("A", 3.0, 90), ("S", 1.5), ("A", 3.0, 90), ("S", 9.0)],
    # Rung 4.2: chicane, 45 degrees left then 45 degrees right at radius 4 m, which moves
    # the line 2.34 m sideways. The return loop drops the extra 2.34 m on its far side.
    "Chicane": [("S", 4.0), ("A", 4.0, CHICANE_DEG), ("A", 4.0, -CHICANE_DEG), ("S", 6.0),
                ("A", 4.0, 90), ("S", 4.0), ("A", 4.0, 90), ("S", 24.0), ("A", 4.0, 90),
                ("S", 4.0 + 8.0 * (1 - math.cos(math.radians(CHICANE_DEG)))), ("A", 4.0, 90),
                ("S", 24.0 - 6.0 - 4.0 - 8.0 * math.sin(math.radians(CHICANE_DEG)))],
}


def trace(segments):
    """Return waypoints (x, y, psi, kappa, s) and the closure error in metres."""
    x = y = psi = s = 0.0
    points = []
    for segment in segments:
        if segment[0] == "S":
            length, kappa = segment[1], 0.0
        else:
            radius, degrees = segment[1], segment[2]
            length, kappa = radius * math.radians(abs(degrees)), math.copysign(1 / radius, degrees)
        n = max(1, math.ceil(length / STEP_M - 1e-9))
        ds = length / n
        for _ in range(n):
            points.append((x, y, psi % (2 * math.pi), kappa, s))
            if kappa == 0.0:
                x += ds * math.cos(psi)
                y += ds * math.sin(psi)
            else:
                turn = kappa * ds
                x += (math.sin(psi + turn) - math.sin(psi)) / kappa
                y -= (math.cos(psi + turn) - math.cos(psi)) / kappa
                psi += turn
            s += ds
    heading_error = (psi + math.pi) % (2 * math.pi) - math.pi
    return points, math.hypot(x, y), abs(heading_error), s


def segment_distance(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def write_png_gray(path: Path, rows: list[bytes], width: int) -> None:
    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    raw = b"".join(b"\x00" + row for row in rows)  # filter type 0 per scanline
    ihdr = struct.pack(">IIBBBBB", width, len(rows), 8, 0, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def build(name: str, segments, out_dir: Path) -> None:
    points, gap, heading_gap, total = trace(segments)
    if gap > 1e-6 or heading_gap > 1e-9:
        raise ValueError(f"{name} does not close: gap {gap} m, heading {heading_gap} rad")
    out_dir.mkdir(parents=True, exist_ok=True)

    # Grid aligned to whole pixels, covering the bounding box plus margin.
    ox = math.floor((min(p[0] for p in points) - HALF_WIDTH_M - MARGIN_M) / RESOLUTION_M) * RESOLUTION_M
    oy = math.floor((min(p[1] for p in points) - HALF_WIDTH_M - MARGIN_M) / RESOLUTION_M) * RESOLUTION_M
    width = math.ceil((max(p[0] for p in points) + HALF_WIDTH_M + MARGIN_M - ox) / RESOLUTION_M)
    height = math.ceil((max(p[1] for p in points) + HALF_WIDTH_M + MARGIN_M - oy) / RESOLUTION_M)

    # Free where the pixel centre is within HALF_WIDTH_M of the closed centerline polyline.
    free = [bytearray(width) for _ in range(height)]
    reach = math.ceil(HALF_WIDTH_M / RESOLUTION_M) + 2
    for i, (ax, ay, *_rest) in enumerate(points):
        bx, by = points[(i + 1) % len(points)][:2]
        c0, r0 = int((min(ax, bx) - ox) / RESOLUTION_M), int((min(ay, by) - oy) / RESOLUTION_M)
        c1, r1 = int((max(ax, bx) - ox) / RESOLUTION_M), int((max(ay, by) - oy) / RESOLUTION_M)
        for row in range(max(0, r0 - reach), min(height, r1 + reach + 1)):
            py = oy + (row + 0.5) * RESOLUTION_M
            line = free[row]
            for col in range(max(0, c0 - reach), min(width, c1 + reach + 1)):
                if not line[col] and segment_distance(ox + (col + 0.5) * RESOLUTION_M, py, ax, ay, bx, by) <= HALF_WIDTH_M:
                    line[col] = 255
    # PNG rows go top to bottom; the gym flips the image, so the last row is y = origin.
    write_png_gray(out_dir / f"{name}_map.png", [bytes(free[r]) for r in reversed(range(height))], width)

    (out_dir / f"{name}_map.yaml").write_text(
        f"image: {name}_map.png\n"
        f"resolution: {RESOLUTION_M}\n"
        f"origin: [{round(ox, 6)}, {round(oy, 6)}, 0.000000]\n"
        "negate: 0\n"
        "occupied_thresh: 0.45\n"
        "free_thresh: 0.196\n"
    )

    center = ["# x_m, y_m, w_tr_right_m, w_tr_left_m"]
    race = [
        f"# blurr {name.lower()} ladder track, lap {total:.3f} m",
        "# generated by data/f1tenth-ladder/make_ladder.py",
        "# s_m; x_m; y_m; psi_rad; kappa_radpm; vx_mps; ax_mps2",
    ]
    for x, y, psi, kappa, s in points:
        center.append(f"{x!r}, {y!r}, {HALF_WIDTH_M}, {HALF_WIDTH_M}")
        race.append(f"{s:.7f};{x:.7f};{y:.7f};{psi:.7f};{kappa:.7f};{SPEED_MPS:.7f};{0.0:.7f}")
    (out_dir / f"{name}_centerline.csv").write_text("\n".join(center) + "\n")
    (out_dir / f"{name}_raceline.csv").write_text("\n".join(race) + "\n")


def main(out_root: Path) -> None:
    for name, segments in TRACKS.items():
        build(name, segments, out_root / name)


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent)
