# Tenderhunter Brand System

Status: active
Last updated: 2026-10-10

This is the product-wide source of truth for Tenderhunter's brand behavior. Campaign production tasks remain in `marketing/backlog.md`; product brand decisions and follow-up work belong in `BRAND_BACKLOG.md`.

## Positioning

Tenderhunter is the intelligent public-procurement scout for German Mittelstand teams. The product finds relevant tenders early, evaluates fit, and turns procurement data into clear business opportunities.

- Leitidee: Signal im Vergaberauschen
- Versprechen: Oeffentliche Auftraege. Frueh erkannt. Klar bewertet.
- Product context: Finden. Pruefen. Gewinnen.
- Personality: precise, alert, competent, calm, efficient, reliable, forward-looking, grounded

## Visual Language

The product is a quiet working tool for bid and business-development teams. Use off-white surfaces, slate text, restrained borders, controlled radii, and one clear signal color. Navy establishes trust and orientation; coral marks action and brand presence. Green means a positive match, amber means a deadline or warning, and red means a real error.

Do not use weapon, target, camouflage, militaristic, neon, cyber, glass, decorative gradient, or cartoon language in the product UI. Radar and scan references should be sparse and functional.

## Semantic Tokens

The implementation lives in `app/globals.css` for Tailwind, `lib/brand-tokens.ts` for shared public values, and `lib/theme.ts` for MUI. The shared MUI app-router wrapper is `components/ThemeRegistry.tsx`; keep `AppRouterCacheProvider` above MUI surfaces so Emotion styles are emitted to `<head>` during server rendering and the initial client render stays aligned. Prefer these names over raw values or generic color aliases in new product work.

| Token | Role |
| --- | --- |
| `brand-primary` | Trust, navigation, brand surfaces |
| `brand-signal` | Coral brand signal and primary action |
| `surface-canvas` | Main application canvas |
| `surface-panel` | Quiet grouped surface |
| `surface-elevated` | Cards, menus, and raised controls |
| `text-primary` | Main readable content |
| `text-secondary` | Supporting content and metadata |
| `border-subtle` | Low-contrast structure |
| `action-primary` | Main actionable control |
| `action-secondary` | Navy secondary action |
| `status-success` | Positive result or strong match |
| `status-warning` | Deadline, caution, or pending state |
| `status-danger` | Actual error or destructive state |
| `fit-high`, `fit-medium`, `fit-low` | Match confidence levels |

Legacy aliases remain available while existing surfaces migrate. New code should use the semantic names directly.

## Mark

`components/BrandMark.tsx` is the shared, single-color mark. It combines a focused scan, an upward signal, and a point of resolution. It is used in the app shell, favicon, Apple icon, and social preview images. Keep the mark recognizable at small sizes and do not introduce per-surface logo variants.

`components/BrandLockup.tsx` is the shared wordmark treatment for public metadata images and product entry points. Use it instead of the legacy `public/logo.webp` asset or locally recreated logo boxes.

## Core Decision Surfaces

Tender cards, fit scores, deadline states, and tender detail panels are one decision surface. Keep them aligned through:

- 8px panel/card radii and 4px status-chip radii; do not introduce one-off rounded values.
- 1px divider borders and semantic MUI roles (`background.*`, `text.*`, `success.*`, `warning.*`, `info.*`, `divider`) instead of local color literals.
- No decorative shadows or backdrop blur; hierarchy comes from surfaces, borders, spacing, and the single signal color.
- Fit values use tabular numerals and a short verbal state: `Stark` (70-100), `Solide` (40-69), or `Offen` (0-39).
- Green is reserved for strong matches and positive states; amber is reserved for deadlines and caution; lower fit values stay slate rather than becoming an error state.
- Analysis result cards and metric bars use the same semantic MUI roles and 70/40 thresholds as `FitScore`; do not add local hex, RGBA, or generic grey values to this decision surface.
- Company-profile summaries and tender-section headers use the same semantic MUI roles; best-fit values and distributions follow the `FitScore` thresholds and verbal states.
- The canonical public tender detail route uses the same semantic roles for readiness, deadlines, sources, documents, and related opportunities; use dividers and surfaces instead of local shadows to separate decisions.
- International opportunity surfaces use the same semantic palette as the German product; distinguish market or opportunity type with existing `info` and `primary` roles, never with local market colors or translucent accents.
- Progress and result transitions use the MUI theme timing and must provide a reduced-motion path. Use a restrained radar or scan cue for active analysis, never a target or crosshair.
- Discovery, tracked-tender, and international opportunity resource states use the shared `ResourceState`; during revalidation, prior results remain visible with `aria-busy`. Tabular views use `ResponsiveTableFrame` with keyboard-scrollable horizontal overflow and a mobile scrolling hint.

## Voice

Use active, concrete German copy and the `Sie` form. Name the user-visible action, not the implementation. Avoid unnecessary English, authority jargon, hunting metaphors, and inflated AI claims.

## Accessibility And Motion

Interactive controls require a visible keyboard focus state using the brand-primary focus ring, a target of at least 44px where practical, and an accessible German label. Shared MUI icon buttons, navigation items, menu items, and tabs use that touch target by default; clickable regions must remain semantic buttons or links rather than plain containers. SEO-only navigation that is visually hidden must not remain in the keyboard tab order. Secondary text must meet WCAG AA on canvas, panel, and status-tinted surfaces; keep Tailwind and MUI secondary-text values aligned. Preserve readable contrast and mobile navigation behavior. Motion must remain short and purposeful, and global transitions plus analysis counters respect `prefers-reduced-motion`.
