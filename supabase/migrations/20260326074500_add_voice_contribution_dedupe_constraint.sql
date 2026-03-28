-- Deduplicate historical retries before adding the durable dedupe key.
WITH ranked_duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY contributor_id, audio_path
      ORDER BY created_at DESC, id DESC
    ) AS duplicate_rank
  FROM public.voice_contributions
)
DELETE FROM public.voice_contributions
WHERE id IN (
  SELECT id
  FROM ranked_duplicates
  WHERE duplicate_rank > 1
);

-- Future retries of the same uploaded asset should converge on one durable row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_contributions_contributor_audio_path_unique
ON public.voice_contributions (contributor_id, audio_path);
