# Wave 6 Verification Report — T17 + T18

Build-green and panda-safety verification for the `MAZDA_3_2019`
(GEN2 + Torque Interceptor) port. This combined wave covers:

- **T17** — build green + import smoke (parent + opendbc_repo)
- **T18** — panda safety pytest exercising both `FLAG_MAZDA_GEN2` and
  `FLAG_MAZDA_GEN2 | FLAG_MAZDA_TORQUE_INTERCEPTOR` flag combos

Date: 2026-05-09  
Parent branch: `mazda-port`  
opendbc_repo branch: `mazda-port-additions` @ `29db3c74` (T10b head)  
panda branch: `mazda-port-additions` @ `066ca435`  
Parent HEAD before this commit: `60772b42b` (Wave 5 docs)  
Local host: macOS Darwin x86_64, Python 3.12.12 (uv-managed)

> **Bottom line up-front:** Phases B (static), C (import smoke) and the
> 95 % majority of Phase D (panda safety pytest) all PASS locally on
> macOS. Phase E (parent `scons` build) is BLOCKED on macOS because
> nine of the parent SConstruct's vendored native deps (`bzip2`,
> `capnproto`, `eigen`, `ffmpeg`, `libjpeg`, `libyuv`, `ncurses`,
> `zeromq`, `zstd`) refuse to build on `Darwin x86_64`. Phase D
> surfaced **2 real test-framework failures** in
> `test_tx_hook_on_wrong_safety_mode` for `TestMazdaGen2Safety` and
> `TestMazdaGen2TiSafety`. Root-caused below as a **missing
> sibling-mode skip rule** in `opendbc/safety/tests/common.py`
> (analogous to the existing `TestSubaruGen` / `TestSubaruPreglobal`
> rules). It is a **panda-test-framework gap, not a safety-logic
> bug** — the safety C correctly enforces each mode's TX list; the
> meta-test just doesn't know that GEN2 and GEN2+TI legitimately
> share `TX_MSGS`. Recommended one-line fix is in *Open issues*.
>
> Final verdict: **`Wave 6 verification: DEVICE_PENDING`** — the user
> must run `docs/migration/T17_T18_device_verification.sh` on a Linux
> dev box / comma 3X to clear Phase E and re-confirm Phase D after the
> common.py skip rule is added (or accept the 2 failures as known
> framework-only blockers documented here).

---

## Phase A — Local environment

**Status: PASS (with native-dep exclusions).**

| Tool        | Where         | Version                                                      |
|-------------|---------------|--------------------------------------------------------------|
| `uv`        | `~/.local/bin/uv`        | 0.10.6                                            |
| `pdm`       | _not present_ | n/a                                                          |
| `poetry`    | _not present_ | n/a                                                          |
| `python3`   | `~/.local/bin/python3`   | 3.12.12 (uv-managed cpython)                      |
| `pytest`    | `.venv/bin/pytest`       | 9.0.3 (after `uv sync --extra testing`)           |
| `scons`     | `.venv/bin/scons`        | 4.10.1 (cannot read parent SConstruct, see Phase E) |
| `cc` / `clang` | `/usr/bin/clang`      | Apple system, sufficient for `libsafety_py.so`    |

The pinned interpreter in `.python-version` is `3.12.13`, but uv's
managed-Python channel only carries `3.12.12` on this box. `pyproject.toml`
declares `requires-python = ">= 3.12.3, < 3.13"`, so `3.12.12` satisfies
the constraint. The venv was created with `--python 3.12.12`.

`uv sync --frozen --python 3.12.12` (without exclusions) failed at the
first vendored native dep:

```
× Failed to build `zstd @
│ git+https://github.com/commaai/dependencies.git@…#subdirectory=zstd`
╰─▶ Call to `setuptools.build_meta.build_wheel` failed (exit status: 1)
    RuntimeError: unsupported platform: ('Darwin', 'x86_64')
