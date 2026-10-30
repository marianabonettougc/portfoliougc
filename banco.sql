-- =====================================================================
-- BANCO DE DADOS DO PAINEL DA MARI BONETTO
-- Onde colar: Supabase > seu projeto > menu da esquerda "SQL Editor" >
-- botão "New query" > cole TUDO isto > clique em "Run".
-- Pode rodar mais de uma vez sem estragar nada: ele só cria o que ainda não existe.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) QUEM É A DONA
-- Uma função pequena que responde "sim" só quando quem está logado
-- é o e-mail da Mari. Todas as regras de segurança usam ela.
-- ---------------------------------------------------------------------
create or replace function public.e_a_dona()
returns boolean
language sql
stable
set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'marianabonettougc@gmail.com'
$$;


-- ---------------------------------------------------------------------
-- 2) VÍDEOS DO PORTFÓLIO
-- O site lê daqui os vídeos que aparecem em "Meus cases de sucesso".
-- destaque = texto das visualizações, ex.: "+470k"
-- ordem = posição no site (menor aparece primeiro)
-- visivel = se aparece no site ou fica escondido
-- exemplo = linha de exemplo, só para mostrar o formato (pode apagar)
-- ---------------------------------------------------------------------
create table if not exists public.videos (
  id          bigint generated always as identity primary key,
  titulo      text not null default '',
  link        text not null default '',
  nicho       text,
  formato     text,
  marca       text,
  destaque    text,
  ordem       integer not null default 0,
  visivel     boolean not null default true,
  exemplo     boolean not null default false,
  criado_em   timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 3) MARCAS (sua base de contatos de empresa)
-- situacao: lead, conversando, cliente ou parada
-- Quem manda o formulário do site entra aqui como "lead".
-- ---------------------------------------------------------------------
create table if not exists public.marcas (
  id              bigint generated always as identity primary key,
  nome            text not null default '',
  instagram       text,
  email           text,
  telefone        text,
  situacao        text not null default 'lead'
                  check (situacao in ('lead', 'conversando', 'cliente', 'parada')),
  obs             text,
  ultimo_contato  date,
  exemplo         boolean not null default false,
  criado_em       timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 4) CALENDÁRIO
-- tipo: gravar, editar ou postar
-- status: a fazer ou feito
-- ---------------------------------------------------------------------
create table if not exists public.calendario (
  id         bigint generated always as identity primary key,
  titulo     text not null default '',
  marca      text,
  tipo       text not null default 'gravar'
             check (tipo in ('gravar', 'editar', 'postar')),
  data       date not null default current_date,
  status     text not null default 'a fazer'
             check (status in ('a fazer', 'feito')),
  exemplo    boolean not null default false,
  criado_em  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 5) CAMPANHAS
-- tipo: Conteúdo ou Publicidade
-- status, na ordem do funil: Briefing, Roteiro, Aprovação Roteiro,
-- Gravação, Edição, Aprovado, Entregue
-- pagamento: pendente ou pago
-- ---------------------------------------------------------------------
create table if not exists public.campanhas (
  id         bigint generated always as identity primary key,
  campanha   text not null default '',
  cliente    text,
  tipo       text not null default 'Conteúdo'
             check (tipo in ('Conteúdo', 'Publicidade')),
  status     text not null default 'Briefing'
             check (status in ('Briefing', 'Roteiro', 'Aprovação Roteiro', 'Gravação', 'Edição', 'Aprovado', 'Entregue')),
  qtd        integer not null default 1,
  valor      numeric(12,2) not null default 0,
  prazo      date,
  pagamento  text not null default 'pendente'
             check (pagamento in ('pendente', 'pago')),
  ativa      boolean not null default true,
  favorita   boolean not null default false,
  exemplo    boolean not null default false,
  criado_em  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 6) MARCADOS (o que você já marcou no checklist)
-- chave = um texto que identifica cada item do checklist
-- ---------------------------------------------------------------------
create table if not exists public.marcados (
  chave          text primary key,
  marcado        boolean not null default true,
  atualizado_em  timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 7) VISITAS (métricas do portfólio)
