"""New reconstructed F1TENTH capture runner; defaults to a non-executing plan.

Real simulation is unqualified and requires a separately authorized --run.
No server/MCP module is imported. The supervisor alone publishes completed output.
"""
import argparse
import ctypes
from datetime import datetime, timezone
import hashlib
import importlib
import importlib.metadata
import json
import os
from pathlib import Path
import platform
import re
import secrets
import subprocess
import sys
import tempfile
import time

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from f1tenth_capture_core import CaptureConfig, MAX_BYTES, collect, encode, finite

ADAPTER_COMMIT = "b3525a0ae3abb69e84a2e937a1cd2f9cc8b6b33e"
GYM_COMMIT = "5a301bd0ae1ceaf7dec653e7549c8d099db58a6b"
MODULE_SHA256 = "bc595f23e1150205abb4c72fbdc6b347533fe5832011e80920e2a9600010177b"
ASSET_HASHES = {
    "Silverstone_map.yaml": "0f97cde428cbfd762c571a2fa3479980be9c5a96c198472d8561f124c896108a",
    "Silverstone_map.png": "074bfe8080ab70b18068c77ab19179f8c289305b1964888ad72a503d4c7baf4a",
    "Silverstone_centerline.csv": "4abf0f78b3264bd08e989370cf006343abd7c70862245ab4f4ea2e8ce98444ab",
    "Silverstone_raceline.csv": "cc2925c22468c3cb57b225dc88eab933589c037805af4de6823fff340a64fd97",
}
CHILD_ENVIRONMENT = {"PYTHONSAFEPATH": "1", "PYTHONDONTWRITEBYTECODE": "1", "PYGLET_HEADLESS": "true",
                     "SDL_VIDEODRIVER": "dummy", "SDL_AUDIODRIVER": "dummy", "PYGAME_HIDE_SUPPORT_PROMPT": "1",
                     "OMP_NUM_THREADS": "1", "OPENBLAS_NUM_THREADS": "1", "MKL_NUM_THREADS": "1", "NUMBA_NUM_THREADS": "1"}
WORKER_PHASE = "not_started"
WORKER_PHASES = frozenset(("not_started", "source_preflight", "import_adapter", "import_gym", "construct_adapter",
                          "capture_loop", "cleanup", "metadata", "candidate_write", "offline_probe"))


def mark_worker_phase(phase):
    global WORKER_PHASE
    if phase not in WORKER_PHASES:
        raise ValueError("unknown worker diagnostic phase")
    WORKER_PHASE = phase


def audit_denial_record(event):
    """Bounded module/function/line metadata only: no args, paths or locals."""
    def label(value):
        return re.sub(r"[^A-Za-z0-9_.<>]", "_", value[:80]) if isinstance(value, str) else "unknown"

    frames = []
    frame = sys._getframe(2)
    try:
        for _ in range(6):
            if frame is None:
                break
            frames.append({"module": label(frame.f_globals.get("__name__")),
                           "function": label(frame.f_code.co_name), "line": frame.f_lineno})
            frame = frame.f_back
    finally:
        del frame
    known_events = {"socket.__new__", "socket.bind", "socket.connect", "socket.gethostname", "socket.sethostname",
                    "socket.gethostbyname", "socket.gethostbyaddr", "socket.getaddrinfo", "socket.getnameinfo",
                    "socket.sendto", "socket.sendmsg", "subprocess.Popen", "os.system", "os.exec", "os.posix_spawn", "os.spawn"}
    return {"schema_version": "blurr.worker-audit-denial.v1", "event": event if event in known_events else "socket.other",
            "phase": WORKER_PHASE, "frames": frames, "arguments_recorded": False}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def check_git(root, expected):
    def git(*arguments):
        return subprocess.check_output(["git", "-c", "core.fsmonitor=false", "-C", str(root), *arguments],
                                       stderr=subprocess.DEVNULL, timeout=10, text=True).strip()
    if git("rev-parse", "HEAD") != expected or git("status", "--porcelain", "--untracked-files=no"):
        raise ValueError("source HEAD or tracked state differs from pinned review")


