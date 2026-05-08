# T17 + T18 — Device Verification Results (Template)

Fill this in after running `docs/migration/T17_T18_device_verification.sh` on
your Linux dev box (or comma 3X). One row per phase; copy/paste the
exit-code line from the script output. Submit the filled-in template back to
the Wave 6 reviewer (or attach to the Wave 7 bring-up issue).

---

## Run metadata

| Field                         | Value                                       |
|-------------------------------|---------------------------------------------|
| Date / time (UTC)             | `<YYYY-MM-DD HH:MM>`                        |
| Operator                      | `<name>`                                    |
| Host                          | `<linux-dev-box | comma-3X-serial>`         |
| OS / kernel                   | `<uname -srm>`                              |
| Python interpreter used       | `<full path>` (`python3 --version` output)  |
| `git rev-parse HEAD` (parent) | `<sha>`                                     |
| `git rev-parse HEAD` opendbc  | `<sha>` (expected `29db3c74…`)              |
| `git rev-parse HEAD` panda    | `<sha>` (expected `066ca435…`)              |
| Script flags used             | `<none | --skip-scons | --no-prereq | …>`   |
| Script overall exit code      | `<0 = PASS, otherwise = bitmask>`           |

---

## Phase results

| Phase   | Description                              | Result          | Notes                                |
|---------|------------------------------------------|-----------------|--------------------------------------|
| PREREQ  | branch / submodule SHAs / `cc` / `python3` | `PASS / FAIL` |                                      |
| B       | `py_compile` matrix + 3-grep scrub       | `PASS / FAIL`   | GREP-1 must show only the 2 benign provenance comments |
| C       | import smoke + checksum trace            | `PASS / FAIL`   | Expect `IMPORT_SMOKE: OK  flags= 0xa`|
| D       | panda safety pytest                      | `PASS / FAIL`   | Expected: 79 passed / 15 skipped / 0 failed (see *Open issues* below) |
| E       | scons `--minimal opendbc_repo/`          | `PASS / FAIL / SKIP` | SKIP allowed if env can't host vendored deps |

---

## Phase D — per-test-case status

Pytest reports one `setUp` per test, but the matrix below tracks the
flag-combo coverage that T18 was designed to exercise. Mark each row.

| Test class                | Flag combo                                   | Result     | Failing tests (if any)         |
|---------------------------|----------------------------------------------|------------|--------------------------------|
| `TestMazdaSafety`         | `FLAG_MAZDA_GEN1` (implicit, FLAGS=0)        | `PASS / FAIL` |                              |
| `TestMazdaGen2Safety`     | `FLAG_MAZDA_GEN2` (FLAGS=0x02)               | `PASS / FAIL` |                              |
| `TestMazdaGen2TiSafety`   | `FLAG_MAZDA_GEN2 \| FLAG_MAZDA_TORQUE_INTERCEPTOR` (FLAGS=0x0a) | `PASS / FAIL` | |

If `test_tx_hook_on_wrong_safety_mode` fails for `TestMazdaGen2Safety` and/or
`TestMazdaGen2TiSafety` with `transmit of addr=0x249 bus=1 ... was allowed`,
that matches the macOS Wave 6 result and is a **known panda-test-framework
gap, not a safety-logic bug**. See `wave6_verification_report.md` Phase D
for root cause + the recommended one-line fix in
`opendbc/safety/tests/common.py`.

---

## Open issues / blockers

List anything that surfaced during the run that is *not* covered by the
known macOS deltas in `wave6_verification_report.md`.

1. _<issue>_
2. _<issue>_

---

## Sign-off

- [ ] All phases above are PASS, **or** the only failures are explicitly
      called out in `wave6_verification_report.md` *Open issues* and have an
      assigned follow-up task tag (`T6 follow-up`, `T17 follow-up`, …).
- [ ] No new `frogpilot_toggles | FrogPilot | fp_ret | FPCP` matches beyond
      the two benign comments in `mazda/values.py:49,156`.
- [ ] `git status` on parent / opendbc_repo / panda is clean.
- [ ] No code touched by this verification run (read-only).

**Device verdict** (circle one): `PASS` / `PASS_WITH_NOTES` / `FAIL`

Operator signature: `<name>`