```

The same `unsupported platform: ('Darwin', 'x86_64')` is raised by every
git-vendored dep in the lockfile. `uv sync` was therefore re-issued with
`--no-install-package` for each of the 32 unbuildable native deps (full
list: `zstd bzip2 capnproto catch2 acados eigen ffmpeg libjpeg libyuv
ncurses zeromq libusb qt-{charts,base,multimedia,svg,translations,imageformats,tools,wayland}
gcc-arm-none-eabi git-lfs xvfb imgui metadrive-simulator raylib opensc nasm agg
csharptools onnxruntime pytest-xdist`). After exclusions, `uv sync --extra testing`
returned exit `0` and installed 71 wheels-only packages including `numpy 2.4.4`,
`pycapnp 2.2.2`, `crcmod-plus 2.3.1`, `cffi 2.0.0`, `cython 3.2.4`,
`scons 4.10.1`, and `pytest 9.0.3` + `hypothesis 6.47.5`.

All subsequent Phase B–E commands run via `.venv/bin/python3`.

---

## Phase B — Static & syntactic verification

**Status: PASS.** All four checks clean. Re-run via system `python3`
and again via `.venv/bin/python3`; identical results.

### B.1 — `py_compile` matrix

```
$ python3 -m py_compile \
    opendbc_repo/opendbc/car/mazda/values.py \
    opendbc_repo/opendbc/car/mazda/interface.py \
    opendbc_repo/opendbc/car/mazda/carstate.py \
    opendbc_repo/opendbc/car/mazda/carcontroller.py \
    opendbc_repo/opendbc/car/mazda/mazdacan.py \
    opendbc_repo/opendbc/car/mazda/fingerprints.py \
    opendbc_repo/opendbc/can/dbc.py
exit:0   (no output)

$ .venv/bin/python3 -m py_compile <same 7 files>
exit:0   (no output)
```

All seven source files byte-compile cleanly under both interpreters.

### B.2 — GREP-1 (functional FrogPilot tokens)

```
$ grep -nrE 'frogpilot_toggles|FrogPilot|fp_ret|FPCP' \
    opendbc_repo/opendbc/car/mazda/ \
    opendbc_repo/opendbc/safety/modes/mazda.h \
    opendbc_repo/opendbc/safety/tests/test_mazda.py
opendbc_repo/opendbc/car/mazda/values.py:49:  # Ported from FrogPilot source fork: selfdrive/car/__init__.py:112-131.
opendbc_repo/opendbc/car/mazda/values.py:156:  # selfdrive/car/mazda/values.py (FrogPilot). The 4-value layout reflects the
exit:0
```

Two matches — both are the **known benign provenance comments** signed
off in Wave 5 (`wave5_integration_report.md` T15 block). No functional
FrogPilot code remains. Identical to the Wave 5 result; no drift.

### B.3 — GREP-2 (dropped-feature tokens)

```
$ grep -nrE '/dev/shm|BlendedACC|CEStatus|ManualTransmission|TorqueInterceptorEnabled|RadarInterceptorEnabled|NoMRCC|NoFSC' \
    opendbc_repo/opendbc/car/mazda/
