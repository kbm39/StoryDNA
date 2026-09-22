/**
 * Inventory of installed Anthropic structured-output capability.
 * No live calls. Archivist currently uses prompt JSON + deterministic extract.
 */

export const ARCHIVIST_ANTHROPIC_STRUCTURED_OUTPUT_CAPABILITY = {
  sdk_package: "@anthropic-ai/sdk",
  sdk_version: "0.104.2",
  helper: "jsonSchemaOutputFormat",
  request_field: "output_config.format",
  parse_helper: "messages.parse / parsed_output",
  current_archivist_path: "client.messages.stream + prompt-only JSON",
  literary_agent_path: "prompt JSON + deterministic recovery",
  military_calibration_path: "messages.create prompt JSON",
  recommendation:
    "keep prompt JSON plus deterministic extract/envelope for this phase; native output_config is installed but unused and untested on MessageStream",
  adopt_native_now: false,
} as const;