-- Cada vez que alguém abre o portfólio, entra uma linha aqui.
-- pagina = qual página foi aberta
-- origem = de onde a pessoa veio (Instagram, Google, direto...)
-- Não guarda nome, e-mail, IP nem nada da pessoa.
-- ---------------------------------------------------------------------
create table if not exists public.visitas (
  id      bigint generated always as identity primary key,
  data    timestamptz not null default now(),
  pagina  text,
  origem  text
);


-- ---------------------------------------------------------------------
-- 8) A TRANCA: RLS (Row Level Security) LIGADO EM TODAS AS TABELAS
-- Com o RLS ligado, ninguém lê nem escreve nada, a não ser o que as
-- regras abaixo deixarem.
-- ---------------------------------------------------------------------
alter table public.videos     enable row level security;
alter table public.marcas     enable row level security;
alter table public.calendario enable row level security;
alter table public.campanhas  enable row level security;
alter table public.marcados   enable row level security;
alter table public.visitas    enable row level security;


-- ---------------------------------------------------------------------
-- 9) REGRAS: SÓ A MARI LOGADA LÊ E ESCREVE
-- Para cada tabela, uma regra que libera tudo (ler, criar, editar,
-- apagar) somente para a dona logada. Quem não está logado não vê nada.
-- O "drop policy if exists" só serve para poder rodar de novo sem erro.
-- ---------------------------------------------------------------------
drop policy if exists "dona faz tudo" on public.videos;
create policy "dona faz tudo" on public.videos
  for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());

drop policy if exists "dona faz tudo" on public.marcas;
create policy "dona faz tudo" on public.marcas
  for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());

drop policy if exists "dona faz tudo" on public.calendario;
create policy "dona faz tudo" on public.calendario
  for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());

drop policy if exists "dona faz tudo" on public.campanhas;
create policy "dona faz tudo" on public.campanhas
  for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());

drop policy if exists "dona faz tudo" on public.marcados;
create policy "dona faz tudo" on public.marcados
  for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());

drop policy if exists "dona faz tudo" on public.visitas;
create policy "dona faz tudo" on public.visitas
  for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());


-- ---------------------------------------------------------------------
-- 10) AS DUAS ÚNICAS EXCEÇÕES (qualquer pessoa, mesmo sem login)
-- a) INSERIR em marcas, vindo do formulário do site: só pode entrar
--    como "lead" e não pode se marcar como exemplo.
-- b) INSERIR em visitas.
-- Nas duas, a pessoa só GRAVA. Ler continua sendo só você.
-- ---------------------------------------------------------------------
drop policy if exists "formulario do site cria lead" on public.marcas;
create policy "formulario do site cria lead" on public.marcas
  for insert to anon, authenticated
  with check (situacao = 'lead' and exemplo = false);

drop policy if exists "qualquer um registra visita" on public.visitas;
create policy "qualquer um registra visita" on public.visitas
  for insert to anon, authenticated
  with check (true);


-- ---------------------------------------------------------------------
-- 11) O SITE PRECISA VER OS VÍDEOS QUE ESTÃO NO AR
-- Para o portfólio mostrar os vídeos sem ninguém logado, criamos uma
-- "vitrine": uma função que devolve SÓ os vídeos visíveis e que não são
-- exemplo, e SÓ as colunas que o site usa. A tabela videos continua
-- trancada: ninguém de fora lê a tabela em si.
-- ---------------------------------------------------------------------
create or replace function public.videos_no_ar()
returns table (titulo text, link text, nicho text, formato text, marca text, destaque text, ordem integer)
language sql
stable
security definer
set search_path = public
as $$
  select titulo, link, nicho, formato, marca, destaque, ordem
  from public.videos
  where visivel = true and exemplo = false
  order by ordem, id
$$;
revoke all on function public.videos_no_ar() from public;
grant execute on function public.videos_no_ar() to anon, authenticated;


