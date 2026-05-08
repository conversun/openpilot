#!/usr/bin/env bash
# =============================================================================
# T21_cabana_capture.sh
# Wave 7 — GEN2 + TI2 port: post-drive route capture and pre-packaging
#
# PURPOSE:
#   After a CP-A, CP-B, or CP-C drive, run this script on your Linux dev box
#   to pull the most recent route from the comma 3X, extract the relevant CAN
#   streams, and pre-package them for process_replay consumption.
#
# SAFETY:
#   - Read-only operations only. No destructive ops. No auto-uploads.
#   - No auto-flashing. No submodule bumps.
#   - Will not overwrite existing output directories without --force.
#
# USAGE:
#   ./T21_cabana_capture.sh [OPTIONS]
#
# OPTIONS:
#   --device-ip <IP>      IP address of comma 3X (default: 192.168.43.1)
#   --route <ROUTE_ID>    Specific route ID to pull (default: most recent)
#   --output-dir <DIR>    Where to write extracted logs (default: ./t21_captures)
#   --cp <A|B|C>          Checkpoint label for this capture (default: A)
#   --force               Overwrite existing output directory if it exists
#   --dry-run             Print what would be done without doing it
#   --help                Show this help
#
# REQUIREMENTS:
#   - ssh access to comma 3X (default: comma@192.168.43.1)
#   - Python 3.9+ with openpilot tools installed (pip install -e tools/)
#   - jq (for JSON parsing): apt install jq / brew install jq
#
# TODO (user customization):
#   - If your device IP differs from 192.168.43.1, set --device-ip
#   - If you use a different SSH key, set SSH_KEY below
#   - The log path on device is assumed to be /data/media/0/realdata/
#     Adjust LOG_PATH_ON_DEVICE if your device uses a different path
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration defaults (override via flags or environment variables)
# ---------------------------------------------------------------------------
DEVICE_IP="${COMMA_DEVICE_IP:-192.168.43.1}"
DEVICE_USER="${COMMA_DEVICE_USER:-comma}"
SSH_KEY="${COMMA_SSH_KEY:-}"                          # leave empty to use default key
LOG_PATH_ON_DEVICE="/data/media/0/realdata"           # TODO: verify on your device
OPENPILOT_DIR="${OPENPILOT_DIR:-$(pwd)}"
OUTPUT_DIR="./t21_captures"
ROUTE_ID=""
CP_LABEL="A"
FORCE=0
DRY_RUN=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
warn() { echo "[$(date '+%H:%M:%S')] WARN: $*" >&2; }
die()  { echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2; exit 1; }

usage() {
  grep '^#' "$0" | grep -v '^#!/' | sed 's/^# \?//'
  exit 0
}

ssh_cmd() {
  local ssh_opts="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes"
  if [[ -n "$SSH_KEY" ]]; then
    ssh_opts="$ssh_opts -i $SSH_KEY"
  fi
  # shellcheck disable=SC2086
  ssh $ssh_opts "${DEVICE_USER}@${DEVICE_IP}" "$@"
}

scp_cmd() {
  local scp_opts="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes"
  if [[ -n "$SSH_KEY" ]]; then
    scp_opts="$scp_opts -i $SSH_KEY"
  fi
  # shellcheck disable=SC2086
  scp $scp_opts "$@"
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --device-ip)   DEVICE_IP="$2";    shift 2 ;;
    --route)       ROUTE_ID="$2";     shift 2 ;;
    --output-dir)  OUTPUT_DIR="$2";   shift 2 ;;
    --cp)          CP_LABEL="$2";     shift 2 ;;
    --force)       FORCE=1;           shift   ;;
    --dry-run)     DRY_RUN=1;         shift   ;;
    --help|-h)     usage ;;
    *) die "Unknown argument: $1. Use --help for usage." ;;
  esac
done

CP_LABEL="${CP_LABEL^^}"  # uppercase
[[ "$CP_LABEL" =~ ^[ABC]$ ]] || die "CP must be A, B, or C. Got: $CP_LABEL"

