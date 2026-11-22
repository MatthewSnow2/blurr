"""Pick the controller setting the ladder sweep carries to Silverstone.

Standard library only. Reads one summary.jsonl per rung (from rung-sweep.ps1), in
ladder order. A setting stays in the running only while it completes every rung
so far (600 samples, stop_reason step_limit). After each rung the leader is the
surviving setting with the lowest mean of its per-rung mean |raceline deviation|.
Ties go to the lower gain, then the shorter lookahead.

Lookahead is counted in raceline points. Ladder waypoints are about 0.1 m apart
and Silverstone's 2236 points over 446.2 m are about 0.2 m apart, so the same
lookahead distance on Silverstone is half the points.

Usage: python3 select_sweep_setting.py <rung>=<summary.jsonl> [...]
"""

import json
import sys

BASELINE = (0.65, 14)
LADDER_TO_SILVERSTONE_POINTS = 0.5


def load(path):
    with open(path, encoding="utf-8-sig") as stream:
        return [json.loads(line) for line in stream if line.strip()]


def completed(row):
    return row.get("exit_code") == 0 and row.get("sample_count") == 600 and row.get("stop_reason") == "step_limit"


def select(rungs):
    """rungs: list of (name, rows). Returns the per-rung standings and the final pick."""
    alive, scores, standings = None, {}, []
    for name, rows in rungs:
        by_setting = {(row["gain"], row["lookahead_points"]): row for row in rows}
        if len(by_setting) != len(rows):
            raise ValueError(f"{name}: duplicate settings in summary")
        if alive is not None and set(by_setting) != set(scores):
            raise ValueError(f"{name}: grid differs from the first rung")
        done = {key for key, row in by_setting.items() if completed(row)}
        alive = done if alive is None else alive & done
        for key in by_setting:
            if completed(by_setting[key]):
                scores.setdefault(key, []).append(by_setting[key]["mean_abs_raceline_deviation_m"])
            else:
                scores.setdefault(key, [])
        ranked = sorted(alive, key=lambda key: (sum(scores[key]) / len(scores[key]), key))
        if not ranked:
            raise ValueError(f"no setting completed every rung through {name}")
        mean = {key: sum(scores[key]) / len(scores[key]) for key in alive}
        standings.append({"rung": name, "settings_run": len(rows), "completed_this_rung": len(done),
                          "still_in_running": len(alive), "leader": {"gain": ranked[0][0], "lookahead_points": ranked[0][1],
                          "cumulative_mean_abs_deviation_m": mean[ranked[0]]},
                          "baseline": {"in_running": BASELINE in alive, "rank": ranked.index(BASELINE) + 1 if BASELINE in alive else None,
                                       "cumulative_mean_abs_deviation_m": mean.get(BASELINE)}})
    gain, points = ranked[0]
    return {"standings": standings, "chosen": {"gain": gain, "ladder_lookahead_points": points,
            "silverstone_lookahead_points": round(points * LADDER_TO_SILVERSTONE_POINTS)}}


def main(argv):
    rungs = []
    for argument in argv:
        name, _, path = argument.partition("=")
        if not path:
            raise SystemExit("usage: select_sweep_setting.py <rung>=<summary.jsonl> [...]")
        rungs.append((name, load(path)))
    print(json.dumps(select(rungs), indent=2))


if __name__ == "__main__":
    main(sys.argv[1:])
