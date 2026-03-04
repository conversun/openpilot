# AGENTS.md — frogpilot/

FrogPilot overlay ecosystem. 400+ configurable parameters, custom controls, web dashboard, themes, alt model runners.

## Key Files

| File | Purpose |
|------|---------|
| `frogpilot_process.py` | Main daemon — toggle management, param refresh loop |
| `common/frogpilot_variables.py` | **Central config** — all 400+ params with defaults and tuning levels |
| `common/frogpilot_functions.py` | Boot utilities, backup/restore, setup/uninstall |
| `common/frogpilot_utilities.py` | Shared helpers: calculations, file ops, URL pinging |
| `controls/frogpilot_planner.py` | Extended planner: CEM, accel profiles, speed limits |
| `controls/frogpilot_card.py` | Button event handler (experimental mode toggle, traffic mode) |
| `system/the_pond/the_pond.py` | Web UI server — see `system/the_pond/AGENTS.md` |
| `system/frogpilot_stats.py` | Telemetry: InfluxDB + location anonymization |
| `system/speed_limit_filler.py` | OSM speed limit daemon (Overpass API) |
| `navigation/mapd.py` | Offline map binary manager |
| `assets/theme_manager.py` | Theme system: holiday themes, downloads, switching |
| `assets/model_manager.py` | ML model download/validation/update |
| `assets/download_functions.py` | Download infra: GitHub/GitLab fallback + verification |

## Integration Pattern

FrogPilot does NOT monkey-patch base openpilot. It uses a parameter-driven overlay:

1. `frogpilot_variables.py` defines all toggles with `Params()` keys
2. `frogpilot_process.py` daemon reads UI changes → writes `params_memory`
3. `controlsd` passes `frogpilot_toggles` through the control chain
4. `CarInterface.apply(frogpilot_toggles=...)` applies brand-specific behavior
5. Brand-specific `FrogPilotFlags` (IntFlag) gate features per car

## Parameter System

- **Source**: `frogpilot_variables.py` — `get_frogpilot_toggles()` function
- **Storage**: `Params()` (persistent) + `params_memory` (runtime volatile)
- **Tuning levels**: 0 (basic) → 3 (advanced). Higher levels unlock more params
- **Reading**: `params.get("ParamName")` returns bytes — decode as needed
- **Writing**: `params.put("ParamName", value)` — triggers daemon refresh

## Controls Extensions

| Component | File | What It Does |
|-----------|------|-------------|
| CEM | `controls/lib/conditional_experimental_mode.py` | Auto-switch chill↔experimental based on conditions |
| Speed Limit | `controls/lib/speed_limit_controller.py` | Adapt cruise speed to posted limits (maps + API) |
| vCruise | `controls/lib/frogpilot_vcruise.py` | Speed limit integration into cruise control target |
| Planner | `controls/frogpilot_planner.py` | Orchestrates CEM + accel profiles + following distance |
| Personalities | via `frogpilot_variables.py` | Traffic/Aggressive/Standard/Relaxed driving profiles |

## Anti-Patterns

- **Never** modify base openpilot files when overlay is possible
- **Never** hardcode params — always define in `frogpilot_variables.py`
- **Never** bypass tuning levels — respect the 0-3 gating system
- **Never** import from `frogpilot.*` without `openpilot.` prefix
- Theme/model downloads must use `download_functions.py` with verification

## Adding a New FrogPilot Feature

1. Add param to `frogpilot_variables.py` with tuning level and default
2. Read it in `get_frogpilot_toggles()` → propagates via `frogpilot_toggles`
3. Implement logic in `frogpilot/controls/` or `frogpilot/system/`
4. If UI needed: add Qt panel in `frogpilot/ui/qt/offroad/`
5. If web needed: add endpoint in `the_pond.py` + JS component
