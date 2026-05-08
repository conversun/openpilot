#!/usr/bin/env python3
# PFEIFER - MAPD - Modified by FrogAi for FrogPilot
import json
import os
import shutil
import stat
import subprocess
import tempfile
import time
import urllib.request

from pathlib import Path

from openpilot.frogpilot.common.frogpilot_utilities import is_url_pingable
from openpilot.frogpilot.common.frogpilot_variables import MAPD_PATH, RESOURCES_REPO, params_memory

VERSION = "v2"

# cn-mazda fork override: upstream FrogAi/FrogPilot-Resources/Versions/mapd_version_v2.json
# is stale (still pins v1.12.0) so devices never auto-upgrade past the v1 era. We hard-pin
# the v2 binary release we have validated against our custom mapd_download_menu.json.
# Bump this in lockstep with menu schema changes after re-testing on a device.
MAPD_VERSION_OVERRIDE = "v2.0.6"

GITHUB_VERSION_URL = f"https://github.com/{RESOURCES_REPO}/raw/Versions/mapd_version_{VERSION}.json"
GITLAB_VERSION_URL = f"https://gitlab.com/{RESOURCES_REPO}/-/raw/Versions/mapd_version_{VERSION}.json"

VERSION_PATH = Path("/data/media/0/osm/mapd_version")

# cn-mazda fork: ship a custom download menu (Chinese provinces) and deploy it where
# the mapd v2 binary picks up overrides at startup.
MENU_SOURCE_PATH = Path(__file__).resolve().parent / "mapd_download_menu.json"
MENU_DEPLOY_PATH = Path("/data/openpilot/mapd_download_menu.json")

def cleanup_temp_files():
  parent = MAPD_PATH.parent
  try:
    if not parent.exists() or not parent.is_dir():
      return
  except OSError as e:
    print(f"Skipping cleanup; cannot access {parent}: {e}")
    return
  try:
    for file in parent.glob("mapd*"):
      if file == MAPD_PATH or file == VERSION_PATH:
        continue
      if file.is_file():
        try:
          file.unlink()
        except Exception as exception:
          print(f"Failed to delete leftover file {file}: {exception}")
  except OSError as exception:
    print(f"Skipping cleanup in {parent} due to I/O error: {exception}")

def deploy_download_menu():
  # cn-mazda fork: copy our custom menu (Chinese provinces) into the location
  # the mapd v2 binary checks at startup. Idempotent — only writes if content changed.
  if not MENU_SOURCE_PATH.is_file():
    print(f"Menu source missing at {MENU_SOURCE_PATH}; skipping deploy")
    return
  try:
    MENU_DEPLOY_PATH.parent.mkdir(parents=True, exist_ok=True)
    desired = MENU_SOURCE_PATH.read_bytes()
    if MENU_DEPLOY_PATH.is_file() and MENU_DEPLOY_PATH.read_bytes() == desired:
      return
    tmp = MENU_DEPLOY_PATH.with_suffix(MENU_DEPLOY_PATH.suffix + ".tmp")
    tmp.write_bytes(desired)
    os.replace(tmp, MENU_DEPLOY_PATH)
    print(f"Deployed mapd_download_menu.json -> {MENU_DEPLOY_PATH}")
  except Exception as exception:
    print(f"Failed to deploy mapd download menu: {exception}")

def download():
  Path(MAPD_PATH).parent.mkdir(parents=True, exist_ok=True)

  while not (is_url_pingable("https://github.com") or is_url_pingable("https://gitlab.com")):
    time.sleep(60)

  latest_version = get_latest_version()
  urls = [
    f"https://github.com/pfeiferj/openpilot-mapd/releases/download/{latest_version}/mapd",
    f"https://gitlab.com/{RESOURCES_REPO}/-/raw/Mapd/{latest_version}"
  ]
  for url in urls:
    try:
      with urllib.request.urlopen(url) as response:
        with tempfile.NamedTemporaryFile("wb", delete=False, dir=MAPD_PATH.parent) as temp_file:
          shutil.copyfileobj(response, temp_file)
          temp_file_path = Path(temp_file.name)
          os.fsync(temp_file.fileno())

      os.chmod(temp_file_path, os.stat(temp_file_path).st_mode | stat.S_IEXEC)
      os.rename(temp_file_path, MAPD_PATH)

      with open(VERSION_PATH, "w") as version_file:
        version_file.write(latest_version)
        os.fsync(version_file.fileno())

      return
    except Exception as exception:
      print(f"Failed to download mapd from {url}: {exception}")
      if "temp_file_path" in locals() and temp_file_path.exists():
        temp_file_path.unlink(missing_ok=True)

def get_latest_version():
  # cn-mazda fork: ignore the upstream version JSON (it pins v1.12.0 indefinitely)
  # and return our hard-coded v2 release. Kept the URL constants for future re-enablement.
  if MAPD_VERSION_OVERRIDE:
    return MAPD_VERSION_OVERRIDE

  while not (is_url_pingable("https://github.com") or is_url_pingable("https://gitlab.com")):
    time.sleep(60)

  for url in [GITHUB_VERSION_URL, GITLAB_VERSION_URL]:
    try:
      with urllib.request.urlopen(url, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))["version"]
    except Exception as exception:
      print(f"Error fetching mapd version from {url}: {exception}")
  return "v0"

def update_mapd():
  if not MAPD_PATH.exists():
    print(f"{MAPD_PATH} not found. Downloading...")
    download()
    return False

  if not VERSION_PATH.exists():
    print(f"{VERSION_PATH} not found. Downloading mapd...")
    download()
    return False

  if is_url_pingable("https://github.com") or is_url_pingable("https://gitlab.com"):
    try:
      with open(VERSION_PATH) as version_file:
        local_version = version_file.read().strip()
      if local_version != get_latest_version():
        print("New mapd version available. Updating...")
        download()
        return False
      else:
        return True
    except Exception as exception:
      print(f"Error checking version: {exception}")
      return False

  if not os.access(MAPD_PATH, os.X_OK):
    print(f"{MAPD_PATH} is not executable. Fixing permissions...")
    try:
      os.chmod(MAPD_PATH, os.stat(MAPD_PATH).st_mode | stat.S_IEXEC)
    except Exception as exception:
      print(f"Failed to set executable permissions on {MAPD_PATH}: {exception}")
    return False

  return True

def mapd_thread():
  while True:
    try:
      cleanup_temp_files()
    except OSError as exception:
      print(f"Cleanup errored: {exception}")
      time.sleep(5)
      continue

    while not update_mapd():
      time.sleep(60)
      continue

    try:
      deploy_download_menu()
    except Exception as exception:
      print(f"deploy_download_menu errored: {exception}")

    try:
      process = subprocess.Popen(str(MAPD_PATH))
      process.wait()
    except FileNotFoundError as error:
      print(f"Subprocess failed: {error}")
      download()

def main():
  params_memory.put("MapdLogLevel", "disabled")

  mapd_thread()

if __name__ == "__main__":
  main()
