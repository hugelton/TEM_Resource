#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_DIR="$ROOT/cloudflare-public"

mkdir -p "$PUBLIC_DIR/css" "$PUBLIC_DIR/js"

cp "$ROOT"/index.html "$ROOT"/tem-full.html "$ROOT"/demo.html "$ROOT"/test.html "$ROOT"/README.md "$PUBLIC_DIR"/
cp "$ROOT"/css/*.css "$PUBLIC_DIR/css"/
cp "$ROOT"/js/*.js "$PUBLIC_DIR/js"/

cd "$ROOT"
wrangler deploy
