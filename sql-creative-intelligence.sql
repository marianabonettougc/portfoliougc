-- Creative Intelligence: briefings e biblioteca de anúncios por projeto.
-- Acesso restrito à dona do painel. Aplicar no SQL Editor do Supabase.
create table if not exists public.creative_intelligence_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  brand text not null default '',
  product text not null default '',
  objective text not null default '',
  audience text not null default '',
  briefing text not null default '',
  voice text not null default '',
  deliverables text not null default '',
  restrictions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.creative_intelligence_ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.creative_intelligence_projects(id) on delete cascade,
  title text not null,
  url text not null,
  platform text not null default 'Outra',
  performance_note text not null default '',
  transcript text not null default '',
  analysis jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ci_projects_user_updated on public.creative_intelligence_projects(user_id,updated_at desc);
create index if not exists ci_ads_project_created on public.creative_intelligence_ads(project_id,created_at desc);
alter table public.creative_intelligence_projects enable row level security;
alter table public.creative_intelligence_ads enable row level security;
drop policy if exists "creative intelligence owner projects" on public.creative_intelligence_projects;
create policy "creative intelligence owner projects" on public.creative_intelligence_projects for all to authenticated using (public.e_a_dona() and user_id=(select auth.uid())) with check (public.e_a_dona() and user_id=(select auth.uid()));
drop policy if exists "creative intelligence owner ads" on public.creative_intelligence_ads;
create policy "creative intelligence owner ads" on public.creative_intelligence_ads for all to authenticated using (public.e_a_dona() and user_id=(select auth.uid())) with check (public.e_a_dona() and user_id=(select auth.uid()));
create or replace function public.ci_touch_project() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists ci_projects_touch on public.creative_intelligence_projects;
create trigger ci_projects_touch before update on public.creative_intelligence_projects for each row execute function public.ci_touch_project();
