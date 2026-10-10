---
status: draft
owner: OpenCode
last_verified: 2026-09-14
---

# Marketing Brand System

## Brand Personality

Tenderhunter is calm, precise, reliable, and useful under time pressure. A
restrained editorial illustration layer can add warmth and memorability without
turning the product into a game or making procurement work look foolish.

## Visual Bridge To The Product

The product uses a restrained light interface. Marketing can be more expressive
but should still share these anchors:

- Brand primary: `BRAND_COLORS.brandPrimary` (`#1e3a5f`)
- Brand signal: `BRAND_COLORS.brandSignal` (`#e9644d`)
- Signal soft: `BRAND_COLORS.brandSignalSoft` (`#f8d8d2`)
- Canvas: `BRAND_COLORS.surfaceCanvas` (`#f0f4f8`)
- Surface: `BRAND_COLORS.surfaceElevated` (`#fbfcfd`)
- Primary text: `BRAND_COLORS.textPrimary` (`#2d3544`)
- Secondary text: `BRAND_COLORS.textSecondary` (`#667288`)
- Success: `BRAND_COLORS.statusSuccess` (`#277544`)
- Danger: `BRAND_COLORS.statusDanger` (`#c62828`)

The implementation source for these values is `lib/brand-tokens.ts`. Public
metadata images use the shared `components/BrandLockup.tsx` and the same mark as
the application shell and favicon.

Use orange for action and attention. Use green and red only for meaningful
status signals. Do not turn the entire video into a neon palette.

## Cartoon Direction

- Flat editorial illustration with readable silhouettes.
- Slate outlines and warm paper or off-white backgrounds.
- Simple shapes that survive 16:9, 1:1, and 9:16 crops.
- Gentle squash, slide, blink, and paper-motion animation.
- Humor comes from the familiar work situation, not from mocking agencies,
  public authorities, or procurement professionals.
- Keep generated shots short and compose typography in the editor.
- Use the Tenderhunter orange accent as a recurring visual thread.

## Character System

The first campaign uses two recurring roles rather than a complicated cast:

1. A capable but overloaded small-business owner surrounded by tender papers.
2. A compact Tenderhunter guide represented by a scan or signal motif, not a
   literal aggressive hunter.

The owner should look competent and relatable. The problem is document overload,
not personal incompetence. The guide should point, sort, and clarify instead of
claiming magical certainty.

Before generating shots, create a character turnaround with front, side, and
three-quarter views, a small expression sheet, outfit colors, and scale notes.

## Typography And Captions

- Use the existing product type system for UI captures.
- Use one expressive display treatment only for campaign headings.
- Keep all important German words as editor overlays, not generated pixels.
- Captions must be readable without audio and maintain strong contrast.
- Do not use a font unless its commercial license is recorded in the campaign
  metadata.

## Voice And Sound

- German voice: warm, calm, dry, and competent.
- Avoid loud direct-response advertising and exaggerated urgency.
- Music should support paper movement and discovery, not create panic.
- Duck music under narration and keep a clean caption-only export available.

## Accessibility

- Every spoken version has a captioned version.
- Important meaning must not depend on color alone.
- Avoid rapid flashing, tiny labels, and text-heavy generated frames.
- Check the 9:16 crop on a small phone before approval.

## Reference Boundary

ToonBee is a reference for a script-to-cartoon workflow and sales-page
structure. It is not a source for characters, visual assets, wording,
testimonials, conversion numbers, or brand identity.
