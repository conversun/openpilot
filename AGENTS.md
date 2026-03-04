# AGENTS.md — openpilot

Coding agent guide for the openpilot codebase (FrogPilot fork). Self-driving car platform — Python 3.11 + C++17, built with SCons.

## Build

```bash
scons -j$(nproc)                    # full build
scons -j8 selfdrive/ui/             # build specific target
scons --extras                      # include tools (cabana, replay)
scons --minimal                     # no tests/tools (release default)
scons --asan                        # AddressSanitizer build
scons --ubsan                       # UndefinedBehaviorSanitizer build
scons --compile_db                  # generate compile_commands.json
```

Build must succeed before running tests. C++ is compiled with `clang`/`clang++`, C++17 (`-std=c++1z`), `-Werror`.

## Test

Framework: **pytest** with xdist parallelism. `unittest` is banned.

```bash
# all tests (parallelized)
pytest

# single test file
pytest selfdrive/car/tests/test_car_interfaces.py

# single test function
pytest selfdrive/car/tests/test_car_interfaces.py::TestCarInterfaces::test_car_params -x

# skip slow tests
pytest -m 'not slow'

# run with coverage (CI command)
pytest --continue-on-collection-errors --cov --cov-report=xml --durations=0 --hypothesis-seed 0 -n logical

# specific module directory
pytest system/loggerd/
```

### Markers
- `slow` — long-running tests, skippable with `-m 'not slow'`
- `tici` — device-only tests (comma 3/3X), auto-skipped on PC

### Fixtures (conftest.py)
- `openpilot_function_fixture` — auto-use, isolates env vars, sets up `OpenpilotPrefix`, cleans up processes
- `openpilot_class_fixture` — auto-use class-scope env isolation
- `tici_setup_fixture` — hardware init for on-device tests

### Test paths (configured in pyproject.toml)
Tests live alongside code: `selfdrive/car/`, `selfdrive/controls/`, `system/loggerd/`, `tools/lib/tests/`, etc.
Test files must be named `test_*.py`. C++ test binaries: `test_*`.

## Lint

```bash
pre-commit run --all               # run all linters
```

