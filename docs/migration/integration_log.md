# Mazda Port — Integration Log

Cumulative log of cross-cutting integration checkpoints for the `MAZDA_3_2019`
(GEN2 + Torque Interceptor) port from the FrogPilot fork onto upstream
openpilot 0.10.x.

Scope reminder (from orchestrator D-decisions):
- Target: `MAZDA_3_2019` only (GEN2 hardware + TI add-on).
- DROPPED from upstream port: FrogPilot UI, MTSC, SLC, themes, BlendedACC.
- BlendedACC re-introduction (if needed) lives ONLY inside
  `opendbc/car/mazda/carcontroller.py`, NEVER in
  `selfdrive/controls/lib/longcontrol.py`.

---

## Wave 5 — T14 + T15 + T16 (cross-cutting verification)

Date: 2026-05-09  
Branch: `mazda-port` (parent), `mazda-port-additions` (opendbc_repo, panda)

### Verified

- **`opendbc_repo/opendbc/car/mazda/values.py`** — `MAZDA_3_2019` platform
  defined as `MazdaPlatformConfig` at line 129; `apply_ti_steer_torque_limits`
  helper at line 47; `TI_STATE` IntEnum present. AST + `py_compile` clean.
- **`opendbc_repo/opendbc/car/values.py`** — `py_compile` clean (aggregate
  `PLATFORMS` re-export through `from opendbc.car.mazda.values import CAR as
  MAZDA` is unchanged from upstream; T7's `MAZDA_3_2019` reaches it via the
  brand import).
- **`opendbc_repo/opendbc/car/docs_definitions.py:139`** —
  `mazda = BaseCarHarness("Mazda connector")` already present upstream,
  no edit needed for the GEN2 platform (same harness as GEN1).
