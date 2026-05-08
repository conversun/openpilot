import { html, reactive } from "https://esm.sh/@arrow-js/core"
import { Modal } from "/assets/components/modal.js";

export function NavKeys() {
  const state = reactive({
    visible: false,
    error: "",
    lastGroup: "",
    message: "",

    amap1Key: "", amap2Key: "", amapWebKey: "",
    mapboxPublic: "", mapboxSecret: "",
    editA1: false, editA2: false, editAWeb: false,
    editPub: false, editSec: false,
    savedA1: false, savedA2: false, savedAWeb: false,
    savedPub: false, savedSec: false,

    useAMapRouting: false,
    amapRouteStrategy: 32,
    mapProvider: "amap",

    showDeleteModal: false,
    keyToDelete: null,

    showRevealModal: false,
    keyToReveal: null,
    revealCopied: false,
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
    amap_web: { prop: "amapWebKey",   saved: "savedAWeb", edit: "editAWeb", prefix: "",    body: "amap_web", minLength: 32 },
    public:   { prop: "mapboxPublic", saved: "savedPub",  edit: "editPub",  prefix: "pk.", body: "public",   minLength: 80 },
    secret:   { prop: "mapboxSecret", saved: "savedSec",  edit: "editSec",  prefix: "sk.", body: "secret",   minLength: 80 },
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
      case "public":   return "Mapbox Public Key"
      case "secret":   return "Mapbox Secret Key"
      default: return kind
    }
  }

  const labelMap = {
    amap1:    "JS Key",
    amap2:    "JS Secret",
    amap_web: "Web Key",
    public:   "Public Key",
    secret:   "Secret Key",
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
        state.mapboxPublic = data.mapboxPublic ?? ""
        state.mapboxSecret = data.mapboxSecret ?? ""
        state.savedA1 = !!state.amap1Key
        state.savedA2 = !!state.amap2Key
        state.savedAWeb = !!state.amapWebKey
        state.savedPub = !!state.mapboxPublic
        state.savedSec = !!state.mapboxSecret
      } else {
        showMessage("error", "密钥加载失败...", "")
      }

      const { ok: okParams, data: dataParams } = await util.req(api.path.params + "?keys=UseAMapRouting,AMapRouteStrategy,MapProvider")
      if (okParams) {
        state.useAMapRouting = dataParams.UseAMapRouting === "1"
        state.amapRouteStrategy = parseInt(dataParams.AMapRouteStrategy) || 32
        state.mapProvider = dataParams.MapProvider === "mapbox" ? "mapbox" : "amap"
        try { localStorage.setItem("MapProvider", state.mapProvider) } catch (_) {}
      }
    },

    saveParams: async () => {
      const { ok } = await util.req(api.path.params, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          UseAMapRouting: state.useAMapRouting ? "1" : "0",
          AMapRouteStrategy: state.amapRouteStrategy.toString(),
          MapProvider: state.mapProvider
        })
      })
      if (!ok) {
        showMessage("error", "设置保存失败...", "options")
      } else {
        showMessage("message", "设置保存成功！", "options")
      }
    },

    save: (kind) => async () => {
      const group = kind === "public" || kind === "secret" ? "mapbox" : "amap"
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

    revealKey: (kind) => {
      state.keyToReveal = kind;
      state.revealCopied = false;
      state.showRevealModal = true;
    },

    copyRevealedKey: async () => {
      const kind = state.keyToReveal;
      if (!kind) return;
      const value = state[meta[kind].prop];
      try {
        await navigator.clipboard.writeText(value);
        state.revealCopied = true;
        setTimeout(() => { state.revealCopied = false; }, 1500);
      } catch (err) {
        showMessage("error", "复制失败，请手动选择复制", "");
      }
    },

    delete: async () => {
      const kind = state.keyToDelete;
      if (!kind) return;

      const group = kind === "public" || kind === "secret" ? "mapbox" : "amap"
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
                ${() => state[keyMeta.saved] ? html`<i class="bi bi-trash"></i>` : html`<i class="bi bi-floppy-fill"></i>`}
              </button>
              ${() => state[keyMeta.saved] ? html`
                <button class="navkeys-btn navkeys-btn-icon"
                  title="查看完整密钥"
                  @click="${() => api.revealKey(kind)}">
                  <i class="bi bi-eye"></i>
                </button>
              ` : ""}
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
        ${renderGroup("Mapbox 密钥", ["public", "secret"])}
        ${renderStatus("mapbox")}
      </div>
      <div class="navkeys-container">
        <div class="navkeys-group">
          <div class="navkeys-title">地图显示</div>
          <div class="strategy-section">
            <label class="navkeys-label">页面地图提供商</label>
            <div class="strategy-list">
              ${[
                ["amap",   "高德",     "中国大陆推荐"],
                ["mapbox", "Mapbox", "HK / 非 GFW 网络"],
              ].map(([code, label, hint]) => html`
                <button type="button"
                        class="${() => `strategy-option ${state.mapProvider === code ? "selected" : ""}`}"
                        @click="${() => {
                          if (state.mapProvider === code) return;
                          state.mapProvider = code;
                          try { localStorage.setItem("MapProvider", code) } catch (_) {}
                          api.saveParams();
                        }}">
                  <span class="strategy-code">${code === "amap" ? "高德" : "MB"}</span>
                  <span class="strategy-label">${label}${hint ? html`<span class="strategy-hint">${hint}</span>` : ""}</span>
                  ${() => state.mapProvider === code ? html`<i class="bi bi-check-lg strategy-check"></i>` : ""}
                </button>
              `)}
            </div>
          </div>
          <div class="navkeys-hint" style="margin-top:8px;font-size:0.85em;opacity:0.7;">
            切换后访问「设置目的地」页面生效。Mapbox 需要 Public Key 且不能被 GFW 拦截。
          </div>
        </div>
      </div>
      <div class="navkeys-container">
        <div class="navkeys-group">
          <div class="navkeys-title">路线偏好</div>
          <div class="strategy-toggle-row">
            <label class="navkeys-label strategy-toggle-label">使用高德路径规划</label>
            <button type="button"
                    role="switch"
                    class="${() => `toggle-switch ${state.useAMapRouting ? "on" : "off"}`}"
                    aria-checked="${() => state.useAMapRouting ? "true" : "false"}"
                    @click="${() => { state.useAMapRouting = !state.useAMapRouting; api.saveParams(); }}">
              <span class="toggle-thumb"></span>
            </button>
          </div>
          <div class="strategy-section">
            <label class="navkeys-label">策略选择</label>
            <div class="strategy-list">
              ${[
                [32, "默认", "推荐"],
                [33, "躲避拥堵", ""],
                [34, "高速优先", ""],
                [35, "不走高速", ""],
                [38, "速度最快", ""],
                [45, "躲避拥堵 + 速度最快", ""],
              ].map(([code, label, hint]) => html`
                <button type="button"
                        class="${() => `strategy-option ${state.amapRouteStrategy === code ? "selected" : ""}`}"
                        @click="${() => { state.amapRouteStrategy = code; api.saveParams(); }}">
                  <span class="strategy-code">${code}</span>
                  <span class="strategy-label">${label}${hint ? html`<span class="strategy-hint">${hint}</span>` : ""}</span>
                  ${() => state.amapRouteStrategy === code ? html`<i class="bi bi-check-lg strategy-check"></i>` : ""}
                </button>
              `)}
            </div>
        </div>
        ${renderStatus("options")}
    </div>
    ${() => state.showDeleteModal ? Modal({
      title: "确认删除",
      message: `确定要删除 <strong>${getDeleteLabel(state.keyToDelete)}</strong> 吗？`,
      onConfirm: api.delete,
      onCancel: () => { state.showDeleteModal = false },
      confirmText: "确认删除"
    }) : ""}
    ${() => state.showRevealModal ? Modal({
      title: getDeleteLabel(state.keyToReveal),
      message: html`
        <div class="key-reveal">
          <div class="key-value">${state.keyToReveal ? state[meta[state.keyToReveal].prop] : ""}</div>
          <div class="key-reveal-actions">
            <button class="${() => `copy-button ${state.revealCopied ? "copied" : ""}`}"
              @click="${(e) => api.copyRevealedKey(e)}">
              ${() => state.revealCopied
                ? html`<i class="bi bi-check-lg"></i> 已复制`
                : html`<i class="bi bi-clipboard"></i> 复制到剪贴板`
              }
            </button>
          </div>
        </div>
      `,
      onCancel: () => { state.showRevealModal = false; state.keyToReveal = null; },
      cancelText: "关闭",
      confirmText: null,
    }) : ""}
  `
}
