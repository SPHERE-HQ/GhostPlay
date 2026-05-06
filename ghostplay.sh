#!/usr/bin/env bash
# GhostPlay wrapper — langsung jalan, Chromium sudah ter-install via Nix
# Penggunaan:
#   ./ghostplay.sh run scenarios/my-game.json --url http://localhost:5173
#   ./ghostplay.sh watch scenarios/my-game.ts --watch-dir src --watch-dir public
#   ./ghostplay.sh run scenarios/my-game.json --url http://localhost:5173 --json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec npx tsx "$SCRIPT_DIR/src/cli.ts" "$@"
