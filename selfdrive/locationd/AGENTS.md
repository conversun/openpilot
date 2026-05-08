# AGENTS.md — selfdrive/locationd/

Vehicle state estimation. Family of 5 daemons sharing Kalman filter + parameter estimation.

## Daemons (all managed processes)

| Daemon | Lang | File | Purpose |
|--------|------|------|---------|
| **locationd** | C++ | `locationd.cc` / `.h` | Sensor fusion: GPS + IMU + camera → `livePose` Kalman state |
| **calibrationd** | Py | `calibrationd.py` | Camera extrinsic calibration (pitch/yaw/roll) → `liveCalibration` |
| **paramsd** | Py | `paramsd.py` | Vehicle params estimation (steerRatio, stiffness) → `liveParameters` |
| **torqued** | Py | `torqued.py` | Lateral torque-effectiveness estimation → `liveTorqueParameters` |
| **lagd** | Py | `lagd.py` | Control latency estimation → `liveDelay` |

All run `only_onroad`.

## Files

| File | Purpose |
|------|---------|
| `helpers.py` | Shared estimator math (point clouds, rotations) |
| `models/` | Kalman filter state-space models (rednose-generated) |
| `test/` | `test_locationd_scenarios.py` uses real route `ff2bd20623fcaeaa\|2023-09-05--10-14-54/4` |

## Architecture

```
GPS (ublox/qcom) ──┐
IMU (sensord) ─────┼─→ locationd.cc → livePose (60Hz Kalman update)
camera (modeld) ───┤        │
                   │        └─→ liveCalibration (camera extrinsics)
                   │
controlsd output ──┴─→ paramsd → liveParameters (vehicle dynamics)
                   └─→ torqued → liveTorqueParameters (steer effectiveness)
                   └─→ lagd    → liveDelay (actuation latency)
```

## Build

`SConscript` builds:
- `locationd` C++ binary (links rednose Kalman library)
- Python daemons run directly (no compilation)

## Conventions

- All C++ uses **rednose** (in `rednose_repo/`) for Kalman filter codegen — DO NOT hand-write filter equations
- Position uncertainty: `positionECEF.std` is the ONLY published Kalman uncertainty (Geodetic.std is NaN) — see `frogpilot/navigation/AGENTS.md`
- `liveCalibration` validity gates downstream: invalid → openpilot disengages
- All daemons publish at fixed rates via `Ratekeeper` — no event-driven publishing

## Anti-Patterns

- **Never** modify Kalman models in `models/` directly — regenerate from `rednose_repo/` model definitions
- **Never** publish before estimator converges (`status` field gates downstream)
- **Never** mix coordinate frames: ECEF (locationd) vs NED (sensors) vs body (controls) — convert explicitly
- `paramsd`/`torqued`/`lagd` write learned values to Params (`LiveParameters`, etc.) — survive reboot. DO NOT clear without reason
