-- Optional performance migration. No records are updated or removed.
-- Review and run on staging before applying to a large live table.
create index if not exists shq_guests_inv_created on public.shq_guests(inv,created);
