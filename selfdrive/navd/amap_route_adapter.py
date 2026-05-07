"""
AMap (高德地图) v5 driving direction API adapter.

Converts AMap REST API v5 driving responses into Mapbox Directions API v5
compatible structures so navd can consume them transparently.

Why: Mapbox is blocked by GFW in mainland China and gives different routes
than AMap (which is what most Chinese drivers see on CarPlay). When the
driver follows AMap's route on CarPlay, openpilot needs the same route
to make consistent NoO / CENavigation decisions.

This adapter:
  1. Calls https://restapi.amap.com/v5/direction/driving
  2. Converts GCJ-02 (火星坐标) coordinates to WGS-84
  3. Maps Chinese action strings (左转/右转/...) to Mapbox maneuver types
  4. Reshapes the response into the structure navd's calculate_route() expects

Limitations vs Mapbox:
  - No per-coordinate maxspeed annotations (SLC falls back to OSM)
  - No traffic_signal/stop_sign locations (only path-level total count)
  - No lane guidance (sub.components in bannerInstructions)
  - No duration_typical (we fall back to duration)

Reference:
  - AMap v5 driving:  https://lbs.amap.com/api/webservice/guide/api/direction
  - Mapbox response:  https://docs.mapbox.com/api/navigation/directions/
"""
from __future__ import annotations

from typing import Any

import hashlib
import math

import requests



AMAP_V5_DRIVING_URL = "https://restapi.amap.com/v5/direction/driving"
AMAP_REQUEST_TIMEOUT = 10  # seconds

# GCJ-02 (火星坐标系 / Mars coordinate system) constants
GCJ02_A = 6378245.0           # WGS-84 semi-major axis (meters)
GCJ02_EE = 0.00669342162296594323  # eccentricity squared
GCJ02_PI = 3.1415926535897932384626 * 3000.0 / 180.0


# AMap navi.action / assistant_action → Mapbox (maneuverType, maneuverModifier).
#
# Mapbox maneuver types come from https://docs.mapbox.com/api/navigation/directions/#maneuver-types
# Mapbox modifiers come from https://docs.mapbox.com/api/navigation/directions/#maneuver-modifiers
#
# Coverage based on the official v5 'navi.action' (主要动作) list — see
# https://lbs.amap.com/api/webservice/guide/api/newroute. The doc enumerates ~14 primary
# actions; assistant_action is rendered as banner secondary text only and is NOT mapped here.
_ACTION_MAP: dict[str, tuple[str, str]] = {
  # Primary actions (主要动作)
  "无基本导航动作":   ("continue", "straight"),
  "左转":          ("turn", "left"),
  "右转":          ("turn", "right"),
  "直行":          ("turn", "straight"),
  "向左前方行驶":   ("turn", "slight left"),
  "向右前方行驶":   ("turn", "slight right"),
  "向左后方行驶":   ("turn", "sharp left"),
  "向右后方行驶":   ("turn", "sharp right"),
  "左转调头":      ("turn", "uturn"),
  "调头":          ("turn", "uturn"),
  "靠左":          ("fork", "left"),
  "靠右":          ("fork", "right"),
  "进入环岛":       ("roundabout", "straight"),
  "离开环岛":       ("exit roundabout", "straight"),
  "减速行驶":       ("notification", "straight"),

  # Common assistant_action arrival markers (used as fallback type)
  "到达目的地":     ("arrive", "straight"),
  "到达途经地":     ("arrive", "straight"),
}


