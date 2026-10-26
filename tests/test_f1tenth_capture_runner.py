"""New runner tests: fake adapter and tiny Python helpers only; never a simulator."""
import contextlib
import hashlib
import io
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import f1tenth_capture_core as core
import capture_f1tenth_reconstructed as runner


class FakeState:
    def __init__(self, terminal_at=None, truncated_at=None, fail=None, count=32):
        self.index = self.closed = self.loaded = 0
        self.actions = []
        self.terminal_at, self.truncated_at, self.fail, self.count = terminal_at, truncated_at, fail, count

    def load_track(self, name):
        assert name in runner.TRACKS
        self.track_name = name
        self.loaded += 1
        if self.fail == "load":
            raise RuntimeError("fake load failed")

    def raceline_slice(self, start, count):
        end = min(start + count, self.count)
        page = {"total_points": self.count, "range": [start, end], "s_m_total": float(self.count), "s_m_source": "geometry",
                "x": [math.cos(2 * math.pi * i / self.count) for i in range(start, end)],
                "y": [math.sin(2 * math.pi * i / self.count) for i in range(start, end)],
                "s_m": [float(i) for i in range(start, end)]}
        if self.fail == "page":
            page["range"] = [0, 0]
        return page

    def reset(self, seed):
        self.seed = seed
        return self.obs()

    def obs(self):
        return {"pose_x": -.1 * self.index, "pose_y": 0, "pose_theta": 0, "linear_vel_x": 0 if self.index == 1 else 2.5, "delta": 0}

    def step(self, steering, speed):
        self.actions.append((steering, speed))
        self.index += 1
        if self.fail == "step":
            raise RuntimeError("fake step failed")
        obs = self.obs()
        if self.fail == "nonfinite":
            obs["pose_x"] = float("nan")
        return SimpleNamespace(obs=obs, reward=0.01, terminated=self.index == self.terminal_at,
                               truncated=self.index == self.truncated_at, step_index=self.index)

    def analyze_deviation(self):
        value = {"analysis_version": "raceline-v2", "reference_kind": "raceline", "reference_geometry": "piecewise_linear_closed",
                 "lateral_dev_m": self.index * .01, "heading_dev_rad": 0, "s_frenet": self.index * .1,
                 "speed_optimal_mps": 3.0, "curvature_now": .02}
        if self.fail == "reference":
            value["reference_kind"] = "centerline"
        return value

    def close(self):
        self.closed += 1
        if self.fail == "close":
            raise RuntimeError("fake close failed")


def capture(state=None, config=None, clock=lambda: 0, track="Silverstone"):
    state = state or FakeState()
    return core.collect(state, config or core.CaptureConfig(steps=4),
                        lambda state: {"timestep_s": .01, "render_mode": None}, lambda state: state.close(),
                        track_name=track, clock=clock)


def candidate(track="Silverstone"):
    value = capture(track=track)
    value.update({"producer": {"adapter_commit": runner.ADAPTER_COMMIT, "gym_commit": runner.GYM_COMMIT,
                               "adapter_module_sha256": runner.MODULE_SHA256, "local_track_asset_sha256": runner.TRACKS[track]["assets"]},
                  "started_at_utc": "2026-10-16T00:00:00+00:00", "python": {"version": "mock_fixture"},
                  "child_environment": dict(runner.CHILD_ENVIRONMENT),
                  "adapter_module_path": "mock_fixture", "gym_module_path": "mock_fixture"})
    return value


