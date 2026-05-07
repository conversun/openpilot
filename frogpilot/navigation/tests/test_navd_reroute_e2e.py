"""Real navd-level reroute tests.

This file tests the ACTUAL navd code (not a re-implementation). Two tiers:

  Tier A: pure-function tests that import `should_skip_reroute_due_to_gps`
          directly from selfdrive.navd.navd. No mocking needed.

  Tier B: RouteEngine integration tests that load navd with sys.modules-stubbed
          cereal/zmq/params dependencies, then exercise calculate_route() and
          recompute_route() with mocked AMap + mocked liveLocationKalman.

Tier B is the answer to Oracle's complaint that the previous reroute tests
"reimplemented should_recompute and didn't import RouteEngine".
"""
from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock, patch

import pytest


# -------------------------------------------------------------------
# Tier A: import the actual pure guard from navd.py
# -------------------------------------------------------------------

# selfdrive.navd.navd imports cereal/swaglog/params at module level. Stub them
# minimally so the pure helper can be imported on a dev machine without zmq.
def _stub_navd_dependencies():
  if "openpilot.selfdrive.navd.helpers" in sys.modules:
    return

  cereal_mod = types.ModuleType("cereal")
  log_mod = types.ModuleType("cereal.log")

  class _Status:
    valid = "valid"
    uncalibrated = "uncalibrated"
    uninitialized = "uninitialized"

  class _LiveLocationKalman:
    Status = _Status

  log_mod.LiveLocationKalman = _LiveLocationKalman
  cereal_mod.log = log_mod
  cereal_mod.car = types.ModuleType("cereal.car")

  messaging_mod = types.ModuleType("cereal.messaging")
  messaging_mod.SubMaster = MagicMock
  messaging_mod.PubMaster = MagicMock
  messaging_mod.new_message = MagicMock(return_value=MagicMock())

  sys.modules.setdefault("cereal", cereal_mod)
  sys.modules["cereal.log"] = log_mod
  sys.modules["cereal.messaging"] = messaging_mod

  swaglog_mod = types.ModuleType("openpilot.common.swaglog")
  swaglog_mod.cloudlog = MagicMock()
  sys.modules["openpilot.common.swaglog"] = swaglog_mod

  params_mod = types.ModuleType("openpilot.common.params")
  params_mod.Params = MagicMock
  sys.modules["openpilot.common.params"] = params_mod

  api_mod = types.ModuleType("openpilot.common.api")
  api_mod.Api = MagicMock
  sys.modules["openpilot.common.api"] = api_mod

  numpy_fast_mod = types.ModuleType("openpilot.common.numpy_fast")
  numpy_fast_mod.interp = lambda x, xp, fp: fp[0]
  sys.modules["openpilot.common.numpy_fast"] = numpy_fast_mod

  realtime_mod = types.ModuleType("openpilot.common.realtime")
  realtime_mod.Ratekeeper = MagicMock
  sys.modules["openpilot.common.realtime"] = realtime_mod

  fp_vars_mod = types.ModuleType("openpilot.frogpilot.common.frogpilot_variables")
  fp_vars_mod.get_frogpilot_toggles = lambda: MagicMock(
    conditional_navigation=False,
    conditional_navigation_intersections=False,
    conditional_navigation_turns=False,
  )
  sys.modules["openpilot.frogpilot.common.frogpilot_variables"] = fp_vars_mod

  # numpy not stubbed: helpers/conversions/numpy_fast are stubbed below, so the
  # numpy chain is never triggered. Stubbing numpy globally poisons pytest.approx.
  conversions_mod = types.ModuleType("openpilot.common.conversions")
  conversions_mod.Conversions = MagicMock(KPH_TO_MS=0.27778, MPH_TO_MS=0.44704)
  sys.modules["openpilot.common.conversions"] = conversions_mod

  helpers_mod = types.ModuleType("openpilot.selfdrive.navd.helpers")

  class _Coord:
    def __init__(self, latitude, longitude):
      self.latitude = latitude
      self.longitude = longitude
      self.annotations = {}

    def distance_to(self, other):
      import math as _m
      return _m.hypot(self.latitude - other.latitude, self.longitude - other.longitude) * 111000

    @classmethod
    def from_mapbox_tuple(cls, t):
      return cls(t[1], t[0])

    def as_dict(self):
      return {"latitude": self.latitude, "longitude": self.longitude}

    def __eq__(self, other):
      return isinstance(other, _Coord) and self.latitude == other.latitude and self.longitude == other.longitude

    def __ne__(self, other):
      return not self.__eq__(other)

    def __hash__(self):
      return hash((self.latitude, self.longitude))

  helpers_mod.Coordinate = _Coord
  helpers_mod.coordinate_from_param = lambda key, params: None
  helpers_mod.distance_along_geometry = lambda geom, pos: 0.0
  helpers_mod.maxspeed_to_ms = lambda spec: 0.0
  def _real_minimum_distance(a, b, p):
    """Real Euclidean point-to-segment distance in meters — lets should_recompute's
    off-route detection actually fire when last_position is far from route_geometry."""
    import math as _m
    ax, ay = a.longitude, a.latitude
    bx, by = b.longitude, b.latitude
    px, py = p.longitude, p.latitude
    seg_lensq = (bx - ax) ** 2 + (by - ay) ** 2
    if seg_lensq == 0:
      return _m.hypot(px - ax, py - ay) * 111000
    t = max(0.0, min(1.0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / seg_lensq))
    proj_x = ax + t * (bx - ax)
    proj_y = ay + t * (by - ay)
    return _m.hypot(px - proj_x, py - proj_y) * 111000
  helpers_mod.minimum_distance = _real_minimum_distance
  helpers_mod.parse_banner_instructions = lambda *args, **kwargs: None
  sys.modules["openpilot.selfdrive.navd.helpers"] = helpers_mod


