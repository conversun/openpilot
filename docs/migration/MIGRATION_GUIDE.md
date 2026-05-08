# Mazda 3 2019+ GEN2 + TI2 Port — Migration Guide

**Version:** v0.1  
**Date:** 2026-05-09  
**Scope:** Mazda 3 2019+ (GEN2 hardware) with Torque Interceptor 2 (TI2) add-on, ported to openpilot v0.11+ (commaai/openpilot upstream architecture). Single platform: `MAZDA_3_2019`. GEN1 platforms untouched.

---

## Executive Summary

This port migrates the `MAZDA_3_2019` (GEN2 + TI2) car implementation from a FrogPilot-based fork (`openpilot-more/mazda-frogpilot`) to the current commaai/openpilot upstream architecture across three repositories: `openpilot-comma`, `opendbc_repo`, and `panda`. The migration required absorbing 12 distinct architecture changes (see section 5). All code is complete and verified locally (79/0 panda safety pytest, import smoke, static scrub). On-vehicle validation (CP-A lateral, CP-B TI, CP-C ACC) is the only remaining gate before daily use. Current status: **code-complete, LOCAL_PASS, awaiting on-vehicle CP-A**.

---

## The 8 Waves at a Glance

| Wave | Tasks | Output | Sign-off |
|------|-------|--------|----------|
| 1 | T1-T4 | 4 cheat sheets in docs/migration/ | PASS |
| 2 | T5-T7 | DBC + safety + values | PASS |
| 3 | T8/T9/T12 | interface + mazdacan + fingerprints | PASS |
| 4 | T9b/T10/T11 | checksum + carstate + carcontroller | PASS |
| 4.5 | T10b | ti_state + acc_values exposure | PASS |
| 5 | T14-T16 | integration + scrub | PASS-WITH-NOTES |
| 6 | T17/T18 | build + safety pytest | LOCAL_PASS (post-T18b) |
| 7 | T18b/T21-docs | test framework fix + bring-up runbook | PASS |
| 8 | T22 | maintenance + release | PASS (this doc) |

Wave 5 PASS-WITH-NOTES: two benign FrogPilot provenance comments in `values.py` (lines 49, 156) and the `routes.py` entry deferred to T21 CP-A. Neither blocks the port.

---

## Complete Commit Chain

### openpilot-comma — branch `mazda-port`

| SHA | Wave | Subject |
|-----|------|---------|
| `5b839477f` | 1 | submodule: bump opendbc_repo for mazda_2019.dbc import |
| `ea33ba5e0` | 1 | submodule: bump opendbc_repo + panda for mazda GEN2/TI safety |
| `08bd6558b` | 2 | submodule: bump opendbc_repo for MAZDA_3_2019 platform values |
| `ae723bb9b` | 2 | submodule: bump opendbc_repo for MAZDA_3_2019 fingerprint |
| `9f6ee139a` | 3 | submodule: bump opendbc_repo for MAZDA_3_2019 interface |
| `120a4625f` | 3 | submodule: bump opendbc_repo for mazda GEN2 CAN builders |
| `34a9fbcbf` | 3 | submodule: bump opendbc_repo for mazda_2019 checksum |
| `5d5fa9c42` | 4 | submodule: bump opendbc_repo for mazda GEN2 carcontroller |
| `d5f16723d` | 4 | submodule: bump opendbc_repo for mazda GEN2 carstate |
| `05587ac2a` | 4.5 | submodule: bump opendbc_repo for mazda carstate ti_state/acc_values |
| `60772b42b` | 5 | mazda: wave 5 integration verification |
| `66954064b` | 6 | mazda: wave 6 build + safety verification |
| `55389aaa6` | 7 | submodule: bump opendbc_repo for mazda safety test skip rule |
| `3dacf62c7` | 7 | mazda: wave 7 on-vehicle bring-up checklist + cabana capture |

HEAD at Wave 8 start: `3dacf62c7`

### opendbc_repo — branch `mazda-port-additions`

