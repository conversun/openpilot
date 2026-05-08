#!/usr/bin/env python3
"""mapd bridge daemon — translates FrogPilot UI param writes into mapd v2 cereal messages.

Background:
  FrogPilot UI writes JSON like {"nations":["CN"], "states":["JS","SH"]} to the
  OSMDownloadLocations param. mapd v1.x read that param directly and shipped
  US-states-only data. mapd v2.x switched to a cereal `mapdIn.download` interface
  with dot-delimited paths like "nation.CN" or "cn_province.JS".

  This daemon bridges the two formats, and (cn-mazda fork specific) remaps the
  legacy "states" JSON key to "cn_province.*" lookups against our custom
  /data/openpilot/mapd_download_menu.json which defines 34 Chinese provinces.

Lifecycle:
  - Started by manager.py via system/manager/process_config.py (PythonProcess).
  - Polls OSMDownloadLocations once per second; on change publishes mapdIn cereal
    (download or cancel).
  - Subscribes to mapdExtendedOut and mirrors progress into OSMDownloadProgress
    so the existing FrogPilot maps panel (which still parses the v1 JSON shape)
    keeps reporting accurate progress.

Reliability:
  - PubMaster needs a moment to establish its zmq sockets; if we publish before
    that, the message is dropped silently. We sleep after construction.
  - mapd v2.0.6 occasionally deadlocks after a cancel→retrigger sequence: the
    daemon reports active=True but never opens a TCP connection. We watchdog
    each pending publish, retry once at +5s, and pkill mapd at +30s so manager
    can respawn it fresh.
"""
import json
import os
import time

import cereal.messaging as messaging

from openpilot.common.params import Params

# Construct params_memory locally instead of `from frogpilot_variables import params_memory`.
# That import path triggers a circular dependency (frogpilot_variables -> car_helpers ->
# sentry -> frogpilot_variables) when this module is loaded as a fresh PythonProcess by
# manager.py, crashing the daemon at startup so manager never respawns it.
params_memory = Params("/dev/shm/params")

POLL_INTERVAL_S = 1.0
PUBMASTER_SETTLE_S = 1.0          # let zmq sockets bind before first publish
RETRY_AFTER_S = 5.0               # republish if mapd hasn't acknowledged
KILL_AFTER_S = 30.0               # pkill mapd if it's still ignoring us
PKILL_RECOVERY_S = 8.0             # grace period for manager to respawn mapd
MAPD_BINARY_PATH = "/data/media/0/osm/mapd"


def build_paths(selection: dict) -> list[str]:
  """Map MapsSelected JSON to mapd v2 dot-delimited paths.

  Whole-country selections become "nation.<ISO2>". The cn-mazda fork repurposes
  the legacy "states" key (originally for US states) to carry Chinese province
  codes that resolve under cn_province in our custom download menu.
  """
  paths: list[str] = []
  for code in selection.get("nations") or []:
    if isinstance(code, str) and code:
      paths.append(f"nation.{code}")
  for code in selection.get("states") or []:
    if isinstance(code, str) and code:
      paths.append(f"cn_province.{code}")
  return paths


def publish_download(pm: messaging.PubMaster, paths: list[str]) -> None:
  msg = messaging.new_message("mapdIn", valid=True)
  msg.mapdIn.type = "download"
  msg.mapdIn.str = ",".join(paths)
  pm.send("mapdIn", msg)


def publish_cancel(pm: messaging.PubMaster) -> None:
  msg = messaging.new_message("mapdIn", valid=True)
  msg.mapdIn.type = "cancelDownload"
  pm.send("mapdIn", msg)


def progress_to_v1_json(extended_out) -> str:
  """Render a mapdExtendedOut.downloadProgress capnp message in the v1 JSON shape
  that maps_settings.cc parses (regex on total_files / downloaded_files).
  """
  dp = extended_out.downloadProgress
  payload = {
    "total_files": int(dp.totalFiles),
    "downloaded_files": int(dp.downloadedFiles),
    "locations_to_download": [str(loc) for loc in dp.locations],
    "location_details": {
      str(d.location): {
        "location_total_files": int(d.totalFiles),
        "location_downloaded_files": int(d.downloadedFiles),
      }
      for d in dp.locationDetails
    },
  }
  return json.dumps(payload, separators=(",", ":"))


def kill_mapd_binary() -> bool:
  """pkill -9 the mapd binary so manager respawns it fresh. Returns True on success."""
  rc = os.system(f"sudo pkill -9 -f {MAPD_BINARY_PATH} >/dev/null 2>&1")
  return rc == 0


