// Provider router for the /set_navigation_destination page.
//
// The active provider is decided server-side: index.html is rendered with the
// MapProvider param baked into <meta name="map-provider">, and only that
// provider's vendor scripts (mapbox-gl.js OR webapi.amap.com loader) are emitted.
// This file just dispatches to the matching JS module — no async, no fetch,
// no localStorage. Switching providers requires a reload (handled by the
// MapProvider toggle in navigation_keys.js).
import { NavDestination as NavDestinationAmap } from "./navigation_destination_amap.js";
import { NavDestination as NavDestinationMapbox } from "./navigation_destination_mapbox.js";

const VALID_PROVIDERS = new Set(["amap", "mapbox"]);

function resolveProvider() {
  const meta = (typeof document !== "undefined" &&
                document.querySelector('meta[name="map-provider"]')?.content) || "";
  return VALID_PROVIDERS.has(meta) ? meta : "amap";
}

export function NavDestination(opts) {
  return resolveProvider() === "mapbox"
    ? NavDestinationMapbox(opts)
    : NavDestinationAmap(opts);
}
