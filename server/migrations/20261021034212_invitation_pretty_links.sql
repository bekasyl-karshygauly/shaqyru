create table public.shq_invitation_slugs (
  inv text primary key references public.shq_invitations(id) on delete cascade,
  slug text not null unique,
  created_at timestamptz not null default now(),
  constraint shq_invitation_slug_format check (length(slug) between 3 and 70 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
alter table public.shq_invitation_slugs enable row level security;
revoke all on public.shq_invitation_slugs from public, anon, authenticated;
grant select, insert on public.shq_invitation_slugs to service_role;

create function public.shq_allocate_invitation_slug(p_inv text,p_base text)
returns text language plpgsql security invoker set search_path = '' as $$
declare existing text; candidate text; suffix integer;
begin
  if length(p_base) not between 3 and 54 or p_base !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using errcode='22023',message='Invalid invitation slug';
  end if;
  -- One invitation can acquire only one immutable alias, even across servers.
  perform id from public.shq_invitations where id=p_inv for update;
  if not found then raise exception using errcode='P0002',message='Invitation not found';end if;
  select slug into existing from public.shq_invitation_slugs where inv=p_inv;
  if existing is not null then return existing;end if;
  for suffix in 0..1000 loop
    candidate:=p_base || case when suffix=0 then '' else '-'||(suffix+1)::text end;
    begin
      insert into public.shq_invitation_slugs(inv,slug) values(p_inv,candidate);
      return candidate;
    exception when unique_violation then
      -- A different invitation has the same names; try the next readable suffix.
      null;
    end;
  end loop;
  raise exception using errcode='23505',message='Invitation slug allocation exhausted';
end;
$$;
revoke all on function public.shq_allocate_invitation_slug(text,text) from public,anon,authenticated;
grant execute on function public.shq_allocate_invitation_slug(text,text) to service_role;
