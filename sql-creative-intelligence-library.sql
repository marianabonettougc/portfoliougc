-- Creative Intelligence: histórico de pesquisas da Biblioteca de Anúncios.
-- A busca usa a Edge Function ci-ad-library; o token do Apify fica somente nos secrets do Supabase.

create table if not exists public.creative_intelligence_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.creative_intelligence_projects(id) on delete cascade,
  query text not null,
  country text not null default 'BR',
  active_only boolean not null default true,
  media_type_filter text not null default 'all',
  result_count integer not null default 0,
  results jsonb not null default '[]'::jsonb,
  library_search_url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.creative_intelligence_ads
  add column if not exists source text not null default 'manual',
  add column if not exists library_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists ci_searches_project_created
  on public.creative_intelligence_searches(project_id, created_at desc);
create index if not exists ci_searches_user_created
  on public.creative_intelligence_searches(user_id, created_at desc);
create unique index if not exists ci_ads_project_library_id
  on public.creative_intelligence_ads(project_id, library_id)
  where library_id is not null;

alter table public.creative_intelligence_searches enable row level security;
drop policy if exists "creative intelligence owner searches" on public.creative_intelligence_searches;
create policy "creative intelligence owner searches"
  on public.creative_intelligence_searches for all to authenticated
  using (public.e_a_dona() and user_id = (select auth.uid()))
  with check (public.e_a_dona() and user_id = (select auth.uid()));