-- ---------------------------------------------------------------------
-- 12) PRIMEIROS DADOS
-- Os 3 vídeos que já estão no seu site hoje (para o site não ficar vazio)
-- e UMA linha de exemplo em cada lista, marcada como exemplo, para você
-- entender o formato e apagar depois. Só entra se a tabela estiver vazia.
-- ---------------------------------------------------------------------
insert into public.videos (titulo, link, marca, destaque, ordem, visivel, exemplo)
select * from (values
  ('Unicesumar', 'https://www.youtube.com/shorts/vIAAHLv0V18', 'Unicesumar', '+5,5 mi', 1, true, false),
  ('Vídeo 02', 'https://youtu.be/x3cTwB7OKOY', null, '+470k', 2, true, false),
  ('Piccadilly', 'https://youtube.com/shorts/MFT4boPq418', 'Piccadilly', '+55k', 3, true, false),
  ('Exemplo: título do vídeo', 'https://www.youtube.com/shorts/COLE_O_LINK_AQUI', 'Marca exemplo', '+0 views', 99, false, true)
) as v(titulo, link, marca, destaque, ordem, visivel, exemplo)
where not exists (select 1 from public.videos);

insert into public.marcas (nome, instagram, email, telefone, situacao, obs, ultimo_contato, exemplo)
select 'Marca exemplo', '@marcaexemplo', 'contato@marcaexemplo.com', '11999999999', 'lead',
       'Linha de exemplo: pode apagar.', current_date, true
where not exists (select 1 from public.marcas);

insert into public.calendario (titulo, marca, tipo, data, status, exemplo)
select 'Exemplo: gravar vídeo', 'Marca exemplo', 'gravar', current_date, 'a fazer', true
where not exists (select 1 from public.calendario);

insert into public.campanhas (campanha, cliente, tipo, status, qtd, valor, prazo, pagamento, ativa, favorita, exemplo)
select 'Campanha exemplo', 'Marca exemplo', 'Conteúdo', 'Briefing', 1, 0, current_date + 7, 'pendente', true, false, true
where not exists (select 1 from public.campanhas);


-- ---------------------------------------------------------------------
-- 12b) ROTEIROS (aba de transcrição de vídeos do YouTube, Instagram e TikTok)
-- de_quem: 'outra' (vídeo de outra pessoa) ou 'meu' (vídeo seu)
-- origem: instagram, tiktok, youtube ou outro
-- gancho_tipo: pergunta, promessa, dor, curiosidade, polêmica, número...
-- desenvolvimento: um passo por linha
-- expressoes e etiquetas: separadas por vírgula
-- ---------------------------------------------------------------------
create table if not exists public.roteiros (
  id               bigint generated always as identity primary key,
  titulo           text not null default '',
  de_quem          text not null default 'outra' check (de_quem in ('outra', 'meu')),
  perfil           text,
  data_post        date,
  origem           text not null default 'instagram' check (origem in ('instagram', 'tiktok', 'youtube', 'outro')),
  link             text,
  etiquetas        text,
  gancho           text,
  gancho_tipo      text,
  desenvolvimento  text,
  cta              text,
  expressoes       text,
  por_que          text,
  transcricao      text,
  notas            text,
  exemplo          boolean not null default false,
  criado_em        timestamptz not null default now()
);
alter table public.roteiros enable row level security;
drop policy if exists "dona faz tudo" on public.roteiros;
create policy "dona faz tudo" on public.roteiros
  for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());

insert into public.roteiros (titulo, de_quem, perfil, origem, link, etiquetas, gancho, gancho_tipo, desenvolvimento, cta, expressoes, por_que, transcricao, notas, exemplo)
select 'Exemplo: como organizar a geladeira em 3 passos', 'outra', 'perfilexemplo', 'youtube', '',
       'organização, tutorial', 'Sua geladeira também vira bagunça na quarta-feira?', 'pergunta',
       E'Passo 1: tirar tudo e separar por categoria.\nPasso 2: potes iguais para cada tipo.\nPasso 3: etiquetas com a data.',
       'Salva esse vídeo pra fazer no fim de semana.', 'bagunça, potes iguais, fim de semana',
       'Abre com uma pergunta que a pessoa responde "sim" na cabeça e entrega passos curtos.',
       E'Sua geladeira também vira bagunça na quarta-feira? Passo 1: tirar tudo e separar por categoria. Passo 2: potes iguais para cada tipo. Passo 3: etiquetas com a data. Salva esse vídeo pra fazer no fim de semana.',
       'Linha de exemplo: pode apagar.', true
