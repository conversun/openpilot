"""Failure-scenario tests for the AMap adapter.

Verify that fetch_amap_route + convert_amap_to_mapbox handle the common AMap
error responses + network failures cleanly. These run offline (mocked via the
pytest-mock 'mocker' fixture) and are NOT gated by AMAP_WEB_KEY.
"""
from __future__ import annotations

import pytest
import requests

from openpilot.frogpilot.navigation.amap_route_adapter import (
  convert_amap_to_mapbox,
  fetch_amap_route,
)


# ---------- convert_amap_to_mapbox: AMap-side errors ----------

class TestAMapErrorStatuses:
  """AMap returns status=0 with various info codes; converter must raise ValueError."""

  @pytest.mark.parametrize("info,infocode", [
    ("INVALID_USER_KEY", "10001"),
    ("DAILY_QUERY_OVER_LIMIT", "10003"),
    ("ACCESS_TOO_FREQUENT", "10004"),
    ("CUQPS_HAS_EXCEEDED_THE_LIMIT", "10021"),
    ("USERKEY_PLAT_NOMATCH", "10009"),
    ("INVALID_USER_SCODE", "10005"),
    ("ENGINE_RESPONSE_DATA_ERROR", "20003"),
  ])
  def test_status_zero_raises_with_info(self, info, infocode):
    bad = {"status": "0", "info": info, "infocode": infocode}
    with pytest.raises(ValueError, match=info):
      convert_amap_to_mapbox(bad)

  def test_missing_status_and_info_treated_as_failure(self):
    bad: dict = {}
    with pytest.raises(ValueError, match="unknown"):
      convert_amap_to_mapbox(bad)

  def test_status_one_but_no_route_object(self):
    bad = {"status": "1", "info": "OK"}
    with pytest.raises(ValueError, match="no paths"):
      convert_amap_to_mapbox(bad)

  def test_status_one_empty_paths(self):
    bad = {"status": "1", "route": {"paths": []}}
    with pytest.raises(ValueError, match="no paths"):
      convert_amap_to_mapbox(bad)

  def test_status_one_paths_but_all_steps_have_no_geometry(self):
    """All steps without polyline → degenerate, must raise ValueError after filtering."""
    bad = {
      "status": "1",
      "route": {
        "paths": [{
          "distance": "100",
          "cost": {"duration": "10"},
          "steps": [
            {"instruction": "no polyline", "step_distance": "100", "navi": {"action": "直行"}},
          ],
        }],
      },
    }
    with pytest.raises(ValueError, match="no usable steps"):
      convert_amap_to_mapbox(bad)


# ---------- fetch_amap_route: network/HTTP errors ----------

class TestNetworkErrors:
  """Verify requests-level failures propagate as RequestException, not silent corruption."""

  def test_connection_error_propagates(self, mocker):
    mock_get = mocker.patch("openpilot.frogpilot.navigation.amap_route_adapter.requests.get")
    mock_get.side_effect = requests.exceptions.ConnectionError("DNS failed")
    with pytest.raises(requests.exceptions.ConnectionError):
      fetch_amap_route("key", 113.8, 22.6, 114.0, 22.6)

  def test_timeout_propagates(self, mocker):
    mock_get = mocker.patch("openpilot.frogpilot.navigation.amap_route_adapter.requests.get")
    mock_get.side_effect = requests.exceptions.Timeout("timeout")
    with pytest.raises(requests.exceptions.Timeout):
      fetch_amap_route("key", 113.8, 22.6, 114.0, 22.6)

  def test_http_500_raises_for_status(self, mocker):
    """Non-200 from AMap must propagate raise_for_status; cloudlog import is best-effort."""
    fake_cloudlog = mocker.MagicMock()
    mock_get = mocker.patch("openpilot.frogpilot.navigation.amap_route_adapter.requests.get")
    mocker.patch.dict("sys.modules", {"openpilot.common.swaglog": mocker.MagicMock(cloudlog=fake_cloudlog)})
    mock_resp = mocker.MagicMock()
    mock_resp.status_code = 500
    mock_resp.text = "Internal Server Error"
    mock_resp.raise_for_status.side_effect = requests.exceptions.HTTPError("500")
    mock_get.return_value = mock_resp
    with pytest.raises(requests.exceptions.HTTPError):
      fetch_amap_route("key", 113.8, 22.6, 114.0, 22.6)
    fake_cloudlog.event.assert_called_once()

  def test_http_200_with_amap_error_returns_dict(self, mocker):
    """200 OK with status=0 must NOT raise here — caller (convert) decides."""
    mock_get = mocker.patch("openpilot.frogpilot.navigation.amap_route_adapter.requests.get")
    mock_resp = mocker.MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"status": "0", "info": "INVALID_USER_KEY"}
    mock_resp.text = "{...}"
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp
    result = fetch_amap_route("bad_key", 113.8, 22.6, 114.0, 22.6)
    assert result == {"status": "0", "info": "INVALID_USER_KEY"}