def inspect_sources(source_root, gym_root):
    source_root, gym_root = Path(source_root).resolve(), Path(gym_root).resolve()
    check_git(source_root, ADAPTER_COMMIT)
    check_git(gym_root, GYM_COMMIT)
    module = source_root / "src/f1tenth_mcp/env_state.py"
    if not module.resolve().is_relative_to(source_root) or digest(module) != MODULE_SHA256:
        raise ValueError("corrected adapter module digest/path mismatch")
    for name, expected in ASSET_HASHES.items():
        asset = gym_root / "maps/Silverstone" / name
        if not asset.resolve().is_relative_to(gym_root) or digest(asset) != expected:
            raise ValueError(f"local Silverstone asset differs from reviewed bytes: {name}")
    return {"adapter_root": str(source_root), "adapter_commit": ADAPTER_COMMIT, "adapter_module_sha256": MODULE_SHA256,
            "gym_root": str(gym_root), "gym_commit": GYM_COMMIT, "local_track_asset_sha256": ASSET_HASHES}


def windows_resources():
    """Read host CPU/memory only; no service, device or persistent changes."""
    if os.name != "nt" or platform.node().upper() != "ALIENPC":
        raise ValueError("real runner is restricted to the reviewed Windows ALIENPC host")

    class Memory(ctypes.Structure):
        _fields_ = [("length", ctypes.c_uint32), ("load", ctypes.c_uint32)] + [(name, ctypes.c_uint64) for name in
                    ("physical", "available", "pagefile", "page_available", "virtual", "virtual_available", "extended")]

    def cpu():
        values = [ctypes.c_uint64() for _ in range(3)]
        if not ctypes.windll.kernel32.GetSystemTimes(*(ctypes.byref(value) for value in values)):
            raise OSError("CPU resource query failed")
        return [value.value for value in values]

    before = cpu()
    time.sleep(0.1)
    after = cpu()
    total = (after[1] - before[1]) + (after[2] - before[2])
    if total <= 0:
        raise ValueError("CPU sample is unavailable")
    load = 100 * (1 - (after[0] - before[0]) / total)
    memory = Memory()
    memory.length = ctypes.sizeof(memory)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)):
        raise OSError("memory resource query failed")
    available = memory.available / 1024**3
    if not 0 <= load <= 25 or available < 8:
        raise ValueError("resource gate: CPU must be <=25% and available memory >=8 GiB")
    return {"cpu_sample_percent": load, "available_memory_gib": available, "sample_interval_s": 0.1}


def deny_python_network_and_children(event, arguments):
    # Process-local guard, not a claim of native-code sandboxing. Pinned source
    # review remains necessary. Installed imports must not download or spawn.
    if event.startswith("socket.") or event in ("subprocess.Popen", "os.system", "os.exec", "os.posix_spawn", "os.spawn"):
        try:
            sys.stderr.write(json.dumps(audit_denial_record(event), sort_keys=True) + "\n")
            sys.stderr.flush()
        except Exception:
            pass  # Diagnostics must never permit an otherwise denied operation.
        raise RuntimeError("network/process creation forbidden in capture worker")


def runtime_receipt(state):
    raw = state._env.unwrapped  # Pinned adapter exposes no public timing method.
    if (raw.num_agents != 1 or raw.render_mode is not None or tuple(raw.action_type.type) != ("steering_angle", "speed")
            or raw.observation_config["type"] != "kinematic_state" or raw.config["model"] != "st" or raw.config["integrator"] != "rk4"):
        raise ValueError("unexpected agent/render/action configuration")
    return {"timestep_s": finite(raw.timestep, "runtime timestep"), "render_mode": raw.render_mode,
            "num_agents": 1, "action_type": list(raw.action_type.type),
            "observation_type": raw.observation_config["type"], "model": raw.config["model"],
            "integrator": raw.config["integrator"]}


def cleanup_runtime(state):
    mark_worker_phase("cleanup")
    # Surface the raw close failure that EnvState.close would otherwise swallow.
    raw = state._env
    try:
        if raw is not None:
            raw.close()
    finally:
        state.close()


