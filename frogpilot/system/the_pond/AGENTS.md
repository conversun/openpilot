# AGENTS.md — frogpilot/system/the_pond/

Web dashboard for FrogPilot. Flask backend + Arrow.js SPA frontend on port 8082.

## Architecture

```
the_pond/
├── the_pond.py          # Flask server — 30+ API endpoints
├── utilities.py         # Backend helpers: video processing, theme mgmt
├── templates/
│   └── index.html       # SPA shell — CDN links, component imports
└── assets/
    ├── vendor/          # Local copies: mapbox-gl.js/css
    ├── components/
    │   ├── router.js    # Arrow.js client-side routing (13 routes)
    │   ├── sidebar.js   # Navigation: home, nav, recordings, tailscale, tools
    │   ├── home/        # Dashboard stats, quick actions
    │   ├── navigation/  # Map UI (Mapbox GL JS), geocoding, routing
    │   ├── recordings/  # Dashcam routes, screen recordings
    │   ├── tailscale/   # VPN setup/management
    │   └── tools/       # Toggles, themes, doors, error logs, speed limits
    └── styles/          # CSS modules per component
```

## Tech Stack

- **Backend**: Flask (Python), serves static + REST API
- **Frontend**: Arrow.js (reactive), ES modules (no build step), @remix-run/router
- **Maps**: Mapbox GL JS v3 (vendor copy) + AMap JS API (China)
- **Icons**: Bootstrap Icons (CDN), Font Awesome (CDN)
- **No bundler** — raw ES module imports via `<script type="module">`

## API Endpoints (Key Groups)

| Group | Methods | Endpoints |
|-------|---------|-----------|
| Navigation | GET/POST/PUT/DELETE | `/navigation`, `/preserve_route`, `/favorite_locations` |
| API Keys | GET/POST | `/mapbox_key`, `/amap_key` |
| Routes | GET/DELETE | `/routes`, `/preserve_route` |
| Recordings | GET/DELETE | `/screen_recordings` |
| Themes | GET/POST | `/current_theme`, `/submit_theme` |
| Settings | GET/POST | `/params`, `/params_memory` |
| Device | GET/POST | `/doors`, `/tailscale_*`, `/error_logs` |
| Media | GET | `/footage/<path>`, `/assets/<path>` |

## Component Pattern

Each component is a JS file exporting an Arrow.js reactive template:

```javascript
import { reactive, html } from 'https://esm.sh/@arrow-js/core';
export function myComponent() {
  const state = reactive({ loading: true });
  // fetch from Flask API
  return html`<div>...</div>`;
}
```

## Integration Points

- **Params**: Reads/writes FrogPilot settings via `/params` and `/params_memory` endpoints
- **Cereal**: CAN bus messaging for door control (`pandad` → Panda hardware)
- **File system**: Route footage in `/data/media/`, error logs, screen recordings
- **External APIs**: Mapbox (geocoding, directions), Comma AI (stats), GitLab (themes)

## External Dependencies (GFW-Relevant)

| Resource | Domain | China Status |
|----------|--------|-------------|
| Arrow.js | esm.sh | ACCESSIBLE |
| Remix Router | esm.sh | ACCESSIBLE |
| Bootstrap Icons | cdn.jsdelivr.net | ACCESSIBLE |
| Font Awesome | cdnjs.cloudflare.com | SLOW |
| AMap JS API | webapi.amap.com | ACCESSIBLE (China native) |
| Mapbox GL JS | vendor/ (local) | N/A (bundled) |
| Mapbox APIs | api.mapbox.com | BLOCKED in China |

## Anti-Patterns

- **No build step** — don't add webpack/vite. Raw ES modules only
- **No npm** — dependencies loaded via CDN (esm.sh) or vendor/
- Params are read as bytes — always `.decode()` before use in JS responses
- File paths must handle both `/data/` (device) and local dev paths
