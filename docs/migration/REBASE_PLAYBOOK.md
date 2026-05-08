# Mazda GEN2+TI2 Fork — Rebase Playbook

**For:** Stressed-user pulling in a new upstream openpilot release 6-12 months from now.  
**Scope:** 3-repo rebase of `mazda-port` / `mazda-port-additions` onto a new commaai/openpilot master.  
**Recovery point:** `mazda-port-v0.1` annotated tags in all three repos.

---

## Pre-Rebase Checklist

Run this before touching anything:

```bash
# Check all three repos are clean
git -C /Users/cyonsun/Documents/Code/openpilot-comma status --short
git -C /Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo status --short
git -C /Users/cyonsun/Documents/Code/openpilot-comma/panda status --short
# Expected: nothing (or only the 4 pre-existing untracked Wave 1 cheat sheets in parent)

# Confirm recovery tags exist
git -C /Users/cyonsun/Documents/Code/openpilot-comma tag -l 'mazda-port-*'
git -C /Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo tag -l 'mazda-port-*'
git -C /Users/cyonsun/Documents/Code/openpilot-comma/panda tag -l 'mazda-port-*'
# Expected: mazda-port-v0.1 in each

# Create dated backup branches (do this every time)
DATE=$(date +%Y%m%d)
git -C /Users/cyonsun/Documents/Code/openpilot-comma checkout -b mazda-port-backup-$DATE mazda-port
git -C /Users/cyonsun/Documents/Code/openpilot-comma checkout mazda-port
git -C /Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo checkout -b mazda-port-additions-backup-$DATE mazda-port-additions
git -C /Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo checkout mazda-port-additions
git -C /Users/cyonsun/Documents/Code/openpilot-comma/panda checkout -b mazda-port-additions-backup-$DATE mazda-port-additions
git -C /Users/cyonsun/Documents/Code/openpilot-comma/panda checkout mazda-port-additions

# Note current HEADs
git -C /Users/cyonsun/Documents/Code/openpilot-comma rev-parse HEAD
git -C /Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo rev-parse HEAD
git -C /Users/cyonsun/Documents/Code/openpilot-comma/panda rev-parse HEAD
```

All green? Proceed. Any repo dirty? Stash or commit first.

---

## Step-by-Step Rebase Commands

**Order matters.** Do opendbc_repo and panda before the parent, because the parent's submodule pointers depend on the submodule SHAs.

### Step 1: opendbc_repo

```bash
cd /Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo
git fetch origin
git checkout mazda-port-additions
git rebase origin/master
```

If conflicts appear, see the conflict recipes below. After resolving:

```bash
# Quick sanity check
python3 -m py_compile opendbc/car/mazda/values.py opendbc/car/mazda/interface.py \
  opendbc/car/mazda/carstate.py opendbc/car/mazda/carcontroller.py \
  opendbc/car/mazda/mazdacan.py opendbc/car/mazda/fingerprints.py
# Must exit 0 with no output
```

### Step 2: panda

```bash
cd /Users/cyonsun/Documents/Code/openpilot-comma/panda
git fetch origin
git checkout mazda-port-additions
git rebase origin/master
```

Conflicts here are rare. The only Mazda commit is `066ca435` (flag constants). If upstream added new Mazda flags, check for value collisions with `FLAG_MAZDA_GEN2=2` and `FLAG_MAZDA_TORQUE_INTERCEPTOR=8`.

### Step 3: openpilot-comma parent

```bash
cd /Users/cyonsun/Documents/Code/openpilot-comma
git fetch origin
git checkout mazda-port
git rebase origin/master
```

Submodule pointer conflicts are the most common issue here. For each conflict:

```bash
# When git stops with a submodule conflict:
git status   # shows "both modified: opendbc_repo" or "both modified: panda"

# Accept the rebased submodule SHA (the one you just rebased in steps 1-2)
git add opendbc_repo panda
git rebase --continue
```

If there are multiple submodule-bump commits in the rebase, you may need to resolve this several times. Each time: `git add opendbc_repo panda && git rebase --continue`.

---

## Conflict Resolution Recipes

### `opendbc/car/mazda/values.py`

**What to preserve (our additions):**
- `MAZDA_3_2019 = MazdaPlatformConfig(...)` — the entire platform block
- `MazdaFlags.GEN2 = 2` and `MazdaFlags.TORQUE_INTERCEPTOR = 8`
- `class TI_STATE(IntEnum)` with DISCOVER/OFF/DRIVER_OVER/RUN values
- `def apply_ti_steer_torque_limits(...)` function
- `NON_LINEAR_TORQUE_PARAMS = (4.6, 0.6, 0.134, 0.3605)` for MAZDA_3_2019
- GEN2-specific `CarControllerParams` (STEER_MAX=8000, etc.)

