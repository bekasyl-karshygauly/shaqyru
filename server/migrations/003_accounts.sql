-- Run in the SQL editor of the same Supabase project as the invitation tables.
create table if not exists public.shq_cloud_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  title text not null default '',
  data jsonb not null,
  version uuid not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint draft_size check (octet_length(data::text) <= 16777216)
);
create index if not exists shq_cloud_drafts_updated on public.shq_cloud_drafts(user_id, updated_at desc);
alter table public.shq_cloud_drafts enable row level security;
-- Access is through our authenticated server; browser roles cannot read owner tokens.
revoke all on public.shq_cloud_drafts from anon, authenticated;
grant all on public.shq_cloud_drafts to service_role;
