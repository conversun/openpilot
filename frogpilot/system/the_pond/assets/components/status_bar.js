import { html, reactive } from "https://esm.sh/@arrow-js/core";

/**
 * Persistent top-of-content status strip. Polls /api/health every 30s and
 * surfaces:
 *   - whether AMap is the active routing source + which strategy is set
 *   - whether AMap REST is actually reachable + latency
 *   - whether Mapbox is reachable (key set + reachable + latency)
 *   - whether SLC's Mapbox filler is enabled (warn if so, since it's
 *     low-quality in CN regardless of network)
 *
 * Each badge is colored: ok (green) / warn (amber) / err (red) / dim (muted).
 * Hover/title carries the long-form explanation so the bar stays compact.
 */
export function StatusBar() {
  const state = reactive({
    loading: true,
    health: null,
    error: null,
  });

  async function refresh() {
    try {
      const r = await fetch("/api/health");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      state.health = await r.json();
      state.error = null;
    } catch (e) {
      state.error = e.message || String(e);
    } finally {
      state.loading = false;
    }
  }

  refresh();
  setInterval(refresh, 30_000);

  function badge(level, label, detail) {
    const icon =
      level === "ok"   ? "bi-check-circle-fill"     :
      level === "warn" ? "bi-exclamation-triangle-fill" :
      level === "err"  ? "bi-x-circle-fill"         :
      level === "dim"  ? "bi-circle"                :
                         "bi-hourglass-split";
    return html`
      <span class="${`status-badge status-${level}`}" title="${detail || ""}">
        <i class="${`bi ${icon}`}"></i>
        <span class="status-label">${label}</span>
      </span>
    `;
  }

  return html`
    <div class="status-bar">
      ${() => {
        if (state.loading) {
          return badge("loading", "检测中…", "正在拉取 /api/health");
        }
        if (state.error) {
          return badge("err", "状态拉取失败", state.error);
        }
        const h = state.health;
        const a = h.amap;
        const m = h.mapbox;
        const out = [];

        // 1. AMap routing on/off
        if (a.routing_enabled) {
          out.push(badge("ok", `AMap 路由 ${a.strategy}`, `UseAMapRouting=1, AMapRouteStrategy=${a.strategy}`));
        } else {
          out.push(badge("warn", "AMap 路由 关", "UseAMapRouting=0 — navd 会回落到 Mapbox 路由（在 CN 不通）"));
        }

        // 2. AMap REST health
        if (!a.key_set) {
          out.push(badge("err", "AMap key 缺", "AMapWebKey 未设置"));
        } else if (a.rest_ok) {
          out.push(badge("ok", `AMap REST ${a.latency_ms}ms`, `restapi.amap.com 可达`));
        } else {
          out.push(badge("err", "AMap REST 错", a.error || "未知错误"));
        }

        // 3. Mapbox reachability
        if (!m.key_set) {
          out.push(badge("warn", "Mapbox key 缺", "MapboxSecretKey 未设置 — Qt 全屏地图 / mapsd / SLC 都需要"));
        } else if (m.reachable) {
          const slow = m.latency_ms != null && m.latency_ms > 1000;
          out.push(badge(
            slow ? "warn" : "ok",
            `Mapbox ${m.latency_ms}ms`,
            m.error ? `${m.error} (但能连通)` : "api.mapbox.com 可达"
          ));
        } else {
          out.push(badge("err", "Mapbox 不通", m.error || "代理或网络问题"));
        }

        // 4. SLC Mapbox filler — should be off in CN
        if (h.slc_filler) {
          out.push(badge("warn", "SLC Mapbox 开", "SLCMapboxFiller=1 — 在 CN 数据质量差，建议关掉"));
        } else {
          out.push(badge("dim", "SLC Mapbox 关", "SLCMapboxFiller=0"));
        }

        // 5. The Pond 页面地图提供商 (frontend-only setting; navd routing is independent).
        // Source of truth is the backend param, surfaced via /api/health.map_provider —
        // localStorage is just a render hint and can be stale on a fresh browser cache.
        const mp = h.map_provider === "mapbox" ? "mapbox" : "amap";
        if (mp === "mapbox") {
          out.push(badge("ok", "页面地图 Mapbox", "MapProvider=mapbox — Web UI 使用 Mapbox GL JS 渲染"));
        } else {
          out.push(badge("dim", "页面地图 高德", "MapProvider=amap — Web UI 使用 高德 JS API 渲染"));
        }

        return out;
      }}
    </div>
  `;
}
