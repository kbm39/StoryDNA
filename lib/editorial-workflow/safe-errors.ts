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
    case "PROVIDER_OUTPUT_TRUNCATED":
      return "The Military Expert review ran out of output space before finishing. Try again after reducing scope or contact support.";
    case "PROVIDER_TRAILING_PROSE":
      return "The Military Expert response included text after the required JSON object. Please retry the review.";
    case "PROVIDER_TRAILING_COMMENTARY_UNSAFE":
      return "The Military Expert response included extra material after the JSON object that could not be safely removed. Please retry the review.";
    case "PROVIDER_TRAILING_MARKDOWN_UNSAFE":
      return "The Military Expert response included a Markdown summary after the JSON object that could not be safely removed. Please retry the review.";
    case "PROVIDER_MULTIPLE_JSON_PAYLOADS":
      return "The Military Expert response included more than one JSON payload. Please retry the review.";
    case "PROVIDER_MARKDOWN_WRAPPER_INVALID":
      return "The Military Expert response used an invalid markdown wrapper around the JSON object. Please retry the review.";
    case "PROVIDER_JSON_REPAIR_FAILED":
      return "The Military Expert response could not be repaired into a valid JSON object. Please retry the review.";
    case "MISSING_CONTRARY_EVIDENCE":
      return "The Military Expert response omitted required contrary-evidence fields on negative findings. Please retry the review.";
    case "MISSING_UNCERTAINTY_NOTE":
      return "The Military Expert response omitted the required uncertainty note for empty contrary evidence. Please retry the review.";
    case "CONTRARY_EVIDENCE_REPAIR_FAILED":
      return "The Military Expert response could not be repaired to include required contrary-evidence fields. Please retry the review.";
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
