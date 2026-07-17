/** Map internal failures to calm author-safe messages — no stack traces or secrets. */

function looksLikeInternalError(text: string): boolean {
  return (
    /\bat\s+\S+\s+\([^)]+\)/i.test(text) ||
    /\bError:\s/i.test(text) ||
    /\.ts:\d+:\d+/.test(text) ||
    /\.js:\d+:\d+/.test(text) ||
    text.includes("Object.")
  );
}

export function safeErrorForCode(code: string, fallback?: string): string {
  const sanitizedFallback =
    fallback && !looksLikeInternalError(fallback) ? fallback : undefined;

  switch (code) {
    case "VERSION_PIN_MISMATCH":
      return "Your manuscript was updated after this review started. Start a new review on the current version.";
    case "AUTHOR_RESPONSES_PRESENT":
      return "Author responses in Suggested Edits must be cleared before regenerating the Literary Agent review.";
    case "WORKFLOW_CANCELLED":
      return "This Publishing Workflow was cancelled before your results were prepared.";
    case "MISSING_TEXT":
      return "This manuscript has no readable text for review.";
    case "CANONICAL_INPUT_FAILED":
      return "We could not verify the manuscript word count for this review. Please re-upload or contact support.";
    case "TRIGGER_UNAVAILABLE":
      return "Publishing Workflow is temporarily unavailable. Please try again later.";
    case "PIPELINE_FAILED":
      return sanitizedFallback ??
        "The Literary Agent review could not be completed. You can retry when ready.";
    default:
      return sanitizedFallback ?? "Something went wrong with this Publishing Workflow. Please try again later.";
  }
}

export function errorCodeFromMessage(message: string): string {
  if (message.includes("AUTHOR_RESPONSES_PRESENT") || message.includes("author response")) {
    return "AUTHOR_RESPONSES_PRESENT";
  }
  if (message.includes("WORKFLOW_CANCELLED")) return "WORKFLOW_CANCELLED";
  return "PIPELINE_FAILED";
}
