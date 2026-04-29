-- =============================================================================
-- PIDEC 1.0 — 0001: Extensions
-- =============================================================================
-- pgcrypto: for gen_random_uuid() and cryptographic primitives (token generation)
-- citext:   case-insensitive text (used for email on public.users for fast lookups)
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";
