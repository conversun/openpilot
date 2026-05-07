#include "selfdrive/ui/qt/onroad/alerts.h"

#include <QPainter>
#include <map>

#include "selfdrive/ui/qt/util.h"

#include <QCoreApplication>
#include <QHash>

static QString translateAlertText(const QString &text) {
  static const QHash<QString, const char*> map = {
    {"TAKE CONTROL IMMEDIATELY", QT_TRANSLATE_NOOP("OnroadAlert", "TAKE CONTROL IMMEDIATELY")}, // 立即接管！
    {"TAKE CONTROL", QT_TRANSLATE_NOOP("OnroadAlert", "TAKE CONTROL")}, // 立即接管
    {"DISENGAGE IMMEDIATELY", QT_TRANSLATE_NOOP("OnroadAlert", "DISENGAGE IMMEDIATELY")}, // 立即退出
    {"BRAKE!", QT_TRANSLATE_NOOP("OnroadAlert", "BRAKE!")}, // 制动！
    {"System Initializing", QT_TRANSLATE_NOOP("OnroadAlert", "System Initializing")}, // 系统初始化中
    {"openpilot Unavailable", QT_TRANSLATE_NOOP("OnroadAlert", "openpilot Unavailable")}, // openpilot 不可用
    {"Waiting for controls to start", QT_TRANSLATE_NOOP("OnroadAlert", "Waiting for controls to start")}, // 等待控制系统启动
    {"Controls Unresponsive", QT_TRANSLATE_NOOP("OnroadAlert", "Controls Unresponsive")}, // 控制系统无响应
    {"Reboot Device", QT_TRANSLATE_NOOP("OnroadAlert", "Reboot Device")}, // 重启设备
    {"Resume Driving Manually", QT_TRANSLATE_NOOP("OnroadAlert", "Resume Driving Manually")}, // 请手动继续驾驶
    {"Press Resume to Exit Standstill", QT_TRANSLATE_NOOP("OnroadAlert", "Press Resume to Exit Standstill")}, // 按恢复键退出停车状态
    {"Press Set to Engage", QT_TRANSLATE_NOOP("OnroadAlert", "Press Set to Engage")}, // 按设定键以启用
    {"Release Brake to Engage", QT_TRANSLATE_NOOP("OnroadAlert", "Release Brake to Engage")}, // 松开制动以启用
    {"Slow down to engage", QT_TRANSLATE_NOOP("OnroadAlert", "Slow down to engage")}, // 降速后可启用
    {"Steer Left to Start Lane Change Once Safe", QT_TRANSLATE_NOOP("OnroadAlert", "Steer Left to Start Lane Change Once Safe")}, // 安全时向左打方向盘以变道
    {"Steer Right to Start Lane Change Once Safe", QT_TRANSLATE_NOOP("OnroadAlert", "Steer Right to Start Lane Change Once Safe")}, // 安全时向右打方向盘以变道
    {"Car Detected in Blindspot", QT_TRANSLATE_NOOP("OnroadAlert", "Car Detected in Blindspot")}, // 盲区检测到车辆
    {"Changing Lanes", QT_TRANSLATE_NOOP("OnroadAlert", "Changing Lanes")}, // 正在变道
    {"Lane Departure Detected", QT_TRANSLATE_NOOP("OnroadAlert", "Lane Departure Detected")}, // 检测到车道偏离
    {"Steering Temporarily Unavailable", QT_TRANSLATE_NOOP("OnroadAlert", "Steering Temporarily Unavailable")}, // 转向暂时不可用
    {"Turn Exceeds Steering Limit", QT_TRANSLATE_NOOP("OnroadAlert", "Turn Exceeds Steering Limit")}, // 转弯超出转向限制
    {"Vehicle Steering Time Limit", QT_TRANSLATE_NOOP("OnroadAlert", "Vehicle Steering Time Limit")}, // 车辆转向时间限制
    {"Adaptive Cruise Disabled", QT_TRANSLATE_NOOP("OnroadAlert", "Adaptive Cruise Disabled")}, // 自适应巡航已禁用
    {"Cruise Is Off", QT_TRANSLATE_NOOP("OnroadAlert", "Cruise Is Off")}, // 巡航已关闭
    {"Cruise Fault: Restart the Car", QT_TRANSLATE_NOOP("OnroadAlert", "Cruise Fault: Restart the Car")}, // 巡航故障：请重启车辆
    {"Cruise Fault: Restart the car to engage", QT_TRANSLATE_NOOP("OnroadAlert", "Cruise Fault: Restart the car to engage")}, // 巡航故障：重启车辆后可启用
    {"LKAS Disabled", QT_TRANSLATE_NOOP("OnroadAlert", "LKAS Disabled")}, // LKAS 已禁用
    {"LKAS Disabled: Enable LKAS to engage", QT_TRANSLATE_NOOP("OnroadAlert", "LKAS Disabled: Enable LKAS to engage")}, // LKAS 已禁用：启用 LKAS 后可接管
    {"LKAS Fault: Restart the Car", QT_TRANSLATE_NOOP("OnroadAlert", "LKAS Fault: Restart the Car")}, // LKAS 故障：请重启车辆
    {"LKAS Fault: Restart the car to engage", QT_TRANSLATE_NOOP("OnroadAlert", "LKAS Fault: Restart the car to engage")}, // LKAS 故障：重启车辆后可启用
    {"Stock AEB: Risk of Collision", QT_TRANSLATE_NOOP("OnroadAlert", "Stock AEB: Risk of Collision")}, // 原厂 AEB：碰撞风险
    {"Risk of Collision", QT_TRANSLATE_NOOP("OnroadAlert", "Risk of Collision")}, // 碰撞风险
    {"Stock LKAS is on", QT_TRANSLATE_NOOP("OnroadAlert", "Stock LKAS is on")}, // 原厂 LKAS 已开启
    {"Turn off stock LKAS to engage", QT_TRANSLATE_NOOP("OnroadAlert", "Turn off stock LKAS to engage")}, // 请关闭原厂 LKAS 后再接管
    {"No lane available", QT_TRANSLATE_NOOP("OnroadAlert", "No lane available")}, // 当前无可用车道
    {"Pay Attention", QT_TRANSLATE_NOOP("OnroadAlert", "Pay Attention")}, // 请注意
    {"Driver Distracted", QT_TRANSLATE_NOOP("OnroadAlert", "Driver Distracted")}, // 驾驶员分心
    {"Driver Unresponsive", QT_TRANSLATE_NOOP("OnroadAlert", "Driver Unresponsive")}, // 驾驶员无响应
    {"Touch Steering Wheel", QT_TRANSLATE_NOOP("OnroadAlert", "Touch Steering Wheel")}, // 请触摸方向盘
    {"Touch Steering Wheel: No Face Detected", QT_TRANSLATE_NOOP("OnroadAlert", "Touch Steering Wheel: No Face Detected")}, // 请触摸方向盘：未检测到人脸
    {"Distraction Level Too High", QT_TRANSLATE_NOOP("OnroadAlert", "Distraction Level Too High")}, // 分心程度过高
    {"Dashcam Mode", QT_TRANSLATE_NOOP("OnroadAlert", "Dashcam Mode")}, // 行车记录仪模式
    {"Dashcam mode", QT_TRANSLATE_NOOP("OnroadAlert", "Dashcam mode")}, // 行车记录仪模式
    {"Dashcam mode for unsupported car", QT_TRANSLATE_NOOP("OnroadAlert", "Dashcam mode for unsupported car")}, // 不支持车型的行车记录仪模式
    {"Joystick Mode", QT_TRANSLATE_NOOP("OnroadAlert", "Joystick Mode")}, // 游戏手柄模式
    {"Be ready to take over at any time", QT_TRANSLATE_NOOP("OnroadAlert", "Be ready to take over at any time")}, // 请随时准备接管
    {"Security Key Not Available", QT_TRANSLATE_NOOP("OnroadAlert", "Security Key Not Available")}, // 安全密钥不可用
    {"Camera Malfunction", QT_TRANSLATE_NOOP("OnroadAlert", "Camera Malfunction")}, // 摄像头故障
    {"Camera Malfunction: Reboot Your Device", QT_TRANSLATE_NOOP("OnroadAlert", "Camera Malfunction: Reboot Your Device")}, // 摄像头故障：请重启设备
    {"Camera Frame Rate Low", QT_TRANSLATE_NOOP("OnroadAlert", "Camera Frame Rate Low")}, // 摄像头帧率过低
    {"Camera Frame Rate Low: Reboot Your Device", QT_TRANSLATE_NOOP("OnroadAlert", "Camera Frame Rate Low: Reboot Your Device")}, // 摄像头帧率过低：请重启设备
    {"Camera CRC Error - Road", QT_TRANSLATE_NOOP("OnroadAlert", "Camera CRC Error - Road")}, // 摄像头 CRC 错误 - 前置
    {"Camera CRC Error - Road Fisheye", QT_TRANSLATE_NOOP("OnroadAlert", "Camera CRC Error - Road Fisheye")}, // 摄像头 CRC 错误 - 广角
    {"Camera CRC Error - Driver", QT_TRANSLATE_NOOP("OnroadAlert", "Camera CRC Error - Driver")}, // 摄像头 CRC 错误 - 驾驶员
    {"Fan Malfunction", QT_TRANSLATE_NOOP("OnroadAlert", "Fan Malfunction")}, // 风扇故障
    {"Likely Hardware Issue", QT_TRANSLATE_NOOP("OnroadAlert", "Likely Hardware Issue")}, // 疑似硬件问题
    {"Speaker not found", QT_TRANSLATE_NOOP("OnroadAlert", "Speaker not found")}, // 未找到扬声器
    {"Harness Relay Malfunction", QT_TRANSLATE_NOOP("OnroadAlert", "Harness Relay Malfunction")}, // 线束继电器故障
    {"Check Hardware", QT_TRANSLATE_NOOP("OnroadAlert", "Check Hardware")}, // 请检查硬件
    {"USB Error: Reboot Your Device", QT_TRANSLATE_NOOP("OnroadAlert", "USB Error: Reboot Your Device")}, // USB 错误：请重启设备
    {"Sensor Data Invalid", QT_TRANSLATE_NOOP("OnroadAlert", "Sensor Data Invalid")}, // 传感器数据无效
    {"Possible Hardware Issue", QT_TRANSLATE_NOOP("OnroadAlert", "Possible Hardware Issue")}, // 疑似硬件问题
    {"Device Fell Off Mount", QT_TRANSLATE_NOOP("OnroadAlert", "Device Fell Off Mount")}, // 设备已脱落支架
    {"CAN Error", QT_TRANSLATE_NOOP("OnroadAlert", "CAN Error")}, // CAN 总线错误
    {"CAN Error: Check Connections", QT_TRANSLATE_NOOP("OnroadAlert", "CAN Error: Check Connections")}, // CAN 总线错误：请检查连接
    {"CAN Bus Disconnected", QT_TRANSLATE_NOOP("OnroadAlert", "CAN Bus Disconnected")}, // CAN 总线断开
    {"CAN Bus Disconnected: Check Connections", QT_TRANSLATE_NOOP("OnroadAlert", "CAN Bus Disconnected: Check Connections")}, // CAN 总线断开：请检查连接
    {"CAN Bus Disconnected: Likely Faulty Cable", QT_TRANSLATE_NOOP("OnroadAlert", "CAN Bus Disconnected: Likely Faulty Cable")}, // CAN 总线断开：线缆可能损坏
    {"Radar Error: Restart the Car", QT_TRANSLATE_NOOP("OnroadAlert", "Radar Error: Restart the Car")}, // 雷达错误：请重启车辆
    {"Out of Storage", QT_TRANSLATE_NOOP("OnroadAlert", "Out of Storage")}, // 存储空间不足
    {"Low Memory", QT_TRANSLATE_NOOP("OnroadAlert", "Low Memory")}, // 内存不足
    {"Low Memory: Reboot Your Device", QT_TRANSLATE_NOOP("OnroadAlert", "Low Memory: Reboot Your Device")}, // 内存不足：请重启设备
    {"System Overheated", QT_TRANSLATE_NOOP("OnroadAlert", "System Overheated")}, // 系统过热
    {"Low Battery", QT_TRANSLATE_NOOP("OnroadAlert", "Low Battery")}, // 电量不足
    {"Communication Issue Between Processes", QT_TRANSLATE_NOOP("OnroadAlert", "Communication Issue Between Processes")}, // 进程间通信异常
    {"Low Communication Rate Between Processes", QT_TRANSLATE_NOOP("OnroadAlert", "Low Communication Rate Between Processes")}, // 进程间通信速率过低
    {"Controls Lagging", QT_TRANSLATE_NOOP("OnroadAlert", "Controls Lagging")}, // 控制系统延迟
    {"Controls Process Lagging: Reboot Your Device", QT_TRANSLATE_NOOP("OnroadAlert", "Controls Process Lagging: Reboot Your Device")}, // 控制进程延迟：请重启设备
    {"Controls Mismatch", QT_TRANSLATE_NOOP("OnroadAlert", "Controls Mismatch")}, // 控制状态不一致
    {"Process Not Running", QT_TRANSLATE_NOOP("OnroadAlert", "Process Not Running")}, // 进程未运行
    {"Posenet Speed Invalid", QT_TRANSLATE_NOOP("OnroadAlert", "Posenet Speed Invalid")}, // 位姿估计速度无效
    {"Driving Model Lagging", QT_TRANSLATE_NOOP("OnroadAlert", "Driving Model Lagging")}, // 驾驶模型延迟
    {"Poor GPS reception", QT_TRANSLATE_NOOP("OnroadAlert", "Poor GPS reception")}, // GPS 信号较差
    {"Ensure device has a clear view of the sky", QT_TRANSLATE_NOOP("OnroadAlert", "Ensure device has a clear view of the sky")}, // 请确保设备可以清晰看到天空
    {"Calibration Incomplete", QT_TRANSLATE_NOOP("OnroadAlert", "Calibration Incomplete")}, // 标定未完成
    {"Calibration in Progress", QT_TRANSLATE_NOOP("OnroadAlert", "Calibration in Progress")}, // 标定进行中
    {"Calibration Invalid", QT_TRANSLATE_NOOP("OnroadAlert", "Calibration Invalid")}, // 标定数据无效
    {"Calibration Invalid: Remount Device & Recalibrate", QT_TRANSLATE_NOOP("OnroadAlert", "Calibration Invalid: Remount Device & Recalibrate")}, // 标定数据无效：请重新安装设备并重新标定
    {"Device Remount Detected: Recalibrating", QT_TRANSLATE_NOOP("OnroadAlert", "Device Remount Detected: Recalibrating")}, // 检测到设备重新安装：重新标定中
    {"Remount Detected: Recalibrating", QT_TRANSLATE_NOOP("OnroadAlert", "Remount Detected: Recalibrating")}, // 检测到重新安装：重新标定中
    {"Drive to Calibrate", QT_TRANSLATE_NOOP("OnroadAlert", "Drive to Calibrate")}, // 请驾驶以完成标定
    {"Vehicle Sensors Calibrating", QT_TRANSLATE_NOOP("OnroadAlert", "Vehicle Sensors Calibrating")}, // 车辆传感器标定中
    {"Vehicle Sensors Invalid", QT_TRANSLATE_NOOP("OnroadAlert", "Vehicle Sensors Invalid")}, // 车辆传感器数据无效
    {"Reverse Gear", QT_TRANSLATE_NOOP("OnroadAlert", "Reverse Gear")}, // 倒挡
    {"Gear not D", QT_TRANSLATE_NOOP("OnroadAlert", "Gear not D")}, // 当前非 D 挡
    {"Door Open", QT_TRANSLATE_NOOP("OnroadAlert", "Door Open")}, // 车门已打开
    {"Seatbelt Unlatched", QT_TRANSLATE_NOOP("OnroadAlert", "Seatbelt Unlatched")}, // 安全带未系
    {"Electronic Stability Control Disabled", QT_TRANSLATE_NOOP("OnroadAlert", "Electronic Stability Control Disabled")}, // ESC 已禁用
    {"Brake Hold Active", QT_TRANSLATE_NOOP("OnroadAlert", "Brake Hold Active")}, // 刹车保持已激活
    {"Parking Brake Engaged", QT_TRANSLATE_NOOP("OnroadAlert", "Parking Brake Engaged")}, // 手刹已拉起
    {"Pedal Pressed", QT_TRANSLATE_NOOP("OnroadAlert", "Pedal Pressed")}, // 踏板被按下
    {"Car Unrecognized", QT_TRANSLATE_NOOP("OnroadAlert", "Car Unrecognized")}, // 未识别车型
    {"Check comma power connections", QT_TRANSLATE_NOOP("OnroadAlert", "Check comma power connections")}, // 请检查 comma 电源连接
    {"Speed Too High", QT_TRANSLATE_NOOP("OnroadAlert", "Speed Too High")}, // 速度过高
    {"Speed too low", QT_TRANSLATE_NOOP("OnroadAlert", "Speed too low")}, // 速度过低
    {"Model uncertain at this speed", QT_TRANSLATE_NOOP("OnroadAlert", "Model uncertain at this speed")}, // 模型在此速度下不确定
    {"NNFF Torque Controller loaded", QT_TRANSLATE_NOOP("OnroadAlert", "NNFF Torque Controller loaded")}, // NNFF 力矩控制器已加载
    {"NNFF Torque Controller not available", QT_TRANSLATE_NOOP("OnroadAlert", "NNFF Torque Controller not available")}, // NNFF 力矩控制器不可用
    {"Donate logs to Twilsonco to get your car supported!", QT_TRANSLATE_NOOP("OnroadAlert", "Donate logs to Twilsonco to get your car supported!")}, // 捐赠日志给 Twilsonco 以获得您的车型支持！
    {"Light turned green", QT_TRANSLATE_NOOP("OnroadAlert", "Light turned green")}, // 红灯已变绿
    {"Lead departed", QT_TRANSLATE_NOOP("OnroadAlert", "Lead departed")}, // 前车已起步
    {"Speed limit changed", QT_TRANSLATE_NOOP("OnroadAlert", "Speed limit changed")}, // 限速已变更
    {"Traffic Mode enabled", QT_TRANSLATE_NOOP("OnroadAlert", "Traffic Mode enabled")}, // 交通模式已启用
    {"Traffic Mode Disabled", QT_TRANSLATE_NOOP("OnroadAlert", "Traffic Mode Disabled")}, // 交通模式已关闭
    {"Turning left", QT_TRANSLATE_NOOP("OnroadAlert", "Turning left")}, // 正在左转
    {"Turning right", QT_TRANSLATE_NOOP("OnroadAlert", "Turning right")}, // 正在右转
    {"Braking Unavailable", QT_TRANSLATE_NOOP("OnroadAlert", "Braking Unavailable")}, // 制动不可用
    {"Shift to L", QT_TRANSLATE_NOOP("OnroadAlert", "Shift to L")}, // 请切换至 L 挡
    {"WARNING: This branch is not tested", QT_TRANSLATE_NOOP("OnroadAlert", "WARNING: This branch is not tested")}, // 警告：此分支未经测试
    {"Don't use the 'Development' branch!", QT_TRANSLATE_NOOP("OnroadAlert", "Don't use the 'Development' branch!")}, // 请勿使用开发分支！
    {"Forcing you into 'Dashcam Mode' for your safety", QT_TRANSLATE_NOOP("OnroadAlert", "Forcing you into 'Dashcam Mode' for your safety")}, // 为您的安全已强制进入行车记录仪模式
    {"JESUS TAKE THE WHEEL!!", QT_TRANSLATE_NOOP("OnroadAlert", "JESUS TAKE THE WHEEL!!")}, // JESUS TAKE THE WHEEL!!
    {"This is fine ☕", QT_TRANSLATE_NOOP("OnroadAlert", "This is fine ☕")}, // 没事的 ☕
    {"I ain't giving you no tree-fiddy", QT_TRANSLATE_NOOP("OnroadAlert", "I ain't giving you no tree-fiddy")}, // I ain't giving you no tree-fiddy
    {"You damn Loch Ness Monsta!", QT_TRANSLATE_NOOP("OnroadAlert", "You damn Loch Ness Monsta!")}, // You damn Loch Ness Monsta!
    {"Great Scott!", QT_TRANSLATE_NOOP("OnroadAlert", "Great Scott!")}, // 我的天哪！
    {"IE Has Stopped Responding...", QT_TRANSLATE_NOOP("OnroadAlert", "IE Has Stopped Responding...")}, // IE 已停止响应…
    {"I'm sorry Dave", QT_TRANSLATE_NOOP("OnroadAlert", "I'm sorry Dave")}, // 对不起，戴夫
    {"I'm afraid I can't do that...", QT_TRANSLATE_NOOP("OnroadAlert", "I'm afraid I can't do that...")}, // 恐怕我不能那样做…
    {"To be continued...", QT_TRANSLATE_NOOP("OnroadAlert", "To be continued...")}, // 未完待续…
    {"Lol 69", QT_TRANSLATE_NOOP("OnroadAlert", "Lol 69")}, // Lol 69
    {"Your Frog tried to kill me...", QT_TRANSLATE_NOOP("OnroadAlert", "Your Frog tried to kill me...")}, // 你的青蛙想杀了我…
    {"You've got mail! 📧", QT_TRANSLATE_NOOP("OnroadAlert", "You've got mail! 📧")}, // 您有新邮件！📧
    {"UwU u went a bit fast there!", QT_TRANSLATE_NOOP("OnroadAlert", "UwU u went a bit fast there!")}, // UwU 你开得有点快哦！
    {"Always keep hands on wheel and eyes on road", QT_TRANSLATE_NOOP("OnroadAlert", "Always keep hands on wheel and eyes on road")}, // 请始终双手握方向盘，注意道路
    {"Please post the 'Error Log' in the FrogPilot Discord!", QT_TRANSLATE_NOOP("OnroadAlert", "Please post the 'Error Log' in the FrogPilot Discord!")}, // 请在 FrogPilot Discord 发布错误日志！
    {"openpilot crashed", QT_TRANSLATE_NOOP("OnroadAlert", "openpilot crashed")}, // openpilot 崩溃了
    {"openpilot crashed 💩", QT_TRANSLATE_NOOP("OnroadAlert", "openpilot crashed 💩")}, // openpilot 崩溃了 💩
  };
  auto it = map.find(text);
  return it != map.end() ? QCoreApplication::translate("OnroadAlert", it.value()) : text;
}


