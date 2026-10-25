create table public.shq_order_notifications (
  id uuid primary key default gen_random_uuid(),
  inv text not null references public.shq_invitations(id) on delete cascade,
  revision text not null,
  channel text not null check (channel in ('telegram','whatsapp')),
  status text not null default 'pending' check (status in ('pending','processing','retry','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_until timestamptz,
  lease uuid,
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (inv,revision,channel)
);
alter table public.shq_order_notifications enable row level security;
revoke all on public.shq_order_notifications from public, anon, authenticated;
grant select,insert,update,delete on public.shq_order_notifications to service_role;
create index shq_order_notifications_due on public.shq_order_notifications(channel,available_at) where status in ('pending','retry');
create index shq_order_notifications_leases on public.shq_order_notifications(channel,locked_until) where status='processing';
create index shq_order_notifications_order on public.shq_order_notifications(inv,created_at desc);

create function public.shq_queue_order_notifications() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if new.data#>>'{_order,status}'='submitted'
     and new.data->'_order' is distinct from old.data->'_order' then
    insert into public.shq_order_notifications(inv,revision,channel)
    values (new.id,new.data->>'_rev','telegram'),(new.id,new.data->>'_rev','whatsapp')
    on conflict (inv,revision,channel) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.shq_queue_order_notifications() from public,anon,authenticated;
grant execute on function public.shq_queue_order_notifications() to service_role;
create trigger shq_queue_order_notifications after update of data on public.shq_invitations
for each row execute function public.shq_queue_order_notifications();

create function public.shq_claim_order_notifications(p_channels text[],p_limit integer default 4)
returns setof public.shq_order_notifications
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  update public.shq_order_notifications set status='failed',last_error='LEASE_EXPIRED',lease=null,locked_until=null
  where status='processing' and locked_until<now() and attempts>=6 and channel=any(p_channels);
  return query
  with candidates as (
    select id from public.shq_order_notifications
    where channel=any(p_channels) and attempts<6 and
      ((status in ('pending','retry') and available_at<=now()) or (status='processing' and locked_until<now()))
    order by available_at,id
    limit greatest(1,least(coalesce(p_limit,4),10)) for update skip locked
  )
  update public.shq_order_notifications n
  set status='processing',attempts=n.attempts+1,lease=gen_random_uuid(),locked_until=now()+interval '5 minutes'
  from candidates c where n.id=c.id returning n.*;
end;
$$;
revoke all on function public.shq_claim_order_notifications(text[],integer) from public,anon,authenticated;
grant execute on function public.shq_claim_order_notifications(text[],integer) to service_role;
