-- Separate email verification from competition document verification.
alter table public.users
  add column if not exists email_verified_at timestamptz;
