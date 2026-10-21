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
  const CORES_CHAMATIVA = ["#c6f432", "#cdb6ff", "#ffe45c", "#ffb3d9"];
  const DUR_TITULO = 2.8;

  const st = {
    pronto: false, padrao: PADRAO, padraoSalvo: false,
    clipes: [], plano: null, segs: [], legendas: [], efeitos: [], zooms: [], titulo: "", duracao: 0,
    etapas: [], trabalhando: false, tocando: false, exportando: false, parar: false, t: 0,
    opc: { fonteLeg: "arimo", sombra: "suave", sonsTitulo: true, estilo: "capcut", corLegenda: "#fff3b0", porLegenda: 3, chamativas: false, sonsChamativas: false, confete: false, tremer: false, flash: false, sfxAuto: "medio", transicao: "punch", ritmo: "rapido", altura: 0.52, silencio: true, erros: true, zoomCortes: true, zoomEnfase: true, efeitos: true, vol: 0.4, titulo: true, estiloTitulo: "simples", maiusculas: false, qualidade: 1080, cor: "#f2c14e", vicios: true, vozForte: true, tamLeg: 1, legenda: true, sons: "muitos", dinamismo: "dinamico" },
    pedidos: "", manual: { sons: [], tirados: [], zooms: [], flashes: [], cortes: [], divisoes: [] }, sel: null, correcoes: [], corrigindo: false, lembrar: true, editLeg: {}, marcas: {}, capa: null, aba: "video", projeto: null, projetos: [], pendentes: null, salvando: "",
    tema: "", roteiro: (() => { try { return localStorage.getItem("ed-roteiro") || ""; } catch (e) { return ""; } })(), posts: [], arquivoFinal: null,
  };

  // ajustes visuais que ela aprovou (legenda, título, cor, volume) valem para os próximos vídeos
  try { const salvo = JSON.parse(localStorage.getItem("ed-opc3") || "null"); if (salvo && typeof salvo === "object") Object.assign(st.opc, salvo); if (st.opc.estiloTitulo === "capcut") st.opc.estiloTitulo = "simples"; } catch (e) { /* sem armazenamento */ }
  const OPC_VISUAIS = ["sfxAuto", "transicao", "ritmo", "fonteLeg", "sombra", "estilo", "corLegenda", "porLegenda", "chamativas", "sonsChamativas", "confete", "tremer", "flash", "estiloTitulo", "altura", "cor", "vol", "maiusculas", "titulo", "sonsTitulo", "efeitos", "silencio", "erros", "zoomCortes", "zoomEnfase", "vicios", "vozForte", "tamLeg", "legenda", "sons", "dinamismo"];
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
      let faixa = null, parar = false;
      ent.onError = () => { parar = true; };
      ent.onReady = (info) => {
        faixa = (info.audioTracks || [])[0];
        if (!faixa || !/^mp4a/i.test(faixa.codec)) { parar = true; faixa = null; return; }
        ent.setExtractionOptions(faixa.id, null, { nbSamples: 2000 }); ent.start();
      };
      ent.onSamples = (id, u, lista) => { for (const a of lista) amostras.push({ data: a.data.slice(0), duration: a.duration, dts: a.dts, cts: a.cts }); ent.releaseUsedSamples(id, lista[lista.length - 1].number + 1); };
      const passo = 8 * 1024 * 1024;
      for (let pos = 0; pos < arquivo.size && !parar; pos += passo) { const b = await arquivo.slice(pos, pos + passo).arrayBuffer(); b.fileStart = pos; ent.appendBuffer(b); }
      ent.flush();
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
    if (!total || !blocos.some((b) => b.some((x) => Math.abs(x) > 1e-4))) throw new Error("O iPhone não me deixou ouvir o áudio deste vídeo. Tente pelo computador, ou exporte o vídeo como MP4 e envie de novo.");
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
  async function adicionarClipes(arquivos) {
    const pend = st.pendentes;
    for (const a of arquivos) {
      if (!/^video\//.test(a.type) && !/\.(mp4|mov|m4v|webm)$/i.test(a.name)) { toast(`"${a.name}" não é vídeo.`, true); continue; }
      try {
        const el = await carregarVideo(a), clipe = { id: uid(), nome: a.name, arquivo: a, el, dur: el.duration || 0, w: el.videoWidth, h: el.videoHeight, palavras: null };
        // abrindo um projeto: o arquivo certo recupera a transcrição salva
        if (pend) { const i = pend.findIndex((x) => !x.usado && (x.nome === a.name || Math.abs((x.dur || 0) - clipe.dur) < 0.25)); if (i >= 0) { pend[i].usado = true; clipe.palavras = pend[i].palavras && pend[i].palavras.length ? pend[i].palavras : null; clipe.ordem = i; } }
        st.clipes.push(clipe);
      } catch (e) { toast(e.message, true); }
    }
    if (pend) {
      st.clipes.sort((x, y) => (x.ordem ?? 99) - (y.ordem ?? 99));
      if (pend.every((x) => x.usado)) {
        st.pendentes = null;
        let off = 0; st.clipes.forEach((c) => { c.offset = off; off += c.dur; });
        if (st.plano) { montar(); if (st.efeitosSalvos && !(st.manual.sons.length || st.manual.tirados.length)) { st.efeitos = st.efeitosSalvos; } st.efeitosSalvos = null; st.t = 0; toast("Projeto aberto do jeito que você deixou."); }
      }
      pintar(); return;
    }
    st.plano = null; st.segs = []; st.editLeg = {}; st.correcoes = [];
    pintar(); salvarDepois();
  }

  // ---------- projetos (memória da edição) ----------
  const dadosProjeto = () => ({ versao: 3,
    tema: st.tema, roteiro: st.roteiro, pedidos: st.pedidos, manual: st.manual, opc: st.opc, plano: st.plano, titulo: st.titulo, tituloDestaque: st.tituloDestaque, editLeg: st.editLeg, marcas: st.marcas, capa: st.capa, correcoes: st.correcoes,
    efeitos: st.efeitos.filter((e) => !e.doTitulo && !e.daChamativa).map(({ id, ...e }) => e),
    clipes: (st.clipes.length ? st.clipes : st.pendentes || []).map((c) => ({ nome: c.nome, dur: Math.round((c.dur || 0) * 100) / 100, palavras: c.palavras || null })),
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
    Object.assign(st, { clipes: [], plano: null, segs: [], legendas: [], efeitos: [], titulo: "", tituloDestaque: "", editLeg: {}, marcas: {}, capa: null, aba: "video", manual: { sons: [], tirados: [], zooms: [], flashes: [], cortes: [], divisoes: [] }, sel: null, correcoes: [], etapas: [], pendentes: null, efeitosSalvos: null, t: 0, arquivoFinal: null, tema: "", roteiro: "", pedidos: "" });
  }
  async function abrirProjeto(id) {
    const { data, error } = await banco().from("edicao_projetos").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast("Não consegui abrir esse projeto.", true); return; }
    limparTudo();
    const d = data.dados || {};
    st.projeto = { id: data.id, nome: data.nome };
    st.tema = d.tema || ""; st.roteiro = d.roteiro || ""; st.pedidos = d.pedidos || ""; st.manual = { sons: [], tirados: [], zooms: [], flashes: [], cortes: [], divisoes: [], ...(d.manual || {}) }; st.plano = d.plano || null; st.titulo = d.titulo || ""; st.tituloDestaque = d.tituloDestaque || "";
    st.editLeg = d.editLeg || {}; st.marcas = d.marcas || {}; st.capa = d.capa || null; st.correcoes = d.correcoes || [];
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
    pintarEtapas();
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
    if (o.dinamismo === "calmo") d.push("mais calmo: sem zoom nem transição");
    if (o.zoomEnfase === false) d.push("sem zoom");
    if (o.transicao === "nenhuma") d.push("sem transição");
    if (o.tamLeg) d.push(o.tamLeg > 1 ? "legenda maior" : "legenda menor");
    if ("maiusculas" in o) d.push(o.maiusculas ? "legenda em maiúsculas" : "legenda em minúsculas");
    return d;
  }

  // o padrão dela + os pedidos para este vídeo (vão juntos para a IA, com prioridade)
  const padraoComPedidos = () => st.pedidos.trim() ? `${st.padrao}\n\nPEDIDOS DELA PARA ESTE VÍDEO (prioridade máxima, valem mais que o padrão):\n${st.pedidos.trim()}` : st.padrao;
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
  async function corrigir(texto) {
    texto = String(texto || "").trim();
    if (!texto) { toast("Escreva o que você quer mudar.", true); return; }
    if (!st.plano || st.corrigindo) return;
    st.corrigindo = true; pintarAjustar();
    const foto = fotoDaEdicao();
    try {
      if (st.tocando) parar();
      const antes = { dur: st.duracao, ef: st.efeitos.length, zo: st.zooms.length, tit: st.titulo, opc: { ...st.opc }, rem: JSON.stringify((st.plano || {}).remover || []), dest: JSON.stringify((st.plano || {}).destaques || []) };
      const locais = regrasDoPedido(texto);
      const sobra = partesSemRegra(texto);
      let r = { plano: null, opc: {}, resposta: "", regra: "" };
      // só chama a IA para o que o painel não entendeu sozinho (e ela recebe só essa parte)
      if (sobra.length) {
        r = await chamar({ acao: "corrigir", comentario: sobra.join(". "), plano: st.plano, titulo: st.titulo, opc: Object.fromEntries(OPC_VISUAIS.map((k) => [k, st.opc[k]])),
          palavras: palavrasBrutas().map((w) => ({ w: w.w, s: w.s })), duracao: st.clipes.reduce((s, c) => s + c.dur, 0), padrao: padraoComPedidos(), roteiro: st.roteiro.trim() || undefined, historico: st.correcoes.map((c) => c.texto) });
        const check = st.plano.roteiro_check;
        st.plano = { ...r.plano, roteiro_check: (r.plano.roteiro_check || []).length ? r.plano.roteiro_check : check };
        if (r.plano.titulo) { st.titulo = r.plano.titulo; st.tituloDestaque = r.plano.titulo_destaque || st.tituloDestaque; }
        if (r.opc && r.opc.sfxAuto && !locais.sons) locais.sons = { desligado: "nenhum", pouco: "poucos", medio: "medio", muito: "muitos" }[r.opc.sfxAuto];
      }
      const { preEditado: _pe, ...locaisOpc } = locais;
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
      const nomesOpc = { estilo: "estilo da legenda", fonteLeg: "fonte", corLegenda: "cor da legenda", porLegenda: "palavras por legenda", tamLeg: "tamanho da legenda", altura: "altura da legenda", sombra: "sombra", estiloTitulo: "estilo do título", ritmo: "ritmo", sfxAuto: "sons automáticos", transicao: "transição", vol: "volume dos efeitos", maiusculas: "maiúsculas", cor: "cor do destaque", sonsTitulo: "som do título", legenda: "legenda", sons: "quantidade de efeitos", dinamismo: "dinamismo", vicios: "vícios de fala", vozForte: "volume da voz", efeitos: "efeitos sonoros", titulo: "título na tela", zoomCortes: "zoom nos cortes", zoomEnfase: "zoom na ênfase", chamativas: "palavras chamativas", flash: "flash", tremer: "tremidinha", silencio: "corte de silêncios", erros: "tomadas erradas" };
      Object.keys(r.opc || {}).forEach((k) => { if (antes.opc[k] !== st.opc[k] && !mud.includes(nomesOpc[k] || k)) mud.push(nomesOpc[k] || k); });
      const ultima = st.correcoes[st.correcoes.length - 1];
      ultima.mudou = mud;
      if (!mud.length) ultima.resposta += " (Nada mudou no vídeo. Tente dizer de outro jeito, com o momento e o que quer, ou ajuste direto nas abas e na linha do tempo.)";
      st.desfazerAjuste = mud.length ? foto : null;
      if (st.lembrar && r.regra && !st.padrao.includes(r.regra)) {
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
    st.trabalhando = true; st.etapas = []; st.correcoes = []; pintar();
    try { audio(); if (ac.state === "suspended") ac.resume(); } catch (e) { /* segue */ }
    try {
      let offset = 0;
      for (const [i, c] of st.clipes.entries()) {
        if (!c.palavras || !c.palavras.length) {
          etapa(`Ouvindo o clipe ${i + 1} de ${st.clipes.length}`);
          // 1º: tira a faixa de áudio de dentro do MP4/MOV (não depende do navegador abrir o áudio)
          let partes = await audioDoArquivo(c.arquivo);
          if (!partes) partes = IPHONE && c.arquivo.size > 150e6 ? null : await audioDoVideo(c.arquivo);
          // iPhone/Safari não abre o áudio de .MOV (ou o arquivo é grande demais): escuta tocando o vídeo
          if (!partes) { etapa(`Ouvindo o clipe ${i + 1} tocando (no iPhone leva o tempo do vídeo, deixe a tela ligada)`); partes = await audioTocando(c); }
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
        st.plano = await chamar({ acao: "plano", palavras: todas, duracao: offset, padrao: padraoComPedidos(), tema: st.tema, roteiro: st.roteiro.trim() || undefined });
        st.titulo = st.plano.titulo || "";
        st.tituloDestaque = st.plano.titulo_destaque || "";
      } else {
        etapa("Não consegui ouvir fala nesse vídeo, então ficou sem legenda e sem cortes. Se ele tem fala, me avise.", "erro");
        st.plano = { titulo: "", remover: [], destaques: [], zooms: [], efeitos: [], broll: [], dicas: ["Não ouvi fala nesse vídeo, então não cortei silêncios nem pus legenda. Dá para pôr título e efeitos à mão."], musica: "" };
      }
      etapa("Montando a linha do tempo");
      // o que ela escreveu em "O que você quer nesta edição" vale com certeza
      Object.assign(st.opc, (st.plano && st.plano.opc) || {}, (({ preEditado, ...x }) => x)(regrasDoPedido(st.pedidos)));
      if (st.plano) delete st.plano.opc;
      ajustarVoz();
      montar();
      const ouvidas = palavrasBrutas();
      etapa(ouvidas.length ? `Ouvi o seu vídeo: ${ouvidas.length} palavras (veja abaixo em "O que eu ouvi").` : "Não ouvi fala no vídeo.", ouvidas.length ? "ok" : "erro");
      const reg = regrasDoPedido(st.pedidos);
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
    st.duracao = out;
    // zoom alternado nos cortes (só quando o corte é dentro do mesmo clipe, o "pulo" da imagem)
    st.segs.forEach((s, i) => { const ant = st.segs[i - 1]; s.zoom = ant && ant.ci === s.ci && st.opc.zoomCortes && st.opc.dinamismo !== "calmo" ? (ant.zoom > 1 ? 1 : st.opc.dinamismo === "dinamico" ? 1.12 : 1.08) : 1; });
    const p = st.plano || {};
    // legendas palavra por palavra
    const palavras = [];
    for (const c of st.clipes) for (const w of c.palavras || []) {
      const o = paraFinal(c.offset + w.s); if (o == null) continue;
      const fim = paraFinal(Math.min(c.offset + w.e, c.offset + c.dur - 0.01));
      palavras.push({ w: w.w, o0: o, o1: fim != null && fim > o ? fim : o + 0.25, g: c.offset + w.s, k: chaveLeg(c.offset + w.s) });
    }
    // cada destaque vai para a palavra mais perto do tempo que a IA marcou (de preferência a mesma palavra)
    const limpa = (x) => String(x || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    for (const d of p.destaques || []) {
      const perto = palavras.filter((x) => Math.abs(x.g - d.t) < 1.2);
      const alvo = perto.find((x) => d.palavra && limpa(x.w) === limpa(d.palavra)) || perto.sort((a, b) => Math.abs(a.g - d.t) - Math.abs(b.g - d.t))[0];
      if (alvo) alvo.destaque = true;
    }
    st.legendas = aplicarEdicoes(agrupar(palavras));
    // efeitos e zooms do plano no tempo final
    const tirados = new Set(st.manual.tirados || []);
    st.efeitos = (p.efeitos || []).map((e) => ({ id: uid(), t: paraFinalPerto(e.t), tipo: e.tipo, por_que: e.por_que || "", chave: `p:${e.tipo}@${Math.round(e.t * 10)}` })).filter((e) => e.t != null && !tirados.has(e.chave));
    for (const m of st.manual.sons || []) { const t = paraFinal(m.g); if (t != null) st.efeitos.push({ id: m.id, t, tipo: m.tipo, por_que: "você pôs", manual: true }); }
    st.efeitos = st.efeitos.filter((e) => !(e.t < 0.4 && e.tipo === "pop"));
    sonsDoTitulo();
    st.zooms = (p.zooms || []).map((z) => paraFinalPerto(z.t)).filter((t) => t != null);
    st.zoomsManuais = (st.manual.zooms || []).map(paraFinal).filter((t) => t != null);
    st.flashes = (st.manual.flashes || []).map(paraFinal).filter((t) => t != null);
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
  function filtrarSonsPelaQuantidade() {
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
    if (st.opc.estilo === "capcut") return agruparN(palavras, Math.max(1, Math.min(5, Number(st.opc.porLegenda) || 3)));
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
      if (g && g.palavras.length < n && w.o0 - g.o1 < 0.35 && !g.fimFrase && !g.palavras.some((x) => x.destaque) && !w.destaque) { g.palavras.push(w); g.o1 = w.o1; g.fimFrase = /[.!?,;:]$/.test(w.w); }
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
  function tamanho() { return st.opc.qualidade === 720 ? [720, 1280] : [1080, 1920]; }
  function prepararCanvas() {
    canvas = $("#ed-canvas"); if (!canvas) return;
    const [w, h] = tamanho();
    if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
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
  function desenhar(t) {
    if (!c2d) prepararCanvas();
    if (!c2d) return;
    const W = canvas.width, H = canvas.height;
    c2d.fillStyle = "#1d1611"; c2d.fillRect(0, 0, W, H);
    const s = st.segs.length ? segNoFinal(t) : null;
    const clipe = s ? st.clipes[s.ci] : st.clipes[0];
    if (clipe && clipe.el.readyState >= 2) {
      const v = clipe.el, vw = v.videoWidth || 9, vh = v.videoHeight || 16;
      const tr = tremida(t), tc = transicaoEm(t);
      const z = (s ? s.zoom : 1) * zoomEm(t) * (1 + tr.z) * (1 + tc.z);
      const esc0 = Math.max(W / vw, H / vh) * z;
      const dw = vw * esc0, dh = vh * esc0, x0 = (W - dw) / 2 + (tr.x + tc.x) * W, y0 = (H - dh) * 0.42 + tr.y * H;
      c2d.drawImage(v, x0, y0, dw, dh);
      // rastro do deslize (dá a sensação de movimento rápido)
      if (tc.x > 0.01) { c2d.save(); c2d.globalAlpha = 0.35; c2d.drawImage(v, x0 - tc.x * W * 0.6, y0, dw, dh); c2d.restore(); }
    }
    const u = W / 1080;
    // flash rápido nas trocas de clipe
    if ((st.opc.flash || st.opc.dinamismo === "dinamico") && s) { const i = st.segs.indexOf(s), ant = st.segs[i - 1]; const d = t - s.o0; if (ant && ant.ci !== s.ci && d < 0.12) { c2d.fillStyle = `rgba(255,255,255,${0.85 * (1 - d / 0.12)})`; c2d.fillRect(0, 0, W, H); } }
    // flash que ela pôs à mão na linha do tempo
    for (const f of st.flashes || []) { const d = t - f; if (d >= 0 && d < 0.14) { c2d.fillStyle = `rgba(255,255,255,${0.85 * (1 - d / 0.14)})`; c2d.fillRect(0, 0, W, H); } }
    // legenda (ou palavra chamativa)
    const g = st.legendas.find((x) => t >= x.o0 && t < x.o1);
    if (g && st.opc.legenda !== false && !(st.opc.titulo && st.titulo && t < DUR_TITULO - 0.2)) { if (g.chamativa && st.opc.chamativas) desenharChamativa(g, t, u, W, H); else desenharLegenda(g, u, W, H); }
    // confete removido: ela não quer mais (out/2026)
    // título do gancho
    if (st.opc.titulo && st.titulo && t < DUR_TITULO) desenharTitulo(t, u, W, H);
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
    let x = (W - largura) / 2;
    // entrada com um "pulinho"
    const k = Math.min(1, (st.t - g.o0) / 0.08), escala = 0.9 + 0.1 * suave(Math.max(0, k));
    c2d.save(); c2d.translate(W / 2, y); c2d.scale(escala, escala); c2d.translate(-W / 2, -y);
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
    const fonte = fonteLeg(tam), linhas = quebrar(texto, W * 0.8, fonte);
    const k = Math.min(1, (st.t - g.o0) / 0.09), escala = 0.92 + 0.08 * suave(Math.max(0, k));
    c2d.save(); c2d.translate(W / 2, y); c2d.scale(escala, escala); c2d.translate(-W / 2, -y);
    c2d.textAlign = "center"; c2d.textBaseline = "middle";
    c2d.font = fonte;
    if (st.opc.sombra === "dura") { c2d.shadowColor = "rgba(0,0,0,.8)"; c2d.shadowBlur = 0; c2d.shadowOffsetX = 4 * u; c2d.shadowOffsetY = 5 * u; }
    else { c2d.shadowColor = "rgba(0,0,0,.55)"; c2d.shadowBlur = 16 * u; c2d.shadowOffsetY = 3 * u; }
    c2d.fillStyle = st.opc.corLegenda || "#fff3b0";
    linhas.forEach((l, i) => c2d.fillText(l, W / 2, y + (i - (linhas.length - 1) / 2) * tam * 1.12));
    c2d.restore();
  }
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
    const k = Math.min(1, t / 0.35), y = H * 0.24 + (1 - suave(k)) * 30 * u;
    let tam = 118 * u; const fonte = (x) => `italic 400 ${x}px "DM Serif Display", Georgia, serif`;
    const linhas = quebrar(st.titulo.toLowerCase(), W * 0.82, fonte(tam));
    c2d.save(); c2d.globalAlpha = saida * suave(k); c2d.font = fonte(tam); c2d.textAlign = "center"; c2d.textBaseline = "middle";
    c2d.shadowColor = "rgba(0,0,0,.5)"; c2d.shadowBlur = 18 * u; c2d.shadowOffsetY = 3 * u;
    c2d.fillStyle = st.opc.corLegenda || "#fff3b0";
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
    st.tocando = false; pintarControles();
  }
  function parar() { st.parar = true; st.clipes.forEach((c) => c.el.pause()); }

  async function exportar() {
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
    som: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l5 4V6L7 10z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg>',
  };

  function montarTela(sec) {
    // layout "reel review" (referência do editor da getgitgirl), nas cores do painel dela: player 9:16 fixo à esquerda,
    // abas em pílula à direita e a linha do tempo com legendas e efeitos embaixo
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga ed rr">
      <header class="rr-cabeca"><div><h2 class="rr-h1">edição de reels</h2><p class="rr-lede">Mande o bruto e eu edito no seu padrão. Você revisa cada corte, legenda e efeito antes de baixar.</p></div>
        <div class="cr-acoes-topo"><button class="btn" type="button" id="ed-ver-padrao">Meu padrão de edição</button></div></header>
      <div class="ed-projeto" id="ed-projeto"></div>
      <div class="rr-wrap">
        <aside class="rr-lado">
          <div class="ed-tela rr-player"><canvas id="ed-canvas" width="1080" height="1920"></canvas><div class="ed-vazio" id="ed-vazio">${ic.filme}<span>A prévia aparece aqui</span></div><span class="rr-relogio" id="ed-relogio">0:00,0</span></div>
          <div class="ed-controles" id="ed-controles"></div>
          <p class="rr-modo" id="ed-modo"></p>
          <section class="ed-cartao rr-ajustar" id="ed-ajustar" hidden></section>
          <div id="ed-final"></div>
        </aside>
        <div class="rr-principal">
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
              <button class="btn btn-principal ed-botao-grande" type="button" id="ed-editar">${ic.brilho}Editar automático</button>
              <ol class="ed-etapas" id="ed-etapas"></ol>
            </section>
            <section class="ed-cartao" id="ed-ouvi" hidden></section>
          </div>
          <div class="rr-painel" data-painel="cortes" hidden><section class="ed-cartao" id="ed-cortes" hidden></section><p class="rr-vazio">Os cortes aparecem aqui depois que eu editar o vídeo.</p></div>
          <div class="rr-painel" data-painel="legendas" hidden><section class="ed-cartao" id="ed-legendas" hidden></section><p class="rr-vazio">As legendas aparecem aqui depois que eu editar o vídeo.</p></div>
          <div class="rr-painel" data-painel="visual" hidden><section class="ed-cartao" id="ed-ajustes" hidden></section><p class="rr-vazio">Título, fonte, cor e ritmo aparecem aqui depois que eu editar o vídeo.</p></div>
          <div class="rr-painel" data-painel="sons" hidden><div class="rr-plano" id="ed-plano"></div></div>
          <div class="rr-painel" data-painel="capa" hidden><section class="ed-cartao ed-capa" id="ed-capa" hidden></section><p class="rr-vazio">A capa aparece aqui depois que eu editar o vídeo.</p></div>
        </div>
      </div>
      <section class="rr-linha" id="ed-linha" hidden aria-label="Linha do tempo"></section>
      <div id="ed-videos" class="ed-videos" aria-hidden="true"></div>
    </div>`;
    const entrada = $("#ed-arquivo", sec);
    entrada.addEventListener("change", (e) => { const fs = [...e.target.files]; e.target.value = ""; adicionarClipes(fs); });
    const soltar = $("#ed-soltar", sec);
    soltar.addEventListener("dragover", (e) => { e.preventDefault(); soltar.classList.add("arrastando"); });
    soltar.addEventListener("dragleave", () => soltar.classList.remove("arrastando"));
    soltar.addEventListener("drop", (e) => { e.preventDefault(); soltar.classList.remove("arrastando"); adicionarClipes([...e.dataTransfer.files]); });
    $("#ed-editar", sec).addEventListener("click", editar);
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
  const ABAS = [["video", "Vídeo"], ["cortes", "Cortes"], ["legendas", "Legendas"], ["visual", "Visual"], ["sons", "Sons e dicas"], ["capa", "Capa"]];
  function pintarAbas() {
    const nav = $("#ed-abas"); if (!nav) return;
    const pronto = st.segs.length > 0;
    if (!pronto && st.aba !== "video") st.aba = "video";
    const conta = { cortes: palavrasRevisao().filter((w) => cortada(w) || tiradaPelaIA(w)).length, legendas: st.legendas.length, sons: st.efeitos.length };
    nav.innerHTML = ABAS.map(([k, t]) => `<button type="button" role="tab" class="rr-aba" data-aba="${k}" aria-selected="${st.aba === k}" ${k !== "video" && !pronto ? "disabled" : ""}>${t}${pronto && conta[k] ? `<span class="rr-n">${conta[k]}</span>` : ""}</button>`).join("");
    $$("[data-aba]", nav).forEach((b) => b.addEventListener("click", () => { st.aba = b.dataset.aba; pintarAbas(); if (st.aba === "capa") desenharCapa(); }));
    $$(".rr-painel").forEach((pn) => { pn.hidden = pn.dataset.painel !== st.aba; });
  }

  // ---------- edições à mão (como no CapCut), guardadas no tempo do bruto ----------
  const brutoDe = (t) => { const sg = segNoFinal(t); return sg ? sg.g0 + Math.max(0, t - sg.o0) : null; };
  function mexeuManual(remontarTudo) { if (st.tocando) parar(); if (remontarTudo) montar(); else { montar(); } pintar(); salvarDepois(); }
  const hist = (k) => { (st.manual.hist = st.manual.hist || []).push(k); };
  function porSom(tipo, t = st.t) { const g = brutoDe(t); if (g == null) return; hist("sons"); st.manual.sons.push({ id: uid(), g: +g.toFixed(2), tipo }); mexeuManual(); audio(); if (ac.state === "suspended") ac.resume(); tocarEfeito(tipo, ac.currentTime + 0.02, st.opc.vol); }
  function tirarSom(e, quieto) {
    if (e.manual) st.manual.sons = st.manual.sons.filter((m) => m.id !== e.id);
    else if (e.chave) { hist("tirados"); st.manual.tirados.push(e.chave); }
    st.sel = null; if (!quieto) mexeuManual();
  }
  function porZoom() { const g = brutoDe(st.t); if (g != null) { hist("zooms"); st.manual.zooms.push(+g.toFixed(2)); mexeuManual(); } }
  function porFlash() { const g = brutoDe(st.t); if (g != null) { hist("flashes"); st.manual.flashes.push(+g.toFixed(2)); mexeuManual(); } }
  function dividir() { const g = brutoDe(st.t); if (g == null) return; hist("divisoes"); (st.manual.divisoes = st.manual.divisoes || []).push(+g.toFixed(2)); mexeuManual(); const i = st.segs.findIndex((x) => x.g0 >= g - 0.01); if (i >= 0) { st.sel = { tipo: "plano", i }; pintarLinha(); } }
  function apagarPlano(sg) { if (st.segs.length <= 1) { toast("Esse é o único plano. Use Dividir aqui para separar o trecho que quer apagar.", true); return; } hist("cortes"); st.manual.cortes.push([+sg.g0.toFixed(2), +sg.g1.toFixed(2)]); st.sel = null; mexeuManual(); toast("Plano apagado. Para voltar, use Desfazer na linha do tempo."); }
  function desfazerManual() {
    const m = st.manual; m.divisoes = m.divisoes || [];
    const ult = [["cortes", m.cortes], ["divisoes", m.divisoes], ["sons", m.sons], ["zooms", m.zooms], ["flashes", m.flashes], ["tirados", m.tirados]].find(([, l]) => l.length);
    // desfaz o último tipo mexido (guardamos a ordem num histórico simples)
    const h = (st.manual.hist || []).pop();
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
    const temDesfazer = (m.divisoes || []).length || m.cortes.length || m.sons.length || m.zooms.length || m.flashes.length || m.tirados.length;
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
        <button type="button" class="btn" data-f="dividir">Dividir aqui</button>
        ${sel.tipo === "plano" ? `<button type="button" class="btn rr-perigo" data-f="apagar-plano">Apagar este plano</button>` : ""}
        ${efSel ? `<span class="rr-sel">${esc(EFEITOS[efSel.tipo] || efSel.tipo)} em ${tempo(efSel.t)}</span><button type="button" class="btn" data-f="ouvir-som">${ic.som}Ouvir</button><button type="button" class="btn rr-perigo" data-f="tirar-som">Tirar este som</button>` : ""}
        ${sel.tipo === "zoom" ? `<button type="button" class="btn rr-perigo" data-f="tirar-zoom">Tirar este zoom</button>` : ""}
        ${sel.tipo === "flash" ? `<button type="button" class="btn rr-perigo" data-f="tirar-flash">Tirar este flash</button>` : ""}
        ${temDesfazer ? `<button type="button" class="btn" data-f="desfazer">Desfazer</button>` : ""}
      </div>
      <div class="rr-linha-rolar"><div class="rr-linha-dentro" style="width:${larg}%">
      <div class="rr-regua" data-buscar>${marcas.map((t) => `<span style="left:${pct(t)}">${tempo(t).replace(/,\d$/, "")}</span>`).join("")}</div>
      <div class="rr-trilha rr-t-leg${o.legenda === false ? " desligada" : ""}">${st.legendas.map((g) => `<button type="button" class="rr-chip" data-ir="${g.o0}" style="left:${pct(g.o0)};width:calc(${pct(g.o1 - g.o0)} - 3px)" title="${esc(textoLeg(g))}"><b>T</b> ${esc(textoLeg(g))}</button>`).join("")}</div>
      <div class="rr-trilha rr-t-planos">${st.segs.map((sg, i) => `<button type="button" class="rr-plano-bl${i % 2 ? " par" : ""}${sg.zoom > 1 ? " zoom" : ""}${sel.tipo === "plano" && sel.i === i ? " sel" : ""}" data-plano="${i}" style="left:${pct(sg.o0)};width:calc(${pct(sg.o1 - sg.o0)} - 2px)" title="Plano ${i + 1}: toque para escolher"></button>`).join("")}</div>
      <div class="rr-trilha rr-t-fx">${(st.zoomsManuais || []).map((t, i) => `<button type="button" class="rr-zoom${sel.tipo === "zoom" && sel.i === i ? " sel" : ""}" data-zoom="${i}" style="left:${pct(t)}" title="Zoom em ${tempo(t)}">Z</button>`).join("")}${(st.flashes || []).map((t, i) => `<button type="button" class="rr-flash${sel.tipo === "flash" && sel.i === i ? " sel" : ""}" data-flash="${i}" style="left:${pct(t)}" title="Flash em ${tempo(t)}">F</button>`).join("")}</div>
      <div class="rr-trilha rr-t-sons${o.efeitos ? "" : " desligada"}">${st.efeitos.map((e) => `<button type="button" class="rr-som${e.manual ? " manual" : ""}${sel.tipo === "som" && sel.id === e.id ? " sel" : ""}" data-som="${e.id}" style="left:${pct(e.t)}" title="${esc((EFEITOS[e.tipo] || e.tipo) + (e.por_que ? ": " + e.por_que : ""))}"></button>`).join("")}</div>
      <span class="rr-agulha" id="ed-agulha" style="left:${pct(st.t)}"></span>
    </div></div>
    <p class="rr-legenda-linha"><span class="rr-chip-mini"></span> legendas · <span class="rr-plano-mini"></span> planos (Dividir aqui separa, toque no plano para apagar) · Z zoom · F flash · <span class="rr-som-mini"></span> sons (toque para ouvir ou tirar) · toque na régua para ir até o ponto</p>`;
    const f = (k) => box.querySelector(`[data-f="${k}"]`);
    f("play").addEventListener("click", () => { if (st.tocando) parar(); else tocar(st.t); setTimeout(pintarLinha, 50); });
    $$("[data-o]", box).forEach((c) => c.addEventListener("change", () => { o[c.dataset.o] = c.checked; if (c.dataset.o === "titulo") sonsDoTitulo(); guardarOpc(); pintar(); }));
    f("som").addEventListener("click", () => porSom($("#rr-som-tipo", box).value));
    f("zoom").addEventListener("click", porZoom);
    f("flash").addEventListener("click", porFlash);
    f("dividir").addEventListener("click", dividir);
    if (f("apagar-plano")) f("apagar-plano").addEventListener("click", () => apagarPlano(st.segs[sel.i]));
    if (f("tirar-som")) f("tirar-som").addEventListener("click", () => tirarSom(efSel));
    if (f("ouvir-som")) f("ouvir-som").addEventListener("click", () => { audio(); if (ac.state === "suspended") ac.resume(); tocarEfeito(efSel.tipo, ac.currentTime + 0.02, o.vol); });
    if (f("tirar-zoom")) f("tirar-zoom").addEventListener("click", () => { st.manual.zooms.splice(sel.i, 1); st.sel = null; mexeuManual(); });
    if (f("tirar-flash")) f("tirar-flash").addEventListener("click", () => { st.manual.flashes.splice(sel.i, 1); st.sel = null; mexeuManual(); });
    if (f("desfazer")) f("desfazer").addEventListener("click", desfazerManual);
    $$("[data-ir]", box).forEach((b) => b.addEventListener("click", () => irPara(Number(b.dataset.ir) + 0.02)));
    $$("[data-plano]", box).forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.plano); st.sel = { tipo: "plano", i }; irPara(st.segs[i].o0 + 0.02); pintarLinha(); }));
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

  function pintar() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec || !$("#ed-clipes", sec)) return;
    $("#ed-clipes", sec).innerHTML = (st.pendentes ? `<div class="faixa ed-pendentes"><b>Projeto "${esc(st.projeto ? st.projeto.nome : "")}"</b>: escolha de novo ${st.pendentes.length > 1 ? "os vídeos" : "o vídeo"} deste projeto para a edição voltar como você deixou: ${st.pendentes.map((x) => `<span class="${x.usado ? "ok" : ""}">${esc(x.nome)}${x.usado ? " ✓" : ""}</span>`).join(", ")}.</div>` : "") + st.clipes.map((c, i) => `<div class="ed-clipe"><span class="ed-num">${i + 1}</span><div><b>${esc(c.nome)}</b><small>${tempo(c.dur)}${c.w ? ` · ${c.w}x${c.h}` : ""}${c.palavras ? ` · ${c.palavras.length} palavras ouvidas` : ""}</small></div>
      <button class="icone-btn" type="button" data-tirar="${c.id}" aria-label="Tirar clipe" ${st.trabalhando || st.exportando ? "disabled" : ""}>${ic.x}</button></div>`).join("");
    $$("[data-tirar]", sec).forEach((b) => b.addEventListener("click", () => {
      const c = st.clipes.find((x) => x.id === b.dataset.tirar); if (!c) return;
      c.el.remove(); URL.revokeObjectURL(c.el.src); st.clipes = st.clipes.filter((x) => x !== c); st.segs = []; st.plano = null; st.editLeg = {}; pintar();
    }));
    const bt = $("#ed-editar", sec);
    bt.disabled = st.trabalhando || st.exportando || !st.clipes.length || Boolean(st.pendentes);
    bt.innerHTML = st.trabalhando ? "Editando…" : `${ic.brilho}${st.plano ? "Editar de novo" : "Editar automático"}`;
    $("#ed-vazio", sec).hidden = Boolean(st.segs.length);
    pintarEtapas(); pintarAjustes(); pintarCortes(); pintarLegendas(); pintarPlano(); pintarControles(); pintarFinal(); pintarCapa(); pintarLinha(); pintarAbas(); pintarModo(); pintarOuvi(); pintarAjustar();
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
      <span class="ed-tempo" id="ed-tempo">${tempo(st.t)} / ${tempo(st.duracao)}</span>`;
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
      <label class="ed-rotulo" for="ed-qual">Qualidade do arquivo</label>
      <select class="entrada" id="ed-qual"><option value="1080" ${o.qualidade === 1080 ? "selected" : ""}>1080 x 1920 (Full HD)</option><option value="720" ${o.qualidade === 720 ? "selected" : ""}>720 x 1280 (mais leve)</option></select>`;
    $("#ed-titulo-txt", box).addEventListener("input", (e) => { st.titulo = e.target.value; if (!st.tocando) desenhar(Math.min(st.t, 1.2)); });
    $("#ed-titulo-txt", box).addEventListener("change", () => { sonsDoTitulo(); pintarPlano(); });
    $("#ed-estilo-titulo", box).addEventListener("change", (e) => { o.estiloTitulo = e.target.value; sonsDoTitulo(); pintarPlano(); if (!st.tocando) { st.t = Math.min(st.t, 1.2); desenhar(st.t); } });
    box.onchange = guardarOpc;
    $("#ed-estilo", box).addEventListener("change", (e) => { o.estilo = e.target.value; remontar(); });
    $("#ed-sons", box).addEventListener("change", (e) => { o.sons = e.target.value; remontar(); });
    $("#ed-dina", box).addEventListener("change", (e) => { o.dinamismo = e.target.value; remontar(); });
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
        <button class="btn btn-principal ed-botao-grande" type="button" id="ed-exportar" ${st.exportando || st.trabalhando ? "disabled" : ""}>${st.exportando ? "Gerando o vídeo… (deixe esta aba aberta)" : ic.baixar + "Gerar vídeo editado"}</button>
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
      carregarPadrao(); carregarMinhaFonte();
      try { await Promise.all(["300 40px Poppins", "500 40px Poppins", "800 40px Poppins", "600 40px Poppins", 'italic 40px "DM Serif Display"', "800 40px Montserrat", "700 40px Montserrat", "800 40px Nunito", "700 40px Arimo", 'italic 40px "Instrument Serif"', "700 40px Fredoka", "700 40px Caveat"].map((f) => document.fonts.load(f))); } catch (e) { /* segue com a fonte do sistema */ }
    }
    pintar();
  }
  document.addEventListener("painel:aba", (e) => { if (e.detail === ABA) abrirAba(); else if (st.tocando && !st.exportando) parar(); });
  if (location.hash === "#" + ABA) setTimeout(abrirAba, 600);
  window.painelEdicao = { estado: st, audioDoArquivo }; // usado nos testes
})();
