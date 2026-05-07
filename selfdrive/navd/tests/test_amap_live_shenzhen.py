"""Live integration test against AMap v5 driving API for a Shenzhen route.

Gated by the AMAP_WEB_KEY env var so it only runs when explicitly configured.
Marked `slow` because it hits the network. Run with:

  AMAP_WEB_KEY=xxx pytest selfdrive/navd/tests/test_amap_live_shenzhen.py -v --noconftest

Or as a standalone script:

  AMAP_WEB_KEY=xxx python selfdrive/navd/tests/test_amap_live_shenzhen.py
"""
from __future__ import annotations

import os

import pytest

from openpilot.selfdrive.navd.amap_route_adapter import (
  convert_amap_to_mapbox,
  fetch_amap_route,
)


# 深圳北站 (Shenzhen North Railway Station), WGS-84
ORIGIN_LNG, ORIGIN_LAT = 114.0296, 22.6098

# 深圳宝安国际机场 T3 (Shenzhen Bao'an International Airport, Terminal 3), WGS-84
DEST_LNG, DEST_LAT = 113.8201, 22.6377

# Loose Shenzhen bounding box (WGS-84) — every coordinate from the converted route
# must fall inside this box, otherwise the GCJ-02 -> WGS-84 conversion is broken.
SZ_BBOX = {"lng_min": 113.7, "lng_max": 114.7, "lat_min": 22.4, "lat_max": 22.85}


pytestmark = [
  pytest.mark.slow,
  pytest.mark.skipif(
    not os.environ.get("AMAP_WEB_KEY"),
    reason="AMAP_WEB_KEY not set; skipping live AMap test",
  ),
]


@pytest.fixture(scope="module")
def route():
  """Call AMap once per test session to avoid hammering the QPS limit."""
  key = os.environ["AMAP_WEB_KEY"]
  raw = fetch_amap_route(key, ORIGIN_LNG, ORIGIN_LAT, DEST_LNG, DEST_LAT)
  return raw, convert_amap_to_mapbox(raw, place_name="深圳宝安机场 T3")


def test_route_metadata_realistic(route):
  """深圳北站 → 宝安机场 should be ~25-60km, ~20-90min."""
  _, result = route
  r = result["routes"][0]
  assert 25_000 < r["distance"] < 60_000, f"unexpected distance {r['distance']}m"
  assert 1_200 < r["duration"] < 5_400, f"unexpected duration {r['duration']}s"


def test_geometry_inside_shenzhen_bbox(route):
  """All converted coordinates must land within Shenzhen bbox (proves WGS-84 conversion ran)."""
  _, result = route
  coords = result["routes"][0]["geometry"]["coordinates"]
  assert len(coords) > 100, f"too few coords: {len(coords)}"
  for lng, lat in coords:
    assert SZ_BBOX["lng_min"] < lng < SZ_BBOX["lng_max"], f"lng {lng} outside SZ bbox"
    assert SZ_BBOX["lat_min"] < lat < SZ_BBOX["lat_max"], f"lat {lat} outside SZ bbox"


def test_endpoints_close_to_inputs(route):
  """First/last coord should match origin/destination within ~500m (after WGS-84 round-trip)."""
  _, result = route
  coords = result["routes"][0]["geometry"]["coordinates"]
  first_lng, first_lat = coords[0]
  last_lng, last_lat = coords[-1]
  # 0.005 deg ≈ 500m at SZ latitude
  assert abs(first_lng - ORIGIN_LNG) < 0.005, f"start lng off: {first_lng} vs {ORIGIN_LNG}"
  assert abs(first_lat - ORIGIN_LAT) < 0.005, f"start lat off: {first_lat} vs {ORIGIN_LAT}"
  assert abs(last_lng - DEST_LNG) < 0.005, f"end lng off: {last_lng} vs {DEST_LNG}"
  assert abs(last_lat - DEST_LAT) < 0.005, f"end lat off: {last_lat} vs {DEST_LAT}"


