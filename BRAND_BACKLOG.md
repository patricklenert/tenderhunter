# Tenderhunter Brand Backlog

Product-wide brand and UI consistency work is tracked here. This backlog is cumulative, not date-based. Campaign production remains separate in `marketing/backlog.md`.

## Completed

| ID | Priority | Status | Work | Result | Dependencies |
| --- | --- | --- | --- | --- | --- |
| TH-BR-001 | P0 | Completed | Establish shared mark and global semantic foundation | Added `BrandMark`, replaced the generic house and compass marks, introduced semantic Tailwind/MUI roles, aligned the shell and metadata icons, and switched the product font to Manrope. | None |
| TH-BR-002 | P0 | Completed | Align tender cards, fit scores, deadline states, and detail drawer | Migrated the four core decision components to semantic MUI roles, established 8px panels and 4px status chips, removed local shadows/backdrop blur, and added verbal fit states plus tabular score numerals. | TH-BR-001 |
| TH-BR-003 | P0 | Completed | Align product voice across analysis, tracking, empty states, and authentication | Replaced remaining `du` copy and legacy ASCII German in the dashboard, tracked tenders, tender list, authentication, paywall, bid-pack, quick-check, overview, and shared detail surfaces; removed internal `Queue`, `Owner`, `Scoring`, and `Billing-Plan` wording from visible copy. Lower fit values in tracked tender progress now use slate info instead of error red. | TH-BR-002 baseline |

## Open

| ID | Priority | Status | Inconsistency | Productive scope | Brand effect | Dependencies |
| --- | --- | --- | --- | --- | --- | --- |
| TH-BR-004 | P1 | Open | Search, list, and table states need one responsive hierarchy for loading, empty, error, and overflow behavior | Discovery, public tender, and tracked tender surfaces | Turns data density into calm orientation across mobile and desktop. | TH-BR-002 |
| TH-BR-005 | P1 | Open | Marketing and product metadata still have duplicated brand values and legacy logo treatments | `app/*/opengraph-image.tsx`, `marketing/brand.md`, SEO surfaces | Keeps public touchpoints recognizable without changing URLs or SEO structure. | TH-BR-001 |
| TH-BR-006 | P1 | Open | Focus, reduced-motion, and touch behavior are not consistently visible in domain components | Shared interaction states and mobile navigation | Brings the WCAG 2.1 AA target into the high-frequency product paths. | TH-BR-002, TH-BR-004 |
