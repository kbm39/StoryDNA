-- Extend editorial workflow types for Kevin Studio local Military Expert testing only.

alter table public.editorial_workflows
  drop constraint if exists editorial_workflows_workflow_type_check;

alter table public.editorial_workflows
  add constraint editorial_workflows_workflow_type_check
  check (workflow_type in ('literary_agent_review', 'military_expert_review'));
