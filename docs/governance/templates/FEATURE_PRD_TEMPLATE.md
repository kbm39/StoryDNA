---
no_new_capability: true
rationale: Reusable PRD template; capability propagation block must be completed per feature.
---

# Feature PRD

## Summary

- **Feature name:**
- **Owner:**
- **Target phase:**
- **Constitution baseline:** v1.0 + Amendment 001 (when ratified)

---

## Constitution Compliance

```json
{
  "applicable_sections": ["TBD"],
  "compliance_explanation": "Complete before use.",
  "amendment_required": "No",
  "backward_compatibility_impact": "Complete before use.",
  "certification_impact": "Complete before use."
}
```

Or declare no new capability:

```yaml
no_new_capability: true
rationale: ""
```

---

## Capability Propagation Review

Complete this section when introducing or materially modifying an expert or platform capability.

```json
{
  "new_capability_introduced": "",
  "existing_capability_modified": "",
  "classification": "expert_specific",
  "existing_experts_evaluated": [],
  "future_experts_affected": [],
  "editor_in_chief_impact": "",
  "platform_impact": "",
  "certification_impact": "",
  "propagation_decision": "keep_expert_specific",
  "review_artifact_path": ""
}
```

If no new capability is introduced, set `new_capability_introduced` to `none` and use `no_new_capability: true` above.

---

## Problem

## Goals

## Non-goals

## Acceptance criteria

## Test plan

## Rollout / certification gates
