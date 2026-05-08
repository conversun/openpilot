# T21 Follow-Up Log — GEN2 + TI2 On-Vehicle Bring-Up

Fill this in during and after each checkpoint drive. One section per CP. Keep it honest — this is your debugging record, not a report card.

---

## CP-A: Lateral Only, TI Off

**Date / time:** `____________________`

**Location:** `____________________` (e.g., "empty parking lot, Costco")

**Route ID:** `____________________` (from connect.comma.ai)

**Duration:** `________ min`

**Distance:** `________ km`

### Engagement Log

| # | Time (approx) | Speed (km/h) | Engaged? | Disengaged by | Notes |
|---|---------------|--------------|----------|---------------|-------|
| 1 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 2 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 3 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 4 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 5 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |

**Total engagements:** `______`  
**Total disengagements:** `______`  
**Fault-triggered disengagements:** `______`

### Subjective Ratings (1 = terrible, 5 = excellent)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Engagement smoothness | `/5` | |
| Lateral tracking accuracy | `/5` | |
| Disengage smoothness | `/5` | |
| TI2 torque feel | `/5` | |
| Overall confidence | `/5` | |

### Fingerprint Check

- [ ] "Mazda 3 2019-24" shown on boot
- [ ] No "Car Unrecognized" alert

**Actual fingerprint text shown:** `____________________`

### CAN Observations (from cabana review after drive)

| Signal | Observed? | Notes |
|--------|-----------|-------|
| TI_FEEDBACK (0x24A bus1) present | [ ] Yes [ ] No | |
| TI_FEEDBACK STATE = 3 (RUN) | [ ] Yes [ ] No [ ] Intermittent | |
| EPS_LKAS (0x249 bus1) present | [ ] Yes [ ] No | |
| EPS_FEEDBACK (0x24B bus1) present | [ ] Yes [ ] No | |
| steerFaultPermanent = False throughout | [ ] Yes [ ] No | |
| latActive frames present | [ ] Yes [ ] No | |
| Any TI_FEEDBACK.VIOL non-zero | [ ] Yes [ ] No | If yes, note value: |
| Any TI_FEEDBACK.ERROR non-zero | [ ] Yes [ ] No | If yes, note value: |

### Anomalies Observed

```
(describe any unexpected behavior, CAN glitches, warning lights, etc.)




```

### Action Items Before CP-B

- [ ] `____________________`
- [ ] `____________________`
- [ ] `____________________`

### CP-A Sign-Off

**Result:** `[ ] PASS  [ ] PASS-WITH-NOTES  [ ] FAIL`

**Notes:** `____________________`

**Signed off by:** `____________________`  **Date:** `____________________`

---

## CP-B: Lateral with TI Engaged

**Date / time:** `____________________`

**Location:** `____________________` (e.g., "empty straight road, industrial park")

**Route ID:** `____________________`

**Duration:** `________ min`

**Distance:** `________ km`

**CP-A signed off before this drive:** `[ ] Yes  [ ] No`

### Engagement Log

| # | Time (approx) | Speed (km/h) | Engaged? | Disengaged by | Notes |
|---|---------------|--------------|----------|---------------|-------|
| 1 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 2 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 3 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 4 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 5 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |

**Total engagements:** `______`  
**Total disengagements:** `______`  
**Fault-triggered disengagements:** `______`

### Speed Progression

| Speed tested | Lateral stable? | Oscillation? | Notes |
|-------------|-----------------|--------------|-------|
| 30 km/h | [ ] Yes [ ] No | [ ] Yes [ ] No | |
| 50 km/h | [ ] Yes [ ] No | [ ] Yes [ ] No | |
| 80 km/h | [ ] Yes [ ] No | [ ] Yes [ ] No | |

### Curve Test

**Curve radius (approx):** `________ m`

**Behavior:** `[ ] Tracked lane  [ ] Drifted outside  [ ] Drifted inside  [ ] Oscillated`

**Notes:** `____________________`

### Subjective Ratings (1 = terrible, 5 = excellent)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Engagement ramp smoothness | `/5` | |
| Lane centering at 30 km/h | `/5` | |
| Lane centering at 50 km/h | `/5` | |
| Lane centering at 80 km/h | `/5` | |
| Curve handling | `/5` | |
| Disengage smoothness | `/5` | |
| Overall confidence | `/5` | |

### CAN Observations (from cabana review after drive)

| Signal | Observed? | Notes |
|--------|-----------|-------|
| TI_FEEDBACK STATE = 3 (RUN) throughout | [ ] Yes [ ] No [ ] Intermittent | |
| TI_FEEDBACK RAMP_DOWN = 0 throughout | [ ] Yes [ ] No [ ] Intermittent | |
| EPS warning light on dash | [ ] Yes [ ] No | |
| steerFaultPermanent = False throughout | [ ] Yes [ ] No | |
| Any TI_FEEDBACK.VIOL non-zero | [ ] Yes [ ] No | If yes, note value: |
| Any TI_FEEDBACK.ERROR non-zero | [ ] Yes [ ] No | If yes, note value: |

