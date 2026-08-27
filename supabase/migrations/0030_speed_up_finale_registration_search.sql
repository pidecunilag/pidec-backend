-- Fast partial matching for the admin admission queue.
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_finale_registrations_full_name_trgm
  on public.finale_registrations using gin (full_name extensions.gin_trgm_ops);

create index if not exists idx_finale_registrations_email_trgm
  on public.finale_registrations using gin ((email::text) extensions.gin_trgm_ops);

create index if not exists idx_finale_registrations_phone_trgm
  on public.finale_registrations using gin (phone extensions.gin_trgm_ops);

create index if not exists idx_finale_registrations_number_trgm
  on public.finale_registrations using gin (registration_number extensions.gin_trgm_ops);
