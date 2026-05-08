# T21: On-Vehicle Bring-Up Checklist — GEN2 + TI2 Port

**Wave 7 deliverable.** This is the runbook you follow during your first drives on the new firmware. Work through it in order. Do not skip sections. Do not proceed to the next checkpoint (CP) until the current one is signed off.

---

## Pre-Flight Prerequisites

Complete every item here before you get in the car.

### Code State

| Check | Expected | How to verify |
|-------|----------|---------------|
| Branch | `mazda-port` (or `mazda-frogpilot` if you haven't renamed) | `git branch --show-current` |
| Parent HEAD | `f0526a2c13cee48dd4dae1fea76d90805105f261` | `git rev-parse HEAD` |
| panda submodule | `f0526a2c13cee48dd4dae1fea76d90805105f261` | `git -C panda rev-parse HEAD` |
| opendbc_repo submodule | check against your T18b landing SHA | `git -C opendbc_repo rev-parse HEAD` |
| Firmware flashed to comma 3X | same commit as above | `ssh comma@<device-ip> "cd /data/openpilot && git rev-parse HEAD"` |

If any of these don't match, stop. Reflash before continuing.

### Wave 6 Verification Gate

The Wave 6 device verification script (`T17_T18_device_verification.sh`) must have been run on a Linux dev box and **passed all phases including pytest with 0 failures**. If you haven't done this, stop here and complete Wave 6 first.

Specifically, the following must be true:
- `py_compile` passed on all mazda Python files
- All imports resolved cleanly
- `pytest tests/safety/test_mazda.py` passed (77 tests, 0 failures)
- Static grep matrix showed no unexpected references

If you skipped Wave 6 or it had failures, do not proceed.

### Environment

- [ ] Empty parking lot or very low-traffic road available for CP-A
- [ ] Quiet straight road available for CP-B (no intersections, no pedestrians)
- [ ] Quiet 4-lane highway available for CP-C (after CP-A and CP-B are signed off)
- [ ] Phone charged, connect.comma.ai accessible (for route capture)
- [ ] You've read and acknowledged the safety warnings below

---

## Safety Warnings

**Read these. Acknowledge them. Then proceed.**

> **openpilot is alpha software running on a previously unsupported car configuration. You are the test pilot. The system has not been validated on your specific vehicle. Always keep your hands near the wheel and be ready to take over immediately.**

**GEN2 + TI2 specific risks:**

1. **TI2 acts directly on the EPS torque sensor signal.** If TI2 faults mid-drive (STATE transitions away from RUN=3), the EPS module may see an unexpected torque sensor reading. In the worst case this could cause a momentary steering anomaly before the EPS falls back to stock behavior. Practice the takeover: grab the wheel firmly and steer manually. The car will respond normally once you override.

2. **`steerFaultPermanent` is not yet wired for GEN2.** The code at `selfdrive/car/mazda/carstate.py:200` has a TODO comment — it always returns `False` for GEN2. This means openpilot won't self-disengage on an EPS fault. You are the fault detector. Watch the EPS warning light on the dash.

3. **ACC without BlendedACC may engage/disengage more abruptly than stock MRCC.** The GEN2 ACC path sends commands directly to the 0x220 bus. Without the FrogPilot BlendedACC filter active, engage/disengage transitions may feel sharper than you're used to. This is expected behavior for CP-C.

4. **NON_LINEAR_TORQUE_PARAMS `(4.6, 0.6, 0.134, 0.3605)` was tuned on an earlier World Model version.** Lateral feel at v0.11 may differ. Start slow.

5. **First drive: empty space, speed under 30 km/h only.** No exceptions.

**Acknowledge:** Before proceeding, confirm you've read and understood all five points above.

---

## CP-A: Lateral Only, TI Off (Bench / Driveway / Empty Lot)

**Goal:** Prove openpilot can engage lateral control through your panda + TI2 hardware path with the new code. No longitudinal control. No highway speeds.

**Pre-flight for CP-A:**
- [ ] Pre-flight prerequisites above: all checked
- [ ] Safety warnings: acknowledged
- [ ] Location: empty parking lot or private driveway
- [ ] Speed limit for this CP: 30 km/h maximum

### Step 1: Boot and Fingerprint

1. Power on the car. The comma 3X will boot automatically.
2. Wait for the fingerprint match. The UI should display:

   ```
   Mazda 3 2019-24
   ```

   If it shows a different car name, or "Car Unrecognized", stop. See triage below.

3. Confirm the device shows no persistent alerts on boot (a brief "openpilot unavailable" during calibration is normal).

### Step 2: Pre-Engage CAN Observation (5 minutes)

Sit in park with the engine running. Do **not** engage openpilot yet.

Open connect.comma.ai on your phone and navigate to the live route view, or use cabana after the drive. While sitting in park, verify the following signals are present and active:

| Signal | Message | Bus | Expected behavior |
|--------|---------|-----|-------------------|
| `TI_TORQUE_SENSOR` | `TI_FEEDBACK` (0x24A) | 1 (aux) | Non-zero when you turn the wheel; near-zero at rest |
| `STATE` in `TI_FEEDBACK` | 0x24A | 1 | Should read `3` (RUN) once TI2 initializes |
| `EPS_LKAS` | 0x249 | 1 | Frames present at ~50 Hz; LKAS_OUTPUT near 0 at rest |
| `EPS_FEEDBACK` | 0x24B | 1 | Frames present; steer angle updating as you move wheel |
| `ACC` | 0x220 | 2 | Frames present from camera |

If `TI_FEEDBACK` STATE is not 3 (RUN) after 30 seconds, TI2 hasn't initialized. Check TI2 power and CAN connections before proceeding.

If `EPS_LKAS` frames are absent, the TI2 CAN passthrough isn't working. Stop.

### Step 3: Engage at Standstill

1. Shift to Drive. Stay on the brake.
2. Pull the cruise activate stalk (or press the cruise SET button, depending on your trim).
3. openpilot should show "Engaged" or the lateral control indicator should activate.
4. At standstill, lateral control is active but the car won't move (no longitudinal command in CP-A).
5. Gently turn the wheel a few degrees left and right. You should feel the TI2 providing light resistance/assist. This confirms the torque path is live.

**Expected:** Engagement indicator on. No immediate fault. No EPS warning light.

**Unexpected:** Immediate disengage, EPS warning light, or no response from TI2. See triage.

### Step 4: Low-Speed Roll Test

1. Release the brake. Let the car roll at 5-10 km/h on flat pavement.
2. Keep hands on the wheel, ready to take over.
3. Engage cruise. Lateral should engage.
4. Observe lane centering behavior for 30 seconds on a straight.

**What to watch:**
- Torque oscillation: the wheel should not hunt left-right repeatedly. A small amount of correction is normal.
- Drift: the car should track roughly straight. Some offset from lane center is acceptable at this stage.
- EPS warning light: must stay off.
- TI2 STATE in `TI_FEEDBACK`: must stay at 3 (RUN).

### Step 5: Straight Test

1. Find a straight 50-100m stretch.
2. Roll at 10-20 km/h for 30 seconds with openpilot engaged.
3. Note any: oscillation, drift, lockout, EPS warning lights.
4. Take over manually. Disengage by pressing the brake or cancel button.

### Step 6: Save the Route

After a clean engage-then-disengage cycle, the route is auto-uploaded to connect.comma.ai. Note:

- **Route ID:** `<fill in from connect.comma.ai>`
- **Timestamp:** `<fill in>`

This route becomes the T19/T20 fingerprint and replay baseline. Do not skip this step.

### CP-A Sign-Off Criteria

| Criterion | Pass condition |
|-----------|---------------|
| Fingerprint | "Mazda 3 2019-24" shown on boot |
| Engagement | Lateral engages without immediate fault |
| EPS warning light | Stays off throughout |
| TI2 STATE | Remains 3 (RUN) throughout |
| Torque behavior | No sustained oscillation; smooth disengage |
| Route saved | Route ID recorded |

**CP-A result:** `[ ] PASS  [ ] PASS-WITH-NOTES  [ ] FAIL`

If FAIL, work through the triage matrix below before proceeding.

### CP-A Triage Matrix

| Symptom | Likely cause | File to inspect | What to log/capture |
|---------|-------------|-----------------|---------------------|
| "Car not recognized" on boot | Fingerprint mismatch — your specific trim's ECU firmware version isn't in `fingerprints.py` | `selfdrive/car/mazda/fingerprints.py` lines 265-304 | Run `python3 -c "from openpilot.selfdrive.car.mazda.fingerprints import FINGERPRINTS; print(FINGERPRINTS)"` on device; capture the raw FW versions from the car via `python3 tools/car_porting/auto_fingerprint.py` |
| Engages then immediately disengages | `steerFaultPermanent` fired (unlikely for GEN2 since it's hardcoded False) or a safety RX check failed | `panda/board/safety/safety_mazda.h` lines 95-128 (rx_checks); `selfdrive/car/mazda/carstate.py` line 153 | Capture the `carState.events` from the route in cabana; look for `steerFaultPermanent` or `steerTempUnavailable` |
| Torque oscillation (wheel hunting) | Lateral plant gain too high for v0.11 World Model; `NON_LINEAR_TORQUE_PARAMS = (4.6, 0.6, 0.134, 0.3605)` may need retuning | `selfdrive/car/mazda/interface.py` line 18 | Capture `lateralPlan.dPathPoints` and `carControl.actuators.steer` from cabana; reduce `a` parameter (currently 4.6) by 10-15% |
| EPS warning light on | TI2 fault or torque limit exceeded | `selfdrive/car/mazda/values.py` lines 27-33 (`TI_STEER_MAX=600`, `TI_STEER_DELTA_UP=6`) | Capture `TI_FEEDBACK.STATE` and `TI_FEEDBACK.ERROR` from cabana; check if `VIOL` is non-zero |
| Cruise won't engage at all | Safety RX checks failing (missing expected CAN messages) | `panda/board/safety/safety_mazda.h` lines 120-127 (`mazda_2019_rx_checks`) | Check that `ACC` (0x220 bus 2), `EPS_FEEDBACK` (0x24B bus 1), and `STEER_TORQUE` (0x240 bus 0) are all present in the route |
| TI2 STATE not reaching RUN (3) | TI2 initialization issue; may be stuck in DISCOVER (0) or OFF (1) | `selfdrive/car/mazda/carstate.py` lines 80-88 | Check `TI_FEEDBACK.STATE` in cabana immediately after boot; if stuck at 0 or 1, TI2 hardware/firmware issue |
| `ti_lkas_allowed` False | `ti_ramp_down` is True or STATE != RUN | `selfdrive/car/mazda/carstate.py` lines 85-88 | Capture `TI_FEEDBACK.RAMP_DOWN` signal; if 1, TI2 is ramping down due to driver override or fault |

---

## CP-A to T19/T20: Cabana Replay Loop

After CP-A produces a clean route, run the process replay on your Linux dev box to validate that openpilot's computed outputs are sane before you proceed to CP-B.

```bash
# On your Linux dev box
cd /path/to/openpilot-comma   # your dev checkout, same commit as device

# Install tools if needed
pip install -e tools/

# Run controlsd replay against your CP-A route
# Replace <ROUTE_ID> with the route ID from connect.comma.ai (format: <dongle_id>|<timestamp>)
python3 selfdrive/test/process_replay/process_replay.py \
  --whitelist-procs controlsd \
  --whitelist-cars MAZDA \
  <ROUTE_ID>

# Or use the LogReader API directly for a quick sanity check:
python3 - <<'EOF'
from openpilot.selfdrive.test.process_replay import replay_process_with_name
from openpilot.tools.lib.logreader import LogReader

ROUTE = "<ROUTE_ID>"   # e.g. "abc123def456|2026-05-09--10-30-00"
lr = LogReader(f"cd:/{ROUTE}/0")

output = replay_process_with_name('controlsd', lr)

# Check for NaN or extreme accel values
import math
bad_frames = []
for msg in output:
    if msg.which() == 'carControl':
        a = msg.carControl.actuators.accel
        if math.isnan(a) or abs(a) > 5.0:
            bad_frames.append((msg.logMonoTime, a))

print(f"Total output frames: {len(output)}")
print(f"Bad accel frames (NaN or >5 m/s²): {len(bad_frames)}")
if bad_frames:
    print("First 5 bad frames:", bad_frames[:5])
else:
    print("PASS: no bad accel frames")
EOF
```

**Pass criteria for T19/T20 replay:**
- `controlsd` replay completes without exception
- No NaN values in `carControl.actuators.accel`
- No accel values exceeding ±5.0 m/s²
- `carState.steerFaultPermanent` is False throughout
- `carControl.latActive` transitions cleanly (no rapid toggling)

If the replay shows bad accel frames or exceptions, do not proceed to CP-C. Fix the issue first.

---

## CP-B: Lateral with TI Engaged — Empty Straight Road

**Goal:** Full TI2 torque assist active. This is the daily-driver configuration.

**Pre-flight for CP-B:**
- [ ] CP-A signed off (PASS or PASS-WITH-NOTES with no untriaged failures)
- [ ] CP-A route saved and route ID recorded
- [ ] T19/T20 replay passed (no bad accel frames)
- [ ] Location: empty straight road, no intersections, no pedestrians
- [ ] Speed: up to 80 km/h for this CP

### What's Different from CP-A

In CP-A, TI2 was present but you were observing it passively. In CP-B, TI2 is actively driving torque as the primary steering actuator. The `ti_lkas_allowed` flag must be True (STATE=RUN, RAMP_DOWN=0) for TI2 torque to flow.

The GEN2 path in `carcontroller.py` sends `ti_apply_steer` to `create_steering_control()` when `MazdaFlags.TORQUE_INTERCEPTOR` is set. The TI2 ramp parameters are:
- `TI_STEER_DELTA_UP = 6` (torque increase per 10ms frame)
- `TI_STEER_DELTA_DOWN = 15` (torque decrease per 10ms frame)
- `TI_STEER_MAX = 600`

### Step-by-Step

1. Find an empty straight road. No other cars needed.
2. Accelerate to 30 km/h. Engage openpilot.
3. **Initial engagement smoothness:** TI2 should ramp up cleanly. You should feel a smooth transition, not a jerk. If there's a jerk, note the magnitude and capture the route.
4. Hold 30 km/h for 60 seconds. Observe lane centering.
5. Accelerate to 50 km/h. Hold for 60 seconds. Observe.
6. Accelerate to 80 km/h. Hold for 60 seconds. Observe.
7. **Curve test:** find a moderate sweeper (radius ~200m or larger). Engage through the curve. Observe whether the car tracks the lane or drifts to the outside.
8. **Hands-off lockout check:** with TI2 active, the hands-off lockout should NOT trigger (TI2 bypasses the torque-based driver detection). Keep hands on the wheel regardless — this is a safety check, not an invitation to go hands-off.
9. Disengage. Note the disengage behavior (should be smooth, not a snap).

### CP-B Sign-Off Criteria

| Criterion | Pass condition |
|-----------|---------------|
| Engagement ramp | Smooth, no jerk on engage |
| Lane centering at 30 km/h | Car tracks lane within ~0.3m of center |
| Lane centering at 50 km/h | Stable, no oscillation |
| Lane centering at 80 km/h | Stable, no oscillation |
| Curve handling | Car follows curve without drifting to outside |
| EPS warning light | Stays off throughout |
| TI2 STATE | Remains 3 (RUN) throughout |
| Disengage | Smooth, no snap |

**CP-B result:** `[ ] PASS  [ ] PASS-WITH-NOTES  [ ] FAIL`

### CP-B Triage Matrix

Same as CP-A triage, plus:

| Symptom | Likely cause | File to inspect | What to log/capture |
|---------|-------------|-----------------|---------------------|
| TI2 faults during drive (STATE leaves RUN) | Driver override detected (DRIVER_OVER=2) or TI2 internal error | `selfdrive/car/mazda/carstate.py` lines 80-88 | Capture exact `TI_FEEDBACK.STATE` frame where transition occurs; also capture `TI_FEEDBACK.VIOL` and `TI_FEEDBACK.ERROR` |
| Oscillation at highway speeds | Lateral gain too high for higher speeds; `NON_LINEAR_TORQUE_PARAMS` `a=4.6` may be too aggressive | `selfdrive/car/mazda/interface.py` line 18 | Capture `lateralPlan.dPathPoints`, `carControl.actuators.steer`, and `carState.steeringTorque` from cabana; try reducing `a` to 4.0 |
| Car drifts to outside of curve | `steerRatio=18.8` or `wheelbase=2.725` may need adjustment for your specific trim | `selfdrive/car/mazda/values.py` line 118 | Capture `lateralPlan.curvature` vs actual path from cabana |
| Jerk on engage | TI2 ramp-up too fast | `selfdrive/car/mazda/values.py` line 28 (`TI_STEER_DELTA_UP=6`) | Reduce `TI_STEER_DELTA_UP` to 4 and retest |

---

## CP-C: Longitudinal ACC + TI — Quiet Highway

**Goal:** openpilot drives gas and brake via the GEN2 ACC channel (0x220, bus 2) while TI2 handles steering.

**Pre-flight for CP-C:**
- [ ] CP-A signed off
- [ ] CP-B signed off
- [ ] T19/T20 process replay passed (no bad accel frames, no NaN)
- [ ] Location: quiet 4-lane highway, light traffic, no aggressive merges needed
- [ ] Speed: 60-100 km/h range

### How GEN2 Longitudinal Works

The GEN2 ACC path sends commands to the `ACC` message (0x220, bus 2). The hold/resume logic in `carcontroller.py` uses three timers:

| Timer | Value | Purpose |
|-------|-------|---------|
| `hold_delay` | 0.5 seconds | Delay before applying electric brake hold (prevents hard brake if not fully stopped) |
| `hold_timer` | 6.0 seconds | How long to hold the electric brake at standstill |
| `resume_timer` | 0.5 seconds | How long to send the resume command to release the brake |

The ACC command is sent at 50 Hz (every other frame at 100 Hz, via `Timer.interval(2)`). The hold/resume logic fires when `CS.out.standstill` is True.

### Step-by-Step

1. Find a quiet 4-lane highway. Light traffic is fine; you need a lead vehicle for the following test.
2. Accelerate to 60 km/h. Engage openpilot (both lateral and longitudinal).
3. **Verify ACC takes over:** the car should maintain speed without you on the gas.
4. **Following distance test:** trail a vehicle for 1 km. Observe gap maintenance. The gap should be stable, not oscillating.
5. **Hold/resume test:**
   a. Follow a vehicle to a stop. ACC should apply brakes and bring the car to a standstill.
   b. Once stopped, the electric brake hold activates after the 0.5s `hold_delay`.
   c. The hold lasts up to 6 seconds (`hold_timer`).
   d. When the lead vehicle moves, ACC should send a resume command for 0.5 seconds (`resume_timer`) to release the brake and start moving.
   e. If the hold expires (6 seconds) before the lead moves, the car may start creeping. This is expected behavior.
6. **Stop test:** vehicle ahead stops suddenly. ACC should brake to a stop. Observe smoothness.
7. **Lead pull-away test:** lead vehicle accelerates from stop. ACC should follow smoothly.
8. **Disengage test:** press brake to disengage. Verify smooth handoff.

### CP-C Sign-Off Criteria

| Criterion | Pass condition |
|-----------|---------------|
| ACC engagement | Takes over speed control smoothly |
| Following distance | Stable gap, no oscillation |
| Braking to stop | Smooth, no hard jerk |
| Hold at standstill | Electric brake holds car for up to 6 seconds |
| Resume from hold | Car moves smoothly when lead moves |
| Disengage | Smooth handoff to driver |
| No ACC faults | No unexpected disengages |

**CP-C result:** `[ ] PASS  [ ] PASS-WITH-NOTES  [ ] FAIL`

### CP-C Triage Matrix

| Symptom | Likely cause | File to inspect | What to log/capture |
|---------|-------------|-----------------|---------------------|
| ACC engages but doesn't follow lead | `CS.acc["RESUME"]` or `CS.acc["HOLD"]` parsing incorrect; or `ACC_ACTIVE` signal not being read correctly | `selfdrive/car/mazda/carstate.py` lines 130-137; `selfdrive/car/mazda/mazdacan.py` lines 185-204 | Capture `ACC` (0x220) raw frames from cabana; compare `ACC_ACTIVE` and `ACCEL_CMD` values against what openpilot is sending |
| Aggressive braking on engage | BlendedACC filter not active; raw accel command applied directly | `selfdrive/car/mazda/carcontroller.py` lines 109-133 | The `BlendedACC` param is False by default; if braking is too aggressive, consider re-enabling it (it was a FrogPilot pattern that smooths the ACC transition) |
| Standstill hold doesn't activate | `hold_delay` timer not expiring before car starts creeping | `selfdrive/car/mazda/carcontroller.py` lines 145-156 | Capture `CS.out.standstill` and the `hold` variable from carcontroller logs; check that `hold_delay.active()` returns False after 0.5s |
| Hold expires too quickly | `hold_timer` (6.0s) too short for your traffic conditions | `selfdrive/car/mazda/carcontroller.py` line 24 | Increase `Timer(6.0)` to `Timer(10.0)` and retest |
| Resume doesn't release brake | `resume_timer` (0.5s) too short | `selfdrive/car/mazda/carcontroller.py` line 26 | Increase `Timer(0.5)` to `Timer(0.8)` and retest |
| Jerky engage/disengage | `longitudinalActuatorDelay = 0.35` may need adjustment; or BlendedACC needed | `selfdrive/car/mazda/interface.py` line 111 | Capture `carControl.actuators.accel` and `carState.aEgo` from cabana; compare the commanded vs actual accel profile |
| ACC faults thrown | `ACC_ACTIVE` signal going to 0 unexpectedly | `selfdrive/car/mazda/carstate.py` lines 130-137 | Capture raw `ACC` (0x220) frames; check if `ACC_ACTIVE` drops to 0 during the fault |

---

## Post-Drive Sign-Off Matrix

Fill this in after each CP. Attach to your T21 follow-up log.

| CP | Route ID | Duration | Distance | Pass/Fail | Notes | Follow-up |
|----|----------|----------|----------|-----------|-------|-----------|
| A | | | | | | |
| B | | | | | | |
| C | | | | | | |

---

## Recovery and Abort Procedures

### Permanent Steer Fault Appears

1. Pull over safely. Disengage openpilot.
2. Note the exact time and route ID.
3. On your dev box, extract the fault chain:

   ```bash
   # After pulling the route with T21_cabana_capture.sh
   python3 - <<'EOF'
   from openpilot.tools.lib.logreader import LogReader
   ROUTE = "<ROUTE_ID>"
   lr = LogReader(f"cd:/{ROUTE}/0")
   for msg in lr:
       if msg.which() == 'carState':
           cs = msg.carState
           if cs.steerFaultPermanent or cs.steerFaultTemporary:
               print(f"t={msg.logMonoTime/1e9:.3f} permanent={cs.steerFaultPermanent} temp={cs.steerFaultTemporary}")
   EOF
   ```

4. Also check `TI_FEEDBACK.STATE` and `TI_FEEDBACK.ERROR` in cabana around the same timestamp.

### EPS Module Needs Reset

If the EPS warning light stays on after disengaging openpilot:

1. Turn the car off completely (key out or push-button off).
2. Wait 30 seconds.
3. Restart. The EPS module should reset.
4. If the light persists, do not drive with openpilot. Take the car to a Mazda dealer to read EPS fault codes.

### Rolling Back to Source Fork

If you need to revert to the pre-port firmware:

```bash
# On your dev box
cd /path/to/openpilot-more
git checkout mazda-frogpilot

# Reflash to device
# (use your standard flash procedure — typically via SSH or USB)
ssh comma@<device-ip> "cd /data && rm -rf openpilot"
# then re-clone and checkout mazda-frogpilot on device
```

The `mazda-frogpilot` branch is the pre-port baseline. It does not include the GEN2+TI2 changes.

---

## Reference: Key Constants

For quick reference during triage:

| Constant | Value | Location |
|----------|-------|----------|
| `NON_LINEAR_TORQUE_PARAMS` for MAZDA_3_2019 | `(4.6, 0.6, 0.134, 0.3605)` | `interface.py:18` |
| `steerActuatorDelay` (GEN2) | `0.335 s` | `interface.py:117` |
| `steerLimitTimer` | `0.8 s` | `interface.py:127` |
| `TI_STEER_MAX` | `600` | `values.py:27` |
| `TI_STEER_DELTA_UP` | `6` | `values.py:28` |
| `TI_STEER_DELTA_DOWN` | `15` | `values.py:29` |
| `STEER_MAX` (GEN2) | `8000` | `values.py:35` |
| `hold_delay` | `0.5 s` | `carcontroller.py:25` |
| `hold_timer` | `6.0 s` | `carcontroller.py:24` |
| `resume_timer` | `0.5 s` | `carcontroller.py:26` |
| EPS_LKAS CAN ID | `0x249` (bus 1) | `safety_mazda.h:35` |
| EPS_FEEDBACK CAN ID | `0x24B` (bus 1 aux) | `safety_mazda.h:28` |
| TI_FEEDBACK CAN ID | `0x24A` (bus 1) | `mazda_2017.dbc:586` |
| ACC CAN ID | `0x220` (bus 2) | `safety_mazda.h:30` |
| TI_STATE: RUN | `3` | `values.py:47` |
| TI_STATE: DRIVER_OVER | `2` | `values.py:46` |
| TI_STATE: OFF | `1` | `values.py:45` |
| TI_STATE: DISCOVER | `0` | `values.py:44` |

---

*Wave 7 — T21 on-vehicle bring-up checklist. Parent SHA: `f0526a2c13cee48dd4dae1fea76d90805105f261`.*
