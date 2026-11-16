# Especificação — Aprovação de legenda e foto de capa

## Objetivo

Ampliar o fluxo de aprovações por Job para permitir que a marca aprove, separadamente, quatro entregáveis: roteiro, vídeo, legenda e foto de capa. Legenda e capa são opcionais e devem aparecer no portal do cliente somente quando estiverem habilitadas no Job.

Este documento registra a especificação funcional e técnica. **Não altera o banco de dados nem ativa a funcionalidade no painel ou no portal.**

## Regras funcionais

### Configuração por Job

Adicionar duas opções independentes no cadastro/edição do Job:

- **Tem legenda?** Sim / Não
- **Tem foto de capa?** Sim / Não

A configuração pertence ao Job, não é global. O estado inicial deve ser não configurado (null), para não interpretar silenciosamente um Job antigo como “não tem”. Ao salvar um Job novo, a pessoa responsável escolhe explicitamente Sim ou Não para cada item.

### Entregáveis e aprovação

Cada entregável habilitado tem seu próprio envio, versão e situação:

| Entregável | Conteúdo esperado | Aprovação |
|---|---|---|
| Roteiro | Snapshot do texto/versão enviada; manter integração atual com Google Docs enquanto existir | Independente |
| Vídeo | Arquivo de vídeo enviado para revisão | Independente |
| Legenda | Texto exato enviado à marca | Independente |
| Foto de capa | Arquivo de imagem enviado para revisão | Independente |

Situações por entregável: **Não enviado**, **Aguardando aprovação**, **Aprovado**, **Ajustes solicitados** e **Refação**, quando aplicável.

Uma resposta sobre um entregável nunca deve aprovar ou reprovar os demais. O Job só deve ser considerado totalmente aprovado quando todos os entregáveis habilitados estiverem aprovados. Entregáveis marcados como “Não” não bloqueiam a conclusão.

### Portal da marca

- Exibir somente os entregáveis habilitados no Job.
- Mostrar claramente o tipo do entregável e sua versão.
- Permitir aprovar ou solicitar ajustes em cada entregável individualmente.
- Registrar comentário e resposta vinculados ao entregável e à versão exata.
- Não permitir que uma resposta de uma versão antiga altere o estado da versão atual.
- Manter histórico de envios e decisões por entregável.

### Arquivos e armazenamento

- Legenda: armazenar um snapshot imutável do texto enviado.
- Foto de capa e vídeo: armazenar metadados e referência ao arquivo; não depender de URL pública permanente.
- Como os arquivos de aprovação podem ser confidenciais, preferir bucket privado do Supabase ou acesso autenticado ao Google Drive. URLs temporárias devem ser geradas no momento da visualização.
- Não usar o bucket público `capas` para conteúdo de aprovação confidencial sem uma decisão explícita de segurança.

## Compatibilidade com a implementação atual

A estrutura existente usa:

- `public.aprovacao_envios`, com tipos atualmente limitados a `roteiro` e `video`;
- `public.aprovacao_eventos`, para registrar abertura, aprovação, ajustes e refação;
- `public.aprovacao_links`, para o link/token do portal;
- estado dos Jobs no JSONB `app_state`.

A implementação deverá ampliar o modelo de dados de forma compatível com Jobs antigos. Antes de alterar a constraint de `tipo` ou criar novas tabelas, revisar as políticas RLS e os acessos das Edge Functions.

## Direção técnica recomendada

1. Adicionar `tem_legenda` e `tem_capa` como flags opcionais no modelo do Job (ou em um objeto `entregaveis_config`), preservando `null` para Jobs legados ainda não configurados.
2. Generalizar o registro de envios para suportar `roteiro`, `video`, `legenda` e `capa`, com versão e situação independentes.
3. Associar cada evento de aprovação ao envio específico, mantendo o tipo e a versão disponíveis no histórico.
4. Atualizar o editor do Job para configurar presença/ausência e anexar os conteúdos.
5. Atualizar o painel de aprovações para exibir o progresso individual dos entregáveis.
6. Atualizar a Edge Function do portal para listar e responder a todos os tipos habilitados, validando sempre a versão enviada.
7. Atualizar o portal da marca para renderizar texto, vídeo e imagem conforme o tipo.
8. Criar migração SQL idempotente e testar RLS, tokens, links antigos e Jobs já existentes antes de publicar.

## Critérios de aceite

- É possível marcar legenda e capa como “Sim” ou “Não” separadamente em cada Job.
- Quando “Não”, o entregável não aparece para a marca e não impede a conclusão do Job.
- Quando “Sim”, o entregável pode ser enviado e aprovado sem alterar o estado dos outros.
- Cada nova versão mantém o histórico da versão anterior.
- Comentários e decisões ficam vinculados ao entregável e à versão corretos.
- Links antigos não conseguem aprovar uma versão mais recente.
- Jobs existentes continuam abrindo e funcionando sem perda de dados.
- A interface deixa claro o que está pendente e o que já foi aprovado.

## Fora do escopo desta etapa

- Alterar ou migrar o fluxo atual do Google Docs para o roteiro.
- Conectar ou migrar arquivos do Google Drive.
- Executar migrações no Supabase ou publicar Edge Functions.
- Marcar automaticamente um Job como concluído sem validar todos os entregáveis habilitados.