def run_worker(args):
    if not args.worker_token or args.worker_token != os.environ.get("BLURR_F1_WORKER_TOKEN"):
        raise ValueError("worker must be launched by its supervisor")
    if not (3, 11) <= sys.version_info[:2] < (3, 14):
        raise ValueError("real adapter requires Python >=3.11,<3.14")
    if os.environ.get("NUMBA_CACHE_DIR") != str(Path(args.staging) / "numba-cache"):
        raise ValueError("Numba cache must remain in the owned worker staging directory")
    mark_worker_phase("source_preflight")
    source = inspect_sources(args.source_root, args.gym_root)
    sys.addaudithook(deny_python_network_and_children)
    expected_module = (Path(args.source_root) / "src/f1tenth_mcp/env_state.py").resolve()
    sys.path.insert(0, str(Path(args.gym_root).resolve()))
    sys.path.insert(0, str(Path(args.source_root).resolve() / "src"))
    mark_worker_phase("import_adapter")
    adapter = importlib.import_module("f1tenth_mcp.env_state")
    if Path(adapter.__file__).resolve() != expected_module:
        raise ValueError("actual adapter import differs from pinned module")
    mark_worker_phase("import_gym")
    gym_package = importlib.import_module("f1tenth_gym")
    if not Path(gym_package.__file__).resolve().is_relative_to(Path(args.gym_root).resolve()):
        raise ValueError("actual gym import differs from pinned checkout")
    started = datetime.now(timezone.utc).isoformat()
    mark_worker_phase("construct_adapter")
    state = adapter.EnvState()
    mark_worker_phase("capture_loop")
    candidate = collect(state, CaptureConfig(seed=args.seed, steps=args.steps, timeout_s=args.timeout),
                        runtime_receipt, cleanup_runtime)
    mark_worker_phase("metadata")
    candidate.update({"producer": source, "started_at_utc": started,
                      "python": {"executable": sys.executable, "version": platform.python_version(),
                                 "packages": {name: importlib.metadata.version(name) for name in ("f1tenth_gym", "gymnasium", "numpy", "numba")}},
                      "child_environment": {name: os.environ.get(name) for name in CHILD_ENVIRONMENT},
                      "adapter_module_path": str(expected_module), "gym_module_path": str(Path(gym_package.__file__).resolve())})
    mark_worker_phase("candidate_write")
    target = Path(args.staging) / "candidate.json"
    with target.open("xb") as stream:
        stream.write(encode(candidate))


def supervise(command, staging, timeout, environment):
    """Bound one owned worker, including blocked import/load/step/close calls."""
    staging = Path(staging)
    logs = [staging / "stdout.log", staging / "stderr.log"]
    started = time.monotonic()
    with logs[0].open("xb") as stdout, logs[1].open("xb") as stderr:
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, env=environment)
        try:
            while process.poll() is None:
                if time.monotonic() - started >= timeout:
                    raise TimeoutError("supervisor hard deadline exceeded")
                if any(path.stat().st_size > 65536 for path in logs):
                    raise ValueError("worker log limit exceeded")
                time.sleep(0.02)
            if process.returncode != 0:
                raise ValueError("worker failed; candidate will not be published")
            if time.monotonic() - started >= timeout or any(path.stat().st_size > 65536 for path in logs):
                raise TimeoutError("worker exceeded time/log bounds at exit")
        finally:
            if process.poll() is None:
                process.kill()
            process.wait(timeout=5)
    candidate = staging / "candidate.json"
    if not candidate.is_file() or candidate.stat().st_size > MAX_BYTES:
        raise ValueError("worker candidate absent or oversized")
    return json.loads(candidate.read_text(encoding="utf-8"))


