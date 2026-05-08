# Wave 5 Integration Report — T14 + T15 + T16

Cross-cutting integration sign-off for the `MAZDA_3_2019` (GEN2 + Torque
Interceptor) port. This combined wave covers:

- **T14** — cross-cutting integration in parent `openpilot-comma`
- **T15** — forbidden-token global scrub on Mazda code
- **T16** — BlendedACC drop verification

Date: 2026-05-09  
Parent branch: `mazda-port`  
opendbc_repo branch: `mazda-port-additions` @ `29db3c74` (T10b head)  
panda branch: `mazda-port-additions` @ `066ca435`  
Parent HEAD before this commit: `05587ac2a` (post T10b submodule bump)

> **T10b status:** landed on `mazda-port-additions` during this verification
> window (opendbc_repo `29db3c74`). The T15 matrix below was first run against
> the pre-T10b state (opendbc_repo `8773621e` / parent `d5f16723d`) and was
> then re-run against the post-T10b state — both runs are identical, see the
> *Post-T10b re-verification* subsection at the end of T15. T10b adds only
> in-tree `TI_STATE` references and `self.ti_state` / `self.acc_values`
> schema attributes; no new forbidden tokens.

---

## T14 — Cross-cutting integration

### T14.1 — `selfdrive/car/tests/routes.py`

**Status: DEFERRED to T21 CP-A.** No edit applied this wave.

The path the original task points at (`selfdrive/car/tests/routes.py`) does
not exist on the parent — modern openpilot has migrated the per-brand route
list into the opendbc submodule:

```
$ ls -la /Users/cyonsun/Documents/Code/openpilot-comma/selfdrive/car/tests/
total 88
drwxr-xr-x  9 cyonsun  staff    288 May  9 01:37 .
-rw-r--r--  1 cyonsun  staff      0 May  9 01:37 __init__.py
-rwxr-xr-x  1 cyonsun  staff    295 May  9 01:37 big_cars_test.sh
-rw-r--r--  1 cyonsun  staff   2604 May  9 01:37 test_car_interfaces.py
-rw-r--r--  1 cyonsun  staff   5973 May  9 01:37 test_cruise_speed.py
-rw-r--r--  1 cyonsun  staff    697 May  9 01:37 test_docs.py
-rw-r--r--  1 cyonsun  staff    131 May  9 01:37 test_models_segs.txt
-rw-r--r--  1 cyonsun  staff  20061 May  9 01:37 test_models.py

$ ls -la /Users/cyonsun/Documents/Code/openpilot-comma/opendbc
lrwxr-xr-x  1 cyonsun  staff  20 May  9 01:37 opendbc -> opendbc_repo/opendbc
```

`opendbc` is a symlink into the submodule, so the real
`opendbc/car/tests/routes.py` lives at
`opendbc_repo/opendbc/car/tests/routes.py` — which Wave 5 is forbidden to
modify (Wave 1-4 + T10b territory).

The source FrogPilot fork (`/Users/cyonsun/Documents/Code/openpilot-more/selfdrive/car/tests/routes.py`)
also has no `MAZDA_3_2019` row — its lines 286-291 carry only GEN1 Mazdas:

```
286  CarTestRoute("32a319f057902bb3|2020-04-27--15-18-58", MAZDA.MAZDA_CX5),
287  CarTestRoute("10b5a4b380434151|2020-08-26--17-11-45", MAZDA.MAZDA_CX9),
288  CarTestRoute("74f1038827005090|2020-08-26--20-05-50", MAZDA.MAZDA_3),
289  CarTestRoute("fb53c640f499b73d|2021-06-01--04-17-56", MAZDA.MAZDA_6),
290  CarTestRoute("f6d5b1a9d7a1c92e|2021-07-08--06-56-59", MAZDA.MAZDA_CX9_2021),
291  CarTestRoute("a4af1602d8e668ac|2022-02-03--12-17-07", MAZDA.MAZDA_CX5_2022),
```

So both preconditions for an in-wave edit fail: the file is read-only this
wave, and the route data isn't available to copy. Action item recorded for
T21 CP-A.

### T14.2 — `opendbc_repo/opendbc/car/values.py` (BRANDS / Platform union)

**Status: PASS.** No edit needed.

`MAZDA_3_2019` reaches the aggregate `PLATFORMS` union through the existing
brand import in `opendbc/car/values.py:9` (`from opendbc.car.mazda.values
import CAR as MAZDA`). T7 added the platform inside `mazda/values.py`:

