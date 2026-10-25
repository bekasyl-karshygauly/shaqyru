-- Optional expanded RSVP answers. Existing names, notes and responses are preserved.
alter table public.shq_guests add column if not exists details jsonb not null default '{}'::jsonb;
