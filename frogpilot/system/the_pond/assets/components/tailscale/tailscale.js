import { html, reactive } from "https://esm.sh/@arrow-js/core"
import { Modal } from "/assets/components/modal.js";

export function TailscaleControl() {
  const state = reactive({
    status: "idle",
    installed: false,
    showUninstallModal: false,
  });

  async function checkInstallStatus() {
    try {
      const response = await fetch("/api/tailscale/installed")
      const result = await response.json()
      state.installed = result.installed
    } catch (error) {
      console.error("Failed to check Tailscale install status:", error)
    }
  }

  function confirmUninstall() {
    state.showUninstallModal = true;
  }

  async function handleAction() {
    if (state.status !== "idle") {
      return
    }

    state.status = state.installed ? "uninstalling" : "installing"

    state.showUninstallModal = false;

    showSnackbar(`${state.installed ? "卸载" : "安装"}已开始...`)

    const endpoint = state.installed ? "/api/tailscale/uninstall" : "/api/tailscale/setup"
    const response = await fetch(endpoint, { method: "POST" })
    const result = await response.json()

    showSnackbar(result.message || `${state.installed ? "卸载" : "安装"}已触发...`)

    if (result.auth_url) {
      window.location.href = result.auth_url;
    }

    // Refresh install status after action
    await checkInstallStatus();
    state.status = "idle"
  }

  checkInstallStatus()

  return html`
    <div class="tailscale-wrapper">
      <section class="tailscale-widget">
        <div class="tailscale-title">
          ${() => state.installed ? '卸载 Tailscale' : '安装 Tailscale'}
        </div>
        <p class="tailscale-text">
          Tailscale 可在你的 openpilot 设备与手机/电脑之间建立安全私有连接，让你随时随地访问和控制设备。
        </p>
        <div class="tailscale-button-wrapper">
          <button
            class="tailscale-button"
            @click="${() => state.installed ? confirmUninstall() : handleAction()}"
            disabled="${() => state.status === 'installing' || state.status === 'uninstalling'}"
          >
            ${() => {
              if (state.status === 'installing') return 'Installing...'
              if (state.status === 'uninstalling') return 'Uninstalling...'
              if (state.installed) return 'Uninstall'
              return 'Install'
            }}
          </button>
          <a class="tailscale-link" href="https://tailscale.com/download" target="_blank">
            在其他设备上下载 Tailscale
          </a>
        </div>
      </section>
      ${() => state.showUninstallModal ? Modal({
          title: "确认卸载",
          message: "确定要卸载 Tailscale 吗？",
          onConfirm: handleAction,
          onCancel: () => { state.showUninstallModal = false; },
          confirmText: "卸载"
      }) : ""}
    </div>
  `
}
