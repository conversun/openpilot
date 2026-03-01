
## Task 2: Mapbox GL JS Local Bundling (2026-03-01)

### CSS url() findings
mapbox-gl.css v3.18.1 contains ONLY `url("data:image/svg+xml;...")` inline data URIs.
NO external server references in the CSS. Fully self-contained after download.

### File sizes (v3.18.1)
- mapbox-gl.js: 1,674,923 bytes (~1.6MB)
- mapbox-gl.css: 38,662 bytes (~38KB)
- mapbox-gl-csp-worker.js: 728,323 bytes (~728KB)

### Pattern: workerUrl must be set BEFORE accessToken
mapboxgl.workerUrl = "..."; // line 641
mapboxgl.accessToken = ...; // line 642
This order is required for the worker to load from local path.

### Flask static serving
assets/vendor/ files are auto-served at /assets/vendor/ because Flask is configured
with static_folder="assets", static_url_path="/assets". No backend changes needed.
