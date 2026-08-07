---
status: active
owner: OpenCode
last_verified: 2026-08-07
---

# Claims Ledger

Statuses are production gates, not legal approval. `safe-draft` means the
wording is narrow enough for a draft and still needs final campaign review.

| Claim or message | Safe wording | Status | Evidence path | Last verified | Notes |
|---|---|---|---|---|---|
| Source discovery | `Tenderhunter durchsucht mehrere konfigurierte Vergabequellen.` | safe-draft | `lib/public-source-registry.ts`, `lib/tender-sources.ts`, `lib/us-tender-scraper.ts` | 2026-08-07 | Name only sources that are enabled for the campaign. |
| Website preview | `Sie koennen Ihre Unternehmenswebsite pruefen lassen.` | safe-draft | `lib/preview.ts`, `components/DashboardSection.tsx` | 2026-08-07 | Match privacy copy to the actual processing flow. |
| Preview output | `Eine kostenlose Vorschau zeigt bis zu drei belastbare Treffer.` | safe-draft | `lib/preview.ts:141-169`, `components/DashboardSection.tsx:1391-1400` | 2026-08-07 | Fewer than three results are possible. |
| Structured tender information | `Anforderungen, Fristen und weitere Felder werden strukturiert aufbereitet.` | safe-draft | `lib/structurer.ts`, `lib/pipeline.ts`, `lib/document-analysis.ts` | 2026-08-07 | Do not imply every source document is complete. |
| Fit prioritization | `Ein Fit-Score hilft bei der ersten Priorisierung.` | safe-draft | `lib/scoring.ts`, `lib/preview.ts:144-150` | 2026-08-07 | It is a heuristic signal, not a calibrated probability. |
| Stop signals | `Unpassende oder blockierte Treffer koennen als Stopp-Signal sichtbar werden.` | safe-draft | `lib/scoring.ts`, `lib/tender-readiness.ts`, `components/DashboardSection.tsx` | 2026-08-07 | Use actual UI wording in the final edit. |
| Current source coverage | `Tenderhunter deckt die fuer diese Kampagne verifizierten Quellen ab.` | needs-evidence | `lib/public-source-registry.ts`, `lib/us/*` | 2026-08-07 | Re-check source health before publishing. |
| Freshness | `Neue Ausschreibungen erscheinen taeglich` or `innerhalb weniger Stunden` | do-not-use | `lib/public-monitoring.ts`, `lib/config.ts` | 2026-08-07 | Current default public interval is 48 hours. |
| Completeness | `Alle Ausschreibungen in Deutschland` or `vollstaendig` | do-not-use | `lib/public-source-registry.ts`, `lib/public-tender-scraper.ts` | 2026-08-07 | Sources can be blocked, partial, stale, or unavailable. |
| Win outcome | `Tenderhunter steigert Ihre Gewinnquote` or a percentage increase | do-not-use | `lib/scoring.ts` | 2026-08-07 | No calibrated outcome evidence is available. |
| Win probability | `Die Gewinnwahrscheinlichkeit betraegt X Prozent.` | do-not-use | `lib/scoring.ts` | 2026-08-07 | The value is a heuristic score derived from product signals. |
| Free access | `Kostenlos starten` or `kostenlose Vorschau` | needs-evidence | `app/page.tsx`, `app/upgrade/page.tsx`, `components/billing/UpgradePage.tsx` | 2026-08-07 | Confirm current entitlement and billing behavior before final export. |
| Data handling | `Ihre Daten bleiben ausschliesslich intern.` | do-not-use | `lib/preview.ts`, `lib/firecrawl.ts`, privacy/legal sources | 2026-08-07 | External AI and scraping services are part of the runtime flow. |

## Review Protocol

1. Copy every factual sentence from a script into this table before rendering.
2. Link each sentence to the source file or measured campaign result.
3. Re-check source health, pricing, access behavior, and privacy wording before
   final publication.
4. If evidence is missing, narrow the wording or mark it `do-not-use`.