where not exists (select 1 from public.roteiros);


-- ---------------------------------------------------------------------
-- 12c) GESTÃO UGC (o aplicativo de gestão que abre dentro do painel)
-- Guarda tudo do aplicativo (jobs, financeiro, planner...) em uma linha só.
-- Só a dona do painel lê e grava.
-- ---------------------------------------------------------------------
create table if not exists public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_state enable row level security;
drop policy if exists "dona faz tudo" on public.app_state;
create policy "dona faz tudo" on public.app_state
  for all to authenticated
  using (public.e_a_dona() and auth.uid() = user_id)
  with check (public.e_a_dona() and auth.uid() = user_id);
revoke all on public.app_state from anon;

-- Cópias de segurança automáticas do aplicativo (para nunca perder dados).
-- O banco guarda uma cópia sozinho: a cada 30 minutos de uso e sempre antes
-- de uma mudança grande (quando muita coisa some de uma vez).
-- No painel: aba Gestão UGC > Cópias de segurança (ver, baixar e voltar).
create table if not exists public.app_state_copias (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  data      jsonb not null,
  motivo    text not null default 'automática',
  criado_em timestamptz not null default now()
);
create index if not exists app_state_copias_user_data on public.app_state_copias (user_id, criado_em desc);
alter table public.app_state_copias enable row level security;
drop policy if exists "dona le" on public.app_state_copias;
create policy "dona le" on public.app_state_copias for select to authenticated
  using (public.e_a_dona() and auth.uid() = user_id);
drop policy if exists "dona guarda" on public.app_state_copias;
create policy "dona guarda" on public.app_state_copias for insert to authenticated
  with check (public.e_a_dona() and auth.uid() = user_id);
revoke all on public.app_state_copias from anon;

create or replace function public.copiar_app_state()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op <> 'UPDATE' then
    insert into app_state_copias (user_id, data, motivo) values (old.user_id, old.data, 'antes de apagar');
    return old;
  end if;
  if new.data is not distinct from old.data or old.data = '{}'::jsonb then
    return new;
  end if;
  if length(new.data::text) < length(old.data::text) * 0.6 then
    insert into app_state_copias (user_id, data, motivo) values (old.user_id, old.data, 'antes de uma mudança grande');
  elsif not exists (select 1 from app_state_copias where user_id = old.user_id and criado_em > now() - interval '30 minutes') then
    insert into app_state_copias (user_id, data, motivo) values (old.user_id, old.data, 'automática');
  end if;
  return new;
end $$;
revoke execute on function public.copiar_app_state() from public, anon, authenticated;
drop trigger if exists copiar_antes_de_salvar on public.app_state;
create trigger copiar_antes_de_salvar before update on public.app_state
  for each row execute function public.copiar_app_state();


-- ---------------------------------------------------------------------
-- 12d) INSPIRAÇÕES (vídeos novos dos perfis que a Mari acompanha)
-- A Edge Function "inspiracoes" busca pelo Apify (segredo APIFY_TOKEN) e guarda aqui.
-- Só a dona do painel lê e mexe.
-- ---------------------------------------------------------------------
create table if not exists public.inspiracoes (
  id            bigint generated always as identity primary key,
  rede          text not null check (rede in ('instagram','tiktok')),
  perfil        text not null,
  post_id       text not null,
  link          text not null,
  legenda       text,
  capa          text,
  video         boolean not null default true,
  visualizacoes bigint,
  publicado_em  timestamptz,
  transcrito    boolean not null default false,
  oculto        boolean not null default false,  -- ela escondeu o vídeo do Dashboard
  criado_em     timestamptz not null default now(),
  unique (rede, post_id)
);
alter table public.inspiracoes add column if not exists oculto boolean not null default false;
alter table public.inspiracoes enable row level security;
drop policy if exists "dona faz tudo" on public.inspiracoes;
create policy "dona faz tudo" on public.inspiracoes
  for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
