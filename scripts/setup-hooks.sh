#!/bin/sh

# setup-hooks.sh: Installs git hooks for the Japanese study repository
set -e

HOOK_DIR=".git/hooks"
PRE_COMMIT="$HOOK_DIR/pre-commit"

if [ ! -d ".git" ]; then
  echo "❌ Error: This script must be run from the root of a git repository."
  exit 1
fi

echo "Installing pre-commit hook..."

cat << 'EOF' > "$PRE_COMMIT"
#!/bin/sh

# Japanese Hub pre-commit hook to automate compilation and instrumentation.
set -e

# 1. Verify Bun is installed
if ! command -v bun >/dev/null 2>&1; then
  echo "⚠️  [Pre-Commit Hook] Bun is not installed or not found in PATH."
  echo "Please install Bun (https://bun.sh) to compile lessons."
  exit 1
fi

echo "🚀 [Pre-Commit Hook] Rebuilding index and auto-instrumenting lessons..."

# 2. Run the compiler
bun run build-index.ts

# 3. Stage changes made to lesson files automatically
git add lessons/*.html

echo "✅ [Pre-Commit Hook] Successfully rebuilt dashboard and staged instrumented lessons."
exit 0
EOF

chmod +x "$PRE_COMMIT"

echo "✅ Git pre-commit hook installed successfully!"
