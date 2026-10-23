"""Offline denial diagnostics: no simulator imports, remote calls or networking."""
import ast
import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import capture_f1tenth_reconstructed as runner
import probe_f1tenth_imports as probe


class GuardDiagnosticTests(unittest.TestCase):
    def test_denial_predicate_is_exactly_the_original_policy(self):
        tree = ast.parse(Path(runner.__file__).read_text())
        function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "deny_python_network_and_children")
        predicate = next(node.test for node in function.body if isinstance(node, ast.If))
        expected = ast.parse('event.startswith("socket.") or event in ("subprocess.Popen", "os.system", "os.exec", "os.posix_spawn", "os.spawn")', mode="eval").body
        self.assertEqual(ast.dump(predicate), ast.dump(expected))

    def test_record_identifies_phase_and_callsite_without_arguments_paths_or_locals(self):
        secret = "SECRET_ARG_TOKEN_123 /private/person/path https://example.invalid/token"
        runner.mark_worker_phase("import_adapter")
        stream = io.StringIO()
        with contextlib.redirect_stderr(stream), self.assertRaises(RuntimeError):
            runner.deny_python_network_and_children("socket.connect", (secret, {"credential": secret}))
        text = stream.getvalue()
        self.assertNotIn(secret, text)
        self.assertNotIn("/private", text)
        record = json.loads(text)
        self.assertEqual(record["event"], "socket.connect")
        self.assertEqual(record["phase"], "import_adapter")
        self.assertFalse(record["arguments_recorded"])
        self.assertGreater(len(record["frames"]), 0)
        self.assertLessEqual(len(record["frames"]), 6)
        for frame in record["frames"]:
            self.assertEqual(set(frame), {"module", "function", "line"})
            self.assertIsInstance(frame["line"], int)
            self.assertNotIn("/", frame["module"])

    def test_unknown_event_suffix_is_redacted_and_logging_failure_still_denies(self):
        stream = io.StringIO()
        with contextlib.redirect_stderr(stream), self.assertRaises(RuntimeError):
            runner.deny_python_network_and_children("socket.private-secret-suffix", ("secret",))
        self.assertEqual(json.loads(stream.getvalue())["event"], "socket.other")
        with patch.object(runner.sys.stderr, "write", side_effect=OSError("mock logging failure")), self.assertRaises(RuntimeError):
            runner.deny_python_network_and_children("subprocess.Popen", ("secret-command",))
        with self.assertRaises(ValueError):
            runner.mark_worker_phase("secret invalid phase")

    def helper(self, operation, folder):
        script = ("import sys, socket, subprocess, platform; from pathlib import Path; "
                  f"sys.path.insert(0, {str(ROOT / 'scripts')!r}); import capture_f1tenth_reconstructed as r; "
                  "r.mark_worker_phase('offline_probe'); sys.addaudithook(r.deny_python_network_and_children);\n"
                  "try:\n " + operation + "\nexcept RuntimeError:\n print('blocked_as_before')\nelse:\n raise AssertionError('guard permitted operation')\n")
        return subprocess.run([sys.executable, "-c", script], cwd=folder, capture_output=True, text=True, timeout=5)

    def test_actual_socket_creation_and_subprocess_creation_stay_blocked(self):
        with tempfile.TemporaryDirectory() as folder:
            for operation, event in [("socket.socket()", "socket.__new__"),
                    ("subprocess.Popen([sys.executable,'-c',\"from pathlib import Path; Path('CHILD_RAN').write_text('bad')\"])", "subprocess.Popen"),
                    ("sys.audit('socket.connect', 'SECRET-ARG')", "socket.connect"),
                    ("sys.audit('socket.bind', 'SECRET-ARG')", "socket.bind")]:
                with self.subTest(event=event):
                    result = self.helper(operation, folder)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertIn("blocked_as_before", result.stdout)
                    self.assertEqual(json.loads(result.stderr.splitlines()[0])["event"], event)
                    self.assertNotIn("SECRET-ARG", result.stderr)
                    self.assertFalse((Path(folder) / "CHILD_RAN").exists())

    def test_windows_style_platform_fallback_reproduces_benign_hostname_denial_offline(self):
        operation = ("platform._uname_cache=None; "
                     "platform.os.uname=lambda: (_ for _ in ()).throw(AttributeError('simulate unavailable Windows os.uname')); "
                     "platform.machine()")
        with tempfile.TemporaryDirectory() as folder:
            result = self.helper(operation, folder)
        self.assertEqual(result.returncode, 0, result.stderr)
        record = json.loads(result.stderr.splitlines()[0])
        self.assertEqual(record["event"], "socket.gethostname")
        self.assertTrue(any(frame["module"] == "platform" and frame["function"] == "_node" for frame in record["frames"]))
        self.assertTrue(any(frame["module"] == "platform" and frame["function"] == "uname" for frame in record["frames"]))

    def isolated(self, body, folder):
        script = ("import sys, socket, subprocess, platform; "
                  f"sys.path.insert(0, {str(ROOT / 'scripts')!r}); import capture_f1tenth_reconstructed as r; "
                  "r.mark_worker_phase('offline_probe')\n" + body)
        return subprocess.run([sys.executable, "-c", script], cwd=folder, capture_output=True, text=True, timeout=5)

    def test_primed_platform_metadata_passes_windows_style_lookup_while_guard_still_denies(self):
        body = ("platform._uname_cache = None\n"
                "platform.os.uname = lambda: (_ for _ in ()).throw(AttributeError('simulate unavailable Windows os.uname'))\n"
                "primed = r.prime_platform_metadata()\n"
                "sys.addaudithook(r.deny_python_network_and_children)\n"
                "assert platform.machine() == primed.machine and platform.node() == primed.node\n"
                "print('metadata_ok')\n"
                "for operation in (socket.gethostname, socket.socket, lambda: subprocess.Popen([sys.executable, '-c', 'pass'])):\n"
                " try:\n  operation()\n except RuntimeError:\n  print('blocked_as_before')\n"
                " else:\n  raise AssertionError('guard permitted operation')\n")
        with tempfile.TemporaryDirectory() as folder:
            result = self.isolated(body, folder)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.split(), ["metadata_ok"] + ["blocked_as_before"] * 3)
        events = [json.loads(line)["event"] for line in result.stderr.splitlines()]
        self.assertEqual(events, ["socket.gethostname", "socket.__new__", "subprocess.Popen"])

    def test_workers_prime_platform_metadata_before_installing_guard(self):
        for path, name in [(runner.__file__, "run_worker"), (probe.__file__, "main")]:
            tree = ast.parse(Path(path).read_text())
            function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == name)
            calls = {ast.unparse(node.func): node.lineno for node in ast.walk(function) if isinstance(node, ast.Call)}
            with self.subTest(worker=name):
                primed = calls.get("runner.prime_platform_metadata", calls.get("prime_platform_metadata"))
                self.assertIsNotNone(primed)
                self.assertLess(primed, calls["sys.addaudithook"])