def gcj02_to_wgs84(lng: float, lat: float) -> tuple[float, float]:
  """Convert GCJ-02 (火星坐标系) longitude/latitude to WGS-84.

  AMap returns coordinates in GCJ-02. openpilot's nav stack (and Mapbox-style
  geometry) expects WGS-84. The transform below is the standard published
  Krasovsky-1940 → WGS-84 reverse offset used by every Chinese map vendor.

  Outside mainland China the offset is zero, so we no-op there.
  """
  if _out_of_china(lng, lat):
    return lng, lat

  d_lat = _transform_lat(lng - 105.0, lat - 35.0)
  d_lng = _transform_lng(lng - 105.0, lat - 35.0)
  rad_lat = lat / 180.0 * math.pi
  magic = math.sin(rad_lat)
  magic = 1 - GCJ02_EE * magic * magic
  sqrt_magic = math.sqrt(magic)
  d_lat = (d_lat * 180.0) / ((GCJ02_A * (1 - GCJ02_EE)) / (magic * sqrt_magic) * math.pi)
  d_lng = (d_lng * 180.0) / (GCJ02_A / sqrt_magic * math.cos(rad_lat) * math.pi)
  return lng - d_lng, lat - d_lat


def _out_of_china(lng: float, lat: float) -> bool:
  return not (72.004 < lng < 137.8347 and 0.8293 < lat < 55.8271)


