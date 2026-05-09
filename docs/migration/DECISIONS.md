# DECISIONS.md — Mazda GEN2+TI Port Architecture Decision Log

ADR-style log. One section per decision. Read before making architectural changes.

---

## D-001: Base on commaai master, not v0.11.0 release tag

**Status**: Accepted  
**Date**: 2026-05-09  
**Wave**: Wave 0 / pre-implementation

### Context

The commaai/openpilot v0.11.0 release tag exists, but at the time of porting, `master` HEAD (`5745909e9b`) was `v0.11.0+208` commits ahead — effectively what RELEASES.md describes as v0.11.1 (the v0.11.1 git tag itself was never created by comma). The question was whether to pin to the v0.11.0 tag for stability or track master. Other community forks (sunnypilot, dragonpilot) use master. There were zero Mazda-specific commits between v0.11.0 and master at the time of porting.

### Decision

Base the port on commaai/openpilot master HEAD (`5745909e9b`), not the v0.11.0 release tag.

### Rationale

- Zero Mazda commits in v0.11.0..master at porting time; no regression risk for our code
- comma's de facto stable channel is master; release tags lag behind
- sunnypilot and dragonpilot both track master; community conflict recipes apply
- v0.11.1 tag was never created; "v0.11.1" in our tag name refers to the RELEASES.md description, not a git tag

### Consequences

- Positive: access to latest driving model and bug fixes without a rebase cycle
- Negative: master can move; future rebases required (see REBASE_PLAYBOOK.md)

### How to challenge this decision

Would reconsider if v0.11.0..master introduces a breaking change to the Mazda RX/TX path or `_get_params` signature that requires non-trivial re-porting work.

---

## D-002: Scope limited to MAZDA_3_2019 + TI2 only

**Status**: Accepted  
**Date**: 2026-05-09  
**Wave**: Wave 0

### Context

The source fork (`mazda-frogpilot`) supported multiple Mazda platforms including GEN1 (MAZDA_3, MAZDA_CX5, MAZDA_CX9, MAZDA_6, MAZDA_CX9_2021, MAZDA_CX5_2022), GEN2 (MAZDA_3_2019), and had partial stubs for GEN3 and CX-30/CX-50. The user's hardware is a Mazda 3 2019 with a TI2 add-on. Options were: port everything, port GEN2 only, or port GEN2+TI only.

### Decision

Port `MAZDA_3_2019` (GEN2 hardware) with `FLAG_MAZDA_TORQUE_INTERCEPTOR` (TI2) only. GEN1 platforms are left as-is from upstream. GEN3, CX-30, CX-50, Radar Interceptor, and manual transmission are explicitly dropped.

### Rationale

- User's actual hardware is GEN2 + TI2; other platforms add verification cost with zero personal benefit
- Each additional platform requires its own fingerprint verification, tuning, and on-vehicle CP sequence
- GEN1 is already supported upstream; no porting work needed
- GEN3/CX-30/CX-50 were not in the source fork in a complete state
- Radar Interceptor and manual transmission add significant complexity for zero user benefit

### Consequences

- Positive: smaller diff, lower risk surface, faster iteration
- Negative: other Mazda GEN2 users can't use this fork without adding their own fingerprints/tuning

### How to challenge this decision

Would split into MAZDA_3_2019 (no TI) and MAZDA_3_2019_TI variants if a non-TI GEN2 user shows up with a tested fingerprint and tuning data.

---

## D-003: Drop BlendedACC entirely from longcontrol.py

**Status**: Accepted  
**Date**: 2026-05-09  
**Wave**: Wave 0 D5 decision; Wave 5 verification confirmed `longcontrol.py` zero diff vs master

### Context

The source fork implemented `BlendedACC` in `selfdrive/controls/lib/longcontrol.py` — a first-order filter that blended the OP accel command with stock ACC output to smooth engage/disengage transitions. This was a FrogPilot-specific feature. The question was whether to carry it over or drop it.

### Decision

Drop `BlendedACC` from `longcontrol.py` entirely. `longcontrol.py` must remain zero-diff against upstream master. If GEN2 ACC transitions feel abrupt after CP-C, re-add a Mazda-specific first-order filter inside `carcontroller.py` only.

