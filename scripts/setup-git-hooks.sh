#!/bin/bash
# Install pre-commit hook that runs build + Python syntax check before each commit.
# Usage: bash scripts/setup-git-hooks.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_FILE="$REPO_ROOT/.git/hooks/pre-commit"

mkdir -p "$REPO_ROOT/.git/hooks"

cat > "$HOOK_FILE" << 'HOOK_EOF'
#!/bin/bash
# Pre-commit hook: build + Python syntax check
# Installed by scripts/setup-git-hooks.sh — re-run after cloning.
set -e

echo ""
echo "=== Pre-commit: Build check (tsc + vite) ==="
npm run build

echo ""
echo "=== Pre-commit: Python syntax check ==="
python -m compileall backend/ -q || {
    echo ""
    echo "ERROR: Python syntax errors found (see above)."
    echo "Fix syntax errors before committing."
    exit 1
}

echo ""
echo "Pre-commit checks passed."
HOOK_EOF

chmod +x "$HOOK_FILE"
echo "Pre-commit hook installed to $HOOK_FILE"
