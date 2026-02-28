import { html, reactive } from "https://esm.sh/@arrow-js/core"
import { Modal } from "/assets/components/modal.js"

export function ToggleControl () {
  const state = reactive({
    showResetDefaultModal: false,
    showResetStockModal: false,
  });

  const fileInput = document.createElement("input")
  fileInput.type = "file"
  fileInput.accept = ".json"
  fileInput.style.display = "none"
  fileInput.addEventListener("change", restoreToggles)
  document.body.appendChild(fileInput)

  async function backupToggles () {
    const response = await fetch("/api/toggles/backup", { method: "POST" })
    const blob = await response.blob()

    const downloadUrl = URL.createObjectURL(blob)
    const downloadLink = document.createElement("a")
    downloadLink.href = downloadUrl
    downloadLink.download = "toggle-backup.json"
    downloadLink.click()
    URL.revokeObjectURL(downloadUrl)
  }

  async function restoreToggles (event) {
    const uploadedFile = event.target.files[0]
    if (uploadedFile) {
      const fileContents = await uploadedFile.text()
      const toggleData = JSON.parse(fileContents)

      const response = await fetch("/api/toggles/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toggleData)
      })

      const result = await response.json()
      showSnackbar(result.message || "开关已恢复！")

      event.target.value = ""
    }
  }

  function confirmResetDefault () {
    state.showResetDefaultModal = true;
  }

  async function resetTogglesToDefault () {
    state.showResetDefaultModal = false;
    showSnackbar("正在重置为默认开关...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    showSnackbar("正在重启...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    await fetch("/api/toggles/reset_default", { method: "POST" });
  }

  function confirmResetStock () {
    state.showResetStockModal = true;
  }

  async function resetTogglesToStock () {
    state.showResetStockModal = false;
    showSnackbar("正在重置为 openpilot 原厂开关...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    showSnackbar("正在重启...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    await fetch("/api/toggles/reset_stock", { method: "POST" });
  }

  function triggerRestorePrompt () {
    fileInput.click()
  }

  return html`
    <div class="toggle-control-wrapper">
      <section class="toggle-control-widget">
        <div class="toggle-control-title">开关备份/恢复</div>
        <p class="toggle-control-text">
          使用下方按钮备份或恢复开关配置。
        </p>
        <button class="toggle-control-button" @click="${backupToggles}">备份开关</button>
        <button class="toggle-control-button" @click="${triggerRestorePrompt}">恢复开关</button>
      </section>

      <section class="toggle-control-widget" style="margin-left: 1.5rem">
        <div class="toggle-control-title">重置开关（FrogPilot 默认 / openpilot 原厂）</div>
        <p class="toggle-control-text">
          将全部开关重置为 FrogPilot 默认或 openpilot 原厂设置。
        </p>
        <button class="toggle-control-button" @click="${confirmResetDefault}">
          重置为默认
        </button>
        <button class="toggle-control-button" @click="${confirmResetStock}">
          重置为原厂
        </button>
      </section>
    </div>
    ${() => state.showResetDefaultModal ? Modal({
        title: "重置开关",
        message: "确定要将全部开关重置为 FrogPilot 默认值吗？",
        onConfirm: resetTogglesToDefault,
        onCancel: () => { state.showResetDefaultModal = false; },
        confirmText: "重置为默认"
      }) : ""}
    ${() => state.showResetStockModal ? Modal({
        title: "重置开关",
        message: "确定要将全部开关重置为 openpilot 原厂值吗？",
        onConfirm: resetTogglesToStock,
        onCancel: () => { state.showResetStockModal = false; },
        confirmText: "重置为原厂"
      }) : ""}
  `
}
