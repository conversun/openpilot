#!/usr/bin/env bash

# mazda-port (conversun fork) is built for Konik A1M hardware. Point athena and
# the API at the Konik fleet server (stable.konik.ai) instead of the commaai
# default (api.commadotai.com) so a fresh boot or factory reset registers with
# Konik out of the box, matching the device's pre-shipped configuration.
# https://konik.ai/stable/ (search for "Change settings")
export API_HOST=https://api.konik.ai/
export ATHENA_HOST=wss://athena.konik.ai

exec ./launch_chffrplus.sh
