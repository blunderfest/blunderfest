#!/usr/bin/env bash
# Sets up MCP servers for opencode in this project:
#   - Playwright (official Microsoft package) — browser automation for testing
#   - Stitch (third-party stitch-mcp) — UI design fetch, DISABLED by default
# Idempotent. Run from the project root:  bash setup-mcp.sh
set -e

echo "==> 1. Writing opencode.json (MCP server config)"
python3 - <<'EOF'
import json, os

path = 'opencode.json'
if os.path.exists(path):
    config = json.load(open(path))
else:
    config = {"$schema": "https://opencode.ai/config.json"}

mcp = config.setdefault('mcp', {})

mcp['playwright'] = {
    "type": "local",
    "command": ["pnpm", "dlx", "@playwright/mcp@latest"],
    "enabled": True,
}

# stitch-mcp is a third-party package that talks to Google Cloud on your
# behalf — enable it only after reviewing that tradeoff (see step 3 output).
stitch = mcp.setdefault('stitch', {
    "type": "local",
    "command": ["pnpm", "dlx", "stitch-mcp@latest"],
    "enabled": False,
    "environment": {"GOOGLE_CLOUD_PROJECT": "YOUR_PROJECT_ID"},
})

with open(path, 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')
print("    opencode.json written")
EOF

echo "==> 2. Installing the Playwright browser (chromium, user-level, no sudo)"
pnpm dlx playwright@latest install chromium

echo "==> 3. Smoke test: screenshot the live app"
if pnpm dlx playwright@latest screenshot --browser chromium https://blunderfest.fly.dev /tmp/blunderfest-smoke.png; then
  echo "    browser works — screenshot at /tmp/blunderfest-smoke.png"
else
  echo "    !! browser failed to launch. Install the system libraries (needs sudo):"
  echo "       sudo pacman -S --needed nss atk at-spi2-atk cups-libs libdrm libxkbcommon libxcomposite libxdamage libxrandr mesa pango alsa-lib"
fi

echo
echo "==> 4. Stitch MCP is configured but DISABLED (enabled: false in opencode.json)."
echo "    It is a third-party server that uses your Google Cloud credentials."
echo "    To enable it later:"
echo "      gcloud auth login"
echo "      gcloud config set project YOUR_PROJECT_ID"
echo "      gcloud beta services mcp enable stitch.googleapis.com"
echo "      gcloud auth application-default login"
echo "    then in opencode.json set mcp.stitch.enabled to true and fill in your project id."
echo
echo "==> Done. Quit and restart opencode to load the MCP servers."
