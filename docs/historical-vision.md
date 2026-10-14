# Preserved historical vision and hardware notes

This is archived context from the prior README, not validated current functionality, hardware status, or authority to operate devices. Current runnable instructions are in the root README.

# Project Blurr

Real-time AI performance driving coach. Reads road and environment conditions ahead of the car and coaches the driver via voice feedback. Not autonomous, not self-driving. Blurr enhances the driver.

> "Automate the monotonous so we can focus on the creative." As L5 autonomy takes over commuting, time opens up for what matters: performance driving, motorsports, the thrill of a machine at the edge. Blurr exists to make that experience more precise, more connected, and more joyful.

## Current Local Simulator Checkpoint

The runnable web application in this commit is a local-only F1TENTH evidence viewer. It does not implement physical-vehicle coaching, real-time voice, video telemetry extraction, or a live cloud-provider call.

```powershell
npm ci
npm test
npm run dev -- --host 127.0.0.1
```

Open the loopback URL printed by Vite and import a sealed `blurr.telemetry-session.v1` JSON capture. The app validates a 15 MiB / 50,000-sample bound, strict monotonic sequence and simulator/reception time, finite measurements, source/reference identity, and F1TENTH summary consistency. AutoDRIVE values without declared physical units stay labelled as source-unit-unspecified, and unsupported speed/reference/braking/collision metrics stay unavailable. Valid sessions are stored in browser-local storage under a stable canonical digest and remain available after refresh. Optional MP4 files use a revocable local object URL and are never telemetry evidence or uploaded.

Nebius coaching is intentionally unavailable until the owner selects and authorizes the exact NVIDIA model, account/spend boundary, and synthetic evidence transfer. Deterministic replay remains usable offline.

## Architecture

Three layers, each validating the next:

```
Layer 1: Wheelie (F1Tenth Race Car)
  |- Jetson Orin Nano Super Dev Kit
  |- RPILidar
  |- Oak D Lite Stereo Vision Camera
  |- VESC / FSESC 6.6
  '- PURPOSE: Data collection + model training platform
       1/10 scale, lower risk, faster iteration
       Generates training data: sensor -> coaching label

Layer 2: ACC VR (Software Proof of Concept)
  |- Gaming PC (RTX 5080, 64GB RAM)
  |- Quest 3 VR
  |- FastMCP server (acc-vr-mcp)
  '- PURPOSE: Validate coaching logic + voice feedback
       Zero hardware risk during algorithm dev
       Adaptive polling: 5 Hz monitor / 60 Hz on-track recording

Layer 3: Blurr C8 (Production)
  |- 2022 Chevrolet Corvette C8 (PDR, Magnetic Ride Select)
  |- Jetson Orin Nano Super (embedded, edge inference)
  |- RPILidar + Oak D Lite (mounted)
  '- PURPOSE: Real-time coaching at speed
       Sub-100ms voice latency (zero cloud, all edge)
       Track maps stored/downloaded locally
```

## Hardware

| Component | Role |
|-----------|------|
| 2022 Chevrolet Corvette C8 | Production target (PDR, Magnetic Ride Select, CAN bus) |
| Jetson Orin Nano Super Dev Kit x2 | Edge AI inference (one in Wheelie, one in C8) |
| RPILidar | Road/environment sensing (range, obstacles, surface) |
| Oak D Lite Stereo Vision Camera | Depth perception, road condition analysis |
| VESC / FSESC 6.6 | Motor controller (F1Tenth car) |
| Gaming PC (RTX 5080) | Development, simulation, ACC VR POC |
| Quest 3 VR | ACC VR proof-of-concept |

## How Coaching Works

**Inputs:**
- LiDAR: road surface, obstacles, environment geometry
- Stereo vision: depth, visual road condition (wet/dry, debris, camber)
- Telemetry: speed, braking, throttle, g-forces, steering angle, suspension data
- Track map: corner ID, apex location, ideal line, braking zones

**Outputs:**
- Voice coaching: "Brake now", "Traction ahead, ease off", "Perfect entry"
- Visual overlay (future): racing line, brake zones, condition warnings

## Current Status

