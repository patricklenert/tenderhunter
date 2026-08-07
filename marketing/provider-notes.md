---
status: research
owner: OpenCode
last_verified: 2026-08-07
---

# Video Provider Notes

## Decision

Do not add a video provider to the deployed Tenderhunter application. OpenCode
may use provider APIs or local tools while producing assets and save the
reviewed results under the relevant campaign directory.

The first benchmark should use the same three short shots with fal.ai and
Replicate. Runway is a quality comparison. Vyond, Animaker, and ToonBee are
manual workflow comparisons for controlled cartoon scenes, not dependencies of
the product.

## Provider Comparison

| Provider or tool | Role | Strength | Limitation or risk | Decision |
|---|---|---|---|---|
| fal.ai | Image and short video generation | Broad model selection, queue-based API, output-based video pricing, easy model experiments | Model behavior and rights vary by endpoint; final costs depend on retries and duration | First API benchmark |
| Replicate | Image and short video generation | Stable official models, versioned predictions, webhooks, broad model catalog | Model-specific inputs and availability vary; public/community model rights need review | Second benchmark and fallback |
| Runway API | Quality benchmark | Direct text-to-video and image-to-video workflow with explicit task output | Less useful as a multi-model abstraction; model and plan terms need review | Compare one shot |
| Vyond or Animaker | Controlled cartoon production | Character and scene control can be more reliable than free-form generation | Editor licensing and API scope differ from generation APIs | Manual production benchmark |
| ToonBee | Workflow inspiration | Script-to-storyboard-to-cartoon funnel and long-form positioning | Public page is not an integration contract; do not copy assets or claims | Reference only |
| Remotion | Assembly and rendering | React-based deterministic composition, captions, overlays, product captures | Does not generate source media | Recommended assembly layer |
| FFmpeg | Encoding and finishing | Reliable local conversion and muxing | Low-level editing; requires explicit command metadata | Optional finishing tool |
| ElevenLabs | German voiceover | TTS API with expressive voices and documented commercial API licensing | Commercial rights depend on plan and asset type | Voice benchmark |

## Benchmark Shots

1. The owner reacts to a growing document monster.
2. The Tenderhunter guide scans a company profile with a magnifying glass.
3. The same owner appears in two scenes with the same outfit, proportions, and
   facial style.

## Scoring Rubric

Score each provider from 1 to 5 and record a short reason:

- character continuity;
- style continuity;
- controllable motion;
- prompt adherence;
- absence of broken text and logos;
- render time;
- cost per accepted shot;
- reproducibility with the recorded model version and seed;
- commercial-use rights;
- output quality after 9:16 cropping.

## Run Log

| Date | Provider | Model ID and version | Shot | Prompt file | Seed | Duration | Resolution | Cost | Output path | Rights status | Notes |
|---|---|---|---|---|---|---:|---|---:|---|---|---|
|  |  |  |  |  |  |  |  |  |  |  |  |

## Source Links

- [fal.ai model APIs](https://fal.ai/docs/documentation/model-apis/overview)
- [fal.ai pricing](https://fal.ai/docs/documentation/model-apis/pricing)
- [fal.ai image-to-video APIs](https://fal.ai/explore/image-to-video-apis)
- [Replicate official models](https://replicate.com/docs/topics/models/official-models)
- [Replicate HTTP API](https://replicate.com/docs/reference/http)
- [Replicate pricing](https://replicate.com/pricing)
- [Runway developer documentation](https://docs.dev.runwayml.com/)
- [Remotion](https://www.remotion.dev/)
- [ElevenLabs text to speech](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)
- [ToonBee reference page](https://toonbee.ai/)

## Security Rules

- Use `FAL_KEY`, `REPLICATE_API_TOKEN`, and voice-provider keys only from the
  local environment.
- Never place keys, signed URLs, or raw provider request headers in Markdown.
- Copy generated output into the campaign directory only after removing private
  metadata and checking that URLs are safe to retain.
- Do not expose a generation endpoint through Next.js.