def finalize(candidate, args, resources):
    if candidate["capture_config"] != dict(vars(CaptureConfig(seed=args.seed, steps=args.steps, timeout_s=args.timeout))):
        raise ValueError("candidate configuration differs from requested run")
    expected_controller = {"kind": "new_reconstructed_nearest_waypoint_heading_error_v1", "historical_runner_recovered": False,
                           "lookahead_points": 14, "speed_command_mps": 2.5, "steering_gain": .65, "steering_limit_rad": .35}
    if candidate["controller"] != expected_controller or candidate["child_environment"] != CHILD_ENVIRONMENT:
        raise ValueError("candidate controller/environment differs from reviewed reconstruction")
    stamp = datetime.fromisoformat(candidate["started_at_utc"])
    if stamp.utcoffset() is None:
        raise ValueError("candidate capture-start timestamp needs a timezone")
    samples = candidate["samples"]
    if not isinstance(samples, list) or not 1 <= len(samples) <= args.steps or candidate["outcome"]["sample_count"] != len(samples):
        raise ValueError("candidate sample count outside requested bounds")
    if candidate["producer"]["adapter_commit"] != ADAPTER_COMMIT or candidate["producer"]["gym_commit"] != GYM_COMMIT:
        raise ValueError("candidate source pin mismatch")
    if (candidate["producer"]["adapter_module_sha256"] != MODULE_SHA256 or candidate["producer"]["local_track_asset_sha256"] != ASSET_HASHES
            or candidate["runtime_receipt"]["timestep_s"] != 0.01 or candidate["runtime_receipt"]["render_mode"] is not None):
        raise ValueError("candidate producer/runtime differs from pinned settings")
    if not re.fullmatch(r"[a-f0-9]{64}", candidate["geometry_sha256"]):
        raise ValueError("invalid reference geometry digest")
    if type(candidate["outcome"]["terminated"]) is not bool or type(candidate["outcome"]["truncated"]) is not bool:
        raise ValueError("invalid candidate terminal flags")
    terminated, truncated = candidate["outcome"]["terminated"], candidate["outcome"]["truncated"]
    if len(samples) != args.steps and not (terminated or truncated):
        raise ValueError("partial candidate lacks a terminal reason")
    if candidate["outcome"]["stop_reason"] != ("terminated" if terminated else "truncated" if truncated else "step_limit"):
        raise ValueError("candidate stop reason mismatch")
    deviations = []
    for index, sample in enumerate(samples, 1):
        if type(sample["step_index"]) is not int or sample["step_index"] != index or sample["sim_time_s"] != index * 0.01:
            raise ValueError("candidate sequence/timing mismatch")
        for name in ("pose_x_m", "pose_y_m", "pose_theta_rad", "linear_vel_x_mps", "steering_delta_rad"):
            finite(sample["observation"][name], name)
        analysis = sample["analysis"]
        if analysis["analysis_version"] != "raceline-v2" or analysis["reference_kind"] != "raceline":
            raise ValueError("candidate reference mismatch")
        for name in ("lateral_dev_m", "heading_dev_rad", "s_frenet", "speed_optimal_mps", "curvature_now"):
            finite(analysis[name], name)
        deviations.append(abs(analysis["lateral_dev_m"]))
        action = sample["simulation_action"]
        if abs(finite(action["steering_rad"], "simulation steering")) > 0.35 or finite(action["target_speed_mps"], "simulation speed") != 2.5:
            raise ValueError("candidate action outside reviewed bounds")
    if (candidate["outcome"]["mean_abs_raceline_deviation_m"] != sum(deviations) / len(deviations)
            or candidate["outcome"]["max_abs_raceline_deviation_m"] != max(deviations)):
        raise ValueError("candidate summary mismatch")
    return {"schema_version": "blurr.telemetry-session.v1", "source_kind": "f1tenth", "status": "sealed",
            "captured_at_utc": candidate["started_at_utc"],
            "circuit": {"name": "Silverstone · reconstructed runner (qualification pending)", "track_name": "Silverstone",
                        "provenance": "installed GPL-v3 track assets; redistribution not cleared",
                        "distributable_fixture": False, "raceline_geometry_sha256": candidate["geometry_sha256"]},
            "runtime": {"simulator": "f1tenth_gym", "seed": args.seed, "timestep_s": 0.01,
                        "analysis_version": "raceline-v2", "reference_kind": "raceline",
                        "sim_time_origin": "counted_adapter_steps_since_reset_return"},
            "controller": candidate["controller"], "samples": samples, "outcome": candidate["outcome"],
            "provenance": {"runner_kind": "newly_reconstructed_not_historical_runner", "real_simulator_qualification": "pending",
                           "human_driving": False, "physical_hardware": False, "live_stream_verified": False,
                           "producer": candidate["producer"], "python": candidate["python"],
                           "actual_adapter_module": candidate["adapter_module_path"], "actual_gym_module": candidate["gym_module_path"],
                           "runtime_receipt": candidate["runtime_receipt"], "resource_preflight": resources,
                           "child_environment": candidate["child_environment"], "numba_cache": "owned_worker_temporary_directory",
                           "runner_sha256": digest(__file__), "core_sha256": digest(SCRIPT_DIR / "f1tenth_capture_core.py"),
                           "cleanup": "raw_and_adapter_close_returned_then_owned_worker_exited",
                           "isolation": "pinned Python simulator source; process-local audit guard; not native sandbox proof"}}


