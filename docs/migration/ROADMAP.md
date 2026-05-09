# ROADMAP.md — Mazda GEN2+TI Port Forward Plan

**Current tag:** `v0.11.1-mazda3-2019.0.2`  
**Last updated:** 2026-05-09

---

## Current Status (v0.0.2)

| Item | State |
|------|-------|
| Code complete | Yes — all 8 waves done |
| Safety pytest | 79/0/15 LOCAL_PASS |
| On-vehicle | Not yet driven (CP-A pending) |
| Longitudinal control | Disabled (`alphaLongitudinalAvailable = False`) |
| Lateral control | Code complete; tuning params from source fork, not yet validated on v0.11 World Model |
| TI fault handling | Fixed in v0.0.2 (transient/permanent split) |

---

## Known Limitations

### From Oracle Review (pre-v0.0.2)

| ID | Issue | Status |
|----|-------|--------|
| HIGH 1 | `alphaLongitudinalAvailable = True` while ACCEL_CMD not ported | **Fixed in v0.0.2** — set to `False` (D-007) |
| HIGH 2 | TI fault latch triggered on every boot (INIT/STANDBY treated as permanent) | **Fixed in v0.0.2** — transient/permanent split (D-010) |
| HIGH 3 | GEN1 `fwd_hook` returns `int` instead of `bool` | Not our code — GEN1 path untouched; upstream issue |
| HIGH 4 | GEN1 `steerFaultPermanent` always `False` | Not our code — GEN1 path untouched; upstream issue |
| HIGH 5 | `len` variable in panda ignition hook shadowed outer scope | **Fixed in v0.0.2** — `251bdf57` declares `len` inside bus==1 block |

HIGH 3 and HIGH 4 are GEN1 path issues. We don't own GEN1 code; they're upstream's problem.

### Divergences from Source Fork (MoreTore/mazda-frogpilot)

| Item | Source Fork | This Port | Reason |
|------|-------------|-----------|--------|
| `alphaLongitudinalAvailable` | `True` | `False` | ACCEL_CMD not yet ported (D-007) |
| TI fault detection | Any non-RUN = permanent | Only ERROR/CRITICAL_ERROR = permanent | Boot sequence fix (D-010) |
| `BlendedACC` | In `longcontrol.py` | Dropped | Architecture decision (D-003) |
| FrogPilot infrastructure | Present | Stripped | Architecture decision (D-004) |
| `VEHICLE_SPEED_FACTOR` | 100 | 1000 | Upstream architecture change absorbed |

### From Wave 5 PASS-WITH-NOTES

- `routes.py` entry deferred: `opendbc_repo/opendbc/car/tests/routes.py` has no `MAZDA_3_2019` entry. Modern openpilot moved routes into the opendbc submodule. No cabana segment available yet. Add after CP-A produces a clean segment.

---

## Priority Queue

### P0 — Validate v0.0.2 on vehicle (CP-A)

**Owner:** User (requires physical access to car + comma 3X)  
**Gate:** All downstream work is blocked until CP-A passes.

Steps:
1. Flash `698fb9c2d` to comma 3X (verify all 3 repo SHAs match)
2. Follow `docs/migration/T21_onvehicle_bringup_checklist.md` in order
3. CP-A: lateral only, empty lot, 30 km/h max
4. CP-B: TI active, straight road, 80 km/h max
5. CP-C: ACC + TI, quiet highway (after CP-A and CP-B signed off)

If CP-A fails with "Car not recognized": see P3 (fingerprint coverage).  
If CP-A fails with lateral oscillation: see P2 (lateral retune).  
If CP-C reveals ACC jerk: implement first-order filter in `carcontroller.py` per D-003.

**Estimated effort:** 2-4h on-vehicle time across 2-3 sessions.

---

### P1 — Restore openpilot longitudinal control

**Blocked by:** P0 (CP-A must pass first)  
**Estimated effort:** 6-10h

The source fork's longitudinal path packs `raw_acc_output = (CC.actuators.accel * 200) + 2000` into the ACC frame. This is not yet ported. Steps:

1. Port `raw_acc_output` calculation into `mazdacan.create_acc_cmd`:
   ```python
   # In mazdacan.py create_acc_cmd:
   raw_acc_output = int((accel * 200) + 2000)
   # Pack into the appropriate ACC frame field
   ```
2. Update `carcontroller.py` to pass `CC.actuators.accel` when OP long is active
3. Re-enable in `interface.py`:
   ```python
   ret.alphaLongitudinalAvailable = bool(ret.flags & MazdaFlags.GEN2)
   ```
4. Run CP-C (longitudinal checkpoint) from `T21_onvehicle_bringup_checklist.md`
5. If GEN2 ACC transitions feel abrupt: add a Mazda-internal first-order filter in `carcontroller.py` (per D-003). Do not touch `longcontrol.py`.