void OnroadAlerts::updateState(const UIState &s, const FrogPilotUIState &fs) {
  Alert a = getAlert(*(s.sm), *(fs.sm), s.scene.started_frame, fs.frogpilot_toggles);
  if (!alert.equal(a)) {
    if (alert.status == cereal::ControlsState::AlertStatus::NORMAL && fs.frogpilot_toggles.value("hide_alerts").toBool()) {
      clear();
    } else {
      alert = a;

      update();
    }
  }

  // FrogPilot variables
  sidebarsOpen = fs.frogpilot_scene.sidebars_open;
}

void OnroadAlerts::clear() {
  alertHeight = 0;

  alert = {};
  update();
}

OnroadAlerts::Alert OnroadAlerts::getAlert(const SubMaster &sm, const SubMaster &fpsm, uint64_t started_frame, QJsonObject &frogpilot_toggles) {
  const cereal::ControlsState::Reader &cs = sm["controlsState"].getControlsState();
  const cereal::FrogPilotControlsState::Reader &fpcs = fpsm["frogpilotControlsState"].getFrogpilotControlsState();
  const uint64_t controls_frame = sm.rcv_frame("controlsState");

  Alert a = {};
  static QString crash_log_path = "/data/error_logs/error.txt";
  if (QFile::exists(crash_log_path)) {
    if (frogpilot_toggles.value("random_events").toBool()) {
      if (enableFerg) {
        displayFerg = true;
      } else {
        a = {tr("openpilot crashed 💩"),
             tr("Please post the \"Error Log\" in the FrogPilot Discord!"),
             "openpilotCrashedRandomEvent",
             cereal::ControlsState::AlertSize::MID,
             cereal::ControlsState::AlertStatus::CRITICAL};
      }
    } else {
      a = {tr("openpilot crashed"),
           tr("Please post the \"Error Log\" in the FrogPilot Discord!"),
           "openpilotCrashed",
           cereal::ControlsState::AlertSize::MID,
           cereal::ControlsState::AlertStatus::CRITICAL};
    }
    return a;
  } else if (controls_frame >= started_frame) {  // Don't get old alert.
    a = {translateAlertText(cs.getAlertText1().cStr()), translateAlertText(cs.getAlertText2().cStr()),
         cs.getAlertType().cStr(), cs.getAlertSize(), cs.getAlertStatus()};

    if (a.size == cereal::ControlsState::AlertSize::NONE) {
      a = {translateAlertText(fpcs.getAlertText1().cStr()), translateAlertText(fpcs.getAlertText2().cStr()),
           fpcs.getAlertType().cStr(), static_cast<cereal::ControlsState::AlertSize>(fpcs.getAlertSize()), static_cast<cereal::ControlsState::AlertStatus>(fpcs.getAlertStatus())};
    }
  }

  if (!sm.updated("controlsState") && (sm.frame - started_frame) > 5 * UI_FREQ && !frogpilot_toggles.value("force_onroad").toBool()) {
    const int CONTROLS_TIMEOUT = 5;
    const int controls_missing = (nanos_since_boot() - sm.rcv_time("controlsState")) / 1e9;

    // Handle controls timeout
    if (controls_frame < started_frame) {
      // car is started, but controlsState hasn't been seen at all
      a = {tr("openpilot Unavailable"), tr("Waiting for controls to start"),
           "controlsWaiting", cereal::ControlsState::AlertSize::MID,
           cereal::ControlsState::AlertStatus::NORMAL};
    } else if (controls_missing > CONTROLS_TIMEOUT && !Hardware::PC()) {
      // car is started, but controls is lagging or died
      if (cs.getEnabled() && (controls_missing - CONTROLS_TIMEOUT) < 10) {
        a = {tr("TAKE CONTROL IMMEDIATELY"), tr("Controls Unresponsive"),
             "controlsUnresponsive", cereal::ControlsState::AlertSize::FULL,
             cereal::ControlsState::AlertStatus::CRITICAL};
      } else {
        a = {tr("Controls Unresponsive"), tr("Reboot Device"),
             "controlsUnresponsivePermanent", cereal::ControlsState::AlertSize::MID,
             cereal::ControlsState::AlertStatus::NORMAL};
      }
    }
  }
  return a;
}

