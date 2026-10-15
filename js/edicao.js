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
// O padrão de edição (tirado das referências que ela mandou) fica na tabela
// configuracoes, chave "padrao_edicao", e ela pode editar.
// Nada do vídeo sai do computador dela, só o áudio vai para transcrever.
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

  const PADRAO = `PADRÃO DE EDIÇÃO DA MARI (tirado das referências que ela gosta)

RITMO
- Cortes secos, sem transição enfeitada. Corta todo silêncio, respiração e tomada errada.
- Planos curtos: no vídeo de referência que mais performou (800 mil views) a média é de 1 a 1,5 s por plano, muitos entre 0,4 e 0,9 s.
- Nos 3 primeiros segundos, exagerar: título criativo e efeito sonoro forte para prender.
- Narração "uma frase em cima da outra": fala uma frase, volta um pouco e fala a outra, sem respiro.
- Zoom leve alternado entre um corte e outro para esconder o pulo da imagem.

LEGENDA
- Palavra por palavra (1, no máximo 2 palavras), sincronizada com a fala. A mesma legenda o vídeo todo.
- Fonte sem serifa fina, branca, sem contorno, no espaço vazio perto do rosto.
- Nada cobre o rosto.
- Palavra de destaque (benefício, número, nome do produto) pode ganhar cor.

TÍTULOS E GRAFISMOS
- Título criativo no começo (modelos do CapCut tipo "mesclador" ou título feito no Canva com fundo transparente, animado).
- Setas desenhadas à mão e sublinhado tipo marca-texto para apontar detalhes.
- Logo da marca sempre visível no produto.

IMAGEM
- Cor natural e luz quente. Ajuste de cor copiando uma foto aesthetic do Pinterest no CapCut (deixa clarinho).
- Roupa de cor oposta ao cenário para destacar, unhas feitas, softbox mais luz do sol.
- Receitas e produtos: gravação de cima.
- Exportar em 4K, taxa de quadros maior.

EFEITOS SONOROS (quando usar)
- Riser: antes de algo importante, para criar tensão (começo do vídeo).
- Woosh: transições, zoom in e zoom out.
- Hit: logo depois de revelar algo importante.
- Pop, click, mouse: quando um texto ou algo aparece na tela.
- Camera shutter: cortes rápidos e transições.
- Keyboard / typing: quando algo é digitado na tela.
- UI sounds: quando aparece uma animação.
- Reverse: para encerrar música que não tem final.
- UGC de produto: som do próprio produto (ASMR) sincronizado com o gesto: chuveiro, spray ("Shaker"), escova ("Touch & scratch hair"), creme ("Sticky sound").
- Não achou um efeito? Busque "efeitos sonoros" ou "SFX" no YouTube ou TikTok, grave a tela e extraia o áudio.

ESTRUTURA DE UGC
- Gancho forte, contexto curto, demonstração do produto, prova ou benefício, CTA ("comenta X", "salva").`;

  const EFEITOS = { woosh: "Woosh", pop: "Pop", click: "Click", shutter: "Shutter", typing: "Typing", riser: "Riser", hit: "Hit", ding: "Ding" };
  const ESTILOS = { minimal: "Fina e branca (estilo das referências)", bold: "Forte com contorno", caixa: "Caixinha bege" };

  const st = {
    pronto: false, padrao: PADRAO, padraoSalvo: false,
    clipes: [], plano: null, segs: [], legendas: [], efeitos: [], zooms: [], titulo: "", duracao: 0,
    etapas: [], trabalhando: false, tocando: false, exportando: false, parar: false, t: 0,
    opc: { estilo: "minimal", altura: 0.7, silencio: true, erros: true, zoomCortes: true, zoomEnfase: true, efeitos: true, vol: 0.6, titulo: true, maiusculas: false, qualidade: 1080, cor: "#f2c14e" },
    tema: "", arquivoFinal: null,
  };

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

  // ---------- padrão de edição (tabela configuracoes) ----------
  async function carregarPadrao() {
    try {
      const { data } = await banco().from("configuracoes").select("valor").eq("chave", "padrao_edicao").maybeSingle();
      if (data && data.valor) { st.padrao = String(data.valor); st.padraoSalvo = true; }
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
    try { dec = await tmp.decodeAudioData(await arquivo.arrayBuffer()); }
    catch (e) { return []; } // vídeo sem som
    finally { try { tmp.close(); } catch (e) { /* segue */ } }
    const taxa = 16000;
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(dec.duration * taxa)), taxa);
    const src = off.createBufferSource(); src.buffer = dec; src.connect(off.destination); src.start();
    const mono = (await off.startRendering()).getChannelData(0);
    const pedaco = 600 * taxa, partes = [];
    for (let i = 0; i < mono.length; i += pedaco) partes.push({ blob: wav(mono.subarray(i, i + pedaco), taxa), inicio: i / taxa });
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
        if (isFinite(v.duration)) { ok(v); return; }
        const achou = () => { if (!isFinite(v.duration)) return; v.removeEventListener("durationchange", achou); v.currentTime = 0; ok(v); };
        v.addEventListener("durationchange", achou); v.currentTime = 1e9;
      };
      v.onerror = () => falha(new Error(`Não consegui abrir "${arquivo.name}". Tente exportar em MP4 (H.264) ou MOV.`));
      $("#ed-videos").appendChild(v);
    });
  }
  async function adicionarClipes(arquivos) {
    for (const a of arquivos) {
      if (!/^video\//.test(a.type) && !/\.(mp4|mov|m4v|webm)$/i.test(a.name)) { toast(`"${a.name}" não é vídeo.`, true); continue; }
      try { const el = await carregarVideo(a); st.clipes.push({ id: uid(), nome: a.name, arquivo: a, el, dur: el.duration || 0, w: el.videoWidth, h: el.videoHeight, palavras: null }); }
      catch (e) { toast(e.message, true); }
    }
    st.plano = null; st.segs = [];
    pintar();
  }

  // ---------- o trabalho do editor ----------
  function etapa(texto, estado) {
    const ult = st.etapas[st.etapas.length - 1];
    if (ult && ult.estado === "andando") ult.estado = "ok";
    if (texto) st.etapas.push({ texto, estado: estado || "andando" });
    pintarEtapas();
  }
  async function editar() {
    if (!st.clipes.length) { toast("Envie o vídeo bruto primeiro.", true); return; }
    if (st.trabalhando) return;
    st.trabalhando = true; st.etapas = []; pintar();
    try {
      let offset = 0;
      for (const [i, c] of st.clipes.entries()) {
        if (!c.palavras) {
          etapa(`Ouvindo o clipe ${i + 1} de ${st.clipes.length}`);
          const partes = await audioDoVideo(c.arquivo);
          c.palavras = [];
          for (const p of partes) {
            const form = new FormData(); form.append("acao", "transcrever"); form.append("arquivo", p.blob, "audio.wav");
            const r = await chamar(form);
            c.palavras.push(...(r.palavras || []).map((w) => ({ w: w.w, s: w.s + p.inicio, e: w.e + p.inicio })));
          }
        }
        c.offset = offset; offset += c.dur;
      }
      const todas = st.clipes.flatMap((c) => c.palavras.map((w) => ({ w: w.w, s: +(w.s + c.offset).toFixed(2), e: +(w.e + c.offset).toFixed(2) })));
      if (todas.length) {
        etapa("Pensando na edição (cortes, título, zoom e efeitos)");
        st.plano = await chamar({ acao: "plano", palavras: todas, duracao: offset, padrao: st.padrao, tema: st.tema });
        st.titulo = st.plano.titulo || "";
      } else {
        st.plano = { titulo: "", remover: [], destaques: [], zooms: [], efeitos: [], broll: [], dicas: ["Não ouvi fala nesse vídeo, então não cortei silêncios nem pus legenda. Dá para pôr título e efeitos à mão."], musica: "" };
      }
      etapa("Montando a linha do tempo");
      montar();
      etapa("Pronto! Dá o play para ver a prévia.", "ok");
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
      for (const w of c.palavras) {
        const a = Math.max(c.offset, c.offset + w.s - 0.08), b = Math.min(fim, c.offset + w.e + 0.14);
        if (atual && a - atual[1] < 0.3) atual[1] = Math.max(atual[1], b); else { if (atual) faixas.push(atual); atual = [a, b]; }
      }
      if (atual) faixas.push(atual);
    }
    let lista = faixas;
    if (st.opc.erros && st.plano) for (const r of st.plano.remover || []) {
      const nova = [];
      for (const [a, b] of lista) { if (r.ate <= a || r.de >= b) { nova.push([a, b]); continue; } if (r.de > a) nova.push([a, r.de]); if (r.ate < b) nova.push([r.ate, b]); }
      lista = nova;
    }
    return lista.filter(([a, b]) => b - a >= 0.15);
  }
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
    st.segs.forEach((s, i) => { const ant = st.segs[i - 1]; s.zoom = ant && ant.ci === s.ci && st.opc.zoomCortes ? (ant.zoom > 1 ? 1 : 1.08) : 1; });
    const p = st.plano || {};
    // legendas palavra por palavra
    const palavras = [];
    for (const c of st.clipes) for (const w of c.palavras || []) {
      const o = paraFinal(c.offset + w.s); if (o == null) continue;
      const fim = paraFinal(Math.min(c.offset + w.e, c.offset + c.dur - 0.01));
      palavras.push({ w: w.w, o0: o, o1: fim != null && fim > o ? fim : o + 0.25, g: c.offset + w.s });
    }
    // cada destaque vai para a palavra mais perto do tempo que a IA marcou (de preferência a mesma palavra)
    const limpa = (x) => String(x || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    for (const d of p.destaques || []) {
      const perto = palavras.filter((x) => Math.abs(x.g - d.t) < 1.2);
      const alvo = perto.find((x) => d.palavra && limpa(x.w) === limpa(d.palavra)) || perto.sort((a, b) => Math.abs(a.g - d.t) - Math.abs(b.g - d.t))[0];
      if (alvo) alvo.destaque = true;
    }
    st.legendas = agrupar(palavras);
    // efeitos e zooms do plano no tempo final
    st.efeitos = (p.efeitos || []).map((e) => ({ id: uid(), t: paraFinalPerto(e.t), tipo: e.tipo, por_que: e.por_que || "" })).filter((e) => e.t != null);
    if (st.titulo && !st.efeitos.some((e) => e.t < 0.4 && e.tipo === "pop")) st.efeitos.unshift({ id: uid(), t: 0.05, tipo: "pop", por_que: "entrada do título" });
    st.efeitos.sort((a, b) => a.t - b.t);
    st.zooms = (p.zooms || []).map((z) => paraFinalPerto(z.t)).filter((t) => t != null);
  }
  function agrupar(palavras) {
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
    if (st.opc.zoomEnfase) for (const zt of st.zooms) {
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
      const z = (s ? s.zoom : 1) * zoomEm(t);
      const esc0 = Math.max(W / vw, H / vh) * z;
      const dw = vw * esc0, dh = vh * esc0;
      c2d.drawImage(v, (W - dw) / 2, (H - dh) * 0.42, dw, dh);
    }
    const u = W / 1080;
    // legenda
    const g = st.legendas.find((x) => t >= x.o0 && t < x.o1);
    if (g && !(st.opc.titulo && st.titulo && t < 2.4)) desenharLegenda(g, u, W, H);
    // título do gancho
    if (st.opc.titulo && st.titulo && t < 2.6) desenharTitulo(t, u, W, H);
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
    const partes = g.palavras.map((w) => ({ t: textoDe(w), destaque: w.destaque }));
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
  function desenharTitulo(t, u, W, H) {
    const k = Math.min(1, t / 0.22), saida = t > 2.3 ? Math.max(0, 1 - (t - 2.3) / 0.3) : 1;
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
  function ligarClipe(c) {
    audio();
    if (c.no) return;
    c.no = ac.createMediaElementSource(c.el); c.no.connect(mestre);
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
    return st.legendas.map((g, i) => `${i + 1}\n${f(g.o0)} --> ${f(g.o1)}\n${g.palavras.map((w) => w.w).join(" ")}\n`).join("\n");
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
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga ed">
      <header class="cr-cabeca cr-cabeca-linha"><div><h2>Edição de vídeos</h2><p>Mande o vídeo bruto e eu edito no seu padrão: corto silêncios e tomadas erradas, ponho legenda palavra por palavra, zoom, título no gancho e efeitos sonoros. Você vê a prévia e baixa o MP4.</p></div>
        <div class="cr-acoes-topo"><button class="btn" type="button" id="ed-ver-padrao">Meu padrão de edição</button></div></header>
      <div class="ed-grade">
        <div class="ed-col-esq">
          <section class="ed-cartao">
            <label class="ed-soltar" id="ed-soltar">${ic.filme}<b>Enviar vídeo bruto</b><small>Pode mandar vários clipes, eles entram na ordem. MP4 ou MOV.</small><input type="file" id="ed-arquivo" accept="video/*,.mov,.mp4,.m4v,.webm" multiple hidden></label>
            <div id="ed-clipes"></div>
            <input class="entrada" id="ed-tema" placeholder="Tema ou marca do vídeo (opcional, ajuda no título)">
            <button class="btn btn-principal ed-botao-grande" type="button" id="ed-editar">${ic.brilho}Editar automático</button>
            <ol class="ed-etapas" id="ed-etapas"></ol>
          </section>
          <section class="ed-cartao" id="ed-ajustes"></section>
        </div>
        <div class="ed-col-meio">
          <div class="ed-tela"><canvas id="ed-canvas" width="1080" height="1920"></canvas><div class="ed-vazio" id="ed-vazio">${ic.filme}<span>A prévia aparece aqui</span></div></div>
          <div class="ed-controles" id="ed-controles"></div>
          <div id="ed-final"></div>
        </div>
        <div class="ed-col-dir" id="ed-plano"></div>
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
    $("#ed-tema", sec).addEventListener("input", (e) => { st.tema = e.target.value; });
    $("#ed-ver-padrao", sec).addEventListener("click", abrirPadrao);
    prepararCanvas();
  }

  function pintar() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec || !$("#ed-clipes", sec)) return;
    $("#ed-clipes", sec).innerHTML = st.clipes.map((c, i) => `<div class="ed-clipe"><span class="ed-num">${i + 1}</span><div><b>${esc(c.nome)}</b><small>${tempo(c.dur)}${c.w ? ` · ${c.w}x${c.h}` : ""}${c.palavras ? ` · ${c.palavras.length} palavras ouvidas` : ""}</small></div>
      <button class="icone-btn" type="button" data-tirar="${c.id}" aria-label="Tirar clipe" ${st.trabalhando || st.exportando ? "disabled" : ""}>${ic.x}</button></div>`).join("");
    $$("[data-tirar]", sec).forEach((b) => b.addEventListener("click", () => {
      const c = st.clipes.find((x) => x.id === b.dataset.tirar); if (!c) return;
      c.el.remove(); URL.revokeObjectURL(c.el.src); st.clipes = st.clipes.filter((x) => x !== c); st.segs = []; st.plano = null; pintar();
    }));
    const bt = $("#ed-editar", sec);
    bt.disabled = st.trabalhando || st.exportando || !st.clipes.length;
    bt.innerHTML = st.trabalhando ? "Editando…" : `${ic.brilho}${st.plano ? "Editar de novo" : "Editar automático"}`;
    $("#ed-vazio", sec).hidden = Boolean(st.segs.length);
    pintarEtapas(); pintarAjustes(); pintarPlano(); pintarControles(); pintarFinal();
    if (st.segs.length && !st.tocando) desenhar(st.t);
  }
  function pintarEtapas() {
    const ol = $("#ed-etapas"); if (!ol) return;
    ol.innerHTML = st.etapas.map((e) => `<li class="${e.estado}">${esc(e.texto)}</li>`).join("");
  }
  function pintarControles() {
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
  function atualizarTempo() { const t = $("#ed-tempo"); if (t) t.textContent = `${tempo(st.t)} / ${tempo(st.duracao)}`; const b = $("#ed-barra"); if (b && st.tocando) b.value = st.t; }

  function pintarAjustes() {
    const box = $("#ed-ajustes"); if (!box) return;
    if (!st.segs.length) { box.hidden = true; return; }
    box.hidden = false;
    const o = st.opc, chk = (k, t) => `<label class="ed-chk"><input type="checkbox" data-opc="${k}" ${o[k] ? "checked" : ""}> ${t}</label>`;
    box.innerHTML = `<h3 class="ed-titulo">Ajustes</h3>
      <label class="ed-rotulo" for="ed-titulo-txt">Título do gancho</label>
      <input class="entrada" id="ed-titulo-txt" value="${esc(st.titulo)}" maxlength="60" placeholder="Sem título">
      <label class="ed-rotulo" for="ed-estilo">Legenda</label>
      <select class="entrada" id="ed-estilo">${Object.entries(ESTILOS).map(([k, t]) => `<option value="${k}" ${o.estilo === k ? "selected" : ""}>${t}</option>`).join("")}</select>
      <label class="ed-rotulo" for="ed-altura">Altura da legenda</label>
      <input type="range" id="ed-altura" min="0.35" max="0.88" step="0.01" value="${o.altura}">
      <div class="ed-linha"><label class="ed-rotulo" for="ed-cor">Cor do destaque</label><input type="color" id="ed-cor" value="${o.cor}"></div>
      <div class="ed-chks">${chk("silencio", "Cortar silêncios")}${chk("erros", "Tirar tomadas erradas")}${chk("zoomCortes", "Zoom alternado nos cortes")}${chk("zoomEnfase", "Zoom na ênfase")}${chk("titulo", "Mostrar título")}${chk("efeitos", "Efeitos sonoros")}${chk("maiusculas", "Legenda em maiúsculas")}</div>
      <label class="ed-rotulo" for="ed-vol">Volume dos efeitos</label>
      <input type="range" id="ed-vol" min="0" max="1.2" step="0.05" value="${o.vol}">
      <label class="ed-rotulo" for="ed-qual">Qualidade do arquivo</label>
      <select class="entrada" id="ed-qual"><option value="1080" ${o.qualidade === 1080 ? "selected" : ""}>1080 x 1920 (Full HD)</option><option value="720" ${o.qualidade === 720 ? "selected" : ""}>720 x 1280 (mais leve)</option></select>`;
    $("#ed-titulo-txt", box).addEventListener("input", (e) => { st.titulo = e.target.value; if (!st.tocando) desenhar(Math.min(st.t, 1)); });
    $("#ed-estilo", box).addEventListener("change", (e) => { o.estilo = e.target.value; redesenhar(); });
    $("#ed-altura", box).addEventListener("input", (e) => { o.altura = Number(e.target.value); redesenhar(); });
    $("#ed-cor", box).addEventListener("input", (e) => { o.cor = e.target.value; redesenhar(); });
    $("#ed-vol", box).addEventListener("input", (e) => { o.vol = Number(e.target.value); });
    $("#ed-qual", box).addEventListener("change", (e) => { o.qualidade = Number(e.target.value); prepararCanvas(); redesenhar(); });
    $$("[data-opc]", box).forEach((c) => c.addEventListener("change", () => {
      o[c.dataset.opc] = c.checked;
      // cortes mudam a linha do tempo inteira: monta de novo (os efeitos voltam aos do plano)
      if (["silencio", "erros", "zoomCortes"].includes(c.dataset.opc)) { if (st.tocando) parar(); montar(); st.t = Math.min(st.t, st.duracao); pintar(); }
      else redesenhar();
    }));
  }
  function redesenhar() { if (!st.tocando) desenhar(st.t); }

  function pintarPlano() {
    const box = $("#ed-plano"); if (!box) return;
    if (!st.plano || !st.segs.length) { box.innerHTML = `<section class="ed-cartao ed-dica"><h3 class="ed-titulo">Como funciona</h3><ol class="ed-passos"><li>Grave do seu jeito, pode ser em várias partes e com tomadas erradas.</li><li>Envie os arquivos aqui e clique em <b>Editar automático</b>.</li><li>Eu escuto, corto, legendo, ponho zoom, título e efeitos no seu padrão.</li><li>Confira a prévia, ajuste o que quiser e baixe o MP4.</li></ol><p class="ed-obs">O vídeo não sai do seu computador: só o áudio vai para a transcrição. A exportação acontece em tempo real, então deixe esta aba aberta até terminar.</p></section>`; return; }
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
      ${(p.broll || []).length ? `<section class="ed-cartao"><h3 class="ed-titulo">B-roll para gravar</h3><ul class="ed-lista">${p.broll.map((b) => `<li><span>${b.t != null && paraFinalPerto(b.t) != null ? tempo(paraFinalPerto(b.t)) : ""}</span>${esc(b.ideia)}</li>`).join("")}</ul></section>` : ""}
      ${p.musica || (p.dicas || []).length ? `<section class="ed-cartao"><h3 class="ed-titulo">Dicas do editor</h3>${p.musica ? `<p class="ed-obs"><b>Música:</b> ${esc(p.musica)}</p>` : ""}<ul class="ed-lista">${(p.dicas || []).map((d) => `<li>${esc(d)}</li>`).join("")}</ul></section>` : ""}`;
    $$(".ed-efeito", box).forEach((l) => {
      const e = st.efeitos.find((x) => x.id === l.dataset.id);
      $("[data-ouvir]", l).addEventListener("click", () => { audio(); if (ac.state === "suspended") ac.resume(); tocarEfeito(e.tipo, ac.currentTime + (e.tipo === "riser" ? 1.2 : 0.02), st.opc.vol); });
      $("[data-ir]", l).addEventListener("click", () => irPara(Math.max(0, e.t - 0.6)));
      $("[data-tipo]", l).addEventListener("change", (ev) => { e.tipo = ev.target.value; });
      $("[data-apagar]", l).addEventListener("click", () => { st.efeitos = st.efeitos.filter((x) => x !== e); pintarPlano(); });
    });
    $("#ed-add-efeito", box).addEventListener("click", () => { st.efeitos.push({ id: uid(), t: st.t, tipo: $("#ed-novo-tipo", box).value, por_que: "você pôs" }); st.efeitos.sort((a, b) => a.t - b.t); pintarPlano(); });
  }
  async function irPara(t) {
    if (st.tocando) parar();
    st.t = t; const s = segNoFinal(t); if (!s) return;
    const v = st.clipes[s.ci].el; v.currentTime = s.a + (t - s.o0); await esperarEvento(v, "seeked"); desenhar(t); pintarControles();
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
      if (!document.getElementById("ed-fontes")) { const l = document.createElement("link"); l.id = "ed-fontes"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@300;600;800&display=swap"; document.head.appendChild(l); }
      montarTela(sec); st.pronto = true;
      carregarPadrao();
      try { await Promise.all(["300 40px Poppins", "800 40px Poppins", "600 40px Poppins"].map((f) => document.fonts.load(f))); } catch (e) { /* segue com a fonte do sistema */ }
    }
    pintar();
  }
  document.addEventListener("painel:aba", (e) => { if (e.detail === ABA) abrirAba(); else if (st.tocando && !st.exportando) parar(); });
  if (location.hash === "#" + ABA) setTimeout(abrirAba, 600);
  window.painelEdicao = { estado: st }; // usado nos testes
})();
