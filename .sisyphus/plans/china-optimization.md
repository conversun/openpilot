# 中国大陆体验优化 — The Pond Web UI

## TL;DR

> **Quick Summary**: 替换被 GFW 屏蔽/缓慢的外部资源（Google Fonts、Mapbox CDN），并将导航页面剩余英文文本翻译为中文。
> 
> **Deliverables**:
> - Google Fonts (Open Sans) 替换为系统字体栈
> - Mapbox GL JS/CSS/Worker 本地打包到 assets/vendor/
> - 导航页面英文字符串翻译为中文（含单位和日期格式）
> 
> **Estimated Effort**: Short (~1-2 hours)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1,2,3 (parallel) → Task 4 (verification)

---

## Context

### Original Request
用户要求优化整个 The Pond Web UI 在中国大陆的体验，包括 CDN 资源、字体、外部脚本等所有可能被 GFW 影响的部分，以及 UI 本地化。

### Interview Summary
**Key Discussions**:
- 范围确定：GFW 资源替换 + 导航页面本地化（不含其他页面）
- Google Fonts：用户选择换系统字体（非本地打包，非国内 CDN）
- Mapbox GL JS/CSS：用户选择本地打包（不换 jsdelivr CDN）
- 本地化范围：仅导航页面（navigation_destination.js + navigation_utilities.js）

**Research Findings**:
- 21 个外部 URL 审计完成：1 个 BLOCKED（Google Fonts），7 个 SLOW（Mapbox），13 个 ACCESSIBLE
- Mapbox GL JS 本地打包需要额外处理 Web Worker 文件
- 导航页面有英文残留在 tooltips、时间/距离格式、日期格式中

### Metis Review
**Identified Gaps** (addressed):
- 字体名称纠正：实际是 "Open Sans" 而非 "Inter"（通过阅读 index.html 和 main.css 确认）
- Mapbox GL JS Web Worker 文件必须同步下载并配置 `mapboxgl.workerUrl`
- 英文字符串不仅在 navigation_destination.js，还在 navigation_utilities.js（tooltip 标签 + 单位格式）
- comma 设备运行 Ubuntu Linux，"PingFang SC" 仅限 Apple，需包含 "Noto Sans SC"
- ETA 日期使用英文序数词（1st, 2nd），需改为中文日期格式

---

## Work Objectives

### Core Objective
消除 The Pond Web UI 在中国大陆使用时的 GFW 阻塞和英文残留问题。

### Concrete Deliverables
- `index.html`：移除 Google Fonts 引用，Mapbox 引用改为本地路径
- `main.css`：`--font-body` 改为系统字体栈
- `assets/vendor/`：3 个 Mapbox 本地文件（JS + CSS + Worker）
- `navigation_destination.js`：ETA 日期格式中文化 + workerUrl 配置
- `navigation_utilities.js`：tooltip 标签 + 时间/距离单位中文化

### Definition of Done
- [ ] `grep -rn "fonts.googleapis.com\|fonts.gstatic.com" frogpilot/system/the_pond/` → 无匹配
- [ ] `grep -rn "api.mapbox.com/mapbox-gl-js" frogpilot/system/the_pond/templates/` → 无匹配
- [ ] 本地 Mapbox 文件存在于 `assets/vendor/`
- [ ] 导航 tooltip 显示中文标签
- [ ] 时间/距离格式使用中文单位

### Must Have
- Google Fonts `<link>` 从 index.html 完全移除
- Mapbox GL JS + CSS + Worker 本地化到 assets/vendor/
- `mapboxgl.workerUrl` 在创建 Map 实例前设置
- tooltip "Distance:"/"Duration:"/"ETA:" 翻译为中文
- 时间格式："X小时Y分钟" 替代 "Xh Y min"
- 距离格式："X 公里" / "X 米" 替代 "X km" / "X m"

