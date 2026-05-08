#!/usr/bin/env bash
# T17 + T18 — device-side verification for the MAZDA_3_2019 (GEN2 + Torque
# Interceptor) port. Run this on a Linux dev box or comma 3X after the macOS
# Wave 6 report (`wave6_verification_report.md`) has been read.
#
# Phases mirror `wave6_verification_report.md` so results line up 1:1.
#
# Usage:
#   bash docs/migration/T17_T18_device_verification.sh                 # full run
#   bash docs/migration/T17_T18_device_verification.sh --skip-scons    # skip Phase E
#   bash docs/migration/T17_T18_device_verification.sh --no-prereq     # skip prereq gate
#
# Idempotent: only reads code + runs pytest / scons. Writes nothing under
# opendbc_repo, panda, or selfdrive. Exit code: 0 on overall PASS, non-zero
# otherwise. The non-zero code is the bitwise OR of failed-phase masks
# documented at the bottom of this script.

set -u
set -o pipefail

# ----- argv parsing -----
SKIP_SCONS=0
SKIP_PREREQ=0
for arg in "$@"; do
  case "$arg" in
    --skip-scons) SKIP_SCONS=1 ;;
    --no-prereq)  SKIP_PREREQ=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      echo "unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

# ----- locate parent repo -----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OPENDBC="${PARENT}/opendbc_repo"
PANDA="${PARENT}/panda"

cd "${PARENT}"

# ----- expected pins (from Wave 5 / Wave 6) -----
EXPECTED_BRANCH="mazda-port"
EXPECTED_OPENDBC_SHA="29db3c74188ec27618b2202a8d57191bf72549a7"
EXPECTED_PANDA_SHA="066ca435619c7e25d1f9f9c75e29f0759d608ff7"

# ----- fail accumulator (bitmask) -----
FAIL=0
BIT_PREREQ=1     # 0x01
BIT_PHASE_B=2    # 0x02
BIT_PHASE_C=4    # 0x04
BIT_PHASE_D=8    # 0x08
BIT_PHASE_E=16   # 0x10

note()   { printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
header() { printf "\n========== %s ==========\n" "$*"; }
pass()   { printf "  PASS  %s\n" "$*"; }
fail()   { printf "  FAIL  %s\n" "$*"; }
skip()   { printf "  SKIP  %s\n" "$*"; }

# ----- PHASE PREREQ -----
header "PREREQ"
if [ "${SKIP_PREREQ}" -eq 1 ]; then
  skip "prereq gate (--no-prereq)"
else
  cur_branch="$(git -C "${PARENT}" branch --show-current 2>/dev/null || echo '?')"
  if [ "${cur_branch}" = "${EXPECTED_BRANCH}" ]; then
    pass "branch == ${EXPECTED_BRANCH}"
  else
    fail "branch is '${cur_branch}', expected '${EXPECTED_BRANCH}'"
    FAIL=$((FAIL | BIT_PREREQ))
  fi

  # working tree may have uncommitted docs; only fail if Mazda code dirty
  dirty="$(git -C "${PARENT}" status --porcelain -- \
            opendbc_repo opendbc_repo/opendbc/car/mazda \
            opendbc_repo/opendbc/safety/modes/mazda.h \
            opendbc_repo/opendbc/safety/tests/test_mazda.py \
            opendbc_repo/opendbc/can/dbc.py panda 2>/dev/null || true)"
  if [ -z "${dirty}" ]; then
    pass "Mazda code paths clean (no uncommitted changes)"
  else
    fail "uncommitted changes in Mazda code paths:"
    printf "%s\n" "${dirty}" | sed 's/^/    /'
    FAIL=$((FAIL | BIT_PREREQ))
  fi

  opendbc_sha="$(git -C "${OPENDBC}" rev-parse HEAD 2>/dev/null || echo '?')"
  if [ "${opendbc_sha}" = "${EXPECTED_OPENDBC_SHA}" ]; then
    pass "opendbc_repo @ ${EXPECTED_OPENDBC_SHA:0:8}"
  else
    fail "opendbc_repo HEAD is ${opendbc_sha:0:8}, expected ${EXPECTED_OPENDBC_SHA:0:8}"
    FAIL=$((FAIL | BIT_PREREQ))
  fi

  panda_sha="$(git -C "${PANDA}" rev-parse HEAD 2>/dev/null || echo '?')"
  if [ "${panda_sha}" = "${EXPECTED_PANDA_SHA}" ]; then
    pass "panda @ ${EXPECTED_PANDA_SHA:0:8}"
  else
    fail "panda HEAD is ${panda_sha:0:8}, expected ${EXPECTED_PANDA_SHA:0:8}"
    FAIL=$((FAIL | BIT_PREREQ))
  fi

  # tooling
  for tool in python3 cc; do
    if command -v "${tool}" >/dev/null 2>&1; then
      pass "${tool} present ($(command -v "${tool}"))"
    else
      fail "${tool} missing"
      FAIL=$((FAIL | BIT_PREREQ))
    fi
  done
fi

# ----- pick a Python interpreter -----
# Prefer the parent's uv-managed .venv if present, else fall back to system.
if [ -x "${PARENT}/.venv/bin/python3" ]; then
  PY="${PARENT}/.venv/bin/python3"
  note "using parent .venv: ${PY}"
elif command -v uv >/dev/null 2>&1 && [ -f "${PARENT}/pyproject.toml" ]; then
  note "no .venv found; running 'uv sync --extra testing' (lockfile only)..."
  ( cd "${PARENT}" && uv sync --extra testing ) || true
  if [ -x "${PARENT}/.venv/bin/python3" ]; then
    PY="${PARENT}/.venv/bin/python3"
  else
    PY="$(command -v python3)"
  fi
else
  PY="$(command -v python3)"
fi
note "python = ${PY}"

# ----- PHASE B (static) -----
header "PHASE B — static py_compile + forbidden-token scrub"

py_files=(
  "${OPENDBC}/opendbc/car/mazda/values.py"
  "${OPENDBC}/opendbc/car/mazda/interface.py"
  "${OPENDBC}/opendbc/car/mazda/carstate.py"
  "${OPENDBC}/opendbc/car/mazda/carcontroller.py"
  "${OPENDBC}/opendbc/car/mazda/mazdacan.py"
  "${OPENDBC}/opendbc/car/mazda/fingerprints.py"
  "${OPENDBC}/opendbc/can/dbc.py"
)
"${PY}" -m py_compile "${py_files[@]}"
rc=$?
if [ "${rc}" -eq 0 ]; then
  pass "py_compile (7 files) exit:0"
else
  fail "py_compile exit:${rc}"
  FAIL=$((FAIL | BIT_PHASE_B))
fi

# GREP-1: functional FrogPilot tokens. Two benign provenance comments are
# expected at values.py:49 and values.py:156. Anything else = blocker.
g1="$(grep -nrE 'frogpilot_toggles|FrogPilot|fp_ret|FPCP' \
       "${OPENDBC}/opendbc/car/mazda/" \
       "${OPENDBC}/opendbc/safety/modes/mazda.h" \
       "${OPENDBC}/opendbc/safety/tests/test_mazda.py" 2>/dev/null || true)"
expected_g1="$(printf "%s\n%s\n" \
  "${OPENDBC}/opendbc/car/mazda/values.py:49:  # Ported from FrogPilot source fork: selfdrive/car/__init__.py:112-131." \
  "${OPENDBC}/opendbc/car/mazda/values.py:156:  # selfdrive/car/mazda/values.py (FrogPilot). The 4-value layout reflects the")"