def publish(document, output):
    """Exclusive bundle publication only after worker exit and validation."""
    output = Path(output)
    payload = encode(document)
    output.mkdir()  # Caller-selected fresh directory; never replace anything.
    created = []
    try:
        session = output / "session.json"
        with session.open("xb") as stream:
            created.append(session)
            stream.write(payload)
        receipt = {"sha256": hashlib.sha256(payload).hexdigest(), "bytes": len(payload), "sample_count": len(document["samples"]),
                   "qualification": "new_reconstructed_runner_real_simulator_review_pending"}
        receipt_path = output / "receipt.json"
        with receipt_path.open("xb") as stream:
            created.append(receipt_path)
            stream.write(encode(receipt))
        return receipt
    except BaseException:
        for path in reversed(created):
            path.unlink(missing_ok=True)
        output.rmdir()
        raise


def retain_failure(output, staging, error):
    """Keep bounded diagnostics under a fresh sibling; never publish a session."""
    target = Path(output).with_name(Path(output).name + ".failed")
    if target.exists():
        return  # Preserve previous failure evidence too.
    target.mkdir()
    with (target / "failure.json").open("xb") as stream:
        stream.write(encode({"status": "failed_unsealed", "error_type": type(error).__name__,
                             "real_simulator_qualification": "pending", "no_success_receipt": True}))
    for name in ("stdout.log", "stderr.log"):
        source = Path(staging) / name
        if source.is_file():
            with source.open("rb") as stream, (target / name).open("xb") as destination:
                destination.write(stream.read(65536))