**Common upstream changes to adapt to:**
- If `MazdaPlatformConfig` was renamed: update our usage
- If `CarSpecs` fields changed: update our `CarSpecs(mass=..., wheelbase=..., steerRatio=...)` call
- If `TorqueSteeringLimits` fields changed: update our `CarControllerParams` block

### `opendbc/car/mazda/interface.py`

**What to preserve:**
- The `if candidate == CAR.MAZDA_3_2019:` block inside `_get_params`
- Sigmoid+linear lateral callback: `ret.lateralTuning.torque.useSteeringAngle = True` etc.
- `steerActuatorDelay = 0.335`, `steerLimitTimer = 0.8`, `longitudinalActuatorDelay = 0.35`

**Common upstream changes:**
- `_get_params` signature changes: adapt parameter list, keep body
- New mandatory `ret` fields: add them with sensible defaults for GEN2

### `opendbc/car/mazda/carstate.py`

**What to preserve:**
- `_update_gen2` method (or the GEN2 branch, however it's structured)
- `get_can_parsers` GEN2 branch: Bus.main, Bus.cam, Bus.aux parser lists
- `self.ti_state` and `self.acc_values` instance attributes
- `TI_FEEDBACK` (0x24A) parsing block
- `EPS_LKAS` (0x249) and `EPS_FEEDBACK` (0x24B) parsing

**Common upstream changes:**
- New `CarState` fields: add them to the GEN2 update path
- `Bus` enum changes: update bus references

### `opendbc/car/mazda/carcontroller.py`

**What to preserve:**
- GEN2 ACC path: `create_acc_cmd(self.packer, CS.acc_values, hold, resume)` on bus 2
- TI steering path: `create_steering_control_gen2(...)` gated by `MazdaFlags.TORQUE_INTERCEPTOR`
- Hold/resume timer logic (HOLD_DELAY_FRAMES=50, HOLD_DURATION_FRAMES=600, RESUME_DURATION_FRAMES=50)
- `ti_lkas_allowed` gate: `CS.ti_state == TI_STATE.RUN and not CS.ti_ramp_down`

### `opendbc/safety/modes/mazda.h`

**What to preserve:**
- `MAZDA_2019_TX_MSGS[]` array with `{0x249, 1}` and `{0x220, 2}`
- `mazda_2019_rx_checks[]` array
- `mazda_gen2_safety_hooks` and `mazda_gen2_ti_safety_hooks` structs
- `FLAG_MAZDA_GEN2` and `FLAG_MAZDA_TORQUE_INTERCEPTOR` handling in `mazda_init`

**Common upstream changes:**
- `BUILD_SAFETY_CFG` macro signature: adapt if arg count changed again
- New `CanMsg` fields: update our TX/RX arrays

### `opendbc/can/dbc.py`

**What to preserve:**
- `mazda2019_checksum` registration call

If the registration API changed, find the new pattern by looking at how another brand's checksum is registered and mirror it.

### `panda/python/__init__.py`

**What to preserve:**
- `FLAG_MAZDA_GEN2 = 2`
- `FLAG_MAZDA_TORQUE_INTERCEPTOR = 8`

Check for value collisions if upstream added new Mazda flags.

### `opendbc/safety/tests/common.py`

**What to preserve:**
- The sibling-mode skip rule (T18b):
  ```python
  if attr.startswith('TestMazdaGen2') and current_test.startswith('TestMazdaGen2'):
      continue
  ```

If upstream restructured the skip block, insert this rule in the equivalent location (inside the `test_tx_hook_on_wrong_safety_mode` skip list).

---

## Post-Rebase Verification

Run these in order. All must pass before you flash to the device.

```bash
# 1. py_compile all Mazda Python files
python3 -m py_compile \
  opendbc_repo/opendbc/car/mazda/values.py \
  opendbc_repo/opendbc/car/mazda/interface.py \
  opendbc_repo/opendbc/car/mazda/carstate.py \
  opendbc_repo/opendbc/car/mazda/carcontroller.py \
  opendbc_repo/opendbc/car/mazda/mazdacan.py \
  opendbc_repo/opendbc/car/mazda/fingerprints.py \
  opendbc_repo/opendbc/can/dbc.py
# Must exit 0

# 2. Import smoke + checksum trace
cd opendbc_repo
PYTHONPATH=. python3 -c "
from opendbc.car.mazda.values import CAR, MazdaFlags, TI_STATE, apply_ti_steer_torque_limits
from opendbc.car.mazda.interface import CarInterface
from opendbc.car.mazda.carstate import CarState
from opendbc.car.mazda.carcontroller import CarController
from opendbc.car.mazda.mazdacan import mazda2019_checksum
from opendbc.can.dbc import get_checksum_state
p = CAR.MAZDA_3_2019
flags = p.config.flags
assert flags & MazdaFlags.GEN2 and flags & MazdaFlags.TORQUE_INTERCEPTOR, f'flags={hex(flags)}'
state = get_checksum_state('mazda_2019')
assert state is not None
assert mazda2019_checksum(0x220, None, bytearray([1,2,3,4,5,6,7])) == 0x46
assert mazda2019_checksum(0x249, None, bytearray([0]*7)) == 0x53
print('OK flags=', hex(flags))
"
# Must print: OK flags= 0xa

# 3. Safety pytest
python3 -m pytest opendbc/safety/tests/test_mazda.py -v \
  --rootdir=. --confcutdir=. -o addopts= --tb=short
# Must show: 79 passed, 15 skipped, 0 failed

# 4. Forbidden-token scrub
grep -nrE 'frogpilot_toggles|FrogPilot|fp_ret|FPCP' \
  opendbc/car/mazda/ opendbc/safety/modes/mazda.h
# Allowed: the 2 benign provenance comments in values.py:49,156
# Not allowed: any functional code

grep -nrE 'BlendedACC|CEStatus|ManualTransmission|TorqueInterceptorEnabled' \
  opendbc/car/mazda/
# Must exit 1 (no matches)

grep -nE '(^|[^a-zA-Z_])Params\(' opendbc/car/mazda/*.py
# Must exit 1 (no matches)

# 5. Device verification (on Linux dev box or comma 3X)
cd ..
bash docs/migration/T17_T18_device_verification.sh
```

After device verification passes, re-run CP-A from `T21_onvehicle_bringup_checklist.md` before returning to daily use.

---

## Decision Tree: When Things Go Wrong

```
Rebase conflict in opendbc_repo?
  -> Is it in opendbc/car/mazda/?
       YES -> Use conflict recipes above. Preserve our GEN2+TI additions.
       NO  -> Accept upstream version (it's not our code).

Rebase conflict in panda?
  -> Is it in python/__init__.py near FLAG_MAZDA_*?
       YES -> Preserve FLAG_MAZDA_GEN2=2 and FLAG_MAZDA_TORQUE_INTERCEPTOR=8.
              Check for value collisions with any new upstream Mazda flags.
       NO  -> Accept upstream version.

Rebase conflict in parent (openpilot-comma)?
  -> Is it a submodule pointer conflict?
       YES -> git add opendbc_repo panda && git rebase --continue
       NO  -> Is it in docs/migration/?
              YES -> Keep our docs, accept upstream changes elsewhere.
              NO  -> Accept upstream version.

py_compile fails after rebase?
  -> Find the syntax error. It's almost certainly a merge artifact
     (stray conflict marker or mismatched indent). Fix it, re-run.

Import smoke fails after rebase?
  -> Run with -v to see which import fails.
  -> If CAR.MAZDA_3_2019 missing: values.py conflict resolution was wrong.
  -> If mazda2019_checksum missing: dbc.py registration was lost.
  -> If flags != 0xa: MazdaFlags values changed or conflict resolution wrong.

Safety pytest shows failures beyond the 15 expected skips?
  -> If test_tx_hook_on_wrong_safety_mode fails: T18b skip rule was lost.
     Re-add it to common.py.
  -> If other GEN2/TI tests fail: safety C conflict resolution was wrong.
     Check mazda.h TX_MSGS and rx_checks arrays.

Everything passes locally but car not recognized on device?
  -> Fingerprint mismatch. Run auto_fingerprint.py on device.
  -> Extend fingerprints.py with your actual FW versions.
  -> Commit to mazda-port-additions, bump submodule in parent.

Rebase is completely broken and you want to start over?
  -> git rebase --abort   (in whichever repo is mid-rebase)
  -> git reset --hard mazda-port-v0.1   (or mazda-port-additions-backup-<date>)
  -> Start again from the pre-rebase checklist.
```

---

## After a Successful Rebase

1. Create a new recovery tag in all three repos:
   ```bash
   DATE=$(date +%Y%m%d)
   git -C opendbc_repo tag -a mazda-port-v0.2-$DATE -m "post-rebase onto upstream $DATE"
   git -C panda tag -a mazda-port-v0.2-$DATE -m "post-rebase onto upstream $DATE"
   git tag -a mazda-port-v0.2-$DATE -m "post-rebase onto upstream $DATE"
   ```

2. Run CP-A from `T21_onvehicle_bringup_checklist.md` before returning to daily use. A new upstream driving model may change lateral feel even if the code is identical.

3. Update `NON_LINEAR_TORQUE_PARAMS` if the new World Model produces oscillation. Start by reducing `a` (currently 4.6) by 10-15%.

---

*Rebase playbook — Wave 8 / T22. Recovery tags: `mazda-port-v0.1` in all 3 repos.*
