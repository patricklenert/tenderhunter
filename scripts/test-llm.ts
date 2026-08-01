import assert from "node:assert/strict";
import OpenAI from "openai";
import { callLLM, MODEL_CASCADE, resetLLMCooldownsForTests } from "@/lib/llm";

assert.deepEqual([...MODEL_CASCADE], [
  "inclusionai/ling-3.0-flash:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "inclusionai/ling-2.6-flash",
]);

assert.equal(MODEL_CASCADE.at(-1), "inclusionai/ling-2.6-flash");
assert.equal(MODEL_CASCADE.slice(0, -1).every((model) => model.endsWith(":free")), true);

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
  assert.deepEqual(rateLimitedModels, [MODEL_CASCADE[0]]);
}

main().then(() => console.log("LLM cascade checks passed."));
