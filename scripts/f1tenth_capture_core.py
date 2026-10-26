"""Newly reconstructed capture logic. Standard library only; no simulator imports."""
from dataclasses import dataclass
import hashlib
import json
import math
import time

MAX_BYTES = 15 * 1024 * 1024
MAX_POINTS = 10_000


@dataclass(frozen=True)
class CaptureConfig:
    seed: int = 20261009
    steps: int = 600
    timeout_s: float = 120.0
    timestep_s: float = 0.01
    lookahead_points: int = 14
    speed_mps: float = 2.5
    steering_gain: float = 0.65
    steering_limit_rad: float = 0.35

    def validate(self):
        if type(self.seed) is not int or not 0 <= self.seed < 2**32:
            raise ValueError("seed outside uint32 range")
        if type(self.steps) is not int or not 1 <= self.steps <= 600:
            raise ValueError("steps must be an integer in 1..600")
        if type(self.timeout_s) not in (int, float) or not math.isfinite(self.timeout_s) or not 0 < self.timeout_s <= 120:
            raise ValueError("timeout must be finite in (0,120]")
        if (self.timestep_s, self.lookahead_points, self.speed_mps, self.steering_gain, self.steering_limit_rad) != (0.01, 14, 2.5, 0.65, 0.35):
            raise ValueError("only reviewed timestep/controller settings are supported")


def finite(value, name):
    try:
        valid = type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        valid = False
    if not valid:
        raise ValueError(f"{name} must be finite numeric data")
    return float(value)


def encode(value):
    result = (json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + "\n").encode()
    if len(result) > MAX_BYTES:
        raise ValueError("capture exceeds 15 MiB")
    return result


def observation(value):
    if not isinstance(value, dict):
        raise ValueError("observation must be an object")
    return {key: finite(value.get(key), key) for key in ("pose_x", "pose_y", "pose_theta", "linear_vel_x", "delta")}


def read_raceline(state, check_deadline):
    points, expected_count, total = [], None, None
    while expected_count is None or len(points) < expected_count:
        check_deadline()
        start = len(points)
        page = state.raceline_slice(start=start, count=128)
        check_deadline()
        count = page.get("total_points")
        if type(count) is not int or not 2 <= count <= MAX_POINTS:
            raise ValueError("invalid raceline point count")
        if expected_count is None:
            expected_count = count
            total = finite(page.get("s_m_total"), "raceline length")
            if total <= 0:
                raise ValueError("raceline length must be positive")
        if count != expected_count or page.get("s_m_total") != total or page.get("s_m_source") != "geometry":
            raise ValueError("inconsistent raceline metadata")
        end = min(start + 128, expected_count)
        if page.get("range") != [start, end]:
            raise ValueError("invalid raceline page range")
        channels = [page.get(name) for name in ("x", "y", "s_m")]
        if any(not isinstance(channel, list) or len(channel) != end - start for channel in channels):
            raise ValueError("invalid raceline page dimensions")
        for x, y, s in zip(*channels):
            item = [finite(x, "raceline x"), finite(y, "raceline y"), finite(s, "raceline metric arc")]
            if item[2] < 0 or item[2] >= total or (points and item[2] <= points[-1][2]):
                raise ValueError("raceline metric arc must increase within total length")
            points.append(item)
    return points


def steering_for(obs, points, config):
    nearest = min(range(len(points)), key=lambda i: (points[i][0] - obs["pose_x"])**2 + (points[i][1] - obs["pose_y"])**2)
    target = points[(nearest + config.lookahead_points) % len(points)]
    dx, dy = target[0] - obs["pose_x"], target[1] - obs["pose_y"]
    if math.hypot(dx, dy) <= 1e-12:
        raise ValueError("lookahead target coincides with vehicle position")
    error = (math.atan2(dy, dx) - obs["pose_theta"] + math.pi) % (2 * math.pi) - math.pi
    return max(-config.steering_limit_rad, min(config.steering_limit_rad, config.steering_gain * error))


