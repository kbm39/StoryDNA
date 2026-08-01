import type { UnderstandingFieldKey } from "@/lib/editorial-understanding/contract.ts";

export type IntakeStageDefinition = {
  readonly stage_id: string;
  readonly prompt_key: string;
  readonly question: string;
  readonly placeholder: string;
  readonly label: string;
  readonly required: boolean;
  readonly understanding_field: UnderstandingFieldKey | null;
};

export const EIC_INTAKE_STAGES: readonly IntakeStageDefinition[] = [
  {
    stage_id: "eic_intake.primary_vision",
    prompt_key: "elevator_pitch",
    question: "What is your manuscript about?",
    placeholder: "In a few sentences, tell me what happens — or what it's really about.",
    label: "About your manuscript",
    required: true,
    understanding_field: "primary_vision",
  },
  {
    stage_id: "eic_intake.creative_motivation",
    prompt_key: "author_motivation",
    question: "Why did you write it?",
    placeholder: "What made this book worth your time?",
    label: "Why you wrote it",
    required: true,
    understanding_field: "creative_motivation",
  },
  {
    stage_id: "eic_intake.desired_reader_experience",
    prompt_key: "desired_reader_experience",
    question: "What experience do you want readers to have?",
    placeholder: "Emotionally, intellectually, viscerally — what should they feel or think?",
    label: "Reader experience",
    required: false,
    understanding_field: "desired_reader_experience",
  },
  {
    stage_id: "eic_intake.market_position",
    prompt_key: "market_position",
    question: "Where do you see it in the market?",
    placeholder: "Who is it for? You can write “I'm not sure” if you're still figuring that out.",
    label: "Market position",
    required: true,
    understanding_field: "market_position",
  },
  {
    stage_id: "eic_intake.comparison_titles",
    prompt_key: "comparison_titles",
    question: "Are there books, films, or shows you would compare it to?",
    placeholder: "Optional — comps help me understand tone and positioning.",
    label: "Comparison titles",
    required: false,
    understanding_field: null,
  },
  {
    stage_id: "eic_intake.success_definition",
    prompt_key: "success_definition",
    question: "What would make this editorial process feel successful to you?",
    placeholder: "Query-ready, self-publishing launch, realism pass, or something else.",
    label: "Success for you",
    required: true,
    understanding_field: "success_definition",
  },
] as const;

export const EIC_INTAKE_STAGE_COUNT = EIC_INTAKE_STAGES.length;

export function stageByIndex(index: number): IntakeStageDefinition | null {
  return EIC_INTAKE_STAGES[index] ?? null;
}

export function stageByPromptKey(promptKey: string): IntakeStageDefinition | undefined {
  return EIC_INTAKE_STAGES.find((stage) => stage.prompt_key === promptKey);
}
