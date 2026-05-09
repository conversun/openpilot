# AGENTS.md — Mazda 3 2019+ GEN2+TI Port

**Read this first. Every session. Takes ~3 minutes.**

---

## What This Project Is

This is a personal port of the `MAZDA_3_2019` (GEN2 hardware + Torque Interceptor 2 add-on) car implementation from the MoreTore/openpilot `mazda-frogpilot` fork (itself based on openpilot v0.9.7) onto the current commaai/openpilot v0.11+ master architecture. The work spans three repos: `openpilot-comma` (parent), `opendbc_repo` (submodule), and `panda` (submodule). All code is complete and verified locally. On-vehicle validation (CP-A lateral checkpoint) is the only remaining gate before first drive. Locked at tag `v0.11.1-mazda3-2019.0.2`.

---

## Current State at a Glance

| Item | Value |
|------|-------|
| Tag | `v0.11.1-mazda3-2019.0.2` (annotated, all 3 repos). `v0.11.1-mazda3-2019.0.1` was retracted before any drive. |
| Parent branch | `mazda-port` in `openpilot-comma` |
| Submodule branches | `mazda-port-additions` in `opendbc_repo` and `panda` |
| Parent HEAD | `698fb9c2d` — submodule: bump opendbc_repo + panda for v0.0.2 hotfixes |
| opendbc_repo HEAD | `daa49373` — mazda: fix TI fault latch + disable alpha-long until ACCEL_CMD ported |
| panda HEAD | `251bdf57` — mazda: declare len inside bus==1 ignition hook block |
| Safety pytest | 79 passed / 0 failed / 15 skipped (LOCAL_PASS, post-T18b) |
| On-vehicle | CP-A pending (not yet driven) |

---

## 5-Second Project Map

```
/Users/cyonsun/Documents/Code/openpilot-comma        <- parent; work here on mazda-port branch
  opendbc_repo/                                       <- submodule; work on mazda-port-additions
    opendbc/car/mazda/                                <- Python: values, interface, carstate,
                                                         carcontroller, mazdacan, fingerprints
    opendbc/safety/modes/mazda.h                      <- C: GEN1 + GEN2 + TI safety hooks
    opendbc/safety/tests/test_mazda.py                <- pytest (79/0/15)
    opendbc/safety/tests/common.py                    <- sibling-skip rule (T18b)
    opendbc/can/dbc.py                                <- mazda2019_checksum registration
    opendbc/dbc/mazda_2019.dbc                        <- imported DBC (642 lines)
  panda/                                              <- submodule; work on mazda-port-additions
    board/drivers/can_common.h                        <- Mazda GEN2 ignition (0x274)
    board/main.c                                      <- SAFETY_MAZDA case
    python/__init__.py                                <- FLAG_MAZDA_GEN2 / _TORQUE_INTERCEPTOR

/Users/cyonsun/Documents/Code/openpilot-more          <- REFERENCE ONLY: source fork (do not edit)
```

---

## Documentation Map

| Question | Read |
|----------|------|
| Starting fresh? | This file + `docs/migration/MIGRATION_GUIDE.md` |
| About to drive? | `docs/migration/T21_onvehicle_bringup_checklist.md` |
| Why this design? | `docs/migration/DECISIONS.md` |
| What's next? | `docs/migration/ROADMAP.md` |
| Pulling in upstream v0.12+? | `docs/migration/REBASE_PLAYBOOK.md` |
| Investigating an on-vehicle bug? | `docs/migration/T21_followup_log.md` + `docs/migration/T21_cabana_capture.sh` |
| Verifying after a code change? | `docs/migration/T17_T18_device_verification.sh` (Linux/dev box only, not macOS) |
| Full SHA chain + arch deltas? | `docs/migration/MIGRATION_GUIDE.md` section "Complete Commit Chain" |

---

## Hard Rules for Any AI Session

**Scope.** This port covers `MAZDA_3_2019` (GEN2 + TI2) only. Never expand scope to GEN3, CX-30, CX-50, Radar Interceptor, or manual transmission without explicit user approval. See `DECISIONS.md` D-002.

**No FrogPilot infrastructure.** Never re-introduce `Params()` reads, `frogpilot_toggles`, `fp_ret` tuple returns, `FrogPilotCarState`, or `BlendedACC` in `selfdrive/controls/lib/longcontrol.py`. If GEN2 ACC misbehaves, blend inside `carcontroller.py` only. See D-003, D-004.

**The only legitimate FrogPilot mentions** in code are the 2 provenance comments at `opendbc/car/mazda/values.py:49,156` (algorithm origin attribution). Anything else is a blocker.

