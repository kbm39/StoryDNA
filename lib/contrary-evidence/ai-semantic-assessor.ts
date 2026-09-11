import Anthropic from "@anthropic-ai/sdk";
import { assessConcernDeterministic } from "./assess.ts";
import {
  parseSemanticAssessmentJson,
  SEMANTIC_ASSESSOR_JSON_CONTRACT,
} from "./semantic-schema.ts";
import type { SemanticAssessor, SemanticAssessorInput, SemanticAssessmentResult } from "./types.ts";
import type { ProviderCallHooks } from "@/lib/ai/provider-call-hooks";
import type { ProviderTokenUsage } from "@/lib/editorial-generation/literary-agent-cost";
import { usageFromAnthropicMessage } from "@/lib/editorial-generation/literary-agent-cost";
import {
  ProviderExecutionAbortedError,
  runWithProviderExecutionKeepAlive,
} from "@/lib/ai/provider-execution";
import { WorkflowCancelledError } from "@/lib/editorial-workflow/types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

export interface SemanticAssessorCallHooks extends ProviderCallHooks {
  onUsage?: (usage: ProviderTokenUsage & { model: string }) => void;
}

function formatSnippets(
  label: string,
  snippets: SemanticAssessorInput["candidate_supporting"],
): string {
  if (snippets.length === 0) return `${label}: (none)`;
  return `${label}:\n${snippets
    .slice(0, 6)
    .map((s) => `- [${s.relevance}] ${s.location ?? "n/a"}: ${s.text.slice(0, 200)}`)
    .join("\n")}`;
}

function buildAssessorPrompt(input: SemanticAssessorInput): string {
  const c = input.prior_concern;
  return `Assess whether a prior editorial criticism still applies to the current manuscript revision.

${SEMANTIC_ASSESSOR_JSON_CONTRACT}

Prior criticism: ${c.prior_criticism}
Prior evidence quotations:
${c.prior_evidence.map((q) => `- "${q}"`).join("\n") || "(none)"}
Rubric category: ${input.rubric_category ?? "n/a"}
Root issue: ${c.root_issue}
Genre: ${input.genre_profile.primary_genre} (${input.genre_profile.narrative_mode})

${formatSnippets("Current supporting evidence candidates", input.candidate_supporting)}
${formatSnippets("Current contrary evidence candidates", input.candidate_contrary)}

Revision notes:
${input.revision_notes.map((n) => `- ${n}`).join("\n") || "(none)"}

Version diff additions (sample):
${input.version_diff_evidence.additions.slice(0, 4).map((a) => `- ${a.slice(0, 160)}`).join("\n") || "(none)"}

Version diff removals (sample):
${input.version_diff_evidence.removals.slice(0, 4).map((r) => `- ${r.slice(0, 160)}`).join("\n") || "(none)"}`;
}

/** AI-backed semantic assessor using the Anthropic provider. Falls back to deterministic rules on failure. */
export function createAiSemanticAssessor(
  callHooks?: SemanticAssessorCallHooks,
): SemanticAssessor {
  return {
    async assess(input: SemanticAssessorInput): Promise<SemanticAssessmentResult> {
      if (!process.env.ANTHROPIC_API_KEY) {
        return assessConcernDeterministic(input);
      }

      try {
        const client = new Anthropic();
        await callHooks?.onBeforeProviderCall?.();
        const response = await runWithProviderExecutionKeepAlive(
          ({ signal }) =>
            client.messages.create(
              {
                model: MODEL,
                max_tokens: 1024,
                system:
                  "You assess revision impact on prior editorial criticisms. Output ONLY valid JSON. Never assign manuscript letter grades or overall scores.",
                messages: [{ role: "user", content: buildAssessorPrompt(input) }],
              },
              { signal },
            ),
          {
            onExecutionHeartbeat: callHooks?.onExecutionHeartbeat,
            shouldCancel: callHooks?.shouldCancel,
            abortSignal: callHooks?.abortSignal,
          },
        );

        const usage = usageFromAnthropicMessage(response.usage);
        callHooks?.onUsage?.({ ...usage, model: response.model || MODEL });

        const text = response.content
          .filter((b) => b.type === "text")
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("")
          .trim();

        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        if (jsonStart < 0 || jsonEnd <= jsonStart) {
          return assessConcernDeterministic(input);
        }

        const parsed = parseSemanticAssessmentJson(JSON.parse(text.slice(jsonStart, jsonEnd + 1)));
        if (!parsed) return assessConcernDeterministic(input);
        return parsed;
      } catch (e) {
        if (e instanceof WorkflowCancelledError || e instanceof ProviderExecutionAbortedError) throw e;
        return assessConcernDeterministic(input);
      }
    },
  };
}

/** Test / CI assessor — deterministic only, no API calls. */
export function createDeterministicSemanticAssessor(): SemanticAssessor {
  return { assess: assessConcernDeterministic };
}

/** Production default unless overridden. */
export function defaultSemanticAssessor(
  callHooks?: SemanticAssessorCallHooks,
): SemanticAssessor {
  if (process.env.CONTRARY_EVIDENCE_DETERMINISTIC === "1") {
    return createDeterministicSemanticAssessor();
  }
  return createAiSemanticAssessor(callHooks);
}