def collect(state, config, verify_runtime, cleanup, *, track_name, clock=time.monotonic):
    """Collect a candidate, never write or claim a sealed/live-qualified session.

    Caller owns cleanup of partially failed load_track as well. The same deadline
    covers load/reset/pages/steps/cleanup; a parent process bounds blocked calls.
    The caller pins track_name's asset bytes before this loads it.
    """
    config.validate()
    start = clock()
    previous_elapsed = 0

    def check_deadline():
        nonlocal previous_elapsed
        elapsed = clock() - start
        if not math.isfinite(elapsed) or elapsed < previous_elapsed or elapsed >= config.timeout_s:
            raise TimeoutError("capture deadline exceeded or clock invalid")
        previous_elapsed = elapsed

    try:
        check_deadline()
        state.load_track(track_name)
        check_deadline()
        runtime_receipt = verify_runtime(state)
        if finite(runtime_receipt.get("timestep_s"), "actual timestep") != config.timestep_s or runtime_receipt.get("render_mode") is not None:
            raise ValueError("actual runtime timing/rendering differs from reviewed settings")
        points = read_raceline(state, check_deadline)
        obs = observation(state.reset(seed=config.seed))
        check_deadline()
        samples, terminated, truncated = [], False, False
        for index in range(1, config.steps + 1):
            check_deadline()
            steering = finite(steering_for(obs, points, config), "controller steering")
            if abs(steering) > config.steering_limit_rad:
                raise ValueError("controller steering outside bound")
            result = state.step(steering, config.speed_mps)
            check_deadline()
            if type(result.step_index) is not int or result.step_index != index:
                raise ValueError("step index differs from expected sequence")
            if type(result.terminated) is not bool or type(result.truncated) is not bool:
                raise ValueError("terminal flags must be booleans")
            finite(result.reward, "reward")
            obs = observation(result.obs)
            analysis = state.analyze_deviation()
            check_deadline()
            if analysis.get("analysis_version") != "raceline-v2" or analysis.get("reference_kind") != "raceline" or analysis.get("reference_geometry") != "piecewise_linear_closed":
                raise ValueError("unsupported reference identity")
            analysis = {"analysis_version": "raceline-v2", "reference_kind": "raceline", **{
                key: finite(analysis.get(key), key) for key in ("lateral_dev_m", "heading_dev_rad", "s_frenet", "speed_optimal_mps", "curvature_now")}}
            samples.append({"step_index": index, "sim_time_s": index * config.timestep_s,
                "observation": {"pose_x_m": obs["pose_x"], "pose_y_m": obs["pose_y"], "pose_theta_rad": obs["pose_theta"],
                                "linear_vel_x_mps": obs["linear_vel_x"], "steering_delta_rad": obs["delta"]},
                "analysis": analysis,
                "simulation_action": {"steering_rad": steering, "target_speed_mps": config.speed_mps}})
            terminated, truncated = result.terminated, result.truncated
            if terminated or truncated:
                break
        deviations = [abs(sample["analysis"]["lateral_dev_m"]) for sample in samples]
        candidate = {"capture_config": dict(vars(config)), "track_name": track_name, "samples": samples, "outcome": {"sample_count": len(samples),
            "mean_abs_raceline_deviation_m": sum(deviations) / len(deviations),
            "max_abs_raceline_deviation_m": max(deviations), "terminated": terminated, "truncated": truncated,
            "stop_reason": "terminated" if terminated else "truncated" if truncated else "step_limit"},
            "geometry_sha256": hashlib.sha256(encode(points)).hexdigest(), "runtime_receipt": runtime_receipt,
            "controller": {"kind": "new_reconstructed_nearest_waypoint_heading_error_v1", "historical_runner_recovered": False,
                "lookahead_points": config.lookahead_points, "speed_command_mps": config.speed_mps,
                "steering_gain": config.steering_gain, "steering_limit_rad": config.steering_limit_rad}}
        encode(candidate)
    finally:
        cleanup(state)
    check_deadline()
    return candidate
