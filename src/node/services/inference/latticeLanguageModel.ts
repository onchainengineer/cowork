/**
 * Lattice Language Model — Custom Vercel AI SDK LanguageModelV2 implementation.
 *
 * Bridges the Python inference worker's JSON-RPC streaming protocol to the
 * Vercel AI SDK's LanguageModelV2 interface. This allows lattice-inference
 * to work seamlessly with `streamText()`, `generateText()`, and all other
 * AI SDK primitives.
 *
 * Prompt conversion:
 *   LanguageModelV2Prompt (system/user/assistant/tool messages with typed parts)
 *   → simple {role, content}[] expected by the Python worker
 *
 * Stream mapping:
 *   Python {token, done} → AI SDK text-start / text-delta / text-end / finish / usage
 */

import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2Message,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
} from "@ai-sdk/provider";
import type { PythonWorkerManager } from "./workerManager";
import type { ChatMessage, GenerateParams } from "./types";

/**
 * Convert a LanguageModelV2Prompt (array of typed messages) into the
 * simple {role, content}[] format expected by the Python worker.
 */
function convertPrompt(messages: LanguageModelV2Message[]): ChatMessage[] {
  const result: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      result.push({ role: "system", content: msg.content });
    } else if (msg.role === "user") {
      // Concatenate text parts (ignore files — local inference is text-only for now)
      const text = msg.content
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      if (text) result.push({ role: "user", content: text });
    } else if (msg.role === "assistant") {
      const text = msg.content
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("");
      if (text) result.push({ role: "assistant", content: text });
    } else if (msg.role === "tool") {
      // Convert tool results to assistant context
      const text = msg.content
        .map((p) => {
          if (p.output.type === "text" || p.output.type === "error-text") {
            return p.output.value;
          }
          if (p.output.type === "json" || p.output.type === "error-json") {
            return JSON.stringify(p.output.value);
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
      if (text) result.push({ role: "user", content: `[Tool Result]\n${text}` });
    }
  }

  return result;
}

/**
 * Build GenerateParams from AI SDK call options.
 */
function buildParams(
  options: LanguageModelV2CallOptions,
): GenerateParams {
  return {
    messages: convertPrompt(options.prompt),
    temperature: options.temperature,
    top_p: options.topP,
    max_tokens: options.maxOutputTokens ?? 2048,
    stop: options.stopSequences,
  };
}

/**
 * Create a unique ID for stream content parts.
 */
let streamIdCounter = 0;
function nextStreamId(): string {
  return `lattice-${++streamIdCounter}`;
}

/**
 * Custom LanguageModelV2 that communicates with a local Python inference worker
 * via JSON-RPC 2.0 over stdin/stdout.
 */
export class LatticeLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider = "lattice-inference";
  readonly modelId: string;
  readonly supportedUrls: Record<string, RegExp[]> = {};

  private worker: PythonWorkerManager;

  constructor(modelId: string, worker: PythonWorkerManager) {
    this.modelId = modelId;
    this.worker = worker;
  }

  /**
   * Non-streaming generation.
   */
  async doGenerate(
    options: LanguageModelV2CallOptions,
  ): Promise<{
    content: Array<LanguageModelV2Content>;
    finishReason: LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage;
    warnings: Array<LanguageModelV2CallWarning>;
    response?: { id?: string; timestamp?: Date; modelId?: string };
  }> {
    const params = buildParams(options);
    const result = await this.worker.generate(params);

    const content: LanguageModelV2Content[] = [
      { type: "text", text: result.text },
    ];

    const finishReason = mapFinishReason(result.finish_reason);

    const usage: LanguageModelV2Usage = {
      inputTokens: result.prompt_tokens || undefined,
      outputTokens: result.completion_tokens || undefined,
      totalTokens:
        result.prompt_tokens && result.completion_tokens
          ? result.prompt_tokens + result.completion_tokens
          : undefined,
    };

    return {
      content,
      finishReason,
      usage,
      warnings: collectWarnings(options),
      response: {
        modelId: this.modelId,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Streaming generation.
   *
   * The Python worker emits {token, done} objects via JSON-RPC streaming.
   * We convert these to the AI SDK's ReadableStream<LanguageModelV2StreamPart>.
   */
  async doStream(
    options: LanguageModelV2CallOptions,
  ): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>;
    response?: { headers?: Record<string, string> };
  }> {
    const params = buildParams(options);
    const worker = this.worker;
    const modelId = this.modelId;
    const contentId = nextStreamId();

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        let outputTokens = 0;
        let started = false;

        try {
          for await (const token of worker.generateStream(params)) {
            if (token.error) {
              controller.enqueue({
                type: "error",
                error: token.error,
              } as unknown as LanguageModelV2StreamPart);
              break;
            }

            if (!started) {
              // Emit text-start before first delta
              controller.enqueue({
                type: "text-start",
                id: contentId,
              });
              started = true;
            }

            if (token.token) {
              outputTokens++;
              controller.enqueue({
                type: "text-delta",
                id: contentId,
                delta: token.token,
              });
            }

            if (token.done) {
              // Emit text-end
              controller.enqueue({
                type: "text-end",
                id: contentId,
              });

              // Emit finish
              controller.enqueue({
                type: "finish",
                finishReason: "stop" as LanguageModelV2FinishReason,
                usage: {
                  inputTokens: undefined,
                  outputTokens,
                  totalTokens: undefined,
                },
                response: {
                  modelId,
                  timestamp: new Date(),
                },
              } as unknown as LanguageModelV2StreamPart);
              break;
            }
          }

          // If stream ended without done=true, still close properly
          if (started) {
            controller.enqueue({
              type: "text-end",
              id: contentId,
            });
            controller.enqueue({
              type: "finish",
              finishReason: "stop" as LanguageModelV2FinishReason,
              usage: {
                inputTokens: undefined,
                outputTokens,
                totalTokens: undefined,
              },
            } as unknown as LanguageModelV2StreamPart);
          }
        } catch (error) {
          controller.enqueue({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
          } as unknown as LanguageModelV2StreamPart);
        } finally {
          controller.close();
        }
      },
    });

    return { stream };
  }
}

/**
 * Map Python worker finish reasons to AI SDK finish reasons.
 */
function mapFinishReason(reason: string): LanguageModelV2FinishReason {
  switch (reason) {
    case "stop":
    case "eos":
    case "end_of_text":
      return "stop";
    case "length":
    case "max_tokens":
      return "length";
    case "content_filter":
      return "content-filter";
    default:
      return "stop";
  }
}

/**
 * Collect warnings for unsupported options.
 */
function collectWarnings(
  options: LanguageModelV2CallOptions,
): LanguageModelV2CallWarning[] {
  const warnings: LanguageModelV2CallWarning[] = [];

  if (options.tools && options.tools.length > 0) {
    warnings.push({
      type: "other",
      message: "Lattice Inference does not support tool calls. Tools will be ignored.",
    });
  }

  if (options.responseFormat?.type === "json") {
    warnings.push({
      type: "other",
      message: "Lattice Inference does not support JSON response format. Using plain text.",
    });
  }

  return warnings;
}