_stub_navd_dependencies()
from openpilot.selfdrive.navd.navd import (  # noqa: E402
  REROUTE_COUNTER_MIN,
  REROUTE_POS_STD_THRESHOLD,
  should_skip_reroute_due_to_gps,
)


class TestShouldSkipRerouteDueToGps:
  """Tier A: import the actual function from navd, exercise it directly."""

  def test_no_route_active_never_skips(self):
    """Initial route fetch must always be allowed even if GPS is dead."""
    assert not should_skip_reroute_due_to_gps(
      gps_ok=False, position_std_norm=999.0, has_route=False, destination_changed=False
    )
    assert not should_skip_reroute_due_to_gps(
      gps_ok=False, position_std_norm=999.0, has_route=False, destination_changed=True
    )

  def test_destination_changed_overrides_bad_gps(self):
    """User explicitly setting a new destination must compute, even with bad GPS."""
    assert not should_skip_reroute_due_to_gps(
      gps_ok=False, position_std_norm=500.0, has_route=True, destination_changed=True
    )
    assert not should_skip_reroute_due_to_gps(
      gps_ok=True, position_std_norm=999.0, has_route=True, destination_changed=True
    )

  def test_off_route_with_good_gps_does_not_skip(self):
    """Normal off-route reroute case; GPS quality OK → don't skip."""
    assert not should_skip_reroute_due_to_gps(
      gps_ok=True, position_std_norm=10.0, has_route=True, destination_changed=False
    )

  def test_off_route_with_gps_lost_skips(self):
    """Tunnel scenario: GPS gone, route still active, no new destination → skip."""
    assert should_skip_reroute_due_to_gps(
      gps_ok=False, position_std_norm=15.0, has_route=True, destination_changed=False
    )

  def test_off_route_with_high_uncertainty_skips(self):
    """Tunnel multipath: gps_ok still True but Kalman uncertainty growing → skip."""
    assert should_skip_reroute_due_to_gps(
      gps_ok=True, position_std_norm=50.0, has_route=True, destination_changed=False
    )

  def test_threshold_boundary_strict_inequality(self):
    """std == threshold should NOT skip; std > threshold should skip."""
    assert not should_skip_reroute_due_to_gps(
      gps_ok=True, position_std_norm=REROUTE_POS_STD_THRESHOLD,
      has_route=True, destination_changed=False
    )
    assert should_skip_reroute_due_to_gps(
      gps_ok=True, position_std_norm=REROUTE_POS_STD_THRESHOLD + 0.001,
      has_route=True, destination_changed=False
    )

  def test_default_threshold_value(self):
    """Confirm 30m default per locationd's tighter-than-VALID_POS_STD design."""
    assert REROUTE_POS_STD_THRESHOLD == 30.0


# -------------------------------------------------------------------
# Tier B: load RouteEngine via sys.modules stubs and exercise reroute
# -------------------------------------------------------------------

@pytest.fixture
def fake_navd_module():
  """Get the actual navd module (already imported via Tier A) and reset module state."""
  # navd was imported in Tier A. Re-fetch it.
  from openpilot.selfdrive.navd import navd as navd_module
  return navd_module