# ---------- fetch_amap_route: query-string correctness ----------

class TestQueryConstruction:
  """Mock requests to inspect what we send, ensures no regressions when adding params."""

  def _intercept(self, mocker):
    captured = {}
    def fake_get(url, params=None, timeout=None):
      captured["url"] = url
      captured["params"] = params
      captured["timeout"] = timeout
      mock = mocker.MagicMock()
      mock.status_code = 200
      mock.json.return_value = {"status": "1", "route": {"paths": [{"distance": "0", "steps": []}]}}
      mock.raise_for_status.return_value = None
      return mock
    mocker.patch("openpilot.frogpilot.navigation.amap_route_adapter.requests.get", side_effect=fake_get)
    return captured

  def test_default_strategy_is_32(self, mocker):
    captured = self._intercept(mocker)
    fetch_amap_route("k", 113.8, 22.6, 114.0, 22.6)
    assert captured["params"]["strategy"] == "32"

  def test_strategy_45_passes_through(self, mocker):
    captured = self._intercept(mocker)
    fetch_amap_route("k", 113.8, 22.6, 114.0, 22.6, strategy=45)
    assert captured["params"]["strategy"] == "45"

  def test_coordsys_gps_when_wgs84(self, mocker):
    captured = self._intercept(mocker)
    fetch_amap_route("k", 113.8, 22.6, 114.0, 22.6, origin_is_wgs84=True)
    assert captured["params"]["coordsys"] == "gps"

  def test_coordsys_autonavi_when_gcj02(self, mocker):
    captured = self._intercept(mocker)
    fetch_amap_route("k", 113.8, 22.6, 114.0, 22.6, origin_is_wgs84=False)
    assert captured["params"]["coordsys"] == "autonavi"

  def test_show_fields_includes_polyline(self, mocker):
    """Per official v5 doc, polyline gives step-level coords. Ensure we request it."""
    captured = self._intercept(mocker)
    fetch_amap_route("k", 113.8, 22.6, 114.0, 22.6)
    fields = captured["params"]["show_fields"].split(",")
    assert "polyline" in fields
    assert "navi" in fields
    assert "tmcs" in fields
    assert "cost" in fields

  def test_waypoints_serialized_correctly(self, mocker):
    captured = self._intercept(mocker)
    fetch_amap_route(
      "k", 113.8, 22.6, 114.0, 22.6,
      waypoints=[(113.9, 22.65), (113.95, 22.62)],
    )
    assert captured["params"]["waypoints"] == "113.900000,22.650000;113.950000,22.620000"

  def test_no_waypoints_param_when_empty(self, mocker):
    captured = self._intercept(mocker)
    fetch_amap_route("k", 113.8, 22.6, 114.0, 22.6)
    assert "waypoints" not in captured["params"]

  def test_origin_destination_six_decimal_precision(self, mocker):
    """AMap rejects origin/destination with > 6 decimal places."""
    captured = self._intercept(mocker)
    fetch_amap_route("k", 113.8123456789, 22.6987654321, 114.0, 22.6)
    assert captured["params"]["origin"] == "113.812346,22.698765"

  def test_timeout_default_10s(self, mocker):
    captured = self._intercept(mocker)
    fetch_amap_route("k", 113.8, 22.6, 114.0, 22.6)
    assert captured["timeout"] == 10
