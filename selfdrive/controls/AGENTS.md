# AGENTS.md — selfdrive/controls/

Real-time vehicle control system. 100Hz main loop (DT_CTRL=0.01s).

## Architecture

```
controlsd.py                  Main control daemon — state machine, event handling
lib/
├── latcontrol.py             Lateral control base class
├── latcontrol_pid.py         PID lateral controller
├── latcontrol_torque.py      Torque-based lateral (most cars)
├── latcontrol_angle.py       Angle-based lateral (some brands)
├── longcontrol.py            Longitudinal PID controller
├── longitudinal_planner.py   Speed target planning (MPC)
├── vehicle_model.py          Vehicle dynamics for curvature
├── events.py                 Event system — alerts, state transitions
└── drive_helpers.py          vCruise logic, button handling
```

## Control Loop (controlsd.py)

1. **Subscribe**: `SubMaster` receives `modelV2`, `carState`, `longitudinalPlan`, sensor data
2. **Events**: Gather safety events (door open, seatbelt, driver attention)
3. **State**: Transition state machine (disabled → preEnabled → enabled → softDisabling)
4. **Lateral**: Select controller (PID/torque/angle) → compute steering command
5. **Longitudinal**: Compute accel from planner output → PID → actuator command
6. **Publish**: `PubMaster` sends `controlsState`, `carControl` to pandad

## State Machine

States: `disabled`, `preEnabled`, `enabled`, `softDisabling`, `overriding`

Transitions via events:
- `ET.ENABLE` → disabled→enabled (cruise engaged)
- `ET.USER_DISABLE` → any→disabled (brake/cancel pressed)
- `ET.SOFT_DISABLE` → enabled→softDisabling (non-critical fault)
- `ET.IMMEDIATE_DISABLE` → any→disabled (critical fault)

## Lateral Controllers

| Controller | File | Used When |
|-----------|------|-----------|
| Torque | `latcontrol_torque.py` | Most cars (torque steer interface) |
| PID | `latcontrol_pid.py` | Angle steer cars with PID |
| Angle | `latcontrol_angle.py` | Direct angle steer cars |

Selection: `CarInterface.get_params()` sets `latControlType` per platform.

## FrogPilot Extensions

FrogPilot adds parallel control logic in `frogpilot/controls/`:

| Component | Purpose |
|-----------|---------|
| `frogpilot_planner.py` | Orchestrates CEM + speed limits + accel profiles |
| `lib/conditional_experimental_mode.py` | Auto chill↔experimental switching |
| `lib/speed_limit_controller.py` | Cruise speed adaptation from map data |
| `lib/frogpilot_vcruise.py` | Speed limit → vCruise target integration |
| `frogpilot_card.py` | Button handler: traffic mode, AOL toggle |

Integration: `controlsd` calls FrogPilot planner, passes `frogpilot_toggles` to `CarInterface.apply()`.

## Key Interfaces

- `CarInterface.apply(CC, now, frogpilot_toggles)` → `(actuators, sendcan)`
- `CarInterface.get_pid_accel_limits(CP, current_speed, cruise_speed)` → `(min_accel, max_accel)`
- `Ratekeeper(100)` — ensures 100Hz timing
- `config_realtime_process(cores, priority)` — RT scheduling for latency

## Anti-Patterns

- **Never** add delays in the control loop — 10ms budget per iteration
- **Never** block on I/O in controlsd — async or separate process
- **Never** modify state machine without updating `events.py` transitions
- Lateral/longitudinal output must respect `CarControllerParams` limits
- Always use `cloudlog` for errors — never `print()` in RT code