### Ruff (Python)
- **Indent**: 2 spaces
- **Line length**: 160 characters
- **Quote style**: preserve (don't reformat quotes)
- **Target**: Python 3.11
- **Rules**: E, F, W, PIE, C4, ISC, A, B, NPY, UP, TRY302/400/401, RUF008/100, TID251

### mypy
Configured for Python 3.11 with `implicit_optional=true`, `warn_return_any=true`, `warn_unreachable=true`. Excludes submodules.

### C++ linting
- **cppcheck**: runs on all C++ outside submodules/third_party
- **clang-tidy**: bugprone, performance, clang-analyzer, misc, modernize checks

## Code Style — Python

### Imports
Absolute imports only. Three groups separated by blank lines:

```python
import os                                           # 1. stdlib
import time

import numpy as np                                  # 2. third-party
from cereal import car, log

from openpilot.common.params import Params           # 3. local (openpilot.*)
from openpilot.common.swaglog import cloudlog
from openpilot.selfdrive.car.interfaces import CarInterfaceBase
```

**Banned direct imports** (enforced by ruff TID251):
- `from selfdrive.xxx` → use `from openpilot.selfdrive.xxx`
- `from common.xxx` → use `from openpilot.common.xxx`
- `from system.xxx` → use `from openpilot.system.xxx`
- `from tools.xxx` → use `from openpilot.tools.xxx`
- `from third_party.xxx` → use `from openpilot.third_party.xxx`
- `pytest.main` — banned (requires special handling)
- `unittest` — banned (use pytest)

### Naming
- Functions/methods: `snake_case` — `get_car()`, `apply_hysteresis()`
- Classes: `PascalCase` — `CarInterface`, `Ratekeeper`, `ModelState`
- Constants: `UPPER_CASE` — `DT_CTRL`, `ACCEL_MAX`, `REPLAY`
- Files/modules: `snake_case` — `car_helpers.py`, `realtime.py`
- Cereal aliases at module level: `EventName = car.CarEvent.EventName`

### Type Annotations
Use modern Python 3.11 built-in syntax. Annotations encouraged but not universally enforced.

```python
def set_core_affinity(cores: list[int]) -> None:     # list, not List
def get_params() -> dict[str, str]:                   # dict, not Dict
def process(data: np.ndarray | None) -> bool:         # union with |, not Optional
```

### Error Handling & Logging
- Use `cloudlog` from `openpilot.common.swaglog` — not `print()` or stdlib `logging`
- Sentry for unhandled exceptions: `sentry.capture_exception()`
- Pattern:
```python
try:
  do_work()
except Exception:
  cloudlog.exception("context about what failed")
```

### Data Structures
- `Enum` / `StrEnum` for categorical values
- `@dataclass` for simple data containers
- `namedtuple` used sparingly in older code
- Cap'n Proto messages via `cereal` for IPC: `car.CarState.new_message()`

### Formatting
- 2-space indentation (enforced by .editorconfig and ruff)
- 160 char line limit
- LF line endings, UTF-8 encoding
- Final newline required, trailing whitespace trimmed
- No implicit string concatenation across lines

## Code Style — C++

### Compiler & Standard
- clang / clang++, C++17 (`-std=c++1z`)
- `-Werror` — all warnings are errors
- `-Wshadow`, `-Wunused` enabled

### Naming
- Functions/variables: `snake_case` — `logger_rotate()`, `handle_encoder_msg()`
- Classes/structs: `PascalCase` — `LoggerdState`, `Panda`, `RemoteEncoder`
- Macros/constants: `UPPER_CASE` — `MAX_IR_POWER`, `PROCESS_NAME`

### Includes
Own header first, then stdlib, then project:

```cpp
#include "system/loggerd/logger.h"     // own header

#include <map>                          // stdlib
#include <memory>
#include <vector>

#include "cereal/messaging/messaging.h" // project
#include "common/swaglog.h"
#include "common/util.h"
```

### Logging
Use macros from `common/swaglog.h`: `LOGW(...)`, `LOGE(...)`, `LOGD(...)`.

### Patterns
- RAII with `std::unique_ptr` / `std::make_unique`
- Cap'n Proto for message serialization
- Guard `#ifndef __APPLE__` for platform-specific SPI/hardware code
- Minimal namespace usage; cereal types prefixed as `cereal::Event`

## Project Structure

```
selfdrive/         Core driving: controls, car interfaces, models, UI, pandad
  car/             Per-manufacturer car ports (honda/, toyota/, hyundai/, etc.)
  controls/        Vehicle control logic (controlsd, latcontrol, longcontrol)
  modeld/          ML model inference
  ui/              Qt5 UI (C++)
system/            System services: loggerd, camerad, sensord, hardware
common/            Shared Python/C++ utilities (params, swaglog, realtime)
tools/             Dev tools: replay, cabana, simulation
cereal/            Cap'n Proto message schemas (submodule)
panda/             Panda hardware firmware (submodule)
frogpilot/         FrogPilot-specific features and customizations
third_party/       Vendored dependencies (acados, snpe, libyuv)
```

### Submodules (excluded from linting/testing)
`tinygrad_repo/`, `rednose_repo/`, `teleoprtc_repo/`, `msgq_repo/`, `body/`, `cereal/`, `opendbc/`, `panda/`

### Car port structure (`selfdrive/car/<brand>/`)
- `interface.py` — `CarInterface` subclass (main entry point)
- `carcontroller.py` — builds CAN messages to send
- `carstate.py` — parses CAN into `CarState`
- `values.py` — constants, car platform definitions, flags
- `fingerprints.py` — CAN fingerprints for car identification
- `radar_interface.py` — radar point parsing

## Key Conventions

1. **Messaging**: All IPC uses cereal pub/sub via `cereal.messaging` (`SubMaster`, `PubMaster`)
2. **Parameters**: Persistent key-value store via `Params()` from `openpilot.common.params`
3. **Process management**: Daemons managed by `system/manager/`, use `Ratekeeper` for loop timing
4. **Real-time**: `config_realtime_process(cores, priority)` for latency-critical processes
5. **Constants**: Timing constants in `common/realtime.py` — `DT_CTRL=0.01`, `DT_MDL=0.05`
6. **Environment flags**: `REPLAY`, `SIMULATION`, `TESTING_CLOSET` checked via `os.environ`
7. **No relative imports** — always absolute from `openpilot.*`
8. **No unittest** — always pytest

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add/modify car port | `selfdrive/car/<brand>/` | See `selfdrive/car/AGENTS.md` for template |
| Control tuning | `selfdrive/controls/lib/` | latcontrol_*, longcontrol, longitudinal_planner |
| FrogPilot features | `frogpilot/` | See `frogpilot/AGENTS.md` — 400+ params |
| FrogPilot web UI | `frogpilot/system/the_pond/` | Flask + Arrow.js SPA on port 8082 |
| FrogPilot controls | `frogpilot/controls/` | Planner, CEM, speed limit controller |
| ML model inference | `selfdrive/modeld/` | modeld.py + runners/ (THNEED/SNPE/ONNX) |
| FrogPilot alt models | `frogpilot/tinygrad_modeld/` | TinyGrad runner, vision+policy ONNX |
| Qt on-device UI | `selfdrive/ui/qt/` | C++ Qt5 widgets, maps, onroad display |
| FrogPilot UI extensions | `frogpilot/ui/qt/` | Custom offroad panels, themes, screenrecorder |
| System daemons (C++) | `system/` | loggerd, camerad, sensord — see `system/AGENTS.md` |
| Process management | `system/manager/` | process_config.py defines all managed daemons |
| Dev tools | `tools/` | replay, cabana (CAN analyzer), plotjuggler, sim |
| Navigation backend | `selfdrive/navd/` | Mapbox directions API, NavInstruction messages |
| Map rendering (C++) | `selfdrive/modeld/` | map_renderer.cc — 256×256 greyscale for model |
| Speed limits | `frogpilot/controls/lib/speed_limit_controller.py` | Mapbox matching + OSM data |
| Themes/assets | `frogpilot/assets/` | theme_manager.py, model_manager.py, NNFF models |
| Translations | `selfdrive/ui/translations/` | 23 language files (Qt .ts format) |
| CAN fingerprints | `selfdrive/car/<brand>/fingerprints.py` | FW_VERSIONS dict per platform |
| Parameters (persist) | `common/params.py` | Params() key-value store, shared C++/Python |

## FrogPilot Fork — Key Differences

This is a FrogPilot fork of openpilot. FrogPilot adds 400+ configurable parameters, custom control logic, a web dashboard, themes, and alternative model runners.

### FrogPilot Directory Structure

```
frogpilot/
├── common/              # frogpilot_variables.py (400+ params), frogpilot_functions.py
├── controls/            # frogpilot_planner.py, conditional experimental mode, speed limits
├── system/              # the_pond/ (web UI), frogpilot_stats.py, speed_limit_filler.py
├── ui/                  # Qt offroad panels, screenrecorder, FrogPilot UI state
├── navigation/          # mapd.py (offline map daemon)
├── assets/              # theme_manager.py, model_manager.py, NNFF models, toggle icons
├── tinygrad_modeld/     # Alternative model runner using TinyGrad framework
├── classic_modeld/      # Legacy model runner
├── third_party/         # Vendored: influxdb_client, reactivex, urllib3
├── tools/               # FrogPilot dev utilities
└── frogpilot_process.py # Main FrogPilot daemon — toggle management
```

### FrogPilot Process Additions

6 processes added to `system/manager/process_config.py`:
- `frogpilot_process` — Feature toggle management daemon
- `the_pond` — Web dashboard (Flask, port 8082)
- `mapd` — Offline map data daemon
- `speed_limit_filler` — OSM speed limit processing
- `classic_modeld` / `tinygrad_modeld` — Alternative ML model runners

### FrogPilot Integration Pattern

FrogPilot hooks into base openpilot via:
- `frogpilot_toggles` parameter passed through control chain (`controlsd` → `CarInterface.apply()`)
- `get_frogpilot_params()` methods on `CarInterfaceBase` subclasses
- Brand-specific `FrogPilotFlags` (e.g., `ToyotaFrogPilotFlags`, `HyundaiFrogPilotFlags`)
- Custom cereal messages (`frogpilotModelV2`) for enhanced model outputs
- `params_memory` for runtime toggle state (non-persistent)

### FrogPilot Anti-Patterns

- Never modify base openpilot files when FrogPilot overlay is possible
- Never hardcode FrogPilot params — use `frogpilot_variables.py` toggle system
- FrogPilot parameters use tuning levels 0-3 — respect level gating
