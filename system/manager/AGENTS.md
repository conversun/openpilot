# AGENTS.md — system/manager/

Process supervisor. Boot orchestrator. **THE central process registry** for the entire openpilot stack.

## Files

| File | Purpose |
|------|---------|
| **`process_config.py`** | **Authoritative registry of ALL 49 managed daemons.** Defines run conditions (always/onroad/iscar/etc.), entry points, restart policy |
| `manager.py` | Main supervisor: spawns/monitors/kills processes, handles SIGTERM, posts crash to sentry |
| `process.py` | `Process` class hierarchy: `NativeProcess` (C++ binary), `PythonProcess`, `DaemonProcess` (background) |
| `helpers.py` | Boot helpers: prepare params, mount overlays |
| `build.py` | Pre-launch SCons build script (called from `launch_chffrplus.sh`) — retries with lower `-j` on OOM |
| `test/` | Manager tests |

No SConscript — pure Python.

## Process Types (process.py)

| Class | Use For |
|-------|---------|
| `NativeProcess` | C++ binary (e.g. `camerad`, `loggerd`) — `["./camerad"]` cwd-relative path |
| `PythonProcess` | Python module (e.g. `controlsd`) — `selfdrive.controls.controlsd` |
| `DaemonProcess` | Long-lived background service (e.g. `manage_athenad`) — survives manager restarts |

## Run Conditions (process_config.py)

49 processes gated by conditions. Key ones:

| Condition | Meaning |
|-----------|---------|
| `always_run` | Independent of driving state |
| `only_onroad` | Started=True (driving) |
| `only_offroad` | Started=False (parked) |
| `iscar` / `notcar` | Onroad on/off real car |
| `driverview` | Driver view enabled OR onroad |
| `allow_logging` | logging AND FrogPilot `no_logging` toggle off |
| `ublox` / `qcomgps` | GPS hardware variant |
| `run_new_modeld` / `run_classic_modeld` / `run_tinygrad_modeld` | Mutually exclusive: only ONE model runner runs |
| FrogPilot toggle gates | `run_speed_limit_filler`, etc. |

## Boot Chain

```
launch_openpilot.sh
  ↓ (sets API_HOST, ATHENA_HOST, MAPS_HOST)
launch_chffrplus.sh
  ↓ (PYTHONPATH, agnos_init, mounts overlay)
build.py        # scons compile (retries on OOM)
  ↓
manager.py      # main()
  ↓
process_config.procs  # iterates this list
  ↓
each Process.start()  # forks/execs
```

## FrogPilot Additions

7 processes added with FrogPilot toggle gating:
`frogpilot_process`, `the_pond`, `mapd`, `mapd_bridge`, `speed_limit_filler`, `tinygrad_modeld`, `classic_modeld`.

## Conventions

- **Adding a new process**: append a `NativeProcess`/`PythonProcess` to `process_config.procs` — DO NOT bypass manager
- Run condition lambdas receive `(started, params, CP)` — keep cheap, called every tick
- Process names appear in `procLog` and `cloudlog` — use existing-style snake_case
- `manager_cleanup()` is called by tests via `openpilot_function_fixture`

## Anti-Patterns

- **Never** spawn subprocesses outside `manager.py` for daemons — bypasses crash recovery
- **Never** block in `manager.py` main loop — heartbeat must run every tick
- **Never** hardcode process paths in other daemons — read from `process_config` if needed
- `build.py` retries with lower parallelism on failure; do NOT add aggressive `-j` flags here
- `print()` exists in `manager.py` boot path (pre-cloudlog) — known violation, do NOT add more
