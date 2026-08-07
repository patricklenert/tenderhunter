---
status: active
owner: OpenCode
last_verified: 2026-08-07
---

# Production Workflow

## Roles

OpenCode owns research, copy, prompt iteration, provider calls, local assembly,
metadata, and QA notes. The user provides strategic approval when a claim,
audience, provider, or final concept is a business decision.

## Stages

### 1. Brief

Capture audience, problem, objective, channel, duration, language, CTA, factual
proof points, and exclusions.

### 2. Script

Write the voiceover and on-screen copy in German. Keep sentences short enough
for captions. Check each factual sentence against `claims-ledger.md`.

### 3. Storyboard

Define one visual purpose per shot, camera movement, character state, product
proof, overlay copy, voice timing, and transition.

### 4. Style And Key Art

Create the character turnaround, color reference, background reference, and key
frame before generating motion. Keep the logo and product UI out of generated
frames whenever possible.

### 5. Short Clip Generation

Generate 3 to 8 second clips. Prefer image-to-video from approved key frames.
Keep each shot replaceable. Record all provider metadata in the run log.

### 6. Assembly

Combine generated clips with real product captures, voice, music, captions, and
editor-created labels. Use Remotion or FFmpeg locally. Never add an assembly
route to the application.

### 7. Review

Check factual claims, German spelling, product UI accuracy, character
continuity, rights, audio levels, captions, contrast, and 9:16 cropping.

### 8. Export

Produce the master and channel variants. Store the final file, thumbnail,
caption file, transcript, and metadata next to the campaign brief.

## Directory Convention

An early campaign may remain a single Markdown brief while its concept is being
reviewed. Once generation starts, split it into the asset-oriented directory
below. The first hero brief currently uses that compact form.

```text
marketing/videos/<campaign>/
  brief.md
  script.de.md
  storyboard.md
  shot-list.yaml
  prompts/
  characters/
  key-art/
  voice/
  music/
  product-captures/
  generated/
  edit/
  renders/
  captions/
  metadata.yaml
```

## Naming Convention

Use lowercase, stable identifiers:

```text
hero-01-ausschreibungsstapel__shot-03__fal-kling__v001.mp4
hero-01-ausschreibungsstapel__16x9__de__v001.mp4
hero-01-ausschreibungsstapel__9x16__de__v001.mp4
```

## Required Metadata

Each generated or final asset records:

- campaign and shot ID;
- creation date;
- provider and model version;
- prompt and reference asset paths;
- seed, duration, resolution, aspect ratio, and output format;
- voice and music source;
- license or commercial-rights status;
- claim-ledger review status;
- revision reason.

## Output Targets

- Master: 1920x1080, 16:9, H.264 MP4, captioned and clean versions.
- Vertical: 1080x1920, 9:16, with safe zones for platform controls.
- Square: 1080x1080, 1:1, only when the composition remains readable.
- Captions: WebVTT or SRT plus a plain-text transcript.
- Thumbnail: static frame with editor-created text, not generated text.

## Stop Conditions

Do not render a final version when:

- a claim is marked `needs-evidence` or `do-not-use`;
- a generated character changes identity between essential shots;
- the product screen shows stale, invented, or private data;
- a provider or asset has unknown commercial rights;
- captions cannot be read on a phone;
- the script implies guaranteed bid success, complete coverage, or real-time
  freshness.
