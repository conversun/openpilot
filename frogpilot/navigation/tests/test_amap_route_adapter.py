"""Tests for AMap (高德) v5 driving response → Mapbox-compatible adapter."""
import pytest

from openpilot.frogpilot.navigation.amap_route_adapter import (
  action_to_maneuver,
  convert_amap_to_mapbox,
  gcj02_to_wgs84,
  parse_amap_polyline,
)


class TestGCJ02ToWGS84:
  def test_inside_china_shifts(self):
    # Tiananmen Square in GCJ-02 (from AMap) should shift ~500m to WGS-84
    lng_gcj, lat_gcj = 116.397499, 39.908722
    lng_wgs, lat_wgs = gcj02_to_wgs84(lng_gcj, lat_gcj)
    # Known offset: AMap GCJ-02 → WGS-84 around Beijing is ~0.005° lng, ~0.003° lat
    assert lng_wgs != lng_gcj
    assert lat_wgs != lat_gcj
    assert abs(lng_wgs - lng_gcj) < 0.02
    assert abs(lat_wgs - lat_gcj) < 0.02
    # WGS-84 should have smaller longitude than GCJ-02 in mainland China
    assert lng_wgs < lng_gcj
    assert lat_wgs < lat_gcj

  def test_outside_china_no_shift(self):
    # San Francisco — outside China, must be no-op
    lng, lat = -122.4194, 37.7749
    out_lng, out_lat = gcj02_to_wgs84(lng, lat)
    assert out_lng == lng
    assert out_lat == lat

  def test_pacific_no_shift(self):
    # Pacific ocean — no-op
    lng, lat = -150.0, 30.0
    assert gcj02_to_wgs84(lng, lat) == (lng, lat)


class TestParsePolyline:
  def test_empty_string(self):
    assert parse_amap_polyline("") == []

  def test_single_point(self):
    coords = parse_amap_polyline("116.397499,39.908722")
    assert len(coords) == 1
    assert len(coords[0]) == 2
    # Should have been GCJ-02 → WGS-84 converted
    assert coords[0][0] != 116.397499

  def test_multiple_points(self):
    polyline = "116.397499,39.908722;116.398000,39.909000;116.399000,39.910000"
    coords = parse_amap_polyline(polyline)
    assert len(coords) == 3
    for c in coords:
      assert len(c) == 2
      assert isinstance(c[0], float)
      assert isinstance(c[1], float)

  def test_skips_malformed_points(self):
    # Trailing semicolon, empty segment, malformed coords should be skipped
    polyline = "116.397499,39.908722;;not_a_point;116.398000,39.909000;"
    coords = parse_amap_polyline(polyline)
    assert len(coords) == 2


class TestActionToManeuver:
  @pytest.mark.parametrize("action,expected_type,expected_modifier", [
    ("左转", "turn", "left"),
    ("右转", "turn", "right"),
    ("直行", "turn", "straight"),
    ("向左前方行驶", "turn", "slight left"),
    ("向右前方行驶", "turn", "slight right"),
    ("向左后方行驶", "turn", "sharp left"),
    ("向右后方行驶", "turn", "sharp right"),
    ("左转调头", "turn", "uturn"),
    ("调头", "turn", "uturn"),
    ("靠左", "fork", "left"),
    ("靠右", "fork", "right"),
    ("进入环岛", "roundabout", "straight"),
    ("离开环岛", "exit roundabout", "straight"),
    ("减速行驶", "notification", "straight"),
    ("到达目的地", "arrive", "straight"),
  ])
  def test_known_actions(self, action, expected_type, expected_modifier):
    assert action_to_maneuver(action) == (expected_type, expected_modifier)

  def test_unknown_action_falls_back_to_straight_turn(self):
    assert action_to_maneuver("未来的新动作") == ("turn", "straight")

  def test_empty_action(self):
    assert action_to_maneuver("") == ("turn", "straight")
    assert action_to_maneuver(None) == ("turn", "straight")

  def test_action_with_whitespace(self):
    assert action_to_maneuver("  左转  ") == ("turn", "left")