### Anomalies Observed

```
(describe any unexpected behavior, CAN glitches, warning lights, etc.)




```

### Action Items Before CP-C

- [ ] `____________________`
- [ ] `____________________`
- [ ] `____________________`

### CP-B Sign-Off

**Result:** `[ ] PASS  [ ] PASS-WITH-NOTES  [ ] FAIL`

**Notes:** `____________________`

**Signed off by:** `____________________`  **Date:** `____________________`

---

## CP-C: Longitudinal ACC + TI

**Date / time:** `____________________`

**Location:** `____________________` (e.g., "Highway 99, light traffic")

**Route ID:** `____________________`

**Duration:** `________ min`

**Distance:** `________ km`

**CP-A signed off:** `[ ] Yes  [ ] No`  
**CP-B signed off:** `[ ] Yes  [ ] No`  
**T19/T20 process replay passed:** `[ ] Yes  [ ] No`

### Engagement Log

| # | Time (approx) | Speed (km/h) | Engaged? | Disengaged by | Notes |
|---|---------------|--------------|----------|---------------|-------|
| 1 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 2 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 3 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 4 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |
| 5 | | | [ ] Yes [ ] No | [ ] Driver [ ] Fault [ ] Cancel | |

**Total engagements:** `______`  
**Total disengagements:** `______`  
**Fault-triggered disengagements:** `______`

### Longitudinal Behavior

| Test | Result | Notes |
|------|--------|-------|
| ACC takes over speed control | [ ] Yes [ ] No | |
| Following distance stable | [ ] Yes [ ] No | |
| Braking to stop: smooth | [ ] Yes [ ] No | |
| Hold at standstill activated | [ ] Yes [ ] No | |
| Hold duration felt appropriate | [ ] Yes [ ] No | Actual hold time: ___s |
| Resume from hold: smooth | [ ] Yes [ ] No | |
| Lead pull-away: followed smoothly | [ ] Yes [ ] No | |
| Disengage: smooth handoff | [ ] Yes [ ] No | |

### Hold/Resume Timer Observations

| Timer | Expected | Observed | Match? |
|-------|----------|----------|--------|
| hold_delay (before brake hold) | ~0.5 s | _____ s | [ ] Yes [ ] No |
| hold_timer (max hold duration) | ~6.0 s | _____ s | [ ] Yes [ ] No |
| resume_timer (brake release) | ~0.5 s | _____ s | [ ] Yes [ ] No |

### Subjective Ratings (1 = terrible, 5 = excellent)

| Dimension | Rating | Notes |
|-----------|--------|-------|
| ACC engagement smoothness | `/5` | |
| Following distance stability | `/5` | |
| Braking smoothness | `/5` | |
| Hold/resume behavior | `/5` | |
| Overall longitudinal confidence | `/5` | |
| Combined lateral + longitudinal | `/5` | |

### CAN Observations (from cabana review after drive)

| Signal | Observed? | Notes |
|--------|-----------|-------|
| ACC (0x220 bus2) frames present | [ ] Yes [ ] No | |
| ACC_ACTIVE signal correct | [ ] Yes [ ] No | |
| longActive frames present | [ ] Yes [ ] No | |
| Bad accel frames (>5 m/s²) | [ ] Yes [ ] No | If yes, count: |
| steerFaultPermanent = False | [ ] Yes [ ] No | |
| TI_FEEDBACK STATE = 3 throughout | [ ] Yes [ ] No [ ] Intermittent | |

### Anomalies Observed

```
(describe any unexpected behavior, CAN glitches, warning lights, etc.)




```

### Action Items / Fixes Needed

- [ ] `____________________`
- [ ] `____________________`
- [ ] `____________________`

### CP-C Sign-Off

**Result:** `[ ] PASS  [ ] PASS-WITH-NOTES  [ ] FAIL`

**Notes:** `____________________`

**Signed off by:** `____________________`  **Date:** `____________________`

---

## Overall Wave 7 Sign-Off

| CP | Route ID | Date | Duration | Distance | Result | Notes |
|----|----------|------|----------|----------|--------|-------|
| A | | | | | | |
| B | | | | | | |
| C | | | | | | |

**Wave 7 overall result:** `[ ] PASS  [ ] PASS-WITH-NOTES  [ ] FAIL`

**Ready for daily use:** `[ ] Yes  [ ] No — needs: ____________________`

**Next wave / follow-up tasks:**

- [ ] `____________________`
- [ ] `____________________`
- [ ] `____________________`

---

*T21 follow-up log template. Wave 7 — GEN2 + TI2 port.*