### Rationale

- Shared control code (`longcontrol.py`) should not contain car-specific hacks
- FrogPilot's `BlendedACC` was tightly coupled to FrogPilot's `Params()` infrastructure, which is also dropped (D-004)
- Keeping `longcontrol.py` clean makes future upstream rebases trivial for this file
- The fix location (`carcontroller.py`) is the correct architectural home for car-specific output shaping

### Consequences

- Positive: `longcontrol.py` stays zero-diff; no rebase conflicts on this file ever
- Negative: engage/disengage transitions may feel sharper than stock MRCC until CP-C tuning

### How to challenge this decision

If CP-C reveals that raw ACC commands cause unsafe jerk, implement a first-order filter in `carcontroller.py` and document it here as D-003b.

---

## D-004: Strip all FrogPilot infrastructure

**Status**: Accepted  
**Date**: 2026-05-09  
**Wave**: Wave 0

### Context

The source fork used FrogPilot-specific infrastructure throughout: `Params()` reads in `_get_params`, `frogpilot_toggles` parameter threading, `fp_ret` tuple returns from `_get_params`, `FrogPilotCarState` fields, and various FrogPilot feature flags (MTSC, SLC, themes, etc.). The upstream openpilot v0.11 `_get_params` signature has no `Params()` access and returns a plain struct.

### Decision

Strip all FrogPilot infrastructure. No `Params()` reads, no `frogpilot_toggles`, no `fp_ret` tuple returns, no `FrogPilotCarState`, no FrogPilot UI features. The only permitted FrogPilot references are the 2 provenance comments at `opendbc/car/mazda/values.py:49,156`.

### Rationale

- User explicitly does not want FrogPilot UI, MTSC, SLC, or themes
- The new `_get_params` signature (`ret, candidate, fingerprint, car_fw, alpha_long, is_release, docs`) has no `Params()` access by design
- FrogPilot infrastructure is tightly coupled; partial removal creates subtle bugs
- Clean separation makes future upstream rebases straightforward

### Consequences

- Positive: clean codebase; no FrogPilot dependency; easy rebases
- Negative: any FrogPilot-specific tuning features (MTSC, SLC) are unavailable

### How to challenge this decision

Not challengeable for this user's use case. If a future user wants FrogPilot features, they should fork from a FrogPilot-based fork instead.

---

## D-005: TI flag hardcoded into MAZDA_3_2019 PlatformConfig

**Status**: Accepted  
**Date**: 2026-05-09  
**Wave**: Wave 2 / T7

### Context

The TI2 add-on is a hardware device. Options for detecting it: (a) hardcode `FLAG_MAZDA_TORQUE_INTERCEPTOR` into the `MAZDA_3_2019` `PlatformConfig`, (b) detect at runtime via CAN fingerprinting in `_get_params`, or (c) split into two platform variants (`MAZDA_3_2019` and `MAZDA_3_2019_TI`). Runtime detection via CAN is complex because `_get_params` has no `can_recv` access.

### Decision

Hardcode `FLAG_MAZDA_TORQUE_INTERCEPTOR` into `MAZDA_3_2019`'s `PlatformConfig.flags`. The combined flag value is `0xa` (GEN2=2 | TI=8).

### Rationale

- User's car definitely has TI2; no runtime detection needed
- `_get_params` has no `can_recv` access in the v0.11 architecture; CAN-based detection would require a separate hook
- Simpler code; fewer failure modes
- Matches the source fork's approach for this hardware configuration

### Consequences

- Positive: simple, reliable, no boot-time detection delay
- Negative: a non-TI GEN2 user would need a separate platform variant

### How to challenge this decision

Would split into `MAZDA_3_2019` (no TI) and `MAZDA_3_2019_TI` if a non-TI GEN2 user provides a tested fingerprint and confirms the platform works without TI.

---

## D-006: TI_STATE enum kept at 4 values

**Status**: Accepted  
**Date**: 2026-05-09  
**Wave**: Wave 2 / T7

### Context