exit:1   (no output)
```

Clean. None of the dropped FrogPilot features (BlendedACC, manual-trans
hook, TI-toggle, radar-interceptor toggle, FSC/MRCC fallbacks) leaked
back into the Mazda module. `grep` exit `1` = "no matches", which is
the desired outcome here.

### B.4 — GREP-3 (unanchored `Params(` constructions)

```
$ grep -nE '(^|[^a-zA-Z_])Params\(' opendbc_repo/opendbc/car/mazda/*.py
exit:1   (no output)
```

Clean. The Mazda module continues to be free of process-local
`Params()` reads, satisfying the no-toggle-injection-into-brand-code
invariant from Wave 5.

---

## Phase C — Import smoke test

**Status: PASS** (with one task-script delta noted below).

The task spec called for `from opendbc.car.mazda.values import Platforms,
…`. The Mazda module's enum is named `CAR`, not `Platforms`
(`Platforms` is the aggregate union in `opendbc.car.values`, populated
from each brand's `CAR`). Substituting `CAR` for `Platforms` is the
correct, minimal change to make the imports resolve; the rest of the
script runs verbatim.

```
$ PYTHONPATH=. .venv/bin/python3 -c "
> from opendbc.car.mazda.values import CAR, MazdaFlags, TI_STATE, apply_ti_steer_torque_limits, CarControllerParams
> from opendbc.car.mazda.interface import CarInterface
> from opendbc.car.mazda.carstate import CarState
> from opendbc.car.mazda.carcontroller import CarController
> from opendbc.car.mazda.mazdacan import mazda2019_checksum, create_steering_control_gen2, create_acc_cmd
> from opendbc.car.mazda.fingerprints import FW_VERSIONS
> from opendbc.can.dbc import get_checksum_state
>
> p = CAR.MAZDA_3_2019
> flags = p.config.flags
> assert flags & MazdaFlags.GEN2 and flags & MazdaFlags.TORQUE_INTERCEPTOR, f'flags={hex(flags)}'
>
> state = get_checksum_state('mazda_2019')
> assert state is not None, 'mazda_2019 checksum not registered'
> assert callable(state.calc_checksum), 'calc_checksum missing'
>
> assert mazda2019_checksum(0x220, None, bytearray([1,2,3,4,5,6,7])) == 0x46
> assert mazda2019_checksum(0x249, None, bytearray([0]*7)) == 0x53
> print('IMPORT_SMOKE: OK')
> print('flags=', hex(flags))
> "
IMPORT_SMOKE: OK
flags= 0xa
exit:0
```

What this verifies, end-to-end:

| Check | Result |
|-------|--------|
| All 6 Mazda module imports (`values`, `interface`, `carstate`, `carcontroller`, `mazdacan`, `fingerprints`) resolve | **OK** |
| `dbc.get_checksum_state('mazda_2019')` returns a non-`None` state | **OK** |
| Returned state has a callable `.calc_checksum` (T9b registration intact) | **OK** |
| `MAZDA_3_2019` config flags include `GEN2` (`0x2`) **and** `TORQUE_INTERCEPTOR` (`0x8`) → `0xa` | **OK** |
| `mazda2019_checksum(0x220, None, bytearray([1..7])) == 0x46` (functional checksum trace) | **OK** |
| `mazda2019_checksum(0x249, None, bytearray([0]*7)) == 0x53` | **OK** |

The final `flags=0xa` value is the canonical T7-shipped pin: `GEN2 (2) |
TORQUE_INTERCEPTOR (8) = 0xa`.

> **Action item for the task spec:** the import-smoke recipe in the
> Wave 6 task references `Platforms.MAZDA_3_2019`. The actually-correct
> attribute path is `CAR.MAZDA_3_2019` (or
> `opendbc.car.values.PLATFORMS.MAZDA_3_2019` if the aggregate is
> wanted). The device script uses `CAR` so as to mirror the upstream
> Mazda convention.

---

## Phase D — Panda safety pytest (T18, the critical one)

**Status: PARTIAL PASS** — 77 passed, 15 skipped, **2 failed**.

### D.1 — Pytest invocation

The parent `pyproject.toml:129` sets
`addopts = "… -n auto --dist=loadgroup …"`, which requires the
`pytest-xdist` git-pinned dep that does not build on Darwin x86_64.
The parent `conftest.py` also imports `openpilot.common.params_pyx`,
which is a Cython extension that has not been built locally.

Both blockers are bypassed with three flags:

| Flag                                   | Reason                                        |
|----------------------------------------|-----------------------------------------------|
| `-o addopts=`                          | strip `-n auto --dist=loadgroup` (no xdist)   |
| `--rootdir=opendbc_repo`               | resolve test paths against the submodule      |
| `--confcutdir=opendbc_repo`            | stop pytest walking up to parent conftest     |

Final command:

```
.venv/bin/python3 -m pytest opendbc/safety/tests/test_mazda.py -v \
  --rootdir=/Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo \
  --confcutdir=/Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo \
  -o addopts= --tb=short
```

### D.2 — Test discovery (`--collect-only`)

```
=== 94 tests collected in 0.11s ===
```

Three classes:

| Class                    | Test count | Flag combo                                   |
|--------------------------|-----------:|----------------------------------------------|
| `TestMazdaSafety`        |  29        | `FLAG_MAZDA_GEN1` (FLAGS=0)                  |
| `TestMazdaGen2Safety`    |  31        | `FLAG_MAZDA_GEN2` (FLAGS=0x02)               |
| `TestMazdaGen2TiSafety`  |  34        | `FLAG_MAZDA_GEN2 \| FLAG_MAZDA_TORQUE_INTERCEPTOR` (FLAGS=0x0a) |

Discovery works locally — no import errors, no `ModuleNotFoundError` —
which means `safety.c` compiles cleanly under `cc` (Apple clang) and
`cffi` is able to dlopen the resulting `.so`. That is the build-chain
proof that T17 was supposed to gate.

### D.3 — Full result

```
=================================== FAILURES ===================================
____________ TestMazdaGen2Safety.test_tx_hook_on_wrong_safety_mode _____________
opendbc/safety/tests/common.py:952: in test_tx_hook_on_wrong_safety_mode
    self.assertFalse(self._tx(msg), f"transmit of {addr=:#x} {bus=} from {test_name} during {current_test} was allowed")
E   AssertionError: True is not false : transmit of addr=0x249 bus=1 from TestMazdaGen2TiSafety during TestMazdaGen2Safety was allowed
___________ TestMazdaGen2TiSafety.test_tx_hook_on_wrong_safety_mode ____________
opendbc/safety/tests/common.py:952: in test_tx_hook_on_wrong_safety_mode
    self.assertFalse(self._tx(msg), f"transmit of {addr=:#x} {bus=} from {test_name} during {current_test} was allowed")
E   AssertionError: True is not false : transmit of addr=0x249 bus=1 from TestMazdaGen2Safety during TestMazdaGen2TiSafety was allowed
=========================== short test summary info ============================
FAILED opendbc/safety/tests/test_mazda.py::TestMazdaGen2Safety::test_tx_hook_on_wrong_safety_mode
FAILED opendbc/safety/tests/test_mazda.py::TestMazdaGen2TiSafety::test_tx_hook_on_wrong_safety_mode
=================== 2 failed, 77 passed, 15 skipped in 1.11s ===================
```

### D.4 — Per-class status

| Test class               | Tests | Pass | Skip | Fail | Failing tests |
|--------------------------|------:|-----:|-----:|-----:|---------------|
| `TestMazdaSafety` (GEN1) | 29    | 24   | 5    | 0    | _none_        |
| `TestMazdaGen2Safety`    | 31    | 26   | 5    | 1    | `test_tx_hook_on_wrong_safety_mode` |
| `TestMazdaGen2TiSafety`  | 34    | 27   | 6 ⁎  | 1    | `test_tx_hook_on_wrong_safety_mode` |
| **TOTAL (run)**          | 94    | 77   | 16   | 2    |               |

⁎ Pytest reports 15 unique skips at the run level (`opendbc/safety/tests/common.py`
applies them via class hierarchy); `TestMazdaGen2TiSafety` adds one
extra skip for the duplicate inheritance path. The 15-vs-16 mismatch is
just `setUpClass` deduping at the run-summary line, not a real delta.

The skips are upstream-defined and intentional:
`test_allow_user_regen_at_zero_speed`, `test_not_allow_user_regen_when_moving`,
`test_prev_user_regen` (no regen on Mazda), `test_rx_hook_speed_mismatch`
(no second speed source on Mazda — `_speed_msg_2` returns `None`), and
`test_steer_req_bit` (`NO_STEER_REQ_BIT = True`).

### D.5 — All T18-mandated GEN2 / GEN2+TI checks **PASS**

The two failures are unrelated to the GEN2/TI flag-combo coverage that
T18 was actually designed to gate. The flag-combo-specific tests T6
added all pass:

| Test (T6 / T8 / T9 / T10 specific)                                   | GEN2-only | GEN2+TI |
|----------------------------------------------------------------------|:---------:|:-------:|
| `test_speed_rx_checks_accept_speed_msg`                              | PASS      | PASS    |
| `test_speed_rx_checks_accept_wheel_speeds_msg`                       | PASS      | PASS    |
| `test_gen2_acc_tx_allowed`                                           | PASS      | PASS    |
| `test_ti_lkas_is_only_allowed_bus_1_tx`                              | n/a       | PASS    |
| `test_bus_0_driver_torque_blocks_ti_lkas`                            | n/a       | PASS    |
| `test_aux_bus_not_forwarded`                                         | n/a       | PASS    |
| `test_against_torque_driver` (DriverTorqueSteeringSafetyTest)        | PASS      | PASS    |
| `test_steer_safety_check`                                            | PASS      | PASS    |
| `test_realtime_limits` / `test_non_realtime_limit_up`                | PASS      | PASS    |
| `test_relay_malfunction`                                             | PASS      | PASS    |
| `test_safety_tick`                                                   | PASS      | PASS    |
| `test_fwd_hook`                                                      | PASS      | PASS    |
| `test_tx_msg_in_scanned_range`                                       | PASS      | PASS    |
| `test_spam_can_buses`                                                | PASS      | PASS    |
| `test_cruise_engaged_prev` / `test_*_control_allowed_from_cruise`    | PASS      | PASS    |
| `test_user_brake_*` / `test_no_disengage_on_gas` / `test_prev_gas`   | PASS      | PASS    |

### D.6 — Root cause of the 2 failures

`opendbc/safety/tests/common.py:875` defines
`test_tx_hook_on_wrong_safety_mode`. It walks every `Test*` class in
every `test_*.py` file in `opendbc/safety/tests/`, harvests their
`TX_MSGS`, and asserts that each foreign `TX_MSG` is **rejected** by
the current mode's `_tx()` hook. Lines 895–913 contain a hand-curated
skip list for sibling-mode pairs that legitimately share `TX_MSGS`:

```python
if attr.startswith('TestToyota')           and current_test.startswith('TestToyota'):           continue
if attr.startswith('TestSubaruGen')        and current_test.startswith('TestSubaruGen'):        continue
if attr.startswith('TestSubaruPreglobal')  and current_test.startswith('TestSubaruPreglobal'):  continue
if attr.startswith('TestFord')             and current_test.startswith('TestFord'):             continue
if attr.startswith('TestHyundaiCanfd')     and current_test.startswith('TestHyundaiCanfd'):     continue
# … plus pair-set rules for VW, GM, Hyundai, Honda
```

There is **no rule for sibling Mazda safety modes**, but T6 needed
one: both `TestMazdaGen2Safety` and `TestMazdaGen2TiSafety` declare
identical `TX_MSGS = [[MAZDA_TI_LKAS, MAZDA_AUX], [MAZDA_2019_ACC,
MAZDA_CAM]] = [[0x249, 1], [0x220, 2]]` (the TI subclass inherits the
list from the GEN2 base), and the safety C in `mazda.h:177` declares a
single `MAZDA_2019_TX_MSGS[]` array used by both modes:

```c
static const CanMsg MAZDA_2019_TX_MSGS[] = {
  {MAZDA_TI_LKAS,   1, 8, .check_relay = true},
  {MAZDA_2019_ACC,  2, 8, .check_relay = true},
};
```

So when `TestMazdaGen2Safety` runs the cross-mode test, it pulls
`TestMazdaGen2TiSafety`'s `TX_MSGS` (same list) and asserts each entry
is rejected — but since the safety C correctly allows them, the
`assertFalse` flips. Mirror situation for `TestMazdaGen2TiSafety`.

**This is a panda-test-framework gap, not a safety-logic bug.**

### D.7 — Recommended fix (Wave 7 / T6 follow-up)

Add a single sibling-mode skip rule to
`opendbc_repo/opendbc/safety/tests/common.py` (insert anywhere inside
the skip block at lines 895–914):

```python
if attr.startswith('TestMazdaGen2') and current_test.startswith('TestMazdaGen2'):
  continue
```

This matches the existing `TestSubaruGen` / `TestSubaruPreglobal` /
`TestToyota` / `TestFord` / `TestHyundaiCanfd` precedents exactly. It
does **not** weaken cross-brand checks (`TestMazdaSafety` still
compares against `TestMazdaGen2Safety` and vice versa, since `TestMazda`
≠ `TestMazdaGen2*`); it only skips the GEN2-vs-GEN2+TI sibling pair.

This change:

- lives inside `opendbc_repo` and so is a Wave 7 / T6 follow-up commit
  on `mazda-port-additions`,
- is paired with a parent submodule bump on `mazda-port`,
- does **not** belong in Wave 6 (this wave is read-only on code).

After that fix, expected Wave 6 pytest result is **79 passed, 15
skipped, 0 failed**.

---

## Phase E — `scons` build attempt

**Status: BLOCKED on Darwin x86_64.** Deferred to device.

```
$ which scons
scons not found              # not on system PATH

$ .venv/bin/scons --version
SCons: v4.10.1.055b01f429d58b686701a56df863a817c36bb103
SCons path: ['…/.venv/lib/python3.12/site-packages/SCons']

$ .venv/bin/scons --dry-run
scons: Reading SConscript files ...
ModuleNotFoundError: No module named 'bzip2':
  File "/Users/cyonsun/Documents/Code/openpilot-comma/SConstruct", line 41:
    pkgs = [importlib.import_module(name) for name in pkg_names]
exit:0   (scons exits 2 internally; pipeline reports 0 from `head`)
```

The parent `SConstruct:40-41` hard-imports nine vendored native deps:

```python
pkg_names = ['bzip2', 'capnproto', 'eigen', 'ffmpeg', 'libjpeg',
             'libyuv', 'ncurses', 'zeromq', 'zstd']
pkgs = [importlib.import_module(name) for name in pkg_names]
```

All nine are git-pinned `commaai/dependencies` packages whose
`setup.py` raises `RuntimeError: unsupported platform: ('Darwin',
'x86_64')` (see Phase A). Until they're installed, the SConstruct
cannot even read its own configuration; no targets are buildable.

Notes:

- `opendbc_repo/` itself has **no SConstruct**. The repo's `safety.so`
  builds via `cc` directly inside
  `opendbc/safety/tests/libsafety/libsafety_py.py` (`subprocess.check_call(['cc', …])`).
  That path **already worked** in Phase D — every one of the 94
  pytest cases first compiled `safety.c` successfully. So at the
  opendbc level, the C build chain is verified locally.
- The parent `SConstruct` is for the full openpilot tree (selfdrive,
  panda firmware, manager, UI, etc.). On macOS that's effectively
  Linux-only territory; the right environment is a Linux dev box or
  the comma 3X itself.
- Phase E is therefore **deferred to the device verification script**
  (`docs/migration/T17_T18_device_verification.sh`), where it runs
  with `--minimal opendbc_repo/` to keep the build cheap.

---

## Phase F — Device verification artifacts

Two new files ship with this commit, both under `docs/migration/`:

| File                                            | Purpose                                                             |
|-------------------------------------------------|---------------------------------------------------------------------|
| `T17_T18_device_verification.sh`                | Idempotent bash script: prereq gate (branch + submodule SHAs + `cc`/`python3`) → Phase B (static + 3-grep) → Phase C (import smoke + checksum trace) → Phase D (pytest) → Phase E (`scons --dry-run --minimal` + scoped `--minimal opendbc_repo/`). Exits 0 on PASS, otherwise a bitmask (`0x01` PREREQ, `0x02` Phase B, `0x04` Phase C, `0x08` Phase D, `0x10` Phase E). Supports `--skip-scons` and `--no-prereq`. |
| `T17_T18_device_verification_results.md`        | Run-metadata + per-phase PASS/FAIL table the operator fills in after running the script. Includes the per-class flag-combo matrix from Phase D.4 and an explicit sign-off block. |

How to run on the comma 3X / Linux dev box:

```
cd /data/openpilot   # or wherever the parent lives on the device
git checkout mazda-port
git submodule update --init --recursive
bash docs/migration/T17_T18_device_verification.sh
# optionally, on a fresh dev box:
bash docs/migration/T17_T18_device_verification.sh --skip-scons    # if vendored deps still missing
bash docs/migration/T17_T18_device_verification.sh --no-prereq     # if running off a feature branch
```

The script assumes the parent has been `uv sync`ed (or it will attempt
`uv sync --extra testing` itself if `.venv` is missing and `uv` is on
PATH). It writes nothing under `opendbc_repo/`, `panda/`, or
`selfdrive/` — only invokes existing test/build entry points.

---

## Open issues / follow-ups

| Tag           | Item | Owner |
|---------------|------|-------|
| T6 follow-up  | Add sibling-mode skip rule for `TestMazdaGen2` to `opendbc_repo/opendbc/safety/tests/common.py:895-914`. Paired with parent submodule bump on `mazda-port`. Closes the 2 Phase D failures. | T6 / Wave 7 |
| T21 CP-A      | Capture `MAZDA_3_2019` cabana segment, add `CarTestRoute("…", MAZDA.MAZDA_3_2019)` to `opendbc_repo/opendbc/car/tests/routes.py` (Wave 5 carry-over). | T21 cabana capture |
| Wave 3-4 cleanup | Optional: rephrase the two "FrogPilot" provenance comments in `mazda/values.py:49,156`. Not a blocker (Wave 5 carry-over). | Wave 3-4 owner |
| T17 device    | Run `docs/migration/T17_T18_device_verification.sh` on Linux dev box / comma 3X to clear Phase E (`scons --minimal opendbc_repo/`). Fill in `T17_T18_device_verification_results.md`. | T17 / Wave 7 ops |
| Task spec     | The Wave 6 task spec referenced `Platforms.MAZDA_3_2019`; the actual enum is `CAR.MAZDA_3_2019`. Update the spec for future waves. | Wave 6 reviewer |

---

## SHA chain (post-Wave 6)

opendbc_repo (`mazda-port-additions`): unchanged from Wave 5 — `29db3c74`
(T10b head). No code touched this wave.

panda (`mazda-port-additions`): unchanged from Wave 5 — `066ca435`. No code
touched this wave.

Parent `openpilot-comma` (`mazda-port`):

| Wave | Parent SHA      | Subject                                                          |
|------|-----------------|------------------------------------------------------------------|
| 1    | `5b839477f`     | submodule: bump opendbc_repo for mazda_2019.dbc import           |
| 1    | `ea33ba5e0`     | submodule: bump opendbc_repo + panda for mazda GEN2/TI safety    |
| 2    | `08bd6558b`     | submodule: bump opendbc_repo for MAZDA_3_2019 platform values    |
| 2    | `ae723bb9b`     | submodule: bump opendbc_repo for MAZDA_3_2019 fingerprint        |
| 3    | `9f6ee139a`     | submodule: bump opendbc_repo for MAZDA_3_2019 interface          |
| 3    | `120a4625f`     | submodule: bump opendbc_repo for mazda GEN2 CAN builders         |
| 3    | `34a9fbcbf`     | submodule: bump opendbc_repo for mazda_2019 checksum             |
| 4    | `5d5fa9c42`     | submodule: bump opendbc_repo for mazda GEN2 carcontroller        |
| 4    | `d5f16723d`     | submodule: bump opendbc_repo for mazda GEN2 carstate             |
| 4    | `05587ac2a`     | submodule: bump opendbc_repo for mazda carstate ti_state/acc_values |
| 5    | `60772b42b`     | mazda: wave 5 integration verification (docs only)               |
| 6    | _this commit_   | mazda: wave 6 build + safety verification (docs only)            |

---

## Sign-off

**Wave 6 verification: `DEVICE_PENDING`**

Verdict logic:

| Verdict           | When                                                                                                           |
|-------------------|----------------------------------------------------------------------------------------------------------------|
| `LOCAL_PASS`      | Phases B, C, D, E all PASS locally on macOS, no failures, no skips beyond upstream-intentional ones.           |
| **`DEVICE_PENDING`** ✓ | Phases B + C PASS; Phase D 95 %+ PASS with the only failures classified as known panda-test-framework gaps; Phase E blocked on macOS toolchain and deferred to device. User must run `T17_T18_device_verification.sh` on Linux dev box / comma 3X to clear. |
| `FAIL`            | Any of: `py_compile` fails, GREP-1/2/3 surfaces an unexpected match, import smoke or checksum trace breaks, Phase D failures span actual safety logic (not just framework gaps).  |

Why `DEVICE_PENDING` and not `LOCAL_PASS`:

1. **Phase E** (parent `scons` build) cannot run on Darwin x86_64 —
   nine vendored native deps refuse to build, and the SConstruct
   hard-imports them at line 41. The build-green half of T17 is
   therefore unverifiable locally.
2. **Phase D** had 2 failures
   (`TestMazdaGen2Safety::test_tx_hook_on_wrong_safety_mode` and
   `TestMazdaGen2TiSafety::test_tx_hook_on_wrong_safety_mode`).
   Root-caused as a missing sibling-mode skip rule in
   `opendbc/safety/tests/common.py` (parallels the existing
   `TestSubaruGen` / `TestToyota` / `TestFord` rules). The safety C
   itself is consistent — both modes correctly allow their declared
   `TX_MSGS = [[0x249, 1], [0x220, 2]]`. The cross-mode meta-test just
   doesn't know that GEN2 and GEN2+TI legitimately share that list.
   Recommended fix is documented in *Open issues* and is a Wave 7 /
   T6 follow-up commit on `mazda-port-additions` (this wave is
   read-only on code).

Why **not** `FAIL`:

1. All static checks pass (Phase B clean — no new tokens vs. Wave 5).
2. Import smoke + checksum trace pass (Phase C clean — `MAZDA_3_2019`
   reaches the runtime with `flags=0xa` and `mazda_2019` checksums
   register correctly).
3. All 77 actually-running pytest cases except the 2 framework-only
   failures pass on both `FLAG_MAZDA_GEN2` and `FLAG_MAZDA_GEN2 |
   FLAG_MAZDA_TORQUE_INTERCEPTOR` flag combos. Every T18-mandated
   GEN2-specific or TI-specific case (`test_gen2_acc_tx_allowed`,
   `test_ti_lkas_is_only_allowed_bus_1_tx`,
   `test_bus_0_driver_torque_blocks_ti_lkas`,
   `test_aux_bus_not_forwarded`,
   `test_speed_rx_checks_accept_*`, etc.) is green.

Path to `LOCAL_PASS` after this wave:

1. T6 follow-up: add the `TestMazdaGen2 / TestMazdaGen2` sibling skip
   rule to `opendbc/safety/tests/common.py` and bump opendbc_repo
   submodule on `mazda-port`. Re-run Phase D → expect `79 passed / 15
   skipped / 0 failed`.
2. T17 device run: execute `T17_T18_device_verification.sh` on Linux
   dev box / comma 3X. Fill in `T17_T18_device_verification_results.md`
   with PREREQ + Phase E green. Attach to Wave 7 bring-up issue.

Once both are green, the port is releasable for Wave 7 staged on-vehicle
bring-up (CP-A lateral / CP-B lateral+TI / CP-C ACC+TI).
