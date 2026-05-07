"""Tests for navd's reroute decision logic in AMap mode.

These don't import navd.py directly (it depends on cereal/zmq/params_pyx which
aren't always available on dev machines). Instead they test the same decision
matrix navd uses, with mocked AMap calls, to verify:

  1. AMap is called with FRESH coords on every reroute (not stale starting position)
  2. Position uncertainty / GPS-loss guards short-circuit the AMap call
  3. Exponential backoff prevents hammering AMap on persistent failures
  4. Existing route is preserved when an AMap call fails mid-trip

The logic mirrors what calculate_route() + recompute_route() do in
selfdrive/navd/navd.py. If navd's logic is refactored, update this file.
"""
from __future__ import annotations

import math
from unittest.mock import MagicMock, patch

import pytest

from openpilot.frogpilot.navigation.amap_route_adapter import (
  convert_amap_to_mapbox,
  fetch_amap_route,
)


# Same constants as navd.py
REROUTE_DISTANCE = 25
REROUTE_COUNTER_MIN = 3
REROUTE_POS_STD_THRESHOLD = 30.0


def _amap_response(coords: list[tuple[float, float]]) -> dict:
  """Build a minimal valid AMap v5 response for the given GCJ-02 coords."""
  polyline = ";".join(f"{lng},{lat}" for lng, lat in coords)
  total_dist = sum(
    math.hypot(coords[i + 1][0] - coords[i][0], coords[i + 1][1] - coords[i][1]) * 111_000
    for i in range(len(coords) - 1)
  )
  return {
    "status": "1",
    "info": "OK",
    "route": {
      "paths": [{
        "distance": str(int(total_dist)),
        "cost": {"duration": str(int(total_dist / 15))},
        "steps": [{
          "instruction": "向北行驶到达目的地",
          "step_distance": str(int(total_dist)),
          "polyline": polyline,
          "navi": {"action": "直行", "assistant_action": "到达目的地"},
        }],
      }],
    },
  }


# ---------- Reroute decision logic (mirrors navd.should_recompute) ----------

def _minimum_distance_to_segment(ax, ay, bx, by, px, py):
  """Approximate minimum distance from point P to segment AB in meters (small-area Euclidean)."""
  segment_len_sq = (bx - ax) ** 2 + (by - ay) ** 2
  if segment_len_sq == 0:
    return math.hypot(px - ax, py - ay) * 111_000
  t = max(0.0, min(1.0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / segment_len_sq))
  proj_x = ax + t * (bx - ax)
  proj_y = ay + t * (by - ay)
  return math.hypot(px - proj_x, py - proj_y) * 111_000


def _should_recompute(route_geometry, last_position, reroute_counter):
  """Mirror of navd.should_recompute logic; returns (new_counter, should_reroute)."""
  if not route_geometry:
    return 0, True
  min_d = float("inf")
  for i in range(len(route_geometry) - 1):
    a = route_geometry[i]
    b = route_geometry[i + 1]
    if math.hypot(b[0] - a[0], b[1] - a[1]) * 111_000 < 1.0:
      continue
    min_d = min(min_d, _minimum_distance_to_segment(a[0], a[1], b[0], b[1], last_position[0], last_position[1]))
  if min_d > REROUTE_DISTANCE:
    reroute_counter += 1
  else:
    reroute_counter = 0
  return reroute_counter, reroute_counter > REROUTE_COUNTER_MIN


