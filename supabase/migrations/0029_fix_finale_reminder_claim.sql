-- Resolve PL/pgSQL output-column ambiguity when claiming reminder recipients.
create or replace function public.claim_finale_reminder_recipients(
  p_reminder_key text,
  p_limit integer default 100
)
returns table (
  delivery_id uuid,
  registration_id uuid,
  registration_number text,
  full_name text,
  email citext
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if p_reminder_key not in ('3-days', '2-days', '1-day', 'event-day') then
    raise exception 'Invalid finale reminder key';
  end if;

  return query
  with eligible as (
    select r.id
    from public.finale_registrations r
    left join public.finale_reminder_deliveries d
      on d.registration_id = r.id and d.reminder_key = p_reminder_key
    where d.id is null
       or (d.status = 'failed' and d.claimed_at < now() - interval '10 minutes')
       or (d.status = 'pending' and d.claimed_at < now() - interval '30 minutes')
    order by r.created_at
    limit greatest(1, least(p_limit, 500))
  ), claimed as (
    insert into public.finale_reminder_deliveries (
      registration_id,
      reminder_key,
      status,
      attempt_count,
      claimed_at,
      last_error
    )
    select e.id, p_reminder_key, 'pending', 1, now(), null
    from eligible e
    on conflict on constraint finale_reminder_delivery_unique do update
      set status = 'pending',
          attempt_count = public.finale_reminder_deliveries.attempt_count + 1,
          claimed_at = now(),
          last_error = null
      where public.finale_reminder_deliveries.status = 'failed'
         or (
           public.finale_reminder_deliveries.status = 'pending'
           and public.finale_reminder_deliveries.claimed_at < now() - interval '30 minutes'
         )
    returning
      public.finale_reminder_deliveries.id,
      public.finale_reminder_deliveries.registration_id
  )
  select
    c.id,
    r.id,
    r.registration_number,
    r.full_name,
    r.email
  from claimed c
  join public.finale_registrations r on r.id = c.registration_id;
end;
$$;

revoke all on function public.claim_finale_reminder_recipients(text, integer) from public;
revoke all on function public.claim_finale_reminder_recipients(text, integer) from anon, authenticated;
grant execute on function public.claim_finale_reminder_recipients(text, integer) to service_role;
