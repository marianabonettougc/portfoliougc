-- Analytics do portfólio Mari Bonetto
-- Execute este arquivo uma única vez no SQL Editor do Supabase.
-- Não coleta nome, e-mail, IP ou dados de contato.

alter table public.visitas
  add column if not exists visitante_id text,
  add column if not exists dispositivo text;

create index if not exists visitas_data_idx on public.visitas (data desc);
create index if not exists visitas_visitante_data_idx on public.visitas (visitante_id, data desc);

create table if not exists public.portfolio_eventos (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  evento text not null check (evento in ('video_play', 'click')),
  visitante_id text not null,
  pagina text,
  alvo text,
  destino text,
  video_titulo text,
  video_marca text,
  video_link text
);

create index if not exists portfolio_eventos_data_idx
  on public.portfolio_eventos (criado_em desc);
create index if not exists portfolio_eventos_evento_data_idx
  on public.portfolio_eventos (evento, criado_em desc);

alter table public.portfolio_eventos enable row level security;

drop policy if exists "dona consulta analytics do portfolio" on public.portfolio_eventos;
create policy "dona consulta analytics do portfolio"
  on public.portfolio_eventos for select to authenticated
  using (public.e_a_dona());

drop policy if exists "visitante registra analytics do portfolio" on public.portfolio_eventos;
create policy "visitante registra analytics do portfolio"
  on public.portfolio_eventos for insert to anon, authenticated
  with check (
    evento in ('video_play', 'click')
    and length(visitante_id) between 8 and 80
    and (video_titulo is null or length(video_titulo) <= 180)
    and (video_marca is null or length(video_marca) <= 120)
    and (video_link is null or length(video_link) <= 500)
    and (alvo is null or length(alvo) <= 120)
    and (destino is null or length(destino) <= 500)
  );

grant insert on public.portfolio_eventos to anon, authenticated;
grant select on public.portfolio_eventos to authenticated;
grant usage, select on sequence public.portfolio_eventos_id_seq to anon, authenticated;

-- Habilita eventos em tempo real para o painel de analytics.
-- Seguro para executar mais de uma vez: só adiciona tabelas ainda ausentes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'visitas'
  ) then
    alter publication supabase_realtime add table public.visitas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'portfolio_eventos'
  ) then
    alter publication supabase_realtime add table public.portfolio_eventos;
  end if;
end $$;
