#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-raspi-gorghy}"
REMOTE_USER="${REMOTE_USER:-pi}"
REMOTE_DIR="${REMOTE_DIR:-/opt/finance-tracker}"
SSH_KEY="${SSH_PRIVATE_KEY_PATH:-$HOME/.ssh/deploy_key}"
DRY_RUN="${DRY_RUN:-true}"

REMOTE_PROBE_TIMEOUT="${REMOTE_PROBE_TIMEOUT:-10}"
REMOTE_CMD_TIMEOUT="${REMOTE_CMD_TIMEOUT:-60}"
REMOTE_TRANSFER_TIMEOUT="${REMOTE_TRANSFER_TIMEOUT:-120}"
REMOTE_BUILD_TIMEOUT="${REMOTE_BUILD_TIMEOUT:-600}"
SSH_RETRY_COUNT="${SSH_RETRY_COUNT:-3}"
SSH_RETRY_DELAY="${SSH_RETRY_DELAY:-5}"

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o BatchMode=yes)

run_with_retry() {
  local timeout_s="$1"
  shift
  local attempt=1
  local exit_code
  while true; do
    # `timeout ... || exit_code=$?` (not `if timeout ...; then`) is
    # deliberate: capturing $? right after an `if` whose condition failed
    # and has no `else` always reads 0 (POSIX: an if that runs no branch
    # exits 0), which silently turned every failure into a false "success"
    # and skipped every retry. The `||` form keeps set -e from aborting on
    # the failing command while still reading its real exit code.
    exit_code=0
    timeout "$timeout_s" "$@" || exit_code=$?
    if [ "$exit_code" -eq 0 ]; then
      return 0
    fi
    if [[ "$exit_code" != 255 && "$exit_code" != 124 ]]; then
      return "$exit_code"
    fi
    if (( attempt >= SSH_RETRY_COUNT )); then
      return "$exit_code"
    fi
    echo "Tentativo $attempt fallito (exit $exit_code), retry tra ${SSH_RETRY_DELAY}s..." >&2
    sleep "$SSH_RETRY_DELAY"
    attempt=$((attempt + 1))
  done
}

main() {
  echo "Verifico raggiungibilita di $REMOTE_HOST..."
  run_with_retry "$REMOTE_PROBE_TIMEOUT" ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" true

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "Dry-run: nessuna modifica remota. Host raggiungibile, lo script termina qui."
    exit 0
  fi

  echo "Creo la directory remota se manca..."
  run_with_retry "$REMOTE_CMD_TIMEOUT" ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" \
    "mkdir -p $REMOTE_DIR"

  echo "Sincronizzo i file..."
  # --exclude ".env": the Pi keeps its own JWT_SECRET/ADMIN_PASSWORD in
  # /opt/finance-tracker/.env (created once, out of band); never let a
  # deployer's local dev .env overwrite it.
  run_with_retry "$REMOTE_TRANSFER_TIMEOUT" rsync -az -e "ssh ${SSH_OPTS[*]}" \
    --exclude ".git" --exclude "frontend/node_modules" --exclude "backend/.venv" \
    --exclude ".env" \
    ./ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

  echo "Riavvio i container..."
  run_with_retry "$REMOTE_BUILD_TIMEOUT" ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" \
    "cd $REMOTE_DIR && docker compose up --build -d"

  echo "Deploy completato."
}

# Guard so this file can be `source`d (e.g. by scripts/test_deploy_retry.sh)
# to reuse run_with_retry without running the real deploy.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