### Must NOT Have (Guardrails)
- ❌ 不修改 `font-family: "password"`（settings.css 中的密码遮罩字体）
- ❌ 不修改任何 Mapbox API `fetch()` 调用（directions, geocoding, search 的 URL 不变）
- ❌ 不修改 `the_pond.py` 后端代码
- ❌ 不替换 ACCESSIBLE 的 CDN 资源（esm.sh, jsdelivr, S3）
- ❌ 不引入 i18n 框架或语言切换逻辑
- ❌ 不修改地图样式、图层配置或 mapboxgl.Map 构造参数
- ❌ 不翻译导航页面以外的其他页面
- ❌ 不修改已有的正确中文翻译

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (pytest)
- **Automated tests**: None for frontend UI — use Agent-Executed QA only
- **Framework**: N/A (static frontend, no build step)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **File verification**: Use Bash (grep, ls) — verify file contents and references
- **Frontend/UI**: Use Playwright (playwright skill) — navigate device, verify map loads, check font rendering

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — all 3 tasks are independent):
├── Task 1: 替换 Google Fonts 为系统字体 [quick]
├── Task 2: Mapbox GL JS/CSS/Worker 本地打包 [unspecified-low]
└── Task 3: 导航页面英文翻译 [quick]

Wave 2 (After Wave 1 — verification):
└── Task 4: 最终验证审计 [quick]

Wave FINAL (After ALL tasks — independent review):
├── Task F1: Plan compliance audit [quick]
└── Task F2: Real QA on device [unspecified-high + playwright]

Critical Path: Task 1,2,3 (parallel) → Task 4 → F1,F2 (parallel)
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 (Font) | — | 4 |
| 2 (Mapbox) | — | 4 |
| 3 (Translation) | — | 4 |
| 4 (Verification) | 1, 2, 3 | F1, F2 |
| F1 (Compliance) | 4 | — |
| F2 (Device QA) | 4 | — |

### Agent Dispatch Summary

