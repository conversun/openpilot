# AGENTS.md — system/loggerd/

Drive logging stack. Segment-based recording, video encoding, cloud upload, retention.

## Components (3 daemons + 2 helpers)

| Component | Lang | Entry | Purpose |
|-----------|------|-------|---------|
| **loggerd** | C++ | `loggerd.cc` / `.h` | Main logger: 60s segments, writes `rlog.bz2` (all msgs) + `qlog.bz2` (subset) |
| **encoderd** | C++ | `encoderd.cc` | H.265 video encoder daemon (road/wide/driver cams) |
| **stream_encoderd** | C++ | `encoderd.cc --stream` | Stream-mode encoder for non-car (`notcar` condition) |
| **bootlog** | C++ | `bootlog.cc` | Boot-time log capture (one-shot at startup) |
| **deleter** | Py | `deleter.py` | Old segment cleanup when disk fills |
| **uploader** | Py | `uploader.py` | Async upload to comma cloud (`allow_uploads` gated) |

## Files

| File | Purpose |
|------|---------|
| `logger.cc` / `.h` | Core segment writer (rotation, bz2 compression) |
| `video_writer.cc` / `.h` | HEVC mux to `.hevc` files |
| `encoder/` | Per-camera encoder C++ helpers |
| `config.py` | Segment size, rotation policy constants |
| `xattr_cache.py` | Filesystem xattr cache (uploaded flags) |
| `tests/` | gtest C++ tests + uploader Python tests |

## Segment Layout

Each 60s segment writes to `/data/media/0/realdata/<route>/<seg>/`:

| File | Contents |
|------|----------|
| `rlog.bz2` | ALL cereal messages (full fidelity) |
| `qlog.bz2` | Subset for cloud (downsampled, no images) |
| `fcamera.hevc` | Forward (road) camera H.265 |
| `ecamera.hevc` | Wide (e-cam) camera H.265 |
| `dcamera.hevc` | Driver-monitoring camera H.265 |
| `qcamera.ts` | Low-res transport stream (cloud preview) |

## Build

`SConscript` builds:
- `loggerd`, `encoderd`, `bootlog` C++ binaries
- gtest `test_runner` for `tests/`

## Conventions

- Segments are **60 seconds exactly** (rotates on time, NOT size)
- `qlog` is a strict subset of `rlog` — service whitelist in `cereal/services.py`
- Upload order: `qlog` first (cloud preview), then `rlog`, then video — set in `uploader.py`
- `xattr_cache.py` tracks "uploaded" via filesystem extended attributes — DO NOT use a sidecar file
- FrogPilot: `allow_logging` toggle gates ALL recording; `allow_uploads` separate
- Encoders use hardware HEVC on tici (V4L2/Adreno); software fallback on PC

## Anti-Patterns

- **Never** allocate per-message in `loggerd.cc` hot path — preallocate buffers (system/AGENTS.md)
- **Never** block on disk in encoder threads — use queues
- **Never** change `qlog` whitelist without updating `cereal/services.py` AND uploader bandwidth budgeting
- **Never** mix segment rotation logic across `logger.cc` and `video_writer.cc` — `logger.cc` owns rotation, video follows
- `bootlog` is one-shot — DO NOT add a main loop or rate limiter
- Uploader retries on failure with backoff — DO NOT add a kill switch on transient errors