# Minimal but realistic AMap v5 driving response (Beijing South Station → Beijing Station)
AMAP_SAMPLE_RESPONSE = {
  "status": "1",
  "info": "OK",
  "infocode": "10000",
  "count": "1",
  "route": {
    "origin": "116.379028,39.865042",
    "destination": "116.427281,39.903719",
    "paths": [{
      "distance": "12640",
      "restriction": "0",
      "cost": {
        "duration": "1680",
        "tolls": "0",
        "toll_distance": "0",
        "traffic_lights": "12",
      },
      "steps": [
        {
          "instruction": "沿北京南站路向东行驶584米左转进入主路",
          "orientation": "东",
          "road_name": "北京南站路",
          "step_distance": "584",
          "polyline": "116.379028,39.865042;116.380028,39.865142;116.381028,39.865242",
          "cost": {"duration": "60"},
          "navi": {"action": "左转", "assistant_action": "进入主路"},
        },
        {
          "instruction": "沿马家堡东路向北行驶595米右转",
          "orientation": "北",
          "road_name": "马家堡东路",
          "step_distance": "595",
          "polyline": "116.381028,39.865242;116.381128,39.866242;116.381228,39.867242",
          "cost": {"duration": "70"},
          "navi": {"action": "右转", "assistant_action": ""},
        },
        {
          "instruction": "向西行驶140米到达目的地",
          "orientation": "西",
          "road_name": "毛家湾胡同",
          "step_distance": "140",
          "polyline": "116.427181,39.903619;116.427281,39.903719",
          "cost": {"duration": "20"},
          "navi": {"action": "直行", "assistant_action": "到达目的地"},
        },
      ],
    }],
  },
}