if [ "${g1}" = "${expected_g1}" ]; then
  pass "GREP-1 functional FrogPilot tokens: only 2 benign provenance comments"
else
  fail "GREP-1 unexpected matches (functional FrogPilot tokens leaked):"
  printf "%s\n" "${g1}" | sed 's/^/    /'
  FAIL=$((FAIL | BIT_PHASE_B))
fi

# GREP-2: dropped-feature tokens
g2="$(grep -nrE '/dev/shm|BlendedACC|CEStatus|ManualTransmission|TorqueInterceptorEnabled|RadarInterceptorEnabled|NoMRCC|NoFSC' \
       "${OPENDBC}/opendbc/car/mazda/" 2>/dev/null || true)"
if [ -z "${g2}" ]; then
  pass "GREP-2 dropped-feature tokens: clean"
else
  fail "GREP-2 dropped-feature tokens leaked:"
  printf "%s\n" "${g2}" | sed 's/^/    /'
  FAIL=$((FAIL | BIT_PHASE_B))
fi

# GREP-3: unanchored Params constructions
g3="$(grep -nE '(^|[^a-zA-Z_])Params\(' "${OPENDBC}"/opendbc/car/mazda/*.py 2>/dev/null || true)"
if [ -z "${g3}" ]; then
  pass "GREP-3 unanchored Params: clean"
else
  fail "GREP-3 unanchored Params constructions:"
  printf "%s\n" "${g3}" | sed 's/^/    /'
  FAIL=$((FAIL | BIT_PHASE_B))
fi

