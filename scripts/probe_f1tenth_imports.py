"""Default plan-only; future supervised dependency-import diagnostic, no capture.

Never calls EnvState(), gym.make(), load/reset/step or a server. Import initializers
can have side effects; the unchanged socket/process guard remains installed.
"""
import argparse
import importlib
import importlib.metadata
import json
import os
from pathlib import Path
import secrets
import sys
import tempfile

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import capture_f1tenth_reconstructed as runner


def import_probe(source_root, gym_root, importer=importlib.import_module):
    source_root, gym_root = Path(source_root).resolve(), Path(gym_root).resolve()
    sys.path.insert(0, str(gym_root))
    sys.path.insert(0, str(source_root / "src"))
    runner.mark_worker_phase("import_adapter")
    adapter = importer("f1tenth_mcp.env_state")
    if Path(adapter.__file__).resolve() != (source_root / "src/f1tenth_mcp/env_state.py").resolve():
        raise ValueError("adapter import mismatch")
    runner.mark_worker_phase("import_gym")
    gym = importer("f1tenth_gym")
    if not Path(gym.__file__).resolve().is_relative_to(gym_root):
        raise ValueError("gym import mismatch")
    return {"status": "imports_only_complete", "capture_performed": False, "steps": 0,
            "envstate_or_gym_make_called_by_probe": False, "guard_policy": "unchanged"}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--probe", action="store_true")
    parser.add_argument("--source-root", default=r"C:\Users\matth\Documents\Codex\2026-10-08\task\worktrees\f1tenth-raceline-reference")
    parser.add_argument("--gym-root", default=r"C:\Users\matth\projects\f1tenth_gym")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--expected-probe-sha256")
    parser.add_argument("--expected-runner-sha256")
    parser.add_argument("--expected-core-sha256")
    parser.add_argument("--worker-token", help=argparse.SUPPRESS)
    parser.add_argument("--staging", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if not args.probe:
        print(json.dumps({"mode": "plan_only", "future_action": "20_second_imports_only_probe", "capture": False}))
        return 0
    try:
        if (runner.digest(__file__) != args.expected_probe_sha256
                or runner.digest(runner.__file__) != args.expected_runner_sha256
                or runner.digest(HERE / "f1tenth_capture_core.py") != args.expected_core_sha256):
            raise ValueError("diagnostic source pin mismatch")
        if args.worker_token:
            if args.worker_token != os.environ.get("BLURR_F1_WORKER_TOKEN") or not (3, 11) <= sys.version_info[:2] < (3, 14):
                raise ValueError("unexpected worker identity/runtime")
            if os.environ.get("NUMBA_CACHE_DIR") != str(Path(args.staging) / "numba-cache"):
                raise ValueError("unexpected cache path")
            runner.mark_worker_phase("source_preflight")
            runner.inspect_sources(args.source_root, args.gym_root)
            sys.addaudithook(runner.deny_python_network_and_children)
            runner.mark_worker_phase("metadata")
            versions = {}
            for name in ("numpy", "gymnasium", "numba", "pygame", "f1tenth_gym"):
                try:
                    versions[name] = importlib.metadata.version(name)[:80]
                except importlib.metadata.PackageNotFoundError:
                    versions[name] = "unavailable"
            print(json.dumps({"schema_version": "blurr.worker-import-probe.v1", "phase": "before_imports", "package_versions": versions}), flush=True)
            result = import_probe(args.source_root, args.gym_root)
            with (Path(args.staging) / "candidate.json").open("xb") as stream:
                stream.write(runner.encode(result))
            return 0
        if args.output is None or args.output.exists() or not args.output.parent.is_dir():
            raise ValueError("select a fresh diagnostic output under an approved existing parent")
        runner.windows_resources()
        runner.inspect_sources(args.source_root, args.gym_root)
        with tempfile.TemporaryDirectory(prefix="blurr-f1-import-probe-", dir=args.output.parent) as staging:
            token = secrets.token_hex(16)
            environment = dict(os.environ, **runner.CHILD_ENVIRONMENT, BLURR_F1_WORKER_TOKEN=token,
                               NUMBA_CACHE_DIR=str(Path(staging) / "numba-cache"), PYTHONPATH=str(Path(args.source_root).resolve() / "src"))
            command = [sys.executable, "-s", str(Path(__file__).resolve()), "--probe", "--source-root", args.source_root,
                       "--gym-root", args.gym_root, "--expected-probe-sha256", args.expected_probe_sha256,
                       "--expected-runner-sha256", args.expected_runner_sha256, "--expected-core-sha256", args.expected_core_sha256,
                       "--worker-token", token, "--staging", staging]
            try:
                result = runner.supervise(command, staging, 20, environment)
                if result != {"status": "imports_only_complete", "capture_performed": False, "steps": 0,
                              "envstate_or_gym_make_called_by_probe": False, "guard_policy": "unchanged"}:
                    raise ValueError("unexpected diagnostic result")
                args.output.mkdir()
                with (args.output / "diagnostic.json").open("xb") as stream:
                    stream.write(runner.encode(result))
                for name in ("stdout.log", "stderr.log"):
                    source = Path(staging) / name
                    if source.is_file():
                        with source.open("rb") as stream, (args.output / name).open("xb") as target:
                            target.write(stream.read(65536))
                print(json.dumps(result))
            except BaseException as error:
                runner.retain_failure(args.output, staging, error)
                raise
        return 0
    except (ValueError, RuntimeError, OSError, KeyError, TypeError) as error:
        print(f"import probe failed: {type(error).__name__}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