- **Wave 1**: **3 tasks** — T1 → `quick`, T2 → `unspecified-low`, T3 → `quick`
- **Wave 2**: **1 task** — T4 → `quick`
- **FINAL**: **2 tasks** — F1 → `quick`, F2 → `unspecified-high` + `playwright` skill

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [x] 1. 替换 Google Fonts (Open Sans) 为系统字体栈

  **What to do**:
  - 在 `main.css` 第 74 行，将 `--font-body: "Open Sans", sans-serif;` 改为 `--font-body: system-ui, -apple-system, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", sans-serif;`
  - 在 `index.html` 中，删除 Google Fonts 相关的所有行（preconnect 链接 + CSS 链接，包含 `fonts.googleapis.com` 和 `fonts.gstatic.com` 的行）
  - 确认删除后没有其他文件引用 "Open Sans"

  **Must NOT do**:
  - 不要修改 `settings.css` 中的 `font-family: "password"`（这是密码遮罩字体）
  - 不要修改 Bootstrap Icons 或 Font Awesome 的 @font-face 声明
  - 不要添加任何字体文件下载

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 单行 CSS 变量修改 + HTML 删除几行，极简任务
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 不涉及 UI 设计，仅是字体替换

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `frogpilot/system/the_pond/assets/components/main.css:74` — `--font-body` CSS 变量定义，这是唯一需要修改的字体声明位置
  - `frogpilot/system/the_pond/templates/index.html:42-45` — Google Fonts preconnect + CSS link 行，需要删除
  - `frogpilot/system/the_pond/assets/components/settings.css:5` — `font-family: "password"` — **不要修改这里**

  **WHY Each Reference Matters**:
  - `main.css:74` 是全局字体变量，所有页面通过 `var(--font-body)` 引用它，只改这一处即可
  - `index.html` 的 Google Fonts 行必须删除，否则浏览器仍会尝试加载被墙资源，导致页面加载卡顿
  - `settings.css` 的 password 字体是密码遮罩用，不相关，切勿触碰

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Google Fonts 引用完全移除
    Tool: Bash (grep)
    Preconditions: Task 1 完成
    Steps:
      1. 运行 `grep -rn "fonts.googleapis.com\|fonts.gstatic.com\|Open Sans" frogpilot/system/the_pond/templates/index.html`
      2. 检查退出码
    Expected Result: 退出码 1（无匹配）
    Failure Indicators: 退出码 0 且输出包含 googleapis/gstatic/Open Sans
    Evidence: .sisyphus/evidence/task-1-no-google-fonts.txt

  Scenario: 系统字体栈已设置
    Tool: Bash (grep)
    Preconditions: Task 1 完成
    Steps:
      1. 运行 `grep "font-body" frogpilot/system/the_pond/assets/components/main.css`
      2. 检查输出是否包含 "system-ui"
    Expected Result: 输出包含 `system-ui, -apple-system, "PingFang SC", "Noto Sans SC"`
    Failure Indicators: 输出仍包含 "Open Sans"
    Evidence: .sisyphus/evidence/task-1-system-font.txt

  Scenario: 密码字体未被影响
    Tool: Bash (grep)
    Preconditions: Task 1 完成
    Steps:
      1. 运行 `grep "password" frogpilot/system/the_pond/assets/components/settings.css`
      2. 检查输出是否仍包含 font-family: "password"
    Expected Result: `font-family: "password"` 仍然存在
    Failure Indicators: password 字体声明被删除或修改
    Evidence: .sisyphus/evidence/task-1-password-font-intact.txt
  ```

  **Commit**: YES
  - Message: `fix(the_pond): replace Google Fonts with system font stack for GFW compatibility`
  - Files: `frogpilot/system/the_pond/assets/components/main.css`, `frogpilot/system/the_pond/templates/index.html`
  - Pre-commit: N/A

---

- [x] 2. Mapbox GL JS/CSS/Worker 本地打包

  **What to do**:
  - 创建目录 `frogpilot/system/the_pond/assets/vendor/`
  - 下载以下 3 个文件（使用 curl）：
    - `https://api.mapbox.com/mapbox-gl-js/v3.18.1/mapbox-gl.js` → `assets/vendor/mapbox-gl.js`
    - `https://api.mapbox.com/mapbox-gl-js/v3.18.1/mapbox-gl.css` → `assets/vendor/mapbox-gl.css`
    - `https://api.mapbox.com/mapbox-gl-js/v3.18.1/mapbox-gl-csp-worker.js` → `assets/vendor/mapbox-gl-csp-worker.js`
  - 在 `index.html` 中：
    - 将 Mapbox CSS `<link>` 的 href 从 `https://api.mapbox.com/mapbox-gl-js/v3.18.1/mapbox-gl.css` 改为 `/assets/vendor/mapbox-gl.css`
    - 将 Mapbox JS `<script>` 的 src 从 `https://api.mapbox.com/mapbox-gl-js/v3.18.1/mapbox-gl.js` 改为 `/assets/vendor/mapbox-gl.js`
  - 在 `navigation_destination.js` 中，在 `mapboxgl.accessToken = ...` 行之前，添加：
    ```js
    mapboxgl.workerUrl = "/assets/vendor/mapbox-gl-csp-worker.js";
    ```
  - 下载后检查 `mapbox-gl.css` 内容，查看是否有 `url()` 引用外部服务器，如有则记录但不修改

  **Must NOT do**:
  - 不要修改 Mapbox GL JS 的版本（保持 v3.18.1）
  - 不要修改任何 `fetch()` 调用 api.mapbox.com 的 URL（directions, geocoding, search, styles 这些 API 调用不变）
  - 不要修改 `mapboxgl.Map` 构造参数或地图样式配置
  - 不要修改 `the_pond.py` 后端代码（Flask 静态文件服务已自动覆盖 assets/ 目录）
  - 不要打包其他 CDN 资源（Bootstrap Icons, Font Awesome, esm.sh 等 ACCESSIBLE 的不动）

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 涉及文件下载 + HTML/JS 修改，不复杂但步骤多
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: 不需要浏览器验证，仅文件操作

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `frogpilot/system/the_pond/templates/index.html` — 当前的 Mapbox CDN `<link>` 和 `<script>` 标签位置
  - `frogpilot/system/the_pond/assets/components/navigation/navigation_destination.js` — 搜索 `mapboxgl.accessToken` 行，在其前插入 workerUrl

  **API/Type References**:
  - Flask static serving: `Flask(__name__, static_folder="assets", static_url_path="/assets")` — 确认 `/assets/vendor/` 路径会被自动服务

  **External References**:
  - Mapbox GL JS CSP Worker 文档：`mapbox-gl-csp-worker.js` 是用于 Content Security Policy 环境的 worker 文件，必须通过 `mapboxgl.workerUrl` 配置

  **WHY Each Reference Matters**:
  - `index.html` 的 CDN 引用是需要替换的目标
  - `navigation_destination.js` 中 `mapboxgl.accessToken` 是最佳插入 workerUrl 的位置，因为它在 Map 实例创建之前
  - Flask 静态文件配置确认无需后端修改，文件放入 assets/ 即可服务

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Mapbox 本地文件存在
    Tool: Bash (ls)
    Preconditions: Task 2 完成
    Steps:
      1. 运行 `ls -la frogpilot/system/the_pond/assets/vendor/mapbox-gl.js frogpilot/system/the_pond/assets/vendor/mapbox-gl.css frogpilot/system/the_pond/assets/vendor/mapbox-gl-csp-worker.js`
      2. 检查所有 3 个文件都存在且大小合理（JS > 500KB, CSS > 10KB, Worker > 50KB）
    Expected Result: 3 个文件都存在，大小合理
    Failure Indicators: 任一文件缺失或大小为 0
    Evidence: .sisyphus/evidence/task-2-vendor-files.txt

  Scenario: index.html 引用本地路径
    Tool: Bash (grep)
    Preconditions: Task 2 完成
    Steps:
      1. 运行 `grep -n "mapbox" frogpilot/system/the_pond/templates/index.html`
      2. 检查输出中不包含 "api.mapbox.com/mapbox-gl-js" CDN URL
      3. 检查输出包含 "/assets/vendor/mapbox-gl" 本地路径
    Expected Result: 只有本地路径引用，无 CDN URL
    Failure Indicators: 输出包含 "api.mapbox.com/mapbox-gl-js"
    Evidence: .sisyphus/evidence/task-2-local-refs.txt

  Scenario: workerUrl 已配置
    Tool: Bash (grep)
    Preconditions: Task 2 完成
    Steps:
      1. 运行 `grep -n "workerUrl" frogpilot/system/the_pond/assets/components/navigation/navigation_destination.js`
      2. 检查输出包含 "mapbox-gl-csp-worker.js"
    Expected Result: 找到 `mapboxgl.workerUrl = "/assets/vendor/mapbox-gl-csp-worker.js"` 行
    Failure Indicators: 无匹配或路径不正确
    Evidence: .sisyphus/evidence/task-2-worker-url.txt
  ```

  **Commit**: YES (group with Task 1)
  - Message: `fix(the_pond): bundle Mapbox GL JS locally for GFW compatibility`
  - Files: `frogpilot/system/the_pond/assets/vendor/mapbox-gl.js`, `frogpilot/system/the_pond/assets/vendor/mapbox-gl.css`, `frogpilot/system/the_pond/assets/vendor/mapbox-gl-csp-worker.js`, `frogpilot/system/the_pond/templates/index.html`, `frogpilot/system/the_pond/assets/components/navigation/navigation_destination.js`
  - Pre-commit: N/A

---

- [x] 3. 导航页面英文残留翻译

  **What to do**:
  - 在 `navigation_utilities.js` 中，翻译 tooltip 标签（约第 79-81 行）：
    - `"Distance:"` → `"距离："`
    - `"Duration:"` → `"时长："`
    - `"ETA:"` → `"预计到达："`
  - 在 `navigation_utilities.js` 中，修改时间格式化函数：
    - `formatSecondsToHuman()` 和 `formatSecondsToAmerican()`：
      - `"Xh Y min"` / `"X hr Y min"` → `"X小时Y分钟"`
      - `"Y min"` → `"Y分钟"`
  - 在 `navigation_utilities.js` 中，修改距离格式化函数：
    - `formatMetersToHuman()`：
      - `"X km"` → `"X 公里"`
      - `"X m"` → `"X 米"`
      - `"X mi"` → `"X 英里"`（如有）
      - `"X ft"` → `"X 英尺"`（如有）
  - 在 `navigation_destination.js` 中，修改 ETA 日期格式（约第 908 行）：
    - 英文格式 `${month} ${day}${getOrdinalSuffix(day)}, ${year}, ${timeStr}` 
    - 改为中文格式 `${year}年${month + 1}月${day}日 ${timeStr}`
  - 同样修改 `navigation_utilities.js` 中 tooltip 的 ETA 日期格式（约第 74 行）
  - 检查并修复 `getOrdinalSuffix()` 的使用 — 如果仅用于 ETA 且 ETA 已改为中文格式，该函数可能不再需要

  **Must NOT do**:
  - 不要引入 i18n 框架或语言切换逻辑，直接替换字符串
  - 不要修改已有的正确中文翻译（如搜索框、按钮等已经是中文的部分）
  - 不要翻译导航页面以外的其他页面
  - 不要修改功能逻辑，仅修改显示文本

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 字符串替换任务，文件少、修改点明确
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `frogpilot/system/the_pond/assets/components/navigation/navigation_utilities.js:79-81` — tooltip HTML 模板，包含 "Distance:"/"Duration:"/"ETA:" 英文标签
  - `frogpilot/system/the_pond/assets/components/navigation/navigation_utilities.js:187` — `formatSecondsToHuman()` 返回 "Xh Y min" 英文格式
  - `frogpilot/system/the_pond/assets/components/navigation/navigation_utilities.js:198` — `formatSecondsToAmerican()` 返回 "X hr Y min" 英文格式
  - `frogpilot/system/the_pond/assets/components/navigation/navigation_destination.js:908` — ETA 日期格式使用英文序数词
  - `frogpilot/system/the_pond/assets/components/navigation/navigation_utilities.js:74` — tooltip 中的 ETA 日期格式

  **WHY Each Reference Matters**:
  - 第 79-81 行是 tooltip HTML 模板，用户悬停在备选路线上时会看到这些英文标签
  - 格式化函数返回的字符串会显示在 UI 中，英文缩写对中文用户不友好
  - ETA 日期格式使用英文序数词和英文月份名，需要改为中文日期格式

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: tooltip 标签已翻译为中文
    Tool: Bash (grep)
    Preconditions: Task 3 完成
    Steps:
      1. 运行 `grep -n '"Distance:\|"Duration:\|"ETA:' frogpilot/system/the_pond/assets/components/navigation/navigation_utilities.js`
      2. 检查退出码
    Expected Result: 退出码 1（无匹配，英文标签已被替换）
    Failure Indicators: 找到 "Distance:"/"Duration:"/"ETA:" 英文文本
    Evidence: .sisyphus/evidence/task-3-no-english-labels.txt

  Scenario: 时间格式使用中文单位
    Tool: Bash (grep)
    Preconditions: Task 3 完成
    Steps:
      1. 运行 `grep -n '小时\|分钟' frogpilot/system/the_pond/assets/components/navigation/navigation_utilities.js`
      2. 检查输出中包含中文时间单位
    Expected Result: 找到包含 "小时" 和 "分钟" 的行
    Failure Indicators: 仅找到 "h"/"min"/"hr" 英文缩写
    Evidence: .sisyphus/evidence/task-3-chinese-time-units.txt

  Scenario: 距离格式使用中文单位
    Tool: Bash (grep)
    Preconditions: Task 3 完成
    Steps:
      1. 运行 `grep -n '公里\|米' frogpilot/system/the_pond/assets/components/navigation/navigation_utilities.js`
      2. 检查输出中包含中文距离单位
    Expected Result: 找到包含 "公里" 和 "米" 的行
    Failure Indicators: 仅找到 "km"/"m" 英文缩写
    Evidence: .sisyphus/evidence/task-3-chinese-distance-units.txt

  Scenario: ETA 日期使用中文格式
    Tool: Bash (grep)
    Preconditions: Task 3 完成
    Steps:
      1. 运行 `grep -n 'getOrdinalSuffix' frogpilot/system/the_pond/assets/components/navigation/navigation_destination.js`
      2. 检查是否仍在 ETA 格式中使用英文序数词
    Expected Result: 无匹配（序数词已被中文日期格式替代）或仅在非 ETA 场景使用
    Failure Indicators: ETA 格式化仍使用 getOrdinalSuffix
    Evidence: .sisyphus/evidence/task-3-chinese-date-format.txt
  ```

  **Commit**: YES (group with Tasks 1, 2)
  - Message: `feat(the_pond): translate navigation UI English remnants to Chinese`
  - Files: `frogpilot/system/the_pond/assets/components/navigation/navigation_utilities.js`, `frogpilot/system/the_pond/assets/components/navigation/navigation_destination.js`
  - Pre-commit: N/A