class CaptureCoreTests(unittest.TestCase):
    def test_bounded_deterministic_controller_and_preserved_stationary_negative_values(self):
        state = FakeState()
        result = capture(state)
        self.assertEqual(result, capture())
        self.assertEqual(len(state.actions), 4)
        self.assertTrue(all(abs(steer) <= .35 and speed == 2.5 for steer, speed in state.actions))
        self.assertEqual(state.seed, 20261009)
        self.assertEqual(state.closed, 1)
        self.assertEqual(result["samples"][0]["observation"]["linear_vel_x_mps"], 0)
        self.assertEqual(result["samples"][0]["observation"]["pose_x_m"], -.1)
        self.assertEqual(result["samples"][-1]["sim_time_s"], .04)
        self.assertFalse(result["controller"]["historical_runner_recovered"])

    def test_terminal_or_truncated_episode_never_steps_again(self):
        for state in (FakeState(terminal_at=2), FakeState(truncated_at=2)):
            with self.subTest(state=state):
                result = capture(state)
                self.assertEqual(len(state.actions), 2)
                self.assertEqual(result["outcome"]["sample_count"], 2)
                self.assertEqual(state.closed, 1)

    def test_configuration_rejects_before_load_or_step(self):
        for kwargs in ({"steps": True}, {"steps": 0}, {"steps": 601}, {"seed": -1}, {"timeout_s": float("nan")},
                       {"timeout_s": 121}, {"speed_mps": 3}, {"timestep_s": .02}):
            state = FakeState()
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                capture(state, core.CaptureConfig(**kwargs))
            self.assertEqual(state.loaded, 0)

    def test_load_step_page_reference_and_numeric_failures_always_attempt_cleanup(self):
        for failure in ("load", "step", "page", "reference", "nonfinite"):
            state = FakeState(fail=failure)
            with self.subTest(failure=failure), self.assertRaises((RuntimeError, ValueError)):
                capture(state)
            self.assertEqual(state.closed, 1)

    def test_cleanup_failure_prevents_candidate_return(self):
        state = FakeState(fail="close")
        with self.assertRaisesRegex(RuntimeError, "close failed"):
            capture(state)

    def test_deadline_and_regressing_clock_fail_closed(self):
        for values in ([0, .1], [0, .02, .01]):
            state = FakeState()
            iterator = iter(values)
            with self.subTest(values=values), self.assertRaises(TimeoutError):
                capture(state, core.CaptureConfig(steps=4, timeout_s=.05), clock=lambda: next(iterator))
            self.assertEqual(state.closed, 1)

    def test_runtime_timestep_and_render_mode_are_checked(self):
        for receipt in ({"timestep_s": .02, "render_mode": None}, {"timestep_s": .01, "render_mode": "human"}):
            state = FakeState()
            with self.assertRaises(ValueError):
                core.collect(state, core.CaptureConfig(steps=1), lambda state: receipt, lambda state: state.close(), track_name="Silverstone", clock=lambda: 0)
            self.assertEqual(state.closed, 1)

    def test_controller_nonfinite_or_outside_bound_never_reaches_step(self):
        for steering in (float("nan"), .36):
            state = FakeState()
            with patch.object(core, "steering_for", return_value=steering), self.assertRaises(ValueError):
                capture(state)
            self.assertEqual(state.actions, [])

    def test_paged_geometry_and_serialized_capacity(self):
        result = capture(FakeState(count=130))
        self.assertRegex(result["geometry_sha256"], r"^[a-f0-9]{64}$")
        with patch.object(core, "MAX_BYTES", 10), self.assertRaises(ValueError):
            capture()


