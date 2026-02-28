import { html, reactive } from "https://esm.sh/@arrow-js/core"
import { Modal } from "/assets/components/modal.js"

const state = reactive({
  keyName: "",
  selectedKeyName: "",
  keyValue: "",
  keys: [],
  saved: false,
  editMode: true,
  message: "",
  error: "",
  visible: false,
  confirmDelete: {
    visible: false,
    keyName: ""
  }
})

let clearTimer = null
let fadeTimer = null

function showMessage(type, text) {
  clearTimeout(clearTimer)
  clearTimeout(fadeTimer)

  state.error = type === "error" ? text : ""
  state.message = type === "message" ? text : ""
  state.visible = true

  clearTimer = setTimeout(() => {
    state.message = ""
    state.error = ""
  }, 5000)

  fadeTimer = setTimeout(() => {
    state.visible = false
  }, 5000)
}

function isDuplicateName() {
  return state.keys.some(k =>
    k.name === state.keyName &&
    k.name !== state.selectedKeyName
  )
}

function canSave() {
  const name = state.keyName
  const value = state.keyValue

  if (
    value.length < 10 ||
    /\s/.test(name) ||
    /\s/.test(value)
  ) {
    return false
  }

  if (isDuplicateName()) return false

  const selected = state.keys.find(k => k.name === state.selectedKeyName)
  if (!selected) return true

  const nameChanged = name !== selected.name
  const valueChanged = value !== selected.value

  return nameChanged || valueChanged
}

function selectKey(name) {
  const selected = state.keys.find(k => k.name === name)
  if (selected) {
    state.selectedKeyName = selected.name
    state.keyName = selected.name
    state.keyValue = selected.value
    state.saved = true
    state.editMode = false
  }
}

const util = {
  req: async (url, opts) => {
    const response = await fetch(url, opts)
    return {
      ok: response.ok,
      data: await response.json().catch(() => ({}))
    }
  }
}

const api = {
  path: "/api/tsk_keys",

  load: async () => {
    const { ok, data } = await util.req(api.path, { method: "GET" })
    if (ok) {
      state.keys = data
    } else {
      showMessage("error", "密钥加载失败...")
    }
  },

  save: async () => {
    const name = state.keyName.trim()
    const value = state.keyValue.trim()

    if (!canSave()) {
      showMessage("error", "输入无效或名称重复。")
      return
    }

    const updatedKeys = state.keys.filter(k => k.name !== state.selectedKeyName)
    updatedKeys.push({ name, value })

    const { ok, data } = await util.req(api.path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedKeys)
    })

    if (!ok) {
      showMessage("error", data.error || "保存失败...")
      return
    }

    state.keys = data
    selectKey(name)
    showMessage("message", "密钥已保存！")
  },

  delete: async (name) => {
    const url = `${api.path}?name=${encodeURIComponent(name)}`
    const { ok, data } = await util.req(url, { method: "DELETE" })

    state.confirmDelete.visible = false;

    if (!ok) {
      showMessage("error", "删除失败...")
      return
    }

    state.keys = data
    state.keyName = ""
    state.keyValue = ""
    state.selectedKeyName = ""
    showMessage("message", "密钥已删除！")
  },

  applyKey: async (name, value) => {
    const payload = { name, value }

    const { ok } = await util.req("/api/tsk_key_set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })

    if (!ok) {
      showMessage("error", "应用失败...")
      return
    }

    showMessage("message", "密钥已应用！")
  }
}

let hasLoaded = false
if (!hasLoaded) {
  hasLoaded = true
  api.load()
}

export function TSKManager() {
  return html`
    <div class="tskkeys-wrapper tskkeys-offset-top">
      <div class="tskkeys-container">
        <div class="tskkeys-title">丰田安全密钥管理</div>

        <label class="tskkeys-label" for="tsk-select-key">选择密钥</label>
        <div class="tskkeys-row">
          <select
            id="tsk-select-key"
            class="tskkeys-select"
            value="${() => state.selectedKeyName}"
            @change="${(e) => selectKey(e.target.value)}">
            <option value="">-- 选择已保存的密钥 --</option>
            ${() => (state.keys || []).map(k => html`
              <option value="${k.name}">${k.name}</option>
            `)}
          </select>
        </div>

        <label class="tskkeys-label" for="tsk-key-name">密钥名称</label>
        <div class="tskkeys-row">
          <input
            id="tsk-key-name"
            class="tskkeys-input"
            placeholder="输入密钥名称..."
            autocomplete="off"
            value="${() => state.keyName}"
            @input="${(e) => {
              state.keyName = e.target.value.replace(/^\s+/, "")
              state.saved = false
              state.editMode = true
            }}"
          />
        </div>

        ${() => isDuplicateName() ? html`
          <div class="tskkeys-error" style="opacity: 1; margin-top: -10px; margin-bottom: 10px;">
            已存在同名密钥。
          </div>
        ` : ""}

        <label class="tskkeys-label" for="tsk-key-value">密钥内容</label>
        <div class="tskkeys-row">
          <input
            id="tsk-key-value"
            class="tskkeys-input"
            placeholder="输入密钥内容..."
            autocomplete="off"
            value="${() => state.keyValue}"
            @input="${(e) => {
              state.keyValue = e.target.value.replace(/^\s+/, "")
              state.saved = false
              state.editMode = true
            }}"
          />
          <button
            class="${() => `tskkeys-btn ${state.saved ? "delete" : ""} ${!canSave() ? "disabled" : ""}`}"
            disabled="${() => !canSave()}"
            @click="${() => api.save()}">
            💾
          </button>
          <button
            class="${() => `tskkeys-btn delete ${!state.selectedKeyName ? "disabled" : ""}`}"
            disabled="${() => !state.selectedKeyName}"
            @click="${() => {
              state.confirmDelete.visible = true
              state.confirmDelete.keyName = state.selectedKeyName
            }}">
            🗑️
          </button>
        </div>

        <div class="tskkeys-status">
          <div
            class="tskkeys-message"
            style="${() => state.message ? `opacity: ${state.visible ? 1 : 0}` : "opacity: 0"}">
            ${() => state.message}
          </div>
          <div
            class="tskkeys-error"
            style="${() => state.error ? `opacity: ${state.visible ? 1 : 0}` : "opacity: 0"}">
            ${() => state.error}
          </div>
        </div>

        <div class="tskkeys-row tskkeys-apply-wrapper">
          <button
            class="${() => `tskkeys-btn apply ${!state.selectedKeyName ? "disabled" : ""}`}"
            disabled="${() => !state.selectedKeyName}"
            @click="${() => {
              const selected = state.keys.find(k => k.name === state.selectedKeyName)
              if (selected) {
                api.applyKey(selected.name, selected.value)
              } else {
                showMessage("error", "请先从列表中选择密钥")
              }
            }}">
            应用密钥
          </button>
        </div>
      </div>
    </div>

    ${() => state.confirmDelete.visible ? Modal({
        title: "确认删除",
        message: `确定要删除密钥 <strong>${state.confirmDelete.keyName}</strong> 吗？`,
        onConfirm: () => api.delete(state.confirmDelete.keyName),
        onCancel: () => { state.confirmDelete.visible = false; },
        confirmText: "确认删除"
    }) : ""}
  `
}