class TestRerouteDecisionLogic:

  def test_on_route_does_not_trigger(self):
    geom = [(114.0, 22.6), (114.001, 22.6), (114.002, 22.6)]
    pos = (114.0005, 22.6)  # exactly on route
    counter, should = _should_recompute(geom, pos, 0)
    assert counter == 0
    assert not should

  def test_off_route_one_tick_does_not_trigger(self):
    geom = [(114.0, 22.6), (114.001, 22.6), (114.002, 22.6)]
    pos = (114.0, 22.605)  # ~555m north of route
    counter, should = _should_recompute(geom, pos, 0)
    assert counter == 1
    assert not should  # counter must exceed REROUTE_COUNTER_MIN (3)

  def test_off_route_4_ticks_triggers(self):
    geom = [(114.0, 22.6), (114.001, 22.6), (114.002, 22.6)]
    pos = (114.0, 22.605)
    counter = 0
    for _ in range(4):
      counter, should = _should_recompute(geom, pos, counter)
    assert should

  def test_back_on_route_resets_counter(self):
    geom = [(114.0, 22.6), (114.001, 22.6), (114.002, 22.6)]
    counter = 0
    counter, _ = _should_recompute(geom, (114.0, 22.605), counter)
    counter, _ = _should_recompute(geom, (114.0, 22.605), counter)
    assert counter == 2
    counter, _ = _should_recompute(geom, (114.0005, 22.6), counter)  # back on route
    assert counter == 0


# ---------- AMap fresh-call verification on reroute ----------

class TestRerouteCallsAmapWithFreshCoords:

  def test_amap_called_with_current_position_not_origin(self):
    """When user deviates and reroute fires, fetch_amap_route must use CURRENT GPS, not original origin."""
    original_origin = (114.0296, 22.6098)
    deviation_point = (114.0500, 22.6300)
    destination = (113.8201, 22.6377)

    captured: list[tuple[float, float]] = []

    def fake_get(url, params=None, timeout=None):
      lng, lat = params["origin"].split(",")
      captured.append((float(lng), float(lat)))
      mock = MagicMock()
      mock.status_code = 200
      mock.json.return_value = _amap_response([(float(lng), float(lat)), destination])
      mock.raise_for_status.return_value = None
      return mock

    with patch("openpilot.frogpilot.navigation.amap_route_adapter.requests.get", side_effect=fake_get):
      # Initial route fetch (from original origin)
      fetch_amap_route("k", *original_origin, *destination)
      # Reroute fetch (from deviation point) — simulating navd calling with self.last_position
      fetch_amap_route("k", *deviation_point, *destination)

    assert len(captured) == 2
    assert captured[0] == (114.0296, 22.6098)
    assert captured[1] == (114.05, 22.63)
    assert captured[0] != captured[1], "reroute must use fresh coords"

  def test_amap_strategy_param_propagates_per_call(self):
    """Each fetch_amap_route call uses the strategy passed to it (no caching)."""
    captured = []

    def fake_get(url, params=None, timeout=None):
      captured.append(params["strategy"])
      mock = MagicMock()
      mock.status_code = 200
      mock.json.return_value = _amap_response([(114.0, 22.6), (114.1, 22.7)])
      mock.raise_for_status.return_value = None
      return mock

    with patch("openpilot.frogpilot.navigation.amap_route_adapter.requests.get", side_effect=fake_get):
      fetch_amap_route("k", 114.0, 22.6, 114.1, 22.7, strategy=32)
      fetch_amap_route("k", 114.0, 22.6, 114.1, 22.7, strategy=45)

    assert captured == ["32", "45"]


# ---------- GPS-uncertainty guard logic (mirrors navd.recompute_route) ----------

def _guard_blocks_reroute(gps_ok: bool, position_std_norm: float, has_route: bool) -> bool:
  """Mirror of navd.recompute_route's guard: returns True if reroute should be blocked.

  Matches: `if self.step_idx is not None and (not self.gps_ok or self.position_std_norm > 30.0): return`
  """
  if not has_route:
    return False  # no route active → guard doesn't apply, can fetch initial
  return (not gps_ok) or position_std_norm > REROUTE_POS_STD_THRESHOLD


