-- Estúdio UGC v1 — extensão aditiva, sem modificar projetos existentes.
-- Execute no Supabase SQL Editor depois de revisar. Idempotente e protegido por RLS.
alter table public.edicao_projetos
  add column if not exists job_id text,
  add column if not exists roteiro_id text,
  add column if not exists conteudo_id bigint,
  add column if not exists etapa text not null default 'planejamento',
  add column if not exists prazo date,
  add column if not exists observacoes text;

create index if not exists edicao_projetos_job_idx on public.edicao_projetos(job_id);
create index if not exists edicao_projetos_roteiro_idx on public.edicao_projetos(roteiro_id);
create index if not exists edicao_projetos_conteudo_idx on public.edicao_projetos(conteudo_id);
create index if not exists edicao_projetos_etapa_idx on public.edicao_projetos(etapa);

create table if not exists public.edicao_arquivos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.edicao_projetos(id) on delete cascade,
  nome text not null,
  tipo text not null default 'outro',
  storage_path text,
  url text,
  tamanho bigint,
  mime_type text,
  notas text,
  criado_em timestamptz not null default now()
);
alter table public.edicao_arquivos enable row level security;
drop policy if exists "dona faz tudo" on public.edicao_arquivos;
create policy "dona faz tudo" on public.edicao_arquivos for all to authenticated
  using (public.e_a_dona()) with check (public.e_a_dona());
create index if not exists edicao_arquivos_projeto_idx on public.edicao_arquivos(projeto_id, criado_em desc);

create table if not exists public.edicao_gravacoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.edicao_projetos(id) on delete cascade,
  titulo text not null default 'Nova gravação',
  data date,
  horario text,
  local text,
  checklist jsonb not null default '[]'::jsonb,
  notas text,
  status text not null default 'planejada'
    check (status in ('planejada','gravada','cancelada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.edicao_gravacoes enable row level security;
drop policy if exists "dona faz tudo" on public.edicao_gravacoes;
create policy "dona faz tudo" on public.edicao_gravacoes for all to authenticated
  using (public.e_a_dona()) with check (public.e_a_dona());
create index if not exists edicao_gravacoes_projeto_idx on public.edicao_gravacoes(projeto_id, data);

create table if not exists public.edicao_entregas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.edicao_projetos(id) on delete cascade,
  titulo text not null default 'Entrega',
  formato text not null default 'Reels',
  versao integer not null default 1,
  status text not null default 'em_producao'
    check (status in ('em_producao','revisao_interna','enviada','ajustes','aprovada','publicada')),
  prazo date,
  link text,
  enviada_em timestamptz,
  notas text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.edicao_entregas enable row level security;
drop policy if exists "dona faz tudo" on public.edicao_entregas;
create policy "dona faz tudo" on public.edicao_entregas for all to authenticated
  using (public.e_a_dona()) with check (public.e_a_dona());
create index if not exists edicao_entregas_projeto_idx on public.edicao_entregas(projeto_id, prazo);

-- Bucket privado para arquivos de produção. O vídeo bruto continua local por padrão;
-- somente arquivos que a usuária anexar explicitamente são enviados.
insert into storage.buckets (id,name,public,file_size_limit)
values ('estudio-ugc','estudio-ugc',false,52428800)
on conflict (id) do nothing;
drop policy if exists "estudio ugc dona le" on storage.objects;
create policy "estudio ugc dona le" on storage.objects for select to authenticated
using (bucket_id='estudio-ugc' and public.e_a_dona());
drop policy if exists "estudio ugc dona grava" on storage.objects;
create policy "estudio ugc dona grava" on storage.objects for insert to authenticated
with check (bucket_id='estudio-ugc' and public.e_a_dona());
drop policy if exists "estudio ugc dona altera" on storage.objects;
create policy "estudio ugc dona altera" on storage.objects for update to authenticated
using (bucket_id='estudio-ugc' and public.e_a_dona())
with check (bucket_id='estudio-ugc' and public.e_a_dona());
drop policy if exists "estudio ugc dona apaga" on storage.objects;
create policy "estudio ugc dona apaga" on storage.objects for delete to authenticated
using (bucket_id='estudio-ugc' and public.e_a_dona());