```
$ grep -nE 'MAZDA_3_2019' /Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo/opendbc/car/mazda/values.py
28:      # GEN2 limits (e.g., MAZDA_3_2019); ported from source fork's MAZDA_3_2019 path
88:  # Gen 2 hardware (e.g., MAZDA_3_2019): different DBC, larger steer envelope, different camera protocol
129:  MAZDA_3_2019 = MazdaPlatformConfig(
```

AST sanity check:

```
$ python3 -c "import ast; src=open('opendbc_repo/opendbc/car/mazda/values.py').read(); tree=ast.parse(src); ..."
classes: ['CarControllerParams', 'MazdaCarDocs', 'MazdaCarSpecs', 'MazdaFlags', 'MazdaPlatformConfig', 'CAR', 'LKAS_LIMITS', 'Buttons', 'TI_STATE']
MAZDA_3_2019 in source: True
```

`py_compile` clean for both `mazda/values.py` and `car/values.py`:

```
$ python3 -m py_compile opendbc_repo/opendbc/car/mazda/values.py && echo OK
py_compile mazda/values.py: OK
$ python3 -m py_compile opendbc_repo/opendbc/car/values.py && echo OK
py_compile car/values.py: OK
```

The full `python3 -c "from opendbc.car.values import PLATFORMS; ..."` import
check was substituted with `py_compile` because the runtime import requires
numpy (not installed here); `py_compile` is sufficient to confirm the
brand wiring is syntactically intact.

### T14.3 — `opendbc_repo/opendbc/car/docs_definitions.py`

**Status: PASS.** No edit needed — Mazda harness entry pre-existed upstream.

```
$ grep -n -i 'mazda' /Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo/opendbc/car/docs_definitions.py
139:  mazda = BaseCarHarness("Mazda connector")
```

GEN2 `MAZDA_3_2019` reuses the same harness as the GEN1 Mazda lineup, so no
new entry was required.

### T14.4 — `cereal/car.capnp`

**Status: PASS.** No edit needed — `SafetyModel.mazda` already enumerated.

```
$ grep -nE 'mazda|safety' /Users/cyonsun/Documents/Code/openpilot-comma/cereal/car.capnp
...
616:    mazda @13;
...
```

T6's `MAZDA_GEN2` and `MAZDA_TI` safety variants reuse the existing
`SafetyModel.mazda` enum tag with the new panda flags
(`FLAG_MAZDA_GEN2`, `FLAG_MAZDA_TORQUE_INTERCEPTOR`).

### T14.5 — Migration log

**Status: APPLIED.** `docs/migration/integration_log.md` created with the
Wave 5 section (verified items, pending items, SHA chain). Co-located with
this report in `docs/migration/`.

---

## T15 — Forbidden-token global scrub

All greps run inside `opendbc_repo` working directory (paths below are
relative). Verbatim shell capture; trailing `exit:N` shows grep's exit
status (1 = no matches, 0 = matches found).

### GREP-1 — FrogPilot Python tokens

```
$ grep -nrE 'frogpilot_toggles|FrogPilot|fp_ret|FPCP' \
    opendbc/car/mazda/ opendbc/safety/modes/mazda.h opendbc/safety/tests/test_mazda.py
opendbc/car/mazda/values.py:49:  # Ported from FrogPilot source fork: selfdrive/car/__init__.py:112-131.
opendbc/car/mazda/values.py:156:  # selfdrive/car/mazda/values.py (FrogPilot). The 4-value layout reflects the
exit:0
```

**Verdict: PASS-WITH-NOTES (benign).** Two matches, both comment-only
provenance attributions — no `frogpilot_toggles`, no `fp_ret`, no `FPCP`,
no Python imports of FrogPilot-only modules. Context:

```
$ sed -n '45,55p' opendbc/car/mazda/values.py
def apply_ti_steer_torque_limits(apply_torque, apply_torque_last, driver_torque, LIMITS):
  # Alternate steer-torque limits used when a torque interceptor is installed.
  # Ported from FrogPilot source fork: selfdrive/car/__init__.py:112-131.
  # Kept Mazda-internal so we don't pollute opendbc.car.lateral with brand-specific helpers.
  ...

$ sed -n '152,160p' opendbc/car/mazda/values.py
class TI_STATE(IntEnum):
  # Torque-interceptor state machine values; ported verbatim from source fork
  # selfdrive/car/mazda/values.py (FrogPilot). The 4-value layout reflects the
  # actual TI firmware protocol used by the source codebase.
  DISCOVER = 0
  OFF = 1
  DRIVER_OVER = 2
```

