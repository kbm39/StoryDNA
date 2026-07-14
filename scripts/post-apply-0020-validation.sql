-- Post-apply validation for migration 0020_review_grading.sql
-- Run manually after applying migration; do not run as part of migration.

-- 1. All 14 grading columns exist and remain nullable
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'reviews'
  AND column_name IN (
    'manuscript_score', 'manuscript_letter_grade', 'craft_score',
    'acquisition_readiness_score', 'grading_formula_version', 'grade_status',
    'review_reliability_status', 'canonical_word_count', 'words_analyzed',
    'statistics_validation_status', 'evidence_completeness_status',
    'arithmetic_validation_status', 'rubric_breakdown', 'grading_metadata'
  )
ORDER BY column_name;

-- 2. Legacy reviews unchanged (NULL grading columns)
SELECT id, lifecycle_status, perspective,
       manuscript_score IS NULL AS legacy_grading,
       length(content) AS content_len
FROM public.reviews
WHERE grading_formula_version IS NULL
ORDER BY created_at;

-- 3. Exactly one publish_commercial_review_generation overload
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'publish_commercial_review_generation';

-- 4. Only service_role may execute
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'publish_commercial_review_generation'
ORDER BY grantee;

-- 5. Null grading payload rejected (expect exception; use rollback)
-- BEGIN;
-- SELECT public.publish_commercial_review_generation(
--   '<manuscript-uuid>'::uuid, 'anthropic', 'test', 'content',
--   '{}'::jsonb, '{}'::jsonb, NULL
-- );
-- ROLLBACK;

-- 6. Invalid grade_status rejected (expect exception; use rollback)
-- BEGIN;
-- SELECT public.publish_commercial_review_generation(
--   '<manuscript-uuid>'::uuid, 'anthropic', 'test', 'content',
--   '{}'::jsonb, '{}'::jsonb,
--   '{"grade_status":"WITHHELD","statistics_validation_status":"VERIFIED",
--     "arithmetic_validation_status":"VERIFIED","evidence_completeness_status":"COMPLETE",
--     "grading_formula_version":"STORYDNA_COMMERCIAL_FICTION_RUBRIC_V1",
--     "manuscript_score":78,"craft_score":52,"acquisition_readiness_score":26,
--     "canonical_word_count":108845,"rubric_breakdown":{"craft_categories":[]}}'::jsonb
-- );
-- ROLLBACK;

-- 7. No legacy reviews rewritten with grading data
SELECT count(*) AS illegitimate_legacy_grading_rows
FROM public.reviews
WHERE grading_formula_version IS NULL
  AND (manuscript_score IS NOT NULL OR rubric_breakdown IS NOT NULL);
