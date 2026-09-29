#!/usr/bin/env bash
# Minimal self-check for run_with_retry() in deploy.sh. Not a framework —
# just enough to pin the retry/exit-code contract so a future edit can't
# silently reintroduce the "if-with-no-else always reads $?=0" bug.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy.sh"

fail=0

if ! SSH_RETRY_COUNT=3 SSH_RETRY_DELAY=0 run_with_retry 1 true; then
  echo "FAIL: run_with_retry returned nonzero for a succeeding command"
  fail=1
fi

if SSH_RETRY_COUNT=3 SSH_RETRY_DELAY=0 run_with_retry 1 false; then
  echo "FAIL: run_with_retry returned 0 for a permanently-failing (exit 1) command"
  fail=1
fi

counter_file=$(mktemp)
echo 0 > "$counter_file"
script_file=$(mktemp)
cat > "$script_file" <<EOF
#!/usr/bin/env bash
n=\$(cat "$counter_file")
echo "\$((n + 1))" > "$counter_file"
exit 255
EOF
chmod +x "$script_file"

if SSH_RETRY_COUNT=3 SSH_RETRY_DELAY=0 run_with_retry 1 "$script_file" 2>/dev/null; then
  echo "FAIL: run_with_retry returned 0 for a permanent transport failure (exit 255)"
  fail=1
fi
attempts=$(cat "$counter_file")
if [ "$attempts" -ne 3 ]; then
  echo "FAIL: expected 3 attempts for a transport failure, got $attempts"
  fail=1
fi
rm -f "$counter_file" "$script_file"

if [ "$fail" -eq 0 ]; then
  echo "OK: run_with_retry self-check passed"
fi
exit "$fail"
