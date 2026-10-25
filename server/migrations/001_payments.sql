-- Run once in the Supabase SQL editor. Existing invitations and guests are preserved.
create table if not exists public.shq_invitations (
  id text primary key, edit_token text not null, data jsonb not null,
  price integer not null, paid boolean not null default false,
  paid_tier integer not null default 0, created timestamptz not null default now()
);
create table if not exists public.shq_guests (
  code text primary key, inv text not null references public.shq_invitations(id) on delete cascade,
  name text not null, status text, cnt integer not null default 1, note text not null default '',
  created timestamptz not null default now(), updated timestamptz
);
create table if not exists public.shq_payments (
  id text primary key, inv text not null references public.shq_invitations(id) on delete cascade,
  amount integer not null check (amount > 0), tier integer not null check (tier between 1 and 4),
  provider_id text unique, checkout_url text,
  status text not null default 'pending' check (status in ('pending','confirmed','failed')),
  created timestamptz not null default now(), confirmed_at timestamptz
);
create index if not exists shq_payments_inv_status on public.shq_payments(inv,status);
create unique index if not exists shq_payments_one_pending_price on public.shq_payments(inv,amount) where status='pending';
alter table public.shq_invitations enable row level security;
alter table public.shq_guests enable row level security;
alter table public.shq_payments enable row level security;
revoke all on public.shq_invitations, public.shq_guests, public.shq_payments from anon, authenticated;
grant all on public.shq_invitations, public.shq_guests, public.shq_payments to service_role;

-- Only the server can record a verified, live, captured payment. Repeats are harmless.
create or replace function public.shq_confirm_payment(p_order text, p_provider text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare pay public.shq_payments;
begin
  select * into pay from public.shq_payments where id=p_order for update;
  if not found or pay.provider_id is distinct from p_provider then return false; end if;
  if pay.status='confirmed' then return true; end if;
  update public.shq_payments set status='confirmed', confirmed_at=now() where id=p_order;
  update public.shq_invitations set paid=true, paid_tier=greatest(coalesce(paid_tier,0),pay.tier) where id=pay.inv;
  return true;
end $$;
revoke all on function public.shq_confirm_payment(text,text) from public, anon, authenticated;
grant execute on function public.shq_confirm_payment(text,text) to service_role;
notify pgrst, 'reload schema';

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('shaqyru-audio','shaqyru-audio',true,15728640,array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/m4a','audio/x-m4a','audio/mp4','audio/aac','audio/ogg','audio/webm'])
on conflict(id) do nothing;
