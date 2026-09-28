# Finance Tracker — Design Spec

Data: 2026-09-28

## Obiettivo

Webapp per tracciare le finanze di più "progetti" indipendenti (es. un
immobile, il portafoglio personale, ecc. — nomi ed esempi reali restano solo
dati inseriti a runtime, mai nel codice/README/commit). Login singolo utente,
dashboard con elenco progetti e saldo, dettaglio progetto con transazioni
(entrate/uscite datate, con nota e categoria libera) e due grafici di
andamento. Recap delle ultime transazioni al login.

Uso attuale: single-user. Il modello dati è comunque strutturato in modo da
non richiedere refactor se in futuro l'app venisse distribuita/pubblicata
(vedi "Multi-user readiness" sotto) — nessuna feature multi-user viene
costruita ora (YAGNI).

**Vincolo trasversale**: repo pubblico su GitHub → nessun riferimento
identificativo (nome utente, nome del Pi reale, nomi dei progetti personali)
in codice, README, commit, nomi di variabili/classi o commenti. Solo dati
inseriti dall'utente a runtime.

## Stack

Stesso stack di dashboard-raspi (repo gemello), per riuso di pattern ed
esperienza:

- **Backend**: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, SQLite
  (`DATABASE_URL`, compatibile Postgres se servisse in futuro), JWT auth.
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Recharts.
- **Orchestrazione**: Docker Compose (backend + frontend/Nginx reverse
  proxy), stesso pattern URL relativi `/api` (nessun rebuild per cambiare
  host).

## Modello dati

```
User
  id, username, password_hash, created_at

Project
  id, owner_id (FK User), name, created_at

Transaction
  id, project_id (FK Project), amount (Decimal, con segno: positivo=entrata,
    negativo=uscita), date, note, category (stringa libera, nullable),
    created_at
```

- **Saldo progetto**: `SUM(transaction.amount)` calcolato a query time
  (nessuna colonna denormalizzata da tenere sincronizzata — a scala
  single-user/pochi progetti un `SUM` diretto è trascurabile).
- **Categoria**: testo libero, nessuna tabella dedicata. Autocomplete lato
  frontend basato su `SELECT DISTINCT category FROM transactions WHERE
  project_id = ? AND category IS NOT NULL`.

### Multi-user readiness

`Project.owner_id` esiste fin da subito e ogni query è scoped
sull'utente autenticato, anche se oggi esiste un solo utente bootstrap.
Questo evita un refactor dello schema se in futuro si aggiungesse
registrazione multi-utente — ma **nessuna UI o logica di
registrazione/permessi condivisi viene costruita ora**.

## Backend — API

Tutte le route protette da JWT tranne `/auth/login` e `/health`, stesso
pattern di dashboard-raspi (`get_current_user`, bootstrap admin da env var
alla prima partenza, no registrazione pubblica).

| Metodo | Path | Descrizione |
|---|---|---|
| POST | `/auth/login` | Login, ritorna JWT |
| POST | `/auth/change-password` | Cambio password (verifica vecchia password) |
| GET | `/projects` | Elenco progetti dell'utente con saldo corrente |
| POST | `/projects` | Crea progetto |
| PATCH | `/projects/{id}` | Rinomina progetto |
| DELETE | `/projects/{id}` | Elimina progetto (e le sue transazioni, cascade) |
| GET | `/projects/{id}/transactions` | Lista transazioni, filtri opzionali `from_date`/`to_date`/`category`, paginata |
| POST | `/projects/{id}/transactions` | Crea transazione |
| PATCH | `/projects/{id}/transactions/{tx_id}` | Modifica transazione |
| DELETE | `/projects/{id}/transactions/{tx_id}` | Elimina transazione |
| GET | `/projects/{id}/summary` | Saldo corrente + serie dati per i due grafici (saldo cumulativo nel tempo, entrate/uscite aggregate per periodo) |
| GET | `/projects/{id}/categories/suggest` | Categorie distinte già usate nel progetto (autocomplete) |
| GET | `/dashboard/recent` | Ultime N transazioni aggregate su tutti i progetti dell'utente, con nome progetto |

Layer: `api/routes/` sottile → `services/` logica (calcolo saldo/summary,
validazione) → `models/` SQLAlchemy / `schemas/` Pydantic. Stesso pattern di
dashboard-raspi.

## Frontend

- Client HTTP unico tipizzato (`src/services/api.ts`), niente fetch diretti
  nei componenti. Hook dedicati in `src/hooks/` per fetch/stato
  (`useProjects`, `useTransactions`, `useProjectSummary`, `useRecent`).
- Niente state manager esterno — `useState`/hook bastano (bounded, stesso
  approccio di dashboard-raspi).

### Pagine

- **`/login`** — form utente/password.
- **`/` (dashboard)** — griglia progetti (nome + saldo corrente), pulsanti
  crea/rinomina/elimina progetto (modali stile `DeviceCreateModal`); sezione
  "Ultime transazioni" con le ultime N transazioni aggregate cross-progetto,
  etichettate col nome del progetto.
- **`/projects/:id`** — saldo in evidenza; due grafici Recharts (linea saldo
  cumulativo nel tempo, barre entrate/uscite per periodo); lista
  transazioni filtrabile per data/categoria con paginazione; form
  aggiungi/modifica/elimina transazione (importo, segno entrata/uscita,
  data, nota, categoria con autocomplete dalle categorie già usate nel
  progetto).

## Deploy

- **Target**: `raspi-gorghy`, raggiungibile via Tailscale.
- **Modalità**: Docker Compose (backend + frontend/Nginx), stesso pattern di
  dashboard-raspi. DB SQLite su volume persistente.
- **Auth bootstrap**: admin creato da env var (`ADMIN_USERNAME`,
  `ADMIN_PASSWORD` o hash) alla prima partenza.
- **CI/CD**: GitHub Actions, trigger **solo `workflow_dispatch`** (manuale),
  mai `push`/`pull_request` — il repo è pubblico, quindi un trigger
  automatico su push esporrebbe i secret Tailscale (OAuth client) a PR da
  fork potenzialmente ostili. Stesso pattern di dashboard-raspi: runner
  Linux che si unisce alla tailnet privata via `tailscale/github-action`
  (scope minimi, tag ACL ristretto alla porta 22 del Pi target), poi esegue
  uno script di deploy (`scripts/deploy.sh`, adattato da dashboard-raspi)
  con timeout differenziati e retry sui soli fallimenti di trasporto.
  Il deploy resta quindi "un click" da GitHub Actions dopo un merge, senza
  eseguirsi automaticamente.

## Testing

- **Backend**: pytest — modelli, CRUD progetti/transazioni, calcolo
  saldo/summary, auth (login, bootstrap admin, cambio password).
- **Frontend**: vitest — form transazione (validazione importo/data), lista
  transazioni (render + filtri), rendering dati nei grafici (smoke test su
  dati mock).
- Niente e2e per ora (YAGNI — si aggiunge se emergono regressioni non
  coperte da unit/component test).

## Fuori scope (per ora)

- Multi-user reale (registrazione, permessi condivisi tra utenti).
- Categorie strutturate/gestibili (CRUD categorie, solo testo libero +
  autocomplete).
- Multi-valuta (si assume EUR unico).
- Trigger di deploy automatico su push/merge.
