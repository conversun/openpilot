# AGENTS.md — selfdrive/ui/

Qt5 on-device UI. 49 .cc + 42 .h C++ files, ~13 Python files. Heaviest C++ module in `selfdrive/`.

## Binaries Built (SConscript)

| Binary | Source | Purpose |
|--------|--------|---------|
| `ui` | `main.cc` + `qt/` | Main driving display + offroad settings |
| `_spinner` | `qt/spinner.cc` | Loading spinner (used during boot/build) |
| `_text` | `qt/text.cc` | Text dialog (errors, confirmations) |
| `mui` | `mui.cc` | Minimal UI (degraded mode) |
| `watch3` | `watch3.cc` | Camera viewer utility |
| `installer` | `installer/installer.cc` | Initial OS installer |
| `setup` / `updater` / `reset` | `qt/setup/*.cc` | Setup wizard, OTA updater, factory reset |

## Subdirectories

| Dir | Purpose |
|-----|---------|
| `qt/` | Main Qt5 app: widgets, onroad views, offroad panels, maps, setup screens |
| `qt/offroad/` | Settings panels (parked) |
| `qt/onroad/` | Driving overlay (annotated_camera, hud, alerts) |
| `qt/widgets/` | Reusable: ssh_keys, controls, prime, scrollview |
| `qt/maps/` | MapboxGL widget for navigation |
| `qt/setup/` | Setup binaries (separate executables) |
| `qt/network/` | WiFi/cellular config UI |
| `installer/` | OS installer binary |
| `tests/` | UI tests (translations, snapshot) — `test_runner` gtest binary + Python test_translations |
| `translations/` | 23 language `.ts` files (Qt linguist format) — see `update_translations.py` |
| `text/`, `spinner/` | Resource directories for `_text`/`_spinner` binaries |

## Python Components

| File | Purpose |
|------|---------|
| `soundd.py` | Alert sound playback daemon (managed process) |
| `ui.py` | Python UI launcher (debug) |
| `update_translations.py` | Regenerates `.ts` files from source strings |
| `translations/auto_translate.py` | Machine translation helper |
| `translations/create_badges.py` | Translation completeness badges |

## FrogPilot UI Extensions

`frogpilot/ui/qt/` overlays this directory with:
- Custom offroad panels (`frogpilot_settings.cc`)
- Themes / icon packs / sound packs
- Screen recorder (`frogpilot/ui/screenrecorder/`, OpenMAX H.264)

## Build

```bash
scons -j$(nproc) selfdrive/ui/    # all UI binaries
scons -j8 selfdrive/ui/qt/        # main ui only
```

Optional: `--clazy` for Qt static analysis. `--nosr` skips screen recorder.

## Conventions

- Qt5 (NOT Qt6) — confirmed via `QT_VERSION`
- `.h`/`.cc` extension pair (NOT `.hpp`/`.cpp`)
- Translations: every user-visible string MUST go through `tr(...)` macro
- `test_translations` pre-commit hook auto-runs when files in `translations/` change
- Layouts use `QHBoxLayout`/`QVBoxLayout`, NOT QML
- `qt/maps/` uses MapboxGL (vendored under `third_party/maplibre-native-qt`)

## Anti-Patterns

- **Never** add `std::cout` — use `LOGW/LOGE/LOGD` (existing violation in `frogpilot/ui/qt/offroad/frogpilot_settings.cc` is a known migration target)
- **Never** block the Qt event loop — long ops go through `QThread` or async signals
- **Never** hardcode user-facing strings — wrap in `tr()` and update translations
- **Never** modify base `qt/offroad/` files for FrogPilot features — extend in `frogpilot/ui/qt/offroad/`
- Resource paths must use `:/` (Qt resource) for embedded assets, NOT filesystem paths
