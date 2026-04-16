#!/usr/bin/env bash
# =============================================================================
# Unified Dev Launcher
# =============================================================================
# Starts the API server, Context Manager UI, and a target app in parallel.
#
# Usage:
#   npm run dev                                          # server + context-mgr + demo
#   npm run dev -- --app-dir "/path/to/project"          # server + context-mgr + project's next dev
#   npm run dev -- --context-root "/path/to/.contextual"  # override context root
#
# When --app-dir is provided:
#   - The context root defaults to <app-dir>/.contextual
#   - The target app's `npm run dev` replaces the built-in demo
# =============================================================================

set -euo pipefail

CONTEXT_ROOT="${CONTEXT_ROOT:-}"
APP_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --context-root)
      CONTEXT_ROOT="$2"
      shift 2
      ;;
    --app-dir)
      APP_DIR="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# If app-dir is set but context-root is not, default to <app-dir>/.contextual
if [[ -n "$APP_DIR" && -z "$CONTEXT_ROOT" ]]; then
  CONTEXT_ROOT="$APP_DIR/.contextual"
fi

# Build all Contextual packages first
npm run build

# Compose the server command
if [[ -n "$CONTEXT_ROOT" ]]; then
  SERVER_CMD="node packages/server/dist/cli.js serve --context-root \"$CONTEXT_ROOT\""
else
  SERVER_CMD="node packages/server/dist/cli.js serve"
fi

# Compose the app command: target app or built-in demo
if [[ -n "$APP_DIR" ]]; then
  APP_CMD="cd \"$APP_DIR\" && npm run dev"
  APP_LABEL="$(basename "$APP_DIR")"
  APP_NAME="app"
else
  APP_CMD="npm run dev --workspace=@contextualapp/demo"
  APP_LABEL="demo"
  APP_NAME="demo"
fi

# Build the pair command for display
if [[ -n "$CONTEXT_ROOT" ]]; then
  PAIR_CMD="contextual-server pair --context-root \"$CONTEXT_ROOT\""
else
  PAIR_CMD="contextual-server pair"
fi

# Print startup banner
echo ""
echo "  ┌─────────────────────────────────────────────────┐"
echo "  │  Contextual Dev                                 │"
echo "  │                                                 │"
echo "  │  API Server:       http://localhost:4700        │"
echo "  │  Context Manager:  http://localhost:5173        │"
printf "  │  %-16s   http://localhost:%-5s       │\n" "$APP_LABEL:" "3000+"
echo "  │                                                 │"
echo "  │  Press Ctrl+C to stop all services              │"
echo "  └─────────────────────────────────────────────────┘"
echo ""
echo "  To connect Claude Code:"
echo ""
echo "  1. Open a new Terminal.app tab"
echo "  2. Run:  $PAIR_CMD"
echo "  3. Run:  claude"
echo ""
echo "  Passes will be sent directly to that Claude Code session."
echo ""

exec npx concurrently -k \
  -n "server,context-mgr,$APP_NAME" \
  -c blue,green,magenta \
  "$SERVER_CMD" \
  "npm run dev:context-manager" \
  "$APP_CMD"