class TestConvertAmapToMapbox:
  def test_full_conversion(self):
    result = convert_amap_to_mapbox(AMAP_SAMPLE_RESPONSE, place_name="北京站")

    # Top-level shape matches Mapbox directions response
    assert result["code"] == "Ok"
    assert "uuid" in result
    assert len(result["routes"]) == 1
    assert result["_provider"] == "amap_v5"
    assert "_geometry_hash" in result

  def test_route_aggregates(self):
    result = convert_amap_to_mapbox(AMAP_SAMPLE_RESPONSE)
    route = result["routes"][0]

    assert route["distance"] == 12640.0
    assert route["duration"] == 1680.0
    assert route["duration_typical"] == 1680.0
    assert route["geometry"]["type"] == "LineString"
    assert len(route["geometry"]["coordinates"]) > 0

  def test_steps_have_required_navd_fields(self):
    """navd reads chosen_route['legs'][0]['steps'] and uses these exact fields."""
    result = convert_amap_to_mapbox(AMAP_SAMPLE_RESPONSE)
    steps = result["routes"][0]["legs"][0]["steps"]

    assert len(steps) == 3
    for step in steps:
      # Fields navd.py:243+ requires
      assert "distance" in step
      assert "duration" in step
      assert "duration_typical" in step
      assert "geometry" in step
      assert "coordinates" in step["geometry"]
      assert "bannerInstructions" in step
      assert isinstance(step["bannerInstructions"], list)
      assert "intersections" in step
      assert step["intersections"] == []  # AMap doesn't expose these

  def test_banner_instructions_shape(self):
    result = convert_amap_to_mapbox(AMAP_SAMPLE_RESPONSE)
    steps = result["routes"][0]["legs"][0]["steps"]

    # Step 0: 左转 + 进入主路
    banner = steps[0]["bannerInstructions"][0]
    assert banner["distanceAlongGeometry"] == 584.0
    assert banner["primary"]["text"] == "沿北京南站路向东行驶584米左转进入主路"
    assert banner["primary"]["type"] == "turn"
    assert banner["primary"]["modifier"] == "left"
    assert banner["secondary"]["text"] == "进入主路"

    # Step 1: 右转, no assistant_action → no secondary
    banner = steps[1]["bannerInstructions"][0]
    assert banner["primary"]["modifier"] == "right"
    assert "secondary" not in banner

    # Step 2: 直行 + 到达目的地
    banner = steps[2]["bannerInstructions"][0]
    assert banner["primary"]["modifier"] == "straight"
    assert banner["secondary"]["text"] == "到达目的地"

  def test_legs_annotation_maxspeed_unknown(self):
    """navd reads chosen_route['legs'][0]['annotation']['maxspeed'] and tolerates {'unknown': True}."""
    result = convert_amap_to_mapbox(AMAP_SAMPLE_RESPONSE)
    annotation = result["routes"][0]["legs"][0]["annotation"]
    assert "maxspeed" in annotation
    assert all("unknown" in m for m in annotation["maxspeed"])

  def test_geometry_coordinates_are_wgs84(self):
    """Coordinates must be GCJ-02 → WGS-84 converted."""
    result = convert_amap_to_mapbox(AMAP_SAMPLE_RESPONSE)
    coords = result["routes"][0]["geometry"]["coordinates"]
    # First raw point was 116.379028,39.865042 in GCJ-02; WGS-84 should differ
    assert coords[0][0] != 116.379028
    assert coords[0][1] != 39.865042
    # But still close (Beijing area has ~500m offset)
    assert abs(coords[0][0] - 116.379028) < 0.02
    assert abs(coords[0][1] - 39.865042) < 0.02

  def test_full_geometry_aggregates_steps(self):
    result = convert_amap_to_mapbox(AMAP_SAMPLE_RESPONSE)
    full_coords = result["routes"][0]["geometry"]["coordinates"]
    step_coords = [c for s in result["routes"][0]["legs"][0]["steps"] for c in s["geometry"]["coordinates"]]
    # Full geometry deduplicates connecting endpoints, so it's <= sum of step coords
    assert len(full_coords) <= len(step_coords)
    assert len(full_coords) > 0

  def test_failure_status_raises(self):
    bad = {"status": "0", "info": "INVALID_USER_KEY"}
    with pytest.raises(ValueError, match="INVALID_USER_KEY"):
      convert_amap_to_mapbox(bad)

  def test_no_paths_raises(self):
    bad = {"status": "1", "route": {"paths": []}}
    with pytest.raises(ValueError, match="no paths"):
      convert_amap_to_mapbox(bad)

  def test_step_duration_fallback_when_missing(self):
    """When AMap doesn't return per-step cost.duration, total is distributed by distance."""
    response = {
      "status": "1",
      "route": {
        "paths": [{
          "distance": "1000",
          "cost": {"duration": "100"},
          "steps": [
            {
              "instruction": "step 1",
              "step_distance": "400",
              "polyline": "116.0,39.0;116.001,39.0",
              "navi": {"action": "直行"},
            },
            {
              "instruction": "step 2",
              "step_distance": "600",
              "polyline": "116.001,39.0;116.002,39.0",
              "navi": {"action": "直行"},
            },
          ],
        }],
      },
    }
    result = convert_amap_to_mapbox(response)
    steps = result["routes"][0]["legs"][0]["steps"]
    # 400/1000 * 100 = 40, 600/1000 * 100 = 60
    assert steps[0]["duration"] == pytest.approx(40.0, abs=0.01)
    assert steps[1]["duration"] == pytest.approx(60.0, abs=0.01)

  def test_destination_name_used_in_summary(self):
    result = convert_amap_to_mapbox(AMAP_SAMPLE_RESPONSE, place_name="天安门")
    assert result["routes"][0]["legs"][0]["summary"] == "天安门"

  def test_default_destination_name(self):
    result = convert_amap_to_mapbox(AMAP_SAMPLE_RESPONSE)
    assert result["routes"][0]["legs"][0]["summary"] == "高德导航终点"

  def test_navd_compatible_chosen_route_access(self):
    """End-to-end: simulate the exact field accesses navd.py performs."""
    result = convert_amap_to_mapbox(AMAP_SAMPLE_RESPONSE)
    chosen_route = result["routes"][0]

    # navd.py:252
    route_steps = chosen_route["legs"][0]["steps"]
    assert len(route_steps) > 0

    # navd.py:267
    maxspeeds = chosen_route["legs"][0]["annotation"]["maxspeed"]
    assert isinstance(maxspeeds, list)

    # navd.py:273
    for step in route_steps:
      for c in step["geometry"]["coordinates"]:
        assert len(c) == 2
        assert isinstance(c[0], float)
        assert isinstance(c[1], float)

    # navd.py:261
    for step in route_steps:
      for intersection in step["intersections"]:
        # Should be empty, but loop must not crash
        pass