- **`cereal/car.capnp:616`** — `mazda @13;` already present in
  `SafetyModel` enum, no edit needed (T6's safety variants reuse it).
- **`panda/python/__init__.py:147-148`** — only `FLAG_MAZDA_GEN2 = 2` and
  `FLAG_MAZDA_TORQUE_INTERCEPTOR = 8` present (T6 additions). GEN1 is
  the implicit zero-flag default and intentionally has no Python flag.
- **`opendbc_repo/opendbc/car/mazda/carcontroller.py`** — GEN2 ACC path
  sends OP-computed accel directly via
  `mazdacan.create_acc_cmd(self.packer, CS.acc_values, hold, resume)`
  (line 107). No first-order filter, no BlendedACC blending. Matches D5
  decision to drop BlendedACC.
- **`selfdrive/controls/lib/longcontrol.py`** — zero diff against `master`.
  No Mazda-specific changes leaked into the longitudinal controller.
- **Forbidden-token scrub** — all functional FrogPilot tokens
  (`frogpilot_toggles`, `fp_ret`, `FPCP`), `/dev/shm` reads, dropped-feature
  tokens (`BlendedACC`, `CEStatus`, `ManualTransmission`,
  `TorqueInterceptorEnabled`, `RadarInterceptorEnabled`, `NoMRCC`, `NoFSC`),
  and unanchored `Params(` constructions are absent from the Mazda module,
  the Mazda safety C header, and the Mazda safety test.
- **`apply_ti_steer_torque_limits` confinement** — confirmed absent from
  `opendbc/car/__init__.py` and `opendbc/car/lateral.py`; confined to
  `opendbc/car/mazda/values.py` (definition, line 47) and
  `opendbc/car/mazda/carcontroller.py` (import line 11, call site line 60).

### Pending / deferred

- **T14.1 routes.py** — `MAZDA_3_2019` route entry NOT added in this wave.
  Reasoning:
  1. The path the task originally pointed at,
     `selfdrive/car/tests/routes.py`, no longer exists on the parent — modern
     openpilot has migrated the per-brand route list into the opendbc
     submodule at `opendbc_repo/opendbc/car/tests/routes.py` (355 lines, six
     existing Mazda GEN1 routes at lines 335-340).
  2. That routes.py lives inside the opendbc submodule, which Wave 5 is
     explicitly forbidden to modify (Wave 1-4 + T10b territory).
  3. The source FrogPilot fork's `selfdrive/car/tests/routes.py` only carries
     GEN1 Mazdas (lines 286-291: `MAZDA_CX5`, `MAZDA_CX9`, `MAZDA_3`,
     `MAZDA_6`, `MAZDA_CX9_2021`, `MAZDA_CX5_2022`) — no `MAZDA_3_2019`
     route is available to copy.

  Action item for **T21 CP-A** (cabana capture): once a real cabana log of a
  `MAZDA_3_2019` drive exists, add a single line of the form
  `CarTestRoute("<segment-id>", MAZDA.MAZDA_3_2019)` to
  `opendbc_repo/opendbc/car/tests/routes.py` in the Mazda block. That commit
  will own the opendbc_repo bump on `mazda-port-additions` and a paired
  submodule bump on `mazda-port`.

### T10b parallel-landing note

T10b (`ti_state` / `acc_values` exposure on the GEN2 `CarState`) landed on
`mazda-port-additions` (opendbc_repo `29db3c74`) during this verification
window. The T15 grep matrix was re-run against the post-T10b state and is
identical to the pre-T10b run: T10b adds only
`opendbc.car.mazda.values.TI_STATE` references (an in-tree IntEnum from T7,
not a forbidden token), schema-level `self.ti_state` / `self.acc_values`
attributes, and a 4-MCU hall-state collapse — no new FrogPilot, BlendedACC,
`/dev/shm`, or `Params(` tokens. Wave 5 sign-off therefore covers the
post-T10b state.

### Provenance comments retained (benign)

Two comments in `opendbc_repo/opendbc/car/mazda/values.py` reference
"FrogPilot" by name. Both are documentation-only attributions explaining
where helpers / state-machine layouts were ported from. Neither imports
nor calls anything FrogPilot-specific:

- Line 49: inside `apply_ti_steer_torque_limits` —
  `# Ported from FrogPilot source fork: selfdrive/car/__init__.py:112-131.`
- Line 156: inside `class TI_STATE(IntEnum)` —
  `# selfdrive/car/mazda/values.py (FrogPilot). The 4-value layout reflects the`

Verdict: **benign** (documentation-only; no functional dependency).
Wave 3-4 owner may rephrase if comment-level scrub is desired, but they do
not block Wave 5.

### SHA chain

opendbc_repo (`mazda-port-additions`):

| Wave | Task | opendbc_repo SHA | Subject |
|------|------|------------------|---------|
| 1 | T5 | `5907cdff` | mazda: import mazda_2019.dbc for GEN2 + TI support |
| 1 | T6 | `cbd0b05f` | mazda: add GEN2 + TI safety variants |
| 2 | T7 | `eec92469` | mazda: add MAZDA_3_2019 platform with GEN2 + TI flags + TI helpers |
| 2 | T12 | `b83079d7` | mazda: add MAZDA_3_2019 FW fingerprint |
| 3 | T8 | `0fa112e7` | mazda: extend interface.py for MAZDA_3_2019 (GEN2 + TI) |
| 3 | T9 | `9f08c38f` | mazda: add GEN2 EPS_LKAS + TI + ACC CAN builders |
| 3 | T9b | `e8ccc24e` | opendbc/can: add mazda_2019 checksum support |
| 4 | T10 | `eaeb4c51` | mazda: extend carcontroller.py for MAZDA_3_2019 (GEN2 ACC + TI steering) |
| 4 | T11 | `8773621e` | mazda: extend carstate.py for MAZDA_3_2019 (GEN2 + TI feedback) |
| 4 | T10b | `29db3c74` | mazda: expose ti_state and acc_values from GEN2 carstate for carcontroller |

panda (`mazda-port-additions`): `066ca435` — Mazda GEN2 + TI safety
variant flags (`FLAG_MAZDA_GEN2`, `FLAG_MAZDA_TORQUE_INTERCEPTOR`).

Parent `openpilot-comma` (`mazda-port`) submodule-bump chain (newest last):

| Wave | Parent SHA | Subject |
|------|------------|---------|
| 1 | `5b839477f` | submodule: bump opendbc_repo for mazda_2019.dbc import |
| 1 | `ea33ba5e0` | submodule: bump opendbc_repo + panda for mazda GEN2/TI safety |
| 2 | `08bd6558b` | submodule: bump opendbc_repo for MAZDA_3_2019 platform values |
| 2 | `ae723bb9b` | submodule: bump opendbc_repo for MAZDA_3_2019 fingerprint |
| 3 | `9f6ee139a` | submodule: bump opendbc_repo for MAZDA_3_2019 interface |
| 3 | `120a4625f` | submodule: bump opendbc_repo for mazda GEN2 CAN builders |
| 3 | `34a9fbcbf` | submodule: bump opendbc_repo for mazda_2019 checksum |
| 4 | `5d5fa9c42` | submodule: bump opendbc_repo for mazda GEN2 carcontroller |
| 4 | `d5f16723d` | submodule: bump opendbc_repo for mazda GEN2 carstate |
| 4 | `05587ac2a` | submodule: bump opendbc_repo for mazda carstate ti_state/acc_values |
| 5 | _this commit_ | mazda: wave 5 integration verification (docs only) |

Wave 5 sign-off: see `wave5_integration_report.md` for the full grep
matrix and the verdict.
