# StoryDNA roadmap (deferred milestones)

Items recorded for future sprints. **Not implemented** in the review-provenance milestone.

## Review metadata & freshness

1. **Reviewer version** — track which Literary Agent reviewer definition generated each review.
2. **Review-rules version** — persist the validation/enforcement rules version active at generation time.
3. **StoryDNA engine version** — application release identifier stamped on each review run.
4. **Review freshness status** — computed lifecycle beyond active/superseded (e.g. stale-under-current-rules).

## Editorial workflow

5. **Editorial History across all reviewer types** — extend provenance/history to craft, screen, and other perspectives.
6. **Compare Reviews** — side-by-side diff of two commercial (or cross-version) reviews.
7. **Manuscript Health Record** — consolidated manuscript quality timeline across versions and reviews.
8. **Recommendation lifecycle** for action items:
   - New
   - In Progress
   - Resolved
   - Deferred
   - Intentional
9. **Expert recruitment** — route each Literary Agent action item to a subject-matter expert workflow.
10. **Full-manuscript Track Changes revision output** — DOCX redline export of suggested edits across the manuscript.

## Editorial Workflow Engine (Milestone 1 shipped in code; enable via flag)

Implemented foundation (feature flag off by default):

- `editorial_workflows` + `editorial_workflow_events` (Supabase source of truth)
- Generic metadata columns: department, owner, purpose, participating experts, next best action
- Trigger.dev task `literary-agent-review` (durable orchestration)
- Publishing Workflow UI card (Literary Agent first workflow type)
- Production sync kill via `sync-policy.ts` — no silent fallback when flag is off

**Deferred from Milestone 1:**

- Memo-only rubric optimization (reduce full-manuscript token passes)
- Step artifacts + resumable reuse of memo/rubric outputs on retry
- `editorial_workflow_steps` / `editorial_workflow_artifacts` tables
- Model-call cost ledger
- Global Mission Control UI
- Other workflow types (craft, Producer, StoryDNA discovery, treatments, decks, documents)
- Email notifications on workflow completion
- Full multi-user RLS on workflow tables
- Exact ETA / progress percentages
- Workflow priority reordering
- Editorial Decision Log persistence
- Author-guidance pause mid-workflow
- Next Best Action panel on completion
