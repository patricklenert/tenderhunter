# Design

## Scene

Beschaffungsteams arbeiten tagsueber im Buero, meist mit mehreren offenen Dokumenten und kurzen Entscheidungsfenstern. Das Interface soll wie ein ruhiges Arbeitswerkzeug wirken, nicht wie ein Marketing-Screen.

## Visual Theme

Klar, sachlich, fokussiert. Helle Grundflaechen mit getoenten Neutralen erzeugen Ruhe. Akzentfarbe signalisiert Handlungsfaehigkeit, waehrend Gruen und Rot nur fuer Status verwendet werden.

## Color Strategy

Restrained: getoente Neutrale plus eine klare Akzentfarbe. Statusfarben erscheinen nur bei semantischen Signalen.

## Color Tokens

- Canvas: `oklch(96.7% 0.01 238)`
- Canvas soft: `oklch(98.1% 0.006 238)`
- Surface: `oklch(99.2% 0.004 238)`
- Surface strong: `oklch(95.6% 0.014 238)`
- Text primary: `oklch(27.5% 0.028 240)`
- Text muted: `oklch(45.3% 0.022 240)`
- Border: `oklch(84% 0.012 236)`
- Brand navy: `oklch(31.5% 0.08 252)`
- Brand signal: `oklch(58% 0.13 35)`
- Brand signal soft: `oklch(92.8% 0.034 35)`
- Brand signal dark: `oklch(51.6684% 0.126553 31.10595)`
- Primary action: `oklch(56.6228% 0.13084 33.62389)`
- Secondary action: `oklch(31.5% 0.08 252)`
- Success: `oklch(50% 0.12 152)`
- Warning: `oklch(52.9456% 0.117582 63.3553)`
- Danger: `oklch(49% 0.18 25)`
- Info: `oklch(49.52% 0.036 248.56)`

The Tailwind tokens in `app/globals.css` and the shared MUI/public values in `lib/brand-tokens.ts` mirror the same semantic colors. Keep that parity covered by `npm run test:brand-tokens`. The brighter brand signal is for the mark and identity cues; filled primary actions use the darker signal shade so white labels meet WCAG AA.

## Typography

- Primary family: Manrope
- UI scale: kompakt, produktorientiert, feste Groessen
- Heading hierarchy:
  - H1: `2.12rem`
  - H2: `1.18rem`
  - H3: `1.02rem`
- Body: ca. `0.95rem` bis `1rem`
- Lesebreite fuer Freitext maximal etwa `72ch`

## Layout

- Dashboard-Breite: `min(1150px, 100% - 3rem)`
- Hero in zwei Spalten (Inhalt + Statuspanel)
- Hauptbereiche als klar getrennte Surface-Bloecke
- Tabellen in horizontal scrollbarem Wrapper fuer kleine Screens

## Components

- Status-Pills: Live, Stabil, Kill-Switch
- Stat-Grid fuer Kernzahlen
- Queue-Lanes mit Lastbalken
- Empfehlungstabelle mit Win-Probability-Track
- Schrittliste mit nummerierten Markern fuer naechste Aktionen

## Motion

- Nur kurze Zustandsuebergaenge (`180ms`, ease-out-quart)
- Keine dekorativen Intro-Animationen
- Hover nur zur Lesefuehrung in Tabellenzeilen

## Content Tone

Kurz, klar, handlungsorientiert. Keine Buzzwords, keine langen Einleitungen. Jede Beschriftung soll eine konkrete Entscheidung unterstuetzen.