**Before any commit:**
- `python3 -m py_compile` on all changed `.py` files
- `pytest opendbc/safety/tests/test_mazda.py` on Linux/dev box (macOS native build broken)

**Commit style:** `<area>: <lowercase imperative>` — e.g., `mazda: ...`, `submodule: bump ...`, `safety/tests: ...`. Match the existing log.

**Never amend pushed commits.** Never force-push to `mazda-port` without user approval. Never push tags before user confirms. Tags `v0.11.1-mazda3-2019.0.x` are recovery points.

**When unsure about architecture:** read `DECISIONS.md` before making changes.

---

## Quick Commands

```bash
# Verify all 3 repos at expected SHA
for d in . opendbc_repo panda; do echo "$d:"; git -C $d log -1 --oneline; done
# Expected:
#   .:          698fb9c2d submodule: bump opendbc_repo + panda for v0.0.2 hotfixes
#   opendbc_repo: daa49373 mazda: fix TI fault latch + disable alpha-long until ACCEL_CMD ported
#   panda:      251bdf57 mazda: declare len inside bus==1 ignition hook block

# Run safety tests (uv-managed venv with pytest, run from opendbc_repo)
cd opendbc_repo && uv run python -m pytest opendbc/safety/tests/test_mazda.py \
  --confcutdir=. --rootdir=. -p no:cacheprovider -o addopts=
# Expected: 79 passed, 15 skipped, 0 failed

# Static check on Mazda Python files
python3 -m py_compile \
  opendbc_repo/opendbc/car/mazda/values.py \
  opendbc_repo/opendbc/car/mazda/interface.py \
  opendbc_repo/opendbc/car/mazda/carstate.py \
  opendbc_repo/opendbc/car/mazda/carcontroller.py \
  opendbc_repo/opendbc/car/mazda/mazdacan.py \
  opendbc_repo/opendbc/car/mazda/fingerprints.py \
  opendbc_repo/opendbc/can/dbc.py
# Must exit 0 with no output

# Forbidden-token scrub (must return 0 hits except 2 known benign at values.py:49,156)
grep -nrE 'frogpilot_toggles|FrogPilot|fp_ret|FPCP|BlendedACC' \
  opendbc_repo/opendbc/car/mazda/

# On comma 3X (SSH): verify firmware versions match
git -C /data/openpilot rev-parse HEAD              # must = 698fb9c2d...
git -C /data/openpilot/panda rev-parse HEAD        # must = 251bdf57...
git -C /data/openpilot/opendbc_repo rev-parse HEAD # must = daa49373...
```

---

## First-Time Bootstrap Checklist

- [ ] Read this AGENTS.md
- [ ] `cat docs/migration/MIGRATION_GUIDE.md` — full SHA chain + arch deltas
- [ ] `cat docs/migration/DECISIONS.md` — what's settled and why
- [ ] `cat docs/migration/ROADMAP.md` — what's pending
- [ ] `git log --oneline mazda-port -20` — recent activity
- [ ] Then ask the user: "what would you like to work on?"

---

## Key Technical Facts (Quick Reference)

| Item | Value |
|------|-------|
| Platform | `MAZDA_3_2019` in `opendbc/car/mazda/values.py` |
| Flags | `FLAG_MAZDA_GEN2 = 2`, `FLAG_MAZDA_TORQUE_INTERCEPTOR = 8` |
| Combined flags | `0xa` (GEN2 + TI both set) |
| GEN2 steer limits | `STEER_MAX=8000`, `steerActuatorDelay=0.335s`, `steerLimitTimer=0.8s` |
| TI steer limits | `TI_STEER_MAX=600`, `TI_STEER_DELTA_UP=6`, `TI_STEER_DELTA_DOWN=15` |
| Lateral model | `NON_LINEAR_TORQUE_PARAMS = (4.6, 0.6, 0.134, 0.3605)` |
| GEN2 ACC bus | 0x220 bus 2 (MITM: panda blocks stock, we echo + modify HOLD/RESUME) |
| GEN2 EPS/TI bus | 0x249 bus 1 |
| TI feedback | 0x24A bus 1 |
| TI state machine | `TI_STATE` IntEnum: DISCOVER=0, OFF=1, DRIVER_OVER=2, RUN=3 |
| Hold/resume timers | 50/600/50 frames (0.5s/6.0s/0.5s at 100Hz) |
| alpha-long | `False` until ACCEL_CMD plumbing ported (see ROADMAP P1) |
| Checksum | `mazda2019_checksum` in `mazdacan.py`; registered in `opendbc/can/dbc.py` |
| Safety pytest | 79 passed, 15 skipped (upstream-intentional), 0 failed |

---

*AGENTS.md — v0.0.2 / Wave 8+hotfix. Parent HEAD: `698fb9c2d`.*
