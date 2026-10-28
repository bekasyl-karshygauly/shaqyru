-- Separate from organizer alerts. Existing phone contacts are not subscribed.
create table public.shq_client_notifications (
  id uuid primary key default gen_random_uuid(),
  inv text not null references public.shq_invitations(id) on delete cascade,
  revision text not null,
  channel text not null default 'whatsapp' check (channel='whatsapp'),
  order_status text not null check (order_status in ('submitted','accepted','processing','discussion','changes','ready','rejected','published')),
  recipient text not null check (recipient ~ '^[1-9][0-9]{7,14}$'),
  consented_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','retry','sent','failed','skipped')),
  attempts integer not null default 0 check (attempts>=0),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  lease uuid,
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(inv,revision)
);
alter table public.shq_client_notifications enable row level security;
revoke all on public.shq_client_notifications from public,anon,authenticated;
grant select,insert,update,delete on public.shq_client_notifications to service_role;
create index shq_client_notifications_due on public.shq_client_notifications(available_at,id) where status in ('pending','retry');
create index shq_client_notifications_leases on public.shq_client_notifications(locked_until) where status='processing';
create index shq_client_notifications_order on public.shq_client_notifications(inv,created_at desc);

create function public.shq_queue_client_notifications() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare o jsonb; previous jsonb; consent jsonb; consent_at timestamptz;
begin
  o:=new.data->'_order'; previous:=old.data->'_order';
  if o->>'submittedAt' is null then return new; end if;
  if o->>'status' is not distinct from previous->>'status'
     and o#>'{notifications,whatsapp}' is not distinct from previous#>'{notifications,whatsapp}'
     and o->>'rejectionReason' is not distinct from previous->>'rejectionReason' then return new; end if;

  update public.shq_client_notifications set status='skipped',last_error='STATUS_OR_CONSENT_CHANGED'
    where inv=new.id and status in ('pending','retry');
  consent:=o#>'{notifications,whatsapp}';
  if consent->>'enabled' is distinct from 'true' or consent->>'consentVersion' is distinct from 'order-status-v1'
     or coalesce(consent->>'phone','') !~ '^[1-9][0-9]{7,14}$'
     or coalesce(o->>'status','') not in ('submitted','accepted','processing','discussion','changes','ready','rejected','published')
     or new.data->>'_rev' is null then return new; end if;
  begin consent_at:=(consent->>'consentedAt')::timestamptz; exception when others then return new; end;
  if consent_at is null then return new; end if;
  insert into public.shq_client_notifications(inv,revision,order_status,recipient,consented_at)
    values(new.id,new.data->>'_rev',o->>'status',consent->>'phone',consent_at)
    on conflict(inv,revision) do nothing;
  return new;
end $$;
revoke all on function public.shq_queue_client_notifications() from public,anon,authenticated;
grant execute on function public.shq_queue_client_notifications() to service_role;
create trigger shq_queue_client_notifications after update of data on public.shq_invitations
for each row execute function public.shq_queue_client_notifications();

create function public.shq_claim_client_notifications(p_limit integer default 4)
returns setof public.shq_client_notifications
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  update public.shq_client_notifications set status='failed',last_error='LEASE_EXPIRED',lease=null,locked_until=null
    where status='processing' and locked_until<now() and attempts>=6;
  update public.shq_client_notifications set status='skipped',last_error='EVENT_EXPIRED'
    where status in ('pending','retry') and created_at<now()-interval '7 days';
  return query with candidates as (
    select id from public.shq_client_notifications where attempts<6 and
      ((status in ('pending','retry') and available_at<=now()) or (status='processing' and locked_until<now()))
    order by available_at,id limit greatest(1,least(coalesce(p_limit,4),10)) for update skip locked
  ) update public.shq_client_notifications n
    set status='processing',attempts=n.attempts+1,lease=gen_random_uuid(),locked_until=now()+interval '5 minutes'
    from candidates c where n.id=c.id returning n.*;
end $$;
revoke all on function public.shq_claim_client_notifications(integer) from public,anon,authenticated;
grant execute on function public.shq_claim_client_notifications(integer) to service_role;
