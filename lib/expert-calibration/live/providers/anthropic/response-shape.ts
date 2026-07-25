export type AnthropicResponseShapeErrorCode =
  | "response_empty"
  | "unsupported_content_block"
  | "response_shape_invalid";

export interface AnthropicContentBlock {
  readonly type: string;
  readonly text?: string;
}

export type AnthropicTextContentValidationResult =
  | { readonly ok: true; readonly text: string }
  | {
      readonly ok: false;
      readonly code: AnthropicResponseShapeErrorCode;
      readonly message: string;
    };

export function validateAnthropicTextContent(
  content: readonly AnthropicContentBlock[],
): AnthropicTextContentValidationResult {
  if (content.length === 0) {
    return {
      ok: false,
      code: "response_empty",
      message: "Provider returned empty content",
    };
  }

  const textBlocks = content.filter((block) => block.type === "text");
  const nonTextBlocks = content.filter((block) => block.type !== "text");

  if (nonTextBlocks.some((block) => block.type === "tool_use")) {
    return {
      ok: false,
      code: "unsupported_content_block",
      message: "Provider returned unsupported tool-use content",
    };
  }

  if (nonTextBlocks.length > 0) {
    return {
      ok: false,
      code: "unsupported_content_block",
      message: "Provider returned unsupported content block",
    };
  }

  if (textBlocks.length !== 1) {
    return {
      ok: false,
      code: "response_shape_invalid",
      message: "Provider returned incompatible multiple text blocks",
    };
  }

  const text = textBlocks[0]?.text ?? "";
  if (text.trim().length === 0) {
    return {
      ok: false,
      code: "response_empty",
      message: "Provider returned whitespace-only text",
    };
  }

  return { ok: true, text };
}
