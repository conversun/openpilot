import { html } from "https://esm.sh/@arrow-js/core"

export function DoorControl () {
  async function lockDoors () {
    const response = await fetch("/api/doors/lock", { method: "POST" })
    const result = await response.json()
    showSnackbar(result.message || "车门已上锁！")
  }

  async function unlockDoors () {
    const response = await fetch("/api/doors/unlock", { method: "POST" })
    const result = await response.json()
    showSnackbar(result.message || "车门已解锁！")
  }

  return html`
    <div class="door-control-wrapper">
      <section class="door-control-widget">
        <div class="door-control-title">车门锁控</div>
        <p class="door-control-text">
          可通过下方按钮远程锁车或解锁车门。
        </p>
        <button class="door-control-button" @click="${lockDoors}">🔒 上锁</button>
        <button class="door-control-button" @click="${unlockDoors}">🔓 解锁</button>
      </section>
    </div>
  `
}