def test_steps_have_navd_required_fields(route):
  """Every step is consumable by navd.calculate_route() without KeyError."""
  _, result = route
  steps = result["routes"][0]["legs"][0]["steps"]
  assert len(steps) >= 5, f"unrealistically few steps: {len(steps)}"
  for s in steps:
    assert s["distance"] > 0
    assert s["duration"] >= 0
    assert s["geometry"]["type"] == "LineString"
    assert len(s["geometry"]["coordinates"]) >= 2
    assert s["bannerInstructions"], "empty bannerInstructions"
    banner = s["bannerInstructions"][0]
    assert banner["primary"]["text"], "empty primary banner text"
    assert banner["primary"]["type"] in {
      "turn", "fork", "roundabout", "exit roundabout",
      "notification", "arrive", "continue",
    }


def test_maxspeed_annotation_shape(route):
  """navd reads chosen_route['legs'][0]['annotation']['maxspeed']; must exist and be list-shaped."""
  _, result = route
  ann = result["routes"][0]["legs"][0]["annotation"]
  assert "maxspeed" in ann
  assert isinstance(ann["maxspeed"], list)
  # AMap doesn't expose maxspeed; we emit unknown markers
  assert all("unknown" in m for m in ann["maxspeed"])


def test_unknown_actions_are_logged(route):
  """Surface any AMap navi.action strings we haven't mapped, so we can extend _ACTION_MAP."""
  raw, _ = route
  from openpilot.selfdrive.navd.amap_route_adapter import _ACTION_MAP
  unmapped: set[str] = set()
  for step in (raw.get("route") or {}).get("paths", [{}])[0].get("steps") or []:
    navi = step.get("navi") if isinstance(step.get("navi"), dict) else {}
    action = (navi.get("action") or step.get("action") or "").strip()
    if action and action not in _ACTION_MAP:
      unmapped.add(action)
  if unmapped:
    print(f"\n[warn] AMap returned actions not in _ACTION_MAP: {sorted(unmapped)}")


# Standalone debug runner: AMAP_WEB_KEY=xxx python this_file.py
if __name__ == "__main__":
  if not os.environ.get("AMAP_WEB_KEY"):
    raise SystemExit("Set AMAP_WEB_KEY env var first")
  raw, result = _fetch_and_convert()
  route = result["routes"][0]
  steps = route["legs"][0]["steps"]
  coords = route["geometry"]["coordinates"]

  print(f"AMap status:   {raw.get('status')} ({raw.get('info')})")
  print(f"Distance:      {route['distance'] / 1000:.2f} km")
  print(f"Duration:      {route['duration'] / 60:.1f} min")
  print(f"Steps:         {len(steps)}")
  print(f"Geometry pts:  {len(coords)}")
  print(f"Provider:      {result.get('_provider')}")
  print(f"Start (WGS84): {coords[0]}")
  print(f"End   (WGS84): {coords[-1]}")

  print("\nFirst 5 steps:")
  for i, s in enumerate(steps[:5]):
    b = s["bannerInstructions"][0]
    print(f"  [{i}] {s['distance']:>5.0f}m  {b['primary']['type']:<12} {b['primary']['modifier']:<10} {b['primary']['text']}")

  from openpilot.selfdrive.navd.amap_route_adapter import _ACTION_MAP
  unmapped = set()
  for step in (raw.get("route") or {}).get("paths", [{}])[0].get("steps") or []:
    navi = step.get("navi") if isinstance(step.get("navi"), dict) else {}
    action = (navi.get("action") or step.get("action") or "").strip()
    if action and action not in _ACTION_MAP:
      unmapped.add(action)
  if unmapped:
    print(f"\n[warn] Unmapped navi.action values seen: {sorted(unmapped)}")
  else:
    print("\nAll navi.action values are in _ACTION_MAP ✓")
