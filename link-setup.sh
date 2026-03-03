#!/bin/bash
# Sets up @stack/core via npm link for local development
# Run this on a new machine after cloning the infra repo

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECTS_DIR="$HOME/projects/active"

echo "=== @stack/core link setup ==="

# Build and register globally
cd "$SCRIPT_DIR"
echo "Building @stack/core..."
npm install
npm run build
npm link
echo "✓ @stack/core registered globally"

# Link in all consuming projects
if [ -d "$PROJECTS_DIR" ]; then
  for project in "$PROJECTS_DIR"/*/; do
    if [ -f "$project/package.json" ] && grep -q '"@stack/core"' "$project/package.json" 2>/dev/null; then
      cd "$project"
      npm link @stack/core
      echo "✓ Linked in $(basename "$project")"
    fi
  done
fi

echo ""
echo "Done! @stack/core is linked in all consuming projects."
echo "Run 'npm run dev' in stack-core to watch for changes."