---

- [x] 4. 最终验证审计

  **What to do**:
  - 运行综合 grep 扫描 `frogpilot/system/the_pond/` 目录，确认：
    1. 无 `fonts.googleapis.com` 或 `fonts.gstatic.com` 引用残留
    2. 无 `api.mapbox.com/mapbox-gl-js` CDN 引用残留（API 调用不算）
    3. 无 "Distance:"/"Duration:"/"ETA:" 英文标签残留
    4. 本地 Mapbox 文件存在且大小正常
    5. workerUrl 已配置
  - 如发现问题，报告具体文件和行号

  **Must NOT do**:
  - 不要修改任何文件，仅验证

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 纯验证任务，运行几个 grep 命令
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after Tasks 1, 2, 3)
  - **Blocks**: F1, F2
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  - 所有 Task 1-3 的 QA Scenarios 命令 — 这个任务重新运行它们作为交叉验证

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: 全量审计 — 无被墙资源残留
    Tool: Bash (grep)
    Preconditions: Tasks 1-3 全部完成
    Steps:
      1. `grep -rn "fonts.googleapis.com\|fonts.gstatic.com" frogpilot/system/the_pond/` → 退出码 1
      2. `grep -rn "api.mapbox.com/mapbox-gl-js" frogpilot/system/the_pond/templates/` → 退出码 1
      3. `grep -n '"Distance:\|"Duration:\|"ETA:' frogpilot/system/the_pond/assets/components/navigation/navigation_utilities.js` → 退出码 1
      4. `ls -la frogpilot/system/the_pond/assets/vendor/mapbox-gl*.js frogpilot/system/the_pond/assets/vendor/mapbox-gl.css` → 3 files exist
      5. `grep -n "workerUrl" frogpilot/system/the_pond/assets/components/navigation/navigation_destination.js` → 找到匹配
    Expected Result: 所有 5 个检查通过
    Failure Indicators: 任一检查失败
    Evidence: .sisyphus/evidence/task-4-full-audit.txt
  ```

  **Commit**: NO (仅验证，不产生文件变更)

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 2 review agents run in PARALLEL. ALL must APPROVE.

- [ ] F1. **Plan Compliance Audit** — `quick`
  读取计划中的每个 "Must Have" 和 "Must NOT Have"。对每个 Must Have：验证实现存在（读文件、运行命令）。对每个 Must NOT Have：搜索代码库确认无禁止模式。检查 evidence 文件存在于 `.sisyphus/evidence/`。
  Output: `Must Have [N/N] | Must NOT Have [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Real Device QA** — `unspecified-high` + `playwright` skill
  在设备上进行实际测试。打开 `http://192.168.1.128:8082`，验证：
  1. 页面加载时无 Google Fonts 请求（检查控制台网络日志）
  2. Mapbox GL JS 从本地加载（检查控制台无 CDN 加载错误）
  3. 地图正常渲染（瓦片加载，地图可拖动/缩放）
  4. 搜索 "天安门"，选择结果，查看路线 tooltip 显示中文标签（距离、时长、预计到达）
  5. 字体渲染正常（无乱码，无缺失字符）
  Output: `截图 + VERDICT: APPROVE/REJECT`

---

## Commit Strategy

- **Wave 1 commit**: 合并 Tasks 1, 2, 3 为一个提交
  - Message: `fix(the_pond): optimize China mainland experience - local Mapbox bundle, system fonts, Chinese translations`
  - Files: index.html, main.css, navigation_destination.js, navigation_utilities.js, assets/vendor/mapbox-gl.*, assets/vendor/mapbox-gl-csp-worker.js

---

## Success Criteria

### Verification Commands
```bash
# 无被墙资源引用
grep -rn "fonts.googleapis.com\|fonts.gstatic.com" frogpilot/system/the_pond/  # Expected: 无输出, exit 1

# 无 Mapbox CDN 引用
grep -rn "api.mapbox.com/mapbox-gl-js" frogpilot/system/the_pond/templates/    # Expected: 无输出, exit 1

# 本地 Mapbox 文件存在
ls frogpilot/system/the_pond/assets/vendor/mapbox-gl*                          # Expected: 3 files

# 无英文导航标签
grep -n '"Distance:\|"Duration:\|"ETA:' frogpilot/system/the_pond/assets/components/navigation/navigation_utilities.js  # Expected: 无输出, exit 1
```

### Final Checklist
- [ ] Google Fonts 引用完全移除
- [ ] 系统字体栈已设置（包含 PingFang SC, Noto Sans SC）
- [ ] Mapbox GL JS/CSS/Worker 本地文件存在且大小正常
- [ ] index.html 引用本地路径
- [ ] mapboxgl.workerUrl 已配置
- [ ] 导航 tooltip 显示中文标签
- [ ] 时间/距离格式使用中文单位
- [ ] ETA 日期使用中文格式
- [ ] 密码字体未受影响
- [ ] 地图正常渲染