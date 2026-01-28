import assert from "@/common/utils/assert";
import type { UnixReasoningPart, UnixTextPart, UnixToolPart } from "@/common/types/message";

export function extractAssistantText(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return "";
  }

  const textParts = (parts as UnixTextPart[]).filter(
    (part): part is UnixTextPart => part.type === "text"
  );
  return textParts
    .map((part) => {
      assert(typeof part.text === "string", "Text part must include text");
      return part.text;
    })
    .join("");
}

export function extractReasoning(parts: unknown): string[] {
  if (!Array.isArray(parts)) {
    return [];
  }

  const reasoningParts = (parts as UnixReasoningPart[]).filter(
    (part): part is UnixReasoningPart => part.type === "reasoning"
  );
  return reasoningParts.map((part) => {
    assert(typeof part.text === "string", "Reasoning part must include text");
    return part.text;
  });
}

export function extractToolCalls(parts: unknown): UnixToolPart[] {
  if (!Array.isArray(parts)) {
    return [];
  }

  return (parts as UnixToolPart[]).filter(
    (part): part is UnixToolPart => part.type === "dynamic-tool"
  );
}