| Component | Status |
|-----------|--------|
| Wheelie physical (Tamiya TT-02R) | 60% assembled. Nano/sensor/VESC platforms bolted on. |
| Wheelie software | 50%. Nano running, ROS2 Humble deployed, f1tenth_stack functional. |
| VESC / FSESC 6.6 | Blocker: USB driver issue on Windows. Fix via Android VESC Tool or Linux VESC Tool from Nano. |
| RPILidar | Purchased. Needs mounting + ROS2 config. |
| Oak D Lite | Purchased. Needs mounting + depthai-ros config. |
| ACC VR (acc-vr-mcp) | Architecture designed. Not yet coded. |
| Blurr C8 integration | Future phase (post-Wheelie training data). |

## Development Phases

### Phase 1-2: ACC VR POC (Software)
- FastMCP server reading ACC telemetry via shared memory (`pyaccsharedmemory`)
- Adaptive polling (5 Hz monitoring / 60 Hz on-track recording)
- SQLite lap persistence for cross-session analysis
- Post-lap analysis with Claude (corner-by-corner feedback)
- Voice coaching prototype via ElevenLabs TTS

### Phase 3: F1Tenth (Wheelie)
- Complete VESC configuration from Nano (Linux VESC Tool)
- Deploy LiDAR + Oak D Lite sensors
- ROS2 stack for sensor fusion
- Data collection runs -> coaching label generation
- Train edge models for real-time inference on Nano

### Phase 4: Sensor Integration (Nano + C8)
- Mount LiDAR and stereo camera in/on Corvette C8
- CAN bus / OBD2 integration for C8 telemetry
- PDR data access (Performance Data Recorder)
- Nano deployment in car

### Phase 5: Real-Time Coaching Loop (Production)
- Full pipeline: sensors -> Nano inference -> voice coach
- Track map download/storage system
- Sub-100ms voice latency requirement
- Track testing and calibration

## Design Constraints

**No lag tolerance.** Motorsports operate at margins where 500ms = difference between a clean lap and a barrier. Voice coaching must be sub-100ms. Inference runs locally on the Nano. No cloud, no network round-trip.

**Coach, not replace.** Blurr reads conditions and advises. The driver decides.

**Track-aware.** The system knows where it is on track, what corner is next, what the optimal line is. Coaching is context-specific, not generic.

**Edge-first.** All inference on Jetson Orin Nano. Wheelie = training data collection. C8 Nano = inference only (trained model, no retraining in car).

## Tech Stack

| Domain | Tools |
|--------|-------|
| Edge compute | Jetson Orin Nano Super, JetPack 6.x (Ubuntu 22.04) |
| Robotics | ROS2 Humble, f1tenth_system, vesc_driver |
| Sensors | RPILidar (rplidar_ros2), Oak D Lite (depthai-ros) |
| Sim integration | pyaccsharedmemory (ACC shared memory API) |
| MCP server | FastMCP (Python), adaptive polling, HTTP bridge |
| Persistence | SQLite (sessions, laps, telemetry_samples) |
| Voice | ElevenLabs TTS (pre-recorded clips + real-time synthesis) |
| AI | Claude (post-lap analysis), edge models (real-time coaching) |

## Related Projects

- **acc-vr-mcp**: Phase 1-2 VR POC codebase (Windows, Gaming PC)
- **wheelie**: F1Tenth car (SSH accessible as `wheelienano`)

## Wheelie (F1Tenth) Build Notes

- Platform: Modified Tamiya TT-02R (1/10 scale, F1tenth compatible)
- Nano: Dry fit complete, JetPack confirmed, ROS2 Humble stack deployed
- VESC blocker: FSESC 6.6 not registering on Windows (STM32 VCP driver issue)
  - Recommended: configure from Nano (Linux VESC Tool)
  - Easiest: Android VESC Tool app (BT or USB OTG)
- F1tenth software stack: JetPack 6.x, ROS2 Humble, f1tenth_system, rplidar_ros2, depthai-ros, vesc_driver

## C8 Corvette Capabilities

- **PDR (Performance Data Recorder)**: records video, audio, throttle, braking, steering, g-forces, GPS
- **Magnetic Ride Select**: adaptive magnetorheological suspension with real-time damping data
- **CAN bus**: accessible via OBD2 port for real-time telemetry

---

> Blurr is a driver-enhancement system. It augments human skill with data-driven coaching. It does not replace the driver.