| SHA | Wave | Task | Subject |
|-----|------|------|---------|
| `5907cdff` | 1 | T5 | mazda: import mazda_2019.dbc for GEN2 + TI support |
| `cbd0b05f` | 1 | T6 | mazda: add GEN2 + TI safety variants |
| `eec92469` | 2 | T7 | mazda: add MAZDA_3_2019 platform with GEN2 + TI flags + TI helpers |
| `b83079d7` | 2 | T12 | mazda: add MAZDA_3_2019 FW fingerprint |
| `0fa112e7` | 3 | T8 | mazda: extend interface.py for MAZDA_3_2019 (GEN2 + TI) |
| `9f08c38f` | 3 | T9 | mazda: add GEN2 EPS_LKAS + TI + ACC CAN builders |
| `e8ccc24e` | 3 | T9b | opendbc/can: add mazda_2019 checksum support |
| `eaeb4c51` | 4 | T10 | mazda: extend carcontroller.py for MAZDA_3_2019 (GEN2 ACC + TI steering) |
| `8773621e` | 4 | T11 | mazda: extend carstate.py for MAZDA_3_2019 (GEN2 + TI feedback) |
| `29db3c74` | 4.5 | T10b | mazda: expose ti_state and acc_values from GEN2 carstate for carcontroller |
| `32716d8a` | 7 | T18b | safety/tests: skip wrong-safety-mode TX cross-tests for Mazda GEN2 sibling variants |

HEAD at Wave 8 start: `32716d8a`

### panda — branch `mazda-port-additions`

| SHA | Wave | Task | Subject |
|-----|------|------|---------|
| `066ca435` | 1 | T6 | mazda: add GEN2 + TI flag constants and ignition addr |

HEAD at Wave 8 start: `066ca435`

---

## Architecture Deltas Absorbed

The source fork (`openpilot-more/mazda-frogpilot`) was built on an older openpilot architecture. The upstream had moved on in 12 ways that required active porting work:

| Delta | Old (source fork) | New (upstream) |
|-------|-------------------|----------------|
| Car module location | `selfdrive/car/mazda/` | `opendbc/car/mazda/` (in opendbc_repo submodule) |
| Safety module location | `panda/board/safety/` | `opendbc/safety/modes/` |
| Platform definition | Python dataclasses | Cap'n Proto structs + `PlatformConfig` / `CarSpecs` |
| Platform registration | Imperative `_get_params` | Declarative `PlatformConfig` + `CarSpecs` |
| CAN parsers | dict-based | `Bus` enum + `get_can_parsers(CP)` |
| Forward hook return type | `int fwd_hook` | `bool fwd_hook` |
| Checksum flag | `.check_checksum=true` | `.ignore_checksum=true` |
| Steering limits class | `SteeringLimits` | `TorqueSteeringLimits` |
| Safety config macro | `BUILD_SAFETY_CFG` 4-arg | 5-arg with `disable_forwarding` |
| `_get_params` signature | `_get_params(…, frogpilot_toggles)` | `_get_params(ret, candidate, fingerprint, car_fw, alpha_long, is_release, docs)` — no `Params()` access |
| `update` signature + return | `update(cp, cp_cam, cp_body, frogpilot_toggles)` returning tuple | `update(can_parsers)` returning struct |
| Vehicle speed factor | `VEHICLE_SPEED_FACTOR = 100` | `VEHICLE_SPEED_FACTOR = 1000` |

---

## What's IN Scope (Verified)