The TI2 hardware reports 6 distinct states on the CAN bus. The source fork collapsed these to 4 values in its `TI_STATE` IntEnum: `DISCOVER=0`, `OFF=1`, `DRIVER_OVER=2`, `RUN=3`. The v0.0.2 hotfix later refined fault handling (D-010) without changing the enum values themselves.

### Decision

Keep `TI_STATE` at 4 values matching the source fork: `DISCOVER=0`, `OFF=1`, `DRIVER_OVER=2`, `RUN=3`. Hardware states 4 (ERROR) and 5 (CRITICAL_ERROR) are handled by the fault logic in `carstate.py` without adding new enum members.

### Rationale

- Matches the source fork's mass-tested behavior
- The 4-value layout captures all operationally distinct states
- Adding enum members for ERROR/CRITICAL_ERROR would require updating all switch/match sites

### Consequences

- Positive: stable interface; matches source fork
- Negative: fault states are implicit (handled by `ti_fault_permanent` flag rather than enum value)

### How to challenge this decision

Would add ERROR/CRITICAL_ERROR enum members if on-vehicle testing reveals the 4-value collapse causes ambiguous state transitions.

---

## D-007: alphaLongitudinalAvailable = False until ACCEL_CMD plumbing implemented

**Status**: Accepted  
**Date**: 2026-05-09  
**Wave**: v0.0.2 hotfix

### Context

The source fork advertised longitudinal control capability. The ported `carcontroller.py` echoes stock ACC (0x220 bus 2) and overrides HOLD/RESUME bits, but never writes an `ACCEL_CMD` field derived from `CC.actuators.accel`. Advertising `alphaLongitudinalAvailable = True` while the accel command is not actually being sent would be misleading and potentially unsafe.

### Decision

Set `alphaLongitudinalAvailable = False` in `interface.py` until the ACCEL_CMD plumbing is ported from the source fork.

### Rationale

- The source fork's longitudinal path uses `raw_acc_output = (CC.actuators.accel * 200) + 2000` packed into the ACC frame; this is not yet ported
- Advertising a capability that isn't implemented misleads the user and openpilot's mode selection
- The fix is straightforward (see ROADMAP P1) but requires on-vehicle CP-C validation

### Consequences

- Positive: honest capability advertisement; no false sense of OP longitudinal control
- Negative: openpilot won't offer longitudinal control until P1 is implemented

### How to challenge this decision

Re-enable `alphaLongitudinalAvailable = bool(ret.flags & MazdaFlags.GEN2)` after porting `raw_acc_output = (CC.actuators.accel * 200) + 2000` into `mazdacan.create_acc_cmd` and completing CP-C validation.

---

## D-008: ACC always echoed (even with alpha-long off)

**Status**: Accepted  
**Date**: 2026-05-09  
**Wave**: Wave 4 / T11; preserved from source fork

### Context

The panda safety layer blocks stock ACC frames from bus 0 to bus 2 for GEN2. Without intervention, the car's MRCC would stop working when openpilot is engaged. The source fork solved this by having `carcontroller.py` MITM the ACC frame: read the stock ACC values from `CarState.acc_values`, echo them back on bus 2, and only modify the HOLD/RESUME bits. This gives standstill hold/resume without requiring OP longitudinal control.

### Decision

Always echo the ACC frame on bus 2, modifying only HOLD/RESUME bits. This applies even when `alphaLongitudinalAvailable = False`.

### Rationale

- Matches source fork's mass-tested behavior
- Gives standstill hold/resume (a real safety benefit) without requiring full OP long
- The alternative (not echoing) would break stock MRCC entirely when openpilot is engaged
- `mazda2019_checksum` is byte-perfect (Wave 6 verified against 6 test vectors); packing bugs are caught by pytest

### Consequences

- Positive: stock MRCC continues to work; standstill hold/resume functional
- Negative: any packing or checksum bug in the ACC echo path is immediately live on the car

### How to challenge this decision

Not challengeable without a fundamental redesign of the GEN2 ACC architecture. The MITM approach is the only viable path given panda's safety blocking.

---

## D-009: Test framework Mazda sibling skip rule in common.py

**Status**: Accepted  
**Date**: 2026-05-09  
**Wave**: Wave 7 / T18b

### Context