# ---------------------------------------------------------------------------
# Phase 1: Verify connectivity to comma 3X
# ---------------------------------------------------------------------------
log "=== Phase 1: Device connectivity ==="

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "[DRY RUN] Would SSH to ${DEVICE_USER}@${DEVICE_IP}"
else
  log "Connecting to ${DEVICE_USER}@${DEVICE_IP} ..."
  if ! ssh_cmd "echo 'connected'" > /dev/null 2>&1; then
    die "Cannot connect to comma 3X at ${DEVICE_IP}. Check:
  1. Device is powered on and connected to your hotspot/network
  2. IP address is correct (try: arp -a | grep comma)
  3. SSH is enabled on device (Settings > Developer > Enable SSH)
  4. Your SSH key is authorized on the device"
  fi
  log "Connected."

  # Verify openpilot is present on device
  DEVICE_SHA=$(ssh_cmd "cd /data/openpilot && git rev-parse HEAD 2>/dev/null || echo MISSING")
  log "Device openpilot SHA: $DEVICE_SHA"
  if [[ "$DEVICE_SHA" == "MISSING" ]]; then
    warn "openpilot not found at /data/openpilot on device. Log path may differ."
  fi
fi

# ---------------------------------------------------------------------------
# Phase 2: Find the target route
# ---------------------------------------------------------------------------
log "=== Phase 2: Route discovery ==="

if [[ -z "$ROUTE_ID" ]]; then
  log "No --route specified. Finding most recent route on device ..."
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[DRY RUN] Would list ${LOG_PATH_ON_DEVICE} on device"
    ROUTE_ID="<MOST_RECENT_ROUTE>"
    ROUTE_DIR="${LOG_PATH_ON_DEVICE}/${ROUTE_ID}"
  else
    # List route directories sorted by modification time, pick the newest
    # Route dirs are named like: <dongle_id>|<date>--<time>
    ROUTE_DIR=$(ssh_cmd "ls -dt ${LOG_PATH_ON_DEVICE}/*/ 2>/dev/null | head -1 | tr -d '\n'")
    if [[ -z "$ROUTE_DIR" ]]; then
      die "No route directories found at ${LOG_PATH_ON_DEVICE}. Did you drive yet?"
    fi
    ROUTE_ID=$(basename "$ROUTE_DIR")
    log "Most recent route: $ROUTE_ID"
  fi
else
  ROUTE_DIR="${LOG_PATH_ON_DEVICE}/${ROUTE_ID}"
  log "Using specified route: $ROUTE_ID"
fi

# ---------------------------------------------------------------------------
# Phase 3: Prepare output directory
# ---------------------------------------------------------------------------
log "=== Phase 3: Output directory ==="

CAPTURE_DIR="${OUTPUT_DIR}/CP${CP_LABEL}_$(date '+%Y%m%d_%H%M%S')"

if [[ -d "$CAPTURE_DIR" ]] && [[ "$FORCE" -eq 0 ]]; then
  die "Output directory already exists: $CAPTURE_DIR. Use --force to overwrite."
fi

if [[ "$DRY_RUN" -eq 0 ]]; then
  mkdir -p "$CAPTURE_DIR"
  log "Output directory: $CAPTURE_DIR"
else
  log "[DRY RUN] Would create: $CAPTURE_DIR"
fi

# ---------------------------------------------------------------------------
# Phase 4: Pull route segments from device
# ---------------------------------------------------------------------------
log "=== Phase 4: Pulling route segments ==="

# Route segments are stored as numbered directories: 0, 1, 2, ...
# Each segment contains: rlog.bz2 (main log), qlog.bz2 (quick log),
# fcamera.hevc (front camera), optionally dcamera.hevc (driver camera)
# We only need rlog.bz2 for process replay.

if [[ "$DRY_RUN" -eq 1 ]]; then
  log "[DRY RUN] Would pull segments from ${ROUTE_DIR} on device"