class SupervisorAndPublicationTests(unittest.TestCase):
    def test_comparison_checks_receipts_exact_samples_and_qualification_without_promoting_mock_data(self):
        value = capture(config=core.CaptureConfig(steps=600))
        template = candidate()
        template.update(value)
        document = runner.finalize(template, SimpleNamespace(track="Silverstone", steps=600, seed=20261009, timeout=120), {})
        document["provenance"]["offline_mock_fixture"] = True
        document["circuit"]["name"] = "Offline mocked comparison fixture"
        with tempfile.TemporaryDirectory() as folder:
            a, b = Path(folder) / "a", Path(folder) / "b"
            runner.publish(document, a)
            other = json.loads(json.dumps(document)); other["captured_at_utc"] = "2026-10-16T00:01:00+00:00"
            runner.publish(other, b)
            result = runner.compare_bundles([a, b])
            self.assertEqual(result["samples_per_run"], 600)
            self.assertEqual(result["real_simulator_qualification"], "pending")
            receipt = b / "receipt.json"; original = receipt.read_bytes(); receipt.write_text('{"sha256":"wrong","bytes":0}')
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                runner.compare_bundles([a, b])
            receipt.write_bytes(original)
            raw = b / "session.json"; other["samples"][0]["observation"]["pose_x_m"] += .1
            payload = core.encode(other); raw.write_bytes(payload)
            metadata = json.loads(receipt.read_text()); metadata.update(sha256=hashlib.sha256(payload).hexdigest(), bytes=len(payload)); receipt.write_text(json.dumps(metadata))
            with self.assertRaisesRegex(ValueError, "not identical"):
                runner.compare_bundles([a, b])

    def test_tiny_owned_helper_success_without_any_simulator_import(self):
        with tempfile.TemporaryDirectory() as folder:
            script = "from pathlib import Path; import sys; Path(sys.argv[1], 'candidate.json').write_text('{\"fake\":true}')"
            result = runner.supervise([sys.executable, "-c", script, folder], folder, 2, dict(os.environ))
            self.assertEqual(result, {"fake": True})

    def test_blocked_owned_helper_is_killed_at_hard_deadline_and_cannot_publish(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(TimeoutError):
                runner.supervise([sys.executable, "-c", "import time; time.sleep(30)"], folder, .1, dict(os.environ))
            self.assertFalse((Path(folder) / "candidate.json").exists())

    def test_nonzero_worker_and_missing_candidate_fail(self):
        for script in ("raise SystemExit(2)", "pass"):
            with tempfile.TemporaryDirectory() as folder, self.assertRaises(ValueError):
                runner.supervise([sys.executable, "-c", script], folder, 2, dict(os.environ))

    def test_log_and_candidate_bounds_fail(self):
        for script in ("print('x'*70000)", "from pathlib import Path; import sys; Path(sys.argv[1],'candidate.json').write_text('x'*100)"):
            with tempfile.TemporaryDirectory() as folder, patch.object(runner, "MAX_BYTES", 10), self.assertRaises((ValueError, TimeoutError)):
                runner.supervise([sys.executable, "-c", script, folder], folder, 2, dict(os.environ))

    def test_finalization_recomputes_summary_and_keeps_qualification_pending(self):
        args = SimpleNamespace(track="Silverstone", steps=4, seed=20261009, timeout=120)
        doc = runner.finalize(candidate(), args, {"kind": "mock_resource_fixture"})
        self.assertEqual(doc["provenance"]["real_simulator_qualification"], "pending")
        self.assertFalse(doc["circuit"]["distributable_fixture"])
        for mutate in (lambda c: c["outcome"].update(mean_abs_raceline_deviation_m=999),
                       lambda c: c["samples"][0].update(sim_time_s=2),
                       lambda c: c["samples"][0]["simulation_action"].update(steering_rad=.8),
                       lambda c: c["producer"].update(gym_commit="wrong")):
            value = candidate(); mutate(value)
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                runner.finalize(value, args, {})

    def test_environment_recorded_after_gymnasium_import_passes_and_real_drift_rejects(self):
        # gymnasium/__init__.py sets PYGAME_HIDE_SUPPORT_PROMPT="hide" on import; the worker records env after capture.
        args = SimpleNamespace(track="Silverstone", steps=4, seed=20261009, timeout=120)
        value = candidate(); value["child_environment"]["PYGAME_HIDE_SUPPORT_PROMPT"] = "hide"
        runner.finalize(value, args, {})
        value = candidate(); value["child_environment"]["SDL_VIDEODRIVER"] = "windows"
        with self.assertRaises(ValueError):
            runner.finalize(value, args, {})

    def test_exclusive_bundle_receipt_and_existing_output_preserved(self):
        doc = runner.finalize(candidate(), SimpleNamespace(track="Silverstone", steps=4, seed=20261009, timeout=120), {})
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "new-bundle"
            receipt = runner.publish(doc, output)
            raw = (output / "session.json").read_bytes()
            self.assertEqual(receipt["sha256"], hashlib.sha256(raw).hexdigest())
            with self.assertRaises(FileExistsError):
                runner.publish(doc, output)
            self.assertEqual(raw, (output / "session.json").read_bytes())

    def test_explicit_mock_export_roundtrips_existing_blurr_f1tenth_importer(self):
        document = runner.finalize(candidate(), SimpleNamespace(track="Silverstone", steps=4, seed=20261009, timeout=120), {"kind": "mock"})
        document["provenance"]["offline_mock_fixture"] = True
        document["circuit"]["name"] = "Offline mock fixture · reconstructed runner (qualification pending)"
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "offline-mock.json"
            source.write_bytes(core.encode(document))
            script = ("import {readFileSync} from 'node:fs'; import {importSealedSessionFile} from "
                      + json.dumps((ROOT / "src/lib/sessionStore.ts").as_uri()) + "; "
                      "const s=await importSealedSessionFile(new File([readFileSync(process.argv[1])],'offline-mock.json'));"
                      "console.log(JSON.stringify({count:s.sampleCount,name:s.circuitName,source:s.source}));")
            result = subprocess.run(["node", "--experimental-strip-types", "--input-type=module", "-e", script, str(source)],
                                    capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            parsed = json.loads(result.stdout)
            self.assertEqual(parsed["count"], 4)
            self.assertEqual(parsed["source"], "f1tenth")
            self.assertIn("Offline mock fixture", parsed["name"])
            self.assertIn("qualification pending", parsed["name"])

    def test_partial_publication_cleanup_and_failure_evidence(self):
        doc = runner.finalize(candidate(), SimpleNamespace(track="Silverstone", steps=4, seed=20261009, timeout=120), {})
        original = Path.open

        def failing_open(path, *args, **kwargs):
            if path.name == "receipt.json":
                raise OSError("mock receipt failure")
            return original(path, *args, **kwargs)

        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "new-bundle"
            with patch.object(Path, "open", failing_open), self.assertRaises(OSError):
                runner.publish(doc, output)
            self.assertFalse(output.exists())
            (Path(folder) / "stdout.log").write_text("mock output")
            runner.retain_failure(output, folder, TimeoutError())
            self.assertEqual(json.loads((Path(folder) / "new-bundle.failed/failure.json").read_text())["status"], "failed_unsealed")
            runner.retain_failure(output, folder, ValueError())
            self.assertEqual(json.loads((Path(folder) / "new-bundle.failed/failure.json").read_text())["error_type"], "TimeoutError")


class SourceAndCliTests(unittest.TestCase):
    def invocation(self, output):
        return ["--run", "--steps", "4", "--output", str(output), "--expected-runner-sha256", runner.digest(runner.__file__),
                "--expected-core-sha256", runner.digest(ROOT / "scripts/f1tenth_capture_core.py")]

    def test_main_success_with_injected_worker_only_and_failure_retains_no_session(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "bundle"
            with patch.object(runner, "windows_resources", return_value={"mock": True}), patch.object(runner, "inspect_sources"), \
                    patch.object(runner, "supervise", return_value=candidate()) as supervise, contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(runner.main(self.invocation(output)), 0)
                self.assertIn("--worker-token", supervise.call_args.args[0])
                self.assertEqual(supervise.call_args.args[3]["NUMBA_NUM_THREADS"], "1")
            self.assertTrue((output / "receipt.json").is_file())
            failed = Path(folder) / "failed-run"
            with patch.object(runner, "windows_resources", return_value={"mock": True}), patch.object(runner, "inspect_sources"), \
                    patch.object(runner, "supervise", side_effect=TimeoutError()), contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(runner.main(self.invocation(failed)), 2)
            self.assertFalse(failed.exists())
            self.assertEqual(json.loads((Path(str(failed) + ".failed") / "failure.json").read_text())["status"], "failed_unsealed")

    def test_raw_close_failure_is_not_hidden_by_adapter_cleanup(self):
        state = SimpleNamespace(_env=SimpleNamespace(close=lambda: (_ for _ in ()).throw(RuntimeError("raw close failed"))))
        calls = []
        state.close = lambda: calls.append("adapter close")
        with self.assertRaisesRegex(RuntimeError, "raw close failed"):
            runner.cleanup_runtime(state)
        self.assertEqual(calls, ["adapter close"])

    def test_busy_or_unknown_host_resource_gate_prevents_worker(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(runner, "windows_resources", side_effect=ValueError("resource gate")), \
                patch.object(runner, "supervise") as supervise, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(runner.main(self.invocation(Path(folder) / "bundle")), 2)
            supervise.assert_not_called()

    def test_source_digest_mismatch_before_import(self):
        with tempfile.TemporaryDirectory() as folder:
            module = Path(folder) / "src/f1tenth_mcp/env_state.py"
            module.parent.mkdir(parents=True); module.write_text("raise RuntimeError('must never execute')")
            with patch.object(runner, "check_git"), self.assertRaisesRegex(ValueError, "digest/path mismatch"):
                runner.inspect_sources(folder, folder, "Silverstone")

    def test_missing_or_changed_assets_fail_before_any_simulator_import(self):
        with tempfile.TemporaryDirectory() as folder:
            module = Path(folder) / "src/f1tenth_mcp/env_state.py"
            module.parent.mkdir(parents=True); module.write_text("# mocked inert source")
            with patch.object(runner, "check_git"), patch.object(runner, "MODULE_SHA256", runner.digest(module)), self.assertRaises(FileNotFoundError):
                runner.inspect_sources(folder, folder, "Silverstone")
            assets = Path(folder) / "maps/Silverstone"
            assets.mkdir(parents=True)
            for name in runner.TRACKS["Silverstone"]["assets"]:
                (assets / name).write_text("changed mock asset")
            with patch.object(runner, "check_git"), patch.object(runner, "MODULE_SHA256", runner.digest(module)), self.assertRaisesRegex(ValueError, "asset differs"):
                runner.inspect_sources(folder, folder, "Silverstone")

    def test_circle_pins_match_committed_map_bytes(self):
        folder = ROOT / "data/f1tenth-circle/Circle"
        self.assertEqual({path.name: runner.digest(path) for path in folder.iterdir()}, runner.TRACKS["Circle"]["assets"])

    def test_named_track_selects_its_own_asset_folder_and_rejects_unknown_names(self):
        with tempfile.TemporaryDirectory() as folder:
            module = Path(folder) / "src/f1tenth_mcp/env_state.py"
            module.parent.mkdir(parents=True); module.write_text("# mocked inert source")
            assets = Path(folder) / "maps/Circle"
            assets.mkdir(parents=True)
            for path in (ROOT / "data/f1tenth-circle/Circle").iterdir():
                (assets / path.name).write_bytes(path.read_bytes())
            with patch.object(runner, "check_git"), patch.object(runner, "MODULE_SHA256", runner.digest(module)):
                self.assertEqual(runner.inspect_sources(folder, folder, "Circle")["local_track_asset_sha256"], runner.TRACKS["Circle"]["assets"])
                with self.assertRaises(FileNotFoundError):
                    runner.inspect_sources(folder, folder, "Silverstone")
                with self.assertRaisesRegex(ValueError, "pinned track table"):
                    runner.inspect_sources(folder, folder, "../Circle")

    def test_circle_capture_loads_circle_and_seals_circle_provenance(self):
        state = FakeState()
        capture(state, track="Circle")
        self.assertEqual(state.track_name, "Circle")
        args = SimpleNamespace(track="Circle", steps=4, seed=20261009, timeout=120)
        doc = runner.finalize(candidate("Circle"), args, {})
        self.assertEqual(doc["circuit"]["track_name"], "Circle")
        self.assertTrue(doc["circuit"]["distributable_fixture"])
        self.assertEqual(doc["provenance"]["producer"]["local_track_asset_sha256"], runner.TRACKS["Circle"]["assets"])
        relabelled = candidate("Circle"); relabelled["track_name"] = "Silverstone"
        for value in (candidate("Silverstone"), relabelled):
            with self.subTest(track=value["track_name"]), self.assertRaisesRegex(ValueError, "track differs"):
                runner.finalize(value, args, {})

    def test_plan_output_names_selected_track_without_simulator(self):
        result = subprocess.run([sys.executable, str(ROOT / "scripts/capture_f1tenth_reconstructed.py"), "--track", "Circle"],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["track"], "Circle_existing_pinned_assets")

    def test_git_head_and_dirty_tracked_source_reject_without_execution(self):
        for replies in (["wrong"], [runner.ADAPTER_COMMIT, " M src/f1tenth_mcp/env_state.py"]):
            with patch.object(runner.subprocess, "check_output", side_effect=replies), self.assertRaisesRegex(ValueError, "source HEAD"):
                runner.check_git("mock-not-accessed", runner.ADAPTER_COMMIT)

    def test_network_and_child_process_guard_is_local_and_tested_as_pure_callback(self):
        for event in ("socket.__new__", "socket.connect", "subprocess.Popen", "os.system"):
            with self.assertRaises(RuntimeError):
                runner.deny_python_network_and_children(event, ())
        runner.deny_python_network_and_children("open", ())

    def test_default_cli_is_plan_only_and_run_without_approved_hashes_fails_before_host_query(self):
        result = subprocess.run([sys.executable, str(ROOT / "scripts/capture_f1tenth_reconstructed.py")], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["mode"], "plan_only_no_simulator_import")
        with patch.object(runner, "windows_resources") as resource_query, patch.object(runner, "inspect_sources") as inspect:
            self.assertEqual(runner.main(["--run"]), 2)
            resource_query.assert_not_called(); inspect.assert_not_called()

    def test_direct_worker_is_rejected_without_supervisor_token(self):
        with self.assertRaisesRegex(ValueError, "supervisor"):
            runner.run_worker(SimpleNamespace(worker_token="unmatched"))


if __name__ == "__main__":
    unittest.main()