These are documentation-only annotations explaining the source of the
ported helpers. They are analogous to the `CarControllerParams(` false
positive called out in the task decision matrix — a string match without
a functional dependency. Wave 3-4 owner may rephrase if a comment-level
scrub is desired; they do not block Wave 5 sign-off and they do not live
in this commit's scope (forbidden to touch opendbc Mazda Python here).

### GREP-2 — `/dev/shm` reads in Mazda Python

```
$ grep -nrE '/dev/shm' opendbc/car/mazda/
exit:1
```

**Verdict: PASS.** No matches.

### GREP-3 — Dropped feature tokens

```
$ grep -nrE 'BlendedACC|CEStatus|ManualTransmission|TorqueInterceptorEnabled|RadarInterceptorEnabled|NoMRCC|NoFSC' opendbc/car/mazda/
exit:1
```

**Verdict: PASS.** No matches. Confirms BlendedACC, CE/Manual/TI/Radar
toggle plumbing, and No-MRCC / No-FSC fallback flags have been fully
dropped from the Mazda Python module.

### GREP-4 — Anchored `Params(` constructions

```
$ grep -nE '(^|[^a-zA-Z_])Params\(' opendbc/car/mazda/*.py
exit:1
```

**Verdict: PASS.** No matches. The anchored regex excludes
`CarControllerParams(` (false-positive class) by requiring a
non-identifier character (or line start) before `Params(`. Confirms no
direct `Params()` reads were introduced anywhere in the Mazda module.

### GREP-5 — panda Mazda flags

```
$ grep -nE 'FLAG_MAZDA' /Users/cyonsun/Documents/Code/openpilot-comma/panda/python/__init__.py
147:  FLAG_MAZDA_GEN2 = 2
148:  FLAG_MAZDA_TORQUE_INTERCEPTOR = 8
exit:0
```

**Verdict: PASS.** Output is a strict subset of the allowed set
`{_GEN1, _GEN2, _TORQUE_INTERCEPTOR}` — only `_GEN2` and
`_TORQUE_INTERCEPTOR` (T6 additions) are present. `FLAG_MAZDA_GEN1` is
intentionally omitted because GEN1 is the implicit zero-flag default in
the Mazda safety C code (no Python flag needed). Surrounding context
confirms these are the only Mazda-related additions in the panda flag
section:

```
$ sed -n '140,155p' panda/python/__init__.py
  ...
  H7_DEVICES = [HW_TYPE_RED_PANDA, HW_TYPE_TRES, HW_TYPE_CUATRO, HW_TYPE_BODY]
  SUPPORTED_DEVICES = H7_DEVICES

  FLAG_MAZDA_GEN2 = 2
  FLAG_MAZDA_TORQUE_INTERCEPTOR = 8

  INTERNAL_DEVICES = (HW_TYPE_TRES, HW_TYPE_CUATRO)
  ...
```

### GREP-6 — `apply_ti_steer_torque_limits` confinement

```
$ grep -rn 'apply_ti_steer_torque_limits' opendbc/car/__init__.py
exit:1

$ grep -rn 'apply_ti_steer_torque_limits' opendbc/car/lateral.py
exit:1

$ grep -rn 'apply_ti_steer_torque_limits' opendbc/car/mazda/
opendbc/car/mazda/values.py:47:def apply_ti_steer_torque_limits(apply_torque, apply_torque_last, driver_torque, LIMITS):
opendbc/car/mazda/values.py:90:  # Torque interceptor add-on hardware (third-party); requires apply_ti_steer_torque_limits and TI state machine
Binary file opendbc/car/mazda/__pycache__/values.cpython-312.pyc matches
Binary file opendbc/car/mazda/__pycache__/carcontroller.cpython-312.pyc matches
opendbc/car/mazda/carcontroller.py:11:  apply_ti_steer_torque_limits,
opendbc/car/mazda/carcontroller.py:60:          ti_apply_torque = apply_ti_steer_torque_limits(ti_new_torque, self.ti_apply_torque_last,
exit:0
```

**Verdict: PASS.** The TI-specific steer-torque limit helper is absent
from the brand-agnostic `opendbc/car/__init__.py` and `opendbc/car/lateral.py`
modules, and present only in the Mazda module:

- `mazda/values.py:47` — definition (T7).
- `mazda/values.py:90` — comment reference inside `MazdaFlags`.
- `mazda/carcontroller.py:11` — import (T10).
- `mazda/carcontroller.py:60` — single call site, gated by
  `MazdaFlags.TORQUE_INTERCEPTOR` (T10).

(`__pycache__/*.pyc` matches are auto-generated bytecode mirrors of the
source matches above and are not part of the source tree.)

### T15 summary