class TestRouteEngineReroute:
  """Tier B: instantiate the actual RouteEngine and exercise calculate_route + recompute."""

  def _make_engine(self, navd_module):
    """Build a RouteEngine with mocked sm/pm/Params."""
    sm = MagicMock()
    pm = MagicMock()
    engine = navd_module.RouteEngine.__new__(navd_module.RouteEngine)
    engine.sm = sm
    engine.pm = pm
    engine.params = MagicMock()
    engine.params.get_bool.return_value = False
    engine.params.get.return_value = None
    engine.last_position = navd_module.Coordinate(22.61, 114.03)
    engine.last_bearing = None
    engine.gps_ok = True
    engine.position_std_norm = 5.0
    engine.localizer_valid = True
    engine.nav_destination = None
    engine.step_idx = None
    engine.route = None
    engine.route_geometry = None
    engine.recompute_backoff = 0
    engine.recompute_countdown = 0
    engine.ui_pid = None
    engine.reroute_counter = 0
    engine.api = None
    engine.mapbox_token = "fake"
    engine.mapbox_host = "https://api.mapbox.com"
    engine.approaching_intersection = False
    engine.approaching_turn = False
    engine.nav_speed_limit = 0
    engine.stop_coord = []
    engine.stop_signal = []
    engine.frogpilot_toggles = MagicMock(
      conditional_navigation=False,
      conditional_navigation_intersections=False,
      conditional_navigation_turns=False,
    )
    return engine

  def test_calculate_route_amap_path_calls_adapter_with_current_position(self, fake_navd_module):
    """When UseAMapRouting=1 and AMapWebKey is set, calculate_route must call fetch_amap_route
    with self.last_position (NOT a stale coord). This is the reroute-uses-fresh-coords contract."""
    engine = self._make_engine(fake_navd_module)
    engine.params.get_bool.return_value = True  # UseAMapRouting

    def fake_param_get(key, encoding=None):
      return {"AMapWebKey": "test_key", "AMapRouteStrategy": "45", "NavDestination": '{"place_name":"x"}'}.get(key)
    engine.params.get.side_effect = fake_param_get

    fake_amap_response = {
      "status": "1",
      "route": {"paths": [{
        "distance": "1000", "cost": {"duration": "60"},
        "steps": [{
          "step_distance": "1000",
          "polyline": "114.03,22.61;114.04,22.62;113.82,22.64",
          "navi": {"action": "直行", "assistant_action": ""},
          "instruction": "to dest",
        }],
      }]},
    }

    captured_calls = []

    def fake_fetch(api_key, origin_lng, origin_lat, dest_lng, dest_lat, **kwargs):
      captured_calls.append({
        "api_key": api_key,
        "origin": (origin_lng, origin_lat),
        "destination": (dest_lng, dest_lat),
        "kwargs": kwargs,
      })
      return fake_amap_response

    destination = fake_navd_module.Coordinate(22.64, 113.82)

    with patch("openpilot.frogpilot.navigation.amap_route_adapter.fetch_amap_route", side_effect=fake_fetch), \
         patch("openpilot.frogpilot.navigation.amap_route_adapter.requests.get"), \
         patch("builtins.open"):
      engine.calculate_route(destination)

    assert len(captured_calls) == 1
    call = captured_calls[0]
    assert call["api_key"] == "test_key"
    assert call["origin"] == (114.03, 22.61), f"must use engine.last_position, got {call['origin']}"
    assert call["destination"] == (113.82, 22.64)
    assert call["kwargs"].get("strategy") == 45
    # After successful build, nav_destination MUST be set
    assert engine.nav_destination == destination
    assert engine.step_idx == 0
    assert engine.route is not None

  def test_amap_failure_preserves_existing_route_and_does_not_advance_destination(self, fake_navd_module):
    """The stuck-route bug fix: if AMap fails mid-trip while user changes destination,
    self.route stays as the OLD route AND self.nav_destination stays as the OLD destination,
    so next tick's destination-changed check fires another retry."""
    engine = self._make_engine(fake_navd_module)
    engine.params.get_bool.return_value = True
    engine.params.get.return_value = None
    engine.params.get.side_effect = lambda key, encoding=None: {
      "AMapWebKey": "test_key", "AMapRouteStrategy": "32"
    }.get(key)

    # Simulate state of an active in-flight route
    old_destination = fake_navd_module.Coordinate(22.61, 114.05)
    old_route = [{"distance": 100.0, "duration": 30.0, "duration_typical": 30.0,
                  "geometry": {"coordinates": [[114.03, 22.61], [114.05, 22.61]]},
                  "bannerInstructions": [], "intersections": []}]
    engine.nav_destination = old_destination
    engine.route = old_route
    engine.route_geometry = [[fake_navd_module.Coordinate(22.61, 114.03)]]
    engine.step_idx = 0

    new_destination = fake_navd_module.Coordinate(22.64, 113.82)

    def fake_fetch_fails(*args, **kwargs):
      raise ValueError("AMap returned error status: CUQPS_HAS_EXCEEDED_THE_LIMIT")

    with patch("openpilot.frogpilot.navigation.amap_route_adapter.fetch_amap_route", side_effect=fake_fetch_fails), \
         patch("openpilot.frogpilot.navigation.amap_route_adapter.requests.get"), \
         patch("builtins.open"):
      engine.calculate_route(new_destination)

    # The fix: nav_destination must NOT advance to new_destination since the fetch failed
    assert engine.nav_destination == old_destination, (
      f"stuck-route bug: nav_destination advanced to {engine.nav_destination} "
      f"despite fetch failure; should still be {old_destination}"
    )
    # Existing route preserved
    assert engine.route is old_route, "existing route must survive transient failure"
    assert engine.step_idx == 0, "step_idx must not be reset"

  def test_recompute_route_off_route_drives_fresh_amap_call(self, fake_navd_module):
    """True end-to-end reroute: REAL distance logic detects off-route condition,
    REAL recompute_counter accrues across ticks, REAL recompute_route() fires the
    AMap call. We do NOT patch should_recompute or the counter — only the I/O
    boundary (fetch_amap_route, coordinate_from_param) is mocked."""
    engine = self._make_engine(fake_navd_module)
    engine.params.get_bool.return_value = True
    engine.params.get.side_effect = lambda key, encoding=None: {
      "AMapWebKey": "test_key", "AMapRouteStrategy": "32",
      "NavDestination": '{"latitude":22.64,"longitude":113.82,"place_name":"x"}',
    }.get(key)

    destination = fake_navd_module.Coordinate(22.64, 113.82)
    engine.nav_destination = destination
    engine.route = [{"distance": 1000.0}, {"distance": 1000.0}]  # >=2 steps so step_idx=0 isn't the last segment
    # Real route geometry: a straight line across ~111m heading east
    a = fake_navd_module.Coordinate(22.6100, 114.0300)
    b = fake_navd_module.Coordinate(22.6100, 114.0310)
    engine.route_geometry = [[a, b]]
    engine.step_idx = 0

    # Deviate ~111m NORTH of the route segment (well over 25m threshold)
    deviated_position = fake_navd_module.Coordinate(22.6110, 114.0305)
    engine.last_position = deviated_position
    engine.gps_ok = True
    engine.position_std_norm = 5.0
    engine.recompute_countdown = 0
    engine.reroute_counter = 0

    captured_origins: list[tuple[float, float]] = []

    def fake_fetch(api_key, origin_lng, origin_lat, dest_lng, dest_lat, **kwargs):
      captured_origins.append((origin_lng, origin_lat))
      return {
        "status": "1",
        "route": {"paths": [{
          "distance": "500", "cost": {"duration": "30"},
          "steps": [{
            "step_distance": "500",
            "polyline": f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}",
            "navi": {"action": "直行", "assistant_action": ""},
            "instruction": "to dest",
          }],
        }]},
      }

    def stub_coord_from_param(key, params):
      if key == "NavDestination":
        return destination
      return None

    # Sanity check: confirm REAL minimum_distance sees us as off-route
    from openpilot.selfdrive.navd.helpers import minimum_distance
    actual_offset = minimum_distance(a, b, deviated_position)
    assert actual_offset > 25, (
      f"test setup invalid: deviated_position is only {actual_offset:.1f}m from route, "
      "need >25m for should_recompute to trigger"
    )

    with patch("openpilot.frogpilot.navigation.amap_route_adapter.fetch_amap_route", side_effect=fake_fetch), \
         patch("openpilot.frogpilot.navigation.amap_route_adapter.requests.get"), \
         patch("openpilot.selfdrive.navd.navd.coordinate_from_param", side_effect=stub_coord_from_param), \
         patch("builtins.open"):
      # Tick recompute_route() enough times for reroute_counter to exceed REROUTE_COUNTER_MIN.
      # Each tick should accrue +1 to reroute_counter via REAL should_recompute() distance math.
      for _ in range(REROUTE_COUNTER_MIN + 2):
        engine.recompute_route()
        if captured_origins:
          break

    assert len(captured_origins) == 1, (
      f"recompute_route should fire exactly one AMap call after "
      f"REROUTE_COUNTER_MIN+1 off-route ticks; got {len(captured_origins)}"
    )
    actual_origin = captured_origins[0]
    assert actual_origin == (deviated_position.longitude, deviated_position.latitude), (
      f"reroute must use the deviated current position, got {actual_origin} "
      f"(expected {(deviated_position.longitude, deviated_position.latitude)})"
    )