def compare_bundles(paths):
    documents, hashes = [], []
    for folder in paths:
        session, receipt_path = Path(folder) / "session.json", Path(folder) / "receipt.json"
        if session.stat().st_size > MAX_BYTES or receipt_path.stat().st_size > 65536:
            raise ValueError("comparison input outside byte bound")
        raw = session.read_bytes()
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        raw_hash = hashlib.sha256(raw).hexdigest()
        if receipt["sha256"] != raw_hash or receipt["bytes"] != len(raw):
            raise ValueError("comparison receipt/hash mismatch")
        doc = json.loads(raw)
        if (doc["schema_version"] != "blurr.telemetry-session.v1" or doc["source_kind"] != "f1tenth" or doc["status"] != "sealed"
                or len(doc["samples"]) != 600 or doc["outcome"]["sample_count"] != 600 or receipt["sample_count"] != 600
                or doc["outcome"]["terminated"] is not False or doc["outcome"]["truncated"] is not False
                or doc["provenance"]["real_simulator_qualification"] != "pending"):
            raise ValueError("comparison requires two full, nonterminal 600-step reconstructed captures")
        documents.append(doc)
        hashes.append(raw_hash)
    normalized = []
    for doc in documents:
        stable = json.loads(json.dumps(doc))
        del stable["captured_at_utc"]
        del stable["provenance"]["resource_preflight"]
        normalized.append(stable)
    if normalized[0] != normalized[1]:
        raise ValueError("capture samples/configuration/provenance are not identical")
    return {"comparison": "identical_stable_fields", "samples_per_run": 600, "raw_sha256": hashes,
            "real_simulator_qualification": "pending", "ignored_fields": ["captured_at_utc", "provenance.resource_preflight"]}


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--run", action="store_true", help="Requires separate exact scoped real-simulation authorization")
    result.add_argument("--compare", type=Path, nargs=2, metavar=("RUN_A", "RUN_B"), help="Read-only receipt/sample comparison; no simulator")
    result.add_argument("--source-root", default=r"C:\Users\matth\Documents\Codex\2026-10-08\task\worktrees\f1tenth-raceline-reference")
    result.add_argument("--gym-root", default=r"C:\Users\matth\projects\f1tenth_gym")
    result.add_argument("--seed", type=int, default=20261009)
    result.add_argument("--steps", type=int, default=600)
    result.add_argument("--timeout", type=float, default=120)
    result.add_argument("--output", type=Path)
    result.add_argument("--expected-runner-sha256")
    result.add_argument("--expected-core-sha256")
    result.add_argument("--worker-token", help=argparse.SUPPRESS)
    result.add_argument("--staging", help=argparse.SUPPRESS)
    return result


def main(argv=None):
    args = parser().parse_args(argv)
    if args.compare:
        if args.run:
            print("capture rejected: --compare and --run are exclusive", file=sys.stderr)
            return 2
        try:
            print(json.dumps(compare_bundles(args.compare)))
            return 0
        except (ValueError, OSError, KeyError, TypeError) as error:
            print(f"comparison rejected: {error}", file=sys.stderr)
            return 2
    if not args.run:
        print(json.dumps({"mode": "plan_only_no_simulator_import", "runner": "newly_reconstructed", "real_qualification": "pending",
                          "track": "Silverstone_existing_pinned_assets", "adapter_commit": ADAPTER_COMMIT, "gym_commit": GYM_COMMIT}))
        return 0
    try:
        CaptureConfig(seed=args.seed, steps=args.steps, timeout_s=args.timeout).validate()
        if digest(__file__) != args.expected_runner_sha256 or digest(SCRIPT_DIR / "f1tenth_capture_core.py") != args.expected_core_sha256:
            raise ValueError("runner/core digests differ from approved invocation")
        if args.worker_token:
            run_worker(args)
            return 0
        if args.output is None or args.output.exists() or not args.output.parent.is_dir():
            raise ValueError("select a nonexistent output directory under an existing approved parent")
        resources = windows_resources()
        inspect_sources(args.source_root, args.gym_root)
        with tempfile.TemporaryDirectory(prefix="blurr-f1-worker-", dir=args.output.parent) as staging:
            token = secrets.token_hex(16)
            environment = dict(os.environ, **CHILD_ENVIRONMENT, PYTHONPATH=str(Path(args.source_root).resolve() / "src"),
                               NUMBA_CACHE_DIR=str(Path(staging) / "numba-cache"), BLURR_F1_WORKER_TOKEN=token)
            command = [sys.executable, "-s", str(Path(__file__).resolve()), "--run", "--source-root", args.source_root, "--gym-root", args.gym_root,
                       "--seed", str(args.seed), "--steps", str(args.steps), "--timeout", str(args.timeout),
                       "--expected-runner-sha256", args.expected_runner_sha256, "--expected-core-sha256", args.expected_core_sha256,
                       "--worker-token", token, "--staging", staging]
            try:
                candidate = supervise(command, staging, args.timeout, environment)
                receipt = publish(finalize(candidate, args, resources), args.output)
            except BaseException as error:
                retain_failure(args.output, staging, error)
                raise
            print(json.dumps(receipt))
        return 0
    except (ValueError, OSError, TimeoutError, subprocess.SubprocessError, KeyError, TypeError, RuntimeError) as error:
        print(f"capture rejected: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
