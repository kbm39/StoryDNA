-- StoryDNA Understanding Report: author feedback on the overall read, plus an
-- alignment gate — interpretive conclusions (summary, themes, message, emotional
-- promise) live in story_dna.data as "proposed" until the author confirms or
-- corrects them, at which point the analysis is considered "aligned".
-- (The per-conclusion responses/evidence live inside the jsonb `data` blob.)

alter table story_dna
  add column if not exists understanding_feedback text
    check (understanding_feedback in ('yes', 'mostly', 'no'));

alter table story_dna
  add column if not exists understanding_feedback_note text;

alter table story_dna
  add column if not exists alignment_status text not null default 'pending'
    check (alignment_status in ('pending', 'aligned'));
