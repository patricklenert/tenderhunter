import OpenAI from "openai";

const PRIMARY_MODEL = "deepseek/deepseek-v4-flash";
const FALLBACK_MODEL = "poolside/laguna-xs-2.1";

export async function callLLM(
  client: OpenAI,
  options: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: "json_object" };
  }
): Promise<string> {
  try {
    const response = await client.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: options.messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.max_tokens,
      response_format: options.response_format,
    });
    return response.choices[0]?.message?.content ?? "";
  } catch (primaryError) {
    console.warn(`[llm] ${PRIMARY_MODEL} fehlgeschlagen, versuche Fallback:`, primaryError);
    const response = await client.chat.completions.create({
      model: FALLBACK_MODEL,
      messages: options.messages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.max_tokens,
      response_format: options.response_format,
    });
    return response.choices[0]?.message?.content ?? "";
  }
}
