"""Selection rule for the ladder sweep: elimination carries forward, scores are cumulative."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import select_sweep_setting as pick


def row(gain, lookahead, mean, ok=True):
    return {"gain": gain, "lookahead_points": lookahead, "exit_code": 0, "sample_count": 600 if ok else 312,
            "stop_reason": "step_limit" if ok else "terminated", "mean_abs_raceline_deviation_m": mean}


class SelectionTests(unittest.TestCase):
    def test_a_setting_that_crashes_a_later_rung_is_out_even_if_it_led_earlier(self):
        result = pick.select([
            ("Circle", [row(.65, 14, .05), row(1.25, 6, .01), row(.85, 10, .03)]),
            ("Turn", [row(.65, 14, .04), row(1.25, 6, .00, ok=False), row(.85, 10, .03)]),
        ])
        self.assertEqual(result["standings"][0]["leader"]["gain"], 1.25)
        self.assertEqual((result["chosen"]["gain"], result["chosen"]["ladder_lookahead_points"]), (.85, 10))
        self.assertEqual(result["standings"][1]["still_in_running"], 2)
        self.assertEqual(result["standings"][1]["baseline"]["rank"], 2)
        self.assertAlmostEqual(result["standings"][1]["leader"]["cumulative_mean_abs_deviation_m"], .03)

    def test_leader_uses_the_mean_over_all_rungs_so_far(self):
        result = pick.select([
            ("Circle", [row(.65, 14, .01), row(.85, 10, .02)]),
            ("Turn", [row(.65, 14, .05), row(.85, 10, .02)]),
        ])
        self.assertEqual(result["standings"][0]["leader"]["gain"], .65)
        self.assertEqual(result["chosen"]["gain"], .85)

    def test_ties_go_to_lower_gain_then_shorter_lookahead_and_lookahead_halves_for_silverstone(self):
        result = pick.select([("Circle", [row(.85, 12, .02), row(.85, 10, .02), row(.95, 8, .02)])])
        self.assertEqual(result["chosen"], {"gain": .85, "ladder_lookahead_points": 10, "silverstone_lookahead_points": 5})

    def test_failed_process_counts_as_not_completed(self):
        failed = {"gain": .85, "lookahead_points": 10, "exit_code": 2}
        result = pick.select([("Circle", [row(.65, 14, .05), failed])])
        self.assertEqual(result["chosen"]["gain"], .65)

    def test_grid_mismatch_duplicates_and_total_failure_are_refused(self):
        with self.assertRaisesRegex(ValueError, "grid differs"):
            pick.select([("Circle", [row(.65, 14, .05)]), ("Turn", [row(.85, 10, .05)])])
        with self.assertRaisesRegex(ValueError, "duplicate"):
            pick.select([("Circle", [row(.65, 14, .05), row(.65, 14, .04)])])
        with self.assertRaisesRegex(ValueError, "no setting completed"):
            pick.select([("Circle", [row(.65, 14, .05, ok=False)])])


class BundledSweepTests(unittest.TestCase):
    def test_bundled_summaries_reproduce_the_bundled_selection_and_the_retest_setting(self):
        data = Path(__file__).resolve().parents[1] / "data"
        rungs = [(name, pick.load(data / "f1tenth-sweep" / f"{name.lower()}.jsonl")) for name in ("Circle", "Turn", "TwoTurns", "Chicane")]
        self.assertEqual([len(rows) for _, rows in rungs], [100] * 4)
        result = pick.select(rungs)
        self.assertEqual(result, json.loads((data / "f1tenth-sweep" / "selection.json").read_text()))
        retest = json.loads((data / "f1tenth-silverstone" / "retest-lap-session.json").read_text())["controller"]
        self.assertEqual((retest["steering_gain"], retest["lookahead_points"]),
                         (result["chosen"]["gain"], result["chosen"]["silverstone_lookahead_points"]))


if __name__ == "__main__":
    unittest.main()
