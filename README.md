# Finance Tracker

Webapp per tenere sotto controllo le finanze di più progetti indipendenti
(es. un immobile, il portafoglio personale). Login singolo utente, saldo e
andamento per progetto, recap delle ultime transazioni al login.

## Stack

Backend FastAPI + SQLAlchemy 2.0 + SQLite, JWT auth. Frontend React 18 +
Vite + TypeScript + Tailwind CSS + Recharts. Orchestrazione con Docker
Compose.

## Sviluppo locale

### Backend

```bash
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows; su Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
pytest            # tutti i test
pytest -k nome     # match per nome
```

### Frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:5173, proxy /api -> :8000
npm run build        # type check + build
npm run test          # vitest
```

Al primo avvio del backend viene creato un utente admin da
`ADMIN_USERNAME`/`ADMIN_PASSWORD` (default `admin`/`admin` in locale).

## Docker

```bash
cp .env.example .env   # imposta JWT_SECRET e ADMIN_PASSWORD
docker compose up --build
```

Frontend su `:8080` (proxy verso il backend su `/api`).

## Deploy

Deploy su un Raspberry Pi raggiungibile via Tailscale, tramite
`scripts/deploy.sh` (rsync + `docker compose up --build -d`, con timeout
differenziati e retry sui soli fallimenti di trasporto — variabili in
`deploy/deploy.env.example`).

Il workflow GitHub Actions (`.github/workflows/deploy.yml`) esegue lo
stesso script da un runner che si unisce alla tailnet privata con
`tailscale/github-action`. Il trigger è **solo manuale**
(`workflow_dispatch`, con `dry_run` di default) — il repo è pubblico,
quindi il deploy non parte mai automaticamente da un push o da una PR.

Secret richiesti nel repo GitHub: `TS_OAUTH_CLIENT_ID`,
`TS_OAUTH_CLIENT_SECRET` (scope minimi, tag `tag:ci-deploy` con ACL
ristretta alla porta 22 dell'host target), `DEPLOY_SSH_USER`,
`DEPLOY_SSH_PRIVATE_KEY`.

**Prima del primo deploy reale**, sul Pi va creato manualmente
`/opt/finance-tracker/.env` (stesso contenuto di `.env.example`, con
`JWT_SECRET`/`ADMIN_PASSWORD` reali) — `deploy.sh` sincronizza il resto
del repo ma esclude deliberatamente `.env` per non rischiare di
sovrascrivere quello del Pi con un `.env` di sviluppo locale. Senza
questo file `docker compose up` sul Pi fallisce (le variabili sono
obbligatorie in `docker-compose.yml`).
