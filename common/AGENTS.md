# AGENTS.md — common/

Shared Python+C++ utilities. Imported by every other module. Stable API.

## Key Files

| File | Lang | Purpose |
|------|------|---------|
| `params.cc` / `params.py` / `params_pyx.pyx` | C++/Py/Cython | **Persistent KV store** — `Params()`. Cython binding for Python perf |
| `prefix.py` / `prefix.h` | Py/C++ | `OpenpilotPrefix` — test isolation (UUID-based `/dev/shm`, params, logs) |
| `swaglog.cc` / `swaglog.py` / `swaglog.h` | C++/Py | `cloudlog` — structured logging. C++ macros: `LOGW/LOGE/LOGD` |
| `realtime.py` | Py | RT scheduling: `Ratekeeper`, `config_realtime_process`, `DT_CTRL=0.01`, `DT_MDL=0.05` |
| `ratekeeper.cc` / `.h` | C++ | C++ Ratekeeper for native daemons |
| `util.cc` / `.h` | C++ | Misc helpers: file IO, time, RT priority |
| `watchdog.cc` / `.h` | C++ | Watchdog kicks for manager |
| `gpio.cc` / `.py` / `i2c.cc` | C++/Py | Low-level hardware access (tici only) |
| `clutil.cc` / `.h` | C++ | OpenCL helpers (`libgpucommon.a`) |
| `transformations/` | Py+C++ | Coord/orientation transforms — own SConscript |
| `simple_kalman.py` | Py | 1D Kalman filter |
| `numpy_fast.py` | Py | Hot-path numpy alternatives (`clip`, `interp`) — faster than numpy for scalars |
| `filter_simple.py` | Py | First-order LPF |
| `retry.py` / `timeout.py` | Py | Decorators |
| `mock/` | Py | Mock messaging for tests |
| `api/` | Py | Comma API client |

## Build

`SConscript` produces:
- `libcommon.a` — links into all C++ daemons
- `libgpucommon.a` — OpenCL helpers (camerad, modeld)
- `params_pyx.so` — Cython params binding
- Cython `transformations/` shared libs

## Conventions

- C++ headers `.h`, NOT `.hpp`
- `params.py` is a thin wrapper around `params_pyx` (C++ binding) — DO NOT add Python-only param logic
- Tests live in `tests/` (7 Python + 3 C++ via gtest `test_runner`)

## Anti-Patterns

- **Never** add module-level state — `common/` is imported everywhere; globals leak across processes
- **Never** import from `selfdrive/`, `system/`, `frogpilot/` — `common/` is the bottom of the dep graph
- **Never** add new logging APIs — extend `swaglog` or use `cloudlog`
- `numpy_fast.py` exists for hot-path scalar perf; benchmark before replacing with numpy
