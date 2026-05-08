// Provider router for the /set_navigation_destination page.
//
// Reads the MapProvider param (set via The Pond's nav-keys panel) and dispatches
// to either the AMap-based or Mapbox-based implementation. Default is "amap"
// — preserves cn-mazda fork behaviour for users in mainland China. HK / non-GFW
// users can opt into "mapbox" to render on Mapbox GL JS.
//
// Both provider modules export a NavDestination(opts) → Arrow.js html template,
// matching the contract router.js expects from this file.
import { html, reactive } from "https://esm.sh/@arrow-js/core";
import { NavDestination as NavDestinationAmap } from "./navigation_destination_amap.js";
import { NavDestination as NavDestinationMapbox } from "./navigation_destination_mapbox.js";

const VALID_PROVIDERS = new Set(["amap", "mapbox"]);

export function NavDestination(opts) {
  // Optimistic read from localStorage to avoid a flash of "loading…" when the
  // user has already chosen a provider. We still validate against the backend
  // — localStorage is a hint, the param is the source of truth.
  const cached = (typeof localStorage !== "undefined" && localStorage.getItem("MapProvider")) || null;
  const initial = VALID_PROVIDERS.has(cached) ? cached : null;

  const state = reactive({ provider: initial, ready: initial !== null });

  fetch("/api/params?keys=MapProvider")
    .then((r) => (r.ok ? r.json() : {}))
    .then((data) => {
      const fromBackend = (data && data.MapProvider) || "";
      const next = VALID_PROVIDERS.has(fromBackend) ? fromBackend : "amap";
      state.provider = next;
      state.ready = true;
      try { localStorage.setItem("MapProvider", next); } catch (_) {}
    })
    .catch(() => {
      // Network/backend failure — fall back to the safe default.
      state.provider = state.provider || "amap";
      state.ready = true;
    });

  return html`${() => {
    if (!state.ready) {
      return html`<div class="navigation-loading">加载中…</div>`;
    }
    return state.provider === "mapbox"
      ? NavDestinationMapbox(opts)
      : NavDestinationAmap(opts);
  }}`;
}