After P1 is complete and CP-C passes, bump version to `v0.1.x`.

---

### P2 — Lateral plant retune for v0.11 World Model

**Blocked by:** P0 (need on-vehicle data)  
**Estimated effort:** 2-4h iteration on-vehicle

`NON_LINEAR_TORQUE_PARAMS = (4.6, 0.6, 0.134, 0.3605)` was tuned against an earlier World Model version (v0.9.7 era). The v0.11 World Model may produce different lateral feel.

Decision after CP-A:
- If lateral feels smooth at highway speeds: leave params alone
- If oscillating: reduce `a` parameter (currently 4.6) by 10-15% first, then iterate
- Capture cabana data during CP-A for offline analysis

The params live in `opendbc/car/mazda/values.py` in the `MAZDA_3_2019` `PlatformConfig`.

---

### P3 — Fingerprint coverage (conditional)

**Trigger:** Only if CP-A reports "Car not recognized"  
**Estimated effort:** 1-2h

The fingerprint entries in `opendbc/car/mazda/fingerprints.py` (lines 265-304) were ported from the source fork. Your specific Mazda 3 2019 build year/trim ECU firmware version may not match.

Steps if needed:
1. On comma 3X: `python3 tools/car_porting/auto_fingerprint.py` to capture actual FW versions
2. Capture FW responses from 0x730, 0x7E0, 0x7E1 via cabana (`T21_cabana_capture.sh`)
3. Add your FW versions to `fingerprints.py` in the `MAZDA_3_2019` block
4. Commit to `mazda-port-additions` in opendbc_repo; bump submodule in parent

---

### P4 — Add routes.py entry (post-CP-A)

**Blocked by:** P0 (need a real cabana segment)  
**Estimated effort:** 30 min

After CP-A produces a clean cabana segment:
1. Add to `opendbc_repo/opendbc/car/tests/routes.py` in the Mazda block:
   ```python
   CarTestRoute("<your-segment-id>", MAZDA.MAZDA_3_2019),
   ```
2. Commit to `mazda-port-additions`; bump submodule in parent

---

## Out of Scope

Cross-reference `DECISIONS.md` for rationale.

| Item | Decision | Notes |
|------|----------|-------|
| GEN3 (Mazda 3 2024+) | D-002 | Not in source fork; not user's hardware |
| CX-30, CX-50 | D-002 | Not in source fork |
| Radar Interceptor (RI) | D-002 | Not user's hardware |
| Manual transmission | D-002 | Not user's hardware |
| Upstream PR to commaai | D-011 | Scope too narrow; personal install only |
| GEN1 path bugs (HIGH 3/4) | D-002 | GEN1 code untouched; upstream's problem |
| FrogPilot UI / MTSC / SLC | D-004 | Explicitly dropped |

---

## Versioning Scheme

| Version | Meaning |
|---------|---------|
| `v0.0.x` | Pre-vehicle hotfixes (current: v0.0.2) |
| `v0.1.x` | First successful CP-A; lateral validated on-vehicle |
| `v0.2.x` | Longitudinal restored (after P1 complete + CP-C pass) |
| `v1.0.x` | Daily driver stable: sustained miles + at least 1 successful upstream rebase per REBASE_PLAYBOOK |

Tags are annotated in all 3 repos. `v0.11.1-mazda3-2019.0.1` was retracted before any drive. `v0.11.1-mazda3-2019.0.2` is the current recovery point.

---

## Starting a New Session: What to Do First

**Just installed v0.0.2, haven't driven yet:**
1. Read AGENTS.md + this ROADMAP
2. Verify all 3 repo SHAs match expected (see AGENTS.md quick commands)
3. Follow `T21_onvehicle_bringup_checklist.md` for CP-A

**Completed CP-A, lateral validated:**
1. Read AGENTS.md + ROADMAP P1
2. Port ACCEL_CMD plumbing (P1 steps above)
3. Run CP-C from `T21_onvehicle_bringup_checklist.md`
4. Tag `v0.11.1-mazda3-2019.0.3` or bump to `v0.1.0` after CP-C pass

**Want to add ACCEL_CMD (P1) without having driven yet:**
Don't. P1 requires CP-C validation. CP-C requires CP-A first. Do CP-A first.

**Hit a bug on-vehicle:**
1. Check `T21_followup_log.md` for known issues
2. Capture cabana data with `T21_cabana_capture.sh`
3. Read DECISIONS.md for relevant architectural constraints before patching

**Pulling in upstream v0.12+:**
Follow `REBASE_PLAYBOOK.md` exactly. Create dated backup branches first. Do opendbc_repo and panda before the parent.

---

*ROADMAP.md — v0.0.2 / Wave 8+hotfix. P0 (CP-A) is the current gate.*
