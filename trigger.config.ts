import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? "proj_storydna",
  runtime: "node",
  logLevel: "log",
  maxDuration: 3600,
  dirs: ["./trigger"],
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 60_000,
      factor: 2,
      randomize: true,
    },
  },
});
