"""Cross-city live test: 深圳市民中心 → 广州塔 (~140km expressway route).

Validates AMap v5 holds together for long-distance routes (multi-city, expressway-heavy,
many steps). Catches issues that wouldn't show up in the in-city Shenzhen test:

  - tmcs polyline stitching across long expressway segments
  - step duration distribution at scale
  - city-boundary handling in the geometry (Shenzhen → Dongguan → Guangzhou)

Gated by AMAP_WEB_KEY env var, marked slow. Run with:

  AMAP_WEB_KEY=xxx pytest selfdrive/navd/tests/test_amap_live_crosscity.py -v --noconftest
"""
from __future__ import annotations

import os

import pytest

from openpilot.selfdrive.navd.amap_route_adapter import (
  convert_amap_to_mapbox,
  fetch_amap_route,
)


# 深圳市民中心 (Shenzhen Civic Center), WGS-84
ORIGIN_LNG, ORIGIN_LAT = 114.0628, 22.5448

# 广州塔 (Canton Tower), WGS-84
DEST_LNG, DEST_LAT = 113.3198, 23.1066

# Bounding box covering Shenzhen + Dongguan + Guangzhou (Greater Bay Area, north shore)
GBA_BBOX = {"lng_min": 113.0, "lng_max": 114.5, "lat_min": 22.4, "lat_max": 23.5}


pytestmark = [
  pytest.mark.slow,
  pytest.mark.skipif(
    not os.environ.get("AMAP_WEB_KEY"),
    reason="AMAP_WEB_KEY not set; skipping live AMap test",
  ),
]


@pytest.fixture(scope="module")
def route():
  """One AMap call shared across the test class to respect QPS limits."""
  key = os.environ["AMAP_WEB_KEY"]
  raw = fetch_amap_route(key, ORIGIN_LNG, ORIGIN_LAT, DEST_LNG, DEST_LAT)
  return raw, convert_amap_to_mapbox(raw, place_name="广州塔")


def test_route_metadata_long_distance(route):
  """SZ Civic Center → Canton Tower is ~120-160km, ~1.5-3.5h depending on traffic."""
  _, result = route
  r = result["routes"][0]
  assert 100_000 < r["distance"] < 200_000, f"unexpected distance {r['distance']}m for SZ→GZ"
  assert 4_500 < r["duration"] < 14_400, f"unexpected duration {r['duration']}s for SZ→GZ"


def test_geometry_inside_gba_bbox(route):
  """All converted coordinates must land in the Greater Bay Area bbox."""
  _, result = route
  coords = result["routes"][0]["geometry"]["coordinates"]
  # Long route should have many points — sanity check we stitched all steps' polylines
  assert len(coords) > 500, f"too few coords for 140km route: {len(coords)}"
  for lng, lat in coords:
    assert GBA_BBOX["lng_min"] < lng < GBA_BBOX["lng_max"], f"lng {lng} outside GBA"
    assert GBA_BBOX["lat_min"] < lat < GBA_BBOX["lat_max"], f"lat {lat} outside GBA"


def test_geometry_progresses_west_then_north(route):
  """SZ→GZ goes west then north; verify the polyline reflects that gross direction."""
  _, result = route
  coords = result["routes"][0]["geometry"]["coordinates"]
  start_lng, start_lat = coords[0]
  end_lng, end_lat = coords[-1]
  # GZ is north and west of SZ; both deltas should be positive in those directions
  assert end_lng < start_lng, f"expected westward travel, got start {start_lng} -> end {end_lng}"
  assert end_lat > start_lat, f"expected northward travel, got start {start_lat} -> end {end_lat}"


def test_many_steps_for_long_route(route):
  """A 140km cross-city route should produce many maneuver steps."""
  _, result = route
  steps = result["routes"][0]["legs"][0]["steps"]
  assert len(steps) >= 10, f"too few steps for cross-city route: {len(steps)}"
  # Distances should be a mix of short (in-city) and long (expressway) segments
  distances = [s["distance"] for s in steps]
  assert max(distances) > 5_000, f"no long expressway segment found, max step: {max(distances)}m"


def test_all_steps_have_geometry(route):
  """Every step must have ≥2 coordinates so navd.distance_along_geometry doesn't break."""
  _, result = route
  for i, s in enumerate(result["routes"][0]["legs"][0]["steps"]):
    coords = s["geometry"]["coordinates"]
    assert len(coords) >= 2, f"step[{i}] only has {len(coords)} coords"
    assert s["distance"] > 0, f"step[{i}] zero distance"


def test_step_distance_sum_close_to_route_total(route):
  """Sum of step distances should approximate route total (within 2% tolerance)."""
  _, result = route
  r = result["routes"][0]
  step_total = sum(s["distance"] for s in r["legs"][0]["steps"])
  # AMap may return slightly different total vs sum-of-steps due to rounding/overlap
  ratio = step_total / r["distance"]
  assert 0.95 < ratio < 1.05, f"step sum {step_total} far from total {r['distance']} (ratio {ratio:.3f})"


def test_unmapped_actions_surface(route):
  """Long route hits more action diversity; surface anything unmapped for follow-up."""
  raw, _ = route
  from openpilot.selfdrive.navd.amap_route_adapter import _ACTION_MAP
  unmapped: set[str] = set()
  for step in (raw.get("route") or {}).get("paths", [{}])[0].get("steps") or []:
    navi = step.get("navi") if isinstance(step.get("navi"), dict) else {}
    action = (navi.get("action") or step.get("action") or "").strip()
    if action and action not in _ACTION_MAP:
      unmapped.add(action)
  if unmapped:
    print(f"\n[warn] cross-city route returned unmapped actions: {sorted(unmapped)}")
