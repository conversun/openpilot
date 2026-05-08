# AGENTS.md — selfdrive/test/

Test infrastructure unique to openpilot. Hosts the **process replay** framework, on-device tests, CI helpers.

## Key Files

| File | Purpose |
|------|---------|
| `cpp_harness.py` | Wraps C++ test binaries in `OpenpilotPrefix` for IPC isolation. Referenced by `pyproject.toml` `cpp_harness` |
| `helpers.py` | Test utilities: `set_params_enabled`, `processes_context`, `release_only`, `phone_only` |
| `fuzzy_generation.py` | Hypothesis strategies for cereal message fuzzing |
| `test_onroad.py` | End-to-end onroad simulation test (`@pytest.mark.slow`) |
| `test_time_to_onroad.py` | Boot timing regression |
| `test_updated.py` | OTA updater test |
| `update_ci_routes.py` | Updates CI test route bucket |
| `ciui.py` | Minimal UI for CI (no Qt) |

## Subdirectories

| Dir | Purpose |
|-----|---------|
| **`process_replay/`** | Process replay framework — UNIQUE to openpilot. Replays logged messages through individual processes, diffs output vs reference logs |
| `longitudinal_maneuvers/` | Pure-simulation longitudinal MPC tests (`plant.py` + `maneuver.py`) — no external data |
| `profiling/` | py-spy profiler wrappers |

## Process Replay (THE openpilot test pattern)

```python
from openpilot.selfdrive.test.process_replay.process_replay import replay_process_with_name
out_lr = replay_process_with_name('locationd', input_lr)  # input_lr is a LogReader
```

| File | Purpose |
|------|---------|
| `process_replay/process_replay.py` | Framework: `CONFIGS` dict defines per-process pub/sub, `replay_process()` core loop |
| `process_replay/test_processes.py` | Regression: replays segment, compares to reference, fails on diff |
| `process_replay/model_replay.py` | Model-specific replay using `TEST_ROUTE = "2f4452b03ccb98f0\|2022-12-03--13-45-30"` |
| `process_replay/test_fuzzy.py` | Hypothesis fuzz testing of process inputs |
| `process_replay/regen.py` / `regen_all.py` | Regenerate reference segments (stored in git-lfs as `.bz2`) |
| `process_replay/compare_logs.py` | Diff two logs message-by-message |
| `process_replay/migration.py` | Schema migrations for old segments |

**Source segments**: 17 car-specific recordings; reference segments stored as bz2.

## Bash Scripts

| Script | Purpose |
|--------|---------|
| `ci_shell.sh` | Wraps `pytest` for CI environment |
| `docker_build.sh` / `docker_common.sh` | Build CI docker image |
| `docker_tag_multiarch.sh` | Multi-arch image tagging |
| `loop_until_fail.sh` | Stress-runs a test until failure (flake hunting) |
| `scons_build_test.sh` | Verifies clean + cache rebuild |
| `setup_device_ci.sh` / `setup_vsound.sh` / `setup_xvfb.sh` | Headless CI environment setup |

## Conventions

- All tests use `OpenpilotPrefix` isolation (auto-applied via `openpilot_function_fixture`)
- Reference segments in `process_replay/` are git-lfs — pull with `git lfs fetch` before running
- New process? Add entry to `process_replay.py::CONFIGS` AND a reference log
- C++ tests via `pytest-cpp` use `cpp_harness.py` automatically (configured in `pyproject.toml`)

## Anti-Patterns

- **Never** commit a process change without regenerating reference logs (or explicitly bumping `process_replay`'s tolerance)
- **Never** use `unittest.TestCase` (banned by ruff TID251) — except `test_models.py` which has `# noqa: TID251` for `parameterized_class` compat
- **Never** add timing-dependent assertions without `@pytest.mark.slow` and CI sharding
- **Never** depend on external network in tests — use logged segments from CI bucket
- `loop_until_fail.sh` is a flake-hunting tool, NOT a CI gate — fix the flake