`TestMazdaGen2Safety` and `TestMazdaGen2TiSafety` share TX_MSGS (both include `{0x249, 1}` — the GEN2 LKAS address). The `test_tx_hook_on_wrong_safety_mode` test in `common.py` iterates all safety mode pairs and checks that TX is blocked in the wrong mode. When run across GEN2 and GEN2+TI, the shared 0x249 address causes false positives: GEN2 mode allows 0x249, so the test incorrectly reports that GEN2+TI mode "allows" a frame that should be blocked. This produced 15 spurious failures.

### Decision

Add a sibling-mode skip rule in `opendbc/safety/tests/common.py`:
```python
if attr.startswith('TestMazdaGen2') and current_test.startswith('TestMazdaGen2'):
    continue
```

### Rationale

- The same pattern is already used for Toyota, Subaru, Ford, Hyundai-CANFD, Honda, and VW in the same file
- The false positives are a test framework artifact, not a real safety regression
- The skip rule is narrow (only affects Mazda GEN2 sibling pairs) and documented

### Consequences

- Positive: pytest goes from 15 failures to 0 failures; 15 skips are clearly labeled
- Negative: cross-mode TX tests between GEN2 and GEN2+TI are not run (acceptable given shared TX_MSGS)

### How to challenge this decision

Would remove the skip rule if the TX_MSGS arrays are refactored to not share addresses between GEN2 and GEN2+TI variants.

---

## D-010: TI fault transient/permanent split (v0.0.2 hotfix)

**Status**: Accepted (supersedes earlier "any non-RUN = permanent" logic)  
**Date**: 2026-05-09  
**Wave**: v0.0.2 hotfix

### Context

The initial port treated any TI state other than `RUN=3` as a permanent fault, setting `ti_fault_permanent = True`. In practice, TI2 hardware boots through a sequence: `INIT(1) -> STANDBY(2) -> DRIVE(3)`. The old logic latched `ti_fault_permanent = True` on every boot, requiring an ignition cycle to clear. This was discovered during pre-flight code review (no on-vehicle test needed to identify the bug).

### Decision

Only `ERROR(4)` and `CRITICAL_ERROR(5)` latch `ti_fault_permanent = True`. `INIT(1)`, `STANDBY(2)`, and `OFF(0)` are transient states that auto-recover without latching.

### Rationale

- TI2 hardware's normal boot sequence passes through non-RUN states; these are not faults
- The old logic would have required an ignition cycle after every openpilot restart
- ERROR and CRITICAL_ERROR represent genuine hardware faults that warrant permanent latch until cleared

### Consequences

- Positive: normal boot sequence works without ignition cycle; fault latch is reserved for real faults
- Negative: none identified

### How to challenge this decision

Would revisit if on-vehicle testing reveals that INIT/STANDBY states can persist indefinitely (indicating a real hardware fault that should latch).

---

## D-011: Distribution via conversun forks, no upstream PR

**Status**: Accepted  
**Date**: 2026-05-09  
**Wave**: Wave 8

### Context

After completing the port, options were: (a) submit a PR to commaai/openpilot, (b) submit a PR to opendbc, (c) maintain personal forks, or (d) some combination. The commaai upstream has a high bar for new car support (requires comma hardware testing, community validation, etc.).

### Decision

Distribute via personal forks: `conversun/openpilot` (`mazda-port`), `conversun/opendbc` (`mazda-port-additions`), `conversun/panda` (`mazda-port-additions`). No upstream PR.

### Rationale

- Scope is too narrow for upstream merge (single user, single car, single hardware config)
- User wants personal install only; upstream PR process would require community validation
- Personal forks are simpler to maintain and update
- Tags `v0.11.1-mazda3-2019.0.x` serve as recovery points without upstream dependency

### Consequences

- Positive: full control; no upstream review process; fast iteration
- Negative: other GEN2 Mazda users can't benefit without finding the fork; no upstream maintenance

### How to challenge this decision

Would reconsider an upstream PR if: (a) multiple GEN2 Mazda users validate the port on their hardware, (b) comma's car support requirements are met, and (c) the user wants to invest in the upstream review process.

---

*DECISIONS.md — v0.0.2 / Wave 8+hotfix. 11 decisions recorded.*