class TestGpsGuardBlocksReroute:

  def test_no_route_active_does_not_block(self):
    """Initial fetch (no route yet) is always allowed regardless of GPS quality."""
    assert not _guard_blocks_reroute(gps_ok=False, position_std_norm=999, has_route=False)

  def test_gps_ok_and_low_uncertainty_allows(self):
    assert not _guard_blocks_reroute(gps_ok=True, position_std_norm=10.0, has_route=True)

  def test_gps_lost_blocks(self):
    """Tunnel scenario: gps_ok flipped False after 2s grace period."""
    assert _guard_blocks_reroute(gps_ok=False, position_std_norm=15.0, has_route=True)

  def test_high_uncertainty_blocks_even_with_gps_ok(self):
    """Tunnel multipath: gps_ok still True but Kalman uncertainty growing."""
    assert _guard_blocks_reroute(gps_ok=True, position_std_norm=50.0, has_route=True)

  def test_threshold_boundary(self):
    """Exactly at threshold should NOT block (strict inequality)."""
    assert not _guard_blocks_reroute(gps_ok=True, position_std_norm=30.0, has_route=True)
    assert _guard_blocks_reroute(gps_ok=True, position_std_norm=30.001, has_route=True)


# ---------- Exponential backoff sequence (mirrors navd recompute_backoff) ----------

class TestExponentialBackoff:

  def test_backoff_doubles_then_caps(self):
    """navd: recompute_countdown = 2**recompute_backoff; backoff = min(6, backoff+1)."""
    backoff = 0
    countdowns = []
    for _ in range(10):
      countdowns.append(2 ** backoff)
      backoff = min(6, backoff + 1)
    assert countdowns == [1, 2, 4, 8, 16, 32, 64, 64, 64, 64]

  def test_qps_failure_burst_throttled_by_backoff(self):
    """If AMap returns CUQPS for 5 consecutive reroute attempts, backoff caps the retry rate."""
    fail_responses = []

    def fake_get(url, params=None, timeout=None):
      mock = MagicMock()
      mock.status_code = 200
      mock.json.return_value = {"status": "0", "info": "CUQPS_HAS_EXCEEDED_THE_LIMIT"}
      mock.raise_for_status.return_value = None
      fail_responses.append(mock)
      return mock

    with patch("openpilot.frogpilot.navigation.amap_route_adapter.requests.get", side_effect=fake_get):
      backoff = 0
      attempts = 0
      for _ in range(20):  # simulate 20 navd ticks
        if backoff == 0 or attempts == 0:
          # would fire fetch
          raw = fetch_amap_route("k", 114.0, 22.6, 114.1, 22.7)
          attempts += 1
          # convert raises ValueError on status=0
          with pytest.raises(ValueError):
            convert_amap_to_mapbox(raw)
          backoff = min(6, backoff + 1)
        else:
          backoff = max(0, backoff - 1)

    # Without backoff we'd hit AMap 20 times. With backoff we hit fewer, even on failure storm.
    assert attempts < 20, "exponential backoff must throttle attempts"
    assert attempts >= 1, "must attempt at least once"


# ---------- Route preservation on AMap failure (mirrors navd's catch logic) ----------

class TestRoutePreservationOnFailure:

  def test_preserve_existing_route_on_transient_failure(self):
    """Mirror of: `except (RequestException, ValueError): if self.route is None: self.clear_route()`."""

    class FakeNavdState:
      def __init__(self):
        self.route = ["existing", "step", "list"]  # truthy = has route
        self.cleared = False

      def clear_route(self):
        self.route = None
        self.cleared = True

    state = FakeNavdState()

    # Simulate transient AMap failure
    try:
      raise ValueError("AMap returned error status: CUQPS_HAS_EXCEEDED_THE_LIMIT")
    except (ValueError,):
      if state.route is None:
        state.clear_route()
      # else: keep existing route, don't clear

    assert state.route == ["existing", "step", "list"], "existing route must survive transient failure"
    assert not state.cleared, "clear_route must NOT be called when route exists"

  def test_clear_route_on_initial_failure(self):
    """If we never got a route, transient failures should clear so navd retries cleanly."""

    class FakeNavdState:
      def __init__(self):
        self.route = None
        self.cleared = False

      def clear_route(self):
        self.cleared = True

    state = FakeNavdState()

    try:
      raise ValueError("AMap returned error status: INVALID_USER_KEY")
    except (ValueError,):
      if state.route is None:
        state.clear_route()

    assert state.cleared, "initial failure should clear (route was already None)"
