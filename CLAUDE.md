# Portfólio UGC da Mari Bonetto

Este repositório é o site publicado no GitHub Pages:
https://marianabonettougc.github.io/portfoliougc/

- O site é o arquivo `index.html` (CSS e JS dentro dele, sem build, sem bibliotecas).
- Imagens ficam ao lado dele: `mari-bonetto-capa.png` (foto da capa, PNG recortado com IA), `mari-bonetto-sobre.webp` (foto do Sobre mim, com a claquete) e a pasta `logos/` (logos das marcas, recortadas da referência enviada pela Mari).
- Os dados editáveis (marcas, destaques, trabalhos, serviços, métricas, resultados, depoimentos, contatos) ficam nos arrays no começo do `<script>`.
- Toda edição pedida pela Mari deve ser feita no `index.html`, commitada e enviada direto para a branch `main`. O GitHub Pages publica a `main` automaticamente em 1 a 2 minutos.
- Cores (configuração antiga, que a Mari prefere): fundo creme #f6efe6, papel #fffdf9, café #6b4a35, texto #3d2b20. Títulos de seção em marrom escuro #705548 com a palavra em itálico em #a87058. Nome da capa em #a87860. Blocos do Hora de criar em #705548. Tarja da Black Friday amarela #e9b44c. Fontes (no máximo 3): Anton só no nome da capa, DM Serif Display nos títulos (todos com o mesmo tamanho), Poppins no resto.
- Regras de texto: português, sem travessão, sem lorem ipsum, sem inventar métricas, resultados ou depoimentos. Usar sempre as imagens reais enviadas pela Mari, nunca recriar logos.
- Mural de fotos (antes de "Algumas marcas que já trabalhei"): duas fileiras com 10 lugares cada (foto deitada usa formato "deitada" e ocupa 2 lugares), arquivos na pasta fotos/ (foto-01, foto-02...), lista no array "fotos" do script.

## Painel (admin) e banco de dados
- Banco: Supabase. URL e chave pública ficam só em js/banco.js (nunca colocar chave secreta em arquivo).
- banco.sql: cria as tabelas videos, marcas, calendario, campanhas, marcados, visitas, com RLS ligado em todas (só o e-mail marianabonettougc@gmail.com lê/escreve; anônimo só INSERE em marcas como lead e em visitas). O site lê os vídeos pela função videos_no_ar().
- login/index.html (tela de entrar), admin/index.html + js/admin.js (painel), css/painel.css (visual dos dois), js/biblioteca.js (conteúdo do Checklist, copiado sem alterações de eilaradam.github.io/admin-imersao/biblioteca.js).
- Portfólio: lê vídeos do banco (se falhar, usa a lista "destaques" do index.html), salva o formulário em marcas e registra visitas (não conta a Mari depois que ela entra no painel no navegador).
- Aba Roteiros: Edge Function "transcrever" (supabase/functions/transcrever) no projeto Admin UGC. Usa o TokScript (login OAuth uma vez, guardado na tabela integracoes, que só o servidor lê) para Instagram/TikTok/YouTube; sem TokScript tenta baixar direto + Groq (segredo GROQ_API_KEY). Groq também preenche os campos (llama). O Instagram bloqueia downloads diretos de servidores.
- Aba UGC's & Publis (antiga Campanhas, hash #campanhas): página jobs do aplicativo, igual ao Planner (PAGINAS_APP em js/admin.js). Tabela campanhas antiga fica no banco, sem ser desenhada.
- Aba Planner (antigo Calendário, hash #calendario): mostra a página Planner do aplicativo Gestão UGC, sem o menu dele (?pagina=planner&so=1 ou postMessage). As abas Planner e Gestão UGC usam o MESMO iframe para uma nunca sobrescrever a outra. A tabela calendario antiga continua no banco, mas a aba não a desenha mais.
- Aba Gestão UGC: o aplicativo de gestão (veio do repositório mariugc) mora em admin/gestao/index.html e abre dentro do painel num iframe. Usa o mesmo login e o banco Admin UGC (js/banco.js), tabela app_state (uma linha por usuária, RLS só a dona). Cópias de segurança automáticas na tabela app_state_copias (gatilho no banco: a cada 30 min e antes de mudança grande); no painel, botão "Cópias de segurança" para ver, baixar e voltar. Dados nunca vão para o GitHub (repositório público). Cores do aplicativo seguem a paleta do site (creme, papel, café, terracota; Poppins e DM Serif Display). O botão "Gerar roteiro com IA" chama a Edge Function gerar-roteiro, que usa o Groq (GROQ_API_KEY).
- Ao publicar mudança no painel: atualizar o número em js/versao.json, em window.VERSAO_PAINEL (admin/index.html) e nos ?v= dos arquivos (todos com o mesmo valor). Assim o painel se recarrega sozinho com a versão nova.