revoke all on public.inspiracoes from anon;


-- ---------------------------------------------------------------------
-- 13) AVISA O SUPABASE QUE AS TABELAS NOVAS EXISTEM E CONFIRMA
-- Se tudo deu certo, aparece embaixo, em "Results", a frase "Pronto!".
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ===== 11 e 12. Treino de estilo UGC (vídeos de referência e guia de estilo) =====
create table if not exists public.estilo_videos (
  id bigint generated always as identity primary key,
  criadora text not null,
  marca text,
  categoria text,          -- beleza, casa, moda... "depoimento" = feedback de cliente (fica fora do treino)
  link text not null unique,
  transcricao text,
  criado_em timestamptz not null default now()
);
alter table public.estilo_videos enable row level security;
drop policy if exists "dona faz tudo" on public.estilo_videos;
create policy "dona faz tudo" on public.estilo_videos for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
revoke all on public.estilo_videos from anon;

create table if not exists public.estilo_ugc (
  id int primary key default 1 check (id = 1),
  guia text,                 -- guia de estilo (cópia em supabase/estilo/guia-estilo-ugc.txt)
  exemplos jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.estilo_ugc enable row level security;
drop policy if exists "dona faz tudo" on public.estilo_ugc;
create policy "dona faz tudo" on public.estilo_ugc for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
revoke all on public.estilo_ugc from anon;

-- Central de Referências: tempos da transcrição, duração, análise e ideias de cada referência
alter table public.roteiros add column if not exists segmentos jsonb;
alter table public.roteiros add column if not exists duracao integer;
alter table public.roteiros add column if not exists analise jsonb;
alter table public.roteiros add column if not exists ideias jsonb;

-- método de roteiro (skill roteiro-ugc da Lara): os arquivos ficam só aqui no banco, não no GitHub
create table if not exists public.metodo_roteiro (
  arquivo text primary key,  -- SKILL.md, references/ganchos.md...
  titulo text not null,
  ordem int not null default 0,
  conteudo text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.metodo_roteiro enable row level security;
drop policy if exists "dona faz tudo" on public.metodo_roteiro;
create policy "dona faz tudo" on public.metodo_roteiro for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
revoke all on public.metodo_roteiro from anon;
alter table public.estilo_ugc add column if not exists metodo text;        -- resumo do método que a IA lê
alter table public.estilo_ugc add column if not exists ritmo_fala numeric; -- palavras por segundo da Mari

select 'Pronto! As 13 tabelas foram criadas com a tranca (RLS) ligada.' as resultado;

-- ---------------------------------------------------------------------
-- ANEXOS (out/2026): notas fiscais e comprovantes dos jobs (UGC's & Publis)
-- Bucket privado "anexos", pasta jobs/<id do job>/. Só a dona lê e grava.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit) values ('anexos','anexos',false, 20971520) on conflict (id) do nothing;
drop policy if exists "anexos: dona faz tudo" on storage.objects;
create policy "anexos: dona faz tudo" on storage.objects for all to authenticated
  using (bucket_id='anexos' and public.e_a_dona()) with check (bucket_id='anexos' and public.e_a_dona());

-- ---------------------------------------------------------------------
-- LABORATÓRIO CRIATIVO (out/2026): posts salvos do Instagram viram ideias
-- status: novo | processando | pronto | erro · etapa: Nova, Ideia pronta, Vou gravar, Gravado, Descartada
-- ---------------------------------------------------------------------
create table if not exists public.laboratorio (
  id bigint generated always as identity primary key,
  link text not null unique, codigo text, perfil text, tipo text, legenda text, transcricao text,
  status text not null default 'novo', erro text, ideia jsonb, etapa text not null default 'Nova',
  capa text, salvo_em timestamptz, criado_em timestamptz not null default now()
);
alter table public.laboratorio enable row level security;
create policy "dona faz tudo" on public.laboratorio for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());

-- ---------------------------------------------------------------------
-- BIBLIOTECA EDITORIAL (out/2026): perfis de referência e os posts deles
-- (função biblioteca: buscar/recolher pelo Apify, analisar pelo Groq; página js/editorial.js)
-- ---------------------------------------------------------------------
create table if not exists public.biblioteca_perfis (
  id bigint generated always as identity primary key,
  rede text not null default 'instagram', usuario text not null,
  ultima_busca timestamptz, run_id text, criado_em timestamptz not null default now(),
  unique (rede, usuario)
);
alter table public.biblioteca_perfis enable row level security;
create policy "dona faz tudo" on public.biblioteca_perfis for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
create table if not exists public.biblioteca (
  id bigint generated always as identity primary key,
  rede text not null default 'instagram', perfil text not null, post_id text not null, link text not null,
  legenda text, capa text, tipo text, curtidas int, comentarios int, visualizacoes int, publicado_em timestamptz,
  transcricao text, analise jsonb, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  unique (rede, post_id)
);
alter table public.biblioteca enable row level security;
create policy "dona faz tudo" on public.biblioteca for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());