void OnroadAlerts::paintEvent(QPaintEvent *event) {
  if (displayFerg) {
    QPainter p(this);
    p.drawPixmap(QPoint((width() - ferg.width()) / 2, (height() - ferg.height()) / 2), ferg);
    return;
  }
  if (alert.size == cereal::ControlsState::AlertSize::NONE) {
    alertHeight = 0;
    return;
  }
  static std::map<cereal::ControlsState::AlertSize, const int> alert_heights = {
    {cereal::ControlsState::AlertSize::SMALL, 271},
    {cereal::ControlsState::AlertSize::MID, 420},
    {cereal::ControlsState::AlertSize::FULL, height()},
  };
  alertHeight = alert_heights[alert.size];
  int h = alertHeight;

  int margin = 40;
  int radius = 30;
  if (alert.size == cereal::ControlsState::AlertSize::FULL) {
    margin = 0;
    radius = 0;
  }
  alertHeight -= margin;
  QRect r = QRect(0 + margin, height() - h + margin, width() - margin*2, h - margin*2);

  QPainter p(this);

  // draw background + gradient
  p.setPen(Qt::NoPen);
  p.setCompositionMode(QPainter::CompositionMode_SourceOver);
  p.setBrush(QBrush(frogpilot_alert_colors[static_cast<cereal::FrogPilotControlsState::AlertStatus>(alert.status)]));
  p.drawRoundedRect(r, radius, radius);

  QLinearGradient g(0, r.y(), 0, r.bottom());
  g.setColorAt(0, QColor::fromRgbF(0, 0, 0, 0.05));
  g.setColorAt(1, QColor::fromRgbF(0, 0, 0, 0.35));

  p.setCompositionMode(QPainter::CompositionMode_DestinationOver);
  p.setBrush(QBrush(g));
  p.drawRoundedRect(r, radius, radius);
  p.setCompositionMode(QPainter::CompositionMode_SourceOver);

  // text
  const QPoint c = r.center();
  p.setPen(QColor(0xff, 0xff, 0xff));
  p.setRenderHint(QPainter::TextAntialiasing);
  if (alert.size == cereal::ControlsState::AlertSize::SMALL) {
    bool long_alert1 = alert.text1.length() > 40;
    p.setFont(InterFont(long_alert1 && sidebarsOpen ? 64 : 74, QFont::DemiBold));
    p.drawText(r, Qt::AlignCenter, alert.text1);
  } else if (alert.size == cereal::ControlsState::AlertSize::MID) {
    bool long_alert1 = alert.text1.length() > 30;
    p.setFont(InterFont(long_alert1 && sidebarsOpen ? 78 : 88, QFont::Bold));
    p.drawText(QRect(0, c.y() - 125, width(), 150), Qt::AlignHCenter | Qt::AlignTop, alert.text1);
    bool long_alert2 = alert.text2.length() > 40;
    p.setFont(InterFont(long_alert2 && sidebarsOpen ? 56 : 66));
    p.drawText(QRect(0, c.y() + 21, width(), 90), Qt::AlignHCenter, alert.text2);
  } else if (alert.size == cereal::ControlsState::AlertSize::FULL) {
    bool l = alert.text1.length() > 15;
    p.setFont(InterFont(l ? 132 : 177, QFont::Bold));
    p.drawText(QRect(0, r.y() + (l ? 240 : 270), width(), 600), Qt::AlignHCenter | Qt::TextWordWrap, alert.text1);
    p.setFont(InterFont(88));
    p.drawText(QRect(0, r.height() - (l ? 361 : 420), width(), 300), Qt::AlignHCenter | Qt::TextWordWrap, alert.text2);
  }
}
