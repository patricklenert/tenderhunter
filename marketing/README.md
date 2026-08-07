---
status: active
owner: OpenCode
last_verified: 2026-08-07
---

# Tenderhunter Marketing Workspace

This directory is a private, agent-managed workspace for Tenderhunter marketing
content. OpenCode is the only intended producer and maintainer of the content.

## Scope

- Store strategy, copy, research, video scripts, storyboards, prompts, and final marketing renders here.
- Keep the content outside `app/`, `public/`, `static/`, and `components/`.
- Do not create a public marketing route, a marketing UI, a marketing API, or a client-side video generator.
- Do not import files from this directory into the running Tenderhunter application.
- Do not change product code while working on marketing unless the user explicitly requests it.

The repository root is not served by the current Next.js application. The
Docker build also excludes this directory through `/marketing/` in
`.dockerignore`.

## OpenCode Working Rules

1. Start with the relevant file in this directory before creating a new one.
2. Keep claims tied to a source path, a measured result, or an explicit evidence status.
3. Use real Tenderhunter screens and verified product behavior for product proof.
4. Treat `toonbee.ai` as a workflow reference only. Do not copy its wording, art, characters, assets, testimonials, or unsupported performance claims.
5. Keep provider credentials in environment variables. Never write API keys, raw authorization headers, customer data, or private URLs here.
6. Record provider, model ID, version, prompt, seed, duration, resolution, cost, output path, and rights status for generated media.
7. Add German captions and all important typography during editing. Do not depend on generated video models to render German text correctly.
8. Keep generated media and source files under the relevant `videos/` campaign directory. Redact provider responses before storing them.
9. Mark unfinished work as `draft`, evidence gaps as `needs-evidence`, and rejected concepts as `rejected`.
10. Prefer small, reviewable content files over one large campaign document.

## File Map

- `positioning.md`: audience, problem, promise, message hierarchy, and objections.
- `brand.md`: tone, visual system, cartoon rules, character rules, and accessibility.
- `claims-ledger.md`: claims allowed in scripts and claims that require evidence.
- `provider-notes.md`: provider comparison, benchmark protocol, costs, and rights checks.
- `production-workflow.md`: repeatable OpenCode workflow and asset conventions.
- `backlog.md`: campaign queue, experiments, and rejected ideas.
- `videos/`: campaign-specific briefs, scripts, storyboards, prompts, assets, and renders.

## Default Campaign Workflow

1. Confirm audience, language, objective, channel, and call to action.
2. Check the claims ledger and current product source files.
3. Write the brief, script, and storyboard before generating media.
4. Create character references and key art before image-to-video clips.
5. Generate short shots, not one long uncontrolled video.
6. Assemble voice, music, captions, product captures, and generated clips locally.
7. Review factual claims, visual consistency, rights, accessibility, and export formats.
8. Store the final render and its production metadata next to the campaign brief.

## Definition Of Done

A campaign asset is ready only when:

- its audience, objective, CTA, and distribution formats are documented;
- every factual product claim appears in `claims-ledger.md`;
- the script, storyboard, prompts, voice direction, and asset checklist exist;
- generated assets have provider and rights metadata;
- German copy has been proofread and captions are available;
- the final render has passed product, claim, privacy, and visual QA;
- no file has been added to a public Next.js directory.