class ImportProbeTests(unittest.TestCase):
    def test_mocked_supervised_probe_is_twenty_seconds_and_writes_no_session(self):
        expected = {"status": "deferred_import_complete", "capture_performed": False, "steps": 0,
                    "envstate_or_gym_make_called_by_probe": False, "guard_policy": "unchanged"}
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "diagnostic"
            args = ["--probe", "--output", str(output), "--expected-probe-sha256", runner.digest(probe.__file__),
                    "--expected-runner-sha256", runner.digest(runner.__file__),
                    "--expected-core-sha256", runner.digest(ROOT / "scripts/f1tenth_capture_core.py")]
            with patch.object(runner, "windows_resources"), patch.object(runner, "inspect_sources"), \
                    patch.object(runner, "supervise", return_value=expected) as supervised, contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(probe.main(args), 0)
                self.assertEqual(supervised.call_args.args[2], 20)
            self.assertEqual(json.loads((output / "diagnostic.json").read_text()), expected)
            self.assertFalse((output / "session.json").exists())

    def test_import_probe_never_constructs_or_steps_simulator(self):
        calls = []
        def forbidden(*args, **kwargs):
            raise AssertionError("probe must never construct or step")
        def importer(name):
            calls.append(name)
            if name == "f1tenth_mcp.env_state":
                return SimpleNamespace(__file__="/mock-adapter/src/f1tenth_mcp/env_state.py", EnvState=forbidden)
            if name == "f1tenth_gym.envs.track":
                return SimpleNamespace(__file__="/mock-gym/f1tenth_gym/envs/track/__init__.py", Track=SimpleNamespace(from_track_name=forbidden))
            return SimpleNamespace(__file__="/mock-gym/f1tenth_gym/__init__.py", make=forbidden)
        original_path = list(sys.path)
        try:
            result = probe.import_probe("/mock-adapter", "/mock-gym", importer=importer)
        finally:
            sys.path[:] = original_path
        self.assertEqual(calls, ["f1tenth_mcp.env_state", "f1tenth_gym", "f1tenth_gym.envs.track"])
        self.assertEqual(result["steps"], 0)
        self.assertFalse(result["envstate_or_gym_make_called_by_probe"])

    def test_deferred_import_failure_stops_and_preserves_phase(self):
        calls = []
        def importer(name):
            calls.append(name)
            if name.endswith(".track"):
                raise RuntimeError("simulated import denial")
            path = "/mock-adapter/src/f1tenth_mcp/env_state.py" if name.startswith("f1tenth_mcp") else "/mock-gym/f1tenth_gym/__init__.py"
            return SimpleNamespace(__file__=path)
        original_path = list(sys.path)
        try:
            with self.assertRaisesRegex(RuntimeError, "simulated import denial"):
                probe.import_probe("/mock-adapter", "/mock-gym", importer=importer)
        finally:
            sys.path[:] = original_path
        self.assertEqual(runner.WORKER_PHASE, "import_track")
        self.assertEqual(len(calls), 3)

    def test_wrong_track_origin_is_rejected(self):
        def importer(name):
            paths = {"f1tenth_mcp.env_state": "/mock-adapter/src/f1tenth_mcp/env_state.py",
                     "f1tenth_gym": "/mock-gym/f1tenth_gym/__init__.py",
                     "f1tenth_gym.envs.track": "/other/f1tenth_gym/envs/track/__init__.py"}
            return SimpleNamespace(__file__=paths[name])
        original_path = list(sys.path)
        try:
            with self.assertRaisesRegex(ValueError, "track import mismatch"):
                probe.import_probe("/mock-adapter", "/mock-gym", importer=importer)
        finally:
            sys.path[:] = original_path

    def test_default_probe_and_wrong_hashes_do_not_import_dependencies_or_query_host(self):
        stream = io.StringIO()
        with patch.object(probe, "import_probe") as imports, patch.object(runner, "windows_resources") as resources, contextlib.redirect_stdout(stream):
            self.assertEqual(probe.main([]), 0)
            self.assertEqual(json.loads(stream.getvalue())["mode"], "plan_only")
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(probe.main(["--probe"]), 2)
            imports.assert_not_called()
            resources.assert_not_called()


if __name__ == "__main__":
    unittest.main()
