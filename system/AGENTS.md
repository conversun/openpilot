# AGENTS.md — system/

C++ and Python system services. Daemons for hardware, cameras, sensors, logging, process management.

## Subsystems

| Subsystem | Language | Entry Point | Purpose |
|-----------|----------|-------------|---------|
| `manager/` | Python | `manager.py` | Process supervisor — starts/stops all daemons |
| `loggerd/` | C++ | `loggerd.cc` | Segment-based logging (60s chunks), encoder mgmt |
| `camerad/` | C++ | `main.cc` | Camera capture from road/driver/wide cameras |
| `sensord/` | C++ | `sensors_qcom2.cc` | IMU data (gyro/accel) via PubMaster |
| `hardware/` | Python+C++ | `hardwared.py` | Device state, thermal monitoring, power mgmt |
| `proclogd/` | C++ | `main.cc` | Process resource usage logging |
| `logcatd/` | C++ | `main.cc` | Android logcat capture |

## Process Management (manager/)

`process_config.py` defines all managed processes. Key patterns:

```python
NativeProcess("camerad", "system/camerad", ["./camerad"], enabled=WEBCAM)
PythonProcess("controlsd", "selfdrive.controls.controlsd")
DaemonProcess("mapd", "selfdrive.navd.mapd", is_frogpilot=True)
```

- **NativeProcess**: Compiled C++ binary
- **PythonProcess**: Python module entry
- **DaemonProcess**: Background service (may have conditional start)

FrogPilot additions: 6 extra processes with `is_frogpilot=True` flag and conditional toggles.

## IPC Patterns

All inter-process communication via **cereal messaging** (Cap'n Proto):

| Pattern | Language | Usage |
|---------|----------|-------|
| `SubMaster` / `PubMaster` | Python | Most Python daemons |
| `SubSocket` / `PubSocket` | C++ | C++ daemons (lower level) |
| `VisionIPC` | C++/Python | Camera frame sharing (zero-copy) |
| `Params()` | C++/Python | Persistent key-value store |

## C++ Daemon Pattern

```cpp
int main(int argc, char *argv[]) {
  // 1. Init messaging
  PubMaster pm({"sensorEvents"});
  // 2. Real-time config
  util::set_realtime_priority(53);
  // 3. Main loop
  while (!do_exit) {
    // read hardware, publish messages
    pm.send("sensorEvents", msg);
  }
  return 0;
}
```

Common patterns:
- RAII with `std::unique_ptr` / `std::make_unique`
- Signal handling via `ExitHandler` or `do_exit` flag
- Logging: `LOGW(...)`, `LOGE(...)`, `LOGD(...)` from `common/swaglog.h`
- Cap'n Proto for all message serialization

## Hardware Abstraction (hardware/)

Platform-specific implementations in subdirectories:
- `tici/` — comma 3/3X (Qualcomm, aarch64)
- `pc/` — Desktop development (x86_64, Darwin)

`hardwared.py` publishes `deviceState` with: thermal readings, battery, network, memory, CPU usage.

## Logging (loggerd/)

- **Segments**: 60-second recording chunks
- **Files per segment**: `rlog.bz2` (all messages), `qlog.bz2` (subset), `fcamera.hevc`, `ecamera.hevc`, `dcamera.hevc`
- **Encoders**: H.265 hardware encoding via `encoderd`
- FrogPilot: conditional logging via `allow_logging` toggle

## Anti-Patterns

- **Never** block on network I/O in latency-critical C++ daemons
- **Never** use `std::cout` — always `LOGW`/`LOGE`/`LOGD`
- **Never** allocate in hot paths — preallocate buffers
- Guard platform code with `#ifndef __APPLE__` for macOS compatibility
- Camera/sensor code runs at hardware interrupt rate — don't add delays
