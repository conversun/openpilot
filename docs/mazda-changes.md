# Mazda Fork 改动分析

> 对比官方 FrogPilot (`FrogAi/FrogPilot`) — 基于 `8fa998b` (FrogPilot 0.9.7, Sep 27 2025) 之后的 23 个 commit
>
> 主要贡献者: **MoreTore**, **jakethesake420**

---

## 一、新增车型支持

官方 FrogPilot 仅支持 Gen1 (2017-21 款)，且大部分为 dashcamOnly。

| 车型 | 代次 | 状态 |
|---|---|---|
| Mazda CX-5 2017-21, CX-9, 3 2017-18, 6, CX-9 2021, CX-5 2022 | **Gen1** | 官方已有，本项目增强 |
| **Mazda 3 2019-24** | **Gen2** | 全新支持 |
| **Mazda CX-30 2019-22** | **Gen2** | 全新支持 |
| **Mazda CX-50 2022-24** | **Gen2** | 全新支持 |
| **Mazda 3 2024-26** | **Gen3** | 全新支持 |
| **Mazda CX-30 2023-26** | **Gen3** | 全新支持 |

---

## 二、分层架构改动

### 1. Panda 安全层 (`panda/board/safety/safety_mazda.h`)

- **Gen1/Gen2/Gen3 三代 flag 区分** (`FLAG_MAZDA_GEN1/GEN2/GEN3`)
- **Torque Interceptor 支持** (`FLAG_MAZDA_TORQUE_INTERCEPTOR`) — Gen1 车型可通过外置拦截器增强转向力矩
- **Radar Interceptor 支持** (`FLAG_MAZDA_RADAR_INTERCEPTOR`) — Gen1 车型可接入雷达实现纵向控制
- **No MRCC / No FSC flag** — 适配无雷达巡航或无前摄像头的车型
- **手动挡支持** (`FLAG_MAZDA_MANUAL_TRANSMISSION`)
- 安全限值按代次分别配置 (Gen2/Gen3 转向力矩上限 8000 vs Gen1 的 600)

### 2. OpenDBC CAN 数据库

- `mazda_2017.dbc` — 更新信号定义 (153 行改动)
- `mazda_2019.dbc` — Gen2 全新 CAN 数据库 (636 行)
- `mazda_2023.dbc` — Gen3 全新 CAN 数据库 (660 行)
- CAN 库增加了 checksum 支持 (`opendbc/can/` 改动)

### 3. CarController (`selfdrive/car/mazda/carcontroller.py`)

- 按 Gen1/Gen2/Gen3 分支控制逻辑
- Gen1: Torque Interceptor 模式下的独立控制路径
- Gen2: 新增纵向控制 (油门/刹车 CAN 消息)
- Gen3: 仅横向转向 (无纵向控制)

### 4. CarState (`selfdrive/car/mazda/carstate.py`)

- Gen2/Gen3 全新 CAN 信号解析 (轮速、转向角、巡航状态等)
- `cruiseState.standstill` 逻辑修复
- Torque Interceptor 状态机 (`TI_STATE: DISCOVER -> OFF -> DRIVER_OVER -> RUN`)
- 多次 carstate 修复 (3 个 fix commit)

### 5. Interface (`selfdrive/car/mazda/interface.py`)

- **非线性转向力矩模型** (sigmoid + linear) — Gen2 车型使用 `NON_LINEAR_TORQUE_PARAMS` 替代线性映射
- Gen2 纵向调参 (`kpBP/kpV/kiBP/kiV`)
- Gen3 仅横向、无纵向控制
- Gen1 + Torque Interceptor 时取消最低转向速度限制
- `steerActuatorDelay`: Gen1=0.1s, Gen2/Gen3=0.335s

### 6. Radar Interface (`selfdrive/car/mazda/radar_interface.py`)

- Gen1 + Radar Interceptor: 全新雷达信号解析

---

## 三、控制系统修复

| 改动 | 文件 | 内容 |
|---|---|---|
| **PID 积分器** | `selfdrive/controls/lib/pid.py` | 修复 sticky integrator — 改为条件式反饱和 (anti-windup)，当误差方向与饱和方向相反时允许积分变化 |
| **纵向控制** | `selfdrive/controls/lib/longcontrol.py` | 新增 `BlendedACC` 参数支持 — 在 experimental mode 切换时重置 PID 避免积分突变 |
| **转向力矩限制** | `selfdrive/car/__init__.py` | 新增 `apply_ti_steer_torque_limits()` — Torque Interceptor 专用的独立限值和速率 |
| **Torque override** | `selfdrive/car/torque_data/override.toml` | 5 款 Mazda 车型的 lateral accel 参数: `[1.45, 3.0, 0.33]` |

---

## 四、系统/参数

新增 8 个持久化参数 (`common/params.cc`):

