# Expert Professional Standards

Professional standards are part of an expert’s **professional identity** and **professional constitution**, not provider-specific prompt prose. They live in `ExpertDefinitionV1.professional_standards` and are validated at registry ingest.

The registry is **not a prompt repository**. It defines who the expert is professionally — including competencies, limitations, and evidence obligations — so StoryDNA can orchestrate the right specialists instead of treating every expert as interchangeable.

## Purpose

StoryDNA experts must:

- Reason from evidence, not seek evidence to justify conclusions
- Respect author intent and remain constructive
- Never invent manuscript facts
- Distinguish fact from judgment
- Defer to specialists when a concern exceeds their competency
- Treat unsupported opinions as non-publishable findings

## Expertise model

```
Knowledge Domains   →  what the expert understands
Competencies        →  what the expert is qualified to evaluate
Limitations         →  what the expert is NOT qualified to evaluate
Professional Responsibility
  should_evaluate   →  core mandate
  may_evaluate      →  permitted but not primary
  must_not_evaluate →  explicit deferral to specialists
```

Future Editor-in-Chief orchestration uses these boundaries to request specialists when:

- A concern falls outside competency
- A limitation is encountered
- Domain confidence falls below threshold
- Contrary evidence requires another specialty

## Schema fields

```typescript
professional_standards: {
  principles: string[];
  ethics: string[];
  author_respect_rules: string[];
  evidence_standards: string[];
  verification_standards: string[];
  bias_avoidance_rules: string[];
  disclosure_requirements: string[];
  uncertainty_rules: string[];
  conflict_handling_rules: string[];
  confidence_thresholds: ConfidenceThresholds;
  source_integrity_rules: string[];
  non_fabrication_rules: string[];
  contrary_evidence_obligations: string[];
  escalation_rules: string[];
  specialist_deference_rules: string[];
  prediction_and_market_limitations: string[];
}
```

All listed string arrays are **required and non-empty** at validation time (core fields).

## Founder principles reflected

| Principle | Implementation |
|-----------|----------------|
| Author is final decision-maker | `author_respect_rules`, constructive guidance |
| No invented facts | `non_fabrication_rules`, evidence policy |
| Evidence-first | `evidence_standards`, evaluation `reasoning_rules` |
| Contrary evidence before repeat criticism | `contrary_evidence_obligations`, evidence policy |
| Specialist deference | `specialist_deference_rules`, `escalation_rules` |
| No market predictions as facts | `prediction_and_market_limitations` |
| Model-agnostic identity | No provider fields in standards |

## Relationship to evaluation and evidence

```
Professional Standards  →  what the expert must uphold
Knowledge + Competencies + Limitations  →  what the expert may address
Evaluation Framework    →  how the expert assesses work
Evidence Policy         →  what proof is required for outputs
```

Prompts may later be **assembled** from these layers. Prompts are not the source of truth.

## Domain confidence (future)

`knowledge.domain_confidence` supports per-domain confidence (0–100). Phase 1 stores declarative ceilings in seeds; Expert Runtime may compute live values later. Example: Literary Agent — high confidence in commercial marketability, low in medical realism.

## Execute Expert (future)

Publishing Workflow will eventually **Execute Expert** via `expert_version_id`, not hard-coded reviewer types. Phase 1 documents this; runtime remains code-defined for Literary Agent.

## Literary Agent

The Literary Agent’s runtime behavior (commercial scoring, contrary-evidence gate, memo repair, atomic publication) remains in `lib/ai/review-engine.ts`. The registry mirror copies professional standards **conceptually** via `reviewerDefinitionToExpertDefinition` but does **not** change runtime behavior in Phase 1.

## Future

Editor-in-Chief will coordinate experts but will **not** replace their professional standards. Each specialist retains its own standards; the Editor-in-Chief adds orchestration standards on top.
