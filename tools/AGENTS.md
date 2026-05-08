# AGENTS.md — tools/

Developer/debug utilities. Excluded from `--minimal` builds. Built via `scons --extras`.

## Subdirectories

| Dir | Lang | Purpose |
|-----|------|---------|
| `cabana/` | C++ Qt5 (68 files) | CAN message analyzer GUI — full Qt5 app, own SConscript |
| `replay/` | C++ + Py | Drive replay tool — own SConscript, replays recorded routes |
| `lib/` | Py (27 files) | Shared library: `LogReader`, `URLReader`, `auth`, route helpers |
| `sim/` | Py | MetaDrive/CARLA simulator bridge — own conftest, `--test_duration` |
| `plotjuggler/` | Py | PlotJuggler log plotter integration |
| `bodyteleop/` | Py | Web joystick (used by `webjoystick` process when `notcar`) |
| `joystick/` | Py | Joystick control daemon (`joystickd.py`) |
| `car_porting/` | Py | New car porting helpers: `auto_fingerprint`, `test_car_model` |
| `camerastream/` | Py | Compressed VisionIPC stream viewer |
| `webcam/` | Py | USB webcam camera daemon for non-tici hardware |
| `latencylogger/` | Py | Per-process latency analysis from rlogs |
| `rerun/` | Py | Rerun.io log viewer integration |
| `tuning/` | Py | Steering accuracy measurement |
| `profiling/` | Py | py-spy / scalene wrappers |
| `scripts/` | Py+sh | One-off utilities (SSH keys, ublox capture) |
| `serial/` | sh | Serial console helpers |
| `ssh/` | conf | SSH config templates |

## Setup Scripts

| Script | Use |
|--------|-----|
| `ubuntu_setup.sh` | Full Ubuntu install (calls install_*.sh below) |
| `mac_setup.sh` | Full macOS install (Homebrew + Python deps) |
| `install_ubuntu_dependencies.sh` | apt deps for 20.04/22.04/24.04 |
| `install_python_dependencies.sh` | pyenv + Python 3.11.4 + poetry + pre-commit |

## Conventions

- `tools/` is excluded from release builds (`scons --minimal`)
- `cabana/` has no AGENTS.md but is essentially a sibling Qt5 app to `selfdrive/ui/` — separate compilation unit
- `tools/lib/` is the canonical reader for `rlog.bz2` / `qlog.bz2` / route URLs — DO NOT reimplement
- `webjoystick` (in `bodyteleop/`) and `bridge` (cereal) are managed by `manager.py` despite living outside `system/`/`selfdrive/`

## Anti-Patterns

- **Never** add tool deps to `selfdrive/`/`system/` runtime — keep dev-only deps here
- **Never** import from `tools.*` in production code (controlsd, etc.) — ruff TID251 enforces `openpilot.tools.*` prefix anyway
- `cabana/` C++ tests use Qt's QTest, NOT gtest — different harness

## Where to Look

| Task | Location |
|------|----------|
| Replay a drive locally | `tools/replay/replay --route <route>` |
| Decode CAN traffic | `tools/cabana/cabana` |
| Read rlog programmatically | `tools/lib/logreader.py::LogReader` |
| Add new car port | `tools/car_porting/auto_fingerprint.py` |
| Run sim | `tools/sim/launch_openpilot.sh` + `tools/sim/run_bridge.py` |
| Plot signals over time | `tools/plotjuggler/juggle.py` |
