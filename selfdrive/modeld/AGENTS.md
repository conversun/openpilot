# AGENTS.md — selfdrive/modeld/

ML model inference. Multiple runner backends, two model types (driving + driver monitoring).

## Files

| File | Purpose |
|------|---------|
| `modeld.py` | Main driving model daemon — vision+policy ONNX, runs at 20Hz (DT_MDL) |
| `dmonitoringmodeld.py` | Driver monitoring daemon — face detection at ~10Hz |
| `parse_model_outputs.py` | Parses raw model tensor → `modelV2` cereal message |
| `fill_model_msg.py` | Populates cereal `modelV2` fields (lanes, leads, plan, meta) |
| `constants.py` | Model I/O constants: input shapes, output slices, time horizons |
| `get_model_metadata.py` | Extracts metadata from compiled `.thneed`/`.onnx` files |
| `models/` | Compiled model binaries (driving_vision, driving_policy, dmonitoring) |
| `runners/` | Backend abstractions: `ONNXModel`, `SNPEModel`, `ThneedModel` |
| `transforms/` | Image warping: rectification, calibration-to-model frame |
| `thneed/` | Custom OpenCL inference engine (Qualcomm Adreno GPU) |
| `modeld/` (subdir) | C++ helpers (commonmodel) |
| `libthneed.so` | Prebuilt thneed runtime |

## Runner Backends

| Backend | Used When | Notes |
|---------|-----------|-------|
| **thneed** | Default on tici (comma 3/3X) | Qualcomm Adreno OpenCL, lowest latency |
| **SNPE** | Qualcomm DSP | Snapdragon NPE, alt path |
| **ONNX** | PC/dev (`ONNXCPU=1`) | onnxruntime, slow but portable |
| **TinyGrad** | FrogPilot opt-in | See `frogpilot/tinygrad_modeld/` |
| **Classic** | FrogPilot legacy | See `frogpilot/classic_modeld/` |

Backend selection: `process_config.py` runs ONE of `modeld` (new), `classic_modeld` (C++), `tinygrad_modeld` (Py) based on FrogPilot toggles `run_classic_modeld`/`run_new_modeld`/`run_tinygrad_modeld`.

## Model I/O Pipeline

```
camerad → VisionIPC (zero-copy YUV) → modeld
   │                                     │
   │  transforms/ → warp to model frame  │
   │                                     ↓
   │                              runner.execute()
   │                                     │
   │                              parse_model_outputs
   │                                     ↓
   └────────────── PubMaster → modelV2 cereal message → controlsd, plannerd
```

## Build

`SConscript` builds:
- `libthneed.so` — custom OpenCL engine (skipped when `--pc-thneed` off)
- `commonmodel` C++ helpers
- Cython runner bindings

## Conventions

- Inputs always pre-warped via `transforms/` to model frame — never raw camera coords
- Output message is `modelV2` (NOT `modelV1`); FrogPilot adds `frogpilotModelV2` for extras
- Models loaded from `models/*.thneed` or `models/*.onnx` — paths hardcoded in `modeld.py`
- Use `VisionIPC` for camera frames (zero-copy), NOT cereal pub/sub

## Anti-Patterns

- **Never** add Python-side image processing — use `transforms/` (OpenCL) for hot path
- **Never** allocate model output buffers per-frame — preallocate, reuse
- **Never** call `np.copy()` on VisionIPC buffers — they're shared memory; copy explicitly only when needed
- **Never** modify `parse_model_outputs.py` slice offsets without also updating model training repo
- Runner backend is selected by `process_config`, NOT by env var — to switch, change FrogPilot toggle
