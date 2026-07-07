WITH chosen_default AS (
  SELECT id
  FROM public.badge_templates
  WHERE is_default IS TRUE
  ORDER BY created_at DESC NULLS LAST, id DESC
  LIMIT 1
)
UPDATE public.badge_templates
SET is_default = (id IN (SELECT id FROM chosen_default))
WHERE is_default IS TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS badge_templates_single_default_idx
ON public.badge_templates ((is_default))
WHERE is_default IS TRUE;