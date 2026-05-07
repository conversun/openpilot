import { html, reactive } from "https://esm.sh/@arrow-js/core"
import { Modal } from "/assets/components/modal.js";

export function NavKeys() {
  const state = reactive({
    visible: false,
    error: "",
    lastGroup: "",
    message: "",

    amap1Key: "", amap2Key: "", amapWebKey: "",
    editA1: false, editA2: false, editAWeb: false,
    savedA1: false, savedA2: false, savedAWeb: false,

    useAMapRouting: false,
    amapRouteStrategy: 32,

    showDeleteModal: false,
    keyToDelete: null,
  })

  let clearTimer = null
  let fadeTimer = null

  function showMessage(type, text, group) {
    clearTimer && clearTimeout(clearTimer)
    fadeTimer && clearTimeout(fadeTimer)

    state.error = type === "error" ? text : ""
    state.message = type === "message" ? text : ""
    state.lastGroup = group
    state.visible = true

    clearTimer = setTimeout(() => { state.message = "", state.error = "" }, 5000)
    fadeTimer = setTimeout(() => state.visible = false, 5000)
  }

  const util = {
    prefix: (key, prefix) => key.startsWith(prefix) ? key : prefix ? prefix + key : key,
    req: async (url, opts) => {
      const response = await fetch(url, opts)
      return { ok: response.ok, data: await response.json().catch(() => ({})) }
    }
  }

  const meta = {
    amap1:    { prop: "amap1Key",   saved: "savedA1",     edit: "editA1",     prefix: "",    body: "amap1",    minLength: 32 },
    amap2:    { prop: "amap2Key",   saved: "savedA2",     edit: "editA2",     prefix: "",    body: "amap2",    minLength: 32 },
    amap_web: { prop: "amapWebKey", saved: "savedAWeb",   edit: "editAWeb",   prefix: "",    body: "amap_web", minLength: 32 },
  }

  const canSave = (kind) => {
    const keyMeta = meta[kind];
    if (!keyMeta) return false;

    const value = state[keyMeta.prop]?.trim() || "";
    if (!value) return false;

    if (!state[keyMeta.saved]) {
      const fullValue = util.prefix(value, keyMeta.prefix);
      return fullValue.length >= keyMeta.minLength;
    }
    return false;
  }

  const getDeleteLabel = (kind) => {
    switch (kind) {
      case "amap1":    return "高德 JS Key"
      case "amap2":    return "高德 JS Secret"
      case "amap_web": return "高德 Web Key"
      default: return kind
    }
  }

  const labelMap = {
    amap1:    "JS Key",
    amap2:    "JS Secret",
    amap_web: "Web Key",
  }

  const api = {
    path: {
      key: "/api/navigation_key",
      nav: "/api/navigation",
      params: "/api/params"
    },

    load: async () => {
      const { ok, data } = await util.req(api.path.nav)
      if (ok) {
        state.amap1Key = data.amap1Key ?? ""
        state.amap2Key = data.amap2Key ?? ""
        state.amapWebKey = data.amapWebKey ?? ""
        state.savedA1 = !!state.amap1Key
        state.savedA2 = !!state.amap2Key
        state.savedAWeb = !!state.amapWebKey
      } else {
        showMessage("error", "密钥加载失败...", "")
      }

      const { ok: okParams, data: dataParams } = await util.req(api.path.params + "?keys=UseAMapRouting,AMapRouteStrategy")
      if (okParams) {
        state.useAMapRouting = dataParams.UseAMapRouting === "1"
        state.amapRouteStrategy = parseInt(dataParams.AMapRouteStrategy) || 32
      }
    },

    saveParams: async () => {
      const { ok } = await util.req(api.path.params, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          UseAMapRouting: state.useAMapRouting ? "1" : "0",
          AMapRouteStrategy: state.amapRouteStrategy.toString()
        })
      })
      if (!ok) {
        showMessage("error", "设置保存失败...", "options")
      } else {
        showMessage("message", "设置保存成功！", "options")
      }
    },

    save: (kind) => async () => {
      const group = "amap"
      const keyMeta = meta[kind]
      const value = util.prefix(state[keyMeta.prop].trim(), keyMeta.prefix)

      const { ok, data } = await util.req(api.path.key, {
        body: JSON.stringify({ [keyMeta.body]: value }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })

      if (!ok) {
        const input = document.getElementById(`${kind}-key`)
        if (input) {
          input.value = ""
          state[keyMeta.edit] = true
          state[keyMeta.saved] = false
          state[keyMeta.prop] = ""
          input.focus()
        }
        return showMessage("error", data.error || "保存失败...", group)
      }

      Object.assign(state, {
        [keyMeta.edit]: false,
        [keyMeta.saved]: true,
        [keyMeta.prop]: value
      })

      const input = document.getElementById(`${kind}-key`)
      if (input) {
        input.blur()
        input.value = ""
        requestAnimationFrame(() => { input.value = state[keyMeta.prop] })
      }

      showMessage("message", data.message || "保存成功！", group)
    },

    confirmDelete: (kind) => {
      state.keyToDelete = kind;
      state.showDeleteModal = true;
    },

    delete: async () => {
      const kind = state.keyToDelete;
      if (!kind) return;

      const group = "amap"
      const keyMeta = meta[kind]

      const { ok, data } = await util.req(`${api.path.key}?type=${kind}`, {
        method: "DELETE"
      })

      state.showDeleteModal = false;

      if (!ok) {
        return showMessage("error", data.error || "删除失败...", group)
      }

      Object.assign(state, {
        [keyMeta.saved]: false,
        [keyMeta.prop]: ""
      })

      showMessage("message", data.message || "删除成功！", group)
    }
  }

  queueMicrotask(api.load)

  function renderGroup(title, kinds) {
    return html`
      <div class="navkeys-group">
        <div class="navkeys-title">${title}</div>

        ${kinds.map(kind => {
          const keyMeta = meta[kind]
          const label = labelMap[kind] || kind[0].toUpperCase() + kind.slice(1).replace(/[0-9]/, d => " " + d)

          return html`
            <label class="navkeys-label" for="${`${kind}-key`}">${label}</label>
            <div class="navkeys-row">
              <input
                autocomplete="off"
                class="navkeys-input"
                id="${`${kind}-key`}"
                placeholder="${`${keyMeta.prefix || ""}xxxxxx...`}"
                value="${() => state[keyMeta.prop]}"
                @keydown="${(e) => {
                  if (state[keyMeta.saved] && !state[keyMeta.edit]) {
                    state[keyMeta.edit] = true
                    state[keyMeta.saved] = false
                    state[keyMeta.prop] = ""
                    e.target.value = ""
                  }
                }}"
                @input="${(e) => state[keyMeta.prop] = e.target.value}"
              />
              <button
                class="${() => `navkeys-btn ${state[keyMeta.saved] ? "delete" : ""}`}"
                @click="${() => state[keyMeta.saved] ? api.confirmDelete(kind) : api.save(kind)()}"
                disabled="${() => !state[keyMeta.saved] && !canSave(kind)}">
                ${() => state[keyMeta.saved] ? "🗑️" : "💾"}
              </button>
            </div>
          `
        })}
      </div>
    `
  }

  function renderStatus(group) {
    return html`
      <div class="navkeys-status">
        <div
          class="navkeys-message"
          style="${() => state.lastGroup === group && state.message ? `opacity: ${state.visible ? 1 : 0}` : "opacity: 0"}">
          ${() => state.message}
        </div>
        <div
          class="navkeys-error"
          style="${() => state.lastGroup === group && state.error ? `opacity: ${state.visible ? 1 : 0}` : "opacity: 0"}">
          ${() => state.error}
        </div>
      </div>
    `
  }

  return html`
    <div class="navkeys-wrapper navkeys-offset-top">
      <div class="navkeys-container">
        ${renderGroup("高德密钥", ["amap1", "amap2", "amap_web"])}
        ${renderStatus("amap")}
      </div>
      <div class="navkeys-container">
        <div class="navkeys-group">
          <div class="navkeys-title">路线偏好</div>
          <div style="margin-bottom: 15px; display: flex; align-items: center;">
            <label class="navkeys-label" style="margin: 0; flex: 1;">使用高德路径规划</label>
            <input type="checkbox" style="width: 24px; height: 24px;" checked="${() => state.useAMapRouting}" @change="${(e) => {
              state.useAMapRouting = e.target.checked;
              api.saveParams();
            }}" />
          </div>
          <div style="margin-bottom: 15px;">
            <label class="navkeys-label">策略选择</label>
            <select style="width: 100%; padding: 10px; border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color);" value="${() => state.amapRouteStrategy}" @change="${(e) => {
              state.amapRouteStrategy = parseInt(e.target.value);
              api.saveParams();
            }}">
              <option value="32" selected="${() => state.amapRouteStrategy === 32}">32 - 默认 (推荐)</option>
              <option value="33" selected="${() => state.amapRouteStrategy === 33}">33 - 躲避拥堵</option>
              <option value="34" selected="${() => state.amapRouteStrategy === 34}">34 - 高速优先</option>
              <option value="35" selected="${() => state.amapRouteStrategy === 35}">35 - 不走高速</option>
              <option value="38" selected="${() => state.amapRouteStrategy === 38}">38 - 速度最快</option>
              <option value="45" selected="${() => state.amapRouteStrategy === 45}">45 - 躲避拥堵 + 速度最快</option>
            </select>
          </div>
        </div>
        ${renderStatus("options")}
      </div>
    </div>
    ${() => state.showDeleteModal ? Modal({
      title: "确认删除",
      message: `确定要删除 <strong>${getDeleteLabel(state.keyToDelete)}</strong> 吗？`,
      onConfirm: api.delete,
      onCancel: () => { state.showDeleteModal = false },
      confirmText: "确认删除"
    }) : ""}
  `
}