-- ---------------------------------------------------------------------
-- PAINEL DE CONTEÚDO (out/2026): posts do mês por dia (js/painel-conteudo.js, função painel-conteudo)
-- laboratorio.colecao: pasta do Instagram de onde veio o salvo (programa ferramentas/salvos.py)
-- ---------------------------------------------------------------------
alter table public.laboratorio add column if not exists colecao text;
create table if not exists public.painel_conteudo (
  id bigint generated always as identity primary key,
  mes text not null, data date, horario text, formato text, tema text, tipo_ugc text, funil text, proposito text,
  hook text, ganchos jsonb, desenvolvimento text, cta text, status text not null default 'Ideia', inspiracao jsonb, notas text,
  criado_em timestamptz not null default now()
);
alter table public.painel_conteudo enable row level security;
create policy "dona faz tudo" on public.painel_conteudo for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
-- roteiros que atraem marca: tipo de roteiro (Spec ad, Vitrine para marca, Stories de bastidor),
-- legenda pronta com hashtags e "por que atrai marca"
alter table public.painel_conteudo add column if not exists tipo_roteiro text, add column if not exists legenda text, add column if not exists porque text;
-- configuracoes chave "ntfy_topico": endereço secreto das notificações no iPhone (app ntfy), gerado no painel

-- ---------------------------------------------------------------------
-- NOTIFICAÇÕES NO CELULAR (out/2026): "Importante, notificar" (js/lembretes.js, função notificacoes)
-- ---------------------------------------------------------------------
create table if not exists public.lembretes (
  id bigint generated always as identity primary key,
  item_tipo text not null default 'item', item_id text not null, titulo text not null, detalhe text, url text,
  quando timestamptz not null, ativo boolean not null default true, enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (item_tipo, item_id)
);
alter table public.lembretes enable row level security;
create policy "dona faz tudo" on public.lembretes for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
create index if not exists lembretes_pendentes on public.lembretes (quando) where ativo and enviado_em is null;
create table if not exists public.push_inscricoes (
  id bigint generated always as identity primary key,
  endpoint text not null unique, p256dh text not null, auth text not null, aparelho text,
  criado_em timestamptz not null default now()
);
alter table public.push_inscricoes enable row level security;
create policy "dona faz tudo" on public.push_inscricoes for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
-- chaves VAPID: criadas pela própria função notificacoes na primeira vez; sem política (só o servidor lê)
create table if not exists public.chaves_push (id int primary key default 1, publica text not null, privada text not null, criado_em timestamptz not null default now());
alter table public.chaves_push enable row level security;
-- a cada minuto o banco chama a função para mandar os avisos que venceram
create extension if not exists pg_cron;
select cron.schedule('disparar-lembretes', '* * * * *', $$select net.http_post(url := 'https://ztpzcmeiypnstswasxdw.supabase.co/functions/v1/notificacoes', body := '{"acao":"disparar"}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds := 20000)$$);

-- ---------------------------------------------------------------------
-- EDIÇÃO DE VÍDEOS: projetos salvos (js/edicao.js). O vídeo fica no aparelho dela; aqui vai
-- só a memória da edição (tema, roteiro, transcrição, plano, ajustes, legendas, correções).
-- ---------------------------------------------------------------------
create table if not exists public.edicao_projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table public.edicao_projetos enable row level security;
create policy "dona faz tudo" on public.edicao_projetos for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());

-- Finanças Bonetto (/financeiro): app do casal (Mari e Eduardo). Sem dados aqui.
create table if not exists public.financeiro_membros (email text primary key, nome text, criado_em timestamptz not null default now());
alter table public.financeiro_membros enable row level security;
create policy "dona gerencia membros" on public.financeiro_membros for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
create or replace function public.e_membro_financeiro() returns boolean language sql stable security definer set search_path = public, auth as $$
  select public.e_a_dona() or exists (select 1 from public.financeiro_membros m where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;
revoke all on function public.e_membro_financeiro() from public, anon;
grant execute on function public.e_membro_financeiro() to authenticated;
create table if not exists public.financeiro_contas (id text primary key, nome text not null, dados jsonb not null default '{}'::jsonb, atualizado_em timestamptz not null default now(), atualizado_por text);
alter table public.financeiro_contas enable row level security;
create policy "casal le e grava" on public.financeiro_contas for all to authenticated using (public.e_membro_financeiro()) with check (public.e_membro_financeiro());
-- Perfil separado: cada um vê só a própria linha.
alter table public.financeiro_membros add column if not exists perfil text not null default 'eduardo';
create or replace function public.perfil_financeiro() returns text language sql stable security definer set search_path = public, auth as $$
  select case when public.e_a_dona() then 'mari' else (select m.perfil from public.financeiro_membros m where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1) end
$$;
revoke all on function public.perfil_financeiro() from public, anon;
grant execute on function public.perfil_financeiro() to authenticated;
alter policy "casal le e grava" on public.financeiro_contas using (id = public.perfil_financeiro()) with check (id = public.perfil_financeiro());
create policy "cada um no seu perfil" on public.financeiro_contas for all to authenticated using (id = public.perfil_financeiro()) with check (id = public.perfil_financeiro());

-- Ferramentas (out/2026): organizador de ideias, checagem de capa e histórico do organizador de arquivos. Só a dona.
create table if not exists public.ideias_organizadas (id bigint generated always as identity primary key, texto text, imagem text, titulo text, resumo text, categoria text, finalidade text, funil text, formato text, pilar text, marca text, gancho text, roteiro text, post_id bigint, roteiro_id text, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());
create table if not exists public.capas_checadas (id bigint generated always as identity primary key, nome text, imagem text, plataforma text, nota numeric, analise jsonb, notas text, criado_em timestamptz not null default now());
create table if not exists public.arquivos_lotes (id bigint generated always as identity primary key, pasta text, itens jsonb not null default '[]'::jsonb, notas text, desfeito boolean not null default false, aplicado_em timestamptz not null default now());
alter table public.ideias_organizadas enable row level security;
alter table public.capas_checadas enable row level security;
alter table public.arquivos_lotes enable row level security;
create policy "dona faz tudo" on public.ideias_organizadas for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
create policy "dona faz tudo" on public.capas_checadas for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
create policy "dona faz tudo" on public.arquivos_lotes for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());

-- Plano da semana (out/2026): montado todo sábado pela função painel-conteudo (pg_cron "plano-da-semana"). Só a dona.
create table if not exists public.planos_semana (id bigint generated always as identity primary key, semana date not null unique, plano jsonb not null default '{}'::jsonb, foco text, origem text not null default 'manual', criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());
alter table public.planos_semana enable row level security;
create policy "dona faz tudo" on public.planos_semana for all to authenticated using (public.e_a_dona()) with check (public.e_a_dona());