else
  log "Listing segments in route ..."
  SEGMENTS=$(ssh_cmd "ls -d ${ROUTE_DIR}/*/ 2>/dev/null | xargs -I{} basename {} | sort -n" || echo "")

  if [[ -z "$SEGMENTS" ]]; then
    # Some routes store logs directly in the route dir, not in subdirs
    SEGMENTS="."
    log "No subdirectories found; treating route dir as single segment"
  else
    log "Found segments: $(echo "$SEGMENTS" | tr '\n' ' ')"
  fi

  SEGMENT_COUNT=0
  for SEG in $SEGMENTS; do
    if [[ "$SEG" == "." ]]; then
      SRC_DIR="$ROUTE_DIR"
      DST_DIR="$CAPTURE_DIR/segment_0"
    else
      SRC_DIR="${ROUTE_DIR}/${SEG}"
      DST_DIR="${CAPTURE_DIR}/segment_${SEG}"
    fi

    mkdir -p "$DST_DIR"

    # Pull rlog (main log — contains all CAN, carState, carControl, etc.)
    if ssh_cmd "test -f ${SRC_DIR}/rlog.bz2"; then
      log "Pulling segment ${SEG}: rlog.bz2 ..."
      scp_cmd "${DEVICE_USER}@${DEVICE_IP}:${SRC_DIR}/rlog.bz2" "${DST_DIR}/"
      SEGMENT_COUNT=$((SEGMENT_COUNT + 1))
    elif ssh_cmd "test -f ${SRC_DIR}/rlog"; then
      log "Pulling segment ${SEG}: rlog (uncompressed) ..."
      scp_cmd "${DEVICE_USER}@${DEVICE_IP}:${SRC_DIR}/rlog" "${DST_DIR}/"
      SEGMENT_COUNT=$((SEGMENT_COUNT + 1))
    else
      warn "No rlog found in segment ${SEG}. Skipping."
    fi

    # Also pull qlog for quick stats (small file)
    if ssh_cmd "test -f ${SRC_DIR}/qlog.bz2"; then
      scp_cmd "${DEVICE_USER}@${DEVICE_IP}:${SRC_DIR}/qlog.bz2" "${DST_DIR}/" 2>/dev/null || true
    fi
  done

  log "Pulled $SEGMENT_COUNT segment(s)."
  [[ "$SEGMENT_COUNT" -eq 0 ]] && die "No segments pulled. Check route path on device."
fi

# ---------------------------------------------------------------------------
# Phase 5: Extract CAN bus streams
# ---------------------------------------------------------------------------
log "=== Phase 5: CAN stream extraction ==="

# This phase uses the openpilot LogReader to extract CAN messages
# from the relevant buses and write a summary.

EXTRACT_SCRIPT="${CAPTURE_DIR}/extract_can.py"

cat > "$EXTRACT_SCRIPT" << 'PYEOF'
#!/usr/bin/env python3
"""
Extract CAN bus 0/1/2 streams from a route segment and produce a summary.
Relevant messages for GEN2 + TI2:
  Bus 0: STEER_TORQUE (0x240), CRZ_CTRL (0x0), general vehicle bus
  Bus 1: EPS_LKAS (0x249), EPS_FEEDBACK (0x24B), TI_FEEDBACK (0x24A)
  Bus 2: ACC (0x220)
"""
import sys
import os
import json
from pathlib import Path

# Add openpilot to path
OPENPILOT_DIR = os.environ.get("OPENPILOT_DIR", os.getcwd())
sys.path.insert(0, OPENPILOT_DIR)

try:
    from openpilot.tools.lib.logreader import LogReader
except ImportError:
    print("ERROR: Cannot import openpilot tools. Set OPENPILOT_DIR env var.")
    sys.exit(1)

CAPTURE_DIR = sys.argv[1] if len(sys.argv) > 1 else "."
ROUTE_ID    = sys.argv[2] if len(sys.argv) > 2 else "unknown"

# CAN IDs of interest (decimal)
INTERESTING_IDS = {
    0x249: "EPS_LKAS",
    0x24A: "TI_FEEDBACK",
    0x24B: "EPS_FEEDBACK",
    0x220: "ACC",
    0x240: "STEER_TORQUE",
}

