-- =========================================================
-- ABA "📜 Roteiros" (transcrição pela Supadata)
-- Pode rodar quantas vezes quiser: só ADICIONA, nunca apaga nada.
--
-- A tabela "roteiros" JÁ EXISTE no seu banco e é usada pelo Dashboard,
-- pelas Referências e pela Transcrição. Por isso este arquivo não cria
-- outra: ele acrescenta só os campos que faltavam. Os nomes antigos
-- continuam valendo (assim a aba nova e as antigas mostram os mesmos vídeos):
--   fonte      = origem   ('instagram', 'tiktok', 'youtube' ou 'outro' para escrito na mão)
--   url        = link
--   de_quem    = de_quem  ('meu' ou 'outra')
--   postado_em = data_post
--   tags       = etiquetas (separadas por vírgula)
--   obs        = notas
--   created_at = criado_em
-- =========================================================

-- 1) Campos novos na tabela roteiros
alter table public.roteiros add column if not exists legenda       text;
alter table public.roteiros add column if not exists status        text default 'pronto';
alter table public.roteiros add column if not exists erro          text;
alter table public.roteiros add column if not exists atualizado_em timestamptz default now();
alter table public.roteiros add column if not exists segmentos     jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'roteiros_status_check') then
    alter table public.roteiros add constraint roteiros_status_check
      check (status is null or status in ('processando', 'pronto', 'falhou'));
  end if;
end $$;

create index if not exists roteiros_criado_em_idx on public.roteiros (criado_em desc);

-- atualizado_em muda sozinho a cada edição
create or replace function public.roteiros_atualizado() returns trigger
language plpgsql set search_path = public as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists roteiros_atualizado on public.roteiros;
create trigger roteiros_atualizado before update on public.roteiros
  for each row execute function public.roteiros_atualizado();

-- RLS da tabela roteiros (já estava ligado; aqui só garante)
alter table public.roteiros enable row level security;
revoke all on public.roteiros from anon;

-- 2) Tabela configuracoes (guarda a chave da Supadata, chave e valor)
create table if not exists public.configuracoes (
  chave      text primary key,
  valor      text,
  updated_at timestamptz default now()
);
alter table public.configuracoes enable row level security;
revoke all on public.configuracoes from anon;
grant select, insert, update, delete on public.configuracoes to authenticated;

-- Só você, logada, lê e grava (mesma regra das outras tabelas do painel: e-mail da dona)
drop policy if exists "dona le configuracoes"     on public.configuracoes;
drop policy if exists "dona cria configuracoes"   on public.configuracoes;
drop policy if exists "dona muda configuracoes"   on public.configuracoes;
drop policy if exists "dona apaga configuracoes"  on public.configuracoes;
create policy "dona le configuracoes"    on public.configuracoes for select to authenticated
  using ((auth.jwt() ->> 'email') = 'marianabonettougc@gmail.com');
create policy "dona cria configuracoes"  on public.configuracoes for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'marianabonettougc@gmail.com');
create policy "dona muda configuracoes"  on public.configuracoes for update to authenticated
  using ((auth.jwt() ->> 'email') = 'marianabonettougc@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'marianabonettougc@gmail.com');
create policy "dona apaga configuracoes" on public.configuracoes for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'marianabonettougc@gmail.com');
