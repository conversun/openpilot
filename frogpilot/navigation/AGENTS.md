# AGENTS.md — frogpilot/navigation/

FrogPilot navigation overlay. Two independent subsystems live here:

1. **AMap (高德) routing pipeline** — for users behind GFW. Replaces Mapbox driving directions with AMap v5.
2. **mapd offline maps** — preexisting OSM binary manager (unchanged).

## Key Files

| File | Purpose |
|------|---------|
| `amap_route_adapter.py` | AMap v5 driving REST → Mapbox-shaped response converter |
| `tests/test_amap_route_adapter.py` | 43 unit tests — GCJ-02 transform, polyline parse, action map, full conversion |
| `tests/test_amap_failure_scenarios.py` | 24 mocked tests — error statuses, network failures, query construction |
| `tests/test_amap_reroute_logic.py` | 15 logic tests — should_recompute math, GPS guards, backoff |
| `tests/test_amap_live_shenzhen.py` | 6 live tests — real SZ in-city route (gated by AMAP_WEB_KEY) |
| `tests/test_amap_live_crosscity.py` | 7 live tests — real SZ→GZ ~140km cross-city route |
| `tests/fixtures/amap_v3_beijing.json` | Real AMap v3 response capture |
| `tests/fixtures/amap_v5_beijing.json` | Real AMap v5 response capture |
| `mapd.py` | Offline map binary manager (offroad daemon) |
| `navigation_training/` | (legacy) Mapbox setup-guide PNGs — being phased out |

## AMap Routing Architecture

```
The Pond (web UI) writes NavDestination param
                ↓
selfdrive/navd/navd.py  (base openpilot daemon, 1 Hz loop)
   reads UseAMapRouting + AMapWebKey + AMapRouteStrategy
   if AMap mode: calls frogpilot.navigation.amap_route_adapter
   else:         falls back to Mapbox Directions API
                ↓
amap_route_adapter.fetch_amap_route(...)
   → https://restapi.amap.com/v5/direction/driving
                ↓
amap_route_adapter.convert_amap_to_mapbox(...)
   → reshapes to Mapbox v5 directions response shape
   → GCJ-02 → WGS-84 coordinate transform on every point
                ↓
navd consumes the Mapbox-shaped response uniformly:
   chosen_route['legs'][0]['steps']        → maneuver list
   chosen_route['legs'][0]['annotation']   → maxspeed (unknown for AMap)
   step['geometry']['coordinates']         → WGS-84 polyline
   step['bannerInstructions']              → turn-by-turn UI
                ↓
Publishes navRoute + navInstruction over cereal
```

## Reroute Behavior

navd's reroute loop is **provider-agnostic**:

- `should_recompute()` triggers on >25m off-route for >3 ticks
- On reroute, `calculate_route()` re-enters with `self.last_position` (current GPS)
- Same UseAMapRouting check applies → fresh AMap call from the new origin
- Exponential backoff (2^n ticks, max 64s) caps retry rate during failures

## GPS Tunnel Guard

navd skips reroute when:
- `gps_ok == False` (GPS lost — locationd flips this 2s after last fix), **OR**
- `position_std_norm > REROUTE_POS_STD_THRESHOLD` (30m, tighter than locationd's 50m)

`positionECEF.std` is the only published Kalman position-uncertainty signal (the `positionGeodetic.std` field is NaN). Norm of the [x,y,z] std vector serves as the scalar uncertainty proxy. Catches tunnel multipath before locationd downgrades status.

## Coordinate Systems (CRITICAL)

| Where | System | Notes |
|---|---|---|
| openpilot GPS (`LastGPSPosition`, `liveLocationKalman`) | WGS-84 | Raw GNSS |
| AMap REST API requests (origin, destination, polyline) | WGS-84 if `coordsys=gps` | We always pass `coordsys=gps`; AMap auto-converts |
| AMap REST API responses (polyline, location) | GCJ-02 | We always run `gcj02_to_wgs84()` on every coordinate before returning to navd |
| Mapbox-shaped response that we hand back to navd | WGS-84 | Same as Mapbox would emit |

**Never mix.** The single conversion point is `parse_amap_polyline()` and `_resolve_step_geometry()` inside `amap_route_adapter.py`.

## Configuration Params

All in `frogpilot/common/frogpilot_variables.py`:

| Param | Default | Effect |
|---|---|---|
| `UseAMapRouting` | `"0"` | Master toggle. `"1"` enables AMap mode in navd. |
| `AMapWebKey` | `""` | Required web service API key (REST) — distinct from JS API key. |
| `AMapRouteStrategy` | `"32"` | v5 strategy: 32=default, 33=avoid jam, 38=fastest, 45=avoid jam + fastest. |
| `AMapKey1` / `AMapKey2` | `""` | JS API key + security code (for the_pond frontend map rendering). |

## Adding a New AMap Action Mapping

When AMap returns a `navi.action` we don't handle, our `_ACTION_MAP` falls back to `("turn", "straight")` (Mapbox's safe default). To extend:

1. Run a real route through the live test and check the `[warn] unmapped` output
2. Look up the official AMap v5 action list at https://lbs.amap.com/api/webservice/guide/api/newroute
3. Add the entry to `_ACTION_MAP` in `amap_route_adapter.py` mapping to a Mapbox `(maneuverType, maneuverModifier)` pair
4. Add a parametrized test case to `TestActionToManeuver` in `test_amap_route_adapter.py`

## Anti-Patterns

- **Never call AMap REST directly from navd or the_pond** without going through `fetch_amap_route()` — the helper handles `coordsys=gps`, strategy, show_fields, and waypoint serialization uniformly.
- **Never strip `gcj02_to_wgs84` from polyline parsing** — coordinates would be ~500m off in mainland China.
- **Never widen `convert_amap_to_mapbox`'s `except` to swallow all exceptions** — `ValueError` carries actionable info (key invalid, QPS, etc.) that navd uses to decide between clearing the route vs preserving it.
- **Never hardcode the strategy** in `fetch_amap_route` calls — always read `AMapRouteStrategy` from params so users can override per-device.
