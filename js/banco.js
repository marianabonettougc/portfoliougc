// =========================================================
// LIGAÇÃO COM O BANCO DE DADOS (Supabase)
// Estas duas informações ficam guardadas só aqui e são usadas
// pelo portfólio, pela tela de login e pelo painel.
// A chave abaixo é a PÚBLICA (publishable). Ela pode ficar no site:
// quem protege os dados são as regras de segurança (RLS) do banco.
// NUNCA coloque a chave secreta (service_role / secret) em arquivo nenhum.
// =========================================================
window.BANCO_URL = "https://ztpzcmeiypnstswasxdw.supabase.co";
window.BANCO_CHAVE = "sb_publishable_TxLJkErn4N9jD8rDLV1EnQ_sppuB9VZ";

// E-mail da dona do painel (o mesmo usado nas regras do banco)
window.BANCO_EMAIL_DONA = "marianabonettougc@gmail.com";

// Cria a conexão uma vez só. Precisa da biblioteca do Supabase carregada antes,
// pela tag <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
window.banco = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(window.BANCO_URL, window.BANCO_CHAVE)
  : null;