# ----- PHASE C (import smoke) -----
header "PHASE C — import smoke + checksum trace"
( cd "${OPENDBC}" && PYTHONPATH="${OPENDBC}" "${PY}" - <<'PYEOF'
from opendbc.car.mazda.values import CAR, MazdaFlags, TI_STATE, apply_ti_steer_torque_limits, CarControllerParams
from opendbc.car.mazda.interface import CarInterface
from opendbc.car.mazda.carstate import CarState
from opendbc.car.mazda.carcontroller import CarController
from opendbc.car.mazda.mazdacan import mazda2019_checksum, create_steering_control_gen2, create_acc_cmd
from opendbc.car.mazda.fingerprints import FW_VERSIONS
from opendbc.can.dbc import get_checksum_state

p = CAR.MAZDA_3_2019
flags = p.config.flags
assert flags & MazdaFlags.GEN2 and flags & MazdaFlags.TORQUE_INTERCEPTOR, f"flags={hex(flags)}"

state = get_checksum_state('mazda_2019')
assert state is not None, "mazda_2019 checksum not registered"
assert callable(state.calc_checksum), "calc_checksum missing"

assert mazda2019_checksum(0x220, None, bytearray([1,2,3,4,5,6,7])) == 0x46
assert mazda2019_checksum(0x249, None, bytearray([0]*7)) == 0x53
print("IMPORT_SMOKE: OK  flags=", hex(flags))
PYEOF
)
rc=$?
if [ "${rc}" -eq 0 ]; then
  pass "import smoke + checksum trace exit:0"
else
  fail "import smoke exit:${rc}"
  FAIL=$((FAIL | BIT_PHASE_C))
fi

# ----- PHASE D (pytest) -----
header "PHASE D — panda safety pytest (test_mazda.py)"
# `addopts` in parent pyproject.toml uses `-n auto --dist=loadgroup` (xdist).
# We override with `-o addopts=` and `--confcutdir=opendbc_repo` so the parent
# `conftest.py` (which imports openpilot.common.params_pyx) doesn't get
# pulled in. Run pytest from inside opendbc_repo so the test paths resolve.
( cd "${OPENDBC}" && \
  "${PY}" -m pytest opendbc/safety/tests/test_mazda.py -v \
    --rootdir="${OPENDBC}" \
    --confcutdir="${OPENDBC}" \
    -o addopts= \
    --tb=short )
rc=$?
if [ "${rc}" -eq 0 ]; then
  pass "pytest test_mazda.py exit:0"
else
  fail "pytest test_mazda.py exit:${rc}"
  FAIL=$((FAIL | BIT_PHASE_D))
fi

# ----- PHASE E (scons) -----
header "PHASE E — scons build (parent SConstruct)"
if [ "${SKIP_SCONS}" -eq 1 ]; then
  skip "scons (--skip-scons)"
elif ! command -v scons >/dev/null 2>&1 && [ ! -x "${PARENT}/.venv/bin/scons" ]; then
  skip "scons not available on PATH or in .venv"
else
  SCONS_BIN="${PARENT}/.venv/bin/scons"
  [ -x "${SCONS_BIN}" ] || SCONS_BIN="$(command -v scons)"
  note "scons = ${SCONS_BIN}"
  # dry-run first to surface SConstruct import errors fast
  ( cd "${PARENT}" && "${SCONS_BIN}" --dry-run --minimal 2>&1 | tail -40 )
  drc=${PIPESTATUS[0]}
  if [ "${drc}" -ne 0 ]; then
    fail "scons --dry-run --minimal exit:${drc}"
    FAIL=$((FAIL | BIT_PHASE_E))
  else
    pass "scons --dry-run --minimal exit:0"
    # real build, scoped to opendbc_repo to keep it cheap
    ( cd "${PARENT}" && "${SCONS_BIN}" --minimal opendbc_repo/ -j2 2>&1 | tail -60 )
    brc=${PIPESTATUS[0]}
    if [ "${brc}" -eq 0 ]; then
      pass "scons --minimal opendbc_repo/ exit:0"
    else
      fail "scons --minimal opendbc_repo/ exit:${brc}"
      FAIL=$((FAIL | BIT_PHASE_E))
    fi
  fi
fi

# ----- summary -----
header "SUMMARY"
if [ "${FAIL}" -eq 0 ]; then
  printf "Wave 6 device verification: PASS\n"
  exit 0
else
  printf "Wave 6 device verification: FAIL  (mask=0x%02x)\n" "${FAIL}"
  printf "  bit 0x01 PREREQ      %s\n" "$( [ $((FAIL & BIT_PREREQ))  -ne 0 ] && echo FAIL || echo pass )"
  printf "  bit 0x02 Phase B     %s\n" "$( [ $((FAIL & BIT_PHASE_B)) -ne 0 ] && echo FAIL || echo pass )"
  printf "  bit 0x04 Phase C     %s\n" "$( [ $((FAIL & BIT_PHASE_C)) -ne 0 ] && echo FAIL || echo pass )"
  printf "  bit 0x08 Phase D     %s\n" "$( [ $((FAIL & BIT_PHASE_D)) -ne 0 ] && echo FAIL || echo pass )"
  printf "  bit 0x10 Phase E     %s\n" "$( [ $((FAIL & BIT_PHASE_E)) -ne 0 ] && echo FAIL || echo pass )"
  exit "${FAIL}"
fi
