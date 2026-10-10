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

## MCP und lokale Agenten

Der read-only MCP-Server ist unter `/api/mcp` erreichbar und liefert über alle
MCP-Anfragen hinweg höchstens 50 Quota-Einheiten pro UTC-Kalendertag. Die
zugehörige JSON-Fassade für lokale Skripte liegt unter `/api/mcp/search`.

Verfügbare Tools:

- `search_tenders`: Suche mit Filtern, u.a. `sort: "smallVendorFit"`, `smallVendorFitMin`
  und `category`. Eine Einheit je zurückgegebenem Treffer.
- `match_tenders`: bewertet Kandidaten gegen ein Firmenprofil (Bieter, optional Partner).
  Je Treffer ein `verdict` (`barrier`, `unclear`, `no_barrier_found`) mit Prüfpunkten und
  Belegen (Dokument, Seite, wörtliches Zitat). Eine Einheit je zurückgegebenem Treffer.
- `get_tender_dossier`: Bekanntmachung, Dokumente mit Abrufstatus, ZIP-Inhalte,
  Ressourcen, Zugriffshinweise und Kriterien mit Belegen. Eine Einheit je Aufruf.
- `get_document_text`: Textausschnitt eines Dokuments, optional einer Seite. Eine Einheit je Aufruf.

Der Status `not_found` heißt: in den geprüften Dokumenten nicht gefunden. Er heißt nicht,
dass ein Kriterium nicht erforderlich ist. Die Auswertung ist regelbasiert und ersetzt
keine Prüfung der Vergabeunterlagen.

Für Claude Code:

```bash
claude mcp add --transport http tenderhunter https://DEINE-DOMAIN/api/mcp
```

Für Codex:

```bash
codex mcp add tenderhunter --url https://DEINE-DOMAIN/api/mcp
```

OpenCode kann den Server in der MCP-Konfiguration eintragen:

```json
{
  "mcp": {
    "tenderhunter": {
      "type": "remote",
      "url": "https://DEINE-DOMAIN/api/mcp",
      "enabled": true
    }
  }
}
```

ChatGPT wird über Developer Mode als eigener Custom Connector mit derselben
URL eingerichtet. ChatGPT Web bietet dafür keinen verlässlichen Shell-Befehl.

Lokale Agenten können alternativ die dependency-freie CLI verwenden:

```bash
TENDERHUNTER_API_URL=https://DEINE-DOMAIN/api/mcp/search \
  npm run tenderhunter -- search --query "Gebäudereinigung" --limit 10
```

Wenn `MCP_API_KEY` auf dem Server gesetzt ist, muss der Client einen Bearer-
Token senden. Der Schlüssel wird nur über die jeweilige lokale
Umgebungsvariable `TENDERHUNTER_MCP_API_KEY` verwendet und niemals in diesen
Dateien gespeichert.

Beispiel für ein Firmenprofil in `match_tenders` (alle Felder optional außer `bidder`):

```json
{
  "bidder": { "foundedOn": "2026-03-01", "inGermany": true, "registeredInGermany": true, "germanLanguage": true, "referenceCount": 0 },
  "partner": { "name": "Partnerfirma", "referenceCount": 3, "certificates": ["ISO 27001"] }
}
```

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
