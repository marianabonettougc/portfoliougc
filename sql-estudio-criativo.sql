-- ESTÚDIO CRIATIVO (nov/2026): Edição > Criação de fotos (js/estudio-criativo.js)
-- Só cria coisas novas. Nada existente é alterado ou apagado.
-- Regra de acesso igual ao resto do painel: só a dona (e_a_dona()) e só as linhas dela (user_id = auth.uid()).

create table if not exists public.creative_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Projeto sem nome',
  project_type text not null default 'carrossel' check (project_type in ('carrossel','post','sequencia')),
  canvas_width int not null default 1080 check (canvas_width between 200 and 4000),
  canvas_height int not null default 1350 check (canvas_height between 200 and 4000),
  design_json jsonb not null default '{}'::jsonb,
  thumbnail_url text,
  status text not null default 'rascunho' check (status in ('rascunho','em_edicao','pronto','publicado','arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.creative_projects(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  public_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.creative_references (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Referência',
  reference_type text not null default 'imagem',
  source_url text,
  storage_path text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.creative_palettes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  colors jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.creative_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.creative_projects(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version_number int not null,
  design_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, version_number)
);

create index if not exists creative_projects_user_upd on public.creative_projects(user_id, updated_at desc);
create index if not exists creative_assets_project on public.creative_assets(project_id);
create index if not exists creative_assets_user_type on public.creative_assets(user_id, file_type);
create index if not exists creative_references_user on public.creative_references(user_id, created_at desc);
create index if not exists creative_palettes_user on public.creative_palettes(user_id);
create index if not exists creative_versions_project on public.creative_versions(project_id, version_number desc);

create or replace function public.creative_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists creative_projects_touch on public.creative_projects;
create trigger creative_projects_touch before update on public.creative_projects for each row execute function public.creative_touch();

do $$ declare t text; begin
  foreach t in array array['creative_projects','creative_assets','creative_references','creative_palettes','creative_versions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dona e dela" on public.%I', t);
    execute format('create policy "dona e dela" on public.%I for all to authenticated using (public.e_a_dona() and user_id = (select auth.uid())) with check (public.e_a_dona() and user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- arquivos privados (fotos, prints de referência, PDFs, feed, miniaturas): pasta = id da dona
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('estudio-criativo', 'estudio-criativo', false, 15728640,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','text/markdown'])
on conflict (id) do nothing;

drop policy if exists "estudio criativo: dona na sua pasta" on storage.objects;
create policy "estudio criativo: dona na sua pasta" on storage.objects for all to authenticated
  using (bucket_id = 'estudio-criativo' and public.e_a_dona() and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'estudio-criativo' and public.e_a_dona() and (storage.foldername(name))[1] = (select auth.uid())::text);