- **Platform:** `MAZDA_3_2019` — GEN2 hardware + Torque Interceptor 2 (TI2) add-on
- **DBC:** `mazda_2019.dbc` (642 lines) imported into opendbc_repo; `mazda_3_2019.dbc` upstream unchanged
- **Safety:** GEN2-only (`FLAG_MAZDA_GEN2`) and GEN2+TI (`FLAG_MAZDA_GEN2 | FLAG_MAZDA_TORQUE_INTERCEPTOR`) variants in `opendbc/safety/modes/mazda.h`
- **Checksum:** `mazda2019_checksum` Python implementation in `mazdacan.py`; registered in `opendbc/can/dbc.py`; verified 6/6 test vectors
- **CarState:** All standard fields populated for GEN2 — speed, steer angle, steer torque, gas, brake, seatbelt, door, gear, cruise state
- **CAN channels:** GEN2 ACC (0x220 bus 2) + GEN2 EPS_LKAS (0x249 bus 1) + TI LKAS (0x249 bus 1)
- **Safety pytest:** 79 passed, 15 skipped (upstream-intentional), 0 failed — post-T18b skip rule
- **Hold/resume:** Timer-based standstill ACC (hold_delay=0.5s, hold_timer=6.0s, resume_timer=0.5s at 100Hz)
- **Flags:** `FLAG_MAZDA_GEN2 = 2`, `FLAG_MAZDA_TORQUE_INTERCEPTOR = 8` in `panda/python/__init__.py`
- **TI state machine:** `TI_STATE` IntEnum (DISCOVER=0, OFF=1, DRIVER_OVER=2, RUN=3) in `values.py`
- **TI limits:** `TI_STEER_MAX=600`, `TI_STEER_DELTA_UP=6`, `TI_STEER_DELTA_DOWN=15`
- **GEN2 steer limits:** `STEER_MAX=8000`, `steerActuatorDelay=0.335s`, `steerLimitTimer=0.8s`
- **Lateral model:** `NON_LINEAR_TORQUE_PARAMS = (4.6, 0.6, 0.134, 0.3605)` for MAZDA_3_2019

---

## What's OUT of Scope (Deferred / Dropped)

| Item | Status | Reason |
|------|--------|--------|
| GEN1 platforms (MAZDA_3, MAZDA_CX5, MAZDA_CX9, MAZDA_6, MAZDA_CX9_2021, MAZDA_CX5_2022) | Untouched | Use upstream as-is; GEN1 code was not modified |
| GEN3 platforms (Mazda 3 2024+, CX-30 2023+) | Dropped | Not in source fork; out of scope per D1 |
| CX-30, CX-50 | Dropped | Not in source fork |
| Radar Interceptor (RI) | Dropped | Per D2 decision |
| Manual Transmission | Dropped | Per D2 decision |
| BlendedACC | Dropped | Per D5 decision; recoverable inside `carcontroller.py` only if CP-C reveals issues |
| FrogPilot UI / MTSC / SLC / themes | Never carried over | FrogPilot-specific; not part of upstream port |
| Manual transmission gear parsing | Dropped | Per D2 decision |
| 6 unused source DBCs | Not imported | `mazda_2017` already upstream; `mazda_2023`, `mazda_radar`, `mazda_rx8`, etc. not needed |
| `routes.py` test entry | Deferred to T21 CP-A | Modern openpilot moved routes to opendbc submodule; no cabana segment available yet |

---

## Known Limitations / Pre-Vehicle TODOs

1. **Fingerprint mismatch risk.** Your specific Mazda 3 2019 build year/trim ECU firmware version may not match the entries in `fingerprints.py` (lines 265-304). If the device shows "Car not recognized" at CP-A, run `python3 tools/car_porting/auto_fingerprint.py` on the device to capture your actual FW versions, then extend `fingerprints.py`.

2. **NON_LINEAR_TORQUE_PARAMS retuning.** `(4.6, 0.6, 0.134, 0.3605)` was tuned against an earlier World Model version. The v0.11 World Model may produce different lateral feel. Start CP-A at low speed and capture cabana data before pushing to highway speeds. If oscillation appears, reduce the `a` parameter (currently 4.6) by 10-15% first.

3. **Hold/resume timer values.** The 50/600/50 frame values (0.5s/6.0s/0.5s at 100Hz) are inherited from the source fork. Stop-and-go feel on your specific traffic patterns may require adjustment. See CP-C triage in `T21_onvehicle_bringup_checklist.md`.

4. **GEN2 ACC without BlendedACC.** The raw OP accel command goes directly to the 0x220 bus without a first-order smoothing filter. Engage/disengage transitions may feel sharper than stock MRCC. This is expected behavior for CP-C; BlendedACC is restorable inside `carcontroller.py` if needed.

5. **mazda2019_checksum Python implementation.** Verified byte-for-byte against the C source for 6 test vectors. Car-EPS acceptance is only proven post-CP-A.

6. **steerFaultPermanent not wired for GEN2.** `carstate.py:200` always returns `False` for GEN2. openpilot won't self-disengage on an EPS fault. You are the fault detector. Watch the EPS warning light.

