import assert from "node:assert/strict";
import OpenAI from "openai";
import { callLLM, MODEL_CASCADE, resetLLMCooldownsForTests } from "@/lib/llm";

assert.deepEqual([...MODEL_CASCADE], [
  "inclusionai/ling-3.1-flash",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "google/gemma-4-26b-a4b-it:free",
]);

assert.equal(MODEL_CASCADE[0], "inclusionai/ling-3.1-flash");

async function main() {
  const requestedModels: string[] = [];
  const mockClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          requestedModels.push(model);
          return {
            choices: [{ message: { content: requestedModels.length < 3 ? "" : "usable response" } }],
          };
        },
      },
    },
  } as unknown as OpenAI;

  const response = await callLLM(mockClient, { messages: [] });
  assert.equal(response, "usable response");
  assert.deepEqual(requestedModels, [...MODEL_CASCADE.slice(0, 3)]);

  // 404 "No endpoints found" means the slug has no endpoints at all: every
  // model is tried once, then permanently skipped in later cascades.
  const notFoundModels: string[] = [];
  const notFoundClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          notFoundModels.push(model);
          throw Object.assign(new Error("No endpoints found"), { status: 404, code: 404 });
        },
      },
    },
  } as unknown as OpenAI;
  await assert.rejects(() => callLLM(notFoundClient, { messages: [] }), { status: 404 });
  await assert.rejects(() => callLLM(notFoundClient, { messages: [] }), { message: /Alle Modelle/ });
  assert.deepEqual(notFoundModels, [...MODEL_CASCADE]);
  resetLLMCooldownsForTests();

  const policyBlockedModels: string[] = [];
  const policyBlockedClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          policyBlockedModels.push(model);
          if (model === MODEL_CASCADE[6]) {
            throw Object.assign(new Error("0 endpoints available: filtered by guardrail and data policy"), { status: 404, code: 404 });
          }
          throw Object.assign(new Error("Model not found"), { status: 404, code: 404 });
        },
      },
    },
  } as unknown as OpenAI;
  await assert.rejects(() => callLLM(policyBlockedClient, { messages: [] }), { status: 404 });
  await assert.rejects(() => callLLM(policyBlockedClient, { messages: [] }), { status: 404 });
  assert.deepEqual(policyBlockedModels, [
    ...MODEL_CASCADE,
    ...MODEL_CASCADE.slice(0, 6),
    ...MODEL_CASCADE.slice(7),
  ]);
  resetLLMCooldownsForTests();

  const unavailableModels: string[] = [];
  const unavailableClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          unavailableModels.push(model);
          if (model === MODEL_CASCADE[0]) {
            throw Object.assign(
              new Error("Ling-3.1-flash is no longer available as a free model"),
              { status: 404, code: 404 },
            );
          }
          if (model === MODEL_CASCADE[1]) {
            return { choices: [{ message: { content: "fallback response" } }] };
          }
          throw Object.assign(new Error("No endpoints found"), { status: 404, code: 404 });
        },
      },
    },
  } as unknown as OpenAI;
  assert.equal(await callLLM(unavailableClient, { messages: [] }), "fallback response");
  assert.equal(await callLLM(unavailableClient, { messages: [] }), "fallback response");
  assert.deepEqual(unavailableModels, [
    ...MODEL_CASCADE.slice(0, 2),
    MODEL_CASCADE[1],
  ]);
  resetLLMCooldownsForTests();

  const newlyPaidModel = MODEL_CASCADE[6];
  const newlyPaidModels: string[] = [];
  const newlyPaidClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          newlyPaidModels.push(model);
          if (model === newlyPaidModel) {
            throw Object.assign(
              new Error("This model is unavailable for free. The paid version is available now - use this slug instead."),
              { status: 404, code: 404 },
            );
          }
          throw Object.assign(new Error("Model not found"), { status: 404, code: 404 });
        },
      },
    },
  } as unknown as OpenAI;
  await assert.rejects(() => callLLM(newlyPaidClient, { messages: [] }), { status: 404 });
  await assert.rejects(() => callLLM(newlyPaidClient, { messages: [] }), { status: 404 });
  assert.deepEqual(newlyPaidModels, [
    ...MODEL_CASCADE,
    ...MODEL_CASCADE.filter((model) => model !== newlyPaidModel),
  ], "a provider's current unavailable-for-free 404 must remove that model from later cascades");
  resetLLMCooldownsForTests();

  const structuredUnsupportedModels: string[] = [];
  const structuredUnsupportedClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          structuredUnsupportedModels.push(model);
          if (model === MODEL_CASCADE[0]) {
            throw Object.assign(new Error("400 Provider returned error"), {
              status: 400,
              code: 400,
              error: {
                message: "Provider returned error",
                metadata: { raw: `model: ${model} does not support feature: structured-outputs` },
              },
            });
          }
          return { choices: [{ message: { content: "structured fallback" } }] };
        },
      },
    },
  } as unknown as OpenAI;
  const jsonFormat = { type: "json_object" as const };
  assert.equal(await callLLM(structuredUnsupportedClient, { messages: [], response_format: jsonFormat }), "structured fallback");
  assert.equal(await callLLM(structuredUnsupportedClient, { messages: [], response_format: jsonFormat }), "structured fallback");
  assert.deepEqual(structuredUnsupportedModels, [MODEL_CASCADE[0], MODEL_CASCADE[1], MODEL_CASCADE[1]]);
  resetLLMCooldownsForTests();

  const malformedModels: string[] = [];
  const malformedResponseClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          malformedModels.push(model);
          if (model === MODEL_CASCADE[0]) return {};
          return { choices: [{ message: { content: "valid fallback" } }] };
        },
      },
    },
  } as unknown as OpenAI;
  assert.equal(await callLLM(malformedResponseClient, { messages: [] }), "valid fallback");
  assert.equal(await callLLM(malformedResponseClient, { messages: [] }), "valid fallback");
  assert.deepEqual(malformedModels, [MODEL_CASCADE[0], MODEL_CASCADE[1], MODEL_CASCADE[1]]);
  resetLLMCooldownsForTests();

  const authFailedModels: string[] = [];
  const authFailedClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          authFailedModels.push(model);
          throw Object.assign(new Error("User not found"), { status: 401, code: 401 });
        },
      },
    },
  } as unknown as OpenAI;
  await assert.rejects(() => callLLM(authFailedClient, { messages: [] }), { status: 401 });
  assert.deepEqual(authFailedModels, [MODEL_CASCADE[0]]);
  resetLLMCooldownsForTests();

  const rateLimitedModels: string[] = [];
  const rateLimitedClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          rateLimitedModels.push(model);
          throw Object.assign(new Error("Rate limit exceeded"), { status: 429 });
        },
      },
    },
  } as unknown as OpenAI;
  await assert.rejects(() => callLLM(rateLimitedClient, { messages: [] }), { status: 429 });
  assert.deepEqual(rateLimitedModels, [...MODEL_CASCADE]);

  // Regression (global cooldown): free-model quota reset headers used to put
  // every model on cooldown. Cooldowns are per model; transient 429s without a
  // reset header do not cool a model down at all.
  const quotaBurstModels: string[][] = [];
  let quotaBurstCall = 0;
  const quotaBurstClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          quotaBurstModels[quotaBurstCall] ??= [];
          quotaBurstModels[quotaBurstCall].push(model);
          if (quotaBurstCall === 0 || model.endsWith(":free")) {
            const headers = model.endsWith(":free")
                ? new Headers({ "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600) })
                : undefined;
            throw Object.assign(
              new Error(model.endsWith(":free") ? "free-models-per-day-high-balance" : "Rate limit exceeded"),
              { status: 429, code: 429, ...(headers ? { headers } : {}) },
            );
          }
          return { choices: [{ message: { content: "recovered response" } }] };
        },
      },
    },
  } as unknown as OpenAI;
  await assert.rejects(() => callLLM(quotaBurstClient, { messages: [] }), { status: 429 });
  quotaBurstCall += 1;
  const recoveredResponse = await callLLM(quotaBurstClient, { messages: [] });
  assert.equal(recoveredResponse, "recovered response");
  // Ling 3.1's transient limit does not cool it down, so it can be retried
  // before the other free models whose quota reset headers are still active.
  assert.deepEqual(quotaBurstModels[1], [MODEL_CASCADE[0]]);
  resetLLMCooldownsForTests();
}

main().then(() => console.log("LLM cascade checks passed."));