stats = {
    "route_id": ROUTE_ID,
    "segments_processed": 0,
    "total_can_frames": 0,
    "frames_by_id": {},
    "bus_frame_counts": {0: 0, 1: 0, 2: 0},
    "ti_state_transitions": [],
    "steer_fault_permanent_frames": 0,
    "lat_active_frames": 0,
    "long_active_frames": 0,
    "accel_min": float("inf"),
    "accel_max": float("-inf"),
    "bad_accel_frames": 0,
}

import math

for seg_dir in sorted(Path(CAPTURE_DIR).glob("segment_*")):
    rlog = seg_dir / "rlog.bz2"
    if not rlog.exists():
        rlog = seg_dir / "rlog"
    if not rlog.exists():
        continue

    stats["segments_processed"] += 1
    try:
        lr = LogReader(str(rlog))
    except Exception as e:
        print(f"  WARNING: Could not read {rlog}: {e}")
        continue

    prev_ti_state = None

    for msg in lr:
        which = msg.which()

        if which == "can":
            for frame in msg.can:
                stats["total_can_frames"] += 1
                bus = frame.src
                addr = frame.address
                if bus in stats["bus_frame_counts"]:
                    stats["bus_frame_counts"][bus] += 1
                key = f"0x{addr:03X}_bus{bus}"
                stats["frames_by_id"][key] = stats["frames_by_id"].get(key, 0) + 1

        elif which == "carState":
            cs = msg.carState
            if cs.steerFaultPermanent:
                stats["steer_fault_permanent_frames"] += 1

        elif which == "carControl":
            cc = msg.carControl
            if cc.latActive:
                stats["lat_active_frames"] += 1
            if cc.longActive:
                stats["long_active_frames"] += 1
            a = cc.actuators.accel
            if not math.isnan(a):
                stats["accel_min"] = min(stats["accel_min"], a)
                stats["accel_max"] = max(stats["accel_max"], a)
                if abs(a) > 5.0:
                    stats["bad_accel_frames"] += 1

# Clean up infinities
if stats["accel_min"] == float("inf"):
    stats["accel_min"] = None
if stats["accel_max"] == float("-inf"):
    stats["accel_max"] = None

# Print summary
print("\n=== CAN CAPTURE SUMMARY ===")
print(f"Route ID:          {stats['route_id']}")
print(f"Segments:          {stats['segments_processed']}")
print(f"Total CAN frames:  {stats['total_can_frames']}")
print(f"Bus 0 frames:      {stats['bus_frame_counts'][0]}")
print(f"Bus 1 frames:      {stats['bus_frame_counts'][1]}")
print(f"Bus 2 frames:      {stats['bus_frame_counts'][2]}")
print(f"Lat active frames: {stats['lat_active_frames']}")
print(f"Long active frames:{stats['long_active_frames']}")
if stats["accel_min"] is not None:
    print(f"Accel range:       [{stats['accel_min']:.3f}, {stats['accel_max']:.3f}] m/s²")
print(f"Bad accel frames:  {stats['bad_accel_frames']}  (|accel| > 5 m/s²)")
print(f"steerFaultPermanent frames: {stats['steer_fault_permanent_frames']}")

print("\nFrames by interesting CAN ID:")
for addr_hex, name in sorted(INTERESTING_IDS.items(), key=lambda x: x[0]):
    for bus in [0, 1, 2]:
        key = f"0x{addr_hex:03X}_bus{bus}"
        count = stats["frames_by_id"].get(key, 0)
        if count > 0:
            print(f"  {name:20s} (0x{addr_hex:03X} bus {bus}): {count} frames")

# Write JSON summary
summary_path = Path(CAPTURE_DIR) / "summary.json"
with open(summary_path, "w") as f:
    json.dump(stats, f, indent=2)
print(f"\nSummary written to: {summary_path}")

# Pass/fail assessment
print("\n=== PASS/FAIL ASSESSMENT ===")
issues = []
if stats["bad_accel_frames"] > 0:
    issues.append(f"FAIL: {stats['bad_accel_frames']} bad accel frames (|accel| > 5 m/s²)")
if stats["steer_fault_permanent_frames"] > 0:
    issues.append(f"FAIL: {stats['steer_fault_permanent_frames']} steerFaultPermanent frames")
