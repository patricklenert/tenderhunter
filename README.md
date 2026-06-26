# Tenderhunter (Next.js Basis-Version)

Diese Version setzt Tenderhunter bewusst mit moeglichst wenig Technologie um, jetzt voll in Next.js statt Python.

## Was die App kann

- Ausschreibungen entdecken (Crawler) oder manuell erfassen
- Dokumente lokal speichern und Text aus PDF/HTML extrahieren
- Inhalte in entscheidungsrelevante Felder strukturieren
- Pro Firmenprofil Scores berechnen (Fit, Gewinnchance, Aufwand, Kill-Switch)
- Erklaerungen, naechste Schritte und fehlende Unterlagen erzeugen
- Tracking-Ereignisse fuer Attribution speichern

## Stack

- Next.js App Router + TypeScript
- SQLite (`better-sqlite3`)
- Lokaler Dateispeicher (`data/object_store`)
- Einfache Job-Queue in SQLite + Worker-Script

## Schnellstart

1) Abhaengigkeiten installieren

```bash
npm install
```

2) Next.js starten

```bash
npm run dev
```

3) Worker starten (zweites Terminal)

```bash
npm run worker
```

Die App ist danach unter `http://localhost:3000` erreichbar.

## Typischer Ablauf

1. Firmenprofil anlegen: `POST /api/company-profiles`
2. Ausschreibung anlegen: `POST /api/tenders/manual`
3. Jobs verarbeiten: `POST /api/pipeline/run-batch?limit=20` oder Worker laufen lassen
4. Empfehlungen abrufen: `GET /api/recommendations/{companyId}`
5. Attribution tracken: `POST /api/tracking`

## Wichtige API-Routen

- `GET /api/health`
- `POST /api/pipeline/crawl`
- `POST /api/pipeline/run-once`
- `POST /api/pipeline/run-batch?limit=20`
- `GET /api/jobs`
- `GET /api/tenders`
- `POST /api/tenders/manual`
- `GET|POST /api/company-profiles`
- `GET /api/recommendations/{companyId}`
- `POST /api/tracking`

## Konfiguration

- `DATABASE_PATH` (default: `data/tender_agent.db`)
- `OBJECT_STORE_PATH` (default: `data/object_store`)
- `DEFAULT_SOURCES` (kommagetrennte URLs)
- `MAX_PDF_LINKS_PER_TENDER` (default: `5`)
- `MAX_JOB_RETRIES` (default: `3`)
- `WORKER_POLL_SECONDS` (default: `3`)

## Hinweise

- Die Basis-Version ist deterministisch, lokal lauffaehig und ohne externe Infrastruktur nutzbar.
- Eine spaetere Migration auf Postgres ist moeglich, ohne die Pipeline-Logik neu zu denken.