| Check | Tokens | Verdict |
|-------|--------|---------|
| GREP-1 | `frogpilot_toggles\|FrogPilot\|fp_ret\|FPCP` | **PASS-WITH-NOTES** (2 benign provenance comments) |
| GREP-2 | `/dev/shm` | PASS |
| GREP-3 | `BlendedACC\|CEStatus\|ManualTransmission\|TorqueInterceptorEnabled\|RadarInterceptorEnabled\|NoMRCC\|NoFSC` | PASS |
| GREP-4 | anchored `Params\(` | PASS |
| GREP-5 | panda `FLAG_MAZDA*` (subset of `{_GEN1,_GEN2,_TORQUE_INTERCEPTOR}`) | PASS |
| GREP-6 | `apply_ti_steer_torque_limits` confined to `opendbc/car/mazda/` | PASS |

No real frogpilot leak found; commit gate is **not** blocked.

### Post-T10b re-verification

T10b (`ti_state` / `acc_values` exposure on the GEN2 `CarState`) landed on
`mazda-port-additions` during this verification window:

```
$ git -C opendbc_repo log -1 --format='%H %s' 29db3c74
29db3c74188ec27618b2202a8d57191bf72549a7 mazda: expose ti_state and acc_values from GEN2 carstate for carcontroller

$ git -C opendbc_repo show --stat --format='' 29db3c74
 opendbc/car/mazda/carstate.py | 25 +++++++++++++++++++++++++
 1 file changed, 25 insertions(+)
```

T10b touches only `opendbc/car/mazda/carstate.py` (+25 lines). Re-running the
T15 GREP-1..GREP-4 + GREP-6 matrix against the post-T10b state produced the
**same output** as the pre-T10b run — no new forbidden tokens introduced.
T10b's additions were a `TI_STATE` import (in-tree IntEnum from T7), default
instance attributes (`self.ti_state`, `self.acc_values`), a 4-MCU hall-state
collapse to `TI_STATE.RUN` / `TI_STATE.OFF`, and a `dict(cp.vl["ACC"])`
snapshot — all schema-level wiring, no frogpilot toggles, no `Params(`
reads, no `/dev/shm`, no BlendedACC.

```
$ grep -nrE 'frogpilot_toggles|FrogPilot|fp_ret|FPCP' \
    opendbc/car/mazda/ opendbc/safety/modes/mazda.h opendbc/safety/tests/test_mazda.py
opendbc/car/mazda/values.py:49:  # Ported from FrogPilot source fork: selfdrive/car/__init__.py:112-131.
opendbc/car/mazda/values.py:156:  # selfdrive/car/mazda/values.py (FrogPilot). The 4-value layout reflects the
exit:0       # IDENTICAL to pre-T10b run (only the 2 benign comments in values.py)

$ grep -nrE '/dev/shm' opendbc/car/mazda/
exit:1       # PASS

$ grep -nrE 'BlendedACC|CEStatus|ManualTransmission|TorqueInterceptorEnabled|RadarInterceptorEnabled|NoMRCC|NoFSC' opendbc/car/mazda/
exit:1       # PASS

$ grep -nE '(^|[^a-zA-Z_])Params\(' opendbc/car/mazda/*.py
exit:1       # PASS

$ grep -rn 'apply_ti_steer_torque_limits' opendbc/car/__init__.py opendbc/car/lateral.py
exit:1       # PASS — still confined to mazda/
```

**Post-T10b verdict: identical to pre-T10b. Wave 5 sign-off covers the
post-T10b state.**

---

## T16 — BlendedACC drop verification

### T16.1 — `selfdrive/controls/lib/longcontrol.py` diff

```
$ git -C /Users/cyonsun/Documents/Code/openpilot-comma diff master -- selfdrive/controls/lib/longcontrol.py
exit:0   (no output)

$ git -C /Users/cyonsun/Documents/Code/openpilot-comma diff --stat master -- selfdrive/controls/lib/longcontrol.py
   (no output)
```

**Verdict: PASS.** Zero diff against `master` — no Mazda-related changes
leaked into the longitudinal controller. This is the structural guarantee
that the dropped FrogPilot BlendedACC first-order filter has not been
silently re-introduced upstream of the brand controller.

### T16.2 — Tree-wide `BlendedACC` search

```
$ grep -rn 'BlendedACC' /Users/cyonsun/Documents/Code/openpilot-comma/selfdrive/
exit:1

$ grep -rn 'BlendedACC' /Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo/opendbc/car/mazda/
exit:1
```