if stats["lat_active_frames"] == 0:
    issues.append("WARN: No lat_active frames found — did openpilot engage?")

eps_lkas_key = "0x249_bus1"
ti_fb_key    = "0x24A_bus1"
acc_key      = "0x220_bus2"

if stats["frames_by_id"].get(eps_lkas_key, 0) == 0:
    issues.append("WARN: No EPS_LKAS (0x249 bus1) frames — TI2 CAN passthrough may be broken")
if stats["frames_by_id"].get(ti_fb_key, 0) == 0:
    issues.append("WARN: No TI_FEEDBACK (0x24A bus1) frames — TI2 not communicating")
if stats["frames_by_id"].get(acc_key, 0) == 0:
    issues.append("INFO: No ACC (0x220 bus2) frames — expected if this is CP-A or CP-B (lateral only)")

if issues:
    for issue in issues:
        print(f"  {issue}")
else:
    print("  PASS: No issues detected in summary stats")
PYEOF

if [[ "$DRY_RUN" -eq 0 ]]; then
  log "Running CAN extraction script ..."
  OPENPILOT_DIR="$OPENPILOT_DIR" python3 "$EXTRACT_SCRIPT" "$CAPTURE_DIR" "$ROUTE_ID" \
    || warn "Extraction script failed. Check Python environment and OPENPILOT_DIR."
else
  log "[DRY RUN] Would run: python3 $EXTRACT_SCRIPT $CAPTURE_DIR $ROUTE_ID"
fi

# ---------------------------------------------------------------------------
# Phase 6: Write metadata file
# ---------------------------------------------------------------------------
log "=== Phase 6: Writing metadata ==="

META_FILE="${CAPTURE_DIR}/capture_meta.txt"

if [[ "$DRY_RUN" -eq 0 ]]; then
  cat > "$META_FILE" << EOF
T21 Cabana Capture Metadata
============================
Capture date:    $(date '+%Y-%m-%d %H:%M:%S')
Checkpoint:      CP-${CP_LABEL}
Route ID:        ${ROUTE_ID}
Device IP:       ${DEVICE_IP}
Device SHA:      ${DEVICE_SHA:-unknown}
Output dir:      ${CAPTURE_DIR}
Script version:  Wave 7 / T21

CAN IDs of interest:
  EPS_LKAS     0x249  bus 1  (TI2 -> EPS torque command)
  TI_FEEDBACK  0x24A  bus 1  (TI2 state, torque sensor, version)
  EPS_FEEDBACK 0x24B  bus 1  (EPS steer angle, torque feedback)
  ACC          0x220  bus 2  (GEN2 ACC command from openpilot)
  STEER_TORQUE 0x240  bus 0  (driver torque sensor)

Next steps:
  1. Review summary.json for pass/fail assessment
  2. Open route in cabana: https://connect.comma.ai (search by route ID)
  3. Run process replay:
     cd ${OPENPILOT_DIR}
     python3 selfdrive/test/process_replay/process_replay.py \\
       --whitelist-procs controlsd \\
       --whitelist-cars MAZDA \\
       ${ROUTE_ID}
  4. Fill in T21_followup_log.md with results
EOF
  log "Metadata written to: $META_FILE"
else
  log "[DRY RUN] Would write metadata to: $META_FILE"
fi

# ---------------------------------------------------------------------------
# Phase 7: Final summary
# ---------------------------------------------------------------------------
log "=== Phase 7: Summary ==="
log ""
log "  Checkpoint:   CP-${CP_LABEL}"
log "  Route ID:     ${ROUTE_ID}"
log "  Output dir:   ${CAPTURE_DIR}"
log ""
log "Attach the route ID and output directory path to your T21_followup_log.md."
log ""
log "To open in cabana:"
log "  https://connect.comma.ai  (search for route ID: ${ROUTE_ID})"
log ""
log "To run process replay:"
log "  cd ${OPENPILOT_DIR}"
log "  python3 selfdrive/test/process_replay/process_replay.py \\"
log "    --whitelist-procs controlsd \\"
log "    --whitelist-cars MAZDA \\"
log "    ${ROUTE_ID}"
log ""
log "Done."
