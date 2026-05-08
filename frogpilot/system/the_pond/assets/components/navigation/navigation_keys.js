import { html, reactive } from "https://esm.sh/@arrow-js/core"
import { Modal } from "/assets/components/modal.js";

export function NavKeys() {
  const state = reactive({
    amap1Key: "", amap2Key: "", amapWebKey: "",
    mapboxPublic: "", mapboxSecret: "",
    editA1: false, editA2: false, editAWeb: false,
    editPub: false, editSec: false,
    savedA1: false, savedA2: false, savedAWeb: false,
    savedPub: false, savedSec: false,

    useAMapRouting: false,
    amapRouteStrategy: 32,
    mapProvider: "amap",

    showBackup: false,

    showDeleteModal: false,
    keyToDelete: null,

    showRevealModal: false,
    keyToReveal: null,
    revealCopied: false,
  })

  // Global snackbar wrapper — defined in /assets/js/snackbar.js (loaded as classic
  // script in templates/index.html). We funnel ALL save/delete/error feedback here
  // so users get one consistent surface, not three inline status divs.
  function notify(text, level) {
    if (typeof window.showSnackbar === "function") {
      window.showSnackbar(text, level)
    }
  }

  const util = {
    prefix: (key, prefix) => key.startsWith(prefix) ? key : prefix ? prefix + key : key,
    req: async (url, opts) => {
      const response = await fetch(url, opts)
      return { ok: response.ok, data: await response.json().catch(() => ({})) }
    },
    // Mask saved keys for display: 8 dots + last 4 chars. Click input to edit
    // (existing focus handler clears + flips edit mode).
    mask: (val) => {
      if (!val) return ""
      const tail = val.length > 4 ? val.slice(-4) : val
      return "••••••••" + tail
    },
  }

  const meta = {
    amap1:    { prop: "amap1Key",     saved: "savedA1",   edit: "editA1",   prefix: "",    body: "amap1",    minLength: 32 },
    amap2:    { prop: "amap2Key",     saved: "savedA2",   edit: "editA2",   prefix: "",    body: "amap2",    minLength: 32 },
    amap_web: { prop: "amapWebKey",   saved: "savedAWeb", edit: "editAWeb", prefix: "",    body: "amap_web", minLength: 32 },
    public:   { prop: "mapboxPublic", saved: "savedPub",  edit: "editPub",  prefix: "pk.", body: "public",   minLength: 80 },
    secret:   { prop: "mapboxSecret", saved: "savedSec",  edit: "editSec",  prefix: "sk.", body: "secret",   minLength: 80 },
  }

  const labelMap = {
    amap1:    "JS Key",
    amap2:    "JS Secret",
    amap_web: "Web Key",
    public:   "Public Key",
    secret:   "Secret Key",
  }

  const fullLabelMap = {
    amap1:    "高德 JS Key",
    amap2:    "高德 JS Secret",
    amap_web: "高德 Web Key",
    public:   "Mapbox Public Key",
    secret:   "Mapbox Secret Key",
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
        notify("密钥加载失败...", "error")
      }

      const { ok: okParams, data: dataParams } = await util.req(api.path.params + "?keys=UseAMapRouting,AMapRouteStrategy,MapProvider")
      if (okParams) {
        state.useAMapRouting = dataParams.UseAMapRouting === "1"
        state.amapRouteStrategy = parseInt(dataParams.AMapRouteStrategy) || 32
        state.mapProvider = dataParams.MapProvider === "mapbox" ? "mapbox" : "amap"
      }
    },

    saveParams: async ({ silent = false } = {}) => {
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
        notify("设置保存失败...", "error")
      } else if (!silent) {
        notify("设置保存成功！")
      }
      return ok
    },

    save: (kind) => async () => {
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
        return notify(data.error || "保存失败...", "error")
      }

      Object.assign(state, {
        [keyMeta.edit]: false,
        [keyMeta.saved]: true,
        [keyMeta.prop]: value
      })

      const input = document.getElementById(`${kind}-key`)
      if (input) {
        input.blur()
      }

      notify(data.message || "保存成功！")
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
        notify("复制失败，请手动选择复制", "error");
      }
    },

    delete: async () => {
      const kind = state.keyToDelete;
      if (!kind) return;

      const keyMeta = meta[kind]

      const { ok, data } = await util.req(`${api.path.key}?type=${kind}`, {
        method: "DELETE"
      })

      state.showDeleteModal = false;

      if (!ok) {
        return notify(data.error || "删除失败...", "error")
      }

      Object.assign(state, {
        [keyMeta.saved]: false,
        [keyMeta.prop]: ""
      })

      notify(data.message || "删除成功！")
    },

    switchProvider: async (code) => {
      if (state.mapProvider === code) return
      // Optimistic UI; revert if backend POST fails.
      const previous = state.mapProvider
      state.mapProvider = code
      const ok = await api.saveParams({ silent: true })
      if (!ok) {
        state.mapProvider = previous
        return
      }
      // Reload so index.html re-renders with the new provider's vendor scripts.
      // Hot-swapping isn't supported — the unused module would reference an
      // absent global (mapboxgl or AMap).
      notify("已切换地图提供商，正在重新加载...")
      setTimeout(() => window.location.reload(), 400)
    },
  }

  queueMicrotask(api.load)

  // ─── Helpers ────────────────────────────────────────────────────────────
  const providerLabel = (code) => code === "mapbox" ? "Mapbox" : "高德地图"
  const providerKeys = (code) => code === "mapbox" ? ["public", "secret"] : ["amap1", "amap2", "amap_web"]
  const otherProvider = (code) => code === "mapbox" ? "amap" : "mapbox"

  function renderKeyRow(kind) {
    const keyMeta = meta[kind]
    const label = labelMap[kind] || kind

    return html`
      <div class="navkeys-key">
        <div class="navkeys-key-meta">
          <label class="navkeys-label" for="${`${kind}-key`}">${label}</label>
          ${() => state[keyMeta.saved] ? html`
            <span class="navkeys-saved-pill">
              <i class="bi bi-check-circle-fill"></i> 已配置
            </span>
          ` : ""}
        </div>
        <div class="navkeys-row">
          <input
            autocomplete="off"
            class="navkeys-input"
            id="${`${kind}-key`}"
            placeholder="${`${keyMeta.prefix || ""}xxxxxx...`}"
            value="${() => state[keyMeta.saved] && !state[keyMeta.edit]
              ? util.mask(state[keyMeta.prop])
              : state[keyMeta.prop]}"
            @focus="${(e) => {
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
            title="${() => state[keyMeta.saved] ? "删除密钥" : "保存密钥"}"
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
      </div>
    `
  }

  function renderProviderKeys(code, { backup = false } = {}) {
    return html`
      <div class="navkeys-keylist">
        ${providerKeys(code).map(renderKeyRow)}
      </div>
    `
  }

  // ─── Sections ───────────────────────────────────────────────────────────
  function renderProviderStep() {
    const options = [
      { code: "amap",   name: "高德地图", meta: "中国大陆推荐",     icon: "bi-geo-alt-fill" },
      { code: "mapbox", name: "Mapbox",   meta: "海外 / 非 GFW 网络", icon: "bi-globe2"        },
    ]
    return html`
      <section class="navkeys-section">
        <div class="navkeys-section-head">
          <span class="navkeys-step">1</span>
          <h2 class="navkeys-section-title">选择地图提供商</h2>
        </div>
        <div class="provider-segmented">
          ${options.map(opt => html`
            <button type="button"
                    class="${() => `provider-option ${state.mapProvider === opt.code ? "active" : ""}`}"
                    @click="${() => api.switchProvider(opt.code)}">
              <i class="${`bi ${opt.icon} provider-icon`}"></i>
              <span class="provider-text">
                <span class="provider-name">${opt.name}</span>
                <span class="provider-meta">${opt.meta}</span>
              </span>
              ${() => state.mapProvider === opt.code ? html`<i class="bi bi-check-circle-fill provider-check"></i>` : ""}
            </button>
          `)}
        </div>
        <p class="navkeys-callout">
          <i class="bi bi-info-circle"></i>
          <span>切换后访问「设置目的地」页面生效。Mapbox 需要 Public Key 且不能被 GFW 拦截。</span>
        </p>
      </section>
    `
  }

  function renderActiveKeysStep() {
    return html`
      <section class="navkeys-section">
        <div class="navkeys-section-head">
          <span class="navkeys-step">2</span>
          <h2 class="navkeys-section-title">${() => providerLabel(state.mapProvider)}密钥</h2>
          <span class="navkeys-active-pill">正在使用</span>
        </div>
        ${() => renderProviderKeys(state.mapProvider)}
      </section>
    `
  }

  function renderBackupKeys() {
    return html`
      <section class="${() => `navkeys-section navkeys-backup ${state.showBackup ? "open" : ""}`}">
        <button type="button"
                class="navkeys-backup-toggle"
                aria-expanded="${() => state.showBackup ? "true" : "false"}"
                @click="${() => state.showBackup = !state.showBackup}">
          <i class="${() => `bi bi-chevron-right navkeys-backup-chevron ${state.showBackup ? "open" : ""}`}"></i>
          <span class="navkeys-backup-title">${() => providerLabel(otherProvider(state.mapProvider))}密钥</span>
          <span class="navkeys-backup-hint">备用 · 默认折叠</span>
        </button>
        ${() => state.showBackup ? renderProviderKeys(otherProvider(state.mapProvider), { backup: true }) : ""}
      </section>
    `
  }

  function renderRouteStep() {
    const strategies = [
      [32, "默认",                "推荐"],
      [33, "躲避拥堵",            ""],
      [34, "高速优先",            ""],
      [35, "不走高速",            ""],
      [38, "速度最快",            ""],
      [45, "躲避拥堵 + 速度最快", ""],
    ]
    return html`
      <section class="navkeys-section">
        <div class="navkeys-section-head">
          <span class="navkeys-step">3</span>
          <h2 class="navkeys-section-title">路线偏好</h2>
        </div>
        <div class="strategy-toggle-row">
          <div class="strategy-toggle-text">
            <span class="navkeys-label">使用高德路径规划</span>
            <span class="navkeys-hint-inline">由高德 API 计算路线，否则使用 Mapbox / 默认</span>
          </div>
          <button type="button"
                  role="switch"
                  class="${() => `toggle-switch ${state.useAMapRouting ? "on" : "off"}`}"
                  aria-checked="${() => state.useAMapRouting ? "true" : "false"}"
                  @click="${() => { state.useAMapRouting = !state.useAMapRouting; api.saveParams(); }}">
            <span class="toggle-thumb"></span>
          </button>
        </div>
        <div class="${() => `strategy-section ${state.useAMapRouting ? "" : "is-disabled"}`}">
          <div class="navkeys-label strategy-section-label">策略选择</div>
          <div class="strategy-list">
            ${strategies.map(([code, label, hint]) => html`
              <button type="button"
                      class="${() => `strategy-option ${state.amapRouteStrategy === code ? "selected" : ""}`}"
                      disabled="${() => !state.useAMapRouting}"
                      @click="${() => { state.amapRouteStrategy = code; api.saveParams(); }}">
                <span class="strategy-label">
                  ${label}
                  ${hint ? html`<span class="strategy-hint">${hint}</span>` : ""}
                </span>
                <span class="strategy-code">#${code}</span>
                ${() => state.amapRouteStrategy === code ? html`<i class="bi bi-check-lg strategy-check"></i>` : ""}
              </button>
            `)}
          </div>
        </div>
      </section>
    `
  }

  // ─── Page shell ─────────────────────────────────────────────────────────
  return html`
    <div class="navkeys-page">
      <header class="navkeys-page-header">
        <h1 class="navkeys-page-title">导航与地图</h1>
        <p class="navkeys-page-desc">配置地图提供商及对应密钥，并调整高德路线策略。</p>
      </header>

      ${renderProviderStep()}
      ${renderActiveKeysStep()}
      ${renderBackupKeys()}
      ${renderRouteStep()}

      ${() => state.showDeleteModal ? Modal({
        title: "确认删除",
        message: `确定要删除 <strong>${fullLabelMap[state.keyToDelete] || state.keyToDelete}</strong> 吗？`,
        onConfirm: api.delete,
        onCancel: () => { state.showDeleteModal = false },
        confirmText: "确认删除"
      }) : ""}
      ${() => state.showRevealModal ? Modal({
        title: fullLabelMap[state.keyToReveal] || state.keyToReveal,
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
    </div>
  `
}