**Verdict: PASS.** No matches anywhere in `selfdrive/` or in the Mazda
opendbc module. The token is fully gone from the integrated tree.

### T16.3 — `carcontroller.py` ACC behavior summary

The GEN2 ACC path in `opendbc_repo/opendbc/car/mazda/carcontroller.py`
(T10) computes `hold` and `resume` boolean flags from frame-counted
standstill / resume timers, then calls the CAN builder directly:

```
107:        can_sends.append(mazdacan.create_acc_cmd(self.packer, CS.acc_values, hold, resume))
```

The full GEN2 ACC region (lines 76-107) reads:

- frame counter for standstill (`self.standstill_frames`) at 100 Hz
- 50 Hz dispatch (`if self.frame % 2 == 0`)
- `hold` set when stopped past `HOLD_DELAY_FRAMES=50` (0.5 s) and within
  `HOLD_DURATION_FRAMES=600` (6 s) — this is the brake-hold window
- `resume` armed for `RESUME_DURATION_FRAMES=50` (0.5 s) on driver
  override, gas press, planner `starting`, explicit `pcm.cruiseControl.resume`,
  or stock ACC's own RESUME bit
- `mazdacan.create_acc_cmd(self.packer, CS.acc_values, hold, resume)` —
  passes the OP-computed accel and the two booleans along with the raw
  stock `acc_values` dict; the CAN builder packs the bytes without any
  filter

There is **no first-order low-pass filter** on the OP accel, **no
blending coefficient** between the planner accel and a stock MRCC accel,
and **no `BlendedACC` reference**. This matches orchestrator decision D5
(BlendedACC dropped). If GEN2 ACC behavior on-vehicle warrants
re-introduction, per D5 it must be added strictly inside this
`carcontroller.py`, never in `selfdrive/controls/lib/longcontrol.py`.

**Verdict: PASS.**

---

## Open issues / follow-ups for T17 / T21

| Tag | Item | Owner |
|-----|------|-------|
| T21 CP-A | Capture `MAZDA_3_2019` cabana segment and add a `CarTestRoute(...)` line to `opendbc_repo/opendbc/car/tests/routes.py` (Mazda block, after line 340). The commit lands in opendbc_repo on `mazda-port-additions`; pair with a parent submodule bump on `mazda-port`. | T21 cabana capture |
| T10b | ~~`ti_state` / `acc_values` exposure on the `CarState` schema~~ — LANDED at opendbc_repo `29db3c74` during this verification window; T15 was re-run post-T10b and is identical (see *Post-T10b re-verification*). Closes this row. | _closed_ |
| Wave 3-4 cleanup | Optional: rephrase the two "FrogPilot" provenance comments in `mazda/values.py:49,156` if the project prefers no fork-name references in source. Not a blocker. | Wave 3-4 owner |
| T17 build | First scons / py_compile on parent after T10b lands; mypy / linter pass; dry-run `python3 -c "from opendbc.car.values import PLATFORMS; assert any('MAZDA_3_2019' in str(p) for p in PLATFORMS)"` once numpy is available. | T17 build |
| T18 panda safety tests | Verify `tests/test_mazda.py` exercises both `FLAG_MAZDA_GEN2` and `FLAG_MAZDA_TORQUE_INTERCEPTOR` paths after T10b. | T18 |

---

## Sign-off

**Wave 5 integration: PASS-WITH-NOTES**

Notes:
1. T14.1 routes.py entry deferred to T21 CP-A — neither the path the
   original task referenced (`selfdrive/car/tests/routes.py`) exists on
   the parent, nor is the route data available in the source fork. The
   real `routes.py` lives in the opendbc submodule, which Wave 5 cannot
   modify.
2. T15 GREP-1 surfaced two comment-only "FrogPilot" provenance references
   in `opendbc/car/mazda/values.py` (lines 49, 156). Verdict: benign
   (documentation-only; no functional dependency). Cleanup is optional
   and out-of-scope for Wave 5.
3. T10b landed during the Wave 5 verification window. Both the pre-T10b
   T15 grep matrix (run against opendbc_repo `8773621e` / parent
   `d5f16723d`) and the post-T10b re-run (against opendbc_repo `29db3c74`
   / parent `05587ac2a`) are identical — T10b adds only schema-level
   `TI_STATE` / `self.ti_state` / `self.acc_values` plumbing, no new
   forbidden tokens. Wave 5 sign-off covers the post-T10b state.

All structural T16 checks (zero longcontrol.py diff, zero `BlendedACC`
matches in `selfdrive/`, no first-order filter in carcontroller GEN2 ACC
path) are clean. Wave 5 is releasable as documentation-only.
