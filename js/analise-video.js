// Análise de vídeo: cenas e voz (nov/2026, pedido da Mari: "analisar todas as cenas do vídeo e a voz também")
// Tudo no navegador, sem serviço pago:
// - Cenas: passa pelo vídeo (até 240 quadros pequenos em cinza), acha os cortes pela diferença entre
//   quadros e tira 1 quadro do meio de cada cena (288 px para a IA de visão + miniatura 96 px para guardar).
// - Voz: decodifica o áudio, mede ritmo (palavras por segundo pelos tempos da transcrição), pausas,
//   % do vídeo com voz, tom médio e variação de tom (autocorrelação), variação de volume e energia por cena.
// window.painelAnaliseVideo.estudar(blob, { segmentos, transcricao, aoProgresso }) -> { cenas, folhas, voz, duracao }
// folhas = até 8 cenas numeradas por imagem (a IA de visão do Groq grátis não aguenta 1 imagem por cena)
(function () {
  const MAX_CENAS = 14;
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const r1 = (n) => Math.round(n * 10) / 10;
  const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]; };
  const palavras = (t) => String(t || "").trim().split(/\s+/).filter(Boolean).length;

  function buscar(v, t) {
    return new Promise((ok) => {
      let feito = false;
      const fim = () => { if (feito) return; feito = true; v.removeEventListener("seeked", fim); ok(); };
      v.addEventListener("seeked", fim);
      setTimeout(fim, 2500);
      try { v.currentTime = Math.max(0, Math.min(t, (v.duration || t) - 0.05)); } catch (e) { fim(); }
    });
  }

  async function abrirVideo(url) {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.crossOrigin = "anonymous"; v.src = url;
    v.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none";
    document.body.appendChild(v);
    await new Promise((ok, erro) => {
      v.onloadeddata = ok; v.onerror = () => erro(new Error("Não consegui abrir o vídeo para ver as cenas."));
      setTimeout(() => erro(new Error("O vídeo demorou demais para abrir.")), 30000);
    });
    // Safari só tem quadro depois de tocar
    try { await v.play(); v.pause(); } catch (e) { /* segue */ }
    return v;
  }

  async function acharCenas(v, aoProgresso) {
    const dur = v.duration || 0;
    if (!dur || !isFinite(dur)) throw new Error("Não consegui ler a duração do vídeo.");
    const passo = Math.max(0.25, dur / 240);
    const c = document.createElement("canvas"); c.width = 36; c.height = 64;
    const x = c.getContext("2d", { willReadFrequently: true });
    let antes = null; const difs = [];
    for (let t = 0, i = 0; t < dur; t += passo, i++) {
      await buscar(v, t);
      x.drawImage(v, 0, 0, 36, 64);
      const d = x.getImageData(0, 0, 36, 64).data;
      const cinza = new Float32Array(36 * 64);
      for (let k = 0; k < cinza.length; k++) cinza[k] = d[k * 4] * 0.3 + d[k * 4 + 1] * 0.59 + d[k * 4 + 2] * 0.11;
      if (antes) { let s = 0; for (let k = 0; k < cinza.length; k++) s += Math.abs(cinza[k] - antes[k]); difs.push({ t, d: s / cinza.length }); }
      antes = cinza;
      if (aoProgresso && i % 8 === 0) aoProgresso(`Assistindo o vídeo para achar as cenas... ${Math.min(99, Math.round((t / dur) * 100))}%`);
    }
    const mediana = pct(difs.map((z) => z.d), 0.5);
    const limite = Math.max(14, mediana * 3.2);
    const cortes = [0];
    difs.forEach((z) => { if (z.d > limite && z.t - cortes[cortes.length - 1] >= 0.5) cortes.push(z.t - passo / 2); });
    let cenas = cortes.map((ini, i) => ({ ini, fim: i + 1 < cortes.length ? cortes[i + 1] : dur }));
    // cena final minúscula junta com a anterior
    cenas = cenas.filter((s, i) => !(i > 0 && s.fim - s.ini < 0.35 && (cenas[i - 1].fim = s.fim)));
    // tomada longa sem corte: divide em partes de até 7 s para ver o que muda (gesto, produto, close)
    const div = [];
    cenas.forEach((s) => {
      const n = Math.ceil((s.fim - s.ini) / 7);
      if (n <= 1) { div.push(s); return; }
      const p = (s.fim - s.ini) / n;
      for (let k = 0; k < n; k++) div.push({ ini: s.ini + k * p, fim: s.ini + (k + 1) * p, mesmaTomada: k > 0 });
    });
    cenas = div;
    // muitas cenas: junta as vizinhas mais curtas até caber
    while (cenas.length > MAX_CENAS) {
      let m = 0, menor = Infinity;
      for (let i = 0; i < cenas.length - 1; i++) { const d = cenas[i + 1].fim - cenas[i].ini; if (d < menor) { menor = d; m = i; } }
      cenas.splice(m, 2, { ini: cenas[m].ini, fim: cenas[m + 1].fim, juntas: true });
    }
    return { cenas, dur, cortes: cortes.length - 1 };
  }

  async function quadrosDasCenas(v, cenas, aoProgresso) {
    const W = v.videoWidth || 720, H = v.videoHeight || 1280;
    const big = document.createElement("canvas"); big.width = 288; big.height = Math.round((288 * H) / W);
    const mini = document.createElement("canvas"); mini.width = 96; mini.height = Math.round((96 * H) / W);
    for (let i = 0; i < cenas.length; i++) {
      const s = cenas[i];
      await buscar(v, s.ini + Math.min(Math.max(0.15, (s.fim - s.ini) * 0.5), s.fim - s.ini));
      big.getContext("2d").drawImage(v, 0, 0, big.width, big.height);
      mini.getContext("2d").drawImage(v, 0, 0, mini.width, mini.height);
      s.imagem = big.toDataURL("image/jpeg", 0.72);
      s.mini = mini.toDataURL("image/jpeg", 0.6);
      if (aoProgresso) aoProgresso(`Tirando um quadro de cada cena... ${i + 1} de ${cenas.length}`);
    }
  }
  // folhas de contato: até 8 cenas numa imagem só (4 x 2), com o número de cada cena.
  // O Groq grátis só aceita 3 imagens por pedido e uns 7 mil tokens de entrada por minuto,
  // então mandar 1 imagem por cena não cabe; a folha deixa a IA ver todas as cenas.
  async function folhasDeContato(cenas) {
    const POR = 8, COL = 4, TW = 180, TH = 320;
    const folhas = [];
    for (let ini = 0; ini < cenas.length; ini += POR) {
      const grupo = cenas.slice(ini, ini + POR);
      const lin = Math.ceil(grupo.length / COL), col = Math.min(COL, grupo.length);
      const c = document.createElement("canvas"); c.width = col * TW; c.height = lin * TH;
      const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);
      for (let k = 0; k < grupo.length; k++) {
        const img = new Image(); img.src = grupo[k].imagem;
        await new Promise((ok) => { img.onload = ok; img.onerror = ok; });
        const px = (k % COL) * TW, py = Math.floor(k / COL) * TH;
        const esc = Math.max(TW / (img.width || TW), TH / (img.height || TH));
        const w = (img.width || TW) * esc, h = (img.height || TH) * esc;
        x.save(); x.beginPath(); x.rect(px, py, TW, TH); x.clip();
        x.drawImage(img, px + (TW - w) / 2, py + (TH - h) / 2, w, h); x.restore();
        x.strokeStyle = "#fff"; x.lineWidth = 2; x.strokeRect(px + 1, py + 1, TW - 2, TH - 2);
        x.fillStyle = "#ffeb3b"; x.fillRect(px + 4, py + 4, 40, 30);
        x.fillStyle = "#000"; x.font = "bold 22px Arial"; x.textAlign = "center"; x.textBaseline = "middle";
        x.fillText(String(ini + k + 1), px + 24, py + 20);
      }
      folhas.push({ de: ini, ate: ini + grupo.length - 1, imagem: c.toDataURL("image/jpeg", 0.8) });
    }
    return folhas;
  }

  // ---------- voz ----------
  function tomDoQuadro(sinal, ini, n, sr) {
    // autocorrelação normalizada, 75 a 400 Hz
    const minL = Math.floor(sr / 400), maxL = Math.floor(sr / 75);
    let energia = 0; for (let k = 0; k < n; k++) energia += sinal[ini + k] * sinal[ini + k];
    if (energia <= 1e-6) return 0;
    let melhor = 0, lag = 0;
    for (let L = minL; L <= maxL; L++) {
      let s = 0; for (let k = 0; k + L < n; k++) s += sinal[ini + k] * sinal[ini + k + L];
      const nrm = s / energia;
      if (nrm > melhor) { melhor = nrm; lag = L; }
    }
    return melhor > 0.45 && lag ? sr / lag : 0;
  }

  async function medirVoz(blob, cenas, dur, segmentos, transcricao, aoProgresso) {
    if (aoProgresso) aoProgresso("Ouvindo a voz do vídeo...");
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ac = new Ctx();
    let buf;
    try { buf = await ac.decodeAudioData(await blob.arrayBuffer()); }
    catch (e) { ac.close().catch(() => {}); return { erro: "Não consegui ler o áudio desse vídeo neste navegador." }; }
    ac.close().catch(() => {});
    // mono, reduzido para ~8 kHz (média simples)
    const fator = Math.max(1, Math.round(buf.sampleRate / 8000)), sr = buf.sampleRate / fator;
    const n = Math.floor(buf.length / fator), sinal = new Float32Array(n);
    const canais = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
    for (let i = 0; i < n; i++) { let s = 0; for (const ch of canais) for (let k = 0; k < fator; k++) s += ch[i * fator + k] || 0; sinal[i] = s / (fator * canais.length); }
    const Q = Math.round(sr * 0.05); // quadros de 50 ms
    const db = [];
    for (let i = 0; i + Q <= n; i += Q) { let s = 0; for (let k = 0; k < Q; k++) s += sinal[i + k] * sinal[i + k]; db.push(10 * Math.log10(s / Q + 1e-10)); }
    if (!db.length) return null;
    const piso = pct(db, 0.1), pico = pct(db, 0.97);
    if (pico < -60) return { erro: "O vídeo não tem som." };
    let lim = Math.max(piso + 9, pico - 28);
    if (lim > pico - 6) lim = pico - 20; // som quase constante: o piso é a própria voz ou música
    const fala = db.map((d) => d > lim);
    // suaviza: buracos de até 150 ms dentro da fala contam como fala
    for (let i = 1; i < fala.length - 3; i++) if (!fala[i] && fala[i - 1]) { let j = i; while (j < fala.length && !fala[j] && j - i < 3) j++; if (j < fala.length && fala[j] && j - i < 3) for (let k = i; k < j; k++) fala[k] = true; }
    const primeiro = fala.indexOf(true), ultimo = fala.lastIndexOf(true);
    let pausas = 0, maiorPausa = 0;
    for (let i = primeiro, run = 0; i <= ultimo && i >= 0; i++) {
      if (!fala[i]) run++; else { if (run * 0.05 >= 0.4) { pausas++; maiorPausa = Math.max(maiorPausa, run * 0.05); } run = 0; }
    }
    const dbFala = db.filter((_, i) => fala[i]);
    const media = dbFala.reduce((a, b) => a + b, 0) / (dbFala.length || 1);
    const desvio = Math.sqrt(dbFala.reduce((a, b) => a + (b - media) * (b - media), 0) / (dbFala.length || 1));
    // tom (no máximo 500 quadros de fala espalhados)
    if (aoProgresso) aoProgresso("Ouvindo o tom da voz...");
    const idxFala = fala.map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
    const passo = Math.max(1, Math.floor(idxFala.length / 500));
    const tons = [];
    const N = Math.round(sr * 0.04);
    for (let k = 0; k < idxFala.length; k += passo) { const ini = idxFala[k] * Q; if (ini + N < n) { const f = tomDoQuadro(sinal, ini, N, sr); if (f) tons.push(f); } if (k % 100 === 0) await esperar(0); }
    const tomMed = pct(tons, 0.5), t10 = pct(tons, 0.1), t90 = pct(tons, 0.9);
    // ritmo pelas palavras da transcrição
    const segs = (Array.isArray(segmentos) ? segmentos : []).map((s, i, a) => ({ ini: Number(s.ini) || 0, fim: Number(a[i + 1] && a[i + 1].ini) || dur, n: palavras(s.texto) }));
    const totalPal = segs.length ? segs.reduce((a, s) => a + s.n, 0) : palavras(transcricao);
    const segFala = fala.filter(Boolean).length * 0.05;
    const palNo = (a, b) => segs.reduce((acc, s) => { const o = Math.max(0, Math.min(b, s.fim) - Math.max(a, s.ini)); return acc + (s.fim > s.ini ? (s.n * o) / (s.fim - s.ini) : 0); }, 0);
    const energiaEntre = (a, b) => { const i0 = Math.floor(a / 0.05), i1 = Math.max(i0 + 1, Math.floor(b / 0.05)); const fat = db.slice(i0, i1); if (!fat.length) return 0; const m = pct(fat, 0.6); return Math.max(0, Math.min(100, Math.round(((m - (pico - 40)) / 40) * 100))); };
    const ruidoFora = pct(db.filter((_, i) => !fala[i]), 0.5);
    return {
      palavrasPorSeg: segFala > 1 && totalPal ? r1(totalPal / segFala) : null,
      ritmoGancho: segs.length ? r1(palNo(0, 3) / 3) : null,
      primeiraFala: primeiro >= 0 ? r1(primeiro * 0.05) : null,
      falaPct: Math.round((segFala / (dur || 1)) * 100),
      pausas, maiorPausa: r1(maiorPausa),
      tomHz: tons.length > 20 ? Math.round(tomMed) : null,
      variacaoTom: tons.length > 20 && t10 ? r1(12 * Math.log2(t90 / t10)) : null,
      variacaoVolume: r1(desvio),
      somDeFundo: ruidoFora > piso + 12 ? "som contínuo entre as falas (provavelmente música de fundo)" : "quase silêncio entre as falas",
      trechos: cenas.map((s) => ({ ini: r1(s.ini), pps: segs.length && s.fim - s.ini > 0.3 ? r1(palNo(s.ini, s.fim) / (s.fim - s.ini)) : null, energia: energiaEntre(s.ini, s.fim) })),
    };
  }

  async function estudar(blob, { segmentos, transcricao, aoProgresso } = {}) {
    const url = URL.createObjectURL(blob);
    let v = null;
    try {
      v = await abrirVideo(url);
      const { cenas, dur, cortes } = await acharCenas(v, aoProgresso);
      await quadrosDasCenas(v, cenas, aoProgresso);
      const folhas = await folhasDeContato(cenas);
      let voz = null;
      try { voz = await medirVoz(blob, cenas, dur, segmentos, transcricao, aoProgresso); } catch (e) { voz = { erro: "Não consegui ouvir o áudio." }; }
      return { cenas: cenas.map((s) => ({ ini: r1(s.ini), fim: r1(s.fim), imagem: s.imagem, mini: s.mini, mesmaTomada: !!s.mesmaTomada })), folhas, voz, duracao: Math.round(dur), cortes };
    } finally {
      if (v) { try { v.pause(); } catch (e) { /* segue */ } v.remove(); }
      URL.revokeObjectURL(url);
    }
  }

  // ---------- escolha "Analisar cenas e voz" (nov/2026, pedido da Mari) ----------
  // vale para a página Análise de transcrição e para a janela da Biblioteca de Referências
  const CHAVE = "analisarCenas";
  function ligado() { try { return localStorage.getItem(CHAVE) !== "nao"; } catch (e) { return true; } }
  function ligar(sim) { try { localStorage.setItem(CHAVE, sim ? "sim" : "nao"); } catch (e) { /* segue */ } }
  const escH = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function chaveHtml() {
    return `<label class="av-chave" title="Assistir as cenas e ouvir a voz do vídeo (demora mais: o vídeo é visto no navegador)"><input type="checkbox" data-av-chave${ligado() ? " checked" : ""}><span>Analisar cenas e voz</span></label>`;
  }
  function ligarChave(caixa) {
    (caixa || document).querySelectorAll("[data-av-chave]").forEach((c) => c.addEventListener("change", () => {
      ligar(c.checked);
      document.querySelectorAll("[data-av-chave]").forEach((o) => { o.checked = c.checked; });
    }));
  }

  async function invocar(nome, corpo) {
    const { data, error } = await window.banco.functions.invoke(nome, { body: corpo });
    let msg = data && (data.error || data.erro);
    if (error) { try { const j = await error.context.json(); msg = j.error || j.erro; } catch (e) { /* sem corpo */ } msg = msg || "Não consegui agora. Tente de novo."; }
    if (msg) throw new Error(msg);
    return data || {};
  }
  // pega o arquivo do vídeo: o guardado no painel ou baixado do link (Instagram/TikTok, pela função referencias)
  async function blobDe(x, aoProgresso) {
    let path = x.video_path || "";
    if (!path && x.link && /instagram\.com|tiktok\.com/i.test(x.link)) {
      aoProgresso && aoProgresso("Baixando o vídeo do link... (até 1 minuto)");
      const g = await invocar("referencias", { acao: "video", link: x.link, id: x.fonte === "roteiros" ? x.id : null });
      path = g.path || "";
      if (path && x.fonte === "roteiros") { x.video_path = g.path; x.video_tamanho = g.tamanho; }
    }
    if (!path) throw new Error(x.link ? "Esse link não deixa baixar o vídeo." : "O arquivo desse vídeo não está guardado no painel.");
    const u = window.painelVideos ? await window.painelVideos.url(path) : "";
    if (!u) throw new Error("Não consegui abrir o vídeo guardado.");
    const r = await fetch(u);
    if (!r.ok) throw new Error("Não consegui baixar o vídeo guardado.");
    return { blob: await r.blob(), path };
  }
  // cenas + voz de qualquer referência (Biblioteca): devolve { cenas, visual, voz, cortes, video_path, em } ou { erro }
  async function cenasEVoz(x, aoProgresso) {
    try {
      const { blob, path } = await blobDe(x, aoProgresso);
      const e = await estudar(blob, { segmentos: x.segmentos, transcricao: x.transcricao, aoProgresso });
      aoProgresso && aoProgresso(`Analisando as ${e.cenas.length} cenas e a voz... (uns 40 segundos)`);
      const ref = { titulo: x.titulo || "", transcricao: String(x.transcricao || x.legenda || "").slice(0, 3500), segmentos: x.segmentos || null, duracao: x.duracao || e.duracao,
        cenas: e.cenas.map((c) => ({ ini: c.ini, fim: c.fim })), folhas: e.folhas };
      if (e.voz && !e.voz.erro) ref.voz = e.voz;
      if (!ref.transcricao) ref.transcricao = "(vídeo sem fala transcrita)";
      const res = await invocar("referencias", { acao: "analise", referencia: ref });
      (res.cenas || []).forEach((c, i) => { if (e.cenas[i]) c.mini = e.cenas[i].mini; });
      return { cenas: res.cenas || [], visual: res.visual || [], voz: res.voz || null, cortes: e.cortes, semVisao: !!res.semVisao,
        vozErro: e.voz && e.voz.erro ? e.voz.erro : "", video_path: path, em: new Date().toISOString() };
    } catch (err) { return { erro: String(err.message || err), em: new Date().toISOString() }; }
  }

  const mmssH = (s) => `${String(Math.floor((Number(s) || 0) / 60)).padStart(2, "0")}:${String(Math.round((Number(s) || 0) % 60)).padStart(2, "0")}`;
  // html dos blocos Cenas e Voz (mesmo visual da página Análise de transcrição; classes cr-*)
  function htmlCenasVoz(d) {
    if (!d) return "";
    if (d.erro) return `<p class="cr-nota">Cenas e voz: ${escH(d.erro)}</p>`;
    const itens = (l) => `<ul>${(l || []).map((t) => `<li>${escH(t)}</li>`).join("")}</ul>`;
    const cenas = d.cenas || [], v = d.voz || null, m = (v && v.medidas) || null;
    const nivelTom = (x) => x == null ? "" : x <= 3 ? "voz mais reta" : x <= 7 ? "voz expressiva" : "voz bem animada";
    const nivelRitmo = (x) => x == null ? "" : x < 2.3 ? "fala calma" : x < 3.2 ? "ritmo médio" : "fala rápida";
    const chips = m ? [m.palavrasPorSeg != null ? `${String(m.palavrasPorSeg).replace(".", ",")} palavras/s · ${nivelRitmo(m.palavrasPorSeg)}` : "", m.variacaoTom != null ? nivelTom(m.variacaoTom) : "", m.pausas != null ? `${m.pausas} pausa${m.pausas === 1 ? "" : "s"}` : "", m.falaPct != null ? `voz em ${m.falaPct}% do vídeo` : "", m.primeiraFala != null ? `primeira fala em ${String(m.primeiraFala).replace(".", ",")} s` : ""].filter(Boolean) : [];
    const htmlC = cenas.length ? `<section class="av-bloco"><h4>Cenas do vídeo (${cenas.length})</h4>
      <ol class="cr-cenas">${cenas.map((c, i) => `<li data-ir="${c.ini}">
        ${c.mini ? `<img src="${c.mini}" alt="Cena ${i + 1}" loading="lazy">` : `<span class="cr-cena-sem">${i + 1}</span>`}
        <div><div class="cr-cena-topo"><span class="cr-tempo">${mmssH(c.ini)} - ${mmssH(c.fim)}</span>${c.funcao ? `<span class="cr-cena-funcao">${escH(c.funcao)}</span>` : ""}${c.enquadramento ? `<span class="cr-cena-enq">${escH(c.enquadramento)}</span>` : ""}</div>
        ${c.visual ? `<p>${escH(c.visual)}</p>` : ""}${c.texto_tela ? `<p class="cr-cena-extra"><b>Texto na tela:</b> ${escH(c.texto_tela)}</p>` : ""}
        ${c.fala ? `<p class="cr-cena-fala">"${escH(c.fala)}"</p>` : ""}${c.por_que ? `<p class="cr-cena-extra"><b>Por que funciona:</b> ${escH(c.por_que)}</p>` : ""}
        ${c.dica ? `<p class="cr-cena-extra"><b>Para gravar a sua:</b> ${escH(c.dica)}</p>` : ""}</div></li>`).join("")}</ol>
      ${(d.visual || []).length ? `<h5 class="cr-sub">O que a filmagem faz bem</h5>${itens(d.visual)}` : ""}
      ${d.semVisao ? `<p class="cr-nota">A IA de visão não respondeu agora, então as cenas ficaram só com os tempos. Analise de novo daqui a pouco.</p>` : ""}</section>` : "";
    const htmlV = v && (v.resumo || chips.length) ? `<section class="av-bloco"><h4>Voz e entrega</h4>
      ${chips.length ? `<div class="cr-voz-chips">${chips.map((c) => `<span>${escH(c)}</span>`).join("")}</div>` : ""}
      ${v.resumo ? `<p>${escH(v.resumo)}</p>` : ""}${v.ritmo ? `<p><b>Ritmo:</b> ${escH(v.ritmo)}</p>` : ""}${v.entonacao ? `<p><b>Tom:</b> ${escH(v.entonacao)}</p>` : ""}${v.pausas ? `<p><b>Pausas:</b> ${escH(v.pausas)}</p>` : ""}
      ${m && m.somDeFundo ? `<p><b>Fundo:</b> ${escH(m.somDeFundo)}</p>` : ""}${(v.dicas || []).length ? `<h5 class="cr-sub">Para usar a voz igual</h5>${itens(v.dicas)}` : ""}</section>` : (d.vozErro ? `<p class="cr-nota">${escH(d.vozErro)}</p>` : "");
    return htmlC + htmlV;
  }

  window.painelAnaliseVideo = { estudar, ligado, ligar, chaveHtml, ligarChave, cenasEVoz, htmlCenasVoz };
})();