| 参数 | 默认值 | 作用 |
|---|---|---|
| `TorqueInterceptorEnabled` | `1` | 启用 Torque Interceptor |
| `RadarInterceptorEnabled` | — | 启用 Radar Interceptor |
| `BlendedACC` | `1` | 混合 ACC 模式 (experimental + chill 切换时重置 PID) |
| `NoMRCC` | — | 无 Mazda Radar Cruise Control |
| `NoFSC` | — | 无前方感知摄像头 |
| `ManualTransmission` | — | 手动挡模式 |
| `RecordRoad` | `1` | 录制道路视频 |
| `RemoteAccess` | `0` | 远程访问 |

新增工具类 (`common/realtime.py`):
- `DurationTimer` / `ModelTimer` / `ControlsTimer` — 用于控制循环中的定时逻辑

---

## 五、转向力矩参数对比

### Gen1 (标准)
```
STEER_MAX = 600
STEER_DELTA_UP = 10
STEER_DELTA_DOWN = 25
STEER_DRIVER_ALLOWANCE = 15
STEER_DRIVER_MULTIPLIER = 40
```

### Gen1 (Torque Interceptor)
```
TI_STEER_MAX = 600
TI_STEER_DELTA_UP = 6      (更保守的上升速率)
TI_STEER_DELTA_DOWN = 15   (更保守的下降速率)
TI_STEER_DRIVER_ALLOWANCE = 15
TI_STEER_DRIVER_MULTIPLIER = 40
```

### Gen2 / Gen3
```
STEER_MAX = 8000            (13x Gen1)
STEER_DELTA_UP = 45
STEER_DELTA_DOWN = 80
STEER_DRIVER_ALLOWANCE = 1400
STEER_DRIVER_MULTIPLIER = 5
STEER_ERROR_MAX = 3500
```

---

## 六、非线性转向模型 (Gen2)

Gen2 车型使用 sigmoid + linear 曲线替代线性映射:

```python
NON_LINEAR_TORQUE_PARAMS = {
  MAZDA_3_2019:    (4.6,     0.6,     0.134,   0.3605),
  MAZDA_CX_30:     (4.68689, 0.79999, 0.18244, 0.38763),
  MAZDA_CX_30_2023:(4.68689, 0.79999, 0.18244, 0.38763),
  MAZDA_CX_50:     (4.68689, 0.79999, 0.18244, 0.38763),
}
# torque = sigmoid(a * lat_accel) * b + lat_accel * c
```

---

## 七、Commit 历史

| Commit | 作者 | 描述 |
|---|---|---|
| `513708e` | MoreTore | build on pc |
| `19b7dba` | MoreTore | Mazda panda — 安全层三代支持 + interceptor flags |
| `17346b8` | MoreTore | Mazda opendbc — Gen2 CAN 数据库 + checksum |
| `ae757d1` | MoreTore | Params — 新增 8 个持久化参数 |
| `f884a97` | MoreTore | DurationTimer — 控制定时工具类 |
| `ec1c9f3` | MoreTore | apply_ti_steer_torque_limits — TI 转向限制函数 |
| `edfc0df` | MoreTore | mazda frogpilot — 核心改动 (20 文件, +960/-171) |
| `10e7750` | MoreTore | Adjust lateral acceleration range |
| `cbcc59f` | MoreTore | Refactor automatic updates logic |
| `c74426b` | MoreTore | Add default params for Torque interceptor |
| `13d3660` | MoreTore | update default params |
| `d4f44c7` | MoreTore | mazda 3 2019 tune |
| `dcde5a8` | MoreTore | fix sticky integrator — PID anti-windup |
| `553b212` | jakethesake420 | mazda 2023+ — Gen3 支持 (11 文件, +816/-61) |
| `e8f38a4` | jakethesake420 | add steer actuator delay for Gen3 |
| `5f5c5ef` | jakethesake420 | 2023 checksum |
| `acb7d4e` | MoreTore | fix carstate |
| `945e7ae` | MoreTore | fix carstate |
| `f8ef95a` | MoreTore | Update cruiseState.standstill logic |
| `cc9616b` | MoreTore | Update main.c |
| `d1ed5df` | conversun | fix AMap search — SDK 加载修复 |

---

## 总结

本项目是一个深度马自达定制分支:

1. **Gen2 (2019-24) 完整支持** — 横向 + 纵向控制
2. **Gen3 (2023-26) 横向支持** — 仅转向辅助，无纵向
3. **Torque Interceptor 硬件方案** — Gen1 车型通过外置硬件突破原厂转向力矩限制
4. **Radar Interceptor 硬件方案** — Gen1 车型接入雷达实现自适应巡航
5. **控制算法优化** — 非线性转向模型、PID anti-windup 修复、BlendedACC