def main() -> None:
  pm = messaging.PubMaster(["mapdIn"])
  sm = messaging.SubMaster(["mapdExtendedOut"])
  params_persistent = Params()
  # Let zmq sockets settle before the first publish; otherwise the boot-time
  # OSMDownloadLocations write race can drop our very first mapdIn message.
  time.sleep(PUBMASTER_SETTLE_S)

  last_locations: str | None = None
  last_progress_payload: str | None = None
  last_progress_active: bool = False

  # Watchdog state for in-flight downloads.
  pending_paths: list[str] | None = None
  pending_publish_time: float = 0.0
  pending_retried: bool = False

  while True:
    now = time.monotonic()

    # ------------------------------------------------------------------
    # 1) Translate UI param writes into mapdIn cereal commands.
    # ------------------------------------------------------------------
    try:
      raw = params_memory.get("OSMDownloadLocations", encoding="utf-8")
    except Exception as exc:
      print(f"mapd_bridge: failed to read OSMDownloadLocations: {exc}")
      raw = None

    if raw and raw != last_locations:
      try:
        selection = json.loads(raw)
      except (json.JSONDecodeError, TypeError) as exc:
        print(f"mapd_bridge: malformed OSMDownloadLocations {raw!r}: {exc}")
        time.sleep(POLL_INTERVAL_S)
        continue

      paths = build_paths(selection)
      if paths:
        try:
          publish_download(pm, paths)
          print(f"mapd_bridge: requested download path={','.join(paths)}")
          pending_paths = paths
          pending_publish_time = now
          pending_retried = False
        except Exception as exc:
          print(f"mapd_bridge: publish_download failed: {exc}")
      else:
        # Empty selection — nothing to do; clear any pending watchdog state.
        pending_paths = None
      last_locations = raw

    elif not raw and last_locations:
      try:
        publish_cancel(pm)
        print("mapd_bridge: requested cancelDownload")
      except Exception as exc:
        print(f"mapd_bridge: publish_cancel failed: {exc}")
      last_locations = None
      pending_paths = None
      pending_publish_time = 0.0
      pending_retried = False

    # ------------------------------------------------------------------
    # 2) Drain mapdExtendedOut and mirror progress to OSMDownloadProgress.
    # ------------------------------------------------------------------
    sm.update(0)
    mapd_locations: list[str] = []
    mapd_total_files = 0
    if sm.updated.get("mapdExtendedOut"):
      ext = sm["mapdExtendedOut"]
      mapd_locations = [str(loc) for loc in ext.downloadProgress.locations]
      mapd_total_files = int(ext.downloadProgress.totalFiles)
      try:
        payload = progress_to_v1_json(ext)
      except Exception as exc:
        print(f"mapd_bridge: progress_to_v1_json failed: {exc}")
        payload = None

      if payload is not None and payload != last_progress_payload:
        try:
          params_persistent.put("OSMDownloadProgress", payload)
        except Exception as exc:
          print(f"mapd_bridge: OSMDownloadProgress put failed: {exc}")
        last_progress_payload = payload

      active = bool(ext.downloadProgress.active)
      if last_progress_active and not active:
        # Download transitioned to inactive (completed or cancelled). Clear the
        # progress param so the UI returns to the default "DOWNLOAD" state.
        try:
          params_persistent.remove("OSMDownloadProgress")
          last_progress_payload = None
        except Exception as exc:
          print(f"mapd_bridge: OSMDownloadProgress remove failed: {exc}")
      last_progress_active = active

    # ------------------------------------------------------------------
    # 3) Watchdog: ensure mapd actually picked up our download request.
    # ------------------------------------------------------------------
    if pending_paths:
      wanted = set(pending_paths)
      acknowledged = bool(set(mapd_locations) & wanted) or mapd_total_files > 0
      elapsed = now - pending_publish_time

      if acknowledged:
        pending_paths = None
        pending_publish_time = 0.0
        pending_retried = False
      elif elapsed >= RETRY_AFTER_S and not pending_retried:
        try:
          publish_download(pm, pending_paths)
          print(f"mapd_bridge: watchdog republish after {elapsed:.1f}s no-ack")
          pending_retried = True
        except Exception as exc:
          print(f"mapd_bridge: watchdog republish failed: {exc}")
      elif elapsed >= KILL_AFTER_S:
        # mapd is stuck (likely the v2.0.6 cancel→retrigger deadlock). pkill the
        # binary so manager respawns it fresh, then republish on next iteration.
        print(f"mapd_bridge: watchdog kill mapd after {elapsed:.1f}s no-ack")
        kill_mapd_binary()
        # Push the next retry beyond the recovery window.
        pending_publish_time = now + PKILL_RECOVERY_S - RETRY_AFTER_S
        pending_retried = False

    time.sleep(POLL_INTERVAL_S)


if __name__ == "__main__":
  main()
