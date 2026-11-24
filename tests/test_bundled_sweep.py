"""The bundled ladder sweep reproduces its recorded selection and the Silverstone retest setting."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import select_sweep_setting as pick


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
