import assert from "node:assert/strict";
import OpenAI from "openai";
import { callLLM, MODEL_CASCADE } from "@/lib/llm";

assert.deepEqual([...MODEL_CASCADE], [
  "inclusionai/ling-3.0-flash:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "poolside/laguna-xs-2.1",
]);

assert.equal(MODEL_CASCADE.at(-1), "poolside/laguna-xs-2.1");
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
}

main().then(() => console.log("LLM cascade checks passed."));
