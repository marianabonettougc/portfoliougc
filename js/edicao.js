// =========================================================
// CRIATIVIDADE > EDIÇÃO DE VÍDEOS (hash #edicao)
// O "videomaker" do painel: a Mari envia o vídeo bruto (um ou vários clipes) e
// o painel edita sozinho, no próprio navegador, seguindo o padrão de edição dela:
// 1. tira o áudio do vídeo (WebAudio, 16 kHz) e transcreve palavra por palavra
//    (função editor-video, Whisper do Groq);
// 2. a IA lê a fala e monta o plano (função editor-video acao "plano"): título do
//    gancho, tomadas erradas para tirar, palavras de destaque, zooms, efeitos
//    sonoros, ideias de b-roll e dicas;
// 3. o painel corta os silêncios e as tomadas erradas, põe legenda palavra por
//    palavra, zoom nos cortes e na ênfase, título animado e efeitos sonoros
//    (sintetizados aqui mesmo, sem arquivo);
// 4. prévia num canvas 9:16 e exportação em MP4 (MediaRecorder, em tempo real),
//    mais a legenda em .srt para usar no CapCut.
// Estilo CapCut (referências de out/2026: vídeo dela da Eudora e da Rafa Chagas): legenda
// Poppins média, minúscula, amarela clarinha com sombra suave, 1 a 4 palavras por vez;
// palavras chamativas grandes (Fredoka, cor viva, sombra dura) com frase manuscrita
// (Caveat); título limpo em serifada itálica, sem caixinhas, figurinhas nem cursor (ela
// pediu para tirar: o título "capcut" de caixinhas foi removido e vira "simples");
// confete e tremidinha nos momentos fortes. Nunca mexe na cor do vídeo (isso ela faz no
// CapCut). Editor de legendas: mudar o texto, juntar com a próxima, apagar e marcar como
// chamativa (fica guardado por palavra, então sobrevive a correções e reedições).
// Projetos (tabela edicao_projetos): cada vídeo vira um projeto salvo sozinho (tema, roteiro,
// transcrição, plano, ajustes, legendas editadas, correções). O vídeo em si fica no
// aparelho dela: ao abrir um projeto ela escolhe de novo os mesmos arquivos e a edição volta
// inteira, sem transcrever nem gastar IA de novo.
// Áudio para transcrever: 1º tira a faixa AAC de dentro do MP4/MOV com mp4box.js (sem
// decodificar; .MOV do iPhone tem o esds achado "na mão" em ascNoMoov) e manda um .m4a;
// 2º decodeAudioData (wav 16 kHz); 3º toca o vídeo e grava o áudio (audioTocando).
// iPhone: o Safari só mostra o quadro do vídeo depois de tocar, então cada clipe dá um
// play mudo e pausa logo que carrega (senão a prévia fica preta).
// O padrão de edição (tirado das referências que ela mandou) fica na tabela
// configuracoes, chave "padrao_edicao", e ela pode editar.
// Roteiro (opcional): ela cola o que tinha idealizado (cenas, falas, voice-over) ou puxa
// um post do Painel de conteúdo; a IA usa para escolher as tomadas, o título, o b-roll e
// os efeitos, e mostra o "Roteiro x gravação" (bloco gravado, faltou ou mudou).
// O rascunho do roteiro fica guardado neste navegador.
// Correções: depois de editar, ela escreve o que não gostou (legenda, efeitos, cortes,
// título...) e a IA devolve o plano corrigido e os ajustes visuais (acao "corrigir"); a
// linha do tempo é remontada sem transcrever de novo. Com "Lembrar nas próximas", a regra
// vai para o padrão de edição dela e os ajustes visuais ficam guardados neste navegador.
// Nada do vídeo sai do computador dela, só o áudio vai para transcrever.
// Revisar cortes (ideia do reel-editor da getgitgirl, MIT): a transcrição aparece palavra por palavra
// e ela toca para cortar ou devolver qualquer palavra (st.marcas, por chaveLeg); vícios de fala
// ("éé", "ahn", "hum"...) já saem cortados (opc.vicios) e "tipo"/"né" ficam sugeridos. Ritmo tem
// três níveis (normal, rápido e turbo). Voz no volume do Instagram: compressor + ganho na fala.
// Capa do Reels: 6 quadros do vídeo editado (ou a barra para o quadro exato), título com sombra
// suave, painel creme ou degradê escuro, e PNG em 1080x1920, 1080x1440 (3:4) e 1080x1080; as
// escolhas ficam no projeto (st.capa).
// =========================================================
(function () {
  "use strict";

  const ABA = "edicao";
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const banco = () => window.banco;
  const tempo = (s) => { s = Math.max(0, Number(s) || 0); const m = Math.floor(s / 60); return m + ":" + String(Math.floor(s % 60)).padStart(2, "0") + "," + Math.floor((s % 1) * 10); };
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const uid = () => Math.random().toString(36).slice(2, 9);

  const MARCA_V3 = "SÓ ESTAS REFERÊNCIAS (out/2026, v5)";
  const PADRAO = `PADRÃO DE EDIÇÃO DA MARI. SÓ ESTAS REFERÊNCIAS (out/2026, v5): DaN7lnRi16X, Daa8wYaCgkQ e DdIK7JosJYp (vídeos dela), DbT3IhlRUgA e DWzaZKBj6I7. Ignore qualquer referência ou estilo antigo.

RITMO
- Cortes secos (jump cut), sem transição enfeitada. Corta todo silêncio, respiração e tomada errada.
- B-roll de produto cobrindo a fala: close do produto, detalhe, uso real (chinelo no pé, perfume na pele), print de tela quando falar de busca ou app.
- Zoom leve só para esconder o pulo entre cortes e nas frases de ênfase.

LEGENDA
- Minúscula, de 2 a 4 palavras por vez, no meio da tela, sombra suave para ler em fundo claro. Nunca em maiúsculas, nunca negrito pesado, nunca contorno.
- Fonte dela: Bootzy (do CapCut, sem serifa grossa e apertada, tipo Helvetica Bold), amarelo clarinho, como no vídeo da Eudora. Alternativa dos vídeos dela: serifada itálica.
- Nada cobre o rosto.

TÍTULO
- Curto e limpo no começo, sem caixinhas, figurinhas, cursor ou cores fortes.

O QUE NÃO USAR (ela pediu)
- Confete, palavras gigantes coloridas, caixinhas no título, legenda branca em maiúsculas e negrito.
- Nunca mexer na cor do vídeo (a cor ela ajusta no CapCut).

DINAMISMO E EFEITOS SONOROS (ela gosta de vídeo bem dinâmico, que chama atenção)
- Sons que ela usa (Floratta Blue Crystal): spray no borrifo do produto, brilho (sparkle) baixinho na névoa ou no produto brilhando, whoosh suave no corte para o rosto, riser curto antes de revelar o produto, ding de cristal quando o produto aparece inteiro e quando fala o nome da marca, pop quando aparece texto escrito (notas do perfume, nome do produto, pergunta do CTA), whoosh curto alternado com clique nos cortes de close, som de mensagem chegando quando entra print de WhatsApp, tique-taque de relógio quando fala de fixação ou "no fim do dia". Nada por cima de áudio de prova (áudio de WhatsApp, depoimento).
- Muitos efeitos sonoros: 1 a cada 1,5 a 2 segundos. Woosh nas trocas de assunto e nos zooms, clique/shutter nos cortes rápidos, pop e ding quando entra texto, produto ou informação, riser antes de revelar algo e hit logo depois, typing quando aparece algo escrito, som do próprio produto junto do gesto (spray, embalagem, chuveiro).
- Cortes rápidos sem respiro, zoom rápido (punch) nos cortes de ênfase, troca de plano a cada 1 a 2 segundos quando der (b-roll).

REFERÊNCIA: VÍDEO PRÉ-EDITADO (Floratta Blue Crystal, out/2026)
- Quando ela manda um vídeo que já vem pré-editado (cortes, título, textos e b-roll prontos), a edição é leve: poucos efeitos, só nos momentos-chave. Não refazer cortes nem legenda.
- Sons usados nele (6 em 82 s, uns 20 a 25% do volume da voz): pop baixinho quando o título do gancho aparece; brilho quando entra a figurinha do produto; whoosh suave no corte para o b-roll do produto; spray quando o dedo aperta a válvula; som de mensagem quando ela pega o celular, antes do áudio de prova (nunca por cima dele); clique de câmera quando entra a gravação de tela.
- Efeitos de cena usados nele: aproximação lenta (até 6%) durante o título do gancho; aproximação lenta (até 8%) no b-roll de close do produto; flash branco rápido (0,1 s) no corte para o produto; zoom de ênfase de 8% que volta ao normal em 1,3 s em 2 cortes de volta para o rosto.
- Versão final do mesmo vídeo, depois que ela colocou legenda (1 palavra no meio da tela) e música de fundo e pediu para ficar dinâmico: 44 sons em 82 s (1 a cada 2 s, uns 12 a 20% do volume): clique ou whoosh suave em todo corte e em todo zoom, pop quando entra texto, brilho e ding de cristal quando o frasco aparece e quando fala a marca, riser curto antes do close do produto, spray em todo borrifo, tique-taque quando fala de fixação, mensagem antes do áudio de prova. Zoom alternado (100% e 110 a 112%, entrando um pouco mais perto e assentando) a cada 3 a 4 s nas falas longas, sempre numa pausa da fala; aproximação lenta nos b-rolls e no frasco na mão; flash branco no corte para o produto e na volta da gravação de tela. Zoom centrado um pouco acima do meio para não cortar o rosto nem a legenda. Nada durante o áudio de prova além de uma aproximação lenta.

IDEIA PARA DEPOIS
- Texto atrás da pessoa (DbT3IhlRUgA): o título fica atrás do corpo dela.`;

  const EFEITOS = { woosh: "Woosh", suave: "Whoosh suave", pop: "Pop", click: "Click", shutter: "Shutter", typing: "Typing", riser: "Riser", hit: "Hit", ding: "Ding", cristal: "Ding de cristal", brilho: "Brilho (sparkle)", spray: "Spray / borrifo", mensagem: "Mensagem chegando", relogio: "Tique-taque" };
  const ESTILOS = { capcut: "CapCut (Poppins média, minúscula, sombra suave)", minimal: "Fina e branca", bold: "Forte com contorno", caixa: "Caixinha bege" };
  const TITULOS = { simples: "Limpo, serifada itálica (sem caixinhas)", etapas: "Em etapas com clique (duas fontes e estrelinhas)", frase: "Frase gigante na tela (3 cores)", caixa: "Caixinhas" };
  // fontes da legenda: "minha" é a fonte que ela enviou (Bootzy do CapCut), guardada em configuracoes "fonte_legenda"
  const FONTES_LEG = { minha: "Minha fonte (Bootzy)", arimo: "Parecida com a Bootzy (Arimo)", montserrat: "Sem serifa forte (Montserrat)", poppins: "Sem serifa média (Poppins)", nunito: "Arredondada forte (Nunito)", dmserif: "Serifada itálica (DM Serif)", instrument: "Serifada itálica fina (Instrument Serif)" };
  const QTD_SONS = [["nenhum", "Nenhum"], ["impacto", "Só nas frases de impacto"], ["poucos", "Poucos"], ["medio", "Médio"], ["muitos", "Muitos (1 a cada 2 s, seu padrão)"]];
  const DINAMISMO = [["calmo", "Calmo (sem zoom nem transição)"], ["normal", "Normal"], ["dinamico", "Dinâmico (zoom entrando e saindo, transição, seu padrão)"]];
  const fonteLeg = (tam, chave = st.opc.fonteLeg) => ({
    minha: `${tam}px "MinhaFonte", Arimo, Arial, sans-serif`, arimo: `700 ${tam}px Arimo, "Helvetica Neue", Arial, sans-serif`, montserrat: `700 ${tam}px Montserrat, Poppins, sans-serif`, poppins: `500 ${tam}px Poppins, sans-serif`,
    nunito: `800 ${tam}px Nunito, Poppins, sans-serif`, dmserif: `italic 400 ${tam * 1.12}px "DM Serif Display", Georgia, serif`, instrument: `italic 400 ${tam * 1.28}px "Instrument Serif", Georgia, serif`,
  })[chave] || `700 ${tam}px Montserrat, Poppins, sans-serif`;
  const FONTES_TIT = { dmserif: "Serifada itálica", instrument: "Serifada fina", montserrat: "Sem serifa forte", poppins: "Sem serifa média", arimo: "Firme (tipo Bootzy)", nunito: "Arredondada" };
  const fonteTitulo = (tam, chave = st.opc.fonteTitulo) => ({ dmserif: `italic 400 ${tam}px "DM Serif Display", Georgia, serif`, instrument: `italic 400 ${tam * 1.15}px "Instrument Serif", Georgia, serif`, montserrat: `800 ${tam * 0.8}px Montserrat, Poppins, sans-serif`, poppins: `600 ${tam * 0.82}px Poppins, sans-serif`, arimo: `700 ${tam * 0.84}px Arimo, "Helvetica Neue", Arial, sans-serif`, nunito: `800 ${tam * 0.82}px Nunito, Poppins, sans-serif` })[chave] || `italic 400 ${tam}px "DM Serif Display", Georgia, serif`;
  const CORES_CHAMATIVA = ["#c6f432", "#cdb6ff", "#ffe45c", "#ffb3d9"];
  const DUR_TITULO = 2.8;

  // ---------- estilos prontos (aba "Estilos"): cada estilo é a edição inteira de uma vez ----------
  // fonte, cor e tamanho da legenda, título, quantidade de sons, dinamismo, transição e ritmo.
  // Nenhum usa caixinha, confete, palavra gigante colorida nem fundo desfocado (ela não gosta).
  const BASE_ESTILO = { fonteTitulo: "dmserif", corTitulo: "", ladoLeg: "centro", alturaTitulo: 0.24, estilo: "capcut", sombra: "suave", estiloTitulo: "simples", maiusculas: false, chamativas: false, sonsChamativas: false, confete: false, tremer: false, flash: false, legenda: true, titulo: true, efeitos: true };
  const ESTILOS_PRONTOS = [
    { id: "padrao", nome: "Meu padrão", para: "O seu jeito de sempre: legenda amarelo clarinho, bem dinâmico, muitos sons", opc: { fonteLeg: "arimo", corLegenda: "#fff3b0", porLegenda: 3, tamLeg: 1, sons: "muitos", dinamismo: "dinamico", transicao: "punch", ritmo: "rapido" } },
    { id: "publi", nome: "Publi dinâmica", para: "Produto em uso, ritmo turbo, flash no corte para o produto", opc: { fonteLeg: "arimo", corLegenda: "#fff3b0", porLegenda: 2, tamLeg: 1.05, sons: "muitos", dinamismo: "dinamico", transicao: "deslize", ritmo: "turbo", flash: true } },
    { id: "suave", nome: "Suave", para: "Falas calmas, rotina e histórias pessoais, poucos sons", opc: { fonteLeg: "instrument", corLegenda: "#ffffff", porLegenda: 3, tamLeg: 1.1, sons: "poucos", dinamismo: "normal", transicao: "nenhuma", ritmo: "normal" } },
    { id: "dicas", nome: "Dicas e números", para: "Listas, passo a passo e resultados, legenda firme", opc: { fonteLeg: "montserrat", corLegenda: "#ffffff", porLegenda: 2, tamLeg: 1.05, sons: "medio", dinamismo: "dinamico", transicao: "punch", ritmo: "rapido" } },
    { id: "elegante", nome: "Elegante", para: "Beleza e perfume, serifada itálica, toque mais sofisticado", opc: { fonteLeg: "dmserif", corLegenda: "#fbf1e1", porLegenda: 3, tamLeg: 1, sons: "poucos", dinamismo: "normal", transicao: "punch", ritmo: "normal" } },
    { id: "leve", nome: "Lifestyle leve", para: "Dia a dia, maternidade e casa, ritmo gostoso", opc: { fonteLeg: "poppins", corLegenda: "#ffffff", porLegenda: 3, tamLeg: 1, sons: "medio", dinamismo: "normal", transicao: "punch", ritmo: "rapido" } },
  ];
  const CHAVES_ESTILO = ["fonteLeg", "corLegenda", "porLegenda", "tamLeg", "sombra", "estilo", "estiloTitulo", "maiusculas", "sons", "dinamismo", "transicao", "ritmo", "flash", "tremer", "chamativas", "sonsChamativas", "confete", "altura", "vol", "cor", "legenda", "titulo", "efeitos", "fonteTitulo", "corTitulo", "ladoLeg", "alturaTitulo"];

  // ---------- quadro de efeitos (aba "Efeitos"): tudo o que o editor sabe fazer, achado por busca ----------
  const DESC_SONS = { woosh: "Troca de assunto e zoom", suave: "Corte para o rosto, bem baixinho", pop: "Quando entra texto ou informação", click: "Cortes rápidos de close", shutter: "Clique de câmera, gravação de tela", typing: "Quando aparece algo escrito", riser: "Antes de revelar o produto", hit: "Logo depois do riser, na revelação", ding: "Produto aparece inteiro", cristal: "Nome da marca, frasco brilhando", brilho: "Névoa, brilho, produto reluzindo", spray: "Borrifo do produto", mensagem: "Antes do print ou áudio de WhatsApp", relogio: "Fixação, \"no fim do dia\"" };
  const CATS_FX = [["todos", "Todos"], ["sons", "Sons"], ["camera", "Câmera e zoom"], ["transicao", "Transições"], ["legenda", "Legenda"], ["titulo", "Título"]];

  const st = {
    pronto: false, padrao: PADRAO, padraoSalvo: false,
    clipes: [], plano: null, segs: [], legendas: [], efeitos: [], zooms: [], titulo: "", duracao: 0,
    camadas: [], camSel: null, soCamadas: false, histCam: [], desf: [],
    etapas: [], trabalhando: false, tocando: false, exportando: false, parar: false, t: 0,
    opc: { fonteLeg: "arimo", sombra: "suave", sonsTitulo: true, estilo: "capcut", corLegenda: "#fff3b0", porLegenda: 3, chamativas: false, sonsChamativas: false, confete: false, tremer: false, flash: false, sfxAuto: "medio", transicao: "punch", ritmo: "rapido", altura: 0.52, silencio: true, erros: true, zoomCortes: true, zoomEnfase: true, efeitos: true, vol: 0.4, titulo: true, estiloTitulo: "simples", maiusculas: false, qualidade: 1080, cor: "#f2c14e", vicios: true, vozForte: true, tamLeg: 1, legenda: true, sons: "muitos", dinamismo: "dinamico", formato: "vertical", relaxante: false, sonsSuaves: false, fonteTitulo: "dmserif", corTitulo: "", ladoLeg: "centro", alturaTitulo: 0.24 },
    pedidos: "", manual: { sons: [], tirados: [], zooms: [], flashes: [], cortes: [], divisoes: [] }, sel: null, correcoes: [], corrigindo: false, lembrar: true, editLeg: {}, marcas: {}, capa: null, aba: "video", projeto: null, projetos: [], pendentes: null, salvando: "",
    estiloAtivo: (() => { try { return localStorage.getItem("ed-estilo-ativo") || ""; } catch (e) { return ""; } })(), meusEstilos: [], estiloEditando: null, estiloApagar: null, fxBusca: "", fxCat: "todos", guiasIG: false, estHist: [], estMsg: "", ref: null, refArq: null, refUrl: "", refTrab: false, refEtapas: [], refPedido: "", refFocos: [], carro: null, carroTrab: false,
    story: { geral: "", sug: {}, notas: {}, notaGeral: "", trab: false }, vari: { n: 3, mudar: { gancho: true, curta: true, ordem: true, legenda: false, sons: false }, lista: [], base: "", trab: false, gerando: null }, variBase: null, variAtiva: null,
    tema: "", roteiro: (() => { try { return localStorage.getItem("ed-roteiro") || ""; } catch (e) { return ""; } })(), posts: [], arquivoFinal: null,
  };

  // ajustes visuais que ela aprovou (legenda, título, cor, volume) valem para os próximos vídeos
  try { const salvo = JSON.parse(localStorage.getItem("ed-opc3") || "null"); if (salvo && typeof salvo === "object") Object.assign(st.opc, salvo); if (st.opc.estiloTitulo === "capcut") st.opc.estiloTitulo = "simples"; } catch (e) { /* sem armazenamento */ }
  const OPC_VISUAIS = ["sfxAuto", "transicao", "ritmo", "fonteLeg", "sombra", "estilo", "corLegenda", "porLegenda", "chamativas", "sonsChamativas", "confete", "tremer", "flash", "estiloTitulo", "altura", "cor", "vol", "maiusculas", "titulo", "sonsTitulo", "efeitos", "silencio", "erros", "zoomCortes", "zoomEnfase", "vicios", "vozForte", "tamLeg", "legenda", "sons", "dinamismo", "fonteTitulo", "corTitulo", "ladoLeg", "alturaTitulo"];
  function guardarOpc() { if (typeof salvarDepois === "function" && st.segs.length) salvarDepois(); try { localStorage.setItem("ed-opc3", JSON.stringify(Object.fromEntries(OPC_VISUAIS.map((k) => [k, st.opc[k]])))); } catch (e) { /* sem armazenamento */ } }

  let tempoToast = null;
  function toast(texto, erro) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = texto;
    t.classList.toggle("erro", Boolean(erro));
    t.classList.add("visivel");
    clearTimeout(tempoToast);
    tempoToast = setTimeout(() => t.classList.remove("visivel"), erro ? 5200 : 2600);
  }

  // ---------- minha fonte (Bootzy) ----------
  const b64DeBuffer = (buf) => { const u = new Uint8Array(buf); let s2 = ""; for (let i = 0; i < u.length; i += 32768) s2 += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s2); };
  async function aplicarFonte(nome, buf) {
    const ff = new FontFace("MinhaFonte", buf);
    await ff.load(); document.fonts.add(ff); st.minhaFonte = nome;
    const bt = $("#ed-fonte-topo"); if (bt && bt.firstChild) bt.firstChild.textContent = "Fonte: " + nome + " ✓ (trocar)";
  }
  async function carregarMinhaFonte() {
    try {
      const { data } = await banco().from("configuracoes").select("valor").eq("chave", "fonte_legenda").maybeSingle();
      if (!data || !data.valor) return;
      const v = typeof data.valor === "string" ? JSON.parse(data.valor) : data.valor;
      const bin = atob(v.b64), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      await aplicarFonte(v.nome || "Minha fonte", buf.buffer);
      if (["arimo", "poppins", "montserrat"].includes(st.opc.fonteLeg)) st.opc.fonteLeg = "minha"; // a Bootzy dela vira a padrão
      pintarAjustes(); redesenhar();
    } catch (e) { /* sem fonte própria */ }
  }
  async function enviarFonte(arq) {
    if (arq.size > 3 * 1024 * 1024) { toast("Esse arquivo de fonte passou de 3 MB.", true); return; }
    try {
      const buf = await arq.arrayBuffer(), nome = arq.name.replace(/\.[^.]+$/, "").replace(/^[0-9a-f]{8}-/i, "");
      await aplicarFonte(nome, buf.slice(0));
      const { error } = await banco().from("configuracoes").upsert({ chave: "fonte_legenda", valor: JSON.stringify({ nome, b64: b64DeBuffer(buf) }) }, { onConflict: "chave" });
      if (error) throw new Error(error.message);
      st.opc.fonteLeg = "minha"; guardarOpc(); pintarAjustes(); redesenhar();
      toast(`Fonte "${nome}" guardada. Ela vale para as próximas edições.`);
    } catch (e) { toast("Não consegui usar esse arquivo de fonte: " + e.message, true); }
  }

  // ---------- padrão de edição (tabela configuracoes) ----------
  async function carregarPadrao() {
    try {
      const { data } = await banco().from("configuracoes").select("valor").eq("chave", "padrao_edicao").maybeSingle();
      if (data && data.valor) { st.padrao = String(data.valor); st.padraoSalvo = true; }
      // uma vez: troca o padrão salvo pelo v3 (só as 5 referências que ela escolheu)
      if (!st.padrao.includes(MARCA_V3)) { try { await salvarPadrao(PADRAO); } catch (e) { st.padrao = PADRAO; } }
    } catch (e) { /* fica o padrão de fábrica */ }
  }
  async function salvarPadrao(texto) {
    const { error } = await banco().from("configuracoes").upsert({ chave: "padrao_edicao", valor: texto }, { onConflict: "chave" });
    if (error) throw new Error(error.message);
    st.padrao = texto; st.padraoSalvo = true;
  }

  // ---------- áudio para transcrever (wav 16 kHz mono, pedaços de 10 min) ----------
  async function audioDoVideo(arquivo) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const tmp = new Ctx();
    let dec;
    try { dec = await new Promise((ok, falha) => { arquivo.arrayBuffer().then((b) => { const r = tmp.decodeAudioData(b, ok, falha); if (r && r.then) r.then(ok, falha); }, falha); }); }
    catch (e) { return null; } // não deu para abrir o áudio aqui: o editor escuta tocando o vídeo
    finally { try { tmp.close(); } catch (e) { /* segue */ } }
    const taxa = 16000;
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(dec.duration * taxa)), taxa);
    const src = off.createBufferSource(); src.buffer = dec; src.connect(off.destination); src.start();
    const mono = (await off.startRendering()).getChannelData(0);
    const pedaco = 600 * taxa, partes = [];
    for (let i = 0; i < mono.length; i += pedaco) partes.push({ blob: wav(mono.subarray(i, i + pedaco), taxa), inicio: i / taxa });
    return partes;
  }
  // ---------- áudio direto do arquivo (MP4/MOV com AAC, como os do iPhone) ----------
  // mp4box.js lê o arquivo em pedaços, pega as amostras AAC da faixa de áudio e monta um .m4a
  // só com elas; esse .m4a vai direto para o Whisper (fica bem pequeno, ~1 MB por minuto).
  let mp4boxPronto = null;
  function carregarMp4box() {
    if (window.MP4Box) return Promise.resolve();
    if (!mp4boxPronto) mp4boxPronto = new Promise((ok, falha) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js"; sc.onload = ok; sc.onerror = () => { mp4boxPronto = null; falha(new Error("mp4box")); }; document.head.appendChild(sc); });
    return mp4boxPronto;
  }
  function descritorEsds(asc) {
    const d = (tag, bytes) => [tag, bytes.length, ...bytes];
    const dsi = d(5, [...asc]);
    const dcd = d(4, [0x40, 0x15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...dsi]);
    return new Uint8Array(d(3, [0, 0, 0, ...dcd, ...d(6, [2])]));
  }
  // acha a caixa "esds" e devolve o AudioSpecificConfig (descritor 5) que está dentro dela
  function ascNoMoov(b) {
    for (let i = 4; i < b.length - 8; i++) {
      if (b[i] !== 0x65 || b[i + 1] !== 0x73 || b[i + 2] !== 0x64 || b[i + 3] !== 0x73) continue; // "esds"
      let pos = i + 8; // pula fourcc + versão/flags
      const ler = () => { const tag = b[pos++]; let tam = 0, k = 0, x; do { x = b[pos++]; tam = (tam << 7) | (x & 0x7f); k++; } while (x & 0x80 && k < 4); return { tag, tam }; };
      let d = ler(); if (d.tag !== 3) continue;
      pos += 2; const fl = b[pos++]; if (fl & 0x80) pos += 2; if (fl & 0x40) pos += 1 + b[pos]; if (fl & 0x20) pos += 2;
      d = ler(); if (d.tag !== 4) continue;
      pos += 13;
      d = ler(); if (d.tag !== 5 || !d.tam || pos + d.tam > b.length) continue;
      return b.slice(pos, pos + d.tam);
    }
    return null;
  }
  async function audioDoArquivo(arquivo) {
    if (!/\.(mp4|mov|m4v)$/i.test(arquivo.name) && !/mp4|quicktime/.test(arquivo.type)) return null;
    try { await carregarMp4box(); } catch (e) { return null; }
    try {
      const M = window.MP4Box, ent = M.createFile(), amostras = [];
      let faixa = null, parar = false, semFaixa = false;
      ent.onError = () => { parar = true; };
      ent.onReady = (info) => {
        if (!(info.audioTracks || []).length && (info.videoTracks || []).length) semFaixa = true;
        faixa = (info.audioTracks || [])[0];
        if (!faixa || !/^mp4a/i.test(faixa.codec)) { parar = true; faixa = null; return; }
        ent.setExtractionOptions(faixa.id, null, { nbSamples: 2000 }); ent.start();
      };
      ent.onSamples = (id, u, lista) => { for (const a of lista) amostras.push({ data: a.data.slice(0), duration: a.duration, dts: a.dts, cts: a.cts }); ent.releaseUsedSamples(id, lista[lista.length - 1].number + 1); };
      const passo = 8 * 1024 * 1024;
      for (let pos = 0; pos < arquivo.size && !parar; pos += passo) { const b = await arquivo.slice(pos, pos + passo).arrayBuffer(); b.fileStart = pos; ent.appendBuffer(b); }
      ent.flush();
      // vídeo sem faixa de áudio nenhuma (gravado mudo): não tem o que ouvir
      if (semFaixa) { st.motivoAudio = "sem faixa de áudio"; return []; }
      if (!faixa || !amostras.length) { st.motivoAudio = `faixa ${Boolean(faixa)} amostras ${amostras.length}`; return null; }
      const entrada = ent.getTrackById(faixa.id).mdia.minf.stbl.stsd.entries[0];
      const acha = (d, tag) => (!d ? null : d.tag === tag ? d : (d.descs || []).map((x) => acha(x, tag)).find(Boolean));
      let asc = entrada.esds && acha(entrada.esds.esd, 5) ? acha(entrada.esds.esd, 5).data : null;
      // .MOV do iPhone: o mp4box não entra na caixa de áudio do QuickTime, então procura o esds no moov "na mão"
      if (!asc && ent.moov) asc = ascNoMoov(new Uint8Array(await arquivo.slice(ent.moov.start, ent.moov.start + ent.moov.size).arrayBuffer()));
      if (!asc) { st.motivoAudio = "sem esds"; return null; }
      const BP = window.BoxParser || M.BoxParser, esds = new BP.esdsBox(); esds.version = 0; esds.flags = 0; esds.data = descritorEsds(asc);
      const sai = M.createFile();
      const tid = sai.addTrack({ type: "mp4a", hdlr: "soun", name: "audio", timescale: faixa.timescale, samplerate: faixa.audio.sample_rate, channel_count: faixa.audio.channel_count, samplesize: 16, description: esds });
      for (const a of amostras) sai.addSample(tid, a.data, { duration: a.duration, dts: a.dts, cts: a.cts, is_sync: true });
      const blob = new Blob([sai.getBuffer()], { type: "audio/mp4" });
      if (blob.size > 24 * 1024 * 1024) { st.motivoAudio = "grande"; return null; }
      return [{ blob, inicio: 0, nome: "audio.m4a" }];
    } catch (e) { st.motivoAudio = "erro " + e.message; return null; }
  }
  const IPHONE = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // plano B: toca o vídeo (sem som na caixa) e grava o áudio que sai dele, em tempo real
  async function audioTocando(c) {
    audio(); if (ac.state === "suspended") await ac.resume();
    ligarClipe(c);
    const v = c.el, taxa = ac.sampleRate, blocos = [];
    const rec = ac.createScriptProcessor(4096, 1, 1), mudo = ac.createGain();
    mudo.gain.value = 0; rec.connect(mudo); mudo.connect(ac.destination);
    c.no.disconnect(); c.no.connect(rec);
    rec.onaudioprocess = (e) => { if (!v.paused) blocos.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
    v.currentTime = 0; await esperarEvento(v, "seeked");
    v.muted = false; v.playbackRate = 1;
    try { await v.play(); } catch (e) { c.no.disconnect(); c.no.connect(mestre); rec.disconnect(); throw new Error("O iPhone não deixou tocar o vídeo para ouvir. Toque em Editar automático de novo."); }
    await new Promise((ok) => {
      const passo = () => {
        const ult = st.etapas[st.etapas.length - 1];
        if (ult) { ult.texto = ult.texto.replace(/ \d+%$/, "") + " " + Math.round((v.currentTime / (v.duration || 1)) * 100) + "%"; pintarEtapas(); }
        if (v.ended || v.currentTime >= (v.duration || 0) - 0.05) { ok(); return; }
        setTimeout(passo, 300);
      };
      passo();
    });
    v.pause(); rec.disconnect(); mudo.disconnect(); c.no.disconnect(); c.no.connect(mestre);
    const total = blocos.reduce((n, b) => n + b.length, 0);
    // só silêncio: o clipe é mudo (ou o navegador não deixou ouvir); segue sem fala
    if (!total || !blocos.some((b) => b.some((x) => Math.abs(x) > 1e-4))) { c.mudo = true; return []; }
    const junto = new Float32Array(total); let pos = 0; for (const b of blocos) { junto.set(b, pos); pos += b.length; }
    const alvo = 16000, off = new OfflineAudioContext(1, Math.ceil((total / taxa) * alvo), alvo);
    const buf = off.createBuffer(1, total, taxa); buf.getChannelData(0).set(junto);
    const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
    const mono = (await off.startRendering()).getChannelData(0);
    const pedaco = 600 * alvo, partes = [];
    for (let i = 0; i < mono.length; i += pedaco) partes.push({ blob: wav(mono.subarray(i, i + pedaco), alvo), inicio: i / alvo });
    return partes;
  }
  function wav(amostras, taxa) {
    const b = new ArrayBuffer(44 + amostras.length * 2), v = new DataView(b);
    const s = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    s(0, "RIFF"); v.setUint32(4, 36 + amostras.length * 2, true); s(8, "WAVE"); s(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, taxa, true);
    v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, "data"); v.setUint32(40, amostras.length * 2, true);
    for (let i = 0; i < amostras.length; i++) { const x = Math.max(-1, Math.min(1, amostras[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return new Blob([b], { type: "audio/wav" });
  }
  async function chamar(corpo) {
    const { data, error } = await banco().functions.invoke("editor-video", { body: corpo });
    let msg = data && data.error;
    if (error) { try { msg = (await error.context.json()).error; } catch (e) { /* segue */ } msg = msg || "A função não respondeu agora."; }
    if (msg) throw new Error(msg);
    return data;
  }

  // ---------- clipes ----------
  function carregarVideo(arquivo) {
    return new Promise((ok, falha) => {
      const v = document.createElement("video");
      v.preload = "auto"; v.playsInline = true; v.setAttribute("playsinline", ""); v.crossOrigin = "anonymous";
      v.src = URL.createObjectURL(arquivo);
      // vídeo gravado pelo navegador (WebM) às vezes vem sem duração: pula pro fim para descobrir
      v.onloadedmetadata = () => {
        if (isFinite(v.duration)) { preparar(v).then(() => ok(v)); return; }
        const achou = () => { if (!isFinite(v.duration)) return; v.removeEventListener("durationchange", achou); v.currentTime = 0; preparar(v).then(() => ok(v)); };
        v.addEventListener("durationchange", achou); v.currentTime = 1e9;
      };
      v.onerror = () => falha(new Error(`Não consegui abrir "${arquivo.name}". Tente exportar em MP4 (H.264) ou MOV.`));
      $("#ed-videos").appendChild(v);
    });
  }
  // iPhone/Safari: um play mudo rapidinho faz o vídeo ter quadro para desenhar na prévia
  async function preparar(v) {
    if (v.readyState >= 2) return;
    try { v.muted = true; await v.play(); v.pause(); v.currentTime = 0; } catch (e) { /* segue: desenha quando tocar */ }
    v.muted = false;
  }
  // quadrinho do clipe para ela reconhecer a cena na lista
  function miniaturaDoClipe(v) {
    try {
      if (!v.videoWidth) return null;
      const w = 96, h = Math.round(w * v.videoHeight / v.videoWidth), cv = document.createElement("canvas");
      cv.width = w; cv.height = h; cv.getContext("2d").drawImage(v, 0, 0, w, h);
      return cv.toDataURL("image/jpeg", 0.7);
    } catch (e) { return null; }
  }
  // trocar a ordem das cenas: a transcrição de cada clipe fica, só a montagem é refeita
  function reordenarClipes(novaOrdem) {
    st.clipes = novaOrdem;
    let off = 0; st.clipes.forEach((c) => { c.offset = off; off += c.dur; });
    st.segs = []; st.plano = null; st.editLeg = {}; st.t = 0;
    pintar(); salvarDepois();
    toast("Ordem das cenas trocada. Toque em Editar para montar de novo (não precisa ouvir os clipes outra vez).");
  }
  function moverClipe(id, passo) {
    const i = st.clipes.findIndex((x) => x.id === id), j = i + passo;
    if (i < 0 || j < 0 || j >= st.clipes.length) return;
    const nova = st.clipes.slice(); [nova[i], nova[j]] = [nova[j], nova[i]]; reordenarClipes(nova);
  }
  function soltarClipe(id, antesDe) {
    const c = st.clipes.find((x) => x.id === id); if (!c || id === antesDe) return;
    const nova = st.clipes.filter((x) => x !== c), k = antesDe ? nova.findIndex((x) => x.id === antesDe) : -1;
    if (k < 0) nova.push(c); else nova.splice(k, 0, c);
    if (nova.every((x, n) => x === st.clipes[n])) return;
    reordenarClipes(nova);
  }
  async function adicionarClipes(arquivos) {
    const pend = st.pendentes;
    for (const a of arquivos) {
      if (!/^video\//.test(a.type) && !/\.(mp4|mov|m4v|webm)$/i.test(a.name)) { toast(`"${a.name}" não é vídeo.`, true); continue; }
      try {
        const el = await carregarVideo(a), clipe = { id: uid(), nome: a.name, arquivo: a, el, dur: el.duration || 0, w: el.videoWidth, h: el.videoHeight, palavras: null };
        // abrindo um projeto: o arquivo certo recupera a transcrição salva
        if (pend) { const i = pend.findIndex((x) => !x.usado && (x.nome === a.name || Math.abs((x.dur || 0) - clipe.dur) < 0.25)); if (i >= 0) { pend[i].usado = true; clipe.palavras = pend[i].palavras && (pend[i].palavras.length || pend[i].mudo) ? pend[i].palavras : null; clipe.mudo = Boolean(pend[i].mudo); clipe.ordem = i; } }
        clipe.capa = miniaturaDoClipe(el);
        st.clipes.push(clipe);
      } catch (e) { toast(e.message, true); }
    }
    if (st.clipes.length && st.clipes.every((c) => c.w > c.h) && !st.opc.formatoEscolhido && st.opc.formato !== "horizontal") {
      st.opc.formato = "horizontal"; prepararCanvas();
      toast("Seus clipes foram gravados deitados, então deixei o vídeo na horizontal (16:9). Dá para trocar em Formato do vídeo.");
    }
    if (pend) {
      st.clipes.sort((x, y) => (x.ordem ?? 99) - (y.ordem ?? 99));
      if (pend.every((x) => x.usado)) {
        st.pendentes = null;
        let off = 0; st.clipes.forEach((c) => { c.offset = off; off += c.dur; });
        if (st.plano) { montar(); if (st.efeitosSalvos && !(st.manual.sons.length || st.manual.tirados.length)) { st.efeitos = st.efeitosSalvos; } st.efeitosSalvos = null; st.t = 0; toast("Projeto aberto do jeito que você deixou."); }
        if (st.camadas.length) { st.aba = "textos"; pintarAbas(); pintarCamadas(); }
      }
      pintar(); return;
    }
    st.plano = null; st.segs = []; st.editLeg = {}; st.correcoes = [];
    pintar(); salvarDepois();
  }

  // ---------- projetos (memória da edição) ----------
  const dadosProjeto = () => ({ versao: 3,
    tema: st.tema, roteiro: st.roteiro, pedidos: st.pedidos, manual: (st.variBase || st).manual, opc: (st.variBase || st).opc, plano: st.plano, titulo: (st.variBase || st).titulo, tituloDestaque: (st.variBase || st).tituloDestaque,
    story: { geral: st.story.geral, sug: st.story.sug, notas: st.story.notas, notaGeral: st.story.notaGeral },
    vari: { n: st.vari.n, mudar: st.vari.mudar, base: st.vari.base, lista: st.vari.lista.map(({ arquivo, ...v }) => v) }, editLeg: st.editLeg, marcas: st.marcas, capa: st.capa, correcoes: st.correcoes, ref: st.ref, refPedido: st.refPedido, carro: st.carro,
    efeitos: st.efeitos.filter((e) => !e.doTitulo && !e.daChamativa).map(({ id, ...e }) => e),
    camadas: st.camadas.map(({ _box, ...c }) => c), soCamadas: st.soCamadas || undefined,
    clipes: (st.clipes.length ? st.clipes : st.pendentes || []).map((c) => ({ nome: c.nome, dur: Math.round((c.dur || 0) * 100) / 100, palavras: c.palavras || null, mudo: c.mudo || undefined })),
  });
  let tempoSalvar = null;
  function salvarDepois() { clearTimeout(tempoSalvar); tempoSalvar = setTimeout(salvarProjeto, 1500); }
  async function salvarProjeto() {
    if (st.pendentes) return; // ainda esperando ela escolher os arquivos do projeto aberto
    if (!st.clipes.length && !st.roteiro.trim() && !st.projeto) return;
    const nome = (st.projeto && st.projeto.nomeFixo) || st.tema.trim() || (st.clipes[0] ? st.clipes[0].nome.replace(/\.[^.]+$/, "") : "") || "Projeto sem nome";
    st.salvando = "salvando"; pintarProjeto();
    try {
      const linha = { nome: nome.slice(0, 120), dados: dadosProjeto(), atualizado_em: new Date().toISOString() };
      if (st.projeto && st.projeto.id) { const { error } = await banco().from("edicao_projetos").update(linha).eq("id", st.projeto.id); if (error) throw error; st.projeto.nome = linha.nome; }
      else { const { data, error } = await banco().from("edicao_projetos").insert(linha).select("id,nome,atualizado_em").single(); if (error) throw error; st.projeto = { id: data.id, nome: data.nome }; }
      st.salvando = "salvo";
      const p = st.projetos.find((x) => x.id === st.projeto.id); if (p) { p.nome = linha.nome; p.atualizado_em = linha.atualizado_em; } else st.projetos.unshift({ id: st.projeto.id, nome: linha.nome, atualizado_em: linha.atualizado_em });
    } catch (e) { st.salvando = "erro"; }
    pintarProjeto();
  }
  async function carregarProjetos() {
    try { const { data } = await banco().from("edicao_projetos").select("id,nome,atualizado_em").order("atualizado_em", { ascending: false }).limit(60); st.projetos = data || []; } catch (e) { st.projetos = []; }
    pintarProjeto();
  }
  function limparTudo() {
    if (st.tocando) parar();
    st.clipes.forEach((c) => { try { c.el.remove(); URL.revokeObjectURL(c.el.src); } catch (e) { /* segue */ } });
    const capaBox = $("#ed-capa"); if (capaBox) capaBox.dataset.pronto = "";
    Object.assign(st, { camadas: [], camSel: null, soCamadas: false, histCam: [], desf: [], story: novoStory(), vari: novaVari(), variBase: null, variAtiva: null, ref: null, refPedido: "", carro: null, clipes: [], plano: null, segs: [], legendas: [], efeitos: [], titulo: "", tituloDestaque: "", editLeg: {}, marcas: {}, capa: null, aba: "video", manual: { sons: [], tirados: [], zooms: [], flashes: [], cortes: [], divisoes: [] }, sel: null, correcoes: [], etapas: [], pendentes: null, efeitosSalvos: null, t: 0, arquivoFinal: null, tema: "", roteiro: "", pedidos: "" });
  }
  async function abrirProjeto(id) {
    const { data, error } = await banco().from("edicao_projetos").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast("Não consegui abrir esse projeto.", true); return; }
    limparTudo();
    const d = data.dados || {};
    st.projeto = { id: data.id, nome: data.nome };
    st.tema = d.tema || ""; st.roteiro = d.roteiro || ""; st.pedidos = d.pedidos || ""; st.manual = { sons: [], tirados: [], zooms: [], flashes: [], cortes: [], divisoes: [], ...(d.manual || {}) }; st.plano = d.plano || null; st.titulo = d.titulo || ""; st.tituloDestaque = d.tituloDestaque || "";
    st.editLeg = d.editLeg || {}; st.marcas = d.marcas || {}; st.capa = d.capa || null; st.correcoes = d.correcoes || []; st.ref = d.ref || null; st.refPedido = d.refPedido || ""; st.carro = d.carro || null;
    st.camadas = Array.isArray(d.camadas) ? d.camadas.map((c) => ({ ...c, id: c.id || uid() })) : []; st.soCamadas = Boolean(d.soCamadas); st.camSel = null;
    if (st.camadas.length) st.aba = "textos";
    st.story = { ...novoStory(), ...(d.story || {}) }; st.vari = { ...novaVari(), ...(d.vari || {}), trab: false, gerando: null };
    if (d.opc && d.versao >= 3) Object.assign(st.opc, d.opc);
    if (st.opc.estiloTitulo === "capcut") st.opc.estiloTitulo = "simples";
    st.efeitosSalvos = Array.isArray(d.efeitos) ? d.efeitos.map((e) => ({ ...e, id: uid() })) : null;
    st.pendentes = (d.clipes || []).length ? d.clipes.map((c) => ({ ...c, usado: false })) : null;
    const sec = document.getElementById("aba-" + ABA);
    if (sec) { $("#ed-tema", sec).value = st.tema; $("#ed-roteiro", sec).value = st.roteiro; $("#ed-pedidos", sec).value = st.pedidos; $("#ed-roteiro-box", sec).open = Boolean(st.roteiro); }
    pintar(); pintarProjeto();
  }
  function novoProjeto() {
    limparTudo(); st.projeto = null;
    const sec = document.getElementById("aba-" + ABA);
    if (sec) { $("#ed-tema", sec).value = ""; $("#ed-roteiro", sec).value = ""; $("#ed-pedidos", sec).value = ""; }
    pintar(); pintarProjeto();
  }
  function pintarProjeto() {
    const box = $("#ed-projeto"); if (!box) return;
    const quando = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    box.innerHTML = `<select class="entrada" id="ed-proj-sel" aria-label="Meus projetos"><option value="">${st.projeto ? "Trocar de projeto…" : "Meus projetos…"}</option>${st.projetos.map((p) => `<option value="${p.id}" ${st.projeto && st.projeto.id === p.id ? "selected" : ""}>${esc(p.nome)} · ${quando(p.atualizado_em)}</option>`).join("")}</select>
      <button class="btn" type="button" id="ed-proj-novo">${ic.mais}Novo projeto</button>
      ${st.projeto ? `<button class="icone-btn" type="button" id="ed-proj-apagar" title="Apagar este projeto" aria-label="Apagar este projeto">${ic.x}</button>` : ""}
      <small class="ed-proj-status">${st.salvando === "salvando" ? "salvando…" : st.salvando === "salvo" ? "salvo ✓" : st.salvando === "erro" ? "não salvou" : ""}</small>`;
    $("#ed-proj-sel", box).addEventListener("change", (e) => { if (e.target.value) abrirProjeto(e.target.value); });
    $("#ed-proj-novo", box).addEventListener("click", novoProjeto);
    const ap = $("#ed-proj-apagar", box);
    if (ap) ap.addEventListener("click", async () => {
      if (!confirm(`Apagar o projeto "${st.projeto.nome}"? O vídeo no seu aparelho não é apagado.`)) return;
      await banco().from("edicao_projetos").delete().eq("id", st.projeto.id);
      st.projetos = st.projetos.filter((p) => p.id !== st.projeto.id); novoProjeto();
    });
  }

  // ---------- o trabalho do editor ----------
  function etapa(texto, estado) {
    const ult = st.etapas[st.etapas.length - 1];
    if (ult && ult.estado === "andando") ult.estado = "ok";
    if (texto) st.etapas.push({ texto, estado: estado || "andando" });
    pintarEtapas(); pintarTrabalhando();
  }
  // pedidos escritos por ela que o painel entende sozinho, sem depender da IA
  // ("sem legenda", "só efeitos e transições", "sem título", "sem zoom", "legenda maior"...)
  function regrasDoPedido(texto) {
    const t = " " + String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + " ";
    // "não ... legenda" (até umas 6 palavras entre eles), "sem legenda", "tira a legenda", "nada de legenda"
    const nao = (alvo) => new RegExp(`(\\bsem|\\bnao\\b[^.;!?,]{0,45}?|\\btir[ae]r?|nada de|zero)\\s*(a |as |o |os |de |nenhum |nenhuma )?${alvo}\\b`).test(t);
    const o = {};
    const so = /\b(so|apenas|somente)( [a-z]+){0,4} (efeitos?|sons?|transic)/.test(t);
    if (nao("legendas?") || so) o.legenda = false;
    if (/\b(com|quero|coloca|coloque|pode por|ponha) (a )?legendas?\b/.test(t) && !nao("legendas?")) o.legenda = true;
    if (nao("titulos?") || so) o.titulo = false;
    if (so) { o.chamativas = false; o.silencio = false; o.erros = false; o.vicios = false; }
    if (so && /(efeitos?|sons?)/.test(t.split(/\b(so|apenas|somente)\b/).pop())) o.efeitos = true;
    if (nao("cortes?") || nao("cortar") || /nao (corta|corte|cortar)/.test(t)) { o.silencio = false; o.erros = false; o.vicios = false; }
    if (nao("zooms?")) { o.zoomCortes = false; o.zoomEnfase = false; }

    if (nao("transic(ao|oes)")) o.transicao = "nenhuma";
    if (/legenda (maior|grande|maiores)/.test(t)) o.tamLeg = 1.25;
    if (/legenda (menor|pequena|menores)/.test(t)) o.tamLeg = 0.85;
    // quantidade de efeitos sonoros
    const SONS = "(efeitos?( sonoros?)?|sons?|barulhinhos?|sfx)";
    const volume = /(volume|mais baixo|mais alto|abaix|baixinho|altura do som|alto demais|muito alto)/.test(t);
    if (new RegExp(`(muitos?|mais|bastante|aument\\w*|encher|cheio de|varios?)( de| os| as)? ${SONS}`).test(t) && !volume) o.sons = "muitos";
    if ((new RegExp(`(poucos?|menos|diminu\\w*|reduz\\w*|menor quantidade|alguns|uns)( os| as| de| a| o| quantidade de)? ${SONS}`).test(t) || new RegExp(`${SONS}[^.;!?]{0,25}(demais|exagerad|diminu|reduz|menos)`).test(t)) && !volume) o.sons = "poucos";
    if (/(impacto|frases? fortes?|momentos? fortes?|momentos? chave|principais|importantes|so no principal|so nos momentos|so nas? (frases?|falas?|fracas?|partes?))/.test(t) && new RegExp(SONS).test(t)) o.sons = "impacto";
    // vídeo que já vem pré-editado: edição leve (o padrão dela): não recorta, não legenda, não põe título,
    // só sons nos momentos-chave (a não ser que ela peça outra quantidade)
    if (/pre.?editad|ja (esta|ta|vem|veio|foi) (pre.?)?editad|ja (cortei|legendei|editei)|ja esta cortad|ja tem legenda/.test(t)) {
      Object.assign(o, { preEditado: true, legenda: false, titulo: false, chamativas: false, silencio: false, erros: false, vicios: false, zoomCortes: false, dinamismo: o.dinamismo || "normal" });
      if (!o.sons || (o.sons === "poucos" && /so n/.test(t))) o.sons = o.sons === "muitos" ? "muitos" : "impacto";
    }
    if (nao(SONS) && !so) o.sons = "nenhum";
    if (so && new RegExp(SONS).test(t.split(/\b(so|apenas|somente)\b/).pop()) && !o.sons) o.sons = /alguns|poucos|uns/.test(t) ? "poucos" : "medio";
    if (volume && new RegExp(SONS).test(t)) o.vol = /(mais alto|aument|alto demais nao|nao (da|esta) pra ouvir|baixo demais)/.test(t) ? 0.65 : 0.22;
    // dinamismo: cortes, transição, zoom entrando e saindo
    if (/dinamic|(corte|cortes)[^.;!?]{0,30}(transic|zoom)|transic[^.;!?]{0,30}zoom|zoom (in|out|entrando|saindo)|diminuicao de zoom|mais cortes|mais ritmo|ritmo (rapido|acelerado)|mais agil/.test(t) && !/(menos|sem|nao)[^.;!?]{0,8}dinamic/.test(t)) {
      o.dinamismo = "dinamico"; o.ritmo = "turbo"; o.zoomCortes = true; o.zoomEnfase = true; if (o.transicao !== "nenhuma") o.transicao = "deslize";
      if (!so) { o.silencio = true; o.erros = true; }
    }
    if (/(mais calmo|menos dinamic|sem dinamismo|mais lento|menos cortes|menos zoom|mais tranquilo)/.test(t)) { o.dinamismo = "calmo"; o.ritmo = "normal"; }
    // formato do vídeo
    if (/horizontal|16 ?(:|x|por) ?9|paisagem|formato largo|widescreen|(video|formato|edicao|ele|tudo) (todo )?(deitado|na horizontal)/.test(t) && !/(nao|sem)[^.;!?]{0,12}horizontal/.test(t)) o.formato = "horizontal";
    else if (/\bvertical\b|em pe\b|9 ?(:|x|por) ?16|formato (de )?(reels|stories)/.test(t)) o.formato = "vertical";
    // relaxante: ritmo calmo, poucos sons e só os suaves, sem zoom, flash nem transição, com respiro nos cortes
    if (/relax|calm[oa]|tranquil|zen\b|sereno|clima leve|bem leve|devagar|mais suave|asmr|(efeitos?|sons?|transic\w*|cortes?|zooms?|video|edicao)[^.;!?]{0,20}\b(estao|esta|ta|tao|ficou|ficaram)\s+(muito\s+|bem\s+|tao\s+)?(rapid|acelerad|agitad|frenetic)|(rapid|acelerad|agitad)[a-z]* demais/.test(t) && !/(nao|sem)[^.;!?]{0,10}(relax|calm)/.test(t)) {
      Object.assign(o, { relaxante: true, sonsSuaves: true, dinamismo: "calmo", ritmo: "normal", sons: o.sons === "nenhum" ? "nenhum" : "poucos", zoomCortes: false, zoomEnfase: false, flash: false, tremer: false, transicao: "nenhuma", silencio: false });
    }
    if (o.dinamismo === "dinamico") { o.relaxante = false; o.sonsSuaves = false; }
    if (o.formato) o.formatoEscolhido = true;
    if (/ducking|musica[^.;!?]{0,25}(abaix|baix|diminu)[^.;!?]{0,25}(fal|voz)/.test(t)) o.ducking = !/sem ducking|nao[^.;!?]{0,10}ducking/.test(t);
    // cor dos textos na tela e da legenda (ex.: "o amarelo no azul da Ortobom", "legenda branca")
    if (/\b(cor|cores|legenda|texto|textos|letra|letras|frase|frases|escrita|amarel|azul|branc|rosa|vermelh|verde|laranja|roxo|lilas|dourad|pret)|#[0-9a-f]{6}/.test(t)) {
      const CORES = [["azul (da |de )?(paleta |cor |cores )*(de cores )?(da |de )?ortobom|azul ortobom", "#0a4ea0"], ["azul marinho", "#1d2f5c"], ["azul (claro|bebe)", "#7cc0ee"], ["azul", "#1f5fbf"], ["brancas?|brancos?", "#ffffff"], ["pret[oa]s?", "#111111"], ["amarel[oa]s?", "#ffd84d"], ["rosa", "#f28cb1"], ["vermelh[oa]s?", "#e0393e"], ["verdes?", "#3fa66b"], ["laranja", "#f28c28"], ["roxo|roxa|lilas", "#8a6cf0"], ["dourad[oa]s?", "#d4af37"], ["creme|bege", "#fff3b0"]];
      const hex = (t.match(/#[0-9a-f]{6}\b/) || [])[0];
      let alvo = hex || null;
      if (!alvo) for (const [rx, h] of CORES) { if (new RegExp(`\\b(para|pra|por|no|na|em|de cor|cor) (o |a |os |as )?(${rx})\\b`).test(t)) { alvo = h; break; } }
      if (!alvo) { const achadas = CORES.filter(([rx]) => new RegExp(`\\b(${rx})\\b`).test(t)); if (achadas.length === 1 && /\b(cor|deixa|coloca|muda|troca|quero|fica|ajust)/.test(t)) alvo = achadas[0][1]; }
      if (alvo) { o.corTextos = alvo; o.corAlvo = /\b(tudo|todos|todas|todo o texto|letras? pequenas?|caixa alta|todas as letras|inteir)/.test(t) ? "tudo" : "grande"; }
    }
    if (/maiuscul/.test(t) && !/sem maiuscul|nao.{0,12}maiuscul/.test(t)) o.maiusculas = true;
    if (/minuscul/.test(t)) o.maiusculas = false;
    return o;
  }

  function descreverRegras(o) {
    const d = [];
    if ("legenda" in o && !o.preEditado) d.push(o.legenda ? "com legenda" : "sem legenda");
    if ("titulo" in o && !o.preEditado) d.push(o.titulo ? "com título" : "sem título");
    if (o.preEditado) d.push("vídeo já pré-editado: não refiz cortes, legenda nem título");
    else if (o.silencio === false) d.push("sem recortar a fala");
    if (o.sons) d.push({ nenhum: "sem efeitos sonoros", impacto: "efeitos só nas frases de impacto", poucos: "poucos efeitos sonoros", medio: "efeitos na medida", muitos: "muitos efeitos sonoros" }[o.sons]);
    if ("vol" in o) d.push(o.vol > 0.4 ? "efeitos mais altos" : "efeitos mais baixinhos");
    if (o.dinamismo === "dinamico") d.push("dinâmico: cortes sem pausa, zoom entrando e saindo, transição e flash na troca de cena");
    if (o.relaxante) d.push("relaxante: poucos sons e só os suaves, sem zoom, flash nem transição, com respiro nos cortes");
    else if (o.dinamismo === "calmo") d.push("mais calmo: sem zoom nem transição");
    if (o.corTextos) { const nomes = { "#0a4ea0": "azul da Ortobom", "#1d2f5c": "azul-marinho", "#7cc0ee": "azul-claro", "#1f5fbf": "azul", "#ffffff": "branco", "#111111": "preto", "#ffd84d": "amarelo", "#f28cb1": "rosa", "#e0393e": "vermelho", "#3fa66b": "verde", "#f28c28": "laranja", "#8a6cf0": "roxo", "#d4af37": "dourado", "#fff3b0": "creme" }; d.push(`textos na tela e legenda em ${nomes[o.corTextos] || o.corTextos}${o.corAlvo === "tudo" ? " (todas as linhas, inclusive as pequenas)" : " (as frases grandes; para mudar as linhas pequenas também, peça \"tudo\")"}`); }
    if (o.formato) d.push(o.formato === "horizontal" ? "vídeo na horizontal (16:9, 1920x1080)" : "vídeo na vertical (9:16)");
    if (o.zoomEnfase === false) d.push("sem zoom");
    if (o.transicao === "nenhuma") d.push("sem transição");
    if (o.tamLeg) d.push(o.tamLeg > 1 ? "legenda maior" : "legenda menor");
    if ("maiusculas" in o) d.push(o.maiusculas ? "legenda em maiúsculas" : "legenda em minúsculas");
    return d;
  }

  // o padrão dela + os pedidos para este vídeo (vão juntos para a IA, com prioridade)
  const padraoComPedidos = () => {
    let t = st.pedidos.trim() ? `${st.padrao}\n\nPEDIDOS DELA PARA ESTE VÍDEO (prioridade máxima, valem mais que o padrão):\n${st.pedidos.trim()}` : st.padrao;
    if (st.opc.relaxante) t += "\n\nCLIMA DESTE VÍDEO: RELAXANTE (vale mais que qualquer regra de vídeo dinâmico acima). Ritmo calmo, cenas respirando, poucos efeitos sonoros e só suaves (whoosh suave, brilho, ding de cristal), nada de riser, hit, clique, shutter ou typing; sem zoom, sem flash, sem tremidinha e sem transição; textos na tela com calma, frases curtas e acolhedoras.";
    if (horizontal()) t += "\n\nFORMATO: vídeo horizontal 16:9 (1920x1080), gravado deitado.";
    return t;
  };
  // roteiro colado no campo de pedidos: se o texto tem cenas, texto na tela ou etapas, vale como roteiro
  const pareceRoteiro = (x) => /\b(cena\s*0?\d+|texto na tela|etapa\s*0?\d+|voice.?over|\bv\.?o\.?:)/i.test(x || "");
  // as linhas de cena do roteiro não viram regra (ex.: "deitada na cama" não pode virar vídeo horizontal)
  const pedidosSemRoteiro = () => pareceRoteiro(st.pedidos) ? st.pedidos.split(/\n+/).filter((l) => !pareceRoteiro(l) && l.trim().length < 160).join("\n") : st.pedidos;
  const roteiroUsado = () => st.roteiro.trim() || (pareceRoteiro(st.pedidos) ? st.pedidos.trim() : "");
  const palavrasBrutas = () => st.clipes.flatMap((c) => (c.palavras || []).map((w) => ({ w: w.w, s: +(w.s + c.offset).toFixed(2), e: +(w.e + c.offset).toFixed(2) })));

  // ---------- correção da edição ----------
  // ---------- pedir ajuste (como falar com uma editora) ----------
  // 1) o pedido é dividido em partes; o que o painel entende sozinho (sons, legenda, título, zoom,
  //    dinamismo, pré-editado...) é aplicado exatamente, sem IA; 2) só as partes que sobram vão
  //    para a IA; 3) dá para desfazer o último ajuste com um toque.
  const PALAVRA_VAZIA = /^(ok|okay|por favor|pfv|obrigad[ao]|quero|queria|entao|entende(u)?|sabe|ta|tá|ai|aí|neste video|nesse video|nesse|neste|esse video|este video|olha|bom|beleza)$/;
  const semAcento = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  function partesSemRegra(texto) {
    return String(texto).split(/[.;!?\n,]+|\s+e\s+/i).map((x) => x.trim()).filter((x) => {
      const n = semAcento(x);
      if (!n || n.split(" ").length < 2 || PALAVRA_VAZIA.test(n)) return false;
      return !Object.keys(regrasDoPedido(x)).length;
    });
  }
  function fotoDaEdicao() { return JSON.parse(JSON.stringify({ plano: st.plano, titulo: st.titulo, tituloDestaque: st.tituloDestaque, opc: st.opc, manual: st.manual, marcas: st.marcas })); }
  function desfazerAjuste() {
    const f = st.desfazerAjuste; if (!f) return;
    if (st.tocando) parar();
    Object.assign(st, { plano: f.plano, titulo: f.titulo, tituloDestaque: f.tituloDestaque, opc: f.opc, manual: f.manual, marcas: f.marcas, desfazerAjuste: null });
    ajustarVoz(); montar(); pintar(); irPara(0); salvarDepois();
    toast("Voltei a edição para como estava antes do último ajuste.");
  }
  async function corrigir(texto, o = {}) {
    texto = String(texto || "").trim();
    if (!texto) { toast("Escreva o que você quer mudar.", true); return; }
    if (!st.plano || st.corrigindo) return;
    st.corrigindo = true; pintarAjustar();
    const foto = fotoDaEdicao();
    try {
      if (st.tocando) parar();
      const antes = { dur: st.duracao, ef: st.efeitos.length, zo: st.zooms.length, tit: st.titulo, opc: { ...st.opc }, rem: JSON.stringify((st.plano || {}).remover || []), dest: JSON.stringify((st.plano || {}).destaques || []) };
      const locais = o.soIA ? {} : regrasDoPedido(texto);
      let sobra = o.soIA ? [texto] : partesSemRegra(texto);
      // vídeo sem fala que ficou sem texto na tela: monta os textos pelas cenas do roteiro
      if (!palavrasBrutas().length && roteiroUsado() && !((st.plano.textos || []).length)) {
        if (Object.keys(locais).length) { const { preEditado: _x, ...lo } = locais; Object.assign(st.opc, lo); }
        const novo = await chamar({ acao: "plano", palavras: [], duracao: st.clipes.reduce((a, c) => a + c.dur, 0), padrao: padraoComPedidos(), tema: st.tema, roteiro: roteiroUsado(),
          clipes: st.clipes.map((c) => ({ nome: c.nome, de: +c.offset.toFixed(2), ate: +(c.offset + c.dur).toFixed(2), dur: +c.dur.toFixed(2) })) });
        st.plano = { ...novo, sem_fala: true }; if (novo.titulo) { st.titulo = novo.titulo; st.tituloDestaque = novo.titulo_destaque || ""; }
        sobra = sobra.filter((x) => !pareceRoteiro(x) && x.length < 200);
      }
      let r = { plano: null, opc: {}, resposta: "", regra: "" };
      // só chama a IA para o que o painel não entendeu sozinho (e ela recebe só essa parte)
      if (sobra.length) {
        r = await chamar({ acao: "corrigir", comentario: sobra.join(". "), plano: st.plano, titulo: st.titulo, opc: Object.fromEntries(OPC_VISUAIS.map((k) => [k, st.opc[k]])),
          palavras: palavrasBrutas().map((w) => ({ w: w.w, s: w.s })), duracao: st.clipes.reduce((s, c) => s + c.dur, 0), padrao: padraoComPedidos(), roteiro: roteiroUsado() || undefined, historico: st.correcoes.map((c) => c.texto) });
        const check = st.plano.roteiro_check;
        st.plano = { ...r.plano, roteiro_check: (r.plano.roteiro_check || []).length ? r.plano.roteiro_check : check };
        if (r.plano.titulo) { st.titulo = r.plano.titulo; st.tituloDestaque = r.plano.titulo_destaque || st.tituloDestaque; }
        if (r.opc && r.opc.sfxAuto && !locais.sons) locais.sons = { desligado: "nenhum", pouco: "poucos", medio: "medio", muito: "muitos" }[r.opc.sfxAuto];
      }
      const { preEditado: _pe, corTextos: _ct, corAlvo: _ca, ...locaisOpc } = locais;
      if (locais.corTextos) {
        if (st.camadas.length) { guardarCam(); st.camadas.forEach((c) => { c.cor = locais.corTextos; if (locais.corAlvo === "tudo") c.corPequena = locais.corTextos; }); }
        locaisOpc.corLegenda = locais.corTextos; locaisOpc.cor = locais.corTextos;
      }
      Object.assign(st.opc, r.opc || {}, locaisOpc); r.opc = { ...(r.opc || {}), ...locaisOpc };
      ajustarVoz(); st.opc.confete = false; if (st.opc.estiloTitulo === "capcut") st.opc.estiloTitulo = "simples";
      const entendi = descreverRegras(locais);
      const resposta = [entendi.length ? "Entendi: " + entendi.join("; ") + "." : "", sobra.length ? (r.resposta || "") : ""].filter(Boolean).join(" ");
      st.correcoes.push({ texto, resposta: resposta || "Ok.", regra: r.regra || "" });
      montar(); st.t = 0;
      // o que mudou de verdade (para ela ver que ajustou, ou saber que não deu)
      const mud = [];
      if (Math.abs(st.duracao - antes.dur) > 0.05) mud.push(`duração ${tempo(antes.dur)} → ${tempo(st.duracao)}`);
      if (JSON.stringify(st.plano.remover || []) !== antes.rem) mud.push("cortes");
      if (st.efeitos.length !== antes.ef) mud.push(`efeitos ${antes.ef} → ${st.efeitos.length}`);
      if (st.zooms.length !== antes.zo) mud.push(`zooms ${antes.zo} → ${st.zooms.length}`);
      if (st.titulo !== antes.tit) mud.push("título");
      if (JSON.stringify(st.plano.destaques || []) !== antes.dest) mud.push("palavras de destaque");
      const nomesOpc = { estilo: "estilo da legenda", fonteLeg: "fonte", corLegenda: "cor da legenda", porLegenda: "palavras por legenda", tamLeg: "tamanho da legenda", altura: "altura da legenda", sombra: "sombra", estiloTitulo: "estilo do título", ritmo: "ritmo", sfxAuto: "sons automáticos", transicao: "transição", vol: "volume dos efeitos", maiusculas: "maiúsculas", cor: "cor do destaque", sonsTitulo: "som do título", legenda: "legenda", sons: "quantidade de efeitos", dinamismo: "dinamismo", vicios: "vícios de fala", vozForte: "volume da voz", efeitos: "efeitos sonoros", titulo: "título na tela", zoomCortes: "zoom nos cortes", zoomEnfase: "zoom na ênfase", chamativas: "palavras chamativas", flash: "flash", tremer: "tremidinha", silencio: "corte de silêncios", erros: "tomadas erradas", formato: "formato do vídeo", relaxante: "clima relaxante", sonsSuaves: "só sons suaves", formatoEscolhido: "formato do vídeo", ritmo: "ritmo" };
      Object.keys(r.opc || {}).forEach((k) => { if (antes.opc[k] !== st.opc[k] && !mud.includes(nomesOpc[k] || k)) mud.push(nomesOpc[k] || k); });
      const ultima = st.correcoes[st.correcoes.length - 1];
      ultima.mudou = mud;
      if (!mud.length) ultima.resposta += " (Nada mudou no vídeo. Tente dizer de outro jeito, com o momento e o que quer, ou ajuste direto nas abas e na linha do tempo.)";
      st.desfazerAjuste = mud.length ? foto : null; if (mud.length) marcarDesfazer("ajuste");
      if (st.lembrar && !o.soIA && r.regra && !st.padrao.includes(r.regra)) {
        const marca = "CORREÇÕES QUE ELA PEDIU (valem sempre):";
        const novo = st.padrao.includes(marca) ? st.padrao.replace(marca, marca + "\n- " + r.regra) : st.padrao.trim() + "\n\n" + marca + "\n- " + r.regra;
        try { await salvarPadrao(novo); } catch (e) { /* segue */ }
      }
      if (st.lembrar) guardarOpc();
      toast(mud.length ? "Ajustei: " + mud.join(", ") + ". Dá o play." : "Não mudou nada no vídeo. Tente explicar de outro jeito.", !mud.length);
      salvarDepois();
    } catch (e) { toast(e.message, true); }
    st.corrigindo = false; pintar(); irPara(0);
  }
  function pintarAjustar() {
    const box = $("#ed-ajustar"); if (!box) return;
    if (!st.segs.length || !st.plano) { box.hidden = true; return; }
    box.hidden = false;
    const ult = st.correcoes.slice(-2);
    const txt = $("#ed-ajustar-txt", box); const rascunho = txt ? txt.value : "";
    box.innerHTML = `<h3 class="ed-titulo">Pedir ajuste</h3>
      ${ult.map((c) => `<div class="ed-corr"><p class="ed-corr-eu">${esc(c.texto)}</p><p class="ed-corr-ia">${esc(c.resposta)}${c.mudou && c.mudou.length ? `<small>Mudou: ${esc(c.mudou.join(", "))}</small>` : ""}</p></div>`).join("")}
      <textarea class="entrada" id="ed-ajustar-txt" rows="3" placeholder="Escreva como falaria com uma editora. Ex.: quero poucos efeitos sonoros; deixa mais dinâmico; sem legenda; corta o começo até eu falar o nome do produto." ${st.corrigindo ? "disabled" : ""}>${esc(rascunho)}</textarea>
      <div class="rr-ajustar-acoes"><button class="btn btn-principal" type="button" id="ed-ajustar-btn" ${st.corrigindo ? "disabled" : ""}>${st.corrigindo ? "Ajustando…" : ic.brilho + "Ajustar"}</button>
      ${st.desfazerAjuste ? `<button class="btn" type="button" id="ed-ajustar-desfazer">Desfazer último ajuste</button>` : ""}</div>
      <label class="ed-chk"><input type="checkbox" id="ed-corr-lembrar" ${st.lembrar ? "checked" : ""}> Lembrar nas próximas edições</label>`;
    $("#ed-ajustar-btn", box).addEventListener("click", () => { const v = $("#ed-ajustar-txt", box).value; corrigir(v).then(() => { const t = $("#ed-ajustar-txt"); if (t && st.correcoes.length && st.correcoes[st.correcoes.length - 1].texto === v.trim()) t.value = ""; }); });
    const d = $("#ed-ajustar-desfazer", box); if (d) d.addEventListener("click", desfazerAjuste);
    $("#ed-corr-lembrar", box).addEventListener("change", (e) => { st.lembrar = e.target.checked; });
  }


  async function editar() {
    if (!st.clipes.length) { toast("Envie o vídeo bruto primeiro.", true); return; }
    if (st.trabalhando) return;
    if (st.refArq && !st.ref && !st.refTrab) { toast("Primeiro vou analisar o vídeo de referência…"); try { await analisarReferencia(); } catch (e) { /* segue sem */ } }
    if (st.ref && !st.ref.aplicado) {
      const rf = st.ref; Object.assign(st.opc, rf.opc || {});
      const regra = (rf.regras || []).length ? "Seguir a referência (" + (rf.nome || "vídeo de referência") + "): " + rf.regras.join("; ") : "";
      if (regra && !st.pedidos.includes(regra)) { st.pedidos = (st.pedidos.trim() ? st.pedidos.trim() + "\n" : "") + regra; const pd = $("#ed-pedidos"); if (pd) pd.value = st.pedidos; }
      rf.aplicado = true;
    }
    st.trabalhando = true; st.etapas = []; st.correcoes = []; pintar();
    try { audio(); if (ac.state === "suspended") ac.resume(); } catch (e) { /* segue */ }
    try {
      let offset = 0;
      for (const [i, c] of st.clipes.entries()) {
        if (!c.palavras || (!c.palavras.length && !c.mudo)) {
          etapa(`Ouvindo o clipe ${i + 1} de ${st.clipes.length}`);
          // 1º: tira a faixa de áudio de dentro do MP4/MOV (não depende do navegador abrir o áudio)
          let partes = await audioDoArquivo(c.arquivo);
          if (!partes) partes = IPHONE && c.arquivo.size > 150e6 ? null : await audioDoVideo(c.arquivo);
          // iPhone/Safari não abre o áudio de .MOV (ou o arquivo é grande demais): escuta tocando o vídeo
          if (!partes) { etapa(`Ouvindo o clipe ${i + 1} tocando${IPHONE ? " (no iPhone leva o tempo do vídeo, deixe a tela ligada)" : " (leva o tempo do vídeo)"}`); partes = await audioTocando(c); }
          if (!partes.length) c.mudo = true;
          c.palavras = [];
          for (const p of partes) {
            const form = new FormData(); form.append("acao", "transcrever"); form.append("arquivo", p.blob, p.nome || "audio.wav");
            const r = await chamar(form);
            c.palavras.push(...(r.palavras || []).map((w) => ({ w: w.w, s: w.s + p.inicio, e: w.e + p.inicio })));
          }
        }
        c.offset = offset; offset += c.dur;
      }
      const todas = palavrasBrutas();
      if (todas.length) {
        etapa("Pensando na edição (cortes, título, zoom e efeitos)");
        st.plano = await chamar({ acao: "plano", palavras: todas, duracao: offset, padrao: padraoComPedidos(), tema: st.tema, roteiro: roteiroUsado() || undefined });
        st.titulo = st.plano.titulo || "";
        st.tituloDestaque = st.plano.titulo_destaque || "";
      } else if (roteiroUsado()) {
        if (!st.roteiro.trim()) etapa("Achei o roteiro no campo \"O que você quer nesta edição\" e vou usar ele para montar o texto na tela.", "ok");
        // vídeo sem fala: a edição sai do roteiro (cada clipe é uma cena, na ordem)
        etapa("O vídeo não tem fala, então vou montar a edição pelo seu roteiro (cada clipe é uma cena, na ordem da lista)");
        st.plano = await chamar({ acao: "plano", palavras: [], duracao: offset, padrao: padraoComPedidos(), tema: st.tema, roteiro: roteiroUsado(),
          clipes: st.clipes.map((c) => ({ nome: c.nome, de: +c.offset.toFixed(2), ate: +(c.offset + c.dur).toFixed(2), dur: +c.dur.toFixed(2) })) });
        st.plano.sem_fala = true;
        st.titulo = st.plano.titulo || "";
        st.tituloDestaque = st.plano.titulo_destaque || "";
      } else {
        etapa("Esse vídeo não tem fala. Cole o roteiro em \"Seu roteiro\" e clique em Editar de novo: eu monto o texto na tela, o título e os efeitos pelas cenas dele.", "erro");
        st.plano = { titulo: "", remover: [], destaques: [], zooms: [], efeitos: [], broll: [], dicas: ["Não ouvi fala nesse vídeo, então não cortei silêncios nem pus legenda. Dá para pôr título e efeitos à mão."], musica: "" };
      }
      etapa("Montando a linha do tempo");
      // o que ela escreveu em "O que você quer nesta edição" vale com certeza
      Object.assign(st.opc, (st.plano && st.plano.opc) || {}, (({ preEditado, ...x }) => x)(regrasDoPedido(pedidosSemRoteiro())));
      if (st.plano) delete st.plano.opc;
      ajustarVoz();
      montar();
      const ouvidas = palavrasBrutas();
      if (ouvidas.length) etapa(`Ouvi o seu vídeo: ${ouvidas.length} palavras (veja abaixo em "O que eu ouvi").`, "ok");
      else if (st.plano && st.plano.sem_fala) etapa(`Montei pelo roteiro: ${(st.plano.textos || []).length} textos na tela em ${st.clipes.length} cena${st.clipes.length > 1 ? "s" : ""}. Se alguma cena ficou fora de ordem, arraste o clipe na lista e clique em Editar.`, "ok");
      else etapa("Não ouvi fala no vídeo.", "erro");
      const reg = regrasDoPedido(pedidosSemRoteiro());
      if (Object.keys(reg).length) etapa("Segui o que você pediu: " + descreverRegras(reg).join("; ") + ".", "ok");
      etapa("Pronto! Dá o play para ver a prévia.", "ok");
      st.aba = "cortes";
      salvarDepois();
      st.t = 0; desenhar(0);
    } catch (e) {
      const ult = st.etapas[st.etapas.length - 1]; if (ult) ult.estado = "erro";
      etapa(e.message || "Deu erro.", "erro");
    }
    st.trabalhando = false; pintar();
  }

  // ---------- linha do tempo ----------
  // tudo em "tempo do bruto" (clipes enfileirados) e depois convertido para o tempo final
  function faixasMantidas() {
    const faixas = [];
    for (const c of st.clipes) {
      const fim = c.offset + c.dur;
      if (!st.opc.silencio || !c.palavras || !c.palavras.length) { faixas.push([c.offset, fim]); continue; }
      let atual = null;
      const R = RITMOS[st.opc.ritmo] || RITMOS.rapido;
      for (const w of c.palavras) {
        const a = Math.max(c.offset, c.offset + w.s - R.antes), b = Math.min(fim, c.offset + w.e + R.depois);
        if (atual && a - atual[1] < R.junta) atual[1] = Math.max(atual[1], b); else { if (atual) faixas.push(atual); atual = [a, b]; }
      }
      if (atual) faixas.push(atual);
    }
    let lista = faixas;
    const tirar = (de, ate) => {
      const nova = [];
      for (const [a, b] of lista) { if (ate <= a || de >= b) { nova.push([a, b]); continue; } if (de > a) nova.push([a, de]); if (ate < b) nova.push([ate, b]); }
      lista = nova;
    };
    const mantidas = palavrasRevisao().filter((w) => st.marcas[w.k] === "manter");
    if (st.opc.erros && st.plano) for (const r of st.plano.remover || []) {
      // palavra que ela devolveu dentro de um trecho que a IA tirou: abre um buraco só para ela
      let de = r.de;
      for (const w of mantidas.filter((x) => x.g >= r.de && x.g < r.ate).sort((a, b) => a.g - b.g)) { if (w.corteDe > de) tirar(de, w.corteDe); de = Math.max(de, w.corteAte); }
      if (r.ate > de) tirar(de, r.ate);
    }
    // palavras que ela cortou na revisão e os vícios de fala
    for (const w of palavrasRevisao()) if (cortada(w)) tirar(w.corteDe, w.corteAte);
    // planos que ela apagou na linha do tempo
    for (const [de, ate] of st.manual.cortes || []) tirar(de, ate);
    // divisões que ela fez ("Dividir aqui"): o plano vira dois
    for (const g of st.manual.divisoes || []) { const nova = []; for (const [a, b] of lista) { if (g > a + 0.15 && g < b - 0.15) nova.push([a, g], [g, b]); else nova.push([a, b]); } lista = nova; }
    return lista.filter(([a, b]) => b - a >= 0.15);
  }
  // ritmo dos cortes: quanto de respiro fica antes e depois da fala e a partir de que pausa corta
  const RITMOS = { normal: { antes: 0.08, depois: 0.14, junta: 0.3 }, rapido: { antes: 0.05, depois: 0.08, junta: 0.16 }, turbo: { antes: 0.03, depois: 0.05, junta: 0.08 } };
  // vícios de fala que saem sozinhos ("é" fica, porque também é verbo) e muletas só sugeridas
  const VICIOS = new Set(["éé", "ééé", "eh", "ehh", "ah", "ahn", "ãh", "ãã", "hã", "hãã", "hum", "humm", "hmm", "hm", "uhm", "uh", "um", "mmm", "aham"]);
  const MULETAS = new Set(["tipo", "né", "sabe", "assim", "então", "basicamente", "enfim"]);
  const limpaPalavra = (x) => String(x || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  // todas as palavras no tempo do bruto, com o pedaço a cortar (até o meio do espaço com as vizinhas)
  function palavrasRevisao() {
    const lista = [];
    for (const c of st.clipes) {
      const ws = c.palavras || [];
      ws.forEach((w, i) => {
        const g = c.offset + w.s, ge = c.offset + w.e, ant = ws[i - 1], prox = ws[i + 1];
        const l = limpaPalavra(w.w);
        lista.push({ w: w.w, g, ge, k: chaveLeg(g), vicio: VICIOS.has(l), muleta: MULETAS.has(l),
          corteDe: Math.max(ant ? c.offset + (ant.e + w.s) / 2 : c.offset, g - 0.04), corteAte: Math.min(prox ? c.offset + (w.e + prox.s) / 2 : c.offset + c.dur, ge + 0.04) });
      });
    }
    return lista;
  }
  function cortada(w) { const m = st.marcas[w.k]; return m === "cortar" || (m !== "manter" && w.vicio && st.opc.vicios); }
  function tiradaPelaIA(w) { return st.opc.erros && st.plano && (st.plano.remover || []).some((r) => w.g >= r.de && w.g < r.ate) && st.marcas[w.k] !== "manter"; }

  function montar() {
    if (st.opc.relaxante) Object.assign(st.opc, { dinamismo: "calmo", zoomCortes: false, zoomEnfase: false, flash: false, tremer: false, transicao: "nenhuma", sonsSuaves: true });
    const faixas = faixasMantidas();
    st.segs = [];
    let out = 0;
    for (const [a, b] of faixas) {
      for (const [ci, c] of st.clipes.entries()) {
        const ca = Math.max(a, c.offset), cb = Math.min(b, c.offset + c.dur);
        if (cb - ca < 0.15) continue;
        st.segs.push({ ci, a: ca - c.offset, b: cb - c.offset, g0: ca, g1: cb, o0: out, o1: out + (cb - ca) });
        out += cb - ca;
      }
    }
    // CapCut (out/2026): cena trocada por outro trecho do bruto e ordem escolhida arrastando
    const mm = st.manual || {};
    st.segs.forEach((sg) => { sg.chave = Math.round(sg.g0 * 10); sg.og0 = sg.g0; sg.og1 = sg.g1; });
    for (const sg of st.segs) {
      const tr = (mm.trocas || {})[sg.chave], c = tr && st.clipes[tr.ci]; if (!c) continue;
      const a = Math.max(0, Math.min(tr.a, c.dur - 0.3)), b = Math.min(c.dur, Math.max(a + 0.3, tr.b));
      Object.assign(sg, { ci: tr.ci, a, b, g0: c.offset + a, g1: c.offset + b, trocado: true });
    }
    if ((mm.ordem || []).length) {
      const pos = new Map(mm.ordem.map((k, i) => [k, i]));
      st.segs = st.segs.map((sg, i) => ({ sg, i })).sort((x, y) => (pos.has(x.sg.chave) ? pos.get(x.sg.chave) : 1e6 + x.i) - (pos.has(y.sg.chave) ? pos.get(y.sg.chave) : 1e6 + y.i)).map((x) => x.sg);
    }
    out = 0; st.segs.forEach((sg) => { sg.o0 = out; sg.o1 = out + (sg.g1 - sg.g0); out = sg.o1; });
    st.duracao = out;
    // zoom alternado nos cortes (só quando o corte é dentro do mesmo clipe, o "pulo" da imagem)
    st.segs.forEach((s, i) => { const ant = st.segs[i - 1]; s.zoom = ant && ant.ci === s.ci && st.opc.zoomCortes && st.opc.dinamismo !== "calmo" ? (ant.zoom > 1 ? 1 : st.opc.dinamismo === "dinamico" ? 1.12 : 1.08) : 1; });
    const p = st.plano || {};
    // legendas palavra por palavra
    const palavras = [];
    for (const c of st.clipes) for (const w of c.palavras || []) {
      const o = paraFinal(c.offset + w.s); if (o == null) continue;
      const fim = paraFinal(Math.min(c.offset + w.e, c.offset + c.dur - 0.01));
      palavras.push({ w: w.w, o0: o, o1: fim != null && fim > o ? fim : o + 0.25, g: c.offset + w.s, k: chaveLeg(c.offset + w.s), q: Boolean(w.q) });
    }
    // cada destaque vai para a palavra mais perto do tempo que a IA marcou (de preferência a mesma palavra)
    const limpa = (x) => String(x || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    for (const d of p.destaques || []) {
      const perto = palavras.filter((x) => Math.abs(x.g - d.t) < 1.2);
      const alvo = perto.find((x) => d.palavra && limpa(x.w) === limpa(d.palavra)) || perto.sort((a, b) => Math.abs(a.g - d.t) - Math.abs(b.g - d.t))[0];
      if (alvo) alvo.destaque = true;
    }
    if (!palavras.length && (p.textos || []).length) {
      // vídeo sem fala montado pelo roteiro: cada texto na tela vira uma legenda inteira
      const grupos = [];
      for (const x of p.textos) {
        const o0 = paraFinalPerto(x.de); if (o0 == null) continue;
        let o1 = paraFinal(Math.max(x.de + 0.3, x.ate - 0.01)); if (o1 == null || o1 <= o0) o1 = o0 + Math.max(1, x.ate - x.de);
        const ws = String(x.texto).split(/\s+/).filter(Boolean).map((w) => ({ w, o0, o1, g: x.de, k: chaveLeg(x.de) }));
        if (ws.length) grupos.push({ palavras: ws, o0, o1, texto: x.texto });
      }
      grupos.sort((a, b) => a.o0 - b.o0).forEach((g, i, l) => { if (l[i + 1] && g.o1 > l[i + 1].o0) g.o1 = l[i + 1].o0; });
      st.legendas = aplicarEdicoes(grupos);
    } else st.legendas = aplicarEdicoes(agrupar(palavras));
    // efeitos e zooms do plano no tempo final
    const tirados = new Set(st.manual.tirados || []);
    st.efeitos = (p.efeitos || []).map((e) => ({ id: uid(), t: paraFinalPerto(e.t), tipo: e.tipo, por_que: e.por_que || "", chave: `p:${e.tipo}@${Math.round(e.t * 10)}` })).filter((e) => e.t != null && !tirados.has(e.chave));
    for (const m of st.manual.sons || []) { const t = paraFinal(m.g); if (t != null) st.efeitos.push({ id: m.id, t, tipo: m.tipo, por_que: "você pôs", manual: true }); }
    st.efeitos = st.efeitos.filter((e) => !(e.t < 0.4 && e.tipo === "pop"));
    sonsDoTitulo();
    st.zooms = (p.zooms || []).map((z) => paraFinalPerto(z.t)).filter((t) => t != null);
    st.zoomsManuais = (st.manual.zooms || []).map(paraFinal).filter((t) => t != null);
    st.flashes = (st.manual.flashes || []).map(paraFinal).filter((t) => t != null);
    st.visuais = (st.manual.visuais || []).map((v) => ({ ...v, t: paraFinalPerto(v.g) })).filter((v) => v.t != null);
    sonsAutomaticos();
    // momentos fortes (hit, ding, riser) ganham tremidinha
    filtrarSonsPelaQuantidade();
    zoomsDoDinamismo();
    st.fortes = st.efeitos.filter((e) => ["hit", "ding"].includes(e.tipo)).map((e) => e.t);
  }
  // ---------- dinamismo: efeitos sonoros automáticos nos cortes e nas entradas de texto ----------
  // como nas referências dela: som em quase todo corte (woosh, clique, shutter alternados), pop
  // quando a legenda troca de frase, riser no começo e hit logo depois do gancho.
  function sonsAutomaticos() {
    st.efeitos = st.efeitos.filter((e) => !e.auto);
    const nivel = { nenhum: "desligado", impacto: "desligado", poucos: "pouco", medio: "medio", muitos: "muito" }[st.opc.sons] || st.opc.sfxAuto;
    if (!nivel || nivel === "desligado") return;
    const passo = nivel === "muito" ? 1 : nivel === "medio" ? 2 : 3;
    const livre = (t, raio = 0.3) => !st.efeitos.some((e) => Math.abs(e.t - t) < raio);
    const tiradosAuto = new Set((st.manual.tirados || []).filter((k) => k.startsWith("a:")));
    const add = (t, tipo, por_que) => { const chave = `a:${Math.round(t * 10)}`; if (t >= 0 && t < st.duracao && livre(t) && !tiradosAuto.has(chave)) st.efeitos.push({ id: uid(), t, tipo, por_que, auto: true, chave }); };
    const ciclo = ["woosh", "click", "suave", "shutter", "click"];
    let n = 0;
    st.segs.forEach((sg, i) => {
      if (!i) return;
      const trocaClipe = st.segs[i - 1].ci !== sg.ci;
      if (trocaClipe || i % passo === 0) add(Math.max(0, sg.o0 - 0.04), trocaClipe ? "woosh" : ciclo[n++ % ciclo.length], trocaClipe ? "troca de cena" : "corte");
    });
    // pop quando entra frase nova (a cada 2 ou 3 legendas, sem exagerar)
    const cada = nivel === "muito" ? 2 : nivel === "medio" ? 3 : 5;
    st.legendas.forEach((g, i) => { if (i && i % cada === 0) add(g.o0, "pop", "texto entrando"); });
    // abertura: riser antes do fim do gancho e hit na virada
    if (st.duracao > 4) { add(Math.min(2.2, st.duracao * 0.3), "hit", "fim do gancho"); }
    st.efeitos.sort((a, b) => a.t - b.t);
  }
  // quantidade de sons que ela pediu: "nenhum", "impacto" (só nas frases de impacto),
  // "poucos", "medio" ou "muitos" (1 a cada 1,5 a 2 s, o padrão dela). Os que ela pôs à mão ficam sempre.
  const SONS_IMPACTO = ["hit", "ding", "cristal", "riser", "brilho", "spray"];
  const SONS_SUAVES = ["suave", "brilho", "cristal", "ding"];
  function deixarSoSuaves() {
    if (!st.opc.sonsSuaves) return;
    const troca = { woosh: "suave", click: "suave", shutter: "suave", pop: "brilho", typing: "brilho" };
    st.efeitos = st.efeitos.filter((e) => e.manual || !["riser", "hit", "mensagem", "relogio", "spray"].includes(e.tipo))
      .map((e) => (e.manual || SONS_SUAVES.includes(e.tipo) ? e : { ...e, tipo: troca[e.tipo] || "suave" }));
  }
  function filtrarSonsPelaQuantidade() {
    try { filtrarSonsPelaQuantidade0(); } finally { deixarSoSuaves(); }
  }
  function filtrarSonsPelaQuantidade0() {
    const q = st.opc.sons || "medio";
    const espacar = (lista, gap) => { const out = []; let ultimo = -99; for (const e of [...lista].sort((a, b) => a.t - b.t)) { if (e.manual || e.doTitulo) { out.push(e); continue; } if (e.t - ultimo >= gap) { out.push(e); ultimo = e.t; } } return out; };
    if (q === "nenhum") { st.efeitos = st.efeitos.filter((e) => e.manual); return; }
    if (q === "impacto") {
      const fortes = [...(st.plano && st.plano.destaques || []).map((d) => paraFinalPerto(d.t)).filter((t) => t != null)];
      st.efeitos = espacar(st.efeitos.filter((e) => e.manual || e.doTitulo || (!e.auto && (SONS_IMPACTO.includes(e.tipo) || fortes.some((f) => Math.abs(f - e.t) < 0.8)))), 2.5);
      return;
    }
    if (q === "poucos") { st.efeitos = espacar(st.efeitos.filter((e) => e.manual || e.doTitulo || !e.auto || /troca de cena/.test(e.por_que || "")), 3.2); return; }
    if (q === "muitos") {
      // completa até ficar 1 som a cada ~1,8 s, alternando woosh, clique e pop nos cortes e nas legendas
      const pontos = [...st.segs.map((sg) => sg.o0), ...st.legendas.map((g) => g.o0)].filter((t) => t > 0.3).sort((a, b) => a - b);
      const ciclo = ["woosh", "click", "pop", "suave", "shutter"]; let n = 0;
      for (const t of pontos) { if (!st.efeitos.some((e) => Math.abs(e.t - t) < 0.9)) st.efeitos.push({ id: uid(), t, tipo: ciclo[n++ % ciclo.length], por_que: "ritmo", auto: true, chave: `a:${Math.round(t * 10)}` }); }
      const tirados = new Set(st.manual.tirados || []); st.efeitos = st.efeitos.filter((e) => !e.chave || !tirados.has(e.chave));
      st.efeitos.sort((a, b) => a.t - b.t);
    }
  }
  // dinamismo: "dinamico" = zoom entrando e saindo a cada ~2,5 s nas falas longas, punch nos cortes,
  // deslize e flash na troca de cena (as referências dela); "calmo" = sem zoom nem transição
  function zoomsDoDinamismo() {
    st.zoomsAuto = [];
    if (st.opc.dinamismo !== "dinamico") return;
    let i = 0;
    for (const sg of st.segs) {
      for (let t = sg.o0 + 1.1; t < sg.o1 - 0.9; t += 2.5) st.zoomsAuto.push({ t, tipo: i++ % 2 ? "out" : "in" });
    }
  }

  // transição visual nos cortes: zoom rápido (punch) e, na troca de cena, um deslize curto
  function transicaoEm(t) {
    const tipo = st.opc.dinamismo === "calmo" ? "nenhuma" : st.opc.dinamismo === "dinamico" && st.opc.transicao !== "nenhuma" ? "deslize" : st.opc.transicao;
    if (!tipo || tipo === "nenhuma" || !st.segs.length) return { z: 0, x: 0 };
    const s = segNoFinal(t), i = st.segs.indexOf(s);
    if (i <= 0) return { z: 0, x: 0 };
    const d = t - s.o0, troca = st.segs[i - 1].ci !== s.ci;
    let z = 0, x = 0;
    if (d >= 0 && d < 0.2) z = 0.09 * (1 - suave(d / 0.2));
    if (tipo === "deslize" && troca && d >= 0 && d < 0.16) x = 0.22 * (1 - suave(d / 0.16));
    return { z, x };
  }
  // ---------- legendas: chave por palavra e edições dela ----------
  function chaveLeg(g) { return Math.round(g * 100); }
  function aplicarEdicoes(grupos) {
    const ed = st.editLeg, saida = [];
    for (let i = 0; i < grupos.length; i++) {
      let g = grupos[i];
      const e = ed[g.palavras[0].k] || {};
      if (e.juntar && grupos[i + 1]) { const prox = grupos[++i]; g = { ...g, palavras: [...g.palavras, ...prox.palavras], o1: prox.o1 }; const e2 = ed[prox.palavras[0].k] || {}; if (e2.texto && !e.texto) g.texto = g.palavras.map((w) => w.w).join(" "); }
      if (e.oculta) continue;
      if (e.texto != null) g.texto = e.texto;
      if (e.chamativa != null) g.chamativa = e.chamativa; else g.chamativa = g.palavras.some((w) => w.destaque);
      g.k = g.palavras[0].k;
      saida.push(g);
    }
    // som de pop quando entra uma palavra chamativa
    return saida;
  }
  const textoLeg = (g) => g.texto != null ? g.texto : g.palavras.map((w) => w.w).join(" ");
  // título em partes (até 3): cada parte entra num tempo, com um clique de mouse (estilo das referências)
  function partesTitulo() {
    const palavras = String(st.titulo || "").trim().split(/\s+/).filter(Boolean);
    if (!palavras.length) return [];
    const n = palavras.length <= 2 ? palavras.length : Math.min(3, Math.ceil(palavras.length / 2));
    const tam = Math.ceil(palavras.length / n), partes = [];
    for (let i = 0; i < palavras.length; i += tam) partes.push(palavras.slice(i, i + tam).join(" "));
    const limpa = (x) => x.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    let alvo = partes.findIndex((p) => st.tituloDestaque && p.split(/\s+/).some((w) => limpa(w) === limpa(st.tituloDestaque)));
    if (alvo < 0) alvo = partes.reduce((m, p, i) => (p.replace(/\s/g, "").length > partes[m].replace(/\s/g, "").length ? i : m), 0);
    return partes.map((texto, i) => ({ texto, destaque: i === alvo, t: 0.12 + i * 0.38 }));
  }
  function sonsDoTitulo() {
    st.efeitos = st.efeitos.filter((e) => !e.doTitulo);
    if (st.titulo && st.opc.titulo && st.opc.sonsTitulo !== false) {
      if (st.opc.estiloTitulo === "etapas") partesTitulo().forEach((p, i) => st.efeitos.push({ id: uid(), t: p.t, tipo: "click", por_que: `título, parte ${i + 1}`, doTitulo: true }));
      else st.efeitos.push({ id: uid(), t: 0.05, tipo: "pop", por_que: "entrada do título", doTitulo: true });
    }
    st.efeitos = st.efeitos.filter((e) => !e.daChamativa);
    if (st.opc.chamativas && st.opc.sonsChamativas) for (const g of st.legendas || []) if (g.chamativa && !(st.opc.titulo && st.titulo && g.o0 < DUR_TITULO)) st.efeitos.push({ id: uid(), t: Math.max(0, g.o0 - 0.02), tipo: "pop", por_que: "palavra chamativa", daChamativa: true });
    st.efeitos.sort((a, b) => a.t - b.t);
  }
  function agrupar(palavras) {
    if (st.opc.estilo === "capcut") return agruparN(palavras, palavras.some((w) => w.q) ? 8 : Math.max(1, Math.min(5, Number(st.opc.porLegenda) || 3)));
    const grupos = [];
    for (const w of palavras) {
      const g = grupos[grupos.length - 1];
      const curta = w.w.replace(/[^\p{L}\p{N}]/gu, "").length <= 3;
      // estilo das referências: 1 palavra por vez, junta só palavrinhas curtas ("é a", "de um")
      if (g && g.palavras.length < 2 && (curta || g.curta) && w.o0 - g.o1 < 0.2 && !g.fimFrase) { g.palavras.push(w); g.o1 = w.o1; g.curta = curta; g.fimFrase = /[.!?,]$/.test(w.w); }
      else grupos.push({ palavras: [w], o0: w.o0, o1: w.o1, curta, fimFrase: /[.!?,]$/.test(w.w) });
    }
    grupos.forEach((g, i) => { const prox = grupos[i + 1]; g.o1 = prox ? Math.min(prox.o0, Math.max(g.o1, g.o0 + 0.18)) : g.o1 + 0.3; });
    return grupos;
  }
  // CapCut: até N palavras por legenda, quebra em pontuação e em pausas; palavra de destaque fica sozinha
  function agruparN(palavras, n) {
    const grupos = [];
    for (const w of palavras) {
      const g = grupos[grupos.length - 1];
      if (g && g.palavras.length < n && !w.q && w.o0 - g.o1 < 0.35 && !g.fimFrase && !g.palavras.some((x) => x.destaque) && !w.destaque) { g.palavras.push(w); g.o1 = w.o1; g.fimFrase = /[.!?,;:]$/.test(w.w); }
      else grupos.push({ palavras: [w], o0: w.o0, o1: w.o1, fimFrase: /[.!?,;:]$/.test(w.w) });
    }
    grupos.forEach((g, i) => { const prox = grupos[i + 1]; g.o1 = prox ? Math.min(prox.o0, Math.max(g.o1 + 0.12, g.o0 + 0.25)) : g.o1 + 0.3; });
    return grupos;
  }
  function paraFinal(g) { const s = st.segs.find((x) => g >= x.g0 && g < x.g1); return s ? s.o0 + (g - s.g0) : null; }
  function paraFinalPerto(g) { const o = paraFinal(g); if (o != null) return o; const s = st.segs.find((x) => x.g0 >= g); return s ? s.o0 : null; }
  function segNoFinal(t) { return st.segs.find((s) => t >= s.o0 && t < s.o1) || st.segs[st.segs.length - 1]; }

  // ---------- desenho do quadro ----------
  let canvas = null, c2d = null;
  // formato (out/2026): vertical 9:16 (padrão) ou horizontal 16:9 (clipes gravados deitados)
  const horizontal = () => st.opc.formato === "horizontal";
  function tamanho() { const v = st.opc.qualidade === 720 ? [720, 1280] : [1080, 1920]; return horizontal() ? [v[1], v[0]] : v; }
  function prepararCanvas() {
    canvas = $("#ed-canvas"); if (!canvas) return;
    const [w, h] = tamanho();
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const tela = canvas.closest(".ed-tela"); if (tela) tela.classList.toggle("horiz", horizontal());
    c2d = canvas.getContext("2d");
  }
  function zoomEm(t) {
    let z = 1;
    for (const a of st.zoomsAuto || []) {
      const d = t - a.t;
      if (a.tipo === "in") { if (d < 0 || d > 2.4) continue; const k = d < 0.35 ? d / 0.35 : d < 2 ? 1 : 1 - (d - 2) / 0.4; z = Math.max(z, 1 + 0.1 * suave(Math.max(0, Math.min(1, k)))); }
      else { if (d < 0 || d > 0.8) continue; z = Math.max(z, 1 + 0.14 * (1 - suave(d / 0.8))); } // começa perto e abre
    }
    for (const zt of [...(st.opc.zoomEnfase ? st.zooms : []), ...(st.zoomsManuais || [])]) {
      const d = t - zt;
      if (d < -0.15 || d > 1.4) continue;
      const k = d < 0 ? (d + 0.15) / 0.15 : d < 1.1 ? 1 : 1 - (d - 1.1) / 0.3;
      z = Math.max(z, 1 + 0.12 * suave(Math.max(0, Math.min(1, k))));
    }
    return z;
  }
  const suave = (k) => k * k * (3 - 2 * k);
  // ----- efeitos visuais do carrossel que ela mandou (out/2026): zoom-through, pull-back reveal, celular, checklist e gráfico -----
  const VISUAIS = [["mergulho", "Zoom-through (mergulha e sai na próxima cena)"], ["revelar", "Pull-back reveal (afasta e revela a cena)"], ["celular", "Phone mockup (vídeo dentro de um celular)"], ["checklist", "Checklist (itens marcados enquanto fala)"], ["grafico", "Gráfico que cresce"]];
  const LETRA_VIS = { mergulho: "M", revelar: "R", celular: "▯", checklist: "✓", grafico: "▮" };
  function zoomVisual(t) {
    let z = 1;
    for (const x of st.visuais || []) {
      const d = t - x.t;
      if (x.tipo === "revelar" && d >= 0 && d < 1.4) z *= 1 + 0.6 * (1 - suave(d / 1.4));
      if (x.tipo === "mergulho" && Math.abs(d) < 0.38) { const k = 1 - Math.abs(d) / 0.38; z *= 1 + 1.1 * k * k; }
    }
    return z;
  }
  function desenharCelular(v, vw, vh, t, cel, W, H) {
    const d = t - cel.t, dur = cel.dur || 3, k = suave(Math.min(1, d / 0.35, (dur - d) / 0.3));
    const fundo = Math.max(W / vw, H / vh) * 1.15;
    c2d.save(); c2d.filter = "blur(26px)"; c2d.drawImage(v, (W - vw * fundo) / 2, (H - vh * fundo) / 2, vw * fundo, vh * fundo); c2d.restore();
    c2d.fillStyle = "rgba(29,22,17,.35)"; c2d.fillRect(0, 0, W, H);
    const ph = (W > H ? H * 0.86 : H * 0.74) * (0.85 + 0.15 * k), pw = ph * 9 / 19.5, px = (W - pw) / 2, py = (H - ph) / 2, rr = pw * 0.12, b = pw * 0.035;
    c2d.save(); c2d.globalAlpha = Math.max(0.15, k);
    c2d.shadowColor = "rgba(0,0,0,.45)"; c2d.shadowBlur = 40; c2d.fillStyle = "#111"; arredondado(px, py, pw, ph, rr); c2d.fill(); c2d.shadowBlur = 0;
    c2d.save(); arredondado(px + b, py + b, pw - 2 * b, ph - 2 * b, rr - b); c2d.clip();
    const e2 = Math.max((pw - 2 * b) / vw, (ph - 2 * b) / vh); c2d.drawImage(v, px + pw / 2 - vw * e2 / 2, py + ph / 2 - vh * e2 / 2, vw * e2, vh * e2); c2d.restore();
    c2d.fillStyle = "#111"; arredondado(px + pw * 0.36, py + b * 1.6, pw * 0.28, b * 2.2, b * 1.1); c2d.fill();
    c2d.restore();
  }
  function desenharVisuais(t, u, W, H) {
    for (const x of st.visuais || []) {
      const d = t - x.t, itens = (x.itens || []).filter(Boolean);
      if (x.tipo === "checklist" && itens.length) {
        const passo = 1.1, dur = x.dur || itens.length * passo + 2.2; if (d < 0 || d > dur) continue;
        const saida = suave(Math.min(1, (dur - d) / 0.3)), tam = 46 * u, lh = tam * 1.75, larg = Math.min(W * 0.84, 860 * u), alt = lh * itens.length + 60 * u;
        const x0 = (W - larg) / 2, y0 = H * 0.5 - alt / 2;
        c2d.save(); c2d.globalAlpha = saida; c2d.fillStyle = "rgba(255,253,249,.94)"; c2d.shadowColor = "rgba(0,0,0,.25)"; c2d.shadowBlur = 30 * u; arredondado(x0, y0, larg, alt, 28 * u); c2d.fill(); c2d.shadowBlur = 0;
        c2d.font = `600 ${tam}px Poppins, sans-serif`; c2d.textBaseline = "middle"; c2d.textAlign = "left";
        itens.forEach((it, i) => {
          const di = d - i * passo; if (di < 0) return;
          const a = suave(Math.min(1, di / 0.25)), yy = y0 + 30 * u + lh * i + lh / 2, cx = x0 + 52 * u, rr = tam * 0.48;
          c2d.globalAlpha = saida * a;
          const marcado = di > 0.6;
          c2d.lineWidth = 4 * u; c2d.strokeStyle = "#3d2b20"; c2d.fillStyle = marcado ? "#4f7a54" : "transparent";
          c2d.beginPath(); c2d.arc(cx, yy, rr, 0, Math.PI * 2); if (marcado) { c2d.fill(); c2d.strokeStyle = "#4f7a54"; } c2d.stroke();
          if (marcado) { const kk = Math.min(1, (di - 0.6) / 0.2); c2d.strokeStyle = "#fff"; c2d.lineWidth = 5 * u; c2d.lineCap = "round"; c2d.beginPath(); c2d.moveTo(cx - rr * 0.45, yy); c2d.lineTo(cx - rr * 0.45 + rr * 0.3 * Math.min(1, kk * 2), yy + rr * 0.35 * Math.min(1, kk * 2)); if (kk > 0.5) c2d.lineTo(cx - rr * 0.15 + rr * 0.6 * (kk - 0.5) * 2, yy + rr * 0.35 - rr * 0.75 * (kk - 0.5) * 2); c2d.stroke(); }
          c2d.fillStyle = "#3d2b20"; c2d.fillText(it, cx + rr + 22 * u, yy + 2 * u, larg - (cx - x0) - rr - 50 * u);
        });
        c2d.restore();
      }
      if (x.tipo === "grafico" && itens.length) {
        const dur = x.dur || 4.5; if (d < 0 || d > dur) continue;
        const dados = itens.map((it) => { const m = String(it).match(/^(.*?)[:=\-]\s*([\d.,]+)\s*(%?)\s*$/); return m ? { rot: m[1].trim(), val: Number(m[2].replace(/\./g, "").replace(",", ".")) || 0, pct: m[3] } : { rot: String(it), val: 0, pct: "" }; });
        const max = Math.max(1, ...dados.map((q) => q.val)), saida = suave(Math.min(1, (dur - d) / 0.3)), cresce = suave(Math.min(1, d / 1.2));
        const larg = Math.min(W * 0.84, 880 * u), alt = Math.min(H * 0.42, 620 * u), x0 = (W - larg) / 2, y0 = H * 0.5 - alt / 2;
        c2d.save(); c2d.globalAlpha = saida; c2d.fillStyle = "rgba(255,253,249,.94)"; c2d.shadowColor = "rgba(0,0,0,.25)"; c2d.shadowBlur = 30 * u; arredondado(x0, y0, larg, alt, 28 * u); c2d.fill(); c2d.shadowBlur = 0;
        const cores = ["#a87058", "#6b4a35", "#c9973b", "#4f7a54", "#b8746a", "#8a6650"], n = dados.length, gap = 26 * u, bw = (larg - 80 * u - gap * (n - 1)) / n, base = y0 + alt - 70 * u, topo = y0 + 70 * u;
        dados.forEach((q, i) => {
          const h = (base - topo) * (q.val / max) * cresce, bx = x0 + 40 * u + i * (bw + gap);
          c2d.fillStyle = cores[i % cores.length]; arredondado(bx, base - h, bw, Math.max(2, h), 12 * u); c2d.fill();
          c2d.fillStyle = "#3d2b20"; c2d.textAlign = "center"; c2d.textBaseline = "alphabetic";
          c2d.font = `700 ${34 * u}px Poppins, sans-serif`; c2d.fillText(`${Math.round(q.val * cresce).toLocaleString("pt-BR")}${q.pct}`, bx + bw / 2, base - h - 14 * u);
          c2d.font = `500 ${26 * u}px Poppins, sans-serif`; c2d.fillText(q.rot.slice(0, 18), bx + bw / 2, base + 40 * u, bw + gap);
        });
        c2d.restore();
      }
    }
  }
  // ----- música de fundo com ducking (abaixa quando ela fala) -----
  function trechosDeFala() {
    const l = [];
    for (const c of st.clipes) for (const w of c.palavras || []) { const a = paraFinal(c.offset + w.s), b = paraFinal(Math.min(c.offset + w.e, c.offset + c.dur - 0.01)); if (a != null) l.push([a, b != null && b > a ? b : a + 0.3]); }
    l.sort((x, y) => x[0] - y[0]); const out = [];
    for (const [a, b] of l) { const ult = out[out.length - 1]; if (ult && a - ult[1] < 0.45) ult[1] = Math.max(ult[1], b); else out.push([a, b]); }
    return out;
  }
  function tocarMusica(ctx, destino, desde, dur, quando) {
    if (!st.musica || !st.musica.buf) return null;
    const vol = Number(st.opc.musicaVol ?? 0.35), baixo = vol * 0.22, src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = st.musica.buf; src.loop = true; src.connect(g); g.connect(destino);
    const t0 = quando ?? ctx.currentTime;
    g.gain.setValueAtTime(vol, t0);
    if (st.opc.ducking !== false) for (const [a, b] of trechosDeFala()) {
      if (b < desde) continue; const ia = t0 + Math.max(0, a - desde), ib = t0 + Math.max(0, b - desde);
      g.gain.setTargetAtTime(baixo, Math.max(t0, ia - 0.12), 0.06); g.gain.setTargetAtTime(vol, ib + 0.1, 0.15);
    }
    if (dur) { g.gain.setTargetAtTime(0.0001, t0 + Math.max(0, dur - desde - 1.2), 0.35); }
    src.start(t0, desde % st.musica.buf.duration);
    return src;
  }
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  function desenhar(t) {
    if (!c2d || (canvas && canvas.width !== tamanho()[0])) prepararCanvas();
    if (!c2d) return;
    const W = canvas.width, H = canvas.height;
    c2d.fillStyle = "#1d1611"; c2d.fillRect(0, 0, W, H);
    const s = st.segs.length ? segNoFinal(t) : null;
    const clipe = s ? st.clipes[s.ci] : st.clipes[0];
    if (clipe && clipe.el.readyState >= 2) {
      const v = clipe.el, vw = v.videoWidth || 9, vh = v.videoHeight || 16;
      const tr = tremida(t), tc = transicaoEm(t);
      const z = (s ? s.zoom : 1) * zoomEm(t) * (1 + tr.z) * (1 + tc.z) * zoomVisual(t);
      const esc0 = Math.max(W / vw, H / vh) * z;
      const dw = vw * esc0, dh = vh * esc0, x0 = (W - dw) / 2 + (tr.x + tc.x) * W, y0 = (H - dh) * 0.42 + tr.y * H;
      const cel = (st.visuais || []).find((x) => x.tipo === "celular" && t >= x.t && t < x.t + (x.dur || 3));
      if (cel) desenharCelular(v, vw, vh, t, cel, W, H); else c2d.drawImage(v, x0, y0, dw, dh);
      // rastro do deslize (dá a sensação de movimento rápido)
      if (tc.x > 0.01) { c2d.save(); c2d.globalAlpha = 0.35; c2d.drawImage(v, x0 - tc.x * W * 0.6, y0, dw, dh); c2d.restore(); }
    }
    const u = Math.min(W, H) / 1080; // no horizontal o texto fica do mesmo tamanho que no vertical
    // flash rápido nas trocas de clipe
    if ((st.opc.flash || st.opc.dinamismo === "dinamico") && s) { const i = st.segs.indexOf(s), ant = st.segs[i - 1]; const d = t - s.o0; if (ant && ant.ci !== s.ci && d < 0.12) { c2d.fillStyle = `rgba(255,255,255,${0.85 * (1 - d / 0.12)})`; c2d.fillRect(0, 0, W, H); } }
    // flash que ela pôs à mão na linha do tempo
    for (const f of st.flashes || []) { const d = t - f; if (d >= 0 && d < 0.14) { c2d.fillStyle = `rgba(255,255,255,${0.85 * (1 - d / 0.14)})`; c2d.fillRect(0, 0, W, H); } }
    desenharVisuais(t, u, W, H);
    // legenda (ou palavra chamativa)
    const g = st.legendas.find((x) => t >= x.o0 && t < x.o1);
    if (g && st.opc.legenda !== false && !(st.opc.titulo && st.titulo && t < DUR_TITULO - 0.2)) { if (g.chamativa && st.opc.chamativas) desenharChamativa(g, t, u, W, H); else desenharLegenda(g, u, W, H); }
    // confete removido: ela não quer mais (out/2026)
    // título do gancho
    if (st.opc.titulo && st.titulo && t < DUR_TITULO) desenharTitulo(t, u, W, H);
    desenharCamadas(t, u, W, H);
    if (st.guiasIG && !st.exportando && !horizontal()) guiasInstagram(u, W, H);
  }
  // ---------- textos na tela (camadas editáveis: mudar frase, tempo, tamanho e arrastar) ----------
  // linha: { texto, tipo: "cap" (Poppins caixa-alta espaçada, branca) | "ser" (DM Serif itálica, creme) | "emo", tam (em 1080) }
  const FONTE_CAMADA = { cap: (px) => `600 ${px}px Poppins, sans-serif`, ser: (px) => `italic 400 ${px}px "DM Serif Display", Georgia, serif`, emo: (px) => `${px}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif` };
  const ALTURA_LINHA = { cap: 1.55, ser: 1.08, emo: 1.35 };
  // visual de cada texto (ela ajusta na aba Textos): cores, contorno, opacidade e sombra atrás
  const VISUAL_PADRAO = { cor: "#fff3b0", corPequena: "#ffffff", contorno: 0, contornoCor: "#1d1611", opacidade: 1, sombra: 0.72, sombraCor: "#160c08", alinh: "centro" };
  function visualCamada(cam) {
    const v = { ...VISUAL_PADRAO };
    for (const k of Object.keys(VISUAL_PADRAO)) if (cam[k] !== undefined && cam[k] !== null && cam[k] !== "") v[k] = cam[k];
    v.contorno = clamp(+v.contorno || 0, 0, 14); v.opacidade = clamp(+v.opacidade, 0.1, 1); v.sombra = clamp(+v.sombra, 0, 1);
    return v;
  }
  function rgbaDe(hex, a) { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "")); const n = m ? parseInt(m[1], 16) : 0x160c08; return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
  function medirLinha(l, px) {
    c2d.font = FONTE_CAMADA[l.tipo] ? FONTE_CAMADA[l.tipo](px) : FONTE_CAMADA.ser(px);
    if (l.tipo === "cap") { const t = String(l.texto || "").toUpperCase(), esp = px * 0.16; return [...t].reduce((a, ch) => a + c2d.measureText(ch).width + esp, 0) - esp; }
    return c2d.measureText(String(l.texto || "")).width;
  }
  function desenharCamadas(t, u, W, H) {
    for (const cam of st.camadas) {
      cam._box = null;
      const sel = st.camSel === cam.id && !st.exportando;
      if (!(t >= cam.t0 && t < cam.t1) && !sel) continue;
      const dentro = t >= cam.t0 && t < cam.t1;
      const k = clamp((t - cam.t0) / 0.25), ko = clamp((cam.t1 - t) / 0.18);
      const alfa = dentro ? (st.exportando || !sel ? suave(k) * ko : 1) : 0.35, dy = dentro && !sel ? 22 * u * (1 - suave(k)) : 0;
      const linhas = (cam.linhas || []).filter((l) => String(l.texto || "").trim());
      if (!linhas.length) continue;
      const med = linhas.map((l) => { const px = (l.tam || 60) * u * (cam.escala || 1); return { l, px, w: medirLinha(l, px), h: px * (ALTURA_LINHA[l.tipo] || 1.1) }; });
      const bw = Math.max(...med.map((m) => m.w)), bh = med.reduce((a, m) => a + m.h, 0);
      const cx = cam.x * W, cy = cam.y * H + dy;
      let y = cy - bh / 2;
      const vis = visualCamada(cam);
      c2d.save(); c2d.globalAlpha = alfa * vis.opacidade; c2d.textBaseline = "middle"; c2d.lineJoin = "round"; c2d.miterLimit = 2;
      const semSombra = () => { c2d.shadowColor = "transparent"; c2d.shadowBlur = 0; c2d.shadowOffsetY = 0; };
      const comSombra = () => { if (vis.sombra > 0) { c2d.shadowColor = rgbaDe(vis.sombraCor, vis.sombra); c2d.shadowBlur = (8 + 22 * vis.sombra) * u; c2d.shadowOffsetY = 4 * u; } else semSombra(); };
      for (const m of med) {
        const meio = y + m.h / 2, l = m.l;
        c2d.font = (FONTE_CAMADA[l.tipo] || FONTE_CAMADA.ser)(m.px);
        c2d.fillStyle = l.tipo === "cap" ? vis.corPequena : vis.cor;
        const lw = l.tipo === "emo" ? 0 : vis.contorno * u * (cam.escala || 1);
        if (lw > 0) { c2d.strokeStyle = vis.contornoCor; c2d.lineWidth = lw * 2; }
        // contorno primeiro (com a sombra), depois o preenchimento por cima (sem sombra dobrada)
        const pintar = (txt, x, alinh) => {
          c2d.textAlign = alinh;
          if (l.tipo === "emo") { semSombra(); c2d.fillText(txt, x, meio); return; }
          if (lw > 0) { comSombra(); c2d.strokeText(txt, x, meio); semSombra(); c2d.fillText(txt, x, meio); }
          else { comSombra(); c2d.fillText(txt, x, meio); }
        };
        // alinhamento do bloco: centro (padrão), esquerda ou direita
        const xIni = vis.alinh === "esq" ? cx - bw / 2 : vis.alinh === "dir" ? cx + bw / 2 - m.w : cx - m.w / 2;
        if (l.tipo === "cap") {
          const txt = String(l.texto).toUpperCase(), esp = m.px * 0.16; let x = xIni;
          for (const ch of txt) { pintar(ch, x, "left"); x += c2d.measureText(ch).width + esp; }
        } else if (vis.alinh === "esq" || vis.alinh === "dir") pintar(String(l.texto), xIni, "left");
        else pintar(String(l.texto), cx, "center");
        y += m.h;
      }
      c2d.restore();
      const pad = 14 * u;
      cam._box = [cx - bw / 2 - pad, cy - bh / 2 - pad, cx + bw / 2 + pad, cy + bh / 2 + pad];
      if (sel) guiasCentro(cam, u, W, H);
      if (sel) { c2d.save(); c2d.strokeStyle = "rgba(255,255,255,.9)"; c2d.lineWidth = 3 * u; c2d.setLineDash([12 * u, 8 * u]); c2d.strokeRect(cam._box[0], cam._box[1], cam._box[2] - cam._box[0], cam._box[3] - cam._box[1]); c2d.restore(); }
    }
  }
  // régua de centralizar (como no CapCut): linhas do meio da tela; acendem quando o texto encosta no centro
  function guiasCentro(cam, u, W, H) {
    if (st.exportando) return;
    const noX = Math.abs(cam.x - 0.5) < 0.002, noY = Math.abs(cam.y - 0.5) < 0.002, arr = Boolean(st.arrastandoCam);
    if (!arr && !noX && !noY) return;
    c2d.save();
    const linha = (x1, y1, x2, y2, on) => { c2d.lineWidth = (on ? 6 : 4) * u; c2d.strokeStyle = on ? "#f2c14e" : "rgba(255,255,255,.7)"; c2d.setLineDash(on ? [] : [10 * u, 8 * u]); c2d.beginPath(); c2d.moveTo(x1, y1); c2d.lineTo(x2, y2); c2d.stroke(); };
    if (arr || noX) linha(W / 2, 0, W / 2, H, noX);
    if (arr || noY) linha(0, H / 2, W, H / 2, noY);
    if (arr) { c2d.strokeStyle = "rgba(255,255,255,.22)"; c2d.setLineDash([6 * u, 8 * u]); c2d.strokeRect(W * 0.08, H * 0.08, W * 0.84, H * 0.84); }
    c2d.restore();
  }
  const IMA = 0.018; // distância (fração da tela) em que o texto gruda no centro
  // arrastar o texto direto na prévia (mouse ou dedo)
  function ligarArrasteCamadas() {
    if (!canvas || canvas.dataset.camadas) return; canvas.dataset.camadas = "1";
    let pega = null;
    const ponto = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * canvas.width, (e.clientY - r.top) / r.height * canvas.height]; };
    canvas.addEventListener("pointerdown", (e) => {
      if (!st.camadas.length || st.exportando) return;
      const [x, y] = ponto(e);
      const cam = [...st.camadas].reverse().find((c) => c._box && x >= c._box[0] && x <= c._box[2] && y >= c._box[1] && y <= c._box[3]);
      if (!cam) return;
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      if (st.camSel !== cam.id) { st.camSel = cam.id; pintarCamadas(); }
      pega = { cam, x0: x, y0: y, cx: cam.x, cy: cam.y }; st.arrastandoCam = true;
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!pega) return; e.preventDefault();
      const [x, y] = ponto(e);
      if (!pega.guardou) { pega.guardou = true; guardarCam(); }
      let nx = clamp(pega.cx + (x - pega.x0) / canvas.width), ny = clamp(pega.cy + (y - pega.y0) / canvas.height);
      if (Math.abs(nx - 0.5) < IMA) nx = 0.5; if (Math.abs(ny - 0.5) < IMA) ny = 0.5;
      pega.cam.x = nx; pega.cam.y = ny;
      if (!st.tocando) desenhar(st.t);
    });
    const soltar = () => { if (!pega) return; pega = null; st.arrastandoCam = false; if (!st.tocando) desenhar(st.t); pintarCamadas(); salvarDepois(); };
    canvas.addEventListener("pointerup", soltar); canvas.addEventListener("pointercancel", soltar);
  }
  // ---------- desfazer (botão e Ctrl+Z / Cmd+Z): a última mudança, seja texto, linha do tempo, estilo ou ajuste ----------
  function marcarDesfazer(tipo) { st.desf.push(tipo); if (st.desf.length > 120) st.desf.shift(); setTimeout(pintarBotaoDesfazer, 0); }
  let ultimaFotoCam = { chave: "", em: 0 };
  function guardarCam(chave) {
    // digitar ou arrastar um controle vira um passo só (mesma chave em menos de 1,5 s)
    const agora = Date.now();
    if (chave && chave === ultimaFotoCam.chave && agora - ultimaFotoCam.em < 1500) { ultimaFotoCam.em = agora; return; }
    ultimaFotoCam = { chave: chave || "", em: agora };
    st.histCam.push({ camadas: JSON.parse(JSON.stringify(st.camadas.map(({ _box, ...c }) => c))), camSel: st.camSel });
    if (st.histCam.length > 60) st.histCam.shift();
    marcarDesfazer("cam");
  }
  function desfazerCam() {
    const f = st.histCam.pop(); if (!f) return false;
    st.camadas = f.camadas; st.camSel = st.camadas.some((c) => c.id === f.camSel) ? f.camSel : null; ultimaFotoCam = { chave: "", em: 0 };
    pintarCamadas(); if (!st.tocando) desenhar(st.t); salvarDepois(); return true;
  }
  function podeDesfazerManual() { const m = st.manual || {}; return Boolean((m.ordHist || []).length || (m.divisoes || []).length || (m.cortes || []).length || (m.sons || []).length || (m.zooms || []).length || (m.flashes || []).length || (m.tirados || []).length); }
  const DESFAZ = {
    cam: { pode: () => st.histCam.length > 0, faz: () => desfazerCam(), msg: "Desfeito: o texto voltou como estava." },
    manual: { pode: podeDesfazerManual, faz: () => desfazerManual(), msg: "Desfeito na linha do tempo." },
    est: { pode: () => st.estHist.length > 0, faz: () => desfazerEstilo(), msg: "Desfeito: o estilo voltou como estava." },
    ajuste: { pode: () => Boolean(st.desfazerAjuste), faz: () => desfazerAjuste(), msg: "" },
  };
  function podeDesfazer() { return st.desf.some((k) => DESFAZ[k] && DESFAZ[k].pode()) || st.histCam.length > 0; }
  function desfazerTudo() {
    if (st.exportando) return;
    while (st.desf.length) {
      const k = st.desf.pop(), d = DESFAZ[k];
      if (d && d.pode()) { d.faz(); if (d.msg) toast(d.msg); pintarBotaoDesfazer(); return; }
    }
    if (desfazerCam()) { toast(DESFAZ.cam.msg); pintarBotaoDesfazer(); return; }
    toast("Não tem nada para desfazer.", true); pintarBotaoDesfazer();
  }
  function pintarBotaoDesfazer() { const pode = podeDesfazer() && !st.exportando; $$("[data-desfazer-tudo]").forEach((b) => { b.disabled = !pode; }); }
  function ligarAtalhoDesfazer() {
    if (window.__edDesfazer) return; window.__edDesfazer = true;
    document.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || String(e.key).toLowerCase() !== "z") return;
      const aba = document.getElementById("aba-edicao"); if (!aba || aba.hidden) return;
      if (document.querySelector("dialog[open]")) return;
      const el = document.activeElement, tag = el && el.tagName;
      // dentro de um campo de texto, o Ctrl+Z continua desfazendo a digitação (o do próprio navegador)
      if (el && (el.isContentEditable || tag === "TEXTAREA" || tag === "SELECT" || (tag === "INPUT" && !/^(range|color|checkbox|radio|button)$/i.test(el.type)))) return;
      e.preventDefault(); desfazerTudo();
    });
  }
  function camadaAtual() { return st.camadas.find((c) => c.id === st.camSel); }
  function pintarCamadas() {
    const box = $("#ed-camadas"); if (!box) return;
    const fmt = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
    const ordenadas = st.camadas.slice().sort((a, b) => a.t0 - b.t0);
    box.innerHTML = `<div class="ed-cam-topo"><h3 class="ed-cam-tit">Textos na tela</h3><button class="btn btn-leve" type="button" data-desfazer-tudo title="Desfazer (Ctrl+Z)" ${podeDesfazer() ? "" : "disabled"}>${ic.desfazer}Desfazer</button></div>
      <p class="ed-obs">Toque num texto para mudar a frase, o tempo e o tamanho. Para mudar o lugar, arraste o texto direto no vídeo: aparecem as linhas do meio da tela e, perto do centro, o texto gruda nele (a linha fica amarela). Tudo salva sozinho no projeto.</p>
      <div class="ed-cam-acoes"><button class="btn" type="button" id="ed-cam-novo">${ic.mais}Novo texto aqui (${fmt(st.t)} s)</button></div>
      ${ordenadas.length ? "" : `<p class="rr-vazio">Nenhum texto ainda.</p>`}
      ${ordenadas.map((c) => {
        const ab = st.camSel === c.id;
        const resumo = (c.linhas || []).map((l) => l.texto).filter(Boolean).join(" / ");
        return `<div class="ed-cam ${ab ? "aberta" : ""}" data-cam="${c.id}">
          <button type="button" class="ed-cam-cab" data-cam-abrir="${c.id}"><span class="ed-cam-tempo">${fmt(c.t0)} a ${fmt(c.t1)} s</span><b>${esc(resumo || "(sem texto)")}</b></button>
          ${ab ? `<div class="ed-cam-corpo">
            ${(c.linhas || []).map((l, i) => `<div class="ed-cam-linha">
              <input class="entrada" data-cam-txt="${i}" value="${esc(l.texto || "")}" aria-label="Texto da linha ${i + 1}">
              <select class="entrada" data-cam-tipo="${i}" aria-label="Estilo da linha ${i + 1}"><option value="ser" ${l.tipo === "ser" ? "selected" : ""}>Grande (serifada)</option><option value="cap" ${l.tipo === "cap" ? "selected" : ""}>Pequena (caixa-alta)</option><option value="emo" ${l.tipo === "emo" ? "selected" : ""}>Emojis</option></select>
              <button class="icone-btn" type="button" data-cam-tiralinha="${i}" aria-label="Tirar linha">${ic.x}</button></div>`).join("")}
            <button class="btn btn-leve" type="button" data-cam-maislinha>${ic.mais}Linha</button>
            <div class="ed-cam-grade">
              <label>Aparece em (s)<input class="entrada" type="number" step="0.1" min="0" data-cam-t0 value="${c.t0.toFixed(1)}"></label>
              <label>Some em (s)<input class="entrada" type="number" step="0.1" min="0" data-cam-t1 value="${c.t1.toFixed(1)}"></label>
              <label>Tamanho <input type="range" min="0.6" max="1.6" step="0.05" data-cam-esc value="${c.escala || 1}"></label>
            </div>
            ${(() => { const vs = visualCamada(c), pc = (n) => Math.round(n * 100) + "%"; return `<div class="ed-cam-visual">
              <h4 class="ed-cam-sub">Visual do texto</h4>
              <div class="ed-cam-grade">
                <label>Cor da frase grande <span class="ed-cam-cor"><input type="color" data-cam-vis="cor" value="${vs.cor}"><button type="button" class="ed-cam-padrao" data-cam-volta="cor" title="Voltar ao creme">creme</button></span></label>
                <label>Cor das linhas pequenas <span class="ed-cam-cor"><input type="color" data-cam-vis="corPequena" value="${vs.corPequena}"><button type="button" class="ed-cam-padrao" data-cam-volta="corPequena" title="Voltar ao branco">branco</button></span></label>
                <label>Contorno <span class="ed-cam-val">${vs.contorno ? vs.contorno.toFixed(0) : "sem"}</span><input type="range" min="0" max="14" step="1" data-cam-vis="contorno" value="${vs.contorno}"></label>
                <label>Cor do contorno <input type="color" data-cam-vis="contornoCor" value="${vs.contornoCor}"></label>
                <label>Opacidade <span class="ed-cam-val">${pc(vs.opacidade)}</span><input type="range" min="0.1" max="1" step="0.05" data-cam-vis="opacidade" value="${vs.opacidade}"></label>
                <label>Sombra atrás <span class="ed-cam-val">${vs.sombra ? pc(vs.sombra) : "sem"}</span><input type="range" min="0" max="1" step="0.05" data-cam-vis="sombra" value="${vs.sombra}"></label>
                <label>Cor da sombra <input type="color" data-cam-vis="sombraCor" value="${vs.sombraCor}"></label>
                <label>Alinhamento <select class="entrada" data-cam-vis="alinh"><option value="centro" ${vs.alinh === "centro" ? "selected" : ""}>Centro</option><option value="esq" ${vs.alinh === "esq" ? "selected" : ""}>Esquerda</option><option value="dir" ${vs.alinh === "dir" ? "selected" : ""}>Direita</option></select></label>
              </div>
              <div class="ed-cam-acoes"><button class="btn btn-leve" type="button" data-cam-todos>Usar este visual em todos os textos</button></div>
            </div>`; })()}
            <div class="ed-cam-acoes">
              <button class="btn btn-leve" type="button" data-cam-agora="t0">Começar aqui</button>
              <button class="btn btn-leve" type="button" data-cam-agora="t1">Terminar aqui</button>
              <button class="btn btn-leve" type="button" data-cam-centro="x">Centralizar na largura</button>
              <button class="btn btn-leve" type="button" data-cam-centro="y">Centralizar na altura</button>
              <button class="btn btn-leve" type="button" data-cam-ver>Ver no vídeo</button>
              <button class="btn btn-leve" type="button" data-cam-dup>Duplicar</button>
              <button class="btn btn-leve ed-cam-apagar" type="button" data-cam-apagar>Apagar texto</button>
            </div></div>` : ""}
        </div>`; }).join("")}`;
    const mexeu = (redesenhar = true) => { if (redesenhar && !st.tocando) desenhar(st.t); salvarDepois(); };
    $("#ed-cam-novo", box).addEventListener("click", () => {
      guardarCam(); const c = { id: uid(), t0: +st.t.toFixed(2), t1: +Math.min(st.duracao || st.t + 2.5, st.t + 2.5).toFixed(2), x: 0.5, y: 0.2, escala: 1, linhas: [{ texto: "Texto pequeno", tipo: "cap", tam: 38 }, { texto: "Frase principal", tipo: "ser", tam: 110 }] };
      st.camadas.push(c); st.camSel = c.id; pintarCamadas(); mexeu();
    });
    $("[data-desfazer-tudo]", box).addEventListener("click", desfazerTudo);
    $$("[data-cam-abrir]", box).forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.camAbrir; st.camSel = st.camSel === id ? null : id; pintarCamadas();
      const c = camadaAtual(); if (c && !(st.t >= c.t0 && st.t < c.t1)) await irPara(Math.min(c.t1 - 0.05, c.t0 + 0.4)); else if (!st.tocando) desenhar(st.t);
    }));
    const c = camadaAtual(); if (!c) return;
    const corpo = box.querySelector(".ed-cam.aberta");
    $$("[data-cam-txt]", corpo).forEach((i) => i.addEventListener("input", () => { guardarCam("txt" + c.id + i.dataset.camTxt); c.linhas[+i.dataset.camTxt].texto = i.value; mexeu(); }));
    $$("[data-cam-tipo]", corpo).forEach((i) => i.addEventListener("change", () => { guardarCam(); const l = c.linhas[+i.dataset.camTipo]; l.tipo = i.value; l.tam = i.value === "cap" ? 38 : i.value === "emo" ? 50 : 110; mexeu(); }));
    $$("[data-cam-tiralinha]", corpo).forEach((b) => b.addEventListener("click", () => { guardarCam(); c.linhas.splice(+b.dataset.camTiralinha, 1); pintarCamadas(); mexeu(); }));
    $("[data-cam-maislinha]", corpo).addEventListener("click", () => { guardarCam(); c.linhas.push({ texto: "Nova linha", tipo: "cap", tam: 38 }); pintarCamadas(); mexeu(); });
    $("[data-cam-t0]", corpo).addEventListener("change", (e) => { guardarCam(); c.t0 = Math.max(0, +e.target.value || 0); if (c.t1 <= c.t0) c.t1 = c.t0 + 0.5; pintarCamadas(); mexeu(); });
    $("[data-cam-t1]", corpo).addEventListener("change", (e) => { guardarCam(); c.t1 = Math.max(c.t0 + 0.2, +e.target.value || 0); pintarCamadas(); mexeu(); });
    $("[data-cam-esc]", corpo).addEventListener("input", (e) => { guardarCam("esc" + c.id); c.escala = +e.target.value; mexeu(); });
    const NUM_VIS = ["contorno", "opacidade", "sombra"];
    $$("[data-cam-vis]", corpo).forEach((i) => {
      const k = i.dataset.camVis, aplicar = () => {
        guardarCam("vis" + k + c.id); c[k] = NUM_VIS.includes(k) ? +i.value : i.value; mexeu();
        const val = i.closest("label") && i.closest("label").querySelector(".ed-cam-val");
        if (val) val.textContent = k === "contorno" ? (+i.value ? String(+i.value) : "sem") : (k === "sombra" && !+i.value ? "sem" : Math.round(+i.value * 100) + "%");
      };
      i.addEventListener("input", aplicar); i.addEventListener("change", aplicar); // o iPhone só avisa no "change"
    });
    $$("[data-cam-volta]", corpo).forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); guardarCam(); delete c[b.dataset.camVolta]; pintarCamadas(); mexeu(); }));
    $("[data-cam-todos]", corpo).addEventListener("click", () => {
      guardarCam(); const vs = visualCamada(c);
      st.camadas.forEach((x) => { Object.keys(VISUAL_PADRAO).forEach((k) => { x[k] = vs[k]; }); });
      mexeu(); toast(`Visual aplicado nos ${st.camadas.length} textos.`);
    });
    $$("[data-cam-agora]", corpo).forEach((b) => b.addEventListener("click", () => { guardarCam(); const k = b.dataset.camAgora; c[k] = +st.t.toFixed(2); if (c.t1 <= c.t0) { if (k === "t0") c.t1 = c.t0 + 1; else c.t0 = Math.max(0, c.t1 - 1); } pintarCamadas(); mexeu(); }));
    $("[data-cam-ver]", corpo).addEventListener("click", () => irPara(c.t0));
    $$("[data-cam-centro]", corpo).forEach((b) => b.addEventListener("click", () => { guardarCam(); c[b.dataset.camCentro] = 0.5; mexeu(); toast(b.dataset.camCentro === "x" ? "Texto no meio da largura." : "Texto no meio da altura."); }));
    $("[data-cam-dup]", corpo).addEventListener("click", () => { guardarCam(); const n = JSON.parse(JSON.stringify(c)); delete n._box; n.id = uid(); n.t0 = c.t1; n.t1 = c.t1 + (c.t1 - c.t0); st.camadas.push(n); st.camSel = n.id; pintarCamadas(); mexeu(); });
    $("[data-cam-apagar]", corpo).addEventListener("click", (e) => {
      if (e.target.dataset.certeza !== "1") { e.target.dataset.certeza = "1"; e.target.textContent = "Toque de novo para apagar"; return; }
      guardarCam(); st.camadas = st.camadas.filter((x) => x !== c); st.camSel = null; pintarCamadas(); mexeu();
    });
  }
  async function irPara(t) {
    if (st.tocando) parar();
    st.t = clamp(t / Math.max(st.duracao, 0.01)) * st.duracao;
    const s = st.segs.length ? segNoFinal(st.t) : null; if (!s) { desenhar(st.t); return; }
    const v = st.clipes[s.ci].el; v.currentTime = s.a + (st.t - s.o0); await esperarEvento(v, "seeked"); desenhar(st.t);
    if (typeof atualizarTempo === "function") atualizarTempo();
  }

  // onde ficam os botões e o texto do Instagram no Reels (só na prévia; nunca vai para o MP4)
  function guiasInstagram(u, W, H) {
    c2d.save();
    c2d.fillStyle = "rgba(255,255,255,.16)"; c2d.strokeStyle = "rgba(255,255,255,.85)"; c2d.lineWidth = 3 * u; c2d.setLineDash([14 * u, 10 * u]);
    const lado = [W * 0.855, H * 0.5, W * 0.13, H * 0.36], base = [W * 0.03, H * 0.835, W * 0.8, H * 0.15], topo = [W * 0.03, H * 0.02, W * 0.94, H * 0.075];
    for (const [x, y, w, h] of [lado, base, topo]) { c2d.fillRect(x, y, w, h); c2d.strokeRect(x, y, w, h); }
    c2d.setLineDash([]); c2d.fillStyle = "#fff"; c2d.font = `600 ${26 * u}px Poppins, sans-serif`; c2d.textAlign = "left"; c2d.textBaseline = "top";
    c2d.shadowColor = "rgba(0,0,0,.6)"; c2d.shadowBlur = 6 * u;
    c2d.fillText("botões", lado[0] + 10 * u, lado[1] + 12 * u); c2d.fillText("nome e legenda do post", base[0] + 16 * u, base[1] + 14 * u); c2d.fillText("topo do app", topo[0] + 16 * u, topo[1] + 14 * u);
    c2d.restore();
  }
  function quebrar(texto, max, fonte) {
    c2d.font = fonte;
    const palavras = texto.split(/\s+/), linhas = [];
    let linha = "";
    for (const p of palavras) { const teste = linha ? linha + " " + p : p; if (c2d.measureText(teste).width > max && linha) { linhas.push(linha); linha = p; } else linha = teste; }
    if (linha) linhas.push(linha);
    return linhas;
  }
  function desenharLegenda(g, u, W, H) {
    const est = st.opc.estilo, y = H * st.opc.altura;
    const textoDe = (w) => { const x = w.w.replace(/^[,.;:!?]+|[,.;:]+$/g, ""); return st.opc.maiusculas || est === "bold" ? x.toUpperCase() : x.toLowerCase(); };
    const tam = est === "minimal" ? 92 * u : est === "bold" ? 84 * u : 70 * u;
    const peso = est === "minimal" ? 300 : est === "bold" ? 800 : 600;
    const fonte = `${peso} ${tam}px Poppins, "Helvetica Neue", Arial, sans-serif`;
    c2d.font = fonte; c2d.textAlign = "left"; c2d.textBaseline = "middle";
    if (est === "capcut") return legendaCapcut(g, u, W, H);
    const partes = g.texto != null ? [{ t: textoDe({ w: g.texto }), destaque: false }] : g.palavras.map((w) => ({ t: textoDe(w), destaque: w.destaque }));
    const espaco = c2d.measureText(" ").width;
    const largura = partes.reduce((s, p) => s + c2d.measureText(p.t).width, 0) + espaco * (partes.length - 1);
    const xc = xLegenda(W); let x = xc - largura / 2;
    // entrada com um "pulinho"
    const k = Math.min(1, (st.t - g.o0) / 0.08), escala = 0.9 + 0.1 * suave(Math.max(0, k));
    c2d.save(); c2d.translate(xc, y); c2d.scale(escala, escala); c2d.translate(-xc, -y);
    if (est === "caixa") {
      const pad = 26 * u;
      c2d.fillStyle = "#efe5d8"; arredondado(x - pad, y - tam * 0.72, largura + pad * 2, tam * 1.44, 18 * u); c2d.fill();
    }
    for (const p of partes) {
      const cor = p.destaque ? st.opc.cor : est === "caixa" ? "#3d2b20" : "#ffffff";
      if (est === "bold") { c2d.lineJoin = "round"; c2d.lineWidth = 14 * u; c2d.strokeStyle = "#000"; c2d.strokeText(p.t, x, y); }
      if (est === "minimal") { c2d.shadowColor = "rgba(0,0,0,.45)"; c2d.shadowBlur = 18 * u; c2d.shadowOffsetY = 2 * u; }
      c2d.fillStyle = cor; c2d.fillText(p.t, x, y);
      c2d.shadowColor = "transparent"; c2d.shadowBlur = 0; c2d.shadowOffsetY = 0;
      x += c2d.measureText(p.t).width + espaco;
    }
    c2d.restore();
  }

  // ---------- estilo CapCut ----------
  const FREDOKA = (tam) => `700 ${tam}px Fredoka, Poppins, "Helvetica Neue", Arial, sans-serif`;
  const CAVEAT = (tam) => `700 ${tam}px Caveat, "Segoe Script", cursive`;
  const MONT = (tam) => `800 ${tam}px Montserrat, Poppins, "Helvetica Neue", Arial, sans-serif`;
  function legendaCapcut(g, u, W, H) {
    const tam = 74 * u * (Number(st.opc.tamLeg) || 1), y = H * st.opc.altura;
    let texto = textoLeg(g).replace(/^[,.;:!?]+|[,.;:]+$/g, "");
    texto = st.opc.maiusculas ? texto.toUpperCase() : texto.toLowerCase();
    const xc = xLegenda(W), fonte = fonteLeg(tam), linhas = quebrar(texto, W * (st.opc.ladoLeg && st.opc.ladoLeg !== "centro" ? 0.56 : 0.8), fonte);
    const k = Math.min(1, (st.t - g.o0) / 0.09), escala = 0.92 + 0.08 * suave(Math.max(0, k));
    c2d.save(); c2d.translate(xc, y); c2d.scale(escala, escala); c2d.translate(-xc, -y);
    c2d.textAlign = "center"; c2d.textBaseline = "middle";
    c2d.font = fonte;
    if (st.opc.sombra === "dura") { c2d.shadowColor = "rgba(0,0,0,.8)"; c2d.shadowBlur = 0; c2d.shadowOffsetX = 4 * u; c2d.shadowOffsetY = 5 * u; }
    else { c2d.shadowColor = "rgba(0,0,0,.55)"; c2d.shadowBlur = 16 * u; c2d.shadowOffsetY = 3 * u; }
    c2d.fillStyle = st.opc.corLegenda || "#fff3b0";
    linhas.forEach((l, i) => c2d.fillText(l, xc, y + (i - (linhas.length - 1) / 2) * tam * 1.12));
    c2d.restore();
  }
  // lado da legenda (centro, esquerda ou direita do rosto)
  function xLegenda(W) { return st.opc.ladoLeg === "esquerda" ? W * 0.31 : st.opc.ladoLeg === "direita" ? W * 0.69 : W / 2; }
  // palavra chamativa: frase pequena manuscrita em cima e a palavra forte grande, cor viva e sombra dura
  function desenharChamativa(g, t, u, W, H) {
    const idx = st.legendas.filter((x) => x.chamativa && x.o0 <= g.o0).length - 1;
    const cor = CORES_CHAMATIVA[idx % CORES_CHAMATIVA.length];
    const limpa = (x) => String(x).replace(/^[,.;:!?"']+|[,.;:!?"']+$/g, "");
    let forte, resto;
    if (g.texto != null) { const ws = limpa(g.texto).split(/\s+/); forte = ws.pop(); resto = ws.join(" "); }
    else { const d = g.palavras.find((w) => w.destaque) || g.palavras.reduce((m, w) => (limpa(w.w).length > limpa(m.w).length ? w : m)); forte = limpa(d.w); resto = g.palavras.filter((w) => w !== d).map((w) => limpa(w.w)).join(" "); }
    forte = forte.toLowerCase(); resto = resto.toLowerCase();
    const y = H * Math.min(st.opc.altura, 0.5) - 20 * u;
    const d = t - g.o0, k = Math.min(1, d / 0.16);
    const esc0 = d < 0.16 ? 0.4 + 0.75 * suave(k) : 1.15 - 0.15 * Math.min(1, (d - 0.16) / 0.12);
    const rot = (idx % 2 ? 3 : -3) * Math.PI / 180;
    let tam = 168 * u; c2d.font = FREDOKA(tam);
    const w = c2d.measureText(forte).width; if (w > W * 0.84) { tam *= (W * 0.84) / w; c2d.font = FREDOKA(tam); }
    c2d.save(); c2d.translate(W / 2, y); c2d.rotate(rot); c2d.scale(esc0, esc0);
    c2d.textAlign = "center"; c2d.textBaseline = "middle";
    if (resto) { c2d.font = CAVEAT(78 * u); c2d.shadowColor = "rgba(0,0,0,.5)"; c2d.shadowBlur = 12 * u; c2d.fillStyle = "#ffffff"; c2d.fillText(resto, 0, -tam * 0.78); c2d.shadowColor = "transparent"; c2d.shadowBlur = 0; }
    c2d.font = FREDOKA(tam);
    c2d.fillStyle = "#111"; c2d.fillText(forte, 7 * u, 8 * u);
    c2d.fillStyle = cor; c2d.fillText(forte, 0, 0);
    c2d.restore();
  }
  // confete verde-limão caindo nos momentos fortes e nas palavras chamativas
  function desenharConfete(t, u, W, H) {
    const momentos = [...(st.fortes || []), ...st.legendas.filter((x) => x.chamativa && st.opc.chamativas && !(st.opc.titulo && st.titulo && x.o0 < DUR_TITULO)).map((x) => x.o0)];
    const m = momentos.filter((x) => t >= x && t < x + 1.3).pop(); if (m == null) return;
    const d = t - m;
    for (let i = 0; i < 46; i++) {
      const r1 = Math.abs(Math.sin(m * 97 + i * 12.9898) * 43758.5453) % 1, r2 = Math.abs(Math.sin(m * 31 + i * 78.233) * 12345.678) % 1;
      const x = r1 * W + Math.sin(d * 6 + i) * 30 * u, y = -40 * u + (0.2 + r2 * 0.6) * H * d * 1.1 + 600 * u * d * d * 0.5;
      if (y > H) continue;
      c2d.save(); c2d.globalAlpha = Math.max(0, 1 - d / 1.3); c2d.translate(x, y); c2d.rotate(d * 8 + i);
      c2d.fillStyle = ["#c6f432", "#ffffff", "#ffe45c"][i % 3]; c2d.fillRect(-7 * u, -3 * u, 14 * u, 6 * u); c2d.restore();
    }
  }
  // tremidinha curta nos momentos fortes (efeito "impacto")
  function tremida(t) {
    if (!st.opc.tremer) return { x: 0, y: 0, z: 0 };
    for (const m of st.fortes || []) { const d = t - m; if (d >= 0 && d < 0.28) { const a = (1 - d / 0.28) * 0.012; return { x: Math.sin(d * 90) * a, y: Math.cos(d * 70) * a, z: a * 2 }; } }
    return { x: 0, y: 0, z: 0 };
  }
  // título limpo: frase curta em serifada itálica, cor da legenda, sombra suave, entra subindo de leve
  function tituloSimples(t, u, W, H) {
    const saida = t > DUR_TITULO - 0.3 ? Math.max(0, (DUR_TITULO - t) / 0.3) : 1;
    const k = Math.min(1, t / 0.35), y = H * (Number(st.opc.alturaTitulo) || 0.24) + (1 - suave(k)) * 30 * u;
    let tam = 118 * u; const fonte = (x) => fonteTitulo(x);
    const linhas = quebrar(st.titulo.toLowerCase(), W * 0.82, fonte(tam));
    c2d.save(); c2d.globalAlpha = saida * suave(k); c2d.font = fonte(tam); c2d.textAlign = "center"; c2d.textBaseline = "middle";
    c2d.shadowColor = "rgba(0,0,0,.5)"; c2d.shadowBlur = 18 * u; c2d.shadowOffsetY = 3 * u;
    c2d.fillStyle = st.opc.corTitulo || st.opc.corLegenda || "#fff3b0";
    linhas.forEach((l, i) => c2d.fillText(l, W / 2, y + (i - (linhas.length - 1) / 2) * tam * 1.05));
    c2d.restore();
  }
  const SERIFA = (tam) => `italic 400 ${tam}px "DM Serif Display", Georgia, serif`;
  const BASTAO = (tam) => `800 ${tam}px Poppins, "Helvetica Neue", Arial, sans-serif`;
  function estrela(x, y, r, cor) {
    c2d.save(); c2d.fillStyle = cor; c2d.beginPath();
    for (let i = 0; i < 8; i++) { const a = (Math.PI / 4) * i - Math.PI / 2, rr = i % 2 ? r * 0.28 : r; c2d.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c2d.closePath(); c2d.fill(); c2d.restore();
  }
  function desenharTitulo(t, u, W, H) {
    if (st.opc.estiloTitulo === "simples" || st.opc.estiloTitulo === "capcut") return tituloSimples(t, u, W, H);
    if (st.opc.estiloTitulo === "etapas") return tituloEtapas(t, u, W, H);
    if (st.opc.estiloTitulo === "frase") return tituloFrase(t, u, W, H);
    return tituloCaixa(t, u, W, H);
  }
  // Bia Abbate / Rafa: título condensado, uma parte numa fonte forte e a palavra de destaque em serifa itálica, entrando em etapas
  function tituloEtapas(t, u, W, H) {
    const saida = t > DUR_TITULO - 0.3 ? Math.max(0, (DUR_TITULO - t) / 0.3) : 1;
    const partes = partesTitulo(), y0 = H * 0.24, alt = 138 * u;
    c2d.save(); c2d.globalAlpha = saida; c2d.textAlign = "center"; c2d.textBaseline = "middle";
    partes.forEach((p, i) => {
      if (t < p.t) return;
      const k = Math.min(1, (t - p.t) / 0.12), esc0 = 0.82 + 0.18 * suave(k);
      const y = y0 + (i - (partes.length - 1) / 2) * alt;
      let tam = p.destaque ? 132 * u : 92 * u;
      c2d.font = p.destaque ? SERIFA(tam) : BASTAO(tam);
      const texto = p.destaque ? p.texto.toLowerCase() : p.texto.toUpperCase();
      const w = c2d.measureText(texto).width;
      if (w > W * 0.86) { tam *= (W * 0.86) / w; c2d.font = p.destaque ? SERIFA(tam) : BASTAO(tam); }
      c2d.save(); c2d.translate(W / 2, y); c2d.scale(esc0, esc0);
      c2d.shadowColor = "rgba(0,0,0,.42)"; c2d.shadowBlur = 22 * u; c2d.shadowOffsetY = 3 * u;
      c2d.fillStyle = "#ffffff"; c2d.fillText(texto, 0, 0);
      c2d.shadowColor = "transparent";
      if (p.destaque) {
        const ww = Math.min(c2d.measureText(texto).width, W * 0.86), brilho = 0.75 + 0.25 * Math.sin(t * 9);
        estrela(-ww / 2 - 30 * u, -tam * 0.38, 22 * u * brilho, st.opc.cor);
        estrela(ww / 2 + 26 * u, tam * 0.3, 16 * u * (1.75 - brilho), st.opc.cor);
        estrela(ww / 2 + 52 * u, -tam * 0.12, 9 * u, "#ffffff");
      }
      c2d.restore();
    });
    c2d.restore();
  }
  // Rafa: frase gigante ocupando a tela, duas fontes alternadas e três cores (contraste com o fundo)
  function tituloFrase(t, u, W, H) {
    const saida = t > DUR_TITULO - 0.3 ? Math.max(0, (DUR_TITULO - t) / 0.3) : 1;
    const k = Math.min(1, t / 0.18), esc0 = 0.9 + 0.1 * suave(k);
    c2d.save(); c2d.globalAlpha = saida;
    c2d.fillStyle = "rgba(29,22,17,.42)"; c2d.fillRect(0, 0, W, H);
    const partes = partesTitulo(), cores = ["#ffffff", st.opc.cor, "#efe5d8"];
    const linhas = partes.map((p, i) => { const serifa = i % 2 === 1; let tam = 170 * u; const texto = serifa ? p.texto.toLowerCase() : p.texto.toUpperCase();
      c2d.font = serifa ? SERIFA(tam) : BASTAO(tam); const w = c2d.measureText(texto).width; if (w > W * 0.88) tam *= (W * 0.88) / w; return { texto, serifa, tam, cor: cores[i % 3] }; });
    const total = linhas.reduce((s, l) => s + l.tam * 1.08, 0);
    let y = H * 0.42 - total / 2;
    c2d.translate(W / 2, H * 0.42); c2d.scale(esc0, esc0); c2d.translate(-W / 2, -H * 0.42);
    c2d.textAlign = "center"; c2d.textBaseline = "middle";
    for (const l of linhas) { c2d.font = l.serifa ? SERIFA(l.tam) : BASTAO(l.tam); y += l.tam * 0.54; c2d.fillStyle = l.cor; c2d.fillText(l.texto, W / 2, y); y += l.tam * 0.54; }
    c2d.restore();
  }
  function tituloCaixa(t, u, W, H) {
    const k = Math.min(1, t / 0.22), saida = t > DUR_TITULO - 0.3 ? Math.max(0, (DUR_TITULO - t) / 0.3) : 1;
    const esc0 = (k < 1 ? 0.6 + 0.5 * suave(k) : 1.1 - 0.1 * Math.min(1, (t - 0.22) / 0.15)) * saida;
    if (esc0 <= 0) return;
    const fonte = `800 ${96 * u}px Poppins, "Helvetica Neue", Arial, sans-serif`;
    const linhas = quebrar(st.titulo.toUpperCase(), W * 0.82, fonte);
    const y0 = H * 0.2, alt = 112 * u;
    c2d.save(); c2d.globalAlpha = saida; c2d.translate(W / 2, y0); c2d.scale(esc0, esc0); c2d.translate(-W / 2, -y0);
    c2d.font = fonte; c2d.textAlign = "center"; c2d.textBaseline = "middle";
    linhas.forEach((l, i) => {
      const y = y0 + (i - (linhas.length - 1) / 2) * alt, w = c2d.measureText(l).width, pad = 28 * u;
      c2d.fillStyle = i % 2 ? "#6b4a35" : "#ffffff";
      arredondado(W / 2 - w / 2 - pad, y - alt * 0.48, w + pad * 2, alt * 0.96, 20 * u); c2d.fill();
      c2d.fillStyle = i % 2 ? "#ffffff" : "#3d2b20"; c2d.fillText(l, W / 2, y + 4 * u);
    });
    c2d.restore();
  }
  function arredondado(x, y, w, h, r) { c2d.beginPath(); c2d.moveTo(x + r, y); c2d.arcTo(x + w, y, x + w, y + h, r); c2d.arcTo(x + w, y + h, x, y + h, r); c2d.arcTo(x, y + h, x, y, r); c2d.arcTo(x, y, x + w, y, r); c2d.closePath(); }

  // ---------- áudio: mixer e efeitos sonoros sintetizados ----------
  let ac = null, mestre = null, saidaGravacao = null, ruidoBuf = null;
  function audio() {
    if (ac) return ac;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    ac = new Ctx();
    mestre = ac.createGain(); mestre.connect(ac.destination);
    saidaGravacao = ac.createMediaStreamDestination(); mestre.connect(saidaGravacao);
    ruidoBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }
  // voz no volume do Instagram: compressor leve e ganho na fala (os efeitos não passam por aqui)
  let voz = null;
  function cadeiaVoz() {
    if (voz) return voz;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -26; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.12;
    const ganho = ac.createGain(), lim = ac.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.05;
    comp.connect(ganho); ganho.connect(lim); lim.connect(mestre);
    voz = { entrada: ac.createGain(), comp, ganho };
    ajustarVoz();
    return voz;
  }
  function ajustarVoz() {
    if (!voz) return;
    try { voz.entrada.disconnect(); } catch (e) { /* ainda não ligado */ }
    if (st.opc.vozForte) { voz.entrada.connect(voz.comp); voz.ganho.gain.value = 1.7; } else voz.entrada.connect(mestre);
  }
  function ligarClipe(c) {
    audio();
    if (c.no) return;
    c.no = ac.createMediaElementSource(c.el); c.no.connect(cadeiaVoz().entrada);
  }
  function ruido(quando, dur, destino) { const s = ac.createBufferSource(); s.buffer = ruidoBuf; s.connect(destino); s.start(quando, Math.random(), dur); return s; }
  function env(g, quando, pico, ataque, queda) { g.gain.setValueAtTime(0.0001, quando); g.gain.exponentialRampToValueAtTime(pico, quando + ataque); g.gain.exponentialRampToValueAtTime(0.0001, quando + ataque + queda); }
  function tocarEfeito(tipo, quando, vol) {
    audio();
    const saida = ac.createGain(); saida.gain.value = vol; saida.connect(mestre);
    const q = Math.max(ac.currentTime, quando);
    if (tipo === "woosh") {
      const f = ac.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2; const g = ac.createGain(); f.connect(g); g.connect(saida);
      f.frequency.setValueAtTime(300, q); f.frequency.exponentialRampToValueAtTime(3200, q + 0.22); f.frequency.exponentialRampToValueAtTime(500, q + 0.5);
      env(g, q, 1.4, 0.2, 0.32); ruido(q, 0.55, f);
    } else if (tipo === "pop") {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.connect(g); g.connect(saida);
      o.frequency.setValueAtTime(900, q); o.frequency.exponentialRampToValueAtTime(260, q + 0.09); env(g, q, 0.9, 0.005, 0.11); o.start(q); o.stop(q + 0.14);
    } else if (tipo === "click" || tipo === "typing") {
      const vezes = tipo === "typing" ? 7 : 1;
      for (let i = 0; i < vezes; i++) {
        const t0 = q + i * (0.06 + Math.random() * 0.05), f = ac.createBiquadFilter(), g = ac.createGain();
        f.type = "highpass"; f.frequency.value = 1800 + Math.random() * 1200; f.connect(g); g.connect(saida); env(g, t0, 0.8, 0.002, 0.03); ruido(t0, 0.04, f);
      }
    } else if (tipo === "shutter") {
      [0, 0.07].forEach((d, i) => { const f = ac.createBiquadFilter(), g = ac.createGain(); f.type = "bandpass"; f.frequency.value = i ? 2600 : 1500; f.Q.value = 0.8; f.connect(g); g.connect(saida); env(g, q + d, 1.1, 0.002, 0.06); ruido(q + d, 0.08, f); });
    } else if (tipo === "riser") {
      const ini = Math.max(ac.currentTime, quando - 1.2), dur = Math.max(0.2, quando + 0.05 - ini);
      const o = ac.createOscillator(), go = ac.createGain(), f = ac.createBiquadFilter(), gn = ac.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(180, ini); o.frequency.exponentialRampToValueAtTime(1100, ini + dur);
      o.connect(go); go.connect(saida); go.gain.setValueAtTime(0.0001, ini); go.gain.exponentialRampToValueAtTime(0.18, ini + dur); go.gain.exponentialRampToValueAtTime(0.0001, ini + dur + 0.05);
      f.type = "bandpass"; f.frequency.setValueAtTime(400, ini); f.frequency.exponentialRampToValueAtTime(5000, ini + dur); f.connect(gn); gn.connect(saida);
      gn.gain.setValueAtTime(0.0001, ini); gn.gain.exponentialRampToValueAtTime(0.9, ini + dur); gn.gain.exponentialRampToValueAtTime(0.0001, ini + dur + 0.05);
      o.start(ini); o.stop(ini + dur + 0.08); ruido(ini, dur + 0.08, f);
    } else if (tipo === "hit") {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.setValueAtTime(140, q); o.frequency.exponentialRampToValueAtTime(38, q + 0.5);
      o.connect(g); g.connect(saida); env(g, q, 1.5, 0.005, 0.6); o.start(q); o.stop(q + 0.7);
      const f = ac.createBiquadFilter(), gn = ac.createGain(); f.type = "lowpass"; f.frequency.value = 900; f.connect(gn); gn.connect(saida); env(gn, q, 0.9, 0.002, 0.25); ruido(q, 0.3, f);
    } else if (tipo === "ding") {
      [1320, 1980, 2640].forEach((fr, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = fr; o.connect(g); g.connect(saida); env(g, q, 0.45 / (i + 1), 0.005, 0.9); o.start(q); o.stop(q + 1); });
    } else if (tipo === "suave") {
      // whoosh suave: respiro de ar, grave e curto
      const f = ac.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 0.7; const g = ac.createGain(); f.connect(g); g.connect(saida);
      f.frequency.setValueAtTime(400, q); f.frequency.exponentialRampToValueAtTime(1600, q + 0.25); f.frequency.exponentialRampToValueAtTime(300, q + 0.6);
      env(g, q, 0.7, 0.25, 0.4); ruido(q, 0.7, f);
    } else if (tipo === "cristal") {
      // ding de cristal: parciais inarmônicas brilhantes com cauda longa
      [[2093, 0.35], [3136, 0.22], [4186, 0.16], [5274, 0.1], [6272, 0.07]].forEach(([fr, a], i) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = fr * (1 + i * 0.003); o.connect(g); g.connect(saida); env(g, q + i * 0.012, a, 0.003, 1.6); o.start(q); o.stop(q + 1.8); });
    } else if (tipo === "brilho") {
      // sparkle: pinguinhos agudos aleatórios, bem baixinho
      for (let i = 0; i < 9; i++) { const t0 = q + i * 0.045 + Math.random() * 0.03, o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = 3000 + Math.random() * 3500; o.connect(g); g.connect(saida); env(g, t0, 0.12, 0.002, 0.18); o.start(t0); o.stop(t0 + 0.22); }
    } else if (tipo === "spray") {
      // borrifo de perfume: chiado agudo curto com ataque rápido
      const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 3500; const f2 = ac.createBiquadFilter(); f2.type = "peaking"; f2.frequency.value = 7000; f2.gain.value = 6;
      const g = ac.createGain(); f.connect(f2); f2.connect(g); g.connect(saida);
      g.gain.setValueAtTime(0.0001, q); g.gain.exponentialRampToValueAtTime(0.9, q + 0.02); g.gain.setValueAtTime(0.9, q + 0.28); g.gain.exponentialRampToValueAtTime(0.0001, q + 0.45); ruido(q, 0.48, f);
    } else if (tipo === "mensagem") {
      // mensagem chegando: duas notas rápidas subindo
      [[880, 0], [1320, 0.11]].forEach(([fr, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "triangle"; o.frequency.value = fr; o.connect(g); g.connect(saida); env(g, q + d, 0.5, 0.004, 0.22); o.start(q + d); o.stop(q + d + 0.3); });
    } else if (tipo === "relogio") {
      // tique-taque rápido por 1 segundo
      for (let i = 0; i < 6; i++) { const t0 = q + i * 0.17, f = ac.createBiquadFilter(), g = ac.createGain(); f.type = "bandpass"; f.frequency.value = i % 2 ? 2400 : 3200; f.Q.value = 6; f.connect(g); g.connect(saida); env(g, t0, 0.9, 0.001, 0.025); ruido(t0, 0.03, f); }
    }
  }

  // ---------- tocar (prévia) e gravar (exportar) ----------
  function esperarEvento(el, ev) { return new Promise((ok) => { let feito = false; const f = () => { if (feito) return; feito = true; el.removeEventListener(ev, f); ok(); }; el.addEventListener(ev, f); setTimeout(f, 2500); }); }
  async function tocar(desde, gravador) {
    if (!st.segs.length) return;
    audio(); if (ac.state === "suspended") await ac.resume();
    st.clipes.forEach(ligarClipe);
    st.parar = false; st.tocando = true; pintarControles();
    try { if (st.musSrc) st.musSrc.stop(); } catch (e) { /* já parou */ }
    st.musSrc = tocarMusica(ac, mestre, desde, st.duracao);
    let i = st.segs.findIndex((s) => desde >= s.o0 && desde < s.o1); if (i < 0) i = 0;
    let dentro = Math.max(0, desde - st.segs[i].o0);
    for (; i < st.segs.length && !st.parar; i++) {
      const s = st.segs[i], v = st.clipes[s.ci].el;
      v.currentTime = s.a + dentro;
      await esperarEvento(v, "seeked");
      const inicioFinal = s.o0 + dentro;
      if (st.opc.efeitos) for (const e of st.efeitos) if (e.t >= inicioFinal && e.t < s.o1) tocarEfeito(e.tipo, ac.currentTime + (e.t - inicioFinal), st.opc.vol);
      if (gravador && gravador.state === "paused") gravador.resume();
      try { await v.play(); } catch (e) { toast("O navegador bloqueou o som. Clique em play de novo.", true); break; }
      await new Promise((ok) => {
        const passo = () => {
          const t = s.o0 + (v.currentTime - s.a);
          st.t = Math.min(t, s.o1); desenhar(st.t); atualizarTempo();
          if (st.parar || v.currentTime >= s.b - 0.03 || v.ended) { ok(); return; }
          requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
      });
      v.pause();
      if (gravador && gravador.state === "recording" && i < st.segs.length - 1) gravador.pause();
      dentro = 0;
    }
    if (!st.parar && st.t >= st.duracao - 0.1) st.t = 0;
    try { if (st.musSrc) st.musSrc.stop(); } catch (e) { /* já parou */ } st.musSrc = null;
    st.tocando = false; pintarControles();
  }
  function parar() { st.parar = true; st.clipes.forEach((c) => c.el.pause()); try { if (st.musSrc) st.musSrc.stop(); } catch (e) { /* já parou */ } st.musSrc = null; }

  async function exportarAoVivo() {
    if (!st.segs.length || st.exportando) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast("Esse navegador não exporta vídeo. Use o Chrome ou o Safari no computador.", true); return; }
    if (st.tocando) { parar(); await espera(150); }
    prepararCanvas(); audio(); if (ac.state === "suspended") await ac.resume();
    await document.fonts.ready;
    const tipos = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const tipo = tipos.find((t) => MediaRecorder.isTypeSupported(t)) || "";
    const fluxo = canvas.captureStream(30);
    saidaGravacao.stream.getAudioTracks().forEach((tr) => fluxo.addTrack(tr));
    const rec = new MediaRecorder(fluxo, { mimeType: tipo, videoBitsPerSecond: st.opc.qualidade === 720 ? 6e6 : 12e6, audioBitsPerSecond: 192000 });
    const pedacos = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) pedacos.push(e.data); };
    const fim = new Promise((ok) => { rec.onstop = ok; });
    st.exportando = true; st.arquivoFinal = null; pintar();
    desenhar(0);
    rec.start(500); rec.pause();
    await tocar(0, rec);
    if (rec.state === "paused") rec.resume();
    await espera(250);
    rec.stop(); await fim;
    fluxo.getVideoTracks().forEach((tr) => tr.stop());
    st.exportando = false;
    if (st.parar && st.t < st.duracao - 0.3) { toast("Exportação cancelada."); pintar(); return; }
    const blob = new Blob(pedacos, { type: (tipo || "video/webm").split(";")[0] });
    const ext = /mp4/.test(tipo) ? "mp4" : "webm";
    const base = (st.clipes[0] ? st.clipes[0].nome.replace(/\.[^.]+$/, "") : "video") + "-editado";
    st.arquivoFinal = { url: URL.createObjectURL(blob), nome: `${base}.${ext}`, ext, tamanho: blob.size };
    pintar();
    toast("Vídeo editado pronto para baixar.");
  }

  // ---------- exportar quadro a quadro (out/2026: o vídeo gravado ao vivo travava depois de salvo) ----------
  // O jeito antigo gravava a tela em tempo real (MediaRecorder): com vídeo 4K do iPhone o navegador perdia quadros,
  // as pausas entre cortes deixavam buracos e o MP4 saía "fragmentado" (o app Fotos do Windows e o WhatsApp travam).
  // Agora cada quadro é desenhado e codificado com o tempo exato (WebCodecs), o áudio é mixado à parte
  // (OfflineAudioContext, com a voz e os efeitos) e o MP4 é montado com o índice no começo (mp4-muxer, fastStart).
  const FPS = 30;
  let muxerPronto = null;
  function carregarMuxer() {
    if (window.Mp4Muxer) return Promise.resolve();
    if (!muxerPronto) muxerPronto = new Promise((ok, falha) => { const sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.js"; sc.onload = ok; sc.onerror = () => { muxerPronto = null; falha(new Error("muxer")); }; document.head.appendChild(sc); });
    return muxerPronto;
  }
  async function configVideo(w, h) {
    const br = st.opc.qualidade === 720 ? 6e6 : 12e6;
    const opcoes = [["avc", "avc1.640028"], ["avc", "avc1.4d0028"], ["avc", "avc1.42002a"], ["vp9", "vp09.00.40.08"]];
    for (const [mux, codec] of opcoes) {
      for (const hw of ["prefer-hardware", "no-preference"]) {
        const cfg = { codec, width: w, height: h, bitrate: br, framerate: FPS, hardwareAcceleration: hw, latencyMode: "quality", ...(mux === "avc" ? { avc: { format: "avc" } } : {}) };
        try { const r = await VideoEncoder.isConfigSupported(cfg); if (r && r.supported) return { mux, cfg }; } catch (e) { /* tenta o próximo */ }
      }
    }
    return null;
  }
  async function configAudio() {
    for (const [mux, codec] of [["aac", "mp4a.40.2"], ["opus", "opus"]]) {
      const cfg = { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 };
      try { const r = await AudioEncoder.isConfigSupported(cfg); if (r && r.supported) return { mux, cfg }; } catch (e) { /* tenta o próximo */ }
    }
    return null;
  }
  // áudio original de cada clipe, decodificado em 48 kHz (fica guardado no clipe)
  async function audioDoClipe(c) {
    if (c.mudo) return null;
    if (c.somBuf !== undefined) return c.somBuf;
    const dec = new OfflineAudioContext(2, 1, 48000);
    const tentar = async (blob) => { try { return await dec.decodeAudioData(await blob.arrayBuffer()); } catch (e) { return null; } };
    let buf = null;
    if (c.arquivo && c.arquivo.size < 350 * 1048576 && !IPHONE) buf = await tentar(c.arquivo);
    if (!buf && c.arquivo) { const m = await audioDoArquivo(c.arquivo); if (m && m.length) buf = await tentar(m[0].blob); else if (m && !m.length) { c.somBuf = null; return null; } }
    if (!buf) throw new Error("sem áudio");
    c.somBuf = buf; return buf;
  }
  async function mixarAudio(dur) {
    const bufs = [];
    for (const c of st.clipes) bufs.push(await audioDoClipe(c));
    const off = new OfflineAudioContext(2, Math.max(1, Math.ceil(dur * 48000)), 48000);
    const guardado = { ac, mestre, ruidoBuf, voz };
    try {
      ac = off; voz = null;
      mestre = off.createGain(); mestre.connect(off.destination);
      ruidoBuf = off.createBuffer(1, off.sampleRate * 2, off.sampleRate);
      const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const entrada = cadeiaVoz().entrada;
      for (const s of st.segs) {
        const buf = bufs[s.ci]; if (!buf) continue;
        const ini = Math.max(0, s.a), len = Math.max(0, Math.min(s.b, buf.duration) - ini); if (len <= 0.01) continue;
        const src = off.createBufferSource(); src.buffer = buf; src.connect(entrada); src.start(s.o0, ini, len);
      }
      if (st.opc.efeitos) for (const e of st.efeitos) if (e.t < dur) tocarEfeito(e.tipo, e.t, st.opc.vol);
      tocarMusica(off, mestre, 0, dur, 0);
    } finally { ({ ac, mestre, ruidoBuf, voz } = guardado); }
    return off.startRendering();
  }
  function mostrarProgresso(k, txt) {
    st.progresso = k;
    const b = $("#ed-exportar"); if (b) b.textContent = txt || `Gerando o vídeo… ${Math.round(k * 100)}% (deixe esta aba aberta)`;
  }
  async function exportar() {
    if (!st.segs.length || st.exportando) return;
    const pode = window.VideoEncoder && window.AudioEncoder && window.VideoFrame && window.OfflineAudioContext;
    if (pode) {
      try { const r = await exportarQuadros(); if (r !== "sem-suporte") return; }
      catch (e) { console.warn("exportar quadro a quadro falhou:", e); st.exportando = false; if (st.parar) { pintar(); return; } toast("Vou gerar do jeito antigo (ao vivo) neste navegador.", true); }
    }
    return exportarAoVivo();
  }
  async function exportarQuadros() {
    if (st.tocando) { parar(); await espera(150); }
    prepararCanvas();
    const [W, H] = [canvas.width, canvas.height];
    const [vc, acfg] = await Promise.all([configVideo(W, H), configAudio()]);
    if (!vc || !acfg) return "sem-suporte";
    await carregarMuxer(); await document.fonts.ready;
    const dur = st.duracao, N = Math.max(1, Math.round(dur * FPS));
    st.exportando = true; st.parar = false; st.arquivoFinal = null; pintar(); mostrarProgresso(0, "Preparando o áudio…");
    try {
      const som = await mixarAudio(dur);
      const M = window.Mp4Muxer, alvo = new M.ArrayBufferTarget();
      const mux = new M.Muxer({ target: alvo, fastStart: "in-memory", firstTimestampBehavior: "offset",
        video: { codec: vc.mux, width: W, height: H, frameRate: FPS }, audio: { codec: acfg.mux, numberOfChannels: 2, sampleRate: 48000 } });
      let erro = null;
      const venc = new VideoEncoder({ output: (ch, meta) => mux.addVideoChunk(ch, meta), error: (e) => { erro = e; } });
      venc.configure(vc.cfg);
      const aenc = new AudioEncoder({ output: (ch, meta) => mux.addAudioChunk(ch, meta), error: (e) => { erro = e; } });
      aenc.configure(acfg.cfg);
      // áudio: em blocos de 1024 amostras (planar)
      const L = som.getChannelData(0), R = som.numberOfChannels > 1 ? som.getChannelData(1) : L, BL = 1024 * 8;
      for (let i = 0; i < som.length; i += BL) {
        const n = Math.min(BL, som.length - i), dados = new Float32Array(n * 2);
        dados.set(L.subarray(i, i + n), 0); dados.set(R.subarray(i, i + n), n);
        const ad = new AudioData({ format: "f32-planar", sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / 48000 * 1e6), data: dados });
        aenc.encode(ad); ad.close();
        if (aenc.encodeQueueSize > 30) await espera(5);
      }
      // vídeo: um quadro por vez, cada um no tempo certo
      let prox = 0;
      const quadro = async () => {
        desenhar(prox / FPS);
        const f = new VideoFrame(canvas, { timestamp: Math.round(prox * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
        venc.encode(f, { keyFrame: prox % (FPS * 2) === 0 }); f.close();
        prox++;
        if (prox % 6 === 0) { mostrarProgresso(prox / N); atualizarTempoExport(prox / FPS); }
        while (venc.encodeQueueSize > 12 && !erro) await espera(4);
      };
      for (let i = 0; i < st.segs.length && prox < N && !st.parar && !erro; i++) {
        const s = st.segs[i], c = st.clipes[s.ci], v = c.el, fimSeg = Math.min(s.o1, dur);
        v.muted = true; v.pause();
        // caminho rápido: toca o bruto em meia velocidade e pega cada quadro que aparece (requestVideoFrameCallback),
        // com o tempo certo de cada um; se algum quadro faltar, repete o anterior (nunca congela nem pula o tempo)
        if ("requestVideoFrameCallback" in v && !st.soBusca) {
          v.currentTime = Math.max(0, s.a + (prox / FPS - s.o0)); await esperarEvento(v, "seeked");
          v.playbackRate = 0.5;
          await new Promise((ok) => {
            let ultimo = Date.now(), feito = false, ocupado = false;
            const fim = () => { if (feito) return; feito = true; clearInterval(cao); v.pause(); v.playbackRate = 1; ok(); };
            const cao = setInterval(() => { if (Date.now() - ultimo > 3000 && !ocupado) fim(); }, 500); // travou: termina pela busca
            const cb = async (agora, meta) => {
              if (feito) return; ultimo = Date.now(); ocupado = true;
              const tOut = s.o0 + (meta.mediaTime - s.a);
              if (venc.encodeQueueSize > 12) v.pause();
              while (prox < N && prox / FPS < fimSeg - 1e-6 && prox / FPS <= tOut + 0.5 / FPS && !st.parar && !erro) await quadro();
              ocupado = false; ultimo = Date.now();
              if (st.parar || erro || prox >= N || prox / FPS >= fimSeg - 1e-6 || v.ended || meta.mediaTime >= s.b - 0.5 / FPS) { fim(); return; }
              if (v.paused) { try { await v.play(); } catch (e) { fim(); return; } }
              v.requestVideoFrameCallback(cb);
            };
            v.requestVideoFrameCallback(cb);
            v.play().catch(() => fim());
          });
        }
        // quadro a quadro pela busca (o que sobrou do trecho, ou navegador sem o caminho rápido)
        while (prox < N && prox / FPS < fimSeg - 1e-6 && !st.parar && !erro) {
          const alvoT = s.a + (prox / FPS - s.o0);
          if (Math.abs(v.currentTime - alvoT) > 0.5 / FPS || v.readyState < 2) { v.currentTime = Math.min(alvoT, Math.max(0, (v.duration || alvoT) - 0.01)); await esperarEvento(v, "seeked"); if (v.readyState < 2) await esperarEvento(v, "loadeddata"); }
          await quadro();
        }
      }
      st.clipes.forEach((c) => { c.el.muted = false; });
      if (st.parar || erro) { try { venc.close(); aenc.close(); } catch (e) { /* já fechado */ } st.exportando = false; if (erro) throw erro; toast("Exportação cancelada."); pintar(); return "cancelado"; }
      mostrarProgresso(1, "Finalizando o MP4…");
      await venc.flush(); await aenc.flush(); venc.close(); aenc.close();
      mux.finalize();
      const blob = new Blob([alvo.buffer], { type: "video/mp4" });
      const base = (st.clipes[0] ? st.clipes[0].nome.replace(/\.[^.]+$/, "") : "video") + "-editado";
      st.arquivoFinal = { url: URL.createObjectURL(blob), nome: `${base}.mp4`, ext: "mp4", tamanho: blob.size };
      st.exportando = false; st.t = 0; pintar(); desenhar(0);
      toast("Vídeo editado pronto para baixar (MP4 que roda liso no celular e no computador).");
      return "ok";
    } catch (e) { st.exportando = false; st.clipes.forEach((c) => { c.el.muted = false; }); throw e; }
  }
  function atualizarTempoExport(t) { const r = $("#ed-relogio"); if (r) r.textContent = tempo(t); const ag = $("#ed-agulha"); if (ag && st.duracao) ag.style.left = (Math.min(t, st.duracao) / st.duracao * 100).toFixed(3) + "%"; }
  function srt() {
    const f = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
    return st.legendas.map((g, i) => `${i + 1}\n${f(g.o0)} --> ${f(g.o1)}\n${textoLeg(g)}\n`).join("\n");
  }
  function baixar(nome, conteudo, tipo) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo })); a.download = nome; a.click(); }

  // ---------- tela ----------
  const ic = {
    filme: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M3.5 9h17M3.5 15h17M8 5v4M16 5v4M8 15v4M16 15v4"/></svg>',
    play: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z"/></svg>',
    pausa: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>',
    brilho: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    baixar: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>',
    mais: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    cima: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    baixo: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    alca: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg>',
    desfazer: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4.5 11.5 9 16"/><path d="M5 11.5h9.5a5 5 0 0 1 0 10H11"/></svg>',
    som: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>',
  };

  function montarTela(sec) {
    // layout "reel review" (referência do editor da getgitgirl), nas cores do painel dela: player 9:16 fixo à esquerda,
    // abas em pílula à direita e a linha do tempo com legendas e efeitos embaixo
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga ed rr">
      <header class="rr-cabeca"><div><h2 class="rr-h1">edição de reels</h2><p class="rr-lede">Mande o bruto e eu edito no seu padrão. Você revisa cada corte, legenda e efeito antes de baixar.</p></div>
        <div class="cr-acoes-topo"><button class="btn" type="button" id="ed-ver-padrao">Meu padrão de edição</button></div></header>
      <div class="ed-projeto" id="ed-projeto"></div>
      <ol class="ed-passos" id="ed-passos" aria-label="Passos da edição"></ol>
      <div class="rr-wrap">
        <aside class="rr-lado">
          <div class="ed-tela rr-player"><canvas id="ed-canvas" width="1080" height="1920"></canvas><div class="ed-vazio" id="ed-vazio">${ic.filme}<span>A prévia aparece aqui</span></div><span class="rr-relogio" id="ed-relogio">0:00,0</span><div class="ed-trab" id="ed-trab" hidden></div></div>
          <div class="ed-controles" id="ed-controles"></div>
          <p class="rr-modo" id="ed-modo"></p>
          <section class="ed-cartao rr-ajustar" id="ed-ajustar" hidden></section>
          <div id="ed-final"></div>
        </aside>
        <div class="rr-principal">
          <section class="rr-linha rr-linha-topo" id="ed-linha" hidden aria-label="Linha do tempo"></section>
          <nav class="rr-abas" role="tablist" aria-label="Etapas da edição" id="ed-abas"></nav>
          <div class="rr-painel" data-painel="video">
            <section class="ed-cartao">
              <label class="ed-soltar" id="ed-soltar">${ic.filme}<b>Enviar vídeo bruto</b><small>Pode mandar vários clipes, eles entram na ordem. MP4 ou MOV.</small><input type="file" id="ed-arquivo" accept="video/*,.mov,.mp4,.m4v,.webm" multiple hidden></label>
              <div id="ed-clipes"></div>
              <input class="entrada" id="ed-tema" placeholder="Tema ou marca do vídeo (opcional, ajuda no título)">
              <details class="ed-roteiro" id="ed-roteiro-box"${st.roteiro ? " open" : ""}><summary><b>Seu roteiro</b> <small>(opcional, deixa a edição bem mais certeira)</small></summary>
                <select class="entrada" id="ed-puxar" aria-label="Puxar roteiro do Painel de conteúdo"><option value="">Puxar de um post do Painel de conteúdo…</option></select>
                <textarea class="entrada" id="ed-roteiro" rows="9" placeholder="Cole aqui o que você idealizou: as falas, as cenas, o voice-over e o texto na tela. Ex.:
GANCHO: Motivos plausíveis para trocar de shampoo [close no frasco na mão]
CENA 2: aplicando no cabelo, voice-over: ...
CTA: comenta CABELO que eu te mando o link">${esc(st.roteiro)}</textarea>
                <small class="ed-obs">Eu comparo com o que você gravou: fico com a tomada mais fiel ao roteiro, uso o seu gancho no título, transformo as direções de cena em b-roll e efeitos e te aviso se faltou gravar algum bloco.</small>
              </details>
              <label class="ed-rotulo" for="ed-pedidos">O que você quer nesta edição</label>
              <textarea class="entrada" id="ed-pedidos" rows="3" placeholder="Ex.: comece direto na fala do produto; legenda maior; muitos efeitos de brilho; zoom quando eu mostrar o frasco; corte o final depois do CTA.">${esc(st.pedidos)}</textarea>
              <div class="ed-ref-rapido" id="ed-ref-rapido"></div>
              <div class="ed-formato-esc" role="group" aria-label="Formato do vídeo"><span class="ed-rotulo">Formato do vídeo</span><button type="button" class="ed-fmt" data-formato="vertical">▯ Vertical 9:16</button><button type="button" class="ed-fmt" data-formato="horizontal">▭ Horizontal 16:9</button></div>
              <button class="btn btn-principal ed-botao-grande" type="button" id="ed-editar">${ic.brilho}Editar automático</button>
              <ol class="ed-etapas" id="ed-etapas"></ol>
            </section>
            <section class="ed-cartao" id="ed-ouvi" hidden></section>
          </div>
          <div class="rr-painel" data-painel="referencia" hidden><section class="ed-cartao" id="ed-referencia"></section></div>
          <div class="rr-painel" data-painel="estilos" hidden><section class="ed-cartao" id="ed-estilos"></section></div>
          <div class="rr-painel" data-painel="cortes" hidden><section class="ed-cartao" id="ed-cortes" hidden></section><p class="rr-vazio">Os cortes aparecem aqui depois que eu editar o vídeo.</p></div>
          <div class="rr-painel" data-painel="textos" hidden><section class="ed-cartao" id="ed-camadas"></section></div>
          <div class="rr-painel" data-painel="legendas" hidden><section class="ed-cartao" id="ed-legendas" hidden></section><p class="rr-vazio">As legendas aparecem aqui depois que eu editar o vídeo.</p></div>
          <div class="rr-painel" data-painel="visual" hidden><section class="ed-cartao" id="ed-ajustes" hidden></section><p class="rr-vazio">Título, fonte, cor e ritmo aparecem aqui depois que eu editar o vídeo.</p></div>
          <div class="rr-painel" data-painel="sons" hidden><div class="rr-plano" id="ed-plano"></div></div>
          <div class="rr-painel" data-painel="efeitos" hidden><section class="ed-cartao" id="ed-efeitos"></section></div>
          <div class="rr-painel" data-painel="capa" hidden><section class="ed-cartao ed-capa" id="ed-capa" hidden></section><p class="rr-vazio">A capa aparece aqui depois que eu editar o vídeo.</p></div>
          <div class="rr-painel" data-painel="storyboard" hidden><section class="ed-cartao" id="ed-storyboard"></section></div>
          <div class="rr-painel" data-painel="variacoes" hidden><section class="ed-cartao" id="ed-variacoes"></section></div>
          <div class="rr-painel" data-painel="carrossel" hidden><section class="ed-cartao" id="ed-carrossel"></section></div>
        </div>
      </div>
      <div id="ed-videos" class="ed-videos" aria-hidden="true"></div>
    </div>`;
    const entrada = $("#ed-arquivo", sec);
    entrada.addEventListener("change", (e) => { const fs = [...e.target.files]; e.target.value = ""; adicionarClipes(fs); });
    const soltar = $("#ed-soltar", sec);
    soltar.addEventListener("dragover", (e) => { e.preventDefault(); soltar.classList.add("arrastando"); });
    soltar.addEventListener("dragleave", () => soltar.classList.remove("arrastando"));
    soltar.addEventListener("drop", (e) => { e.preventDefault(); soltar.classList.remove("arrastando"); adicionarClipes([...e.dataTransfer.files]); });
    $("#ed-editar", sec).addEventListener("click", editar);
    $$("[data-formato]", sec).forEach((b) => b.addEventListener("click", () => { st.opc.formato = b.dataset.formato; st.opc.formatoEscolhido = true; prepararCanvas(); if (st.segs.length) redesenhar(); pintar(); salvarDepois(); }));
    $("#ed-tema", sec).addEventListener("input", (e) => { st.tema = e.target.value; salvarDepois(); });
    $("#ed-pedidos", sec).addEventListener("input", (e) => { st.pedidos = e.target.value; salvarDepois(); });
    carregarProjetos();
    $("#ed-roteiro", sec).addEventListener("input", (e) => { st.roteiro = e.target.value; try { localStorage.setItem("ed-roteiro", st.roteiro); } catch (er) { /* sem armazenamento */ } salvarDepois(); });
    $("#ed-puxar", sec).addEventListener("change", (e) => {
      const p = st.posts.find((x) => String(x.id) === e.target.value); e.target.value = "";
      if (!p) return;
      const texto = [p.hook && "GANCHO: " + p.hook, p.desenvolvimento, p.cta && "CTA: " + p.cta].filter(Boolean).join("\n");
      if (st.roteiro.trim() && !confirm("Trocar o roteiro que está no campo por este?")) return;
      st.roteiro = texto; $("#ed-roteiro", sec).value = texto; try { localStorage.setItem("ed-roteiro", texto); } catch (er) { /* sem armazenamento */ }
      if (!st.tema && p.tema) { st.tema = p.tema; $("#ed-tema", sec).value = p.tema; }
      $("#ed-roteiro-box", sec).open = true;
    });
    carregarPosts();
    $("#ed-ver-padrao", sec).addEventListener("click", abrirPadrao);
    prepararCanvas();
  }

  // ---------- abas (visual reel review) ----------
  const ABAS = [["video", "Vídeo"], ["referencia", "Referência"], ["estilos", "Estilos"], ["storyboard", "Storyboard"], ["cortes", "Cortes"], ["textos", "Textos"], ["legendas", "Legendas"], ["visual", "Visual"], ["sons", "Sons e dicas"], ["efeitos", "Efeitos"], ["capa", "Capa"], ["variacoes", "Variações"], ["carrossel", "Carrossel"]];
  const ABAS_SEMPRE = ["video", "referencia", "estilos", "efeitos"]; // abrem antes de editar (escolher o estilo e conhecer os efeitos)
  function pintarAbas() {
    const nav = $("#ed-abas"); if (!nav) return;
    const pronto = st.segs.length > 0;
    if (!pronto && !ABAS_SEMPRE.includes(st.aba)) st.aba = "video";
    const conta = { textos: st.camadas.length, cortes: palavrasRevisao().filter((w) => cortada(w) || tiradaPelaIA(w)).length, legendas: st.legendas.length, sons: st.efeitos.length };
    nav.innerHTML = ABAS.map(([k, t]) => `<button type="button" role="tab" class="rr-aba" data-aba="${k}" aria-selected="${st.aba === k}" ${!ABAS_SEMPRE.includes(k) && !pronto ? "disabled" : ""}>${t}${pronto && conta[k] ? `<span class="rr-n">${conta[k]}</span>` : ""}</button>`).join("");
    $$("[data-aba]", nav).forEach((b) => b.addEventListener("click", () => irAba(b.dataset.aba)));
    $$(".rr-painel").forEach((pn) => { pn.hidden = pn.dataset.painel !== st.aba; });
  }
  function irAba(k) {
    if (k !== "variacoes" && st.variBase) voltarOriginal();
    st.aba = k; pintarAbas(); pintarPassos();
    if (k === "textos") pintarCamadas();
    if (k === "capa") desenharCapa();
    if (k === "estilos") pintarEstilos();
    if (k === "efeitos") pintarEfeitos();
    if (k === "referencia") pintarReferencia();
    if (k === "carrossel") pintarCarrossel();
    if (k === "storyboard") pintarStoryboard(true);
    if (k === "variacoes") pintarVariacoes(true);
  }

  // ---------- passos no topo: 1 vídeo, 2 estilo, 3 revisar, 4 baixar ----------
  function pintarPassos() {
    const ol = $("#ed-passos"); if (!ol) return;
    const pronto = st.segs.length > 0;
    const passos = [
      { n: 1, t: "Vídeo", sub: st.clipes.length ? `${st.clipes.length} ${st.clipes.length > 1 ? "clipes" : "clipe"}` : "envie o bruto", feito: st.clipes.length > 0, aba: "video" },
      { n: 2, t: "Estilo", sub: nomeDoEstilo(st.estiloAtivo) || "escolha um look", feito: Boolean(st.estiloAtivo), aba: "estilos" },
      { n: 3, t: "Revisar", sub: pronto ? "cortes, legendas e sons" : "depois de editar", feito: pronto, aba: pronto ? "cortes" : null },
      { n: 4, t: "Baixar", sub: pronto ? "MP4, legenda e capa" : "no fim", feito: false, aba: null, baixar: pronto },
    ];
    const atual = !st.clipes.length ? 1 : !pronto ? (st.aba === "estilos" ? 2 : st.estiloAtivo ? 1 : 2) : 3;
    ol.innerHTML = passos.map((p) => `<li><button type="button" class="ed-passo${p.feito ? " feito" : ""}${p.n === atual ? " agora" : ""}" data-passo-aba="${p.aba || ""}" ${p.baixar ? 'data-passo-baixar="1"' : ""} ${!p.aba && !p.baixar ? "disabled" : ""}><span class="ed-passo-n">${p.feito ? "✓" : p.n}</span><span><b>${p.t}</b><small>${esc(p.sub)}</small></span></button></li>`).join("");
    $$("[data-passo-aba]", ol).forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.passoBaixar) { const f = $("#ed-final"); if (f) f.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
      if (b.dataset.passoAba) irAba(b.dataset.passoAba);
    }));
  }

  // ---------- estilos: prontos + os meus (tabela configuracoes, chave "estilos_edicao") ----------
  const todosEstilos = () => [...ESTILOS_PRONTOS.map((e) => ({ ...e, pronto: true })), ...st.meusEstilos];
  function nomeDoEstilo(id) { const e = todosEstilos().find((x) => x.id === id); return e ? e.nome : ""; }
  async function carregarEstilos() {
    let lista = null;
    try {
      const { data } = await banco().from("configuracoes").select("valor").eq("chave", "estilos_edicao").maybeSingle();
      if (data && data.valor) lista = typeof data.valor === "string" ? JSON.parse(data.valor) : data.valor;
    } catch (e) { /* tenta o navegador */ }
    if (!Array.isArray(lista)) { try { lista = JSON.parse(localStorage.getItem("ed-meus-estilos") || "[]"); } catch (e) { lista = []; } }
    st.meusEstilos = (Array.isArray(lista) ? lista : []).filter((e) => e && e.id && e.opc);
    pintarEstilos(); pintarPassos();
  }
  async function salvarEstilos() {
    const valor = JSON.stringify(st.meusEstilos);
    try { localStorage.setItem("ed-meus-estilos", valor); } catch (e) { /* sem armazenamento */ }
    const { error } = await banco().from("configuracoes").upsert({ chave: "estilos_edicao", valor }, { onConflict: "chave" });
    if (error) throw new Error(error.message);
    // confere se gravou de verdade (não só na tela)
    const { data, error: e2 } = await banco().from("configuracoes").select("valor").eq("chave", "estilos_edicao").maybeSingle();
    if (e2 || !data || String(typeof data.valor === "string" ? data.valor : JSON.stringify(data.valor)) !== valor) throw new Error("o banco não confirmou a gravação");
  }
  function aplicarEstilo(id) {
    const e = todosEstilos().find((x) => x.id === id); if (!e) return;
    const opc = { ...(e.pronto ? BASE_ESTILO : {}), ...e.opc };
    if (e.pronto && opc.fonteLeg === "arimo" && st.minhaFonte && id === "padrao") opc.fonteLeg = "minha";
    if (opc.fonteLeg === "minha" && !st.minhaFonte) opc.fonteLeg = "arimo";
    st.estHist.push(fotoEstilo()); marcarDesfazer("est"); st.estMsg = `Você escolheu o estilo "${e.nome}"`;
    Object.assign(st.opc, opc);
    st.estiloAtivo = id; try { localStorage.setItem("ed-estilo-ativo", id); } catch (er) { /* sem armazenamento */ }
    if (st.segs.length) { remontar(); sonsDoTitulo(); pintarPlano(); toast(`Estilo "${e.nome}" aplicado. Mude o que quiser na aba Visual.`); }
    else { guardarOpc(); pintar(); toast(`Estilo "${e.nome}" escolhido. Ele entra quando eu editar o vídeo.`); }
    pintarEstilos();
  }
  function amostraEstilo(e) {
    const o = { ...(e.pronto ? BASE_ESTILO : {}), ...e.opc };
    const fonte = fonteLeg(Math.round(15 * (o.tamLeg || 1)), o.fonteLeg === "minha" && !st.minhaFonte ? "arimo" : o.fonteLeg);
    const txt = o.maiusculas ? "OLHA SÓ ISSO" : "olha só isso";
    const sombra = o.sombra === "dura" ? "2px 2px 0 rgba(0,0,0,.55)" : "0 1px 6px rgba(0,0,0,.55)";
    return `<span class="ed-est-amostra" aria-hidden="true"><span class="ed-est-tit">${o.titulo === false ? "" : "meu gancho"}</span><span class="ed-est-leg" style="font:${esc(fonte)};color:${o.corLegenda || "#fff"};text-shadow:${sombra}">${txt}</span></span>`;
  }
  const RESUMO_SONS = Object.fromEntries(QTD_SONS); const RESUMO_DINA = { calmo: "calmo", normal: "ritmo normal", dinamico: "dinâmico" };
  function resumoEstilo(o) { return [(FONTES_LEG[o.fonteLeg] || "").split(" (")[0], (RESUMO_SONS[o.sons] || "").split(" (")[0].toLowerCase() + " sons", RESUMO_DINA[o.dinamismo] || ""].filter((x) => x && x.trim() !== "sons").join(" · "); }
  function pintarEstilos() {
    const box = $("#ed-estilos"); if (!box) return;
    if (st.aba !== "estilos" && box.dataset.pintado) return;
    box.dataset.pintado = "1";
    const cartao = (e) => {
      const ativo = st.estiloAtivo === e.id, apagando = st.estiloApagar === e.id;
      return `<div class="ed-est${ativo ? " ativo" : ""}" data-est="${e.id}">
        <button type="button" class="ed-est-escolher" data-aplicar="${e.id}" aria-pressed="${ativo}">${amostraEstilo(e)}<span class="ed-est-info"><span class="ed-est-selo">${ativo ? "em uso" : e.pronto ? "pronto" : "meu estilo"}</span><b>${esc(e.nome)}</b><small>${esc(e.para || resumoEstilo(e.opc))}</small></span></button>
        ${e.pronto ? "" : `<div class="ed-est-acoes"><button type="button" class="btn" data-est-editar="${e.id}">Editar</button><button type="button" class="btn rr-perigo" data-est-apagar="${e.id}">${apagando ? "Confirmar: apagar" : "Apagar"}</button></div>`}
      </div>`;
    };
    const ed = st.estiloEditando ? st.meusEstilos.find((x) => x.id === st.estiloEditando) : null;
    box.innerHTML = `<div class="ed-titulo-linha"><h3 class="ed-titulo">Escolha um estilo</h3><span class="ed-sub">${st.estiloAtivo ? "em uso: " + esc(nomeDoEstilo(st.estiloAtivo)) : "nenhum escolhido"}</span></div>
      <p class="ed-obs">Cada estilo é a edição inteira de uma vez: fonte e cor da legenda, título, quantidade de sons, dinamismo, transição e ritmo. Toque para aplicar${st.segs.length ? " (o vídeo é remontado na hora)" : " (ele entra quando eu editar o vídeo)"}. Depois mude o que quiser na aba Visual e salve como seu.</p>
      <div class="ed-est-grade">${ESTILOS_PRONTOS.map((e) => cartao({ ...e, pronto: true })).join("")}</div>
      <div class="ed-titulo-linha"><h3 class="ed-titulo">Meus estilos</h3><span class="ed-sub">${st.meusEstilos.length || "nenhum ainda"}</span></div>
      ${st.meusEstilos.length ? `<div class="ed-est-grade">${st.meusEstilos.map(cartao).join("")}</div>` : `<p class="ed-obs">Ajuste a edição do jeito que você gosta (aba Visual) e salve aqui. Ele vira um estilo seu para os próximos vídeos.</p>`}
      ${htmlAjusteEstilo()}
      <div class="ed-est-salvar" id="ed-est-salvar-box">
        <label class="ed-rotulo" for="ed-est-nome">${ed ? `Editando "${esc(ed.nome)}"` : "Salvar os ajustes atuais como estilo"}</label>
        <div class="ed-est-linha"><input class="entrada" id="ed-est-nome" maxlength="40" placeholder="Nome do estilo (ex.: Publi Boticário)" value="${ed ? esc(ed.nome) : ""}">
        <button type="button" class="btn btn-principal" id="ed-est-salvar">${ed ? "Salvar alterações" : "Salvar como meu estilo"}</button>${ed ? `<button type="button" class="btn" id="ed-est-cancelar">Cancelar</button>` : ""}</div>
        ${ed ? `<label class="ed-chk"><input type="checkbox" id="ed-est-atual" checked> Trocar os ajustes deste estilo pelos ajustes atuais do editor</label>` : ""}
      </div>`;
    $$("[data-aplicar]", box).forEach((b) => b.addEventListener("click", () => { st.estiloApagar = null; aplicarEstilo(b.dataset.aplicar); }));
    ligarAjusteEstilo(box);
    $$("[data-est-editar]", box).forEach((b) => b.addEventListener("click", () => { st.estiloEditando = b.dataset.estEditar; st.estiloApagar = null; pintarEstilos(); const i = $("#ed-est-nome", box); if (i) i.focus(); }));
    $$("[data-est-apagar]", box).forEach((b) => b.addEventListener("click", async () => {
      const id = b.dataset.estApagar;
      if (st.estiloApagar !== id) { st.estiloApagar = id; pintarEstilos(); return; }
      const antes = st.meusEstilos; st.meusEstilos = st.meusEstilos.filter((x) => x.id !== id); st.estiloApagar = null;
      if (st.estiloEditando === id) st.estiloEditando = null;
      if (st.estiloAtivo === id) { st.estiloAtivo = ""; try { localStorage.removeItem("ed-estilo-ativo"); } catch (er) { /* sem armazenamento */ } }
      try { await salvarEstilos(); toast("Estilo apagado."); } catch (er) { st.meusEstilos = antes; toast("Não consegui apagar: " + er.message, true); }
      pintarEstilos(); pintarPassos();
    }));
    const cancelar = $("#ed-est-cancelar", box); if (cancelar) cancelar.addEventListener("click", () => { st.estiloEditando = null; pintarEstilos(); });
    $("#ed-est-salvar", box).addEventListener("click", async () => {
      const nome = $("#ed-est-nome", box).value.trim();
      if (!nome) { toast("Dê um nome para o estilo.", true); $("#ed-est-nome", box).focus(); return; }
      const atuais = Object.fromEntries(CHAVES_ESTILO.map((k) => [k, st.opc[k]]));
      const antes = st.meusEstilos.map((x) => ({ ...x }));
      let id;
      if (ed) { id = ed.id; st.meusEstilos = st.meusEstilos.map((x) => x.id === id ? { ...x, nome, opc: $("#ed-est-atual", box) && $("#ed-est-atual", box).checked ? atuais : x.opc } : x); }
      else { id = "meu-" + uid(); st.meusEstilos = [...st.meusEstilos, { id, nome, opc: atuais }]; }
      const bt = $("#ed-est-salvar", box); bt.disabled = true; bt.textContent = "Salvando…";
      try {
        await salvarEstilos();
        st.estiloEditando = null; st.estiloAtivo = id; try { localStorage.setItem("ed-estilo-ativo", id); } catch (er) { /* sem armazenamento */ }
        toast(ed ? `Estilo "${nome}" atualizado.` : `Estilo "${nome}" salvo. Ele aparece em Meus estilos.`);
      } catch (er) { st.meusEstilos = antes; toast("Não consegui salvar o estilo: " + er.message, true); }
      pintarEstilos(); pintarPassos();
    });
  }

  // ---------- quadro de efeitos: busca, categorias e "pôr aqui" no ponto da agulha ----------
  function catalogoEfeitos() {
    const o = st.opc, lista = [];
    Object.entries(EFEITOS).forEach(([k, t]) => lista.push({ cat: "sons", id: "som-" + k, nome: t, desc: DESC_SONS[k] || "", prev: "som", som: k, acao: "som" }));
    lista.push({ cat: "camera", id: "zoom", nome: "Zoom de ênfase", desc: "Entra um pouco mais perto no ponto da agulha e assenta", prev: "zoom", acao: "zoom" });
    lista.push({ cat: "camera", id: "flash", nome: "Flash branco", desc: "Clarão rápido (0,1 s), bom no corte para o produto", prev: "flash", acao: "flash" });
    lista.push({ cat: "camera", id: "dividir", nome: "Dividir plano", desc: "Separa o plano no ponto da agulha para apagar ou trocar", prev: "dividir", acao: "dividir" });
    lista.push({ cat: "camera", id: "zoomCortes", nome: "Zoom alternado nos cortes", desc: "100% e 110% alternando, esconde o pulo do jump cut", prev: "zoom", liga: "zoomCortes", ativo: o.zoomCortes });
    lista.push({ cat: "camera", id: "zoomEnfase", nome: "Zoom nas frases de ênfase", desc: "A IA acha as frases fortes e aproxima", prev: "zoom", liga: "zoomEnfase", ativo: o.zoomEnfase });
    lista.push({ cat: "camera", id: "tremer", nome: "Tremidinha no impacto", desc: "Treme de leve nos momentos fortes", prev: "tremer", liga: "tremer", ativo: o.tremer });
    lista.push({ cat: "camera", id: "flashTroca", nome: "Flash em toda troca de cena", desc: "Liga o flash automático entre os clipes", prev: "flash", liga: "flash", ativo: o.flash });
    [["nenhuma", "Corte seco", "Sem transição, só o jump cut"], ["punch", "Zoom rápido (punch)", "Aproxima rápido no corte, o seu padrão"], ["deslize", "Punch + deslize", "Zoom rápido e um deslize na troca de cena"]].forEach(([k, t, d]) => lista.push({ cat: "transicao", id: "tr-" + k, nome: t, desc: d, prev: k === "nenhuma" ? "corte" : k === "punch" ? "zoom" : "deslize", opc: ["transicao", k], ativo: o.transicao === k, remonta: false }));
    [["normal", "Ritmo normal", "Deixa um respiro entre as frases"], ["rapido", "Ritmo rápido", "Corta os respiros"], ["turbo", "Ritmo turbo", "Sem nenhuma pausa"]].forEach(([k, t, d]) => lista.push({ cat: "transicao", id: "ritmo-" + k, nome: t, desc: d, prev: "corte", opc: ["ritmo", k], ativo: (o.ritmo || "rapido") === k, remonta: true }));
    Object.entries(FONTES_LEG).filter(([k]) => k !== "minha" || st.minhaFonte).forEach(([k, t]) => lista.push({ cat: "legenda", id: "fonte-" + k, nome: k === "minha" ? st.minhaFonte : t.split(" (")[0], desc: k === "minha" ? "A fonte que você enviou" : (t.match(/\((.+)\)/) || [, ""])[1], prev: "fonte", fonte: k, opc: ["fonteLeg", k], ativo: o.fonteLeg === k, remonta: false, soCapcut: true }));
    [1, 2, 3, 4].forEach((n) => lista.push({ cat: "legenda", id: "por-" + n, nome: `${n} ${n > 1 ? "palavras" : "palavra"} por vez`, desc: n === 1 ? "Uma palavra no meio da tela" : n === 3 ? "O seu padrão" : "", prev: "palavras", n, opc: ["porLegenda", n], ativo: Number(o.porLegenda) === n, remonta: true, soCapcut: true }));
    Object.entries(ESTILOS).filter(([k]) => k !== "caixa").forEach(([k, t]) => lista.push({ cat: "legenda", id: "estleg-" + k, nome: t.split(" (")[0], desc: (t.match(/\((.+)\)/) || [, "Estilo da legenda"])[1], prev: "fonte", fonte: k === "minimal" ? "poppins" : k === "bold" ? "montserrat" : o.fonteLeg, opc: ["estilo", k], ativo: o.estilo === k, remonta: true }));
    Object.entries(TITULOS).filter(([k]) => k !== "caixa" && k !== "frase").forEach(([k, t]) => lista.push({ cat: "titulo", id: "tit-" + k, nome: t.split(" (")[0].split(",")[0], desc: (t.match(/\((.+)\)/) || [, t.split(", ")[1] || ""])[1], prev: "titulo", opc: ["estiloTitulo", k], ativo: o.estiloTitulo === k, remonta: false, titulo: true }));
    lista.push({ cat: "titulo", id: "sonsTitulo", nome: "Som na entrada do título", desc: "Pop (ou clique em cada parte) quando o título aparece", prev: "som", som: "pop", liga: "sonsTitulo", ativo: o.sonsTitulo !== false });
    return lista;
  }
  function filtrarEfeitos() {
    const q = st.fxBusca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const nomeCat = Object.fromEntries(CATS_FX);
    return catalogoEfeitos().filter((f) => (st.fxCat === "todos" || f.cat === st.fxCat) && (!q || (f.nome + " " + f.desc + " " + nomeCat[f.cat]).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q)));
  }
  function previaEfeito(f) {
    if (f.prev === "fonte") return `<span class="ed-fx-prev ed-fx-p-fonte" aria-hidden="true"><span style="font:${esc(fonteLeg(17, f.fonte === "minha" && !st.minhaFonte ? "arimo" : f.fonte))};color:${st.opc.corLegenda || "#fff"}">olha só</span></span>`;
    if (f.prev === "palavras") return `<span class="ed-fx-prev ed-fx-p-fonte" aria-hidden="true"><span style="font:${esc(fonteLeg(14))};color:${st.opc.corLegenda || "#fff"}">${["olha", "olha só", "olha só isso", "olha só isso aqui"][f.n - 1]}</span></span>`;
    if (f.prev === "titulo") return `<span class="ed-fx-prev ed-fx-p-titulo" aria-hidden="true"><span>meu gancho</span></span>`;
    if (f.prev === "som") return `<span class="ed-fx-prev ed-fx-p-som" aria-hidden="true">${ic.som}<i></i><i></i><i></i><i></i><i></i></span>`;
    return `<span class="ed-fx-prev ed-fx-p-${f.prev}" aria-hidden="true"><span class="ed-fx-pessoa"></span></span>`;
  }
  function pintarGradeEfeitos() {
    const grade = $("#ed-fx-grade"); if (!grade) return;
    const pronto = st.segs.length > 0, lista = filtrarEfeitos();
    const porCat = CATS_FX.filter(([k]) => k !== "todos").map(([k, t]) => [k, t, lista.filter((f) => f.cat === k)]).filter(([, , l]) => l.length);
    grade.innerHTML = !lista.length ? `<p class="rr-vazio">Nada com "${esc(st.fxBusca)}". Tente "zoom", "brilho", "legenda"...</p>` : porCat.map(([k, t, l]) => `<h4 class="ed-fx-cat">${t} <span>${l.length}</span></h4><div class="ed-fx-lista">${l.map((f) => {
      const desligado = f.soCapcut && st.opc.estilo !== "capcut";
      const botoes = f.acao ? `${f.som ? `<button type="button" class="btn" data-fx-ouvir="${f.som}">${ic.play}Ouvir</button>` : ""}<button type="button" class="btn btn-principal" data-fx-por="${f.id}" ${pronto ? "" : 'disabled title="Edite o vídeo primeiro"'}>${ic.mais}Pôr aqui</button>`
        : f.liga ? `${f.som ? `<button type="button" class="btn" data-fx-ouvir="${f.som}">${ic.play}Ouvir</button>` : ""}<button type="button" class="btn${f.ativo ? " btn-principal" : ""}" data-fx-liga="${f.liga}" aria-pressed="${Boolean(f.ativo)}">${f.ativo ? "Ligado" : "Ligar"}</button>`
        : `<button type="button" class="btn${f.ativo ? " btn-principal" : ""}" data-fx-opc="${f.id}" aria-pressed="${Boolean(f.ativo)}" ${desligado ? 'disabled title="Só no estilo de legenda CapCut"' : ""}>${f.ativo ? "Em uso" : "Usar"}</button>`;
      return `<div class="ed-fx${f.ativo ? " ativo" : ""}" data-fx="${f.id}">${previaEfeito(f)}<div class="ed-fx-txt"><b>${esc(f.nome)}</b>${f.desc ? `<small>${esc(f.desc)}</small>` : ""}</div><div class="ed-fx-botoes">${botoes}</div></div>`;
    }).join("")}</div>`).join("");
    const cat = catalogoEfeitos(), achar = (id) => cat.find((x) => x.id === id);
    $$("[data-fx-ouvir]", grade).forEach((b) => b.addEventListener("click", () => { audio(); if (ac.state === "suspended") ac.resume(); tocarEfeito(b.dataset.fxOuvir, ac.currentTime + 0.02, st.opc.vol); }));
    $$("[data-fx-por]", grade).forEach((b) => b.addEventListener("click", () => {
      const f = achar(b.dataset.fxPor); if (!f || !st.segs.length) return;
      if (f.acao === "som") porSom(f.som); else if (f.acao === "zoom") porZoom(); else if (f.acao === "flash") porFlash(); else if (f.acao === "dividir") dividir();
      toast(`${f.nome} em ${tempo(st.t)}. Toque nele na linha do tempo para ouvir ou tirar.`);
    }));
    $$("[data-fx-liga]", grade).forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.fxLiga; st.opc[k] = !st.opc[k];
      if (st.segs.length) { if (["zoomCortes", "zoomEnfase"].includes(k)) remontar(); else { if (k === "sonsTitulo") { sonsDoTitulo(); pintarPlano(); } guardarOpc(); pintar(); } } else guardarOpc();
      pintarGradeEfeitos();
    }));
    $$("[data-fx-opc]", grade).forEach((b) => b.addEventListener("click", () => {
      const f = achar(b.dataset.fxOpc); if (!f) return;
      st.opc[f.opc[0]] = f.opc[1];
      if (st.segs.length) { if (f.remonta) remontar(); else { if (f.titulo) { sonsDoTitulo(); pintarPlano(); if (!st.tocando) st.t = Math.min(st.t, 1.2); } guardarOpc(); pintar(); } } else guardarOpc();
      pintarGradeEfeitos();
    }));
  }
  function pintarEfeitos() {
    const box = $("#ed-efeitos"); if (!box) return;
    if (!box.dataset.pintado) {
      box.dataset.pintado = "1";
      box.innerHTML = `<div class="ed-titulo-linha"><h3 class="ed-titulo">Quadro de efeitos</h3><span class="ed-sub" id="ed-fx-conta"></span></div>
        <p class="ed-obs" id="ed-fx-dica"></p>
        <label class="ed-fx-busca"><svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><input class="entrada" id="ed-fx-busca" type="search" placeholder="Buscar: zoom, brilho, spray, legenda, título..." aria-label="Buscar efeito"></label>
        <div class="ed-fx-cats" role="tablist" aria-label="Categorias de efeitos" id="ed-fx-cats"></div>
        <div id="ed-fx-grade"></div>`;
      const busca = $("#ed-fx-busca", box); busca.value = st.fxBusca;
      busca.addEventListener("input", () => { st.fxBusca = busca.value; pintarGradeEfeitos(); pintarCatsEfeitos(); });
    }
    if (st.aba !== "efeitos" && box.dataset.cheio) return;
    box.dataset.cheio = "1";
    $("#ed-fx-dica", box).innerHTML = st.segs.length ? `Leve a agulha até o ponto do vídeo (play, barra ou linha do tempo) e toque em <b>Pôr aqui</b>. Agora ela está em <b>${tempo(st.t)}</b>.` : "Ouça os sons e escolha legenda, título e transições agora. Os botões <b>Pôr aqui</b> funcionam depois que eu editar o vídeo.";
    pintarCatsEfeitos(); pintarGradeEfeitos();
  }
  function pintarCatsEfeitos() {
    const nav = $("#ed-fx-cats"); if (!nav) return;
    const conta = filtrarEfeitos().length;
    const tot = catalogoEfeitos(); const c = $("#ed-fx-conta"); if (c) c.textContent = `${conta} de ${tot.length}`;
    nav.innerHTML = CATS_FX.map(([k, t]) => `<button type="button" role="tab" class="ed-fx-chip" data-fx-cat="${k}" aria-selected="${st.fxCat === k}">${t}<span>${k === "todos" ? tot.length : tot.filter((f) => f.cat === k).length}</span></button>`).join("");
    $$("[data-fx-cat]", nav).forEach((b) => b.addEventListener("click", () => { st.fxCat = b.dataset.fxCat; pintarCatsEfeitos(); pintarGradeEfeitos(); }));
  }

  // ---------- ajustar o estilo (cores, fontes, tamanhos e onde fica cada coisa) ----------
  const CORES_LEG = ["#fff3b0", "#ffffff", "#fbf1e1", "#ffe45c", "#f6c6d0"];
  const fotoEstilo = () => Object.fromEntries(CHAVES_ESTILO.map((k) => [k, st.opc[k]]));
  const REMONTA = ["porLegenda", "estilo", "sons", "dinamismo", "ritmo", "zoomCortes", "zoomEnfase"];
  function mexerEstilo(mudancas, msg) {
    st.estHist.push(fotoEstilo()); marcarDesfazer("est"); if (st.estHist.length > 40) st.estHist.shift();
    Object.assign(st.opc, mudancas);
    st.estMsg = msg || "";
    if (st.segs.length && Object.keys(mudancas).some((k) => REMONTA.includes(k))) remontar();
    else { guardarOpc(); if (st.segs.length) { if ("fonteTitulo" in mudancas || "corTitulo" in mudancas || "alturaTitulo" in mudancas) { if (!st.tocando && st.t > DUR_TITULO - 0.3) st.t = 1; } redesenhar(); } }
    pintarEstilos();
  }
  function desfazerEstilo() {
    const f = st.estHist.pop(); if (!f) return;
    const remonta = REMONTA.some((k) => f[k] !== st.opc[k]);
    Object.assign(st.opc, f); st.estMsg = "Voltei o último ajuste.";
    if (st.segs.length && remonta) remontar(); else { guardarOpc(); redesenhar(); }
    pintarEstilos();
  }
  function htmlAjusteEstilo() {
    const o = st.opc, chip = (attr, val, ativo, rotulo, estilo) => `<button type="button" class="ed-aj-chip${ativo ? " ativo" : ""}" ${attr}="${esc(val)}" aria-pressed="${ativo}"${estilo ? ` style="font:${esc(estilo)}"` : ""}>${rotulo}</button>`;
    const bola = (attr, cor, ativo, rotulo) => `<button type="button" class="ed-aj-cor${ativo ? " ativa" : ""}" ${attr}="${cor}" aria-label="${rotulo}" title="${rotulo}" style="background:${cor || "transparent"}">${cor ? "" : "="}</button>`;
    const fontes = Object.entries(FONTES_LEG).filter(([k]) => k !== "minha" || st.minhaFonte);
    const tamAtual = (o.tamLeg || 1) < 0.93 ? "p" : (o.tamLeg || 1) > 1.12 ? "g" : "m";
    const nomeEst = nomeDoEstilo(st.estiloAtivo) || "Sem estilo escolhido";
    return `<div class="ed-aj" id="ed-aj">
      <div class="ed-titulo-linha"><h3 class="ed-titulo">Ajustar o estilo</h3><span class="ed-sub">vale para este vídeo e os próximos</span></div>
      <div class="ed-aj-amostra">${amostraEstilo({ pronto: false, opc: o })}<p class="ed-obs">${st.segs.length ? "Cada toque já muda a prévia do vídeo ao lado." : "Assim fica a legenda e o título. Depois de editar, cada toque já muda a prévia do vídeo."}</p></div>
      <div class="ed-aj-bloco"><h4>Cores</h4>
        <span class="ed-rotulo">Cor da legenda</span><div class="ed-aj-cores">${CORES_LEG.map((c) => bola("data-aj-corleg", c, o.corLegenda === c, "Legenda " + c)).join("")}<input type="color" id="ed-aj-corleg" value="${o.corLegenda || "#fff3b0"}" aria-label="Outra cor da legenda"></div>
        <span class="ed-rotulo">Cor do título</span><div class="ed-aj-cores">${bola("data-aj-cortit", "", !o.corTitulo, "Igual à legenda")}${CORES_LEG.map((c) => bola("data-aj-cortit", c, o.corTitulo === c, "Título " + c)).join("")}<input type="color" id="ed-aj-cortit" value="${o.corTitulo || o.corLegenda || "#fff3b0"}" aria-label="Outra cor do título"></div>
      </div>
      <div class="ed-aj-bloco"><h4>Fontes e tamanhos</h4>
        <span class="ed-rotulo">Fonte do título</span><div class="ed-aj-chips">${Object.entries(FONTES_TIT).map(([k, t]) => chip("data-aj-fontetit", k, (o.fonteTitulo || "dmserif") === k, esc(t), fonteTitulo(15, k))).join("")}</div>
        <span class="ed-rotulo">Fonte da legenda</span><div class="ed-aj-chips">${fontes.map(([k, t]) => chip("data-aj-fonteleg", k, o.fonteLeg === k, esc(k === "minha" ? st.minhaFonte : t.split(" (")[0]), fonteLeg(14, k))).join("")}</div>
        <span class="ed-rotulo">Tamanho da legenda</span><div class="ed-aj-chips ed-aj-seg">${[["p", 0.85, "Pequena"], ["m", 1, "Média"], ["g", 1.25, "Grande"]].map(([k, v, t]) => chip("data-aj-tam", v, tamAtual === k, t)).join("")}</div>
      </div>
      <div class="ed-aj-bloco"><h4>Onde fica cada coisa</h4>
        <span class="ed-rotulo">Legenda, de que lado do rosto</span><div class="ed-aj-chips ed-aj-seg">${[["centro", "No meio"], ["esquerda", "Esquerda"], ["direita", "Direita"]].map(([k, t]) => chip("data-aj-lado", k, (o.ladoLeg || "centro") === k, t)).join("")}</div>
        <div class="ed-aj-setas"><span>Título</span><button type="button" class="icone-btn" data-aj-mover="alturaTitulo" data-passo="-0.03" aria-label="Subir título">${ic.cima}</button><button type="button" class="icone-btn" data-aj-mover="alturaTitulo" data-passo="0.03" aria-label="Descer título">${ic.baixo}</button>
          <span>Legenda</span><button type="button" class="icone-btn" data-aj-mover="altura" data-passo="-0.03" aria-label="Subir legenda">${ic.cima}</button><button type="button" class="icone-btn" data-aj-mover="altura" data-passo="0.03" aria-label="Descer legenda">${ic.baixo}</button></div>
        <label class="ed-chk"><input type="checkbox" id="ed-aj-guias" ${st.guiasIG ? "checked" : ""}> Mostrar onde ficam os botões do Instagram (só na prévia, não sai no vídeo)</label>
        ${st.segs.length ? `<button type="button" class="btn" id="ed-aj-momento">Mostrar outro momento</button>` : ""}
      </div>
      <div class="ed-aj-barra"><div><b>${esc(nomeEst)}</b><small>${esc(st.estMsg || "Sem mudanças, o estilo como está.")}</small></div>
        <button type="button" class="btn" id="ed-aj-desfazer" ${st.estHist.length ? "" : "disabled"}>Desfazer</button>
        <button type="button" class="btn btn-principal" id="ed-aj-salvar">Salvar como meu estilo</button></div>
    </div>`;
  }
  function ligarAjusteEstilo(box) {
    const q = (sel, fn, ev = "click") => $$(sel, box).forEach((b) => b.addEventListener(ev, () => fn(b)));
    q("[data-aj-corleg]", (b) => mexerEstilo({ corLegenda: b.dataset.ajCorleg }, "Você mudou a cor da legenda"));
    q("[data-aj-cortit]", (b) => mexerEstilo({ corTitulo: b.dataset.ajCortit }, b.dataset.ajCortit ? "Você mudou a cor do título" : "Título na mesma cor da legenda"));
    const cl = $("#ed-aj-corleg", box); if (cl) cl.addEventListener("change", () => mexerEstilo({ corLegenda: cl.value }, "Você mudou a cor da legenda"));
    const ct = $("#ed-aj-cortit", box); if (ct) ct.addEventListener("change", () => mexerEstilo({ corTitulo: ct.value }, "Você mudou a cor do título"));
    q("[data-aj-fontetit]", (b) => mexerEstilo({ fonteTitulo: b.dataset.ajFontetit, estiloTitulo: "simples", titulo: true }, "Você mudou a fonte do título"));
    q("[data-aj-fonteleg]", (b) => mexerEstilo({ fonteLeg: b.dataset.ajFonteleg, estilo: "capcut" }, "Você mudou a fonte da legenda"));
    q("[data-aj-tam]", (b) => mexerEstilo({ tamLeg: Number(b.dataset.ajTam) }, "Você mudou o tamanho da legenda"));
    q("[data-aj-lado]", (b) => mexerEstilo({ ladoLeg: b.dataset.ajLado }, "Você mudou o lado da legenda"));
    q("[data-aj-mover]", (b) => {
      const k = b.dataset.ajMover, lim = k === "altura" ? [0.35, 0.88] : [0.1, 0.6], atual = Number(st.opc[k]) || (k === "altura" ? 0.52 : 0.24);
      mexerEstilo({ [k]: +Math.min(lim[1], Math.max(lim[0], atual + Number(b.dataset.passo))).toFixed(2) }, k === "altura" ? "Você mudou a altura da legenda" : "Você mudou a altura do título");
    });
    const gu = $("#ed-aj-guias", box); if (gu) gu.addEventListener("change", () => { st.guiasIG = gu.checked; redesenhar(); });
    const mo = $("#ed-aj-momento", box); if (mo) mo.addEventListener("click", () => irPara(Math.random() * Math.max(0.1, st.duracao - 0.2)));
    $("#ed-aj-desfazer", box).addEventListener("click", desfazerEstilo);
    $("#ed-aj-salvar", box).addEventListener("click", () => { const i = $("#ed-est-nome", box); if (i) { i.scrollIntoView({ behavior: "smooth", block: "center" }); i.focus(); } });
  }

  // ---------- "editando seu reel" por cima da prévia ----------
  function pintarTrabalhando() {
    const el = $("#ed-trab"); if (!el) return;
    if (!st.trabalhando) { el.hidden = true; return; }
    el.hidden = false;
    const ult = st.etapas[st.etapas.length - 1];
    el.innerHTML = `<div class="ed-trab-cartao"><span class="ed-trab-ic">${ic.brilho}</span><div><b>Editando seu reel</b><small>cortes · legendas · sons · ${esc(nomeDoEstilo(st.estiloAtivo) || "seu padrão")}</small><span class="ed-trab-barra"><i></i></span>${ult ? `<small class="ed-trab-agora">${esc(ult.texto)}</small>` : ""}</div></div>`;
  }

  async function chamarExtras(corpo) {
    const { data, error } = await banco().functions.invoke("editor-extras", { body: corpo });
    let msg = data && data.error;
    if (error) { try { msg = (await error.context.json()).error; } catch (e) { /* segue */ } msg = msg || "A função não respondeu agora."; }
    if (msg) throw new Error(msg);
    return data;
  }

  // ---------- referência: ela manda um vídeo e diz o que quer copiar ----------
  const FOCOS_REF = [["legenda", "Legenda"], ["titulo", "Título"], ["ritmo", "Ritmo dos cortes"], ["sons", "Efeitos sonoros"], ["zoom", "Zoom e dinamismo"], ["transicao", "Transições"]];
  const NOMES_OPC = { estilo: "estilo da legenda", fonteLeg: "fonte da legenda", fonteTitulo: "fonte do título", corLegenda: "cor da legenda", corTitulo: "cor do título", porLegenda: "palavras por legenda", tamLeg: "tamanho da legenda", maiusculas: "maiúsculas", sombra: "sombra", altura: "altura da legenda", ladoLeg: "lado da legenda", alturaTitulo: "altura do título", ritmo: "ritmo dos cortes", sons: "quantidade de sons", dinamismo: "dinamismo", transicao: "transição", zoomCortes: "zoom alternado nos cortes", zoomEnfase: "zoom na ênfase", flash: "flash na troca de cena", tremer: "tremidinha", titulo: "título", legenda: "legenda", efeitos: "efeitos sonoros", sonsTitulo: "som no título" };
  function valorLegivel(k, v) {
    if (typeof v === "boolean") return v ? "ligado" : "desligado";
    if (k === "fonteLeg") return (FONTES_LEG[v] || v).split(" (")[0];
    if (k === "fonteTitulo") return FONTES_TIT[v] || v;
    if (k === "sons") return (Object.fromEntries(QTD_SONS)[v] || v).split(" (")[0].toLowerCase();
    if (k === "dinamismo") return (Object.fromEntries(DINAMISMO)[v] || v).split(" (")[0].toLowerCase();
    if (k === "tamLeg") return v < 0.93 ? "menor" : v > 1.12 ? "maior" : "normal";
    if (k === "altura" || k === "alturaTitulo") return v < 0.4 ? "no alto" : v > 0.7 ? "embaixo" : "no meio";
    if (/^cor/.test(k)) return v ? `<span class="ed-ref-bola" style="background:${esc(v)}"></span>${esc(v)}` : "igual à legenda";
    return esc(String(v));
  }
  // a IA às vezes devolve ajustes que ela não pediu: fica só o que tem a ver com o que ela marcou ou escreveu
  const GRUPOS_REF = { legenda: ["estilo", "fonteLeg", "corLegenda", "porLegenda", "tamLeg", "maiusculas", "sombra", "altura", "ladoLeg", "legenda"], titulo: ["fonteTitulo", "corTitulo", "alturaTitulo", "titulo", "sonsTitulo"], ritmo: ["ritmo"], sons: ["sons", "efeitos", "sonsTitulo"], zoom: ["dinamismo", "zoomCortes", "zoomEnfase", "tremer", "flash"], transicao: ["transicao", "flash"] };
  const PALAVRAS_REF = { legenda: /legenda|fonte|letra|\bcor(es)?\b|palavra|caption/i, titulo: /t[ií]tulo|gancho|texto de cima/i, ritmo: /corte|ritmo|r[aá]pid|pausa|respiro/i, sons: /som|sons|efeito|whoosh|woosh|pop|ding|m[uú]sica/i, zoom: /zoom|din[aâ]mic|tremid|flash|movimento/i, transicao: /transi[cç]/i };
  function filtrarOpcRef(opc, focos, pedido) {
    const grupos = new Set(focos || []);
    Object.entries(PALAVRAS_REF).forEach(([g, re]) => { if (re.test(pedido || "")) grupos.add(g); });
    const ok = grupos.size ? new Set([...grupos].flatMap((g) => GRUPOS_REF[g] || [])) : null;
    const pedeSem = (re) => new RegExp("(sem|tira|tirar|nada de)\\s+(o |a |os |as )?" + re, "i").test(pedido || "");
    const fora = { titulo: "t[ií]tulo", legenda: "legenda", efeitos: "(som|sons|efeito)" };
    return Object.fromEntries(Object.entries(opc).filter(([k, v]) => (!ok || ok.has(k)) && !(v === false && fora[k] && !pedeSem(fora[k])) && st.opc[k] !== v));
  }
  let refVideo = null;
  function trocarRefArquivo(arq) {
    if (!arq) return;
    if (st.refUrl) URL.revokeObjectURL(st.refUrl);
    st.refArq = arq; st.refUrl = URL.createObjectURL(arq); st.ref = null; st.refEtapas = []; pintarReferencia(true);
  }
  function etapaRef(texto, estado) { const ult = st.refEtapas[st.refEtapas.length - 1]; if (ult && ult.estado === "andando") ult.estado = "ok"; st.refEtapas.push({ texto, estado: estado || "andando" }); const ol = $("#ed-ref-etapas"); if (ol) ol.innerHTML = st.refEtapas.map((e) => `<li class="${e.estado}">${esc(e.texto)}</li>`).join(""); }
  const mediana = (l) => { const a = [...l].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; };
  async function analisarReferencia() {
    if (!st.refArq || st.refTrab) return;
    st.refTrab = true; st.refEtapas = []; pintarReferencia(true);
    try {
      const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = st.refUrl;
      v.style.cssText = "position:fixed;left:-9999px;width:2px;height:2px"; document.body.appendChild(v); refVideo = v;
      await new Promise((ok, falha) => { v.onloadeddata = ok; v.onerror = () => falha(new Error("Não consegui abrir esse vídeo aqui. Tente um MP4.")); setTimeout(ok, 8000); });
      try { await v.play(); v.pause(); } catch (e) { /* segue */ }
      const dur = Math.min(v.duration || 0, 180);
      if (!dur) throw new Error("Não consegui ler a duração desse vídeo.");
      // 1) cortes: compara quadros pequenos em tons de cinza
      etapaRef("Assistindo a referência e contando os cortes");
      const passo = Math.max(0.2, dur / 450), pw = 36, ph = 64;
      const pc = document.createElement("canvas"); pc.width = pw; pc.height = ph; const px = pc.getContext("2d", { willReadFrequently: true });
      const ir = async (t) => { v.currentTime = Math.min(dur - 0.05, Math.max(0, t)); await esperarEvento(v, "seeked"); };
      let ant = null; const difs = [];
      for (let t = 0; t < dur; t += passo) {
        await ir(t); px.drawImage(v, 0, 0, pw, ph);
        const d = px.getImageData(0, 0, pw, ph).data, g = new Float32Array(pw * ph);
        for (let i = 0; i < g.length; i++) g[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
        if (ant) { let s2 = 0; for (let i = 0; i < g.length; i++) s2 += Math.abs(g[i] - ant[i]); difs.push({ t, d: s2 / g.length }); }
        ant = g;
      }
      const med = mediana(difs.map((x) => x.d)), lim = Math.max(18, med * 4);
      const cortes = []; difs.forEach((x, i) => { if (x.d > lim && x.d >= (difs[i - 1] || x).d && x.d >= (difs[i + 1] || x).d && (!cortes.length || x.t - cortes[cortes.length - 1] > 0.35)) cortes.push(x.t); });
      const planos = [0, ...cortes, dur].map((t, i, l) => i ? t - l[i - 1] : null).filter((x) => x != null);
      // 2) quadros para a IA olhar (meio de cada trecho, nunca em cima de um corte)
      etapaRef("Separando quadros para olhar legenda, título e enquadramento");
      const alvos = [Math.min(0.8, dur * 0.1), dur * 0.25, dur * 0.45, dur * 0.65, dur * 0.85].map((t) => { const c = cortes.find((x) => Math.abs(x - t) < 0.3); return c ? c + 0.4 : t; });
      const qc = document.createElement("canvas"); qc.width = 360; qc.height = 640; const qx = qc.getContext("2d");
      const quadros = [], minis = [];
      for (const t of alvos) {
        await ir(t); const vw = v.videoWidth || 9, vh = v.videoHeight || 16, e2 = Math.max(360 / vw, 640 / vh);
        qx.fillStyle = "#000"; qx.fillRect(0, 0, 360, 640); qx.drawImage(v, (360 - vw * e2) / 2, (640 - vh * e2) / 2, vw * e2, vh * e2);
        quadros.push(qc.toDataURL("image/jpeg", 0.72));
        const mc = document.createElement("canvas"); mc.width = 108; mc.height = 192; mc.getContext("2d").drawImage(qc, 0, 0, 108, 192); minis.push({ t: +t.toFixed(1), src: mc.toDataURL("image/jpeg", 0.7) });
      }
      // 3) áudio: fala (Whisper) e sons fora da fala (estimativa pela energia)
      etapaRef("Ouvindo a fala e os sons");
      let palavras = [], sonsFora = null, musica = null;
      let mono = null;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext, tmp = new Ctx();
        const dec = await new Promise((ok, falha) => { st.refArq.arrayBuffer().then((b) => { const r = tmp.decodeAudioData(b, ok, falha); if (r && r.then) r.then(ok, falha); }, falha); }).finally(() => { try { tmp.close(); } catch (e) { /* segue */ } });
        const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(Math.min(dec.duration, dur) * 16000)), 16000);
        const src = off.createBufferSource(); src.buffer = dec; src.connect(off.destination); src.start();
        mono = (await off.startRendering()).getChannelData(0);
      } catch (e) { mono = null; }
      try {
        let partes = mono ? [{ blob: wav(mono, 16000), inicio: 0 }] : await audioDoArquivo(st.refArq);
        if (partes) for (const p of partes.slice(0, 1)) {
          const form = new FormData(); form.append("acao", "transcrever"); form.append("arquivo", p.blob, p.nome || "audio.wav");
          const r = await chamar(form); palavras.push(...(r.palavras || []).map((w) => ({ w: w.w, s: w.s + (p.inicio || 0), e: w.e + (p.inicio || 0) })));
        }
      } catch (e) { palavras = []; }
      if (mono) {
        const jan = 320, n = Math.floor(mono.length / jan), rms = new Float32Array(n);
        for (let i = 0; i < n; i++) { let s2 = 0; for (let j = i * jan; j < (i + 1) * jan; j++) s2 += mono[j] * mono[j]; rms[i] = Math.sqrt(s2 / jan); }
        const fala = (t) => palavras.some((w) => t >= w.s - 0.06 && t <= w.e + 0.06);
        const onsets = []; let foraAlto = 0, foraTot = 0;
        for (let i = 15; i < n; i++) {
          const t = i * jan / 16000; let m2 = 0; for (let j = i - 15; j < i; j++) m2 += rms[j]; m2 /= 15;
          if (!fala(t)) { foraTot++; if (rms[i] > 0.012) foraAlto++; if (rms[i] > 0.03 && rms[i] > m2 * 2.4 && (!onsets.length || t - onsets[onsets.length - 1] > 0.3)) onsets.push(t); }
        }
        sonsFora = onsets.length; musica = foraTot > 20 ? foraAlto / foraTot > 0.6 : null;
      }
      const ppm = palavras.length && dur ? Math.round(palavras.length / (dur / 60)) : null;
      let pausas = 0; palavras.forEach((w, i) => { if (i && w.s - palavras[i - 1].e > 0.4) pausas++; });
      const medidas = { duracao: +dur.toFixed(1), cortes: cortes.length, planoMedio: planos.length ? +(planos.reduce((a, b) => a + b, 0) / planos.length).toFixed(1) : null, palavras: palavras.length, ppm, pausas, sonsFora, sonsPorSeg: sonsFora ? +(dur / sonsFora).toFixed(1) : null, musica, temposQuadros: alvos.map((t) => +t.toFixed(1)) };
      // 4) IA: olha os quadros e traduz o que ela quer copiar em ajustes do editor
      etapaRef("Comparando com o que você quer copiar");
      const focos = st.refFocos.map((k) => (FOCOS_REF.find((f) => f[0] === k) || [k, k])[1]);
      const r = await chamarExtras({ acao: "referencia", pedido: st.refPedido, focos, medidas, fala: palavras.map((w) => w.w).join(" ").slice(0, 2500), quadros });
      st.ref = { ...r, opc: filtrarOpcRef(r.opc || {}, st.refFocos, st.refPedido), medidas, minis, nome: st.refArq.name, em: new Date().toISOString(), aplicado: false };
      etapaRef(r.visao ? "Pronto! Olhei os quadros, medi o ritmo e ouvi os sons." : "Pronto! Medi os cortes, o ritmo da fala e os sons. A imagem (legenda, fonte, cor) eu copio pelo que você escreveu: hoje não tem modelo que enxerga imagem na sua conta do Groq.", "ok");
      salvarDepois();
    } catch (e) {
      etapaRef(e.message || "Deu erro ao analisar.", "erro");
    } finally {
      if (refVideo) { refVideo.remove(); refVideo = null; }
      st.refTrab = false; pintarReferencia(true);
    }
  }
  async function aplicarReferencia() {
    const r = st.ref; if (!r) return;
    st.estHist.push(fotoEstilo()); marcarDesfazer("est");
    Object.assign(st.opc, r.opc || {}); guardarOpc();
    const regra = (r.regras || []).length ? "Seguir a referência (" + r.nome + "): " + r.regras.join("; ") : "";
    if (regra && !st.pedidos.includes(regra)) { st.pedidos = (st.pedidos.trim() ? st.pedidos.trim() + "\n" : "") + regra; const pd = $("#ed-pedidos"); if (pd) pd.value = st.pedidos; }
    r.aplicado = true; salvarDepois();
    if (st.segs.length) {
      remontar();
      if (regra) { toast("Apliquei o visual da referência. Agora ajustando sons, zooms e cortes…"); await corrigir("Seguir a referência que eu mandei: " + r.regras.join("; ")); }
      else toast("Apliquei o que copiei da referência. Dá o play.");
    } else toast("Guardei: o que copiei da referência entra quando eu editar o vídeo.");
    pintarReferencia(true);
  }
  async function lembrarReferencia() {
    const r = st.ref; if (!r || !(r.regras || []).length) return;
    const marca = "REFERÊNCIAS QUE ELA MANDOU (valem sempre):";
    const linhas = r.regras.filter((x) => !st.padrao.includes(x)).map((x) => "- " + x);
    if (!linhas.length) { toast("Essas regras já estão no seu padrão."); return; }
    const novo = st.padrao.includes(marca) ? st.padrao.replace(marca, marca + "\n" + linhas.join("\n")) : st.padrao.trim() + "\n\n" + marca + "\n" + linhas.join("\n");
    try { await salvarPadrao(novo); toast("Guardei no seu padrão de edição."); } catch (e) { toast("Não consegui guardar no padrão: " + e.message, true); }
  }
  async function estiloDaReferencia() {
    const r = st.ref; if (!r) return;
    const nome = (r.nome_estilo || "Estilo da referência").slice(0, 40);
    const opc = { ...fotoEstilo(), ...(r.opc || {}) };
    const antes = st.meusEstilos;
    const id = "meu-" + uid(); st.meusEstilos = [...st.meusEstilos, { id, nome, opc }];
    try { await salvarEstilos(); toast(`Salvei "${nome}" em Meus estilos.`); } catch (e) { st.meusEstilos = antes; toast("Não consegui salvar o estilo: " + e.message, true); }
  }
  // campo de anexar referência direto na aba Vídeo (ela pediu): o vídeo é analisado e aplicado quando ela clica em Editar
  function pintarRefRapido() {
    const box = $("#ed-ref-rapido"); if (!box) return;
    const nome = st.refArq ? st.refArq.name : st.ref ? (st.ref.nome || "referência analisada") : "";
    box.innerHTML = `<span class="ed-rotulo">Vídeo de referência <small>(opcional: a edição copia o jeito dele)</small></span>
      <div class="ed-ref-rapido-linha">${nome ? `<span class="ed-ref-rapido-nome">${ic.filme}<b>${esc(nome)}</b><small>${st.refTrab ? "analisando…" : st.ref ? (st.ref.aplicado ? "aplicada na edição" : "analisada, entra quando você editar") : "vou analisar quando você clicar em Editar"}</small></span>` : ""}
        <label class="btn ed-ref-rapido-btn">${ic.mais || ""}${nome ? "Trocar referência" : "Anexar vídeo de referência"}<input type="file" accept="video/*,.mov,.mp4,.m4v,.webm" hidden id="ed-ref-rapido-arq"></label>
        ${nome ? `<button type="button" class="login-link" id="ed-ref-rapido-ver">ver o que vou copiar</button><button type="button" class="login-link" id="ed-ref-rapido-tirar">tirar</button>` : ""}</div>`;
    $("#ed-ref-rapido-arq", box).addEventListener("change", (e) => { const a = e.target.files && e.target.files[0]; if (a) { trocarRefArquivo(a); pintarRefRapido(); toast("Referência anexada. Quando você clicar em Editar, eu analiso e sigo o jeito dela."); } });
    const ver = $("#ed-ref-rapido-ver", box); if (ver) ver.addEventListener("click", () => { st.aba = "referencia"; pintar(); });
    const tirar = $("#ed-ref-rapido-tirar", box); if (tirar) tirar.addEventListener("click", () => { if (st.refUrl) URL.revokeObjectURL(st.refUrl); st.refArq = null; st.refUrl = ""; st.ref = null; st.refEtapas = []; pintarReferencia(true); pintarRefRapido(); salvarDepois(); });
  }
  function pintarReferencia(forcar) {
    const box = $("#ed-referencia"); if (!box) return;
    if (!forcar && st.aba !== "referencia" && box.dataset.pintado) return;
    box.dataset.pintado = "1";
    const r = st.ref, pd = $("#ed-ref-pedido", box), rascunho = pd ? pd.value : st.refPedido;
    st.refPedido = rascunho;
    const m = r && r.medidas;
    box.innerHTML = `<div class="ed-titulo-linha"><h3 class="ed-titulo">Vídeo de referência</h3><span class="ed-sub">${r ? "analisado" : "copie o jeito de outro vídeo"}</span></div>
      <p class="ed-obs">Mande um Reels que você gostou e escreva o que quer copiar dele. Eu assisto, conto os cortes, ouço a fala e os sons e transformo isso em ajustes da sua edição. Para legenda, fonte e cor, descreva o que você vê (ex.: \"legenda branca, uma palavra por vez, no meio\"). Copio o jeito, nunca o conteúdo.</p>
      <div class="ed-ref-topo">
        <label class="ed-soltar ed-ref-soltar" id="ed-ref-soltar">${st.refUrl ? `<video src="${st.refUrl}" muted playsinline controls preload="metadata"></video>` : `${ic.filme}<b>Enviar vídeo de referência</b><small>MP4 ou MOV. Baixe o Reels e mande aqui (até 3 min).</small>`}<input type="file" id="ed-ref-arq" accept="video/*,.mov,.mp4,.m4v,.webm" hidden></label>
        <div class="ed-ref-campos">
          ${st.refArq ? `<p class="ed-ref-nome">${ic.filme}<b>${esc(st.refArq.name)}</b><button type="button" class="login-link" id="ed-ref-trocar">trocar</button></p>` : r ? `<p class="ed-ref-nome">${ic.filme}<b>${esc(r.nome || "Referência")}</b><small>(análise guardada no projeto)</small></p>` : ""}
          <span class="ed-rotulo">O que copiar</span>
          <div class="ed-aj-chips">${FOCOS_REF.map(([k, t]) => `<button type="button" class="ed-aj-chip${st.refFocos.includes(k) ? " ativo" : ""}" data-ref-foco="${k}" aria-pressed="${st.refFocos.includes(k)}">${t}</button>`).join("")}</div>
          <label class="ed-rotulo" for="ed-ref-pedido">Explique com as suas palavras</label>
          <textarea class="entrada" id="ed-ref-pedido" rows="4" placeholder="Ex.: quero a legenda igual, uma palavra por vez no meio da tela; os sons de whoosh nas trocas; o ritmo rápido dos cortes. Não quero as figurinhas.">${esc(rascunho)}</textarea>
          <button type="button" class="btn btn-principal ed-botao-grande" id="ed-ref-analisar" ${!st.refArq || st.refTrab ? "disabled" : ""}>${st.refTrab ? "Analisando…" : ic.brilho + (r ? "Analisar de novo" : "Analisar referência")}</button>
          ${!st.refArq && r ? `<small class="ed-obs">Para analisar de novo, envie o vídeo outra vez.</small>` : ""}
          <ol class="ed-etapas" id="ed-ref-etapas">${st.refEtapas.map((e) => `<li class="${e.estado}">${esc(e.texto)}</li>`).join("")}</ol>
        </div>
      </div>
      ${r ? `<div class="ed-ref-res">
        <div class="ed-ref-minis">${(r.minis || []).map((q) => `<figure><img src="${q.src}" alt="Quadro em ${q.t} s"><figcaption>${tempo(q.t)}</figcaption></figure>`).join("")}</div>
        ${m ? `<div class="ed-ref-medidas"><span><b>${m.cortes}</b> cortes</span><span><b>${m.planoMedio ?? "?"} s</b> por plano</span><span><b>${m.ppm ?? "?"}</b> palavras/min</span><span><b>${m.sonsFora ?? "?"}</b> sons fora da fala${m.sonsPorSeg ? ` (1 a cada ${String(m.sonsPorSeg).replace(".", ",")} s)` : ""}</span>${m.musica != null ? `<span>música de fundo: <b>${m.musica ? "sim" : "não"}</b></span>` : ""}</div>` : ""}
        ${r.resumo ? `<p class="ed-ref-resumo">${esc(r.resumo)}</p>` : ""}
        ${(r.viu || []).length ? `<h4 class="ed-ref-h">O que eu vi</h4><ul class="ed-ref-lista">${r.viu.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <h4 class="ed-ref-h">O que vou copiar na sua edição</h4>
        ${Object.keys(r.opc || {}).length ? `<ul class="ed-ref-lista ed-ref-muda">${Object.entries(r.opc).map(([k, v]) => `<li><span>${esc(NOMES_OPC[k] || k)}</span><b>${valorLegivel(k, v)}</b></li>`).join("")}</ul>` : `<p class="ed-obs">Nenhum ajuste visual mudou.</p>`}
        ${(r.regras || []).length ? `<ul class="ed-ref-lista">${r.regras.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${(r.nao_da || []).length ? `<h4 class="ed-ref-h">O que o editor ainda não faz (dá para fazer no CapCut)</h4><ul class="ed-ref-lista ed-ref-nao">${r.nao_da.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${m && m.sonsFora != null ? `<p class="ed-obs">Os sons eu conto pela energia do áudio fora da fala, então é uma estimativa. Se quiser um som específico, escreva no pedido.</p>` : ""}
        <div class="ed-ref-acoes">
          <button type="button" class="btn btn-principal" id="ed-ref-aplicar">${ic.brilho}${st.segs.length ? "Aplicar nesta edição" : "Usar na próxima edição"}</button>
          <button type="button" class="btn" id="ed-ref-estilo">Salvar como meu estilo</button>
          <button type="button" class="btn" id="ed-ref-lembrar" ${(r.regras || []).length ? "" : "disabled"}>Lembrar no meu padrão</button>
          <button type="button" class="btn rr-perigo" id="ed-ref-limpar">Tirar referência</button>
        </div>
        ${r.aplicado ? `<p class="ed-obs">Aplicado. As regras foram para "O que você quer nesta edição" e valem quando eu editar ${st.segs.length ? "de novo" : "o vídeo"}.</p>` : ""}
      </div>` : ""}`;
    const arq = $("#ed-ref-arq", box); arq.addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; trocarRefArquivo(f); });
    const solt = $("#ed-ref-soltar", box);
    solt.addEventListener("click", (e) => { if (e.target.tagName === "VIDEO") e.preventDefault(); });
    solt.addEventListener("dragover", (e) => { e.preventDefault(); solt.classList.add("arrastando"); });
    solt.addEventListener("dragleave", () => solt.classList.remove("arrastando"));
    solt.addEventListener("drop", (e) => { e.preventDefault(); solt.classList.remove("arrastando"); trocarRefArquivo([...e.dataTransfer.files].find((f) => /^video\//.test(f.type) || /\.(mov|mp4|m4v|webm)$/i.test(f.name))); });
    const tr = $("#ed-ref-trocar", box); if (tr) tr.addEventListener("click", () => arq.click());
    $$("[data-ref-foco]", box).forEach((b) => b.addEventListener("click", () => { const k = b.dataset.refFoco; st.refFocos = st.refFocos.includes(k) ? st.refFocos.filter((x) => x !== k) : [...st.refFocos, k]; b.classList.toggle("ativo"); b.setAttribute("aria-pressed", st.refFocos.includes(k)); }));
    $("#ed-ref-pedido", box).addEventListener("input", (e) => { st.refPedido = e.target.value; salvarDepois(); });
    $("#ed-ref-analisar", box).addEventListener("click", analisarReferencia);
    const ap = $("#ed-ref-aplicar", box); if (ap) ap.addEventListener("click", aplicarReferencia);
    const es = $("#ed-ref-estilo", box); if (es) es.addEventListener("click", estiloDaReferencia);
    const le = $("#ed-ref-lembrar", box); if (le) le.addEventListener("click", lembrarReferencia);
    const li = $("#ed-ref-limpar", box); if (li) li.addEventListener("click", () => { st.ref = null; st.refEtapas = []; salvarDepois(); pintarReferencia(true); });
  }

  // ---------- carrossel: o reel vira um carrossel (capa + cartões + legenda do post) ----------
  const CARRO_W = 1080, CARRO_H = 1350;
  function quebrarCtx(ctx, texto, max) { const linhas = []; for (const par of String(texto || "").split("\n")) { let l = ""; for (const p of par.split(/\s+/).filter(Boolean)) { const t2 = l ? l + " " + p : p; if (ctx.measureText(t2).width > max && l) { linhas.push(l); l = p; } else l = t2; } if (l) linhas.push(l); } return linhas; }
  async function desenharSlide(ctx, i) {
    const c = st.carro, s = c.slides[i], n = c.slides.length, capa = i === 0, ultimo = i === n - 1;
    ctx.fillStyle = "#1d1611"; ctx.fillRect(0, 0, CARRO_W, CARRO_H);
    while (capaOcupada) await espera(30);
    capaOcupada = true; try { await quadroEm(Math.max(0, Math.min(st.duracao - 0.05, s.t || 0)), ctx, CARRO_W, CARRO_H); } finally { capaOcupada = false; }
    // escurece embaixo para ler (degradê, sem desfoque)
    const gr = ctx.createLinearGradient(0, CARRO_H * (capa ? 0.4 : 0.28), 0, CARRO_H);
    gr.addColorStop(0, "rgba(20,14,10,0)"); gr.addColorStop(0.45, "rgba(20,14,10,.62)"); gr.addColorStop(1, "rgba(20,14,10,.9)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, CARRO_W, CARRO_H);
    const cor = c.cor || "#fff3b0", m = 80, larg = CARRO_W - m * 2;
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 14;
    let tamT = capa ? 118 : 92; const fT = (x) => fonteTitulo(x, c.fonte || "dmserif");
    ctx.font = fT(tamT); let lt = quebrarCtx(ctx, s.titulo, larg);
    while (lt.length > (capa ? 4 : 3) && tamT > 48) { tamT -= 6; ctx.font = fT(tamT); lt = quebrarCtx(ctx, s.titulo, larg); }
    const tamX = 46; ctx.font = `400 ${tamX}px Poppins, sans-serif`; const lx = s.texto ? quebrarCtx(ctx, s.texto, larg) : [];
    const altT = lt.length * tamT * 1.08, altX = lx.length * tamX * 1.38, rod = 120;
    let y = CARRO_H - rod - altX - (lx.length ? 30 : 0) - altT + tamT * 0.85;
    if (!capa) { ctx.font = `600 30px Poppins, sans-serif`; ctx.fillStyle = cor; ctx.fillText(String(i + 1).padStart(2, "0"), m, y - tamT - 10); }
    ctx.font = fT(tamT); ctx.fillStyle = capa ? cor : "#ffffff";
    lt.forEach((l, k) => ctx.fillText(l, m, y + k * tamT * 1.08));
    y += altT + 26;
    ctx.font = `400 ${tamX}px Poppins, sans-serif`; ctx.fillStyle = "#f3e8dc";
    lx.forEach((l, k) => ctx.fillText(l, m, y + k * tamX * 1.38 + tamX * 0.2));
    ctx.shadowBlur = 0;
    // rodapé: @ e número do cartão
    ctx.font = `500 28px Poppins, sans-serif`; ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.fillText(c.arroba || "@maribonettougc", m, CARRO_H - 56);
    ctx.textAlign = "right"; ctx.fillText(`${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`, CARRO_W - m, CARRO_H - 56);
    if (capa || !ultimo) { ctx.fillText(capa ? "arrasta →" : "", CARRO_W - m, CARRO_H - 100); }
    ctx.textAlign = "left";
  }
  let carroFila = Promise.resolve();
  function redesenharSlide(i) {
    carroFila = carroFila.then(async () => { const cv = document.querySelector(`[data-slide-cv="${i}"]`); if (!cv || !st.carro || !st.carro.slides[i]) return; await desenharSlide(cv.getContext("2d"), i); }).catch(() => { /* segue */ });
    return carroFila;
  }
  async function criarCarrossel() {
    if (!st.segs.length || st.carroTrab) return;
    if (st.tocando) parar();
    st.carroTrab = true; pintarCarrossel(true);
    try {
      const n = Number(($("#ed-carro-n") || {}).value) || 7;
      const fala = st.legendas.map(textoLeg).join(" ");
      const r = await chamarExtras({ acao: "carrossel", fala, titulo: st.titulo, tema: st.tema, roteiro: st.roteiro.trim() || undefined, n });
      const ns = r.slides.length, capaT = st.capa ? st.capa.t : Math.min(1, st.duracao / 3);
      st.carro = { slides: r.slides.map((s, i) => ({ ...s, t: +(i === 0 ? capaT : st.duracao * (i + 0.5) / ns).toFixed(2) })), legenda: r.legenda, destaque: r.destaque, cor: (st.carro && st.carro.cor) || st.opc.corLegenda || "#fff3b0", fonte: (st.carro && st.carro.fonte) || st.opc.fonteTitulo || "dmserif", arroba: "@maribonettougc" };
      salvarDepois();
    } catch (e) { toast(e.message, true); }
    st.carroTrab = false; pintarCarrossel(true);
  }
  function baixarSlide(i) {
    return new Promise((ok) => {
      const cv = document.createElement("canvas"); cv.width = CARRO_W; cv.height = CARRO_H;
      desenharSlide(cv.getContext("2d"), i).then(() => cv.toBlob((blob) => {
        if (blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${(st.tema || (st.clipes[0] ? st.clipes[0].nome.replace(/\.[^.]+$/, "") : "carrossel")).replace(/[^\w\-]+/g, "-").slice(0, 40)}-${String(i + 1).padStart(2, "0")}.png`; a.click(); }
        ok();
      }, "image/png"));
    });
  }
  function pintarCarrossel(forcar) {
    const box = $("#ed-carrossel"); if (!box) return;
    if (!forcar && st.aba !== "carrossel" && box.dataset.pintado) return;
    box.dataset.pintado = "1";
    if (!st.segs.length) { box.innerHTML = `<p class="rr-vazio">O carrossel aparece aqui depois que eu editar o vídeo.</p>`; return; }
    const c = st.carro;
    box.innerHTML = `<div class="ed-titulo-linha"><h3 class="ed-titulo">Carrossel do reel</h3><span class="ed-sub">2 posts do mesmo vídeo</span></div>
      <p class="ed-obs">Eu transformo a fala do reel em cartões (capa, uma ideia por cartão e o fechamento com CTA), uso quadros do próprio vídeo e escrevo a legenda do post na sua voz. Você muda qualquer texto ou quadro antes de baixar (1080 x 1350).</p>
      <div class="ed-carro-topo">
        <label class="ed-rotulo" for="ed-carro-n">Cartões</label><select class="entrada" id="ed-carro-n">${[5, 6, 7, 8, 9, 10].map((x) => `<option value="${x}" ${(c ? c.slides.length : 7) === x ? "selected" : ""}>${x}</option>`).join("")}</select>
        <button type="button" class="btn btn-principal" id="ed-carro-criar" ${st.carroTrab ? "disabled" : ""}>${st.carroTrab ? "Criando…" : ic.brilho + (c ? "Criar de novo" : "Fazer carrossel")}</button>
        ${c ? `<span class="ed-carro-cores">${CORES_LEG.map((x) => `<button type="button" class="ed-aj-cor${c.cor === x ? " ativa" : ""}" data-carro-cor="${x}" style="background:${x}" aria-label="Cor ${x}"></button>`).join("")}</span>
        <select class="entrada" id="ed-carro-fonte" aria-label="Fonte dos títulos">${Object.entries(FONTES_TIT).map(([k, t]) => `<option value="${k}" ${c.fonte === k ? "selected" : ""}>${t}</option>`).join("")}</select>
        <button type="button" class="btn" id="ed-carro-baixar">${ic.baixar}Baixar todos</button>` : ""}
      </div>
      ${c ? `<div class="ed-carro-lista">${c.slides.map((s, i) => `<div class="ed-slide">
          <canvas data-slide-cv="${i}" width="${CARRO_W}" height="${CARRO_H}" aria-label="Cartão ${i + 1}"></canvas>
          <div class="ed-slide-quadro"><button type="button" class="icone-btn" data-slide-t="${i}" data-passo="-1.5" aria-label="Quadro anterior">‹</button><small>quadro ${tempo(s.t)}</small><button type="button" class="icone-btn" data-slide-t="${i}" data-passo="1.5" aria-label="Próximo quadro">›</button><button type="button" class="icone-btn" data-slide-baixar="${i}" aria-label="Baixar cartão ${i + 1}">${ic.baixar}</button></div>
          <input class="entrada" data-slide-tit="${i}" value="${esc(s.titulo)}" maxlength="80" aria-label="Título do cartão ${i + 1}">
          ${i === 0 ? "" : `<textarea class="entrada" data-slide-txt="${i}" rows="3" maxlength="260" aria-label="Texto do cartão ${i + 1}">${esc(s.texto)}</textarea>`}
        </div>`).join("")}</div>
        <label class="ed-rotulo" for="ed-carro-leg">Legenda do post</label>
        <textarea class="entrada" id="ed-carro-leg" rows="6">${esc(c.legenda)}</textarea>
        <div class="ed-ref-acoes"><button type="button" class="btn" id="ed-carro-copiar">Copiar legenda</button></div>` : ""}`;
    $("#ed-carro-criar", box).addEventListener("click", criarCarrossel);
    if (!c) return;
    $$("[data-carro-cor]", box).forEach((b) => b.addEventListener("click", () => { c.cor = b.dataset.carroCor; salvarDepois(); pintarCarrossel(true); }));
    $("#ed-carro-fonte", box).addEventListener("change", (e) => { c.fonte = e.target.value; salvarDepois(); c.slides.forEach((_, i) => redesenharSlide(i)); });
    $$("[data-slide-tit]", box).forEach((el) => el.addEventListener("input", () => { const i = +el.dataset.slideTit; c.slides[i].titulo = el.value; salvarDepois(); redesenharSlide(i); }));
    $$("[data-slide-txt]", box).forEach((el) => el.addEventListener("input", () => { const i = +el.dataset.slideTxt; c.slides[i].texto = el.value; salvarDepois(); redesenharSlide(i); }));
    $$("[data-slide-t]", box).forEach((b) => b.addEventListener("click", () => { const i = +b.dataset.slideT, s = c.slides[i]; s.t = +Math.max(0, Math.min(st.duracao - 0.05, s.t + Number(b.dataset.passo))).toFixed(2); b.parentElement.querySelector("small").textContent = "quadro " + tempo(s.t); salvarDepois(); redesenharSlide(i); }));
    $$("[data-slide-baixar]", box).forEach((b) => b.addEventListener("click", () => baixarSlide(+b.dataset.slideBaixar)));
    $("#ed-carro-leg", box).addEventListener("input", (e) => { c.legenda = e.target.value; salvarDepois(); });
    $("#ed-carro-copiar", box).addEventListener("click", async () => { try { await navigator.clipboard.writeText(c.legenda); toast("Legenda copiada."); } catch (e) { $("#ed-carro-leg", box).select(); toast("Selecionei a legenda: é só copiar.", true); } });
    $("#ed-carro-baixar", box).addEventListener("click", async () => { if (st.tocando) parar(); toast("Baixando os cartões…"); for (let i = 0; i < c.slides.length; i++) { await baixarSlide(i); await espera(450); } toast("Cartões baixados. Posta na ordem do número."); });
    if (st.tocando) parar();
    c.slides.forEach((_, i) => redesenharSlide(i));
  }

  // ---------- storyboard e variações para Reels de teste (out/2026, ideias do "Video Studio" da @brand.nat) ----------
  // Storyboard: o vídeo editado dividido em cenas (planos seguidos juntos até fechar uma frase), cada uma
  // com a fala, sugestões da IA (editor-extras acao "storyboard"), nota e "Ajustar só esta cena"
  // (corrigir com escopo: só a IA, só aquele trecho do bruto, nunca vira regra do padrão).
  // Variações: o vídeo aprovado vira 3 a 5 cortes diferentes de verdade (gancho novo, cena de abertura,
  // versão curta de 20 a 30 s, ordem, estilo de legenda, sons), conferidos para não ficarem parecidos.
  // Abrir uma variação guarda a edição original em st.variBase; sair da aba Variações volta sempre.
  function novoStory() { return { geral: "", sug: {}, notas: {}, notaGeral: "", trab: false }; }
  function novaVari() { return { n: 3, mudar: { gancho: true, curta: true, ordem: true, legenda: false, sons: false }, lista: [], base: "", trab: false, gerando: null }; }
  const clonar = (x) => JSON.parse(JSON.stringify(x));
  function falaEntre(o0, o1) { return st.legendas.filter((g) => g.o0 >= o0 - 0.05 && g.o0 < o1 - 0.05).map(textoLeg).join(" ").replace(/\s+/g, " ").trim(); }
  function cenasDoVideo() {
    const cenas = []; let atual = null;
    const fecha = () => { if (atual) { atual.fala = falaEntre(atual.o0, atual.o1); cenas.push(atual); } atual = null; };
    st.segs.forEach((sg, i) => {
      if (!atual) atual = { k: "c" + sg.chave, segs: [], o0: sg.o0, o1: sg.o1 };
      atual.segs.push(sg); atual.o1 = sg.o1;
      const dur = atual.o1 - atual.o0, prox = st.segs[i + 1];
      const frase = /[.!?…]["”]?$/.test(falaEntre(sg.o0, sg.o1));
      if (!prox || (dur >= 2.5 && frase) || dur >= 6.5 || (prox.ci !== sg.ci && dur >= 1.5)) fecha();
    });
    fecha();
    const ult = cenas[cenas.length - 1];
    if (cenas.length > 1 && ult.o1 - ult.o0 < 1) { const ant = cenas[cenas.length - 2]; ant.segs.push(...ult.segs); ant.o1 = ult.o1; ant.fala = falaEntre(ant.o0, ant.o1); cenas.pop(); }
    cenas.forEach((c) => { c.g0 = Math.min(...c.segs.map((s) => s.g0)); c.g1 = Math.max(...c.segs.map((s) => s.g1)); });
    return cenas;
  }
  const assinaturaCenas = () => cenasDoVideo().map((c) => c.k).join(",");
  function miniCena(c) {
    const sg = c.segs[0], cl = st.clipes[sg.ci];
    if (!cl || !cl.tira || !cl.tira.length) return `<span class="ed-sb-sem">${ic.filme}</span>`;
    const q = cl.tira.reduce((m, x) => Math.abs(x.t - (sg.a + 0.3)) < Math.abs(m.t - (sg.a + 0.3)) ? x : m, cl.tira[0]);
    return `<img src="${q.src}" alt="" draggable="false">`;
  }
  const textoCena = (c, n) => `cena ${n + 1} (no vídeo bruto, de ${c.g0.toFixed(1)} s a ${c.g1.toFixed(1)} s; fala: "${c.fala.slice(0, 220) || "sem fala"}")`;

  // ---------- storyboard ----------
  async function sugerirCenas() {
    if (!st.segs.length || st.story.trab) return;
    const cenas = cenasDoVideo();
    st.story.trab = true; pintarStoryboard(true);
    try {
      const r = await chamarExtras({ acao: "storyboard", cenas: cenas.map((c, i) => ({ i, de: +c.o0.toFixed(1), ate: +c.o1.toFixed(1), fala: c.fala })), titulo: st.titulo, tema: st.tema, roteiro: roteiroUsado() || undefined, padrao: String(st.padrao || "").slice(0, 2500), pedidos: st.pedidos || undefined });
      const sug = {}; for (const x of r.cenas || []) if (cenas[x.i]) sug[cenas[x.i].k] = x.sugestoes || [];
      st.story.sug = sug; st.story.geral = r.geral || "";
      salvarDepois();
    } catch (e) { toast(e.message, true); }
    st.story.trab = false; pintarStoryboard(true);
  }
  async function ajustarCenas(ks) {
    if (st.corrigindo) return;
    const cenas = cenasDoVideo();
    const partes = [];
    cenas.forEach((c, n) => { const nota = String(st.story.notas[c.k] || "").trim(); if (ks.includes(c.k) && nota) partes.push(`Na ${textoCena(c, n)}: ${nota}`); });
    const geral = ks === "todas" || ks.includes("geral") ? String(st.story.notaGeral || "").trim() : "";
    if (!partes.length && !geral) { toast("Escreva a nota da cena antes de ajustar.", true); return; }
    const texto = (partes.length ? partes.join(". ") + (geral ? ". " : "") : "") + (geral ? "No vídeo todo: " + geral : "") + (partes.length && !geral ? ". Não mude nada fora desses trechos." : "");
    const antes = st.correcoes.length;
    await corrigir(texto, { soIA: true });
    const ult = st.correcoes[st.correcoes.length - 1];
    if (st.correcoes.length > antes && ult && ult.mudou && ult.mudou.length) {
      cenas.forEach((c) => { if (ks.includes(c.k)) delete st.story.notas[c.k]; });
      if (geral) st.story.notaGeral = "";
      salvarDepois();
    }
    pintarStoryboard(true);
  }
  function pintarStoryboard(forcar) {
    const box = $("#ed-storyboard"); if (!box) return;
    if (!forcar && st.aba !== "storyboard") return;
    if (!st.segs.length) { box.innerHTML = `<p class="rr-vazio">O storyboard aparece aqui depois que eu editar o vídeo.</p>`; return; }
    if (box.contains(document.activeElement) && document.activeElement.matches("textarea")) return; // não apaga o que ela está digitando
    const sb = st.story, cenas = cenasDoVideo(), ocupado = st.corrigindo || sb.trab;
    const comNota = cenas.filter((c) => String(sb.notas[c.k] || "").trim()).length + (String(sb.notaGeral || "").trim() ? 1 : 0);
    box.innerHTML = `<div class="ed-titulo-linha"><h3 class="ed-titulo">Storyboard</h3><span class="ed-sub">${cenas.length} cenas · ${tempo(st.duracao)}</span></div>
      <p class="ed-obs">Cada cena do vídeo editado com o que você fala nela. Peça sugestões, anote o que quer mudar e ajuste só aquela cena, sem refazer o resto do vídeo. Toque na miniatura para ver a cena no player.</p>
      <div class="ed-sb-topo"><button type="button" class="btn btn-principal" id="ed-sb-sugerir" ${ocupado ? "disabled" : ""}>${sb.trab ? "Lendo as cenas…" : ic.brilho + (Object.keys(sb.sug).length ? "Sugerir de novo" : "Sugerir melhorias por cena")}</button>
        ${sb.geral ? `<p class="ed-sb-geral">${esc(sb.geral)}</p>` : ""}</div>
      <ol class="ed-sb-lista">${cenas.map((c, n) => { const sug = sb.sug[c.k] || []; return `<li class="ed-sb-cena">
        <button type="button" class="ed-sb-quadro" data-sb-ver="${c.o0}" aria-label="Ver a cena ${n + 1} no player">${miniCena(c)}<span>${n + 1}</span></button>
        <div class="ed-sb-corpo">
          <div class="ed-sb-cab"><b>Cena ${n + 1}</b><small>${tempo(c.o0)} a ${tempo(c.o1)} · ${(c.o1 - c.o0).toFixed(1).replace(".", ",")} s</small></div>
          <p class="ed-sb-fala">${c.fala ? "“" + esc(c.fala) + "”" : "<i>sem fala</i>"}</p>
          ${sug.length ? `<ul class="ed-sb-sug">${sug.map((s, j) => `<li><span>${esc(s)}</span><button type="button" class="btn ed-sb-por" data-sb-por="${c.k}" data-j="${j}">Pôr na nota</button></li>`).join("")}</ul>` : ""}
          <textarea class="entrada" data-sb-nota="${c.k}" rows="2" placeholder="Nota desta cena: o que você quer mudar aqui" ${ocupado ? "disabled" : ""}>${esc(sb.notas[c.k] || "")}</textarea>
          <div class="ed-sb-acoes"><button type="button" class="btn" data-sb-ajustar="${c.k}" ${ocupado ? "disabled" : ""}>${st.corrigindo ? "Ajustando…" : "Ajustar só esta cena"}</button></div>
        </div></li>`; }).join("")}</ol>
      <label class="ed-rotulo" for="ed-sb-nota-geral">Nota para o vídeo todo</label>
      <textarea class="entrada" id="ed-sb-nota-geral" rows="2" placeholder="Ex.: mais b-roll do produto no meio; o final está arrastado" ${ocupado ? "disabled" : ""}>${esc(sb.notaGeral || "")}</textarea>
      <div class="ed-ref-acoes"><button type="button" class="btn btn-principal" id="ed-sb-todas" ${ocupado || !comNota ? "disabled" : ""}>${st.corrigindo ? "Ajustando…" : `Ajustar com todas as notas${comNota ? ` (${comNota})` : ""}`}</button></div>`;
    $("#ed-sb-sugerir", box).addEventListener("click", sugerirCenas);
    $$("[data-sb-ver]", box).forEach((b) => b.addEventListener("click", () => irPara(Number(b.dataset.sbVer) + 0.02)));
    const contar = () => { const n = cenas.filter((c) => String(sb.notas[c.k] || "").trim()).length + (String(sb.notaGeral || "").trim() ? 1 : 0); const t = $("#ed-sb-todas", box); if (t && !ocupado) { t.disabled = !n; t.textContent = `Ajustar com todas as notas${n ? ` (${n})` : ""}`; } };
    $$("[data-sb-nota]", box).forEach((el) => el.addEventListener("input", () => { sb.notas[el.dataset.sbNota] = el.value; contar(); salvarDepois(); }));
    $("#ed-sb-nota-geral", box).addEventListener("input", (e) => { sb.notaGeral = e.target.value; contar(); salvarDepois(); });
    $$("[data-sb-por]", box).forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.sbPor, s = (sb.sug[k] || [])[+b.dataset.j]; if (!s) return;
      const atual = String(sb.notas[k] || "").trim(); if (atual.includes(s)) return;
      sb.notas[k] = atual ? atual.replace(/[.;]?$/, ". ") + s : s;
      const el = box.querySelector(`[data-sb-nota="${k}"]`); if (el) el.value = sb.notas[k];
      contar(); salvarDepois();
    }));
    $$("[data-sb-ajustar]", box).forEach((b) => b.addEventListener("click", () => ajustarCenas([b.dataset.sbAjustar])));
    $("#ed-sb-todas", box).addEventListener("click", () => ajustarCenas([...cenas.map((c) => c.k), "geral"]));
  }

  // ---------- variações para Reels de teste ----------
  const MUDAR_VARI = [["gancho", "Gancho novo e outra cena de abertura"], ["curta", "Uma versão curta, de 20 a 30 s"], ["ordem", "Ordem diferente (resultado primeiro ou história primeiro)"], ["legenda", "Outro estilo de legenda em cada uma"], ["sons", "Outra quantidade de efeitos sonoros"]];
  const NOME_SONS = { nenhum: "sem efeitos", impacto: "sons só no impacto", poucos: "poucos sons", medio: "sons médios", muitos: "muitos sons" };
  const limpaTit = (x) => String(x || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  function infoVariacao(v, cenas) {
    const ordem = v.ordemIdx.filter((i) => !v.cortarIdx.includes(i));
    return { dur: ordem.reduce((s, i) => s + (cenas[i].o1 - cenas[i].o0), 0), primeira: ordem[0], ordem: ordem.join(","), tit: limpaTit(v.titulo), estilo: v.estilo || "", sons: (v.opc || {}).sons || "" };
  }
  function diferencas(a, b) {
    let d = 0;
    if (a.tit !== b.tit) d++;
    if (a.primeira !== b.primeira) d++;
    if (Math.abs(a.dur - b.dur) >= 3) d++;
    if (a.ordem !== b.ordem && a.primeira === b.primeira) d++;
    if (a.estilo !== b.estilo) d++;
    if (a.sons !== b.sons) d++;
    return d;
  }
  // mudanças de verdade em relação ao vídeo original (o que aparece no cartão)
  function oQueMuda(v, cenas) {
    const i = infoVariacao(v, cenas), out = [];
    if (limpaTit(v.titulo) !== limpaTit(st.variBase ? st.variBase.titulo : st.titulo)) out.push("gancho novo");
    if (i.primeira !== 0) out.push(`abre na cena ${i.primeira + 1}`);
    if (v.cortarIdx.length) out.push(`${tempo(i.dur).replace(/,\d$/, "")} (sem ${v.cortarIdx.length === 1 ? "a cena " + (v.cortarIdx[0] + 1) : v.cortarIdx.length + " cenas"})`);
    const resto = i.ordem.split(",").map(Number).slice(1);
    if (resto.some((x, k) => k && x < resto[k - 1])) out.push("ordem nova");
    if (v.estilo) out.push("legenda " + nomeDoEstilo(v.estilo));
    if ((v.opc || {}).sons) out.push(NOME_SONS[v.opc.sons]);
    return out;
  }
  function encurtar(v, cenas) {
    const dur = () => v.ordemIdx.filter((i) => !v.cortarIdx.includes(i)).reduce((s, i) => s + (cenas[i].o1 - cenas[i].o0), 0);
    while (dur() > 30) {
      const vivos = v.ordemIdx.filter((i) => !v.cortarIdx.includes(i));
      const pode = vivos.slice(1, -1).filter((i) => dur() - (cenas[i].o1 - cenas[i].o0) >= 15);
      if (!pode.length) break;
      v.cortarIdx.push(pode.sort((a, b) => (cenas[b].o1 - cenas[b].o0) - (cenas[a].o1 - cenas[a].o0))[0]);
    }
  }
  function conferirVariacoes(lista, cenas) {
    const m = st.vari.mudar, total = st.duracao;
    // pede curta: pelo menos uma entre 20 e 30 s (quando o vídeo passa de 30 s)
    if (m.curta && total > 30 && !lista.some((v) => infoVariacao(v, cenas).dur <= 30.5)) { const v = lista[Math.min(1, lista.length - 1)]; encurtar(v, cenas); v.nome = v.nome || "Versão curta"; }
    // pede ordem: pelo menos uma com outra ordem (resultado primeiro: a parte mais forte antes do CTA abre o vídeo)
    const orig = cenas.map((_, k) => k).join(",");
    if (m.ordem && cenas.length > 2 && !lista.some((v) => v.ordemIdx.join(",") !== orig)) { const v = lista[lista.length - 1], forte = cenas.length - 2; v.ordemIdx = [forte, ...v.ordemIdx.filter((i) => i !== forte)]; }
    // nenhuma parecida demais com outra nem com o vídeo original: pelo menos 2 diferenças em cada par
    const original = { ordemIdx: cenas.map((_, k) => k), cortarIdx: [], titulo: st.titulo, estilo: null, opc: null };
    const outrosSons = ["poucos", "medio", "muitos", "impacto"].filter((x) => x !== st.opc.sons);
    const parecidas = (v, a) => [original, ...lista].some((o, b) => b - 1 !== a && diferencas(infoVariacao(v, cenas), infoVariacao(o, cenas)) < 2);
    lista.forEach((v, a) => {
      for (let passo = 0; passo < 3 && parecidas(v, a); passo++) {
        const usadas = new Set([original, ...lista].filter((o) => o !== v).map((o) => infoVariacao(o, cenas).primeira));
        const nova = cenas.map((_, k) => k).find((k) => !usadas.has(k) && !v.cortarIdx.includes(k) && k !== cenas.length - 1);
        if (passo === 0 && nova != null) v.ordemIdx = [nova, ...v.ordemIdx.filter((i) => i !== nova)];
        else v.opc = { ...(v.opc || {}), sons: outrosSons[(a + passo) % outrosSons.length] };
      }
    });
    lista.forEach((v, a) => { v.parecida = parecidas(v, a); });
  }
  async function criarVariacoes() {
    if (!st.segs.length || st.vari.trab) return;
    if (st.variBase) voltarOriginal();
    const cenas = cenasDoVideo();
    if (cenas.length < 2) { toast("O vídeo precisa de pelo menos 2 cenas para virar variações.", true); return; }
    const vr = st.vari; vr.trab = true; pintarVariacoes(true);
    try {
      const r = await chamarExtras({ acao: "variacoes", cenas: cenas.map((c, i) => ({ i, de: +c.o0.toFixed(1), ate: +c.o1.toFixed(1), fala: c.fala })), titulo: st.titulo, tema: st.tema, roteiro: roteiroUsado() || undefined, n: vr.n, mudar: vr.mudar, duracao: +st.duracao.toFixed(1) });
      const outrosEstilos = ESTILOS_PRONTOS.filter((e) => e.id !== st.estiloAtivo);
      const outrosSons = ["poucos", "medio", "muitos", "impacto"].filter((x) => x !== st.opc.sons);
      const lista = (r.variacoes || []).slice(0, vr.n).map((x, idx) => {
        let ordemIdx = Array.isArray(x.ordem) && x.ordem.length === cenas.length ? x.ordem.slice() : cenas.map((_, k) => k);
        if (vr.mudar.gancho && x.abrir_com != null && x.abrir_com !== cenas.length - 1) ordemIdx = [x.abrir_com, ...ordemIdx.filter((i) => i !== x.abrir_com)];
        const cortarIdx = (x.cortar || []).filter((i) => i !== ordemIdx[0]);
        const v = { id: uid(), nome: x.nome, titulo: x.titulo, tituloDestaque: x.titulo_destaque || "", por_que: x.por_que || "", ordemIdx, cortarIdx, estilo: null, opc: null };
        if (vr.mudar.legenda && outrosEstilos.length) { const e = outrosEstilos[idx % outrosEstilos.length]; v.estilo = e.id; v.opc = { ...BASE_ESTILO, ...e.opc, sons: st.opc.sons, dinamismo: st.opc.dinamismo, ritmo: st.opc.ritmo }; }
        if (vr.mudar.sons) v.opc = { ...(v.opc || {}), sons: outrosSons[idx % outrosSons.length] };
        return v;
      });
      if (!lista.length) throw new Error("A IA não montou as variações agora. Tente de novo.");
      conferirVariacoes(lista, cenas);
      // guarda já em chaves de plano e faixas do bruto (é o que a montagem entende)
      lista.forEach((v) => {
        v.ordem = v.ordemIdx.flatMap((i) => cenas[i].segs.map((s) => s.chave));
        v.cortes = v.cortarIdx.flatMap((i) => cenas[i].segs.map((s) => [+s.og0.toFixed(2), +s.og1.toFixed(2)]));
        v.muda = oQueMuda(v, cenas); v.dur = infoVariacao(v, cenas).dur;
      });
      vr.lista = lista; vr.base = assinaturaCenas();
      salvarDepois();
    } catch (e) { toast(e.message, true); }
    vr.trab = false; pintarVariacoes(true);
  }
  function aplicarVariacao(v) {
    if (st.tocando) parar();
    if (!st.variBase) st.variBase = { manual: clonar(st.manual), titulo: st.titulo, tituloDestaque: st.tituloDestaque, opc: clonar(st.opc), arquivoFinal: st.arquivoFinal };
    const b = st.variBase;
    st.manual = clonar(b.manual); st.manual.ordem = v.ordem.slice(); st.manual.cortes = [...(st.manual.cortes || []), ...v.cortes.map((x) => x.slice())];
    st.titulo = v.titulo || b.titulo; st.tituloDestaque = v.titulo ? v.tituloDestaque : b.tituloDestaque;
    st.opc = clonar(b.opc); if (v.titulo) st.opc.titulo = true; if (v.opc) Object.assign(st.opc, v.opc);
    st.variAtiva = v.id; st.arquivoFinal = null;
    montar(); st.t = 0; pintar(); desenhar(0);
  }
  function voltarOriginal(quieto) {
    const b = st.variBase; if (!b) return;
    if (st.tocando) parar();
    Object.assign(st, { manual: b.manual, titulo: b.titulo, tituloDestaque: b.tituloDestaque, opc: b.opc, arquivoFinal: b.arquivoFinal, variBase: null, variAtiva: null });
    montar(); st.t = 0;
    if (!quieto) { pintar(); desenhar(0); }
  }
  async function exportarVariacao(v, n) {
    if (st.exportando) return;
    aplicarVariacao(v); st.vari.gerando = v.id; pintarVariacoes(true);
    await exportar();
    if (st.arquivoFinal) {
      const base = (st.tema || (st.clipes[0] ? st.clipes[0].nome.replace(/\.[^.]+$/, "") : "video")).replace(/[^\w\-]+/g, "-").slice(0, 40);
      v.arquivo = { ...st.arquivoFinal, nome: `${base}-teste-${n + 1}.${st.arquivoFinal.ext}` };
    }
    const cancelado = !st.arquivoFinal; st.vari.gerando = null;
    voltarOriginal(true); pintar(); pintarVariacoes(true);
    return !cancelado;
  }
  async function exportarTodas() {
    for (const [n, v] of st.vari.lista.entries()) {
      if (v.arquivo) continue;
      const ok = await exportarVariacao(v, n);
      if (!ok) return;
    }
    toast("Todas as variações estão prontas para baixar.");
  }
  function pintarVariacoes(forcar) {
    const box = $("#ed-variacoes"); if (!box) return;
    if (!forcar && st.aba !== "variacoes") return;
    if (!st.segs.length) { box.innerHTML = `<p class="rr-vazio">As variações aparecem aqui depois que eu editar o vídeo.</p>`; return; }
    const vr = st.vari, ocupado = vr.trab || st.exportando;
    const velha = vr.lista.length && vr.base !== (st.variBase ? vr.base : assinaturaCenas());
    const ativa = vr.lista.find((v) => v.id === st.variAtiva);
    box.innerHTML = `<div class="ed-titulo-linha"><h3 class="ed-titulo">Variações para Reels de teste</h3><span class="ed-sub">mesmo vídeo, cortes diferentes</span></div>
      <p class="ed-obs">Eu transformo o vídeo aprovado em 3 a 5 cortes diferentes de verdade para você postar como Reels de teste e ver qual gancho prende mais. Cada um ganha um gancho novo e mais alguma mudança real, e eu confiro se nenhum ficou parecido demais com outro (o Instagram ignora vídeo duplicado).</p>
      <div class="ed-var-n" role="group" aria-label="Quantos cortes">${[3, 4, 5].map((x) => `<button type="button" class="ed-fmt${vr.n === x ? " on" : ""}" data-var-n="${x}" ${ocupado ? "disabled" : ""}>${x} cortes</button>`).join("")}</div>
      <div class="ed-var-mudar">${MUDAR_VARI.map(([k, t]) => `<label class="ed-chk"><input type="checkbox" data-var-mudar="${k}" ${vr.mudar[k] ? "checked" : ""} ${ocupado ? "disabled" : ""}> ${t}</label>`).join("")}</div>
      <div class="ed-ref-acoes"><button type="button" class="btn btn-principal" id="ed-var-criar" ${ocupado ? "disabled" : ""}>${vr.trab ? "Criando as variações…" : ic.brilho + (vr.lista.length ? "Criar de novo" : "Criar variações")}</button>
        ${vr.lista.length ? `<button type="button" class="btn" id="ed-var-todas" ${ocupado || velha ? "disabled" : ""}>${ic.baixar}Gerar todos os vídeos</button>` : ""}</div>
      ${velha ? `<p class="faixa faixa-aviso">A edição mudou depois que eu criei estas variações. Crie de novo para elas seguirem o vídeo atual.</p>` : ""}
      ${ativa ? `<div class="ed-var-vendo"><span>No player: <b>${esc(ativa.nome)}</b>. O que você mexer agora não fica salvo.</span><button type="button" class="btn" id="ed-var-voltar">Voltar ao original</button></div>` : ""}
      ${vr.lista.length ? `<ol class="ed-var-lista">${vr.lista.map((v, n) => `<li class="ed-var${v.id === st.variAtiva ? " on" : ""}">
        <div class="ed-var-cab"><b>Variação ${n + 1}</b><span>${esc(v.nome)}</span><small>${tempo(v.dur || 0)}</small></div>
        <input class="entrada ed-var-tit" data-var-tit="${v.id}" value="${esc(v.titulo)}" maxlength="80" aria-label="Gancho da variação ${n + 1}" ${ocupado ? "disabled" : ""}>
        <div class="ed-var-muda">${(v.muda || []).map((m) => `<span>${esc(m)}</span>`).join("")}</div>
        ${v.por_que ? `<small class="ed-var-pq">${esc(v.por_que)}</small>` : ""}
        <small class="ed-var-check${v.parecida ? " alerta" : ""}">${v.parecida ? "Ficou parecida com outra: mude o gancho ou crie de novo" : "✓ Diferente das outras"}</small>
        <div class="ed-var-acoes">
          <button type="button" class="btn" data-var-ver="${v.id}" ${ocupado || velha ? "disabled" : ""}>${ic.play}Ver no player</button>
          ${v.arquivo ? `<a class="btn btn-principal" href="${v.arquivo.url}" download="${esc(v.arquivo.nome)}">${ic.baixar}Baixar</a>` : `<button type="button" class="btn btn-principal" data-var-gerar="${v.id}" ${ocupado || velha ? "disabled" : ""}>${vr.gerando === v.id ? "Gerando… (deixe a aba aberta)" : ic.baixar + "Gerar vídeo"}</button>`}
        </div></li>`).join("")}</ol>
        <p class="ed-obs">Poste cada uma como Reels de teste (no Instagram: Reels, Opções avançadas, "Reels de teste"), espere uns dias e repita o gancho que ganhar nos próximos vídeos.</p>` : ""}`;
    $$("[data-var-n]", box).forEach((b) => b.addEventListener("click", () => { vr.n = +b.dataset.varN; salvarDepois(); pintarVariacoes(true); }));
    $$("[data-var-mudar]", box).forEach((el) => el.addEventListener("change", () => { vr.mudar[el.dataset.varMudar] = el.checked; salvarDepois(); }));
    $("#ed-var-criar", box).addEventListener("click", criarVariacoes);
    const todas = $("#ed-var-todas", box); if (todas) todas.addEventListener("click", exportarTodas);
    const voltar = $("#ed-var-voltar", box); if (voltar) voltar.addEventListener("click", () => { voltarOriginal(); pintarVariacoes(true); });
    $$("[data-var-ver]", box).forEach((b) => b.addEventListener("click", () => { const v = vr.lista.find((x) => x.id === b.dataset.varVer); if (v) { aplicarVariacao(v); pintarVariacoes(true); } }));
    $$("[data-var-gerar]", box).forEach((b) => b.addEventListener("click", () => { const n = vr.lista.findIndex((x) => x.id === b.dataset.varGerar); if (n >= 0) exportarVariacao(vr.lista[n], n); }));
    $$("[data-var-tit]", box).forEach((el) => el.addEventListener("input", () => {
      const v = vr.lista.find((x) => x.id === el.dataset.varTit); if (!v) return;
      v.titulo = el.value; v.arquivo = null;
      if (st.variAtiva === v.id) { st.titulo = v.titulo; redesenhar(); }
      if (!velha) { const cenas = cenasDoVideo(), orig = { ordemIdx: cenas.map((_, k) => k), cortarIdx: [], titulo: (st.variBase || st).titulo }; vr.lista.forEach((x, a) => { x.parecida = [orig, ...vr.lista].some((o, b) => b - 1 !== a && diferencas(infoVariacao(x, cenas), infoVariacao(o, cenas)) < 2); }); }
      const chk = el.parentElement.querySelector(".ed-var-check"); if (chk) { chk.classList.toggle("alerta", v.parecida); chk.textContent = v.parecida ? "Ficou parecida com outra: mude o gancho ou crie de novo" : "✓ Diferente das outras"; }
      const dl = el.parentElement.querySelector("a[download]"); if (dl) dl.replaceWith(Object.assign(document.createElement("small"), { textContent: "Gancho mudou: gere o vídeo de novo" }));
      salvarDepois();
    }));
  }

  // ---------- edições à mão (como no CapCut), guardadas no tempo do bruto ----------
  const brutoDe = (t) => { const sg = segNoFinal(t); return sg ? sg.g0 + Math.max(0, t - sg.o0) : null; };
  function mexeuManual(remontarTudo) { if (st.tocando) parar(); if (remontarTudo) montar(); else { montar(); } pintar(); salvarDepois(); }
  const hist = (k) => { (st.manual.hist = st.manual.hist || []).push(k); marcarDesfazer("manual"); };
  function porSom(tipo, t = st.t) { const g = brutoDe(t); if (g == null) return; hist("sons"); st.manual.sons.push({ id: uid(), g: +g.toFixed(2), tipo }); mexeuManual(); audio(); if (ac.state === "suspended") ac.resume(); tocarEfeito(tipo, ac.currentTime + 0.02, st.opc.vol); }
  function tirarSom(e, quieto) {
    if (e.manual) st.manual.sons = st.manual.sons.filter((m) => m.id !== e.id);
    else if (e.chave) { hist("tirados"); st.manual.tirados.push(e.chave); }
    st.sel = null; if (!quieto) mexeuManual();
  }
  function porZoom() { const g = brutoDe(st.t); if (g != null) { hist("zooms"); st.manual.zooms.push(+g.toFixed(2)); mexeuManual(); } }
  function porVisual(tipo) {
    const g = brutoDe(st.t); if (g == null) return;
    let itens;
    if (tipo === "checklist") { const txt = prompt("Itens do checklist, um por linha (aparecem e são marcados um a um):", "Item 1\nItem 2\nItem 3"); if (txt == null) return; itens = txt.split(/\n|;/).map((x) => x.trim()).filter(Boolean); }
    if (tipo === "grafico") { const txt = prompt("Barras do gráfico, uma por linha, no formato rótulo: valor", "Antes: 20\nDepois: 85"); if (txt == null) return; itens = txt.split(/\n|;/).map((x) => x.trim()).filter(Boolean); }
    hist("visuais"); (st.manual.visuais = st.manual.visuais || []).push({ id: uid(), g: +g.toFixed(2), tipo, ...(itens ? { itens } : {}) });
    mexeuManual(); toast("Efeito colocado. Dá o play para ver.");
  }
  function ligarMusica(box) {
    const arq = box.querySelector("[data-musica]");
    if (arq) arq.addEventListener("change", async () => {
      const a = arq.files && arq.files[0]; if (!a) return;
      try { audio(); const buf = await ac.decodeAudioData(await a.arrayBuffer()); st.musica = { nome: a.name, buf }; st.opc.musicaNome = a.name; if (st.opc.ducking === undefined) st.opc.ducking = true; guardarOpc(); pintarLinha(); salvarDepois(); toast("Música colocada. Ela abaixa sozinha quando você fala."); }
      catch (e) { toast("Não consegui ler essa música. Tente MP3 ou M4A.", true); }
    });
    const vol = box.querySelector("[data-mus-vol]"); if (vol) vol.addEventListener("change", () => { st.opc.musicaVol = Number(vol.value); guardarOpc(); salvarDepois(); });
    const dk = box.querySelector("[data-ducking]"); if (dk) dk.addEventListener("change", () => { st.opc.ducking = dk.checked; guardarOpc(); salvarDepois(); });
    const tir = box.querySelector("[data-mus-tirar]"); if (tir) tir.addEventListener("click", () => { st.musica = null; delete st.opc.musicaNome; guardarOpc(); pintarLinha(); salvarDepois(); });
  }
  function porFlash() { const g = brutoDe(st.t); if (g != null) { hist("flashes"); st.manual.flashes.push(+g.toFixed(2)); mexeuManual(); } }
  function dividir() { const g = brutoDe(st.t); if (g == null) return; hist("divisoes"); (st.manual.divisoes = st.manual.divisoes || []).push(+g.toFixed(2)); mexeuManual(); const i = st.segs.findIndex((x) => x.g0 >= g - 0.01); if (i >= 0) { st.sel = { tipo: "plano", i }; pintarLinha(); } }
  // ----- cenas como no CapCut: mover, trocar e ver os quadros -----
  function guardarOrdem() { const m = st.manual; (m.ordHist = m.ordHist || []).push(JSON.parse(JSON.stringify({ ordem: m.ordem || [], trocas: m.trocas || {} }))); if (m.ordHist.length > 30) m.ordHist.shift(); hist("ord"); }
  function moverPlano(de, para) {
    if (para < 0 || para >= st.segs.length || de === para) return;
    guardarOrdem();
    const chaves = st.segs.map((s) => s.chave), [k] = chaves.splice(de, 1); chaves.splice(para, 0, k);
    st.manual.ordem = chaves; mexeuManual();
    st.sel = { tipo: "plano", i: para }; irPara(st.segs[para].o0 + 0.02); pintarLinha();
    toast(`Cena movida para a posição ${para + 1}.`);
  }
  function quadrosDoPlano(sg) {
    const c = st.clipes[sg.ci]; if (!c || !c.tira || !c.tira.length) return "";
    const lista = c.tira.filter((q) => q.t >= sg.a - 0.3 && q.t <= sg.b); const n = Math.max(1, Math.min(8, Math.ceil((sg.b - sg.a) / 1.1)));
    const usar = lista.length ? Array.from({ length: Math.min(n, lista.length) }, (_, k) => lista[Math.floor(k * lista.length / Math.min(n, lista.length))]) : [c.tira[0]];
    return `<span class="rr-quadros">${usar.map((q) => `<img src="${q.src}" alt="" draggable="false">`).join("")}</span>`;
  }
  let fazendoTiras = false;
  async function gerarTiras() {
    if (fazendoTiras || st.exportando) return; const c = st.clipes.find((x) => !x.tira && x.el && x.el.src); if (!c) return;
    fazendoTiras = true;
    try {
      const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = c.el.src;
      v.style.cssText = "position:fixed;left:-9999px;width:2px;height:2px"; document.body.appendChild(v);
      await new Promise((ok) => { v.onloadeddata = ok; v.onerror = ok; setTimeout(ok, 5000); });
      const vw = v.videoWidth || 9, vh = v.videoHeight || 16, h = 64, w = Math.max(24, Math.round(h * vw / vh));
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const x = cv.getContext("2d");
      const passo = Math.max(0.5, (c.dur || 1) / 40), out = [];
      for (let t = 0; t < (c.dur || 0); t += passo) {
        v.currentTime = Math.min(t + 0.05, Math.max(0, c.dur - 0.05));
        await new Promise((ok) => { const f = () => { v.removeEventListener("seeked", f); ok(); }; v.addEventListener("seeked", f); setTimeout(ok, 1500); });
        try { x.drawImage(v, 0, 0, w, h); out.push({ t: +t.toFixed(2), src: cv.toDataURL("image/jpeg", 0.6) }); } catch (e) { break; }
      }
      v.remove(); c.tira = out.length ? out : [];
    } catch (e) { c.tira = []; }
    fazendoTiras = false;
    if (st.aba === "storyboard") pintarStoryboard(true);
    pintarLinha(); // desenha e chama de novo para o próximo clipe
  }
  function ligarArrastePlanos(box) {
    const trilha = box.querySelector(".rr-t-planos"); if (!trilha) return;
    trilha.querySelectorAll("[data-plano]").forEach((b) => {
      b.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        const de = Number(b.dataset.plano), x0 = e.clientX; let arrastando = false, fantasma = null, para = de;
        const espera = e.pointerType === "mouse" ? 0 : 250, t0 = Date.now();
        const mover = (ev) => {
          if (!arrastando) { if (Math.abs(ev.clientX - x0) < 8 || Date.now() - t0 < espera) return; arrastando = true; b.classList.add("arrastando"); fantasma = document.createElement("span"); fantasma.className = "rr-alvo"; trilha.appendChild(fantasma); try { b.setPointerCapture(e.pointerId); } catch (er) { /* segue */ } }
          ev.preventDefault();
          const blocos = [...trilha.querySelectorAll("[data-plano]")], r0 = trilha.getBoundingClientRect();
          const centro = (bl) => { const r = bl.getBoundingClientRect(); return r.left + r.width / 2; };
          const antes = blocos.filter((bl, k) => k !== de && centro(bl) < ev.clientX); para = antes.length;
          const ref = antes.length ? antes[antes.length - 1].getBoundingClientRect().right : blocos[0].getBoundingClientRect().left; fantasma.style.left = ref - r0.left + "px";
          b.style.transform = `translateX(${ev.clientX - x0}px)`;
        };
        const soltar = () => {
          window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); window.removeEventListener("pointercancel", soltar);
          if (!arrastando) return;
          b.dataset.arrastou = "1"; b.style.transform = ""; b.classList.remove("arrastando"); if (fantasma) fantasma.remove();
          if (para !== de) moverPlano(de, para);
        };
        window.addEventListener("pointermove", mover, { passive: false }); window.addEventListener("pointerup", soltar); window.addEventListener("pointercancel", soltar);
      });
    });
  }
  // "arrastar para o lado e escolher outra parte do vídeo" (como no CapCut): faixa com o clipe inteiro e a janela
  // do trecho usado; arrastar a janela desliza o trecho, as bordas encurtam ou aumentam, a prévia mostra o quadro
  function trechoHtml(sg, i) {
    const c = st.clipes[sg.ci]; if (!c) return "";
    const dur = c.dur || 1, l = (sg.a / dur * 100).toFixed(2), w = ((sg.b - sg.a) / dur * 100).toFixed(2);
    return `<div class="rr-trecho" data-trecho="${i}">
      <div class="rr-trecho-cab"><b>Cena ${i + 1}: escolha o trecho</b><small>${esc(c.nome)} · arraste a janela para o lado para pegar outra parte do vídeo, ou puxe as bordas para encurtar ou aumentar</small><span class="rr-trecho-tempo">${tempo(sg.a)} a ${tempo(sg.b)} · ${(sg.b - sg.a).toFixed(1).replace(".", ",")} s</span></div>
      <div class="rr-trecho-faixa">${(c.tira || []).map((q) => `<img src="${q.src}" alt="" draggable="false">`).join("") || `<span class="rr-trecho-carregando">carregando os quadros…</span>`}
        <div class="rr-trecho-janela" style="left:${l}%;width:${w}%"><span class="rr-borda esq" data-borda="esq"></span><span class="rr-borda dir" data-borda="dir"></span></div>
      </div>
    </div>`;
  }
  let quadroPedido = null;
  function previaBruto(ci, t) {
    const c = st.clipes[ci]; if (!c || !c2d) return;
    quadroPedido = t; c.el.currentTime = Math.max(0, Math.min(t, c.dur - 0.05));
    c.el.addEventListener("seeked", () => {
      if (quadroPedido !== t) return;
      const W = canvas.width, H = canvas.height, v = c.el, vw = v.videoWidth || 9, vh = v.videoHeight || 16, e2 = Math.max(W / vw, H / vh);
      c2d.fillStyle = "#1d1611"; c2d.fillRect(0, 0, W, H); c2d.drawImage(v, (W - vw * e2) / 2, (H - vh * e2) * 0.42, vw * e2, vh * e2);
    }, { once: true });
  }
  function ligarTrecho(box) {
    const el = box.querySelector("[data-trecho]"); if (!el) return;
    const i = Number(el.dataset.trecho), sg = st.segs[i], c = sg && st.clipes[sg.ci]; if (!c) return;
    const faixa = el.querySelector(".rr-trecho-faixa"), jan = el.querySelector(".rr-trecho-janela"), rot = el.querySelector(".rr-trecho-tempo");
    jan.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation();
      const modo = e.target.dataset.borda || "mover", r = faixa.getBoundingClientRect(), x0 = e.clientX, dur = c.dur, a0 = sg.a, b0 = sg.b;
      let a = a0, b = b0;
      try { jan.setPointerCapture(e.pointerId); } catch (er) { /* segue */ }
      const mover = (ev) => {
        const dt = (ev.clientX - x0) / r.width * dur;
        if (modo === "mover") { const len = b0 - a0; a = Math.max(0, Math.min(dur - len, a0 + dt)); b = a + len; }
        else if (modo === "esq") { a = Math.max(0, Math.min(b0 - 0.3, a0 + dt)); b = b0; }
        else { b = Math.min(dur, Math.max(a0 + 0.3, b0 + dt)); a = a0; }
        jan.style.left = (a / dur * 100) + "%"; jan.style.width = ((b - a) / dur * 100) + "%";
        rot.textContent = `${tempo(a)} a ${tempo(b)} · ${(b - a).toFixed(1).replace(".", ",")} s`;
        previaBruto(sg.ci, modo === "dir" ? b - 0.05 : a);
      };
      const soltar = () => {
        jan.removeEventListener("pointermove", mover); jan.removeEventListener("pointerup", soltar); jan.removeEventListener("pointercancel", soltar);
        if (Math.abs(a - a0) < 0.05 && Math.abs(b - b0) < 0.05) return;
        guardarOrdem();
        st.manual.trocas = { ...(st.manual.trocas || {}), [sg.chave]: { ci: sg.ci, a: +a.toFixed(2), b: +b.toFixed(2) } };
        mexeuManual(); st.sel = { tipo: "plano", i }; irPara((st.segs[i] ? st.segs[i].o0 : 0) + 0.02); pintarLinha();
      };
      jan.addEventListener("pointermove", mover); jan.addEventListener("pointerup", soltar); jan.addEventListener("pointercancel", soltar);
    });
  }
  function trocarCena(i) {
    const sg = st.segs[i]; if (!sg) return;
    const durOrig = +(sg.b - sg.a).toFixed(1);
    let escolha = { ci: sg.ci, a: sg.a };
    const dlg = document.createElement("dialog"); dlg.className = "janela janela-larga ed-trocar"; document.body.appendChild(dlg);
    const pintarDlg = () => {
      const c = st.clipes[escolha.ci], q = c && c.tira ? c.tira.reduce((m, x) => (Math.abs(x.t - escolha.a) < Math.abs(m.t - escolha.a) ? x : m), c.tira[0]) : null;
      dlg.innerHTML = `<div class="janela-cabeca"><div><small class="janela-sobretitulo">Plano ${i + 1}</small><h2>Trocar cena</h2></div><button class="icone-btn" type="button" data-x aria-label="Fechar">${ic.x || "×"}</button></div>
        <div class="janela-corpo"><p class="ed-obs">Escolha de qual vídeo e de qual momento vem esta cena. Toque num quadro para começar dali.</p>
          <div class="ed-trocar-topo">${q ? `<img class="ed-trocar-prev" src="${q.src}" alt="Quadro escolhido">` : ""}<div><b>${esc(c ? c.nome : "")}</b><br><small>começa em ${tempo(escolha.a)} · dura</small> <input class="entrada ed-trocar-dur" type="number" min="0.3" step="0.1" value="${escolha.dur ?? durOrig}"> <small>s</small></div></div>
          ${st.clipes.map((cl, ci) => `<div class="ed-trocar-clipe${ci === escolha.ci ? " atual" : ""}"><small>${ci + 1}. ${esc(cl.nome)} · ${tempo(cl.dur)}</small><div class="ed-trocar-tira">${(cl.tira || []).map((x) => `<button type="button" data-ci="${ci}" data-t="${x.t}" class="${ci === escolha.ci && Math.abs(x.t - escolha.a) < 0.3 ? "on" : ""}"><img src="${x.src}" alt="${tempo(x.t)}"><span>${tempo(x.t).replace(/,\d$/, "")}</span></button>`).join("") || "<span class=ed-obs>carregando quadros…</span>"}</div></div>`).join("")}
        </div>
        <div class="janela-rodape">${sg.trocado ? `<button class="btn" type="button" data-orig>Voltar à cena original</button>` : ""}<button class="btn" type="button" data-x>Cancelar</button><button class="btn btn-principal" type="button" data-usar>Usar este trecho</button></div>`;
      dlg.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", () => dlg.close()));
      dlg.querySelectorAll("[data-ci]").forEach((b) => b.addEventListener("click", () => { escolha = { ...escolha, ci: Number(b.dataset.ci), a: Number(b.dataset.t), dur: Number(dlg.querySelector(".ed-trocar-dur").value) || durOrig }; pintarDlg(); }));
      const orig = dlg.querySelector("[data-orig]"); if (orig) orig.addEventListener("click", () => { guardarOrdem(); delete (st.manual.trocas || {})[sg.chave]; dlg.close(); mexeuManual(); toast("A cena voltou a ser a original."); });
      dlg.querySelector("[data-usar]").addEventListener("click", () => {
        const dur = Math.max(0.3, Number(dlg.querySelector(".ed-trocar-dur").value) || durOrig), c2 = st.clipes[escolha.ci];
        guardarOrdem(); st.manual.trocas = { ...(st.manual.trocas || {}), [sg.chave]: { ci: escolha.ci, a: +escolha.a.toFixed(2), b: +Math.min(c2.dur, escolha.a + dur).toFixed(2) } };
        dlg.close(); mexeuManual(); st.sel = { tipo: "plano", i }; irPara(st.segs[i] ? st.segs[i].o0 + 0.02 : 0); pintarLinha(); toast("Cena trocada. Para voltar, use Desfazer.");
      });
    };
    dlg.addEventListener("close", () => dlg.remove());
    pintarDlg(); dlg.showModal();
    if (st.clipes.some((c) => !c.tira)) { gerarTiras(); const espera = setInterval(() => { if (!dlg.open) return clearInterval(espera); if (st.clipes.every((c) => c.tira)) { clearInterval(espera); pintarDlg(); } }, 800); }
  }
  function apagarPlano(sg) { if (st.segs.length <= 1) { toast("Esse é o único plano. Use Dividir aqui para separar o trecho que quer apagar.", true); return; } hist("cortes"); st.manual.cortes.push([+sg.g0.toFixed(2), +sg.g1.toFixed(2)]); st.sel = null; mexeuManual(); toast("Plano apagado. Para voltar, use Desfazer na linha do tempo."); }
  function desfazerManual() {
    const m = st.manual; m.divisoes = m.divisoes || [];
    m.visuais = m.visuais || [];
    const ult = [["visuais", m.visuais], ["cortes", m.cortes], ["divisoes", m.divisoes], ["sons", m.sons], ["zooms", m.zooms], ["flashes", m.flashes], ["tirados", m.tirados]].find(([, l]) => l.length);
    // desfaz o último tipo mexido (guardamos a ordem num histórico simples)
    const h = (st.manual.hist || []).pop();
    if (h === "ord" && (m.ordHist || []).length) { const f0 = m.ordHist.pop(); m.ordem = f0.ordem; m.trocas = f0.trocas; mexeuManual(); return; }
    if (h && m[h] && m[h].length) m[h].pop(); else if (ult) ult[1].pop(); else return;
    mexeuManual();
  }

  // ---------- linha do tempo: planos, legendas e efeitos ----------
  function pintarLinha() {
    const box = $("#ed-linha"); if (!box) return;
    if (!st.segs.length || !st.duracao) { box.hidden = true; return; }
    box.hidden = false;
    const d = st.duracao, pct = (t) => (Math.max(0, Math.min(d, t)) / d * 100).toFixed(3) + "%";
    const larg = Math.max(100, Math.round(d * 7));
    const marcas = []; for (let t = 0; t <= d; t += d > 60 ? 10 : 5) marcas.push(t);
    const sel = st.sel || {}, o = st.opc, m = st.manual;
    const temDesfazer = (m.ordHist || []).length || (m.divisoes || []).length || m.cortes.length || m.sons.length || m.zooms.length || m.flashes.length || m.tirados.length;
    const efSel = sel.tipo === "som" ? st.efeitos.find((e) => e.id === sel.id) : null;
    box.innerHTML = `<div class="rr-ferramentas">
        <button type="button" class="btn btn-principal" data-f="play">${st.tocando ? ic.pausa + "Pausar" : ic.play + "Play"}</button>
        <span class="rr-tempo-f">${tempo(st.t)}</span>
        <label class="rr-liga"><input type="checkbox" data-o="legenda" ${o.legenda !== false ? "checked" : ""}> Legenda</label>
        <label class="rr-liga"><input type="checkbox" data-o="titulo" ${o.titulo ? "checked" : ""}> Título</label>
        <label class="rr-liga"><input type="checkbox" data-o="efeitos" ${o.efeitos ? "checked" : ""}> Sons</label>
        <span class="rr-sep"></span>
        <select class="entrada" id="rr-som-tipo" aria-label="Efeito sonoro">${Object.entries(EFEITOS).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select>
        <button type="button" class="btn" data-f="som">${ic.som}+ Som aqui</button>
        <button type="button" class="btn" data-f="zoom">+ Zoom aqui</button>
        <button type="button" class="btn" data-f="flash">+ Flash aqui</button>
        <select class="entrada" id="rr-vis-tipo" aria-label="Efeito visual">${VISUAIS.map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select>
        <button type="button" class="btn" data-f="visual">✦ + Efeito aqui</button>
        <button type="button" class="btn" data-f="dividir">Dividir aqui</button>
        ${sel.tipo === "plano" ? `<button type="button" class="btn" data-f="mover-tras" ${sel.i > 0 ? "" : "disabled"}>◀ Mover para trás</button><button type="button" class="btn" data-f="mover-frente" ${sel.i < st.segs.length - 1 ? "" : "disabled"}>Mover para frente ▶</button><button type="button" class="btn" data-f="trocar-cena">⇄ Trocar cena</button><button type="button" class="btn rr-perigo" data-f="apagar-plano">Apagar este plano</button>` : ""}
        ${efSel ? `<span class="rr-sel">${esc(EFEITOS[efSel.tipo] || efSel.tipo)} em ${tempo(efSel.t)}</span><button type="button" class="btn" data-f="ouvir-som">${ic.som}Ouvir</button><button type="button" class="btn rr-perigo" data-f="tirar-som">Tirar este som</button>` : ""}
        ${sel.tipo === "zoom" ? `<button type="button" class="btn rr-perigo" data-f="tirar-zoom">Tirar este zoom</button>` : ""}
        ${sel.tipo === "flash" ? `<button type="button" class="btn rr-perigo" data-f="tirar-flash">Tirar este flash</button>` : ""}
        ${sel.tipo === "visual" ? `<span class="rr-sel">${esc((VISUAIS.find(([k]) => k === (st.visuais[sel.i] || {}).tipo) || ["", "Efeito"])[1])}</span>${["checklist", "grafico"].includes((st.visuais[sel.i] || {}).tipo) ? `<button type="button" class="btn" data-f="editar-visual">Editar itens</button>` : ""}${["celular", "checklist", "grafico"].includes((st.visuais[sel.i] || {}).tipo) ? `<button type="button" class="btn" data-f="dur-visual">Duração</button>` : ""}<button type="button" class="btn rr-perigo" data-f="tirar-visual">Tirar este efeito</button>` : ""}
        ${temDesfazer ? `<button type="button" class="btn" data-f="desfazer">Desfazer</button>` : ""}
      </div>
      ${sel.tipo === "plano" && st.segs[sel.i] ? trechoHtml(st.segs[sel.i], sel.i) : ""}
      <div class="rr-linha-rolar"><div class="rr-linha-dentro" style="width:${larg}%">
      <div class="rr-regua" data-buscar>${marcas.map((t) => `<span style="left:${pct(t)}">${tempo(t).replace(/,\d$/, "")}</span>`).join("")}</div>
      <div class="rr-trilha rr-t-leg${o.legenda === false ? " desligada" : ""}">${st.legendas.map((g) => `<button type="button" class="rr-chip" data-ir="${g.o0}" style="left:${pct(g.o0)};width:calc(${pct(g.o1 - g.o0)} - 3px)" title="${esc(textoLeg(g))}"><b>T</b> ${esc(textoLeg(g))}</button>`).join("")}</div>
      <div class="rr-trilha rr-t-planos">${st.segs.map((sg, i) => `<button type="button" class="rr-plano-bl${i % 2 ? " par" : ""}${sg.zoom > 1 ? " zoom" : ""}${sg.trocado ? " trocado" : ""}${sel.tipo === "plano" && sel.i === i ? " sel" : ""}" data-plano="${i}" style="left:${pct(sg.o0)};width:calc(${pct(sg.o1 - sg.o0)} - 2px)" title="Plano ${i + 1} (${esc(st.clipes[sg.ci] ? st.clipes[sg.ci].nome : "")}): toque para escolher, arraste para mudar de lugar">${quadrosDoPlano(sg)}<span class="rr-plano-n">${i + 1}</span></button>`).join("")}</div>
      <div class="rr-trilha rr-t-fx">${(st.zoomsManuais || []).map((t, i) => `<button type="button" class="rr-zoom${sel.tipo === "zoom" && sel.i === i ? " sel" : ""}" data-zoom="${i}" style="left:${pct(t)}" title="Zoom em ${tempo(t)}">Z</button>`).join("")}${(st.flashes || []).map((t, i) => `<button type="button" class="rr-flash${sel.tipo === "flash" && sel.i === i ? " sel" : ""}" data-flash="${i}" style="left:${pct(t)}" title="Flash em ${tempo(t)}">F</button>`).join("")}${(st.visuais || []).map((x, i) => `<button type="button" class="rr-vis${sel.tipo === "visual" && sel.i === i ? " sel" : ""}" data-vis="${i}" style="left:${pct(x.t)}" title="${esc((VISUAIS.find(([k]) => k === x.tipo) || ["", x.tipo])[1])} em ${tempo(x.t)}">${LETRA_VIS[x.tipo] || "✦"}</button>`).join("")}</div>
      <div class="rr-trilha rr-t-sons${o.efeitos ? "" : " desligada"}">${st.efeitos.map((e) => `<button type="button" class="rr-som${e.manual ? " manual" : ""}${sel.tipo === "som" && sel.id === e.id ? " sel" : ""}" data-som="${e.id}" style="left:${pct(e.t)}" title="${esc((EFEITOS[e.tipo] || e.tipo) + (e.por_que ? ": " + e.por_que : ""))}"></button>`).join("")}</div>
      <span class="rr-agulha" id="ed-agulha" style="left:${pct(st.t)}"></span>
    </div></div>
    <div class="rr-musica">♪ <b>Música de fundo</b>
      ${st.musica && st.musica.buf ? `<span class="rr-mus-nome">${esc(st.musica.nome)}</span>` : st.opc.musicaNome ? `<span class="rr-mus-nome falta">${esc(st.opc.musicaNome)} (escolha o arquivo de novo)</span>` : ""}
      <label class="btn rr-mus-btn">${st.musica && st.musica.buf ? "Trocar" : "Escolher música"}<input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" hidden data-musica></label>
      ${st.musica && st.musica.buf ? `<label class="rr-mus-vol">volume <input type="range" min="0" max="1" step="0.05" value="${st.opc.musicaVol ?? 0.35}" data-mus-vol></label><label class="rr-liga"><input type="checkbox" data-ducking ${st.opc.ducking !== false ? "checked" : ""}> Ducking (abaixa quando eu falo)</label><button type="button" class="login-link" data-mus-tirar>tirar</button>` : `<small>a música abaixa sozinha quando você fala (ducking)</small>`}</div>
    <p class="rr-legenda-linha"><span class="rr-chip-mini"></span> legendas · <span class="rr-plano-mini"></span> cenas (arraste para mudar de lugar; toque para mover, trocar ou apagar; Dividir aqui separa) · Z zoom · F flash · <span class="rr-som-mini"></span> sons (toque para ouvir ou tirar) · toque na régua para ir até o ponto</p>`;
    const f = (k) => box.querySelector(`[data-f="${k}"]`);
    f("play").addEventListener("click", () => { if (st.tocando) parar(); else tocar(st.t); setTimeout(pintarLinha, 50); });
    $$("[data-o]", box).forEach((c) => c.addEventListener("change", () => { o[c.dataset.o] = c.checked; if (c.dataset.o === "titulo") sonsDoTitulo(); guardarOpc(); pintar(); }));
    f("som").addEventListener("click", () => porSom($("#rr-som-tipo", box).value));
    f("zoom").addEventListener("click", porZoom);
    f("flash").addEventListener("click", porFlash);
    f("dividir").addEventListener("click", dividir);
    if (f("apagar-plano")) f("apagar-plano").addEventListener("click", () => apagarPlano(st.segs[sel.i]));
    if (f("mover-tras")) f("mover-tras").addEventListener("click", () => moverPlano(sel.i, sel.i - 1));
    if (f("mover-frente")) f("mover-frente").addEventListener("click", () => moverPlano(sel.i, sel.i + 1));
    if (f("trocar-cena")) f("trocar-cena").addEventListener("click", () => trocarCena(sel.i));
    ligarArrastePlanos(box);
    ligarTrecho(box);
    gerarTiras();
    if (f("tirar-som")) f("tirar-som").addEventListener("click", () => tirarSom(efSel));
    if (f("ouvir-som")) f("ouvir-som").addEventListener("click", () => { audio(); if (ac.state === "suspended") ac.resume(); tocarEfeito(efSel.tipo, ac.currentTime + 0.02, o.vol); });
    if (f("tirar-zoom")) f("tirar-zoom").addEventListener("click", () => { st.manual.zooms.splice(sel.i, 1); st.sel = null; mexeuManual(); });
    f("visual").addEventListener("click", () => porVisual($("#rr-vis-tipo", box).value));
    $$("[data-vis]", box).forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.vis); st.sel = { tipo: "visual", i }; irPara(st.visuais[i].t + 0.05); pintarLinha(); }));
    const visSel = sel.tipo === "visual" ? (st.manual.visuais || []).find((x) => x.id === (st.visuais[sel.i] || {}).id) : null;
    if (f("tirar-visual")) f("tirar-visual").addEventListener("click", () => { st.manual.visuais = st.manual.visuais.filter((x) => x !== visSel); st.sel = null; mexeuManual(); });
    if (f("editar-visual")) f("editar-visual").addEventListener("click", () => { const txt = prompt(visSel.tipo === "grafico" ? "Uma barra por linha, no formato rótulo: valor (ex.: Antes: 20)" : "Um item por linha", (visSel.itens || []).join("\n")); if (txt == null) return; visSel.itens = txt.split(/\n|;/).map((x) => x.trim()).filter(Boolean); mexeuManual(); });
    if (f("dur-visual")) f("dur-visual").addEventListener("click", () => { const txt = prompt("Quantos segundos o efeito fica na tela?", String(visSel.dur || (visSel.tipo === "checklist" ? (visSel.itens || []).length * 1.1 + 2.2 : visSel.tipo === "grafico" ? 4.5 : 3)).replace(".", ",")); if (txt == null) return; const n = Number(String(txt).replace(",", ".")); if (n > 0) { visSel.dur = Math.min(20, n); mexeuManual(); } });
    ligarMusica(box);
    if (f("tirar-flash")) f("tirar-flash").addEventListener("click", () => { st.manual.flashes.splice(sel.i, 1); st.sel = null; mexeuManual(); });
    if (f("desfazer")) f("desfazer").addEventListener("click", desfazerManual);
    $$("[data-ir]", box).forEach((b) => b.addEventListener("click", () => irPara(Number(b.dataset.ir) + 0.02)));
    $$("[data-plano]", box).forEach((b) => b.addEventListener("click", () => { if (b.dataset.arrastou) { delete b.dataset.arrastou; return; } const i = Number(b.dataset.plano); st.sel = { tipo: "plano", i }; irPara(st.segs[i].o0 + 0.02); pintarLinha(); }));
    $$("[data-som]", box).forEach((b) => b.addEventListener("click", () => { const e = st.efeitos.find((x) => x.id === b.dataset.som); if (!e) return; st.sel = { tipo: "som", id: e.id }; irPara(Math.max(0, e.t - 0.02)); pintarLinha(); }));
    $$("[data-zoom]", box).forEach((b) => b.addEventListener("click", () => { st.sel = { tipo: "zoom", i: Number(b.dataset.zoom) }; pintarLinha(); }));
    $$("[data-flash]", box).forEach((b) => b.addEventListener("click", () => { st.sel = { tipo: "flash", i: Number(b.dataset.flash) }; pintarLinha(); }));
    const regua = $("[data-buscar]", box);
    regua.addEventListener("click", (e) => { const r = regua.getBoundingClientRect(); irPara(Math.max(0, Math.min(d - 0.05, (e.clientX - r.left) / r.width * d))); });
  }

  // posts do Painel de conteúdo com roteiro, para puxar para o campo
  async function carregarPosts() {
    try {
      const { data } = await banco().from("painel_conteudo").select("id,tema,formato,data,hook,desenvolvimento,cta").not("desenvolvimento", "is", null).order("data", { ascending: false, nullsFirst: false }).limit(60);
      st.posts = data || [];
    } catch (e) { st.posts = []; }
    const sel = $("#ed-puxar"); if (!sel) return;
    sel.hidden = !st.posts.length;
    sel.innerHTML = `<option value="">Puxar de um post do Painel de conteúdo…</option>` + st.posts.map((p) => `<option value="${p.id}">${p.data ? p.data.slice(8, 10) + "/" + p.data.slice(5, 7) + " · " : ""}${esc(p.formato || "")} · ${esc(String(p.tema || "Sem tema").slice(0, 60))}</option>`).join("");
  }

  // arrastar cenas: mouse (arrastar e soltar do navegador) e dedo (segura 0,3 s e arrasta)
  function ligarArrasteClipes(lista) {
    if (!lista || st.trabalhando || st.exportando) return;
    const linhas = () => [...lista.querySelectorAll(".ed-clipe")];
    const alvoEm = (y) => linhas().find((el) => { const r = el.getBoundingClientRect(); return y < r.top + r.height / 2; });
    let arrastando = null;
    lista.querySelectorAll(".ed-clipe").forEach((el) => {
      el.addEventListener("dragstart", (e) => { arrastando = el.dataset.clipe; el.classList.add("arrastando"); try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", arrastando); } catch (er) { /* segue */ } });
      el.addEventListener("dragend", () => { el.classList.remove("arrastando"); linhas().forEach((x) => x.classList.remove("antes")); arrastando = null; });
      let timer = null, ativo = false;
      el.addEventListener("touchstart", (e) => {
        if (e.target.closest("button")) return;
        timer = setTimeout(() => { ativo = true; arrastando = el.dataset.clipe; el.classList.add("arrastando"); if (navigator.vibrate) navigator.vibrate(15); }, 300);
      }, { passive: true });
      el.addEventListener("touchmove", (e) => {
        if (!ativo) { clearTimeout(timer); return; }
        e.preventDefault();
        const alvo = alvoEm(e.touches[0].clientY); linhas().forEach((x) => x.classList.toggle("antes", x === alvo && x !== el));
      }, { passive: false });
      el.addEventListener("touchend", (e) => {
        clearTimeout(timer); if (!ativo) return; ativo = false; el.classList.remove("arrastando");
        const alvo = alvoEm(e.changedTouches[0].clientY); linhas().forEach((x) => x.classList.remove("antes"));
        const id = arrastando; arrastando = null; soltarClipe(id, alvo ? alvo.dataset.clipe : null);
      });
    });
    lista._arrastando = () => arrastando; lista._largar = () => { const id = arrastando; arrastando = null; return id; };
    if (lista.dataset.ligada) return; lista.dataset.ligada = "1";
    const linhasL = () => [...lista.querySelectorAll(".ed-clipe")];
    const alvoL = (y) => linhasL().find((el) => { const r = el.getBoundingClientRect(); return y < r.top + r.height / 2; });
    lista.addEventListener("dragover", (e) => { if (!lista._arrastando()) return; e.preventDefault(); const alvo = alvoL(e.clientY); linhasL().forEach((x) => x.classList.toggle("antes", x === alvo)); });
    lista.addEventListener("drop", (e) => { if (!lista._arrastando()) return; e.preventDefault(); e.stopPropagation(); const alvo = alvoL(e.clientY); const id = lista._largar(); soltarClipe(id, alvo ? alvo.dataset.clipe : null); });
  }

  function pintar() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec || !$("#ed-clipes", sec)) return;
    $("#ed-clipes", sec).innerHTML = (st.pendentes ? `<div class="faixa ed-pendentes"><b>Projeto "${esc(st.projeto ? st.projeto.nome : "")}"</b>: escolha de novo ${st.pendentes.length > 1 ? "os vídeos" : "o vídeo"} deste projeto para a edição voltar como você deixou: ${st.pendentes.map((x) => `<span class="${x.usado ? "ok" : ""}">${esc(x.nome)}${x.usado ? " ✓" : ""}</span>`).join(", ")}.</div>` : "") + (st.clipes.length > 1 ? `<p class="ed-clipes-dica">Arraste a cena (ou use as setas) para trocar a ordem. O X tira a cena; para colocar outra, envie mais vídeos.</p>` : "") + st.clipes.map((c, i) => `<div class="ed-clipe" data-clipe="${c.id}" draggable="${st.trabalhando || st.exportando ? "false" : "true"}"><span class="ed-alca" aria-hidden="true">${ic.alca}</span><span class="ed-num">${i + 1}</span>${c.capa ? `<img class="ed-capa-clipe" src="${c.capa}" alt="">` : ""}<div><b>${esc(c.nome)}</b><small>${tempo(c.dur)}${c.w ? ` · ${c.w}x${c.h}` : ""}${c.mudo ? " · sem som" : c.palavras ? ` · ${c.palavras.length} palavras ouvidas` : ""}</small></div>
      <button class="icone-btn" type="button" data-mover="${c.id}" data-passo="-1" aria-label="Subir cena" ${i === 0 || st.trabalhando || st.exportando ? "disabled" : ""}>${ic.cima}</button>
      <button class="icone-btn" type="button" data-mover="${c.id}" data-passo="1" aria-label="Descer cena" ${i === st.clipes.length - 1 || st.trabalhando || st.exportando ? "disabled" : ""}>${ic.baixo}</button>
      <button class="icone-btn" type="button" data-tirar="${c.id}" aria-label="Tirar clipe" ${st.trabalhando || st.exportando ? "disabled" : ""}>${ic.x}</button></div>`).join("");
    $$("[data-mover]", sec).forEach((b) => b.addEventListener("click", () => moverClipe(b.dataset.mover, +b.dataset.passo)));
    ligarArrasteClipes($("#ed-clipes", sec));
    $$("[data-tirar]", sec).forEach((b) => b.addEventListener("click", () => {
      const c = st.clipes.find((x) => x.id === b.dataset.tirar); if (!c) return;
      c.el.remove(); URL.revokeObjectURL(c.el.src); st.clipes = st.clipes.filter((x) => x !== c); st.segs = []; st.plano = null; st.editLeg = {}; pintar();
    }));
    const bt = $("#ed-editar", sec);
    bt.disabled = st.trabalhando || st.exportando || !st.clipes.length || Boolean(st.pendentes);
    bt.innerHTML = st.trabalhando ? "Editando…" : st.pendentes ? `${ic.filme}Escolha de novo os vídeos deste projeto (no quadro acima) para editar` : !st.clipes.length ? `${ic.filme}Envie o vídeo bruto acima para editar` : `${ic.brilho}${st.plano ? "Editar de novo" : "Editar automático"}`;
    $$("[data-formato]", sec).forEach((b) => b.classList.toggle("on", (st.opc.formato || "vertical") === b.dataset.formato));
    pintarRefRapido();
    prepararCanvas(); ligarArrasteCamadas(); ligarAtalhoDesfazer();
    if (st.aba === "textos") pintarCamadas();
    $("#ed-vazio", sec).hidden = Boolean(st.segs.length);
    pintarEtapas(); pintarAjustes(); pintarCortes(); pintarLegendas(); pintarPlano(); pintarControles(); pintarFinal(); pintarCapa(); pintarLinha(); pintarAbas(); pintarModo(); pintarOuvi(); pintarAjustar(); pintarPassos();
    if (st.aba === "estilos") pintarEstilos(); else if (st.aba === "efeitos") pintarEfeitos(); else if (st.aba === "referencia") pintarReferencia(); else if (st.aba === "carrossel") pintarCarrossel(); else if (st.aba === "storyboard") pintarStoryboard(true); else if (st.aba === "variacoes") pintarVariacoes(true);
    pintarTrabalhando();
    if (st.segs.length && !st.tocando) desenhar(st.t);
  }
  // o que o painel ouviu do vídeo (a fala transcrita, com tempo), para ela conferir
  function pintarOuvi() {
    const box = $("#ed-ouvi"); if (!box) return;
    const ws = palavrasBrutas();
    if (!ws.length) { box.hidden = true; return; }
    box.hidden = false;
    const aberto = box.querySelector("details") && box.querySelector("details").open;
    box.innerHTML = `<details${aberto ? " open" : ""}><summary class="ed-titulo-linha"><h3 class="ed-titulo">O que eu ouvi no vídeo</h3><span class="ed-sub">${ws.length} palavras</span></summary>
      <p class="ed-obs">Eu escuto o áudio do vídeo que você enviou e escrevo a fala com o tempo de cada palavra (não uso o roteiro para isso). Música e barulhos eu não transcrevo, só a fala.</p>
      <p class="rr-ouvi">${ws.map((w, i) => (i && w.s - ws[i - 1].e > 0.7 ? `</p><p class="rr-ouvi"><span class="rr-ts">${tempo(w.s)}</span> ` : i ? "" : `<span class="rr-ts">${tempo(w.s)}</span> `) + esc(w.w)).join(" ")}</p></details>`;
  }
  function pintarModo() {
    const p = $("#ed-modo"); if (!p) return;
    if (!st.segs.length) { p.textContent = ""; return; }
    const bruto = st.clipes.reduce((a, c) => a + c.dur, 0);
    p.innerHTML = `Corte: <b>${tempo(bruto)}</b> → <b>${tempo(st.duracao)}</b> · ${st.segs.length} planos · ${st.legendas.length} legendas · ${st.efeitos.length} sons`;
  }
  function pintarEtapas() {
    const ol = $("#ed-etapas"); if (!ol) return;
    ol.innerHTML = st.etapas.map((e) => `<li class="${e.estado}">${esc(e.texto)}</li>`).join("");
  }
  function pintarControles() {
    const fp = document.querySelector('#ed-linha [data-f="play"]'); if (fp) fp.innerHTML = st.tocando && !st.exportando ? ic.pausa + "Pausar" : ic.play + "Play";
    const box = $("#ed-controles"); if (!box) return;
    const ok = st.segs.length > 0;
    box.innerHTML = `<button class="btn btn-principal" type="button" id="ed-play" ${!ok || st.exportando ? "disabled" : ""}>${st.tocando && !st.exportando ? ic.pausa + "Pausar" : ic.play + "Play"}</button>
      <input type="range" id="ed-barra" min="0" max="${Math.max(0.1, st.duracao).toFixed(2)}" step="0.05" value="${st.t.toFixed(2)}" ${!ok || st.tocando ? "disabled" : ""} aria-label="Posição">
      <span class="ed-tempo" id="ed-tempo">${tempo(st.t)} / ${tempo(st.duracao)}</span>
      <button class="btn btn-leve ed-desfazer" type="button" data-desfazer-tudo title="Desfazer a última mudança (Ctrl+Z)" ${podeDesfazer() && !st.exportando ? "" : "disabled"}>${ic.desfazer}Desfazer</button>`;
    $("[data-desfazer-tudo]", box).addEventListener("click", desfazerTudo);
    const play = $("#ed-play", box);
    play.addEventListener("click", () => { if (st.tocando) parar(); else tocar(st.t); });
    const barra = $("#ed-barra", box);
    barra.addEventListener("input", async () => {
      st.t = Number(barra.value); atualizarTempo();
      const s = segNoFinal(st.t); if (!s) return;
      const v = st.clipes[s.ci].el; v.currentTime = s.a + (st.t - s.o0); await esperarEvento(v, "seeked"); desenhar(st.t);
    });
  }
  function atualizarTempo() { const t = $("#ed-tempo"); if (t) t.textContent = `${tempo(st.t)} / ${tempo(st.duracao)}`; const r = $("#ed-relogio"); if (r) r.textContent = tempo(st.t); const ag = $("#ed-agulha"); if (ag && st.duracao) ag.style.left = (Math.min(st.t, st.duracao) / st.duracao * 100).toFixed(3) + "%"; const b = $("#ed-barra"); if (b && st.tocando) b.value = st.t; }

  function pintarAjustes() {
    const box = $("#ed-ajustes"); if (!box) return;
    if (!st.segs.length) { box.hidden = true; return; }
    box.hidden = false;
    const o = st.opc, chk = (k, t) => `<label class="ed-chk"><input type="checkbox" data-opc="${k}" ${o[k] ? "checked" : ""}> ${t}</label>`;
    box.innerHTML = `<h3 class="ed-titulo">Ajustes</h3>
      <label class="ed-rotulo" for="ed-titulo-txt">Título do gancho</label>
      <input class="entrada" id="ed-titulo-txt" value="${esc(st.titulo)}" maxlength="60" placeholder="Sem título">
      <select class="entrada" id="ed-estilo-titulo" aria-label="Estilo do título">${Object.entries(TITULOS).map(([k, t]) => `<option value="${k}" ${o.estiloTitulo === k ? "selected" : ""}>${t}</option>`).join("")}</select>
      <label class="ed-rotulo" for="ed-estilo">Legenda</label>
      <select class="entrada" id="ed-estilo">${Object.entries(ESTILOS).map(([k, t]) => `<option value="${k}" ${o.estilo === k ? "selected" : ""}>${t}</option>`).join("")}</select>
      <label class="ed-rotulo" for="ed-altura">Altura da legenda</label>
      <input type="range" id="ed-altura" min="0.35" max="0.88" step="0.01" value="${o.altura}">
      <div class="ed-linha"><label class="ed-rotulo" for="ed-cor">Cor do destaque</label><input type="color" id="ed-cor" value="${o.cor}"></div>
      ${o.estilo === "capcut" ? `<label class="ed-rotulo" for="ed-fonte">Fonte da legenda</label>
      <select class="entrada" id="ed-fonte">${Object.entries(FONTES_LEG).filter(([k]) => k !== "minha" || st.minhaFonte).map(([k, t]) => `<option value="${k}" ${o.fonteLeg === k ? "selected" : ""}>${k === "minha" ? esc(st.minhaFonte) : t}</option>`).join("")}</select>
      <label class="btn ed-enviar-fonte">${st.minhaFonte ? "Trocar minha fonte" : "Enviar minha fonte (Bootzy)"}<input type="file" id="ed-fonte-arq" accept=".ttf,.otf,.woff,.woff2,font/*" hidden></label>
      <label class="ed-rotulo" for="ed-tamleg">Tamanho da legenda</label>
      <input type="range" id="ed-tamleg" min="0.7" max="1.5" step="0.05" value="${o.tamLeg || 1}">
      <div class="ed-linha"><label class="ed-rotulo" for="ed-sombra">Sombra</label><select class="entrada" id="ed-sombra"><option value="suave" ${o.sombra !== "dura" ? "selected" : ""}>Suave</option><option value="dura" ${o.sombra === "dura" ? "selected" : ""}>Dura (deslocada)</option></select></div>
      <div class="ed-linha"><label class="ed-rotulo" for="ed-por">Palavras por legenda</label><select class="entrada" id="ed-por">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${Number(o.porLegenda) === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="ed-linha"><label class="ed-rotulo" for="ed-cor-leg">Cor da legenda</label><span class="ed-cores">${["#fff3b0", "#ffffff", "#ffe45c"].map((c) => `<button type="button" class="ed-cor${o.corLegenda === c ? " ativa" : ""}" data-cor-leg="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join("")}<input type="color" id="ed-cor-leg" value="${o.corLegenda}"></span></div>` : ""}
      <div class="ed-linha"><label class="ed-rotulo" for="ed-sons">Quantidade de efeitos sonoros</label><select class="entrada" id="ed-sons">${QTD_SONS.map(([k, t]) => `<option value="${k}" ${o.sons === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="ed-linha"><label class="ed-rotulo" for="ed-dina">Dinamismo</label><select class="entrada" id="ed-dina">${DINAMISMO.map(([k, t]) => `<option value="${k}" ${o.dinamismo === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="ed-linha"><label class="ed-rotulo" for="ed-trans">Transição nos cortes</label><select class="entrada" id="ed-trans">${[["nenhuma", "Nenhuma"], ["punch", "Zoom rápido"], ["deslize", "Zoom rápido + deslize na troca de cena"]].map(([k, t]) => `<option value="${k}" ${o.transicao === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="ed-linha"><label class="ed-rotulo" for="ed-ritmo">Ritmo dos cortes</label><select class="entrada" id="ed-ritmo">${[["normal", "Normal (deixa respiro)"], ["rapido", "Rápido (corta respiros)"], ["turbo", "Turbo (sem nenhuma pausa)"]].map(([k, t]) => `<option value="${k}" ${(o.ritmo || "rapido") === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="ed-chks">${chk("chamativas", "Palavras chamativas (grandes, coloridas)")}${chk("sonsChamativas", "Pop nas palavras chamativas")}${chk("tremer", "Tremidinha no impacto")}${chk("flash", "Flash na troca de cena")}</div>
      <div class="ed-chks">${chk("silencio", "Cortar silêncios")}${chk("erros", "Tirar tomadas erradas")}${chk("vicios", "Tirar vícios (éé, ahn, hum)")}${chk("vozForte", "Voz no volume do Instagram")}${chk("zoomCortes", "Zoom alternado nos cortes")}${chk("zoomEnfase", "Zoom na ênfase")}${chk("legenda", "Mostrar legenda")}${chk("titulo", "Mostrar título")}${chk("sonsTitulo", "Som de clique no título")}${chk("efeitos", "Efeitos sonoros")}${chk("maiusculas", "Legenda em maiúsculas")}</div>
      <label class="ed-rotulo" for="ed-vol">Volume dos efeitos</label>
      <input type="range" id="ed-vol" min="0" max="1.2" step="0.05" value="${o.vol}">
      <label class="ed-rotulo" for="ed-formato">Formato do vídeo</label>
      <select class="entrada" id="ed-formato"><option value="vertical" ${o.formato !== "horizontal" ? "selected" : ""}>Vertical 9:16 (Reels, TikTok)</option><option value="horizontal" ${o.formato === "horizontal" ? "selected" : ""}>Horizontal 16:9 (deitado)</option></select>
      <label class="ed-rotulo" for="ed-qual">Qualidade do arquivo</label>
      <select class="entrada" id="ed-qual"><option value="1080" ${o.qualidade === 1080 ? "selected" : ""}>${o.formato === "horizontal" ? "1920 x 1080" : "1080 x 1920"} (Full HD)</option><option value="720" ${o.qualidade === 720 ? "selected" : ""}>${o.formato === "horizontal" ? "1280 x 720" : "720 x 1280"} (mais leve)</option></select>`;
    $("#ed-titulo-txt", box).addEventListener("input", (e) => { st.titulo = e.target.value; if (!st.tocando) desenhar(Math.min(st.t, 1.2)); });
    $("#ed-titulo-txt", box).addEventListener("change", () => { sonsDoTitulo(); pintarPlano(); });
    $("#ed-estilo-titulo", box).addEventListener("change", (e) => { o.estiloTitulo = e.target.value; sonsDoTitulo(); pintarPlano(); if (!st.tocando) { st.t = Math.min(st.t, 1.2); desenhar(st.t); } });
    box.onchange = guardarOpc;
    $("#ed-estilo", box).addEventListener("change", (e) => { o.estilo = e.target.value; remontar(); });
    $("#ed-sons", box).addEventListener("change", (e) => { o.sons = e.target.value; remontar(); });
    $("#ed-dina", box).addEventListener("change", (e) => { o.dinamismo = e.target.value; if (o.dinamismo !== "calmo") { o.relaxante = false; o.sonsSuaves = false; } remontar(); });
    $("#ed-trans", box).addEventListener("change", (e) => { o.transicao = e.target.value; guardarOpc(); redesenhar(); });
    $("#ed-ritmo", box).addEventListener("change", (e) => { o.ritmo = e.target.value; remontar(); });
    const fsel = $("#ed-fonte", box); if (fsel) fsel.addEventListener("change", (e) => { o.fonteLeg = e.target.value; guardarOpc(); redesenhar(); });
    const tl = $("#ed-tamleg", box); if (tl) tl.addEventListener("input", (e) => { o.tamLeg = Number(e.target.value); redesenhar(); });
    const som = $("#ed-sombra", box); if (som) som.addEventListener("change", (e) => { o.sombra = e.target.value; guardarOpc(); redesenhar(); });
    const farq = $("#ed-fonte-arq", box); if (farq) farq.addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) enviarFonte(f); });
    const por = $("#ed-por", box); if (por) por.addEventListener("change", (e) => { o.porLegenda = Number(e.target.value); remontar(); });
    const corLeg = $("#ed-cor-leg", box); if (corLeg) corLeg.addEventListener("input", (e) => { o.corLegenda = e.target.value; redesenhar(); });
    $$("[data-cor-leg]", box).forEach((b) => b.addEventListener("click", () => { o.corLegenda = b.dataset.corLeg; guardarOpc(); pintarAjustes(); redesenhar(); }));
    $("#ed-altura", box).addEventListener("input", (e) => { o.altura = Number(e.target.value); redesenhar(); });
    $("#ed-cor", box).addEventListener("input", (e) => { o.cor = e.target.value; redesenhar(); });
    $("#ed-vol", box).addEventListener("input", (e) => { o.vol = Number(e.target.value); });
    $("#ed-qual", box).addEventListener("change", (e) => { o.qualidade = Number(e.target.value); prepararCanvas(); redesenhar(); });
    $("#ed-formato", box).addEventListener("change", (e) => { o.formato = e.target.value; prepararCanvas(); redesenhar(); salvarDepois(); });
    $$("[data-opc]", box).forEach((c) => c.addEventListener("change", () => {
      o[c.dataset.opc] = c.checked;
      // cortes mudam a linha do tempo inteira: monta de novo (os efeitos voltam aos do plano)
      if (c.dataset.opc === "vozForte") { ajustarVoz(); guardarOpc(); return; }
      if (["silencio", "erros", "zoomCortes", "chamativas", "sonsChamativas", "vicios"].includes(c.dataset.opc)) { remontar(); pintarCortes(); }
      else { if (c.dataset.opc === "titulo" || c.dataset.opc === "sonsTitulo") { sonsDoTitulo(); pintarPlano(); } redesenhar(); }
    }));
  }
  function redesenhar() { if (!st.tocando) desenhar(st.t); }
  function remontar() { if (st.tocando) parar(); montar(); st.t = Math.min(st.t, st.duracao); guardarOpc(); pintar(); }

  // ---------- editor de legendas (como no CapCut) ----------
  // ---------- revisar cortes: toca na palavra para cortar ou devolver ----------
  function pintarCortes() {
    const box = $("#ed-cortes"); if (!box) return;
    const ws = palavrasRevisao();
    if (!st.segs.length || !ws.length) { box.hidden = true; return; }
    box.hidden = false;
    const linhas = []; let atual = [];
    ws.forEach((w, i) => {
      atual.push(w);
      const prox = ws[i + 1];
      if (!prox || prox.g - w.ge > 0.6 || /[.!?]$/.test(w.w)) { linhas.push(atual); atual = []; }
    });
    const nCort = ws.filter(cortada).length, nVic = ws.filter((w) => w.vicio && cortada(w)).length, nIA = ws.filter((w) => !cortada(w) && tiradaPelaIA(w)).length;
    box.innerHTML = `<p class="rr-lede">Toque numa palavra para cortar ou devolver. A prévia segue o que você marcar.${nVic ? ` Tirei ${nVic} vício${nVic > 1 ? "s" : ""} de fala sozinha.` : ""}</p>
      <div class="rr-tally"><span><b>${nCort + nIA}</b> palavras fora</span><span><b>${tempo(st.clipes.reduce((a, c) => a + c.dur, 0))}</b> bruto</span><span><b>${tempo(st.duracao)}</b> editado</span></div>
      <p class="rr-chaves"><span class="ed-p cortada">cortada</span><span class="ed-p ia">tomada errada</span><span class="ed-p vicio">vício</span><span class="ed-p muleta">muleta (tipo, né)</span></p>
      <div class="ed-revisao">${linhas.map((l) => `<div class="rr-frase"><button type="button" class="rr-ts" data-ir="${l[0].g}">${tempo(l[0].g)}</button><p>${l.map((w) => `<button type="button" class="ed-p${cortada(w) ? (w.vicio && st.marcas[w.k] !== "cortar" ? " vicio" : " cortada") : tiradaPelaIA(w) ? " ia" : w.muleta ? " muleta" : ""}" data-k="${w.k}">${esc(w.w)}</button>`).join("")}</p></div>`).join("")}</div>
      ${Object.keys(st.marcas).length ? `<button type="button" class="login-link" id="ed-cortes-desfazer">desfazer o que eu mudei aqui</button>` : ""}`;
    $$(".ed-p[data-k]", box).forEach((b) => b.addEventListener("click", () => {
      const w = ws.find((x) => String(x.k) === b.dataset.k); if (!w) return;
      const fora = cortada(w) || tiradaPelaIA(w);
      st.marcas[w.k] = fora ? "manter" : "cortar";
      if (!fora && w.vicio && st.opc.vicios) delete st.marcas[w.k];
      if (st.tocando) parar(); montar(); pintar(); salvarDepois();
    }));
    $$("[data-ir]", box).forEach((b) => b.addEventListener("click", () => { const t = paraFinalPerto(Number(b.dataset.ir)); if (t != null) irPara(t + 0.02); }));
    const d = $("#ed-cortes-desfazer", box); if (d) d.addEventListener("click", () => { st.marcas = {}; if (st.tocando) parar(); montar(); pintar(); salvarDepois(); });
  }

  // ---------- capa do Reels ----------
  const CAPA_PADRAO = () => ({ t: Math.min(1, st.duracao / 3), titulo: st.titulo || "", estilo: "sombra", cor: "#ffffff", pos: 420, tam: 110, fonte: st.opc.fonteLeg, guias: true });
  let capaOcupada = false;
  async function quadroEm(t, ctx, w, h) {
    const s = segNoFinal(t); if (!s) return false;
    const v = st.clipes[s.ci].el;
    v.currentTime = Math.min(s.b - 0.02, s.a + Math.max(0, t - s.o0));
    await esperarEvento(v, "seeked");
    const vw = v.videoWidth || 1080, vh = v.videoHeight || 1920, esc2 = Math.max(w / vw, h / vh);
    ctx.drawImage(v, (w - vw * esc2) / 2, (h - vh * esc2) / 2, vw * esc2, vh * esc2);
    return true;
  }
  function textoCapa(ctx, c) {
    let tam = c.tam;
    ctx.font = fonteLeg(tam, c.fonte); ctx.textAlign = "center"; ctx.textBaseline = "top";
    const linhas = [];
    for (const par of String(c.titulo || "").split("\n")) {
      let linha = "";
      for (const pal of par.split(/\s+/).filter(Boolean)) { const tenta = linha ? linha + " " + pal : pal; if (ctx.measureText(tenta).width > 920 && linha) { linhas.push(linha); linha = pal; } else linha = tenta; }
      linhas.push(linha);
    }
    if (!linhas.join("").trim()) return;
    tam = Math.min(tam, 1560 / Math.max(1, linhas.length) / 1.12); ctx.font = fonteLeg(tam, c.fonte);
    const alt = linhas.length * tam * 1.12, y0 = Math.max(120, Math.min(c.pos, 1800 - alt));
    if (c.estilo === "escuro") { const g = ctx.createLinearGradient(0, Math.max(0, y0 - 120), 0, Math.min(1920, y0 + alt + 170)); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.3, "rgba(0,0,0,.6)"); g.addColorStop(0.75, "rgba(0,0,0,.6)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920); }
    if (c.estilo === "painel") { ctx.fillStyle = "#fff7f0"; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(50, y0 - 30, 980, alt + 60, 30); else ctx.rect(50, y0 - 30, 980, alt + 60); ctx.fill(); }
    ctx.fillStyle = c.estilo === "painel" && c.cor.toLowerCase() === "#ffffff" ? "#3d2b20" : c.cor;
    ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = c.estilo === "painel" ? 0 : 16; ctx.shadowOffsetY = c.estilo === "painel" ? 0 : 6;
    linhas.forEach((l, i) => ctx.fillText(st.opc.maiusculas ? l.toUpperCase() : l, 540, y0 + i * tam * 1.12));
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }
  async function desenharCapa(comGuias) {
    const cv = $("#ed-capa-canvas"); if (!cv || capaOcupada || st.tocando) return;
    capaOcupada = true;
    try {
      const ctx = cv.getContext("2d"), c = st.capa;
      ctx.clearRect(0, 0, 1080, 1920); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1080, 1920);
      await quadroEm(c.t, ctx, 1080, 1920);
      textoCapa(ctx, c);
      if (comGuias !== false && c.guias) { ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 4; ctx.setLineDash([16, 12]); [1440, 1080].forEach((hh) => ctx.strokeRect(20, (1920 - hh) / 2, 1040, hh)); ctx.setLineDash([]); }
    } finally { capaOcupada = false; }
  }
  function pintarCapa() {
    const box = $("#ed-capa"); if (!box) return;
    if (!st.segs.length) { box.hidden = true; return; }
    box.hidden = false;
    if (!st.capa) st.capa = CAPA_PADRAO();
    const c = st.capa;
    if (box.dataset.pronto === "1") { const r = $("#ed-capa-t", box); if (r) r.max = Math.max(0.1, st.duracao - 0.05).toFixed(2); return; } // já montada: só redesenha quando ela mexe
    box.dataset.pronto = "1";
    box.innerHTML = `<div class="ed-titulo-linha"><h3 class="ed-titulo">Capa do Reels</h3><span class="ed-sub">PNG pronto para postar</span></div>
      <div class="ed-capa-grade"><canvas id="ed-capa-canvas" width="1080" height="1920" aria-label="Prévia da capa"></canvas>
      <div class="ed-capa-campos">
        <button class="btn" type="button" id="ed-capa-opcoes">${ic.brilho}Mostrar 6 opções de quadro</button>
        <div class="ed-capa-quadros" id="ed-capa-quadros"></div>
        <label class="ed-rotulo" for="ed-capa-t">Quadro exato <output id="ed-capa-tempo">${tempo(c.t)}</output></label>
        <input type="range" id="ed-capa-t" min="0" max="${Math.max(0.1, st.duracao - 0.05).toFixed(2)}" step="0.04" value="${c.t}">
        <label class="ed-rotulo" for="ed-capa-titulo">Título da capa</label>
        <textarea class="entrada" id="ed-capa-titulo" rows="2" maxlength="120" placeholder="Ex.: o hidratante que salvou minha pele">${esc(c.titulo)}</textarea>
        <div class="ed-linha"><label class="ed-rotulo" for="ed-capa-estilo">Estilo</label><select class="entrada" id="ed-capa-estilo">${[["sombra", "Sombra suave"], ["painel", "Painel creme"], ["escuro", "Degradê escuro"]].map(([k, t]) => `<option value="${k}" ${c.estilo === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="ed-linha"><label class="ed-rotulo" for="ed-capa-fonte">Fonte</label><select class="entrada" id="ed-capa-fonte">${Object.entries(FONTES_LEG).filter(([k]) => k !== "minha" || st.minhaFonte).map(([k, t]) => `<option value="${k}" ${c.fonte === k ? "selected" : ""}>${k === "minha" ? esc(st.minhaFonte) : t}</option>`).join("")}</select></div>
        <div class="ed-linha"><label class="ed-rotulo" for="ed-capa-cor">Cor do texto</label><input type="color" id="ed-capa-cor" value="${c.cor}"></div>
        <label class="ed-rotulo" for="ed-capa-pos">Altura do título</label><input type="range" id="ed-capa-pos" min="120" max="1500" step="10" value="${c.pos}">
        <label class="ed-rotulo" for="ed-capa-tam">Tamanho</label><input type="range" id="ed-capa-tam" min="48" max="160" value="${c.tam}">
        <label class="ed-chk"><input type="checkbox" id="ed-capa-guias" ${c.guias ? "checked" : ""}> Mostrar onde corta no 3:4 e no quadrado (não sai no PNG)</label>
        <div class="ed-capa-baixar"><button class="btn btn-principal" type="button" data-capa="1920">${ic.baixar}Capa 9:16</button><button class="btn" type="button" data-capa="1440">3:4 (grade do perfil)</button><button class="btn" type="button" data-capa="1080">Quadrada</button></div>
      </div></div>`;
    const mexeu = () => { desenharCapa(); salvarDepois(); };
    $("#ed-capa-t", box).addEventListener("input", (e) => { c.t = Number(e.target.value); $("#ed-capa-tempo", box).textContent = tempo(c.t); mexeu(); });
    $("#ed-capa-titulo", box).addEventListener("input", (e) => { c.titulo = e.target.value; mexeu(); });
    $("#ed-capa-estilo", box).addEventListener("change", (e) => { c.estilo = e.target.value; mexeu(); });
    $("#ed-capa-fonte", box).addEventListener("change", (e) => { c.fonte = e.target.value; mexeu(); });
    $("#ed-capa-cor", box).addEventListener("input", (e) => { c.cor = e.target.value; mexeu(); });
    $("#ed-capa-pos", box).addEventListener("input", (e) => { c.pos = Number(e.target.value); mexeu(); });
    $("#ed-capa-tam", box).addEventListener("input", (e) => { c.tam = Number(e.target.value); mexeu(); });
    $("#ed-capa-guias", box).addEventListener("change", (e) => { c.guias = e.target.checked; mexeu(); });
    $("#ed-capa-opcoes", box).addEventListener("click", async () => {
      if (st.tocando) parar();
      const lista = $("#ed-capa-quadros", box); lista.innerHTML = "";
      const mini = document.createElement("canvas"); mini.width = 135; mini.height = 240; const mctx = mini.getContext("2d");
      for (let i = 0; i < 6; i++) {
        const t = st.duracao * (i + 1) / 7;
        while (capaOcupada) await espera(30);
        capaOcupada = true; try { mctx.fillStyle = "#000"; mctx.fillRect(0, 0, 135, 240); await quadroEm(t, mctx, 135, 240); } finally { capaOcupada = false; }
        const b = document.createElement("button"); b.type = "button"; b.className = "ed-capa-op";
        b.innerHTML = `<img src="${mini.toDataURL("image/jpeg", 0.8)}" alt="Quadro em ${tempo(t)}"><small>${tempo(t)}</small>`;
        b.addEventListener("click", () => { c.t = t; $("#ed-capa-t", box).value = t; $("#ed-capa-tempo", box).textContent = tempo(t); mexeu(); });
        lista.appendChild(b);
      }
      desenharCapa();
    });
    $$("[data-capa]", box).forEach((b) => b.addEventListener("click", async () => {
      await document.fonts.ready;
      while (capaOcupada) await espera(30);
      await desenharCapa(false);
      const hh = Number(b.dataset.capa), out = document.createElement("canvas"); out.width = 1080; out.height = hh;
      out.getContext("2d").drawImage($("#ed-capa-canvas"), 0, (1920 - hh) / 2, 1080, hh, 0, 0, 1080, hh);
      desenharCapa();
      out.toBlob((blob) => {
        if (!blob) { toast("Não consegui gerar a capa.", true); return; }
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = `${(st.clipes[0] ? st.clipes[0].nome.replace(/\.[^.]+$/, "") : "reels")}-capa-1080x${hh}.png`; a.click();
        toast("Capa baixada. Confira o corte antes de postar.");
      }, "image/png");
    }));
    desenharCapa();
  }

  function pintarLegendas() {
    const box = $("#ed-legendas"); if (!box) return;
    if (!st.segs.length || !st.legendas.length) { box.hidden = true; return; }
    box.hidden = false;
    const n = Object.keys(st.editLeg).length;
    box.innerHTML = `<div class="ed-titulo-linha"><h3 class="ed-titulo">Legendas</h3><span class="ed-sub">${st.legendas.length}${n ? ` · <button type="button" class="login-link" id="ed-leg-desfazer">desfazer edições</button>` : ""}</span></div>
      <p class="ed-obs">Corrija o texto, junte com a próxima, apague ou marque ★ para virar palavra chamativa. Toque no tempo para ver na prévia.</p>
      <div class="ed-legs">${st.legendas.map((g, i) => `<div class="ed-leg${g.chamativa ? " cham" : ""}" data-i="${i}"><button type="button" class="ed-ir" data-ir>${tempo(g.o0)}</button>
        <input class="entrada" data-txt value="${esc(textoLeg(g))}" aria-label="Texto da legenda">
        <button type="button" class="icone-btn" data-cham title="Palavra chamativa" aria-label="Palavra chamativa">${g.chamativa ? "★" : "☆"}</button>
        <button type="button" class="icone-btn" data-juntar title="Juntar com a próxima" aria-label="Juntar com a próxima" ${i === st.legendas.length - 1 ? "disabled" : ""}>⤵</button>
        <button type="button" class="icone-btn" data-apagar title="Apagar legenda" aria-label="Apagar legenda">${ic.x}</button></div>`).join("")}</div>`;
    const editar = (g, mud) => { const k = g.k; st.editLeg[k] = { ...(st.editLeg[k] || {}), ...mud }; if (st.tocando) parar(); montar(); pintarLegendas(); pintarPlano(); redesenhar(); salvarDepois(); };
    $$(".ed-leg", box).forEach((l) => {
      const g = st.legendas[Number(l.dataset.i)];
      $("[data-ir]", l).addEventListener("click", () => irPara(g.o0 + 0.02));
      $("[data-txt]", l).addEventListener("change", (e) => { const v = e.target.value.trim(); if (!v) editar(g, { oculta: true }); else editar(g, { texto: v }); });
      $("[data-cham]", l).addEventListener("click", () => editar(g, { chamativa: !g.chamativa }));
      $("[data-juntar]", l).addEventListener("click", () => editar(g, { juntar: true, texto: undefined }));
      $("[data-apagar]", l).addEventListener("click", () => editar(g, { oculta: true }));
    });
    const d = $("#ed-leg-desfazer", box); if (d) d.addEventListener("click", () => { st.editLeg = {}; if (st.tocando) parar(); montar(); pintar(); });
  }

  function pintarPlano() {
    const box = $("#ed-plano"); if (!box) return;
    if (!st.plano || !st.segs.length) { box.innerHTML = `<section class="ed-cartao ed-dica"><h3 class="ed-titulo">Como funciona</h3><ol class="ed-passos"><li>Grave do seu jeito, pode ser em várias partes e com tomadas erradas.</li><li>Envie os arquivos aqui e clique em <b>Editar automático</b>.</li><li>Eu escuto, corto, legendo, ponho zoom, título e efeitos no seu padrão.</li><li>Confira a prévia. Se algo não ficou bom, escreva no campo <b>Corrigir a edição</b> e ajuste o texto das legendas na lista <b>Legendas</b>.</li><li>Baixe o MP4.</li></ol><p class="ed-obs">O vídeo não sai do seu computador: só o áudio vai para a transcrição. A exportação acontece em tempo real, então deixe esta aba aberta até terminar.</p></section>
      <section class="ed-cartao ed-espera"><h3 class="ed-titulo">Legendas</h3><p class="ed-obs">Depois de editar, a lista de legendas aparece do lado esquerdo, embaixo de Ajustes: dá para corrigir o texto, juntar, apagar e marcar ★ palavra chamativa, como no CapCut.</p></section>`; return; }
    const p = st.plano, bruto = st.clipes.reduce((s, c) => s + c.dur, 0);
    box.innerHTML = `<section class="ed-cartao">
        <h3 class="ed-titulo">O que eu fiz</h3>
        <div class="ed-resumo"><div><b>${tempo(bruto)}</b><span>bruto</span></div><div><b>${tempo(st.duracao)}</b><span>editado</span></div><div><b>${st.segs.length}</b><span>planos</span></div><div><b>${st.legendas.length}</b><span>legendas</span></div></div>
        ${(p.remover || []).length && st.opc.erros ? `<details class="ed-det"><summary>${p.remover.length} trecho${p.remover.length > 1 ? "s" : ""} tirado${p.remover.length > 1 ? "s" : ""} (tomada errada, gaguejo)</summary><ul>${p.remover.map((r) => `<li>${tempo(r.de)} a ${tempo(r.ate)} do bruto · ${esc(r.motivo)}</li>`).join("")}</ul></details>` : ""}
      </section>
      <section class="ed-cartao">
        <div class="ed-titulo-linha"><h3 class="ed-titulo">Efeitos sonoros</h3><span class="ed-sub">${st.efeitos.length}</span></div>
        <div class="ed-efeitos">${st.efeitos.map((e) => `<div class="ed-efeito" data-id="${e.id}"><button class="icone-btn" type="button" data-ouvir aria-label="Ouvir">${ic.som}</button><button class="ed-ir" type="button" data-ir>${tempo(e.t)}</button>
          <select class="entrada" data-tipo aria-label="Efeito">${Object.entries(EFEITOS).map(([k, t]) => `<option value="${k}" ${e.tipo === k ? "selected" : ""}>${t}</option>`).join("")}</select>
          <small title="${esc(e.por_que)}">${esc(e.por_que)}</small><button class="icone-btn" type="button" data-apagar aria-label="Apagar">${ic.x}</button></div>`).join("") || `<p class="ed-obs">Nenhum efeito.</p>`}</div>
        <div class="ed-add-efeito"><select class="entrada" id="ed-novo-tipo" aria-label="Novo efeito">${Object.entries(EFEITOS).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select><button class="btn" type="button" id="ed-add-efeito">${ic.mais}Pôr aqui (${tempo(st.t)})</button></div>
      </section>
      ${(p.roteiro_check || []).length ? `<section class="ed-cartao"><div class="ed-titulo-linha"><h3 class="ed-titulo">Roteiro x gravação</h3><span class="ed-sub">${p.roteiro_check.filter((r) => r.status === "gravado").length} de ${p.roteiro_check.length} gravados</span></div>
        <ul class="ed-lista ed-check">${p.roteiro_check.map((r) => `<li class="ed-st-${esc(r.status)}"><span>${r.status === "gravado" ? "✓" : r.status === "faltou" ? "faltou" : "mudou"}</span><div><b>${esc(r.bloco)}</b>${r.obs ? `<small>${esc(r.obs)}</small>` : ""}</div></li>`).join("")}</ul></section>` : ""}
      ${(p.broll || []).length ? `<section class="ed-cartao"><h3 class="ed-titulo">B-roll para gravar</h3><ul class="ed-lista">${p.broll.map((b) => `<li><span>${b.t != null && paraFinalPerto(b.t) != null ? tempo(paraFinalPerto(b.t)) : ""}</span>${esc(b.ideia)}</li>`).join("")}</ul></section>` : ""}
      ${p.musica || (p.dicas || []).length ? `<section class="ed-cartao"><h3 class="ed-titulo">Dicas do editor</h3>${p.musica ? `<p class="ed-obs"><b>Música:</b> ${esc(p.musica)}</p>` : ""}<ul class="ed-lista">${(p.dicas || []).map((d) => `<li>${esc(d)}</li>`).join("")}</ul></section>` : ""}`;
    $$(".ed-efeito", box).forEach((l) => {
      const e = st.efeitos.find((x) => x.id === l.dataset.id);
      $("[data-ouvir]", l).addEventListener("click", () => { audio(); if (ac.state === "suspended") ac.resume(); tocarEfeito(e.tipo, ac.currentTime + (e.tipo === "riser" ? 1.2 : 0.02), st.opc.vol); });
      $("[data-ir]", l).addEventListener("click", () => irPara(Math.max(0, e.t - 0.6)));
      $("[data-tipo]", l).addEventListener("change", (ev) => { const novo = ev.target.value; tirarSom(e, true); porSom(novo, e.t); });
      $("[data-apagar]", l).addEventListener("click", () => { tirarSom(e); });
    });
    $("#ed-add-efeito", box).addEventListener("click", () => porSom($("#ed-novo-tipo", box).value));
  }
  async function irPara(t) {
    if (st.tocando) parar();
    st.t = t; const s = segNoFinal(t); if (!s) return;
    const v = st.clipes[s.ci].el; v.currentTime = s.a + (t - s.o0); await esperarEvento(v, "seeked"); desenhar(t); pintarControles(); atualizarTempo();
  }
  function pintarFinal() {
    const box = $("#ed-final"); if (!box) return;
    if (!st.segs.length) { box.innerHTML = ""; return; }
    const f = st.arquivoFinal;
    box.innerHTML = `<div class="ed-exportar">
        <button class="btn btn-principal ed-botao-grande" type="button" id="ed-exportar" ${st.exportando || st.trabalhando ? "disabled" : ""}>${st.exportando ? (st.progresso != null ? `Gerando o vídeo… ${Math.round(st.progresso * 100)}% (deixe esta aba aberta)` : "Gerando o vídeo… (deixe esta aba aberta)") : ic.baixar + "Gerar vídeo editado"}</button>
        ${st.exportando ? `<button class="btn" type="button" id="ed-cancelar">Cancelar</button>` : ""}
        <button class="btn" type="button" id="ed-srt">Legenda .srt (CapCut)</button>
      </div>
      ${f ? `<div class="ed-pronto"><b>Vídeo pronto</b><small>${esc(f.nome)} · ${(f.tamanho / 1048576).toFixed(1)} MB${f.ext === "webm" ? " · esse navegador só grava em WebM; o Chrome atualizado ou o Safari gravam em MP4" : ""}</small><a class="btn btn-principal" href="${f.url}" download="${esc(f.nome)}">${ic.baixar}Baixar</a></div>` : ""}`;
    const ex = $("#ed-exportar", box); if (ex) ex.addEventListener("click", exportar);
    const ca = $("#ed-cancelar", box); if (ca) ca.addEventListener("click", parar);
    $("#ed-srt", box).addEventListener("click", () => baixar((st.clipes[0] ? st.clipes[0].nome.replace(/\.[^.]+$/, "") : "video") + "-legenda.srt", srt(), "text/plain"));
  }

  // ---------- janela do padrão de edição ----------
  let dlg = null;
  function abrirPadrao() {
    if (!dlg) { dlg = document.createElement("dialog"); dlg.className = "janela larga"; document.body.appendChild(dlg); dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); }
    dlg.innerHTML = `<div class="janela-cabeca"><div><small class="janela-sobretitulo">Edição de vídeos</small><h2>Meu padrão de edição</h2></div><button class="icone-btn" type="button" data-fechar aria-label="Fechar">${ic.x}</button></div>
      <div class="janela-corpo"><p class="ed-obs">Montei a partir das referências que você mandou (Rafaela Chagas, Vic Gaibar, Majú Soares, Camila Bertolin e os tutoriais de edição com o Claude). Eu leio isso antes de cada edição. Pode mudar à vontade.</p>
        <textarea class="entrada ed-padrao" id="ed-padrao-txt" rows="22">${esc(st.padrao)}</textarea></div>
      <div class="janela-rodape"><button class="btn" type="button" data-fabrica>Voltar ao original</button><span style="flex:1"></span><button class="btn btn-principal" type="button" data-salvar>Salvar padrão</button></div>`;
    $("[data-fechar]", dlg).addEventListener("click", () => dlg.close());
    $("[data-fabrica]", dlg).addEventListener("click", () => { $("#ed-padrao-txt", dlg).value = PADRAO; });
    $("[data-salvar]", dlg).addEventListener("click", async () => { try { await salvarPadrao($("#ed-padrao-txt", dlg).value.trim() || PADRAO); dlg.close(); toast("Padrão de edição salvo."); } catch (e) { toast("Não consegui salvar: " + e.message, true); } });
    if (!dlg.open) dlg.showModal();
  }

  async function abrirAba() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec) return;
    if (!st.pronto) {
      if (!document.getElementById("ed-fontes")) { const l = document.createElement("link"); l.id = "ed-fontes"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Poppins:wght@300;500;600;800&family=Montserrat:wght@700;800&family=Nunito:wght@800&family=Arimo:wght@700&family=Instrument+Serif:ital@1&family=Fredoka:wght@700&family=Caveat:wght@700&family=JetBrains+Mono:wght@500&display=swap"; document.head.appendChild(l); }
      montarTela(sec); st.pronto = true;
      carregarPadrao(); carregarMinhaFonte(); carregarEstilos();
      try { await Promise.all(["300 40px Poppins", "500 40px Poppins", "800 40px Poppins", "600 40px Poppins", 'italic 40px "DM Serif Display"', "800 40px Montserrat", "700 40px Montserrat", "800 40px Nunito", "700 40px Arimo", 'italic 40px "Instrument Serif"', "700 40px Fredoka", "700 40px Caveat"].map((f) => document.fonts.load(f))); } catch (e) { /* segue com a fonte do sistema */ }
    }
    pintar();
  }
  document.addEventListener("painel:aba", (e) => { if (e.detail === ABA) abrirAba(); else if (st.tocando && !st.exportando) parar(); });
  if (location.hash === "#" + ABA) setTimeout(abrirAba, 600);
  window.painelEdicao = { estado: st, audioDoArquivo, desenhar, irPara }; // usado nos testes
})();
