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
  while true; do
    if timeout "$timeout_s" "$@"; then
      return 0
    fi
    local exit_code=$?
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
run_with_retry "$REMOTE_TRANSFER_TIMEOUT" rsync -az -e "ssh ${SSH_OPTS[*]}" \
  --exclude ".git" --exclude "frontend/node_modules" --exclude "backend/.venv" \
  ./ "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

echo "Riavvio i container..."
run_with_retry "$REMOTE_BUILD_TIMEOUT" ssh "${SSH_OPTS[@]}" "$REMOTE_USER@$REMOTE_HOST" \
  "cd $REMOTE_DIR && docker compose up --build -d"

echo "Deploy completato."
