-- Migration: Landing content management
-- Purpose: Sponsors, partners, and FAQs for the public landing page

CREATE TABLE IF NOT EXISTS public.landing_sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text NOT NULL,
  website_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.landing_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text NOT NULL,
  website_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.landing_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_landing_sponsors_edition_sort
  ON public.landing_sponsors(edition_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_landing_partners_edition_sort
  ON public.landing_partners(edition_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_landing_faqs_edition_sort
  ON public.landing_faqs(edition_id, sort_order)
  WHERE deleted_at IS NULL;

ALTER TABLE public.landing_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage landing sponsors" ON public.landing_sponsors;
CREATE POLICY "Service role can manage landing sponsors"
  ON public.landing_sponsors
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage landing partners" ON public.landing_partners;
CREATE POLICY "Service role can manage landing partners"
  ON public.landing_partners
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage landing faqs" ON public.landing_faqs;
CREATE POLICY "Service role can manage landing faqs"
  ON public.landing_faqs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
