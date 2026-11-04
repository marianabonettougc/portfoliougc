-- Corrige a restrição de status da caixa de propostas.
-- Seguro para os dados existentes: NOT VALID não revalida linhas antigas,
-- mas exige que novas gravações/alterações respeitem a lista abaixo.
begin;

alter table public.propostas_email
  drop constraint if exists propostas_email_status_check;

alter table public.propostas_email
  add constraint propostas_email_status_check
  check (
    status is null
    or status in (
      'nova',
      'respondida',
      'contrato',
      'marca_salva',
      'nao_proposta',
      'arquivado'
    )
  ) not valid;

commit;
