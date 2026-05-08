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
  - Subscribes to mapdExtendedOut from the v2 binary and mirrors its progress info
    back into the OSMDownloadProgress param so the existing FrogPilot maps panel,
    which still parses the v1 JSON format, keeps reporting accurate progress.
"""
import json
import time

import cereal.messaging as messaging

from openpilot.common.params import Params
from openpilot.frogpilot.common.frogpilot_variables import params_memory

POLL_INTERVAL_S = 1.0


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


def main() -> None:
  pm = messaging.PubMaster(["mapdIn"])
  sm = messaging.SubMaster(["mapdExtendedOut"])
  params_persistent = Params()
  last_locations: str | None = None
  last_progress_payload: str | None = None
  last_progress_active: bool = False

  while True:
    # 1) Translate UI param writes into mapdIn cereal commands.
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
        except Exception as exc:
          print(f"mapd_bridge: publish_download failed: {exc}")
      last_locations = raw

    elif not raw and last_locations:
      try:
        publish_cancel(pm)
        print("mapd_bridge: requested cancelDownload")
      except Exception as exc:
        print(f"mapd_bridge: publish_cancel failed: {exc}")
      last_locations = None

    # 2) Mirror v2's mapdExtendedOut progress back into OSMDownloadProgress
    #    so the v1-era UI keeps working without changes.
    sm.update(0)
    if sm.updated.get("mapdExtendedOut"):
      ext = sm["mapdExtendedOut"]
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
        # Download just transitioned to inactive (completed or cancelled). Clear the
        # progress param so the UI returns to the default "DOWNLOAD" state, matching
        # v1's old behavior of removing OSMDownloadProgress on completion.
        try:
          params_persistent.remove("OSMDownloadProgress")
          last_progress_payload = None
        except Exception as exc:
          print(f"mapd_bridge: OSMDownloadProgress remove failed: {exc}")
      last_progress_active = active

    time.sleep(POLL_INTERVAL_S)


if __name__ == "__main__":
  main()
