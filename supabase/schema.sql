-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table public.saved_studies (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pmid text not null check (pmid ~ '^\d+$'),
  title text not null check (char_length(title) <= 500),
  saved_at timestamptz not null default now(),
  primary key (user_id, pmid)
);

alter table public.saved_studies enable row level security;

-- Each user can only see and change their own rows
create policy "own rows" on public.saved_studies
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