7. **routes.py entry deferred.** `opendbc_repo/opendbc/car/tests/routes.py` has no `MAZDA_3_2019` entry. Add one after CP-A produces a clean cabana segment.

---

## Fork Maintenance: How to Rebase onto Upstream Master

When commaai/openpilot releases v0.11.x or v0.12.x, pull in the new driving model by rebasing all three repos. The `mazda-port-v0.1` tags (created in this wave) are your recovery points.

### Pre-Rebase Checklist

Before starting:
- [ ] All three repos have clean working trees (`git status --short` shows nothing)
- [ ] Tags `mazda-port-v0.1` exist in all three repos (`git tag -l 'mazda-port-*'`)
- [ ] Create backup branches: `git checkout -b mazda-port-backup-<date>` in each repo
- [ ] Note current HEADs: `git rev-parse HEAD` in each repo

### Step-by-Step 3-Repo Rebase

```bash
# Step 1: opendbc_repo (do this first — parent submodule pointer depends on it)
cd /Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo
git fetch origin
git checkout mazda-port-additions
git rebase origin/master
# Resolve conflicts if any (see conflict recipes below)
# Verify: python3 -m py_compile opendbc/car/mazda/*.py

# Step 2: panda
cd ../panda
git fetch origin
git checkout mazda-port-additions
git rebase origin/master
# Conflicts here are rare (only one commit)

# Step 3: openpilot-comma parent (last — updates submodule pointers)
cd ..
git fetch origin
git checkout mazda-port
git rebase origin/master
# Conflicts will appear as submodule pointer mismatches
# For each submodule conflict: accept the rebased submodule SHA
# git add opendbc_repo panda
# git rebase --continue
```

### Per-File Conflict Resolution Recipes

**`opendbc/car/mazda/values.py` (T7):**
Preserve our additions:
- `MAZDA_3_2019 = MazdaPlatformConfig(...)` block
- `MazdaFlags.GEN2` and `MazdaFlags.TORQUE_INTERCEPTOR` enum members
- `TI_STATE` IntEnum class
- `apply_ti_steer_torque_limits` function
- `NON_LINEAR_TORQUE_PARAMS` for MAZDA_3_2019
- GEN2-specific `CarControllerParams` block

If upstream renamed `MazdaPlatformConfig` or `CarSpecs`, update our usage to match.

**`opendbc/car/mazda/interface.py` (T8):**
Preserve our GEN2+TI branch inside `_get_params`:
- The `if candidate == CAR.MAZDA_3_2019:` block
- The sigmoid+linear lateral callback registration
- `steerActuatorDelay`, `steerLimitTimer`, `longitudinalActuatorDelay` for GEN2

If upstream changed the `_get_params` signature again, adapt the parameter list but keep the body.

**`opendbc/car/mazda/carstate.py` (T11/T10b):**
Preserve:
- `_update_gen2` method (or equivalent GEN2 branch)
- `get_can_parsers` GEN2 branch (Bus.main, Bus.cam, Bus.aux parsers)
- `self.ti_state` and `self.acc_values` instance attributes
- The `TI_FEEDBACK` (0x24A) parsing block

**`opendbc/car/mazda/carcontroller.py` (T10):**
Preserve:
- GEN2 ACC path (0x220 bus 2 commands)
- TI steering path (`create_steering_control_gen2`)
- `hold`/`resume` timer logic
- `ti_lkas_allowed` gate

**`opendbc/safety/modes/mazda.h` (T6):**
Preserve:
- `MAZDA_2019_TX_MSGS` array
- `mazda_2019_rx_checks` array
- `mazda_gen2_safety_hooks` and `mazda_gen2_ti_safety_hooks` structs
- `FLAG_MAZDA_GEN2` and `FLAG_MAZDA_TORQUE_INTERCEPTOR` flag handling in `mazda_init`

**`opendbc/can/dbc.py` (T9b):**
Preserve the `mazda2019_checksum` registration call. If upstream changed the registration API, adapt the call signature.

**`panda/python/__init__.py` (T6):**
Preserve `FLAG_MAZDA_GEN2 = 2` and `FLAG_MAZDA_TORQUE_INTERCEPTOR = 8`. If upstream added new Mazda flags, ensure our values don't collide.

