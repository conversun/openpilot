import { html } from "https://esm.sh/@arrow-js/core"

export function SpeedLimits() {
  function handleDownload() {
    const link = document.createElement("a")
    link.href = "/api/speed_limits"
    link.download = "speed_limits.json"
    link.click()

    showSnackbar("开始下载...")
  }

  return html`
    <div class="download-speed-limits-wrapper">
      <section class="download-speed-limits-widget">
        <div class="download-speed-limits-title">下载限速数据</div>
        <p class="download-speed-limits-text">
          下载由“Speed Limit Filler”收集的限速数据。
        </p>
        <div class="download-speed-limits-button-wrapper">
          <button class="download-speed-limits-button" @click="${handleDownload}">下载</button>
          <a class="download-speed-limits-link" href="https://SpeedLimitFiller.frogpilot.download" target="_blank">
            在这里提交限速数据
          </a>
        </div>
      </section>
    </div>
  `
}
