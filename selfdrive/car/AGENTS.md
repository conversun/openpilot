# AGENTS.md — selfdrive/car/

Per-manufacturer car ports. 20+ brands, standardized template, FrogPilot extensions.

## Car Port Template

Every brand directory (`selfdrive/car/<brand>/`) follows this structure:

| File | Class | Purpose |
|------|-------|---------|
| `interface.py` | `CarInterface(CarInterfaceBase)` | Main entry — `_get_params()`, `_update()`, `apply()` |
| `carcontroller.py` | `CarController(CarControllerBase)` | Builds CAN messages for actuation |
| `carstate.py` | `CarState(CarStateBase)` | Parses CAN frames → `car.CarState` message |
| `values.py` | `CAR` enum, flags, `CarControllerParams` | Platform constants, actuation limits |
| `fingerprints.py` | `FW_VERSIONS` dict | ECU firmware → car identification |
| `radar_interface.py` | `RadarInterface(RadarInterfaceBase)` | Radar point parsing from CAN |
| `tests/` | test files | Brand-specific tests |

Optional: `<brand>can.py` (CAN message builders for complex protocols like CANFD).

## Base Classes

All in `selfdrive/car/interfaces.py`:

- `CarInterfaceBase` — Abstract. Handles CAN parsing, events, param setup
- `CarControllerBase` — Abstract. `update()` → CAN commands
- `CarStateBase` — Abstract. CAN → CarState
- `RadarInterfaceBase` — Abstract. Radar data parsing

## values.py Pattern

```python
class CAR(Platforms):
  BRAND_MODEL = PlatformConfig(
    [BrandCarDocs("Brand Model 2024", ...)],
    CarSpecs(mass=1500, wheelbase=2.7, steerRatio=15.0),
    dbc_dict('brand_can', None),
  )

class BrandFlags(IntFlag):
  FEATURE_A = 1
  FEATURE_B = 2

class CarControllerParams:
  STEER_MAX = 300
  ACCEL_MAX = 2.0
  # ... actuation limits
```

## fingerprints.py Pattern

```python
FW_VERSIONS: dict[str, dict[tuple, list[bytes]]] = {
  CAR.BRAND_MODEL: {
    (Ecu.fwdCamera, 0x750, None): [b'FIRMWARE_V1', b'FIRMWARE_V2'],
    (Ecu.abs, 0x760, None): [b'ABS_FW_V1'],
  },
}
```

## FrogPilot Extensions

Each brand can add FrogPilot-specific behavior:

- **FrogPilotFlags**: `class BrandFrogPilotFlags(IntFlag)` in `values.py`
- **get_frogpilot_params()**: Method on CarInterface for brand-specific FP params
- **apply()**: Extended with `frogpilot_toggles=` kwarg for feature gating
- **CarState**: Extra fields like `distance_button`, `lkas_enabled` for AOL/CEM

Existing FP flags: `ToyotaFrogPilotFlags`, `HyundaiFrogPilotFlags`, `ChryslerFrogPilotFlags`

## Adding a New Car Port

1. Create `selfdrive/car/<brand>/` with all 7 template files
2. Define `CAR` enum entries in `values.py` with `PlatformConfig`
3. Populate `FW_VERSIONS` in `fingerprints.py` from real car data
4. Implement CAN parsing in `carstate.py` using DBC definitions
5. Implement actuation in `carcontroller.py`
6. Test with `pytest selfdrive/car/tests/test_car_interfaces.py`

## Anti-Patterns

- **Never** skip `fingerprints.py` — required for car identification
- **Never** hardcode platform checks — use `CAR` enum and flags
- **Never** add brand logic outside `selfdrive/car/<brand>/`
- CAN signals must match DBC definitions in `opendbc/`
- Actuation limits in `CarControllerParams` must match physical hardware