class TestRealAMapResponses:
  """Smoke tests against real AMap responses captured from the user's web key.

  Fixtures are anonymized API responses (Beijing South Station -> Beijing Station).
  Both v3 and v5 must round-trip cleanly into navd's expected structure."""

  @staticmethod
  def _load_fixture(name: str) -> dict:
    import json
    from pathlib import Path
    fixtures_dir = Path(__file__).parent / "fixtures"
    return json.loads((fixtures_dir / name).read_text(encoding="utf-8"))

  def test_v5_real_response(self):
    raw = self._load_fixture("amap_v5_beijing.json")
    result = convert_amap_to_mapbox(raw, place_name="北京站")
    route = result["routes"][0]
    # Sanity check: real Beijing South -> Beijing Station should be ~12-13km, ~30-50min
    assert 10_000 < route["distance"] < 20_000
    assert 1_500 < route["duration"] < 4_000
    # Geometry should have hundreds of points across all steps
    assert len(route["geometry"]["coordinates"]) > 100
    # Every step must have a non-empty polyline (else navd's distance_along_geometry breaks)
    for step in route["legs"][0]["steps"]:
      assert len(step["geometry"]["coordinates"]) >= 2
      assert step["distance"] > 0
      # v5 reports per-step duration via cost.duration
      assert step["duration"] > 0
      # Banner text must be non-empty Chinese instruction
      assert step["bannerInstructions"][0]["primary"]["text"]

  def test_v3_real_response(self):
    raw = self._load_fixture("amap_v3_beijing.json")
    result = convert_amap_to_mapbox(raw, place_name="北京站")
    route = result["routes"][0]
    assert 10_000 < route["distance"] < 20_000
    assert 1_500 < route["duration"] < 4_000
    assert len(route["geometry"]["coordinates"]) > 100
    for step in route["legs"][0]["steps"]:
      assert len(step["geometry"]["coordinates"]) >= 2
      assert step["distance"] > 0
      assert step["duration"] > 0
      assert step["bannerInstructions"][0]["primary"]["text"]

  def test_v3_v5_yield_equivalent_geometry(self):
    """Both versions cover the same physical route; coordinates should align closely."""
    v3 = convert_amap_to_mapbox(self._load_fixture("amap_v3_beijing.json"))
    v5 = convert_amap_to_mapbox(self._load_fixture("amap_v5_beijing.json"))
    # Distance should match exactly (same backend routing engine)
    assert v3["routes"][0]["distance"] == v5["routes"][0]["distance"]
    # Coord counts can differ slightly because v5 stitches via tmcs (more granular splits)
    # but both should have similar order of magnitude
    v3_n = len(v3["routes"][0]["geometry"]["coordinates"])
    v5_n = len(v5["routes"][0]["geometry"]["coordinates"])
    assert abs(v3_n - v5_n) / max(v3_n, v5_n) < 0.2  # within 20%

  def test_v5_assistant_action_propagates(self):
    """v5 nests assistant_action under step.navi.assistant_action; verify secondary banner appears."""
    raw = self._load_fixture("amap_v5_beijing.json")
    result = convert_amap_to_mapbox(raw)
    # At least one step should have a non-empty secondary banner (e.g. '进入主路')
    has_secondary = any(
      "secondary" in step["bannerInstructions"][0]
      for step in result["routes"][0]["legs"][0]["steps"]
    )
    assert has_secondary, "Expected at least one step to carry assistant_action as secondary banner"

  def test_v3_assistant_action_empty_array_handled(self):
    """v3 returns assistant_action as [] (empty array) when absent; must not crash banner builder."""
    raw = self._load_fixture("amap_v3_beijing.json")
    result = convert_amap_to_mapbox(raw)
    # Should successfully convert without TypeError on empty arrays
    assert len(result["routes"][0]["legs"][0]["steps"]) > 0
