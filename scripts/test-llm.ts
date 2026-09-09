import assert from "node:assert/strict";
import OpenAI from "openai";
import { callLLM, MODEL_CASCADE, resetLLMCooldownsForTests } from "@/lib/llm";

assert.deepEqual([...MODEL_CASCADE], [
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "inclusionai/ling-3.0-flash",
  "meta/muse-spark-1.3-contributor",
]);

assert.equal(MODEL_CASCADE.at(-1), "meta/muse-spark-1.3-contributor");
  assert.equal(MODEL_CASCADE.slice(0, 5).every((model) => model.endsWith(":free")), true);
  assert.deepEqual([...MODEL_CASCADE.slice(5)], [
    "inclusionai/ling-3.0-flash",
    "meta/muse-spark-1.3-contributor",
]);

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

  // 404 errors should be skipped like other non-rate-limit errors
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
          throw Object.assign(new Error("No endpoints found"), { status: 404, code: 404 });
        },
      },
    },
  } as unknown as OpenAI;
  await assert.rejects(() => callLLM(policyBlockedClient, { messages: [] }), { status: 404 });
  await assert.rejects(() => callLLM(policyBlockedClient, { messages: [] }), { status: 404 });
  assert.deepEqual(policyBlockedModels, [...MODEL_CASCADE, ...MODEL_CASCADE.slice(0, 6)]);
  resetLLMCooldownsForTests();

  const unavailableModels: string[] = [];
  const unavailableClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          unavailableModels.push(model);
          if (model === MODEL_CASCADE[5]) {
            throw Object.assign(
              new Error("Ling-3.0-flash is no longer available as a free model"),
              { status: 404, code: 404 },
            );
          }
          if (model === MODEL_CASCADE[6]) {
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
    ...MODEL_CASCADE.slice(0, 7),
    ...MODEL_CASCADE.slice(0, 5),
    MODEL_CASCADE[6],
  ]);
  resetLLMCooldownsForTests();

  const rateLimitedThenPaidModels: string[] = [];
  const rateLimitedThenPaidClient = {
    chat: {
      completions: {
        create: async ({ model }: { model: string }) => {
          rateLimitedThenPaidModels.push(model);
          if (model !== "meta/muse-spark-1.3-contributor") {
            throw Object.assign(new Error("Model rate limit exceeded"), { status: 429, code: 429 });
          }
          return { choices: [{ message: { content: "paid fallback response" } }] };
        },
      },
    },
  } as unknown as OpenAI;
  const paidFallbackResponse = await callLLM(rateLimitedThenPaidClient, { messages: [] });
  assert.equal(paidFallbackResponse, "paid fallback response");
  assert.deepEqual(rateLimitedThenPaidModels, [...MODEL_CASCADE]);
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

  // Regression (global cooldown): when every model 429s in one burst, the
  // free-model quota reset header (midnight UTC) used to put the whole
  // subsystem — including the working paid fallbacks — on cooldown for hours.
  // Cooldowns are per model now; transient 429s without a reset header do not
  // cool a model down at all.
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
          return { choices: [{ message: { content: "recovered paid response" } }] };
        },
      },
    },
  } as unknown as OpenAI;
  await assert.rejects(() => callLLM(quotaBurstClient, { messages: [] }), { status: 429 });
  quotaBurstCall += 1;
  const recoveredResponse = await callLLM(quotaBurstClient, { messages: [] });
  assert.equal(recoveredResponse, "recovered paid response");
  // Second call skips the cooled-down free models and lands on the first paid
  // model without a cooldown.
  assert.deepEqual(quotaBurstModels[1], [MODEL_CASCADE[5]]);
  resetLLMCooldownsForTests();
}

main().then(() => console.log("LLM cascade checks passed."));