**`opendbc/safety/tests/common.py` (T18b):**
Preserve the sibling-mode skip rule:
```python
if attr.startswith('TestMazdaGen2') and current_test.startswith('TestMazdaGen2'):
    continue
```
If upstream restructured the skip block, insert this rule in the equivalent location.

### Post-Rebase Verification

After all three repos are rebased:

```bash
# 1. Static check
python3 -m py_compile opendbc_repo/opendbc/car/mazda/*.py

# 2. Import smoke
cd opendbc_repo
PYTHONPATH=. python3 -c "
from opendbc.car.mazda.values import CAR, MazdaFlags, TI_STATE
from opendbc.car.mazda.interface import CarInterface
from opendbc.car.mazda.carstate import CarState
from opendbc.car.mazda.carcontroller import CarController
from opendbc.car.mazda.mazdacan import mazda2019_checksum
p = CAR.MAZDA_3_2019
flags = p.config.flags
assert flags & MazdaFlags.GEN2 and flags & MazdaFlags.TORQUE_INTERCEPTOR
print('OK flags=', hex(flags))
"

# 3. Safety pytest
cd opendbc_repo
python3 -m pytest opendbc/safety/tests/test_mazda.py -v \
  --rootdir=. --confcutdir=. -o addopts= --tb=short
# Expected: 79 passed, 15 skipped, 0 failed

# 4. Device verification (on Linux dev box or comma 3X)
bash docs/migration/T17_T18_device_verification.sh
```

### Worst-Case Rollback

If the rebase goes badly wrong:

```bash
# Abort in-progress rebase
git rebase --abort

# Return to the tagged recovery point
git checkout mazda-port-v0.1   # detached HEAD at the tag
git checkout -b mazda-port-recovered

# Or reset the branch to the tag
git checkout mazda-port
git reset --hard mazda-port-v0.1
```

Do the same in opendbc_repo and panda. The `mazda-port-v0.1` annotated tags survive rebase operations and serve as permanent recovery points.

---

## Release Tag Scheme

After this document is committed, create annotated tags in all three repos:

```bash
# opendbc_repo
cd /Users/cyonsun/Documents/Code/openpilot-comma/opendbc_repo
git tag -a mazda-port-v0.1 -m "mazda-port-v0.1: Mazda 3 2019+ GEN2 + TI2 port to openpilot v0.11+
Code-complete; on-vehicle CP-A pending. See docs/migration/MIGRATION_GUIDE.md"
git tag -l 'mazda-port-*'

# panda
cd ../panda
git tag -a mazda-port-v0.1 -m "mazda-port-v0.1: Mazda 3 2019+ GEN2 + TI2 port to openpilot v0.11+
Code-complete; on-vehicle CP-A pending. See docs/migration/MIGRATION_GUIDE.md"
git tag -l 'mazda-port-*'

# openpilot-comma parent
cd ..
git tag -a mazda-port-v0.1 -m "mazda-port-v0.1: Mazda 3 2019+ GEN2 + TI2 port to openpilot v0.11+
Code-complete; on-vehicle CP-A pending. See docs/migration/MIGRATION_GUIDE.md"
git tag -l 'mazda-port-*'
```

Tags are annotated (not lightweight) so they carry a message and survive `git describe`. Do not push tags to any remote until on-vehicle validation is complete.

---

## The Wave 7 Bring-Up Gate

The only thing standing between the current LOCAL_PASS state and the first drive is the on-vehicle bring-up sequence documented in:

**`docs/migration/T21_onvehicle_bringup_checklist.md`**

Work through it in order: CP-A (lateral only, empty lot, 30 km/h max) then CP-B (TI active, straight road, 80 km/h max) then CP-C (ACC + TI, quiet highway). Do not skip checkpoints. The triage matrices in that document cover every known failure mode.

v0.1 is a "code-complete, on-vehicle pending" tag. It is not a "validated for daily use" tag.

---

## Final Sign-Off

**Wave 8 / port complete: code-complete, LOCAL_PASS, awaiting on-vehicle CP-A**

*openpilot-comma `mazda-port` HEAD: `3dacf62c7` (pre-T22 commit)*  
*opendbc_repo `mazda-port-additions` HEAD: `32716d8a`*  
*panda `mazda-port-additions` HEAD: `066ca435`*