def _transform_lat(x: float, y: float) -> float:
  ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
  ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
  ret += (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
  ret += (160.0 * math.sin(y / 12.0 * math.pi) + 320 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
  return ret


def _transform_lng(x: float, y: float) -> float:
  ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
  ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
  ret += (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
  ret += (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
  return ret


def parse_amap_polyline(polyline: str) -> list[list[float]]:
  """Parse AMap polyline string ('lng,lat;lng,lat;...') into WGS-84 [lng, lat] pairs."""
  if not polyline:
    return []
  coords: list[list[float]] = []
  for point in polyline.split(";"):
    point = point.strip()
    if not point:
      continue
    try:
      lng_str, lat_str = point.split(",")
      lng_gcj, lat_gcj = float(lng_str), float(lat_str)
    except ValueError:
      continue
    lng, lat = gcj02_to_wgs84(lng_gcj, lat_gcj)
    coords.append([lng, lat])
  return coords

def action_to_maneuver(action: str | None) -> tuple[str, str]:
  """Map a Chinese AMap action string to (Mapbox maneuverType, maneuverModifier).

  Defaults to ('turn', 'straight') for unknown / empty actions, matching
  Mapbox's behavior for ambiguous segments.
  """
  if not action:
    return ("turn", "straight")
  return _ACTION_MAP.get(action.strip(), ("turn", "straight"))


def _resolve_step_geometry(step: dict[str, Any]) -> list[list[float]]:
  """Return WGS-84 [lng, lat] coords for an AMap step, supporting both v3 and v5 schemas.

  AMap v3 returns ``step.polyline`` directly as a single string ("lng,lat;lng,lat;...").
  AMap v5 splits the geometry across ``step.tmcs[].tmc_polyline`` (one segment per traffic
  state). Adjacent v5 tmc segments share their boundary coordinate; we deduplicate it so
  navd's ``distance_along_geometry()`` doesn't see zero-length sub-segments.
  """
  # v3 style: polyline string at the step's top level
  direct_polyline = step.get("polyline")
  if isinstance(direct_polyline, str) and direct_polyline:
    return parse_amap_polyline(direct_polyline)

  # v5 style: stitch ``tmcs[].tmc_polyline`` segments together
  coords: list[list[float]] = []
  for tmc in step.get("tmcs") or []:
    tmc_pl = tmc.get("tmc_polyline") or tmc.get("polyline")  # v5 uses tmc_polyline; v3 uses polyline inside tmcs
    if not isinstance(tmc_pl, str) or not tmc_pl:
      continue
    piece = parse_amap_polyline(tmc_pl)
    if not piece:
      continue
    if coords and coords[-1] == piece[0]:
      coords.extend(piece[1:])  # dedupe shared boundary coord
    else:
      coords.extend(piece)
  return coords


def _build_banner_instructions(step: dict[str, Any], step_distance_m: float) -> list[dict[str, Any]]:
  """Build a Mapbox-compatible bannerInstructions list from a single AMap step.

  Mapbox provides multiple banners per step at different `distanceAlongGeometry`
  thresholds; AMap only gives one instruction per step, so we emit a single
  banner triggered at the step's full distance (matches Mapbox's behavior of
  showing the full banner from segment start).
  """
  # v5 puts navi/action and assistant_action under step.navi.{...}; v3 puts them at step root.
  raw_navi = step.get("navi")
  navi: dict[str, Any] = raw_navi if isinstance(raw_navi, dict) else {}
  primary_action = navi.get("action") or step.get("action") or ""
  secondary_action = navi.get("assistant_action") or step.get("assistant_action") or ""
  # v3 returns ``[]`` for empty assistant_action — coerce to empty string
  if not isinstance(secondary_action, str):
    secondary_action = ""
  instruction = step.get("instruction") or ""

  maneuver_type, modifier = action_to_maneuver(primary_action)

  banner = {
    "distanceAlongGeometry": step_distance_m,
    "primary": {
      "text": instruction,
      "type": maneuver_type,
      "modifier": modifier,
    },
  }

  if secondary_action:
    banner["secondary"] = {"text": secondary_action}

  return [banner]


def _safe_float(value, default: float = 0.0) -> float:
  try:
    return float(value)
  except (TypeError, ValueError):
    return default


def convert_amap_to_mapbox(amap_response: dict[str, Any], place_name: str | None = None) -> dict[str, Any]:
  """Convert an AMap v5 driving response into a Mapbox-compatible directions response.

  Returns a dict shaped like the body returned by
  https://api.mapbox.com/directions/v5/mapbox/driving-traffic/...

  Raises ValueError when the AMap response indicates failure or has no path.
  """
  status = str(amap_response.get("status", "0"))
  if status != "1":
    raise ValueError(f"AMap returned error status: {amap_response.get('info', 'unknown')}")

  paths = ((amap_response.get("route") or {}).get("paths")) or []
  if not paths:
    raise ValueError("AMap response contains no paths")

  path = paths[0]
  total_distance = _safe_float(path.get("distance"))
  # v5: path.cost.duration; v3: path.duration (top level)
  total_duration = _safe_float((path.get("cost") or {}).get("duration") or path.get("duration"))

  # AMap doesn't always report per-step duration. If the total is known, fall
  # back to proportional distribution by distance so navd's remaining-time
  # math still works.
  step_durations: list[float] = []
  steps_raw = path.get("steps") or []
  reported_durations = [_safe_float((s.get("cost") or {}).get("duration") or s.get("duration"), default=-1.0) for s in steps_raw]
  step_distances = [_safe_float(s.get("step_distance") or s.get("distance")) for s in steps_raw]

  if all(d >= 0 for d in reported_durations):
    step_durations = reported_durations
  elif total_duration > 0 and total_distance > 0:
    step_durations = [total_duration * (sd / total_distance) if total_distance > 0 else 0.0 for sd in step_distances]
  else:
    step_durations = [0.0] * len(steps_raw)

  mapbox_steps: list[dict[str, Any]] = []
  full_geometry: list[list[float]] = []

  for step_raw, step_distance, step_duration in zip(steps_raw, step_distances, step_durations, strict=True):
    coords = _resolve_step_geometry(step_raw)
    if not coords:
      # Skip degenerate steps to avoid breaking navd's distance_along_geometry()
      continue

    # Avoid duplicating the connecting coordinate between adjacent steps in
    # the route's full geometry (matches Mapbox's flat geometry).
    if full_geometry and full_geometry[-1] == coords[0]:
      full_geometry.extend(coords[1:])
    else:
      full_geometry.extend(coords)

    mapbox_steps.append({
      "distance": step_distance,
      "duration": step_duration,
      "duration_typical": step_duration,
      "geometry": {
        "type": "LineString",
        "coordinates": coords,
      },
      "bannerInstructions": _build_banner_instructions(step_raw, step_distance),
      "voiceInstructions": [],
      "intersections": [],  # AMap doesn't expose stop_sign / traffic_signal positions; CENavigationIntersections degrades gracefully
      "name": step_raw.get("road_name") or step_raw.get("road") or "",
      "mode": "driving",
    })

  if not mapbox_steps:
    raise ValueError("AMap response produced no usable steps after filtering")

  # Build a route geometry hash for navd's chosen-route selection logic
  flat = ",".join(str(c) for pair in full_geometry for c in pair)
  geometry_hash = hashlib.sha1(flat.encode()).hexdigest()

  # navd reads chosen_route['legs'][0]['annotation']['maxspeed']; AMap doesn't
  # provide per-coordinate maxspeed, so emit `unknown` markers (matches what
  # Mapbox sends for roads without a posted limit). SLC falls back to OSM.
  maxspeed_annotations = [{"unknown": True} for _ in range(max(0, len(full_geometry) - 1))]

  destination_name = place_name or "高德导航终点"

  route = {
    "distance": total_distance,
    "duration": total_duration,
    "duration_typical": total_duration,
    "geometry": {
      "type": "LineString",
      "coordinates": full_geometry,
    },
    "legs": [{
      "distance": total_distance,
      "duration": total_duration,
      "duration_typical": total_duration,
      "summary": destination_name,
      "steps": mapbox_steps,
      "annotation": {
        "maxspeed": maxspeed_annotations,
      },
    }],
    "weight": total_duration,
    "weight_name": "auto",
  }

  return {
    "code": "Ok",
    "uuid": geometry_hash[:16],
    "routes": [route],
    "waypoints": [],
    "_provider": "amap_v5",
    "_geometry_hash": geometry_hash,
  }


def fetch_amap_route(
  api_key: str,
  origin_lng: float,
  origin_lat: float,
  dest_lng: float,
  dest_lat: float,
  *,
  waypoints: list[tuple[float, float]] | None = None,
  strategy: int = 32,
  bearing: float | None = None,
  origin_is_wgs84: bool = True,
) -> dict[str, Any]:
  """Call AMap v5 driving direction API and return the parsed JSON.

  The user's GPS coordinates from openpilot are WGS-84; AMap expects GCJ-02
  in mainland China. We must NOT pre-convert here — AMap's API auto-detects
  WGS-84 input via the `coordsys` query param. We pass it explicitly as
  `gps` to avoid double-shifting.

  Strategy 32 = "default with traffic" per AMap docs (matches AMap mobile
  app's default behavior). Range 0-45 — see strategy table in v3 docs:
  https://lbs.amap.com/api/webservice/guide/api/direction#s9

  Returns the raw AMap JSON response. Caller is responsible for status
  checking via convert_amap_to_mapbox().
  """
  origin_str = f"{origin_lng:.6f},{origin_lat:.6f}"
  dest_str = f"{dest_lng:.6f},{dest_lat:.6f}"

  query: dict[str, str] = {
    "key": api_key,
    "origin": origin_str,
    "destination": dest_str,
    "strategy": str(strategy),
    "show_fields": "cost,navi,tmcs,polyline",
    # AMap accepts WGS-84 input directly when coordsys=gps is set
    "coordsys": "gps" if origin_is_wgs84 else "autonavi",
  }

  if waypoints:
    query["waypoints"] = ";".join(f"{lng:.6f},{lat:.6f}" for lng, lat in waypoints)

  if bearing is not None:
    # AMap accepts an `origin_type=4` + `origin` with multiple coords for bearing,
    # but the simpler approach is to skip bearing for now since most cars don't
    # need it for initial planning. navd's reroute logic handles wrong-direction
    # cases independently.
    pass

  resp = requests.get(AMAP_V5_DRIVING_URL, params=query, timeout=AMAP_REQUEST_TIMEOUT)
  if resp.status_code != 200:
    # Lazy import: keeps the pure converter usable without openpilot's full runtime (e.g. unit tests)
    from openpilot.common.swaglog import cloudlog
    cloudlog.event("amap_route_request_failed", status_code=resp.status_code, text=resp.text[:500], error=True)
  resp.raise_for_status()
  return resp.json()
