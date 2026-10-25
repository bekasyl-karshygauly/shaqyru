create table public.shq_services(
 id text primary key check(id in ('urgent','text','photo')),
 name_ru text not null, name_kz text not null,
 price integer check(price between 0 and 10000000), enabled boolean not null default true,
 position integer not null default 0, version uuid not null default gen_random_uuid()
);
alter table public.shq_services enable row level security;
revoke all on public.shq_services from public,anon,authenticated;
grant select,insert,update,delete on public.shq_services to service_role;
insert into public.shq_services(id,name_ru,name_kz,position) values
 ('urgent','Срочное изготовление','Жедел дайындау',1),
 ('text','Помощь с текстом','Мәтінмен көмек',2),
 ('photo','Обработка фотографий','Фотосуреттерді өңдеу',3);
create table public.shq_reviews(
 inv text primary key references public.shq_invitations(id) on delete cascade,
 name text not null check(length(name) between 1 and 80),
 rating integer not null check(rating between 1 and 5),
 text text not null check(length(text) between 1 and 1500),
 status text not null default 'pending' check(status in ('pending','approved','hidden')),
 version uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(), published_at timestamptz
);
alter table public.shq_reviews enable row level security;
revoke all on public.shq_reviews from public,anon,authenticated;
grant select,insert,update,delete on public.shq_reviews to service_role;
create index shq_reviews_moderation on public.shq_reviews(status,created_at desc,inv);
create index shq_reviews_public on public.shq_reviews(published_at desc) where status='approved';
create function public.shq_order_statistics() returns table(total bigint,published bigint,archived bigint,agreed_amount bigint,by_status jsonb,designs jsonb)
language sql stable security invoker set search_path=pg_catalog,public as $$
 with orders as (
 select data->'_order' as o,coalesce(data->>'dsg','0') as design from public.shq_invitations where data->'_order' is not null
 ), states as (select o->>'status' as state,count(*) as count from orders group by 1),
 popular as (select design,count(*) as count from orders group by 1 order by count(*) desc,design limit 5)
 select (select count(*) from orders),(select count(*) from orders where o->>'publishedAt' is not null),
 (select count(*) from orders where o->>'archivedAt' is not null),
 (select coalesce(sum((o#>>'{approval,price}')::bigint),0) from orders where o#>>'{approval,price}' ~ '^[0-9]+$'),
 coalesce((select jsonb_object_agg(state,count) from states),'{}'::jsonb),
 coalesce((select jsonb_agg(jsonb_build_object('design',design,'count',count)) from popular),'[]'::jsonb);
$$;
revoke all on function public.shq_order_statistics() from public,anon,authenticated;
grant execute on function public.shq_order_statistics() to service_role;
alter table public.shq_order_notifications add column kind text not null default 'order' check(kind in ('order','rsvp')),add column payload jsonb not null default '{}'::jsonb;
create or replace function public.shq_queue_order_notifications() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 if new.data#>>'{_order,submittedAt}' is not null and new.data#>>'{_order,updatedAt}' is distinct from old.data#>>'{_order,updatedAt}' then
 insert into public.shq_order_notifications(inv,revision,channel) values(new.id,new.data->>'_rev','telegram'),(new.id,new.data->>'_rev','whatsapp') on conflict(inv,revision,channel) do nothing;
 end if;
 return new;
end $$;
create function public.shq_queue_guest_alerts() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare o jsonb; event text;
begin
 if new.status not in ('yes','no') or new.status is null then return new; end if;
 if tg_op='UPDATE' then
  if row(new.status,new.cnt,new.note,new.details) is not distinct from row(old.status,old.cnt,old.note,old.details) then return new; end if;
 end if;
 select data->'_order' into o from public.shq_invitations where id=new.inv;
 if o->>'rsvpAlerts'='true' and o->>'publishedAt' is not null then
 event:=gen_random_uuid()::text;
 insert into public.shq_order_notifications(inv,revision,channel,kind,payload)
 select new.inv,event,c,'rsvp',jsonb_build_object('name',new.name,'status',new.status,'cnt',new.cnt,'at',now()) from unnest(array['telegram','whatsapp']) c;
 end if;
 return new;
end $$;
revoke all on function public.shq_queue_guest_alerts() from public,anon,authenticated;
grant execute on function public.shq_queue_guest_alerts() to service_role;
create trigger shq_queue_guest_alerts after insert or update on public.shq_guests for each row execute function public.shq_queue_guest_alerts();
drop function public.shq_claim_order_notifications(text[],integer);
create function public.shq_claim_order_notifications(p_channels text[],p_limit integer default 4,p_rsvp_whatsapp boolean default false)
returns setof public.shq_order_notifications language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
 update public.shq_order_notifications set status='failed',last_error='LEASE_EXPIRED',lease=null,locked_until=null
 where status='processing' and locked_until<now() and attempts>=6 and channel=any(p_channels);
 return query with candidates as (
 select id from public.shq_order_notifications where channel=any(p_channels) and attempts<6
 and (kind<>'rsvp' or channel<>'whatsapp' or p_rsvp_whatsapp)
 and ((status in ('pending','retry') and available_at<=now()) or(status='processing' and locked_until<now()))
 order by available_at,id limit greatest(1,least(coalesce(p_limit,4),10)) for update skip locked
 )
 update public.shq_order_notifications n set status='processing',attempts=n.attempts+1,lease=gen_random_uuid(),locked_until=now()+interval '5 minutes'
 from candidates c where n.id=c.id returning n.*;
end $$;
revoke all on function public.shq_claim_order_notifications(text[],integer,boolean) from public,anon,authenticated;
grant execute on function public.shq_claim_order_notifications(text[],integer,boolean) to service_role;
