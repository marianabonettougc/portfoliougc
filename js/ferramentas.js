// =========================================================
// CRIATIVIDADE > FERRAMENTAS (out/2026, inspiradas no dashboard de YouTube da @justinescameraroll_)
// Três partes (abas no topo, AREAS em js/admin.js):
// 1) Organizador de arquivos (#ferarquivos): ela escolhe no Chrome do computador a pasta das gravações brutas
//    (showDirectoryPicker, só no computador). Cada vídeo é ouvido (Whisper pela editor-video) e visto (um quadro)
//    e a função ferramentas acao "take" diz se é gancho, produto em uso, b-roll, CTA ou outro. O painel sugere
//    nomes padronizados (01_marca_job_gancho_take01.mp4), cor por categoria e ordem; nada muda nos arquivos até
//    ela clicar em "Aplicar alterações". Cada lote aplicado fica na tabela arquivos_lotes (com Desfazer enquanto
//    a pasta continuar liberada; a pasta fica guardada no IndexedDB deste navegador).
// 2) Checagem de capa (#fercapa): ela sobe a capa, a função ferramentas acao "capa" dá nota de 0 a 10, lê os
//    textos (com a caixa de cada um) e o rosto; o navegador mede o contraste de verdade em cada texto e cruza as
//    caixas com as áreas da interface do Instagram/TikTok e com o corte do grid. Guardado em capas_checadas
//    (imagem no Storage, bucket anexos, pasta ferramentas/capas).
// 3) Organizador de ideias (#ferideias): ela escreve ou cola um print; a função ferramentas acao "ideia" separa por
//    categoria (pilar), finalidade (Publi, UGC, Conteúdos) e funil. Guardado em ideias_organizadas. Um clique cria
//    o post no Painel de conteúdo (painel_conteudo) e/ou o roteiro em Meus roteiros (painelRoteiros.salvarNoQuadro).
// Tudo editável e com excluir; sem alert/confirm/prompt do navegador (modais próprios).
// =========================================================
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const banco = () => window.banco;
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const slug = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
  const slugEsp = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28);
  const dataBR = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  const pad = (n) => String(n).padStart(2, "0");
  const ic = (d) => `<svg class="traco" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    pasta: ic('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>'),
    brilho: ic('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
    lapis: ic('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
    lixo: ic('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    cima: ic('<path d="M6 15l6-6 6 6"/>'), baixo: ic('<path d="M6 9l6 6 6-6"/>'),
    imagem: ic('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/>'),
    x: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
    voltar: ic('<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>'),
  };

  // ---------- avisos e modais próprios ----------
  let tempoToast = null;
  function toast(texto, erro) {
    const t = document.getElementById("toast"); if (!t) return;
    t.textContent = texto; t.classList.toggle("erro", Boolean(erro)); t.classList.add("visivel");
    clearTimeout(tempoToast); tempoToast = setTimeout(() => t.classList.remove("visivel"), erro ? 5200 : 2800);
  }
  // modal({ titulo, corpo (html), botoes: [{ texto, valor, classe }], aoAbrir(corpo, fechar) }) -> Promise(valor)
  function modal({ titulo, sobre, corpo, botoes, larga, aoAbrir }) {
    return new Promise((fim) => {
      const d = document.createElement("dialog"); d.className = "janela fe-modal" + (larga ? " janela-larga" : "");
      d.innerHTML = `<div class="janela-cabeca"><div>${sobre ? `<small class="janela-sobretitulo">${esc(sobre)}</small>` : ""}<h2>${esc(titulo)}</h2></div><button class="icone-btn" type="button" data-fechar aria-label="Fechar">${IC.x}</button></div>
        <div class="janela-corpo">${corpo || ""}</div>
        <div class="janela-rodape">${(botoes || [{ texto: "Ok", valor: true, classe: "btn-principal" }]).map((b, i) => `<button type="button" class="btn ${b.classe || ""}" data-b="${i}">${esc(b.texto)}</button>`).join("")}</div>`;
      document.body.appendChild(d);
      let valor = null;
      const fechar = (v) => { valor = v; d.close(); };
      d.addEventListener("close", () => { d.remove(); fim(valor); });
      d.addEventListener("cancel", () => { valor = null; });
      $("[data-fechar]", d).addEventListener("click", () => fechar(null));
      $$("[data-b]", d).forEach((b) => b.addEventListener("click", () => { const bt = botoes[Number(b.dataset.b)]; fechar(typeof bt.valor === "function" ? bt.valor($(".janela-corpo", d)) : bt.valor); }));
      d.showModal();
      if (aoAbrir) aoAbrir($(".janela-corpo", d), fechar);
    });
  }
  const confirmar = (titulo, texto, sim = "Sim", perigo) => modal({ titulo, corpo: `<p class="fe-p">${texto}</p>`, botoes: [{ texto: "Cancelar", valor: false }, { texto: sim, valor: true, classe: perigo ? "btn-perigo" : "btn-principal" }] });

  async function chamar(corpo) {
    for (let t = 0; t < 3; t++) {
      const { data, error } = await banco().functions.invoke("ferramentas", { body: corpo });
      let msg = data && data.error;
      if (error) { try { msg = (await error.context.json()).error; } catch (e) { /* segue */ } msg = msg || "A função não respondeu agora."; }
      if (msg && /limite/i.test(msg) && t < 2) { toast("A IA pediu um tempinho (limite grátis). Já tento de novo…"); await espera(20000); continue; }
      if (msg) throw new Error(msg);
      return data;
    }
    throw new Error("A IA está sem limite agora. Tente de novo daqui a pouco.");
  }
  async function transcrever(blob, nome) {
    const form = new FormData(); form.append("acao", "transcrever"); form.append("arquivo", blob, nome || "audio.m4a");
    const { data, error } = await banco().functions.invoke("editor-video", { body: form });
    if (error || (data && data.error)) return "";
    return String((data && data.texto) || "").trim();
  }
  // reduz uma imagem para mandar para a IA (JPEG, lado maior até "max")
  function reduzir(fonte, max, qualidade = 0.85) {
    const w = fonte.videoWidth || fonte.naturalWidth || fonte.width, h = fonte.videoHeight || fonte.naturalHeight || fonte.height;
    const k = Math.min(1, max / Math.max(w, h)), cv = document.createElement("canvas");
    cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.getContext("2d").drawImage(fonte, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", qualidade);
  }
  const lerImagem = (arq) => new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error("Não consegui abrir essa imagem.")); i.src = URL.createObjectURL(arq); });

  // =========================================================
  // 1) ORGANIZADOR DE ARQUIVOS
  // =========================================================
  const CATS = [["gancho", "Gancho", "#a8583f"], ["produto", "Produto em uso", "#6b4a35"], ["broll", "B-roll", "#5d7a58"], ["cta", "CTA", "#c9973b"], ["outro", "Outro / descartar", "#9a8a7c"]];
  const corCat = (k) => (CATS.find((c) => c[0] === k) || CATS[4])[2];
  const nomeCat = (k) => (CATS.find((c) => c[0] === k) || CATS[4])[1];
  const EXT_VIDEO = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
  const arq = { dir: null, pasta: "", itens: [], marca: "", job: "", numerar: true, subpastas: false, analisando: false, aplicando: false, lotes: [], progresso: "" };

  // IndexedDB: guarda a pasta escolhida (para Desfazer depois e para reabrir)
  function idb() { return new Promise((ok, falha) => { const r = indexedDB.open("painel-ferramentas", 1); r.onupgradeneeded = () => r.result.createObjectStore("pastas"); r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error); }); }
  async function guardarPasta(chave, h) { try { const db = await idb(); await new Promise((ok) => { const tx = db.transaction("pastas", "readwrite"); tx.objectStore("pastas").put(h, chave); tx.oncomplete = ok; tx.onerror = ok; }); } catch (e) { /* sem IndexedDB */ } }
  async function lerPasta(chave) { try { const db = await idb(); return await new Promise((ok) => { const r = db.transaction("pastas").objectStore("pastas").get(chave); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); }); } catch (e) { return null; } }
  async function permissao(h) { try { if ((await h.queryPermission({ mode: "readwrite" })) === "granted") return true; return (await h.requestPermission({ mode: "readwrite" })) === "granted"; } catch (e) { return false; } }

  function adivinharMarcaJob(nome) {
    const partes = semAcento(nome).split(/[\s_\-.]+/).filter(Boolean);
    return { marca: slug(partes[0] || ""), job: slug(partes.slice(1).join("")) };
  }
  async function escolherPasta() {
    if (!window.showDirectoryPicker) { modal({ titulo: "Abra no Chrome do computador", corpo: `<p class="fe-p">Para mexer nas pastas do seu computador, use o <b>Google Chrome</b> (ou o Edge) no computador. No celular e em outros navegadores o organizador não consegue abrir pastas.</p>` }); return; }
    let h; try { h = await window.showDirectoryPicker({ id: "brutos", mode: "readwrite", startIn: "videos" }); } catch (e) { return; }
    await abrirPasta(h);
  }
  async function abrirPasta(h) {
    if (!(await permissao(h))) { toast("Preciso de permissão para ler e renomear os arquivos da pasta.", true); return; }
    arq.dir = h; arq.pasta = h.name; arq.itens = [];
    const g = adivinharMarcaJob(h.name); arq.marca = arq.marca || g.marca; arq.job = g.job || arq.job;
    await guardarPasta("ultima", h);
    for await (const [nome, ent] of h.entries()) {
      if (ent.kind !== "file" || !EXT_VIDEO.test(nome) || nome.startsWith(".")) continue;
      const file = await ent.getFile();
      arq.itens.push({ handle: ent, file, nome, ext: (nome.match(/\.[^.]+$/) || [".mp4"])[0].toLowerCase(), modificado: file.lastModified, tamanho: file.size, categoria: "", resumo: "", motivo: "", status: "pendente", incluir: true, novoNome: "", editado: false });
    }
    arq.itens.sort((a, b) => a.modificado - b.modificado);
    if (!arq.itens.length) toast("Não achei vídeos nessa pasta (MP4, MOV, M4V, WEBM).", true);
    nomear(); pintarArquivos();
  }
  // nomes padronizados: [NN_]marca_job_categoria_takeNN.ext, na ordem gancho, produto, b-roll, CTA, outro
  function ordenar() {
    const pos = (k) => { const i = CATS.findIndex((c) => c[0] === k); return i < 0 ? 9 : i; };
    arq.itens.sort((a, b) => (pos(a.categoria) - pos(b.categoria)) || ((a.ordem ?? a.modificado) - (b.ordem ?? b.modificado)));
  }
  function nomear() {
    ordenar();
    const cont = {}; let n = 0;
    for (const it of arq.itens) {
      if (!it.incluir) { it.novoNome = it.nome; continue; }
      n++; const cat = it.categoria || "take"; cont[cat] = (cont[cat] || 0) + 1;
      if (it.editado) continue;
      const base = [arq.marca && slug(arq.marca), arq.job && slug(arq.job), it.categoria || "", `take${pad(cont[cat])}`].filter(Boolean).join("_");
      it.novoNome = (arq.numerar ? pad(n) + "_" : "") + base + it.ext;
    }
  }
  async function quadroEDuracao(it) {
    const url = URL.createObjectURL(it.file), v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    try {
      await new Promise((ok, falha) => { v.onloadedmetadata = ok; v.onerror = () => falha(new Error("não abriu")); setTimeout(ok, 8000); });
      it.dur = v.duration || 0; it.w = v.videoWidth; it.h = v.videoHeight;
      v.currentTime = Math.min(Math.max(0.3, it.dur * 0.45), Math.max(0, it.dur - 0.1));
      await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 5000); });
      it.quadro = reduzir(v, 512, 0.7); it.mini = reduzir(v, 160, 0.6);
    } catch (e) { it.quadro = ""; it.mini = ""; }
    URL.revokeObjectURL(url);
  }
  async function analisar() {
    if (arq.analisando || !arq.itens.length) return;
    arq.analisando = true; pintarArquivos();
    let k = 0;
    for (const it of arq.itens) {
      k++; if (!it.incluir || it.status === "ok") continue;
      it.status = "analisando"; arq.progresso = `Analisando ${k} de ${arq.itens.length}: ${it.nome}`; pintarArquivos();
      try {
        if (!it.quadro) await quadroEDuracao(it);
        let fala = "";
        const ed = window.painelEdicao;
        if (ed && ed.audioDoArquivo) { const partes = await ed.audioDoArquivo(it.file); if (partes && partes.length) fala = await transcrever(partes[0].blob, partes[0].nome); }
        it.fala = fala;
        const r = await chamar({ acao: "take", nome: it.nome, dur: it.dur, fala, quadro: it.quadro, marca: arq.marca, job: arq.job });
        Object.assign(it, { categoria: r.categoria, resumo: r.resumo, motivo: r.motivo, descartar: r.descartar, status: "ok" });
      } catch (e) { it.status = "erro"; it.motivo = e.message; it.categoria = it.categoria || "outro"; }
      nomear(); pintarArquivos();
    }
    arq.analisando = false; arq.progresso = ""; nomear(); pintarArquivos();
    toast("Pronto! Confira a prévia e clique em Aplicar alterações.");
  }
  async function mover(dir, handle, destino, novoNome) {
    if (handle.move) { try { if (destino && destino !== dir) await handle.move(destino, novoNome); else await handle.move(novoNome); return handle; } catch (e) { /* tenta copiando */ } }
    const f = await handle.getFile(), alvo = destino || dir;
    const nh = await alvo.getFileHandle(novoNome, { create: true }), w = await nh.createWritable();
    await f.stream().pipeTo(w);
    await dir.removeEntry(handle.name);
    return nh;
  }
  async function aplicar() {
    const mudar = arq.itens.filter((it) => it.incluir && (it.novoNome !== it.nome || arq.subpastas));
    if (!mudar.length) { toast("Nada para mudar: os nomes já estão iguais."); return; }
    const ok = await confirmar("Aplicar alterações", `Vou renomear <b>${mudar.length}</b> arquivo${mudar.length > 1 ? "s" : ""} na pasta <b>${esc(arq.pasta)}</b>${arq.subpastas ? " e separar em subpastas por categoria" : ""}. Dá para desfazer depois no histórico.`, "Aplicar alterações");
    if (!ok) return;
    if (!(await permissao(arq.dir))) { toast("Sem permissão para mexer na pasta.", true); return; }
    arq.aplicando = true; pintarArquivos();
    const feitos = [];
    try {
      const existentes = new Set(); for await (const [n] of arq.dir.entries()) existentes.add(n);
      // 1º passo: nomes temporários (evita trocar A por B quando B ainda existe)
      for (const [i, it] of mudar.entries()) { const tmp = `__organizando_${i}${it.ext}`; it.handle = await mover(arq.dir, it.handle, null, tmp); it.tmp = tmp; existentes.delete(it.nome); }
      for (const it of mudar) {
        let destino = null, pastaRel = "";
        if (arq.subpastas) { pastaRel = `${pad(CATS.findIndex((c) => c[0] === (it.categoria || "outro")) + 1)}_${slugEsp(nomeCat(it.categoria || "outro"))}`; destino = await arq.dir.getDirectoryHandle(pastaRel, { create: true }); }
        let final = it.novoNome; const base = final.replace(/\.[^.]+$/, ""); let n = 2;
        while (!destino && existentes.has(final)) final = `${base}_${n++}${it.ext}`;
        arq.progresso = `Renomeando ${feitos.length + 1} de ${mudar.length}…`; pintarArquivos();
        it.handle = await mover(arq.dir, it.handle, destino, final);
        existentes.add(final);
        feitos.push({ de: it.nome, para: final, pasta: pastaRel, categoria: it.categoria || "", resumo: it.resumo || "" });
        it.nome = final; it.novoNome = final; it.editado = false;
      }
      const { data, error } = await banco().from("arquivos_lotes").insert({ pasta: arq.pasta, itens: feitos }).select().maybeSingle();
      if (error) throw new Error("Os arquivos foram renomeados, mas não consegui salvar o histórico: " + error.message);
      if (data) { await guardarPasta("lote-" + data.id, arq.dir); arq.lotes.unshift(data); }
      toast(`Pronto! ${feitos.length} arquivo${feitos.length > 1 ? "s" : ""} organizado${feitos.length > 1 ? "s" : ""}.`);
    } catch (e) {
      modal({ titulo: "Não terminei de organizar", corpo: `<p class="fe-p">${esc(e.message)}</p><p class="fe-p">${feitos.length} arquivo(s) já foram renomeados. Os que ficaram com nome começando em "__organizando_" posso arrumar se você abrir a pasta de novo.</p>` });
    }
    arq.aplicando = false; arq.progresso = ""; pintarArquivos();
  }
  async function desfazerLote(l) {
    const h = await lerPasta("lote-" + l.id);
    if (!h) { modal({ titulo: "Não dá para desfazer daqui", corpo: `<p class="fe-p">Esse lote foi feito em outro navegador ou a pasta não está mais guardada. Os nomes antigos estão na lista do histórico se você quiser voltar à mão.</p>` }); return; }
    if (!(await confirmar("Desfazer este lote", `Volto os ${(l.itens || []).length} arquivos da pasta <b>${esc(l.pasta)}</b> para os nomes de antes.`, "Desfazer"))) return;
    if (!(await permissao(h))) { toast("Sem permissão para mexer na pasta.", true); return; }
    let ok = 0, falhas = 0;
    for (const it of l.itens || []) {
      try {
        const origem = it.pasta ? await h.getDirectoryHandle(it.pasta) : h;
        const fh = await origem.getFileHandle(it.para);
        await mover(origem, fh, it.pasta ? h : null, it.de); ok++;
      } catch (e) { falhas++; }
    }
    await banco().from("arquivos_lotes").update({ desfeito: true }).eq("id", l.id); l.desfeito = true;
    toast(`Voltei ${ok} arquivo${ok === 1 ? "" : "s"}${falhas ? `, ${falhas} não achei (podem ter mudado de lugar)` : ""}.`, Boolean(falhas));
    if (arq.dir && arq.dir.name === l.pasta) await abrirPasta(arq.dir); else pintarArquivos();
  }
  async function carregarLotes() {
    const { data, error } = await banco().from("arquivos_lotes").select("*").order("aplicado_em", { ascending: false }).limit(30);
    arq.lotes = error ? [] : (data || []);
  }

  function pintarArquivos() {
    const sec = document.getElementById("aba-ferarquivos"); if (!sec) return;
    const temApi = Boolean(window.showDirectoryPicker);
    const grupos = CATS.map(([k, t, c]) => ({ k, t, c, itens: arq.itens.filter((it) => it.categoria === k) }));
    const semCat = arq.itens.filter((it) => !it.categoria);
    const linha = (it) => {
      const i = arq.itens.indexOf(it), mudou = it.incluir && it.novoNome !== it.nome;
      return `<div class="fe-arq${it.incluir ? "" : " fora"}" style="--cor:${corCat(it.categoria)}">
        <label class="fe-chk" title="Incluir"><input type="checkbox" data-incluir="${i}" ${it.incluir ? "checked" : ""}></label>
        <div class="fe-mini">${it.mini ? `<img src="${it.mini}" alt="">` : IC.imagem}</div>
        <div class="fe-arq-info">
          <small class="fe-de">${esc(it.nome)}${it.dur ? ` · ${it.dur.toFixed(1).replace(".", ",")} s` : ""}${it.status === "analisando" ? " · analisando…" : it.status === "erro" ? " · não deu para analisar" : ""}</small>
          <input class="entrada fe-novo${mudou ? " muda" : ""}" data-nome="${i}" value="${esc(it.novoNome)}" aria-label="Novo nome de ${esc(it.nome)}">
          ${it.motivo || it.fala ? `<small class="fe-motivo">${it.descartar ? "⚠ parece take para descartar · " : ""}${esc(it.motivo || "")}${it.fala ? ` · “${esc(it.fala.slice(0, 90))}${it.fala.length > 90 ? "…" : ""}”` : ""}</small>` : ""}
        </div>
        <select class="entrada fe-cat" data-cat="${i}" aria-label="Categoria">${CATS.map(([k, t]) => `<option value="${k}" ${it.categoria === k ? "selected" : ""}>${t}</option>`).join("")}${!it.categoria ? `<option value="" selected>Sem categoria</option>` : ""}</select>
        <span class="fe-ordem"><button type="button" class="icone-btn" data-subir="${i}" aria-label="Subir">${IC.cima}</button><button type="button" class="icone-btn" data-descer="${i}" aria-label="Descer">${IC.baixo}</button></span>
      </div>`;
    };
    const mudancas = arq.itens.filter((it) => it.incluir && it.novoNome !== it.nome).length;
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga fe">
      <div class="fe-cab"><div><h2 class="fe-titulo">Organizador de <em>arquivos</em></h2><p class="fe-sub">Escolha a pasta das gravações brutas. Eu ouço e olho cada vídeo, sugiro nomes padronizados, separo por cor e ordeno. Nada muda nos arquivos até você clicar em <b>Aplicar alterações</b>.</p></div>
        <button class="btn btn-principal" type="button" data-escolher ${temApi ? "" : "disabled"}>${IC.pasta}${arq.dir ? "Trocar pasta" : "Escolher pasta"}</button></div>
      ${!temApi ? `<p class="fe-aviso">Abra este painel no <b>Chrome do computador</b> para usar o organizador. No celular os navegadores não deixam mexer em pastas. As outras ferramentas funcionam no celular.</p>` : ""}
      ${arq.dir ? `<section class="fe-cartao">
        <div class="fe-linha-campos">
          <span class="fe-pasta">${IC.pasta}<b>${esc(arq.pasta)}</b> · ${arq.itens.length} vídeo${arq.itens.length === 1 ? "" : "s"}</span>
          <label class="fe-campo">Marca<input class="entrada" data-marca value="${esc(arq.marca)}" placeholder="ex.: ortobom"></label>
          <label class="fe-campo">Job<input class="entrada" data-job value="${esc(arq.job)}" placeholder="ex.: job3"></label>
          <label class="fe-liga"><input type="checkbox" data-numerar ${arq.numerar ? "checked" : ""}> Numerar na ordem (01_, 02_…)</label>
          <label class="fe-liga"><input type="checkbox" data-subpastas ${arq.subpastas ? "checked" : ""}> Separar em subpastas por categoria</label>
        </div>
        <div class="fe-acoes">
          <button class="btn btn-principal" type="button" data-analisar ${arq.analisando || !arq.itens.length ? "disabled" : ""}>${IC.brilho}${arq.analisando ? "Analisando…" : arq.itens.some((it) => it.status === "ok") ? "Analisar os que faltam" : "Analisar takes com IA"}</button>
          <button class="btn" type="button" data-renomear-tudo ${arq.itens.length ? "" : "disabled"}>Refazer os nomes sugeridos</button>
          <span class="fe-progresso">${esc(arq.progresso)}</span>
        </div>
        <div class="fe-legenda">${CATS.map(([k, t, c]) => `<span><i style="background:${c}"></i>${t} <b>${arq.itens.filter((it) => it.categoria === k).length}</b></span>`).join("")}</div>
        ${semCat.length ? `<h3 class="fe-h3">Ainda sem categoria</h3>${semCat.map(linha).join("")}` : ""}
        ${grupos.filter((g) => g.itens.length).map((g) => `<h3 class="fe-h3"><i style="background:${g.c}"></i>${g.t} <small>${g.itens.length}</small></h3>${g.itens.map(linha).join("")}`).join("")}
        <div class="fe-aplicar"><span>${mudancas} arquivo${mudancas === 1 ? "" : "s"} com nome novo${arq.subpastas ? " · com subpastas" : ""}</span><button class="btn btn-principal" type="button" data-aplicar ${arq.aplicando || arq.analisando || !arq.itens.length ? "disabled" : ""}>${arq.aplicando ? "Aplicando…" : "Aplicar alterações"}</button></div>
      </section>` : ""}
      <section class="fe-cartao"><h3 class="fe-h3">Histórico</h3>
        ${arq.lotes.length ? arq.lotes.map((l) => `<details class="fe-lote${l.desfeito ? " desfeito" : ""}"><summary><b>${esc(l.pasta)}</b> · ${(l.itens || []).length} arquivos · ${dataBR(l.aplicado_em)}${l.desfeito ? " · desfeito" : ""}${l.notas ? ` · ${esc(l.notas)}` : ""}</summary>
          <ul class="fe-lote-lista">${(l.itens || []).map((x) => `<li><span>${esc(x.de)}</span> → <b>${esc((x.pasta ? x.pasta + "/" : "") + x.para)}</b></li>`).join("")}</ul>
          <div class="fe-acoes">${l.desfeito ? "" : `<button class="btn" type="button" data-desfazer-lote="${l.id}">${IC.voltar}Desfazer</button>`}<button class="btn" type="button" data-nota-lote="${l.id}">${IC.lapis}Anotação</button><button class="btn btn-perigo" type="button" data-apagar-lote="${l.id}">${IC.lixo}Excluir do histórico</button></div></details>`).join("") : `<p class="fe-vazio">Quando você aplicar, o que mudou fica guardado aqui.</p>`}
      </section></div>`;
    const re = () => { nomear(); pintarArquivos(); };
    $("[data-escolher]", sec)?.addEventListener("click", escolherPasta);
    $("[data-analisar]", sec)?.addEventListener("click", analisar);
    $("[data-aplicar]", sec)?.addEventListener("click", aplicar);
    $("[data-renomear-tudo]", sec)?.addEventListener("click", () => { arq.itens.forEach((it) => { it.editado = false; }); re(); });
    $("[data-marca]", sec)?.addEventListener("change", (e) => { arq.marca = e.target.value; re(); });
    $("[data-job]", sec)?.addEventListener("change", (e) => { arq.job = e.target.value; re(); });
    $("[data-numerar]", sec)?.addEventListener("change", (e) => { arq.numerar = e.target.checked; re(); });
    $("[data-subpastas]", sec)?.addEventListener("change", (e) => { arq.subpastas = e.target.checked; pintarArquivos(); });
    $$("[data-incluir]", sec).forEach((c) => c.addEventListener("change", () => { arq.itens[Number(c.dataset.incluir)].incluir = c.checked; re(); }));
    $$("[data-cat]", sec).forEach((s) => s.addEventListener("change", () => { const it = arq.itens[Number(s.dataset.cat)]; it.categoria = s.value; it.editado = false; re(); }));
    $$("[data-nome]", sec).forEach((inp) => inp.addEventListener("change", () => {
      const it = arq.itens[Number(inp.dataset.nome)]; let v = inp.value.trim().replace(/[\\/:*?"<>|]/g, "");
      if (!v) { it.editado = false; re(); return; }
      if (!/\.[a-z0-9]{2,4}$/i.test(v)) v += it.ext;
      it.novoNome = v; it.editado = true; pintarArquivos();
    }));
    const trocar = (i, j) => { const a = arq.itens[i], b = arq.itens[j]; if (!a || !b || (a.categoria || "") !== (b.categoria || "")) return; const oa = a.ordem ?? a.modificado, ob = b.ordem ?? b.modificado; a.ordem = ob; b.ordem = oa === ob ? ob - 1 : oa; a.editado = b.editado = false; re(); };
    $$("[data-subir]", sec).forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.subir); trocar(i, i - 1); }));
    $$("[data-descer]", sec).forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.descer); trocar(i, i + 1); }));
    $$("[data-desfazer-lote]", sec).forEach((b) => b.addEventListener("click", () => desfazerLote(arq.lotes.find((l) => String(l.id) === b.dataset.desfazerLote))));
    $$("[data-apagar-lote]", sec).forEach((b) => b.addEventListener("click", async () => {
      const l = arq.lotes.find((x) => String(x.id) === b.dataset.apagarLote);
      if (!(await confirmar("Excluir do histórico", "Tiro este lote do histórico. Os arquivos continuam como estão.", "Excluir", true))) return;
      const { error } = await banco().from("arquivos_lotes").delete().eq("id", l.id);
      if (error) { toast(error.message, true); return; }
      arq.lotes = arq.lotes.filter((x) => x !== l); pintarArquivos();
    }));
    $$("[data-nota-lote]", sec).forEach((b) => b.addEventListener("click", async () => {
      const l = arq.lotes.find((x) => String(x.id) === b.dataset.notaLote);
      const v = await modal({ titulo: "Anotação do lote", corpo: `<label class="fe-campo larga">Anotação<input class="entrada" id="fe-nota" value="${esc(l.notas || "")}" placeholder="ex.: brutos do vídeo 3"></label>`, botoes: [{ texto: "Cancelar", valor: null }, { texto: "Salvar", classe: "btn-principal", valor: (c) => $("#fe-nota", c).value.trim() }] });
      if (v === null) return;
      const { error } = await banco().from("arquivos_lotes").update({ notas: v || null }).eq("id", l.id);
      if (error) { toast(error.message, true); return; }
      l.notas = v; pintarArquivos();
    }));
  }

  // =========================================================
  // 2) CHECAGEM DE CAPA
  // =========================================================
  // áreas que a interface cobre (frações do vídeo 9:16) e corte da grade do perfil
  const ZONAS = {
    instagram: { nome: "Instagram", areas: [{ nome: "botões (curtir, comentar, enviar)", caixa: [0.84, 0.5, 0.16, 0.42] }, { nome: "nome e legenda do post", caixa: [0, 0.8, 0.8, 0.2] }, { nome: "topo do app", caixa: [0, 0, 1, 0.07] }], grid: { nome: "grade do perfil 4:5", visivel: [0.148, 0.852] } },
    tiktok: { nome: "TikTok", areas: [{ nome: "botões (curtir, comentar, salvar)", caixa: [0.83, 0.38, 0.17, 0.5] }, { nome: "nome e legenda do post", caixa: [0, 0.78, 0.78, 0.22] }, { nome: "topo do app (Seguindo, Para você)", caixa: [0, 0, 1, 0.09] }], grid: { nome: "grade do perfil 3:4", visivel: [0.125, 0.875] } },
  };
  const cap = { arquivo: null, img: null, plataforma: "instagram", nome: "", resultado: null, checando: false, lista: [], atual: null, mostrarZonas: true, urls: {} };
  const inter = (a, b) => { const x = Math.max(a[0], b[0]), y = Math.max(a[1], b[1]), x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3]); return Math.max(0, x2 - x) * Math.max(0, y2 - y); };
  // contraste medido de verdade dentro da caixa do texto (luminância: os 8% mais claros contra os 8% mais escuros)
  function contrasteMedido(img, cx) {
    try {
      const W = 360, H = Math.round(W * img.naturalHeight / img.naturalWidth), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
      const x = Math.floor(cx[0] * W), y = Math.floor(cx[1] * H), w = Math.max(2, Math.floor(cx[2] * W)), h = Math.max(2, Math.floor(cx[3] * H));
      const d = g.getImageData(x, y, Math.min(w, W - x), Math.min(h, H - y)).data, L = [];
      const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      for (let i = 0; i < d.length; i += 4) L.push(0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
      L.sort((a, b) => a - b); const lo = L[Math.floor(L.length * 0.08)], hi = L[Math.floor(L.length * 0.92)];
      return +((hi + 0.05) / (lo + 0.05)).toFixed(1);
    } catch (e) { return null; }
  }
  function avaliarLocal(res, img, plataforma) {
    const z = ZONAS[plataforma] || ZONAS.instagram, problemas = [], razao = img.naturalWidth / img.naturalHeight;
    if (Math.abs(razao - 9 / 16) > 0.03) problemas.push({ grave: false, texto: `A imagem não está em 9:16 (está ${img.naturalWidth}x${img.naturalHeight}). O ${z.nome} vai cortar as bordas.` });
    for (const t of res.textos || []) {
      if (!t.caixa) continue;
      t.contrasteMedido = contrasteMedido(img, t.caixa);
      for (const a of z.areas) { const o = inter(t.caixa, a.caixa) / (t.caixa[2] * t.caixa[3]); if (o > 0.12) problemas.push({ grave: true, texto: `O texto “${t.texto}” fica embaixo de ${a.nome} (${Math.round(o * 100)}% dele).` }); }
      const [v0, v1] = z.grid.visivel, fora = Math.max(0, v0 - t.caixa[1]) + Math.max(0, t.caixa[1] + t.caixa[3] - v1);
      if (fora / t.caixa[3] > 0.1) problemas.push({ grave: true, texto: `Na ${z.grid.nome} o texto “${t.texto}” é cortado.` });
      if (t.caixa[3] < 0.035 || t.tamanho === "pequeno") problemas.push({ grave: false, texto: `O texto “${t.texto}” está pequeno para ler na miniatura.` });
      if ((t.contrasteMedido != null && t.contrasteMedido < 3) || t.contraste === "baixo") problemas.push({ grave: true, texto: `Pouco contraste no texto “${t.texto}”${t.contrasteMedido != null ? ` (medi ${String(t.contrasteMedido).replace(".", ",")}:1; o ideal é 4,5:1 ou mais)` : ""}.` });
    }
    if (res.rosto) {
      for (const a of z.areas) { const o = inter(res.rosto, a.caixa) / (res.rosto[2] * res.rosto[3]); if (o > 0.15) problemas.push({ grave: false, texto: `Seu rosto fica parte embaixo de ${a.nome}.` }); }
      const [v0, v1] = z.grid.visivel; if (res.rosto[1] < v0 || res.rosto[1] + res.rosto[3] > v1) problemas.push({ grave: true, texto: `Na ${z.grid.nome} o seu rosto é cortado.` });
    }
    if (!(res.textos || []).length) problemas.push({ grave: false, texto: "Não achei texto na capa. Capa com título curto costuma ser mais clicada." });
    const desconto = problemas.reduce((s, p) => s + (p.grave ? 1 : 0.4), 0);
    return { problemas, notaFinal: Math.max(0, Math.round((res.nota - Math.min(desconto, 4)) * 10) / 10) };
  }
  function desenharCapa(cv, img, res, plataforma) {
    const W = cv.width = img.naturalWidth > 1080 ? 1080 : img.naturalWidth, H = cv.height = Math.round(W * img.naturalHeight / img.naturalWidth), g = cv.getContext("2d");
    g.drawImage(img, 0, 0, W, H);
    if (!cap.mostrarZonas) return;
    const z = ZONAS[plataforma] || ZONAS.instagram, R = (b) => [b[0] * W, b[1] * H, b[2] * W, b[3] * H];
    g.save(); g.setLineDash([12, 8]); g.lineWidth = 3;
    for (const a of z.areas) { g.fillStyle = "rgba(29,22,17,.35)"; g.strokeStyle = "rgba(255,255,255,.85)"; g.fillRect(...R(a.caixa)); g.strokeRect(...R(a.caixa)); }
    const [v0, v1] = z.grid.visivel; g.fillStyle = "rgba(168,88,63,.28)"; g.fillRect(0, 0, W, v0 * H); g.fillRect(0, v1 * H, W, H - v1 * H);
    g.strokeStyle = "#e8c27a"; g.beginPath(); g.moveTo(0, v0 * H); g.lineTo(W, v0 * H); g.moveTo(0, v1 * H); g.lineTo(W, v1 * H); g.stroke();
    g.setLineDash([]);
    if (res) {
      for (const t of res.textos || []) if (t.caixa) { const ruim = (t.contrasteMedido != null && t.contrasteMedido < 3) || t.contraste === "baixo" || t.tamanho === "pequeno"; g.strokeStyle = ruim ? "#ff6b5a" : "#7ee08a"; g.lineWidth = 5; g.strokeRect(...R(t.caixa)); }
      if (res.rosto) { g.strokeStyle = "#7cc0ee"; g.lineWidth = 5; g.strokeRect(...R(res.rosto)); }
    }
    g.restore();
  }
  async function urlDe(caminho) {
    if (!caminho) return "";
    if (cap.urls[caminho]) return cap.urls[caminho];
    const { data } = await banco().storage.from("anexos").createSignedUrl(caminho, 3600);
    return (cap.urls[caminho] = (data && data.signedUrl) || "");
  }
  async function checarCapa() {
    if (!cap.img || cap.checando) return;
    cap.checando = true; pintarCapa();
    try {
      const imagem = reduzir(cap.img, 1080, 0.85);
      const r = await chamar({ acao: "capa", imagem, plataforma: cap.plataforma, w: cap.img.naturalWidth, h: cap.img.naturalHeight });
      const loc = avaliarLocal(r, cap.img, cap.plataforma);
      const analise = { ...r, problemas: loc.problemas, notaFinal: loc.notaFinal };
      // guarda a imagem e o resultado
      const blob = await (await fetch(imagem)).blob(), caminho = `ferramentas/capas/${Date.now()}-${slugEsp(cap.nome || "capa")}.jpg`;
      const up = await banco().storage.from("anexos").upload(caminho, blob, { contentType: "image/jpeg" });
      if (up.error) throw new Error("Não consegui guardar a imagem: " + up.error.message);
      const { data, error } = await banco().from("capas_checadas").insert({ nome: cap.nome || (cap.arquivo && cap.arquivo.name) || "Capa", imagem: caminho, plataforma: cap.plataforma, nota: loc.notaFinal, analise }).select().maybeSingle();
      if (error) throw new Error("Não consegui salvar a checagem: " + error.message);
      cap.lista.unshift(data); cap.atual = data; cap.urls[caminho] = URL.createObjectURL(blob);
      toast("Capa checada e salva.");
    } catch (e) { toast(e.message, true); }
    cap.checando = false; pintarCapa();
  }
  async function carregarCapas() {
    const { data, error } = await banco().from("capas_checadas").select("*").order("criado_em", { ascending: false }).limit(40);
    cap.lista = error ? [] : (data || []);
  }
  async function pintarCapa() {
    const sec = document.getElementById("aba-fercapa"); if (!sec) return;
    const a = cap.atual, an = a && a.analise;
    const corNota = (n) => (n >= 8 ? "boa" : n >= 5.5 ? "media" : "ruim");
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga fe">
      <div class="fe-cab"><div><h2 class="fe-titulo">Checagem de <em>capa</em></h2><p class="fe-sub">Suba a capa do Reels ou do TikTok. Eu dou uma nota de 0 a 10, vejo se o texto lê bem (tamanho e contraste) e se o texto ou o rosto ficam embaixo dos botões, da legenda ou do corte da grade do perfil.</p></div></div>
      <section class="fe-cartao fe-capa-topo">
        <div class="fe-capa-envio">
          <label class="fe-soltar">${IC.imagem}<b>${cap.img ? "Trocar a capa" : "Enviar a capa"}</b><small>JPG ou PNG, de preferência 1080x1920</small><input type="file" accept="image/*" hidden data-capa-arq></label>
          <div class="fe-chips" role="group" aria-label="Rede">${["instagram", "tiktok"].map((p) => `<button type="button" class="fe-chip${cap.plataforma === p ? " on" : ""}" data-plat="${p}">${ZONAS[p].nome}</button>`).join("")}</div>
          <label class="fe-campo larga">Nome (opcional)<input class="entrada" data-capa-nome value="${esc(cap.nome)}" placeholder="ex.: capa Ortobom vídeo 3"></label>
          <label class="fe-liga"><input type="checkbox" data-zonas ${cap.mostrarZonas ? "checked" : ""}> Mostrar áreas da interface e o corte da grade</label>
          <button class="btn btn-principal" type="button" data-checar ${cap.img && !cap.checando ? "" : "disabled"}>${IC.brilho}${cap.checando ? "Checando…" : "Checar capa"}</button>
        </div>
        <div class="fe-capa-prev">${cap.img || a ? `<canvas id="fe-capa-cv" aria-label="Prévia da capa"></canvas>` : `<p class="fe-vazio">A prévia aparece aqui.</p>`}</div>
      </section>
      ${an ? `<section class="fe-cartao fe-resultado">
        <div class="fe-nota ${corNota(a.nota)}"><b>${String(a.nota).replace(".", ",")}</b><small>de 10${an.nota !== a.nota ? ` · a IA deu ${String(an.nota).replace(".", ",")} e eu descontei os problemas de posição e contraste` : ""}</small></div>
        <div class="fe-res-corpo"><p class="fe-p"><b>${esc(a.nome)}</b> · ${esc((ZONAS[a.plataforma] || ZONAS.instagram).nome)} · ${dataBR(a.criado_em)}</p>
          ${an.resumo ? `<p class="fe-p">${esc(an.resumo)}</p>` : ""}
          ${(an.problemas || []).length ? `<h3 class="fe-h3">O que atrapalha</h3><ul class="fe-lista">${an.problemas.map((p) => `<li class="${p.grave ? "grave" : ""}">${esc(p.texto)}</li>`).join("")}</ul>` : `<p class="fe-ok">✓ Nada fica embaixo da interface nem é cortado na grade.</p>`}
          ${(an.sugestoes || []).length ? `<h3 class="fe-h3">O que mudar</h3><ul class="fe-lista sug">${an.sugestoes.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
          ${(an.pontos_fortes || []).length ? `<h3 class="fe-h3">O que já está bom</h3><ul class="fe-lista bom">${an.pontos_fortes.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
          ${(an.textos || []).length ? `<p class="fe-mini-p">Textos que li: ${an.textos.map((t) => `“${esc(t.texto)}”${t.contrasteMedido ? ` (contraste ${String(t.contrasteMedido).replace(".", ",")}:1)` : ""}`).join(", ")}</p>` : ""}
          ${a.notas ? `<p class="fe-mini-p">Anotação: ${esc(a.notas)}</p>` : ""}
          <div class="fe-acoes"><button class="btn" type="button" data-editar-capa="${a.id}">${IC.lapis}Editar nome e anotação</button><button class="btn btn-perigo" type="button" data-apagar-capa="${a.id}">${IC.lixo}Excluir</button></div></div>
      </section>` : ""}
      <section class="fe-cartao"><h3 class="fe-h3">Capas checadas</h3>
        ${cap.lista.length ? `<div class="fe-capas">${cap.lista.map((c) => `<button type="button" class="fe-capa-it${cap.atual && cap.atual.id === c.id ? " on" : ""}" data-abrir-capa="${c.id}"><img data-img="${esc(c.imagem)}" alt=""><span class="fe-capa-nota ${corNota(c.nota)}">${String(c.nota).replace(".", ",")}</span><small>${esc(c.nome || "Capa")}</small></button>`).join("")}</div>` : `<p class="fe-vazio">As capas que você checar ficam guardadas aqui.</p>`}
      </section></div>`;
    $("[data-capa-arq]", sec).addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      try { cap.img = await lerImagem(f); cap.arquivo = f; cap.nome = cap.nome || f.name.replace(/\.[^.]+$/, ""); cap.atual = null; pintarCapa(); } catch (er) { toast(er.message, true); }
    });
    $$("[data-plat]", sec).forEach((b) => b.addEventListener("click", () => { cap.plataforma = b.dataset.plat; pintarCapa(); }));
    $("[data-capa-nome]", sec).addEventListener("change", (e) => { cap.nome = e.target.value.trim(); });
    $("[data-zonas]", sec).addEventListener("change", (e) => { cap.mostrarZonas = e.target.checked; pintarCapa(); });
    $("[data-checar]", sec).addEventListener("click", checarCapa);
    $$("[data-abrir-capa]", sec).forEach((b) => b.addEventListener("click", async () => {
      const c = cap.lista.find((x) => String(x.id) === b.dataset.abrirCapa); cap.atual = c; cap.plataforma = c.plataforma || "instagram";
      try { cap.img = await lerImagemUrl(await urlDe(c.imagem)); } catch (e) { cap.img = null; }
      cap.arquivo = null; pintarCapa();
    }));
    $$("[data-apagar-capa]", sec).forEach((b) => b.addEventListener("click", async () => {
      const c = cap.lista.find((x) => String(x.id) === b.dataset.apagarCapa);
      if (!(await confirmar("Excluir checagem", `Apago a checagem de <b>${esc(c.nome || "capa")}</b> e a imagem guardada.`, "Excluir", true))) return;
      const { error } = await banco().from("capas_checadas").delete().eq("id", c.id);
      if (error) { toast(error.message, true); return; }
      if (c.imagem) await banco().storage.from("anexos").remove([c.imagem]);
      cap.lista = cap.lista.filter((x) => x !== c); if (cap.atual === c) { cap.atual = null; cap.img = null; } pintarCapa();
    }));
    $$("[data-editar-capa]", sec).forEach((b) => b.addEventListener("click", async () => {
      const c = cap.lista.find((x) => String(x.id) === b.dataset.editarCapa);
      const v = await modal({ titulo: "Editar checagem", corpo: `<label class="fe-campo larga">Nome<input class="entrada" id="fe-cn" value="${esc(c.nome || "")}"></label><label class="fe-campo larga">Anotação<textarea class="entrada" id="fe-cno" rows="3">${esc(c.notas || "")}</textarea></label>`, botoes: [{ texto: "Cancelar", valor: null }, { texto: "Salvar", classe: "btn-principal", valor: (k) => ({ nome: $("#fe-cn", k).value.trim() || "Capa", notas: $("#fe-cno", k).value.trim() || null }) }] });
      if (!v) return;
      const { error } = await banco().from("capas_checadas").update(v).eq("id", c.id);
      if (error) { toast(error.message, true); return; }
      Object.assign(c, v); pintarCapa();
    }));
    for (const im of $$("img[data-img]", sec)) urlDe(im.dataset.img).then((u) => { if (u) im.src = u; });
    const cv = $("#fe-capa-cv", sec);
    if (cv && cap.img) desenharCapa(cv, cap.img, an || null, cap.plataforma);
  }
  const lerImagemUrl = (u) => new Promise((ok, falha) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => falha(new Error("Não abriu a imagem.")); i.src = u; });

  // =========================================================
  // 3) ORGANIZADOR DE IDEIAS
  // =========================================================
  const FINS = ["Publi", "UGC", "Conteúdos"], FUNIS = ["Topo", "Meio", "Fundo"], FORMATOS = ["Reels", "Carrossel", "Stories"];
  const CORES_FIM = { Publi: "#a8583f", UGC: "#6b4a35", "Conteúdos": "#5d7a58" };
  const ide = { texto: "", imagem: "", sugestao: null, lendo: false, lista: [], pilares: [], filtro: { fim: "", funil: "", cat: "" } };
  async function carregarIdeias() {
    const [a, b] = await Promise.all([
      banco().from("ideias_organizadas").select("*").order("criado_em", { ascending: false }).limit(200),
      banco().from("configuracoes").select("valor").eq("chave", "perfil_conteudo").maybeSingle(),
    ]);
    ide.lista = a.error ? [] : (a.data || []);
    try { ide.pilares = (JSON.parse((b.data && b.data.valor) || "{}").pilares || []).map((p) => p.nome).filter(Boolean); } catch (e) { ide.pilares = []; }
    if (!ide.pilares.length) ide.pilares = ["Maternidade e autocuidado", "Beleza e cabelo", "Moda", "Bem-estar", "Achadinhos de casa e tech"];
  }
  const camposIdeia = (v) => `<div class="fe-grade2">
      <label class="fe-campo larga">Título<input class="entrada" data-f="titulo" value="${esc(v.titulo || "")}"></label>
      <label class="fe-campo larga">Resumo<textarea class="entrada" data-f="resumo" rows="2">${esc(v.resumo || "")}</textarea></label>
      <label class="fe-campo">Categoria<select class="entrada" data-f="categoria">${[...new Set([...ide.pilares, v.categoria].filter(Boolean))].map((p) => `<option ${p === v.categoria ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></label>
      <label class="fe-campo">Finalidade<select class="entrada" data-f="finalidade">${FINS.map((p) => `<option ${p === v.finalidade ? "selected" : ""}>${p}</option>`).join("")}</select></label>
      <label class="fe-campo">Funil<select class="entrada" data-f="funil">${FUNIS.map((p) => `<option ${p === v.funil ? "selected" : ""}>${p}</option>`).join("")}</select></label>
      <label class="fe-campo">Formato<select class="entrada" data-f="formato">${FORMATOS.map((p) => `<option ${p === v.formato ? "selected" : ""}>${p}</option>`).join("")}</select></label>
      <label class="fe-campo">Marca<input class="entrada" data-f="marca" value="${esc(v.marca || "")}"></label>
      <label class="fe-campo larga">Gancho<input class="entrada" data-f="gancho" value="${esc(v.gancho || "")}"></label>
      <label class="fe-campo larga">Roteiro<textarea class="entrada" data-f="roteiro" rows="5">${esc(v.roteiro || "")}</textarea></label>
    </div>`;
  const lerCampos = (raiz) => Object.fromEntries($$("[data-f]", raiz).map((el) => [el.dataset.f, el.value.trim()]));
  async function organizarIdeia() {
    if (ide.lendo) return;
    if (!ide.texto.trim() && !ide.imagem) { toast("Escreva a ideia ou cole um print.", true); return; }
    ide.lendo = true; pintarIdeias();
    try { ide.sugestao = await chamar({ acao: "ideia", texto: ide.texto, imagem: ide.imagem, pilares: ide.pilares }); }
    catch (e) { toast(e.message, true); }
    ide.lendo = false; pintarIdeias();
  }
  async function salvarIdeia(v) {
    let imagem = null;
    if (ide.imagem) {
      const blob = await (await fetch(ide.imagem)).blob(), caminho = `ferramentas/ideias/${Date.now()}.jpg`;
      const up = await banco().storage.from("anexos").upload(caminho, blob, { contentType: "image/jpeg" });
      if (!up.error) imagem = caminho;
    }
    const { data, error } = await banco().from("ideias_organizadas").insert({ ...v, texto: ide.texto || null, imagem }).select().maybeSingle();
    if (error) { toast("Não salvou: " + error.message, true); return null; }
    ide.lista.unshift(data); ide.texto = ""; ide.imagem = ""; ide.sugestao = null;
    toast("Ideia salva.");
    return data;
  }
  async function criarPost(it) {
    const hoje = new Date(), iso = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;
    const r = await modal({ titulo: "Criar post no Painel de conteúdo", sobre: it.titulo, corpo: `<p class="fe-p">O post entra no calendário no dia escolhido. Sem dia, ele vai para o Banco de ideias do mês.</p><label class="fe-campo larga">Dia (opcional)<input class="entrada" type="date" id="fe-dia" min="${iso}"></label><label class="fe-campo larga">Horário<input class="entrada" id="fe-hora" value="12h"></label>`, botoes: [{ texto: "Cancelar", valor: null }, { texto: "Criar post", classe: "btn-principal", valor: (k) => ({ data: $("#fe-dia", k).value || null, horario: $("#fe-hora", k).value.trim() || "12h" }) }] });
    if (!r) return;
    const mes = (r.data || iso).slice(0, 7);
    const blocos = String(it.roteiro || "");
    const { data, error } = await banco().from("painel_conteudo").insert({ mes, data: r.data, horario: r.horario, formato: it.formato || "Reels", tema: it.titulo, funil: it.funil || "Topo", pilar: it.categoria || null, proposito: it.resumo || null, hook: it.gancho || null, desenvolvimento: blocos || null, status: "Ideia", notas: `Do Organizador de ideias (${it.finalidade || ""}${it.marca ? ", " + it.marca : ""})` }).select().maybeSingle();
    if (error) { toast("Não criei o post: " + error.message, true); return; }
    await banco().from("ideias_organizadas").update({ post_id: data.id, atualizado_em: new Date().toISOString() }).eq("id", it.id); it.post_id = data.id;
    toast(r.data ? "Post criado no Painel de conteúdo." : "Post criado no Banco de ideias do Painel de conteúdo."); pintarIdeias();
  }
  async function criarRoteiro(it) {
    if (!window.painelRoteiros || !window.painelRoteiros.salvarNoQuadro) { toast("Abra Meus roteiros uma vez e tente de novo.", true); return; }
    const id = "ide" + it.id + "-" + Date.now().toString(36);
    const ok = await window.painelRoteiros.salvarNoQuadro({ id, titulo: it.titulo, cliente: it.marca || "", plataforma: "Instagram", status: "Em aberto", finalidade: it.finalidade || "Conteúdos", etapa: "Ideias", conteudo: [it.gancho ? "GANCHO: " + it.gancho : "", it.roteiro || "", it.resumo ? "\nIDEIA: " + it.resumo : ""].filter(Boolean).join("\n"), gancho: it.gancho || "", formato: it.formato || "Reels", dataPublicacao: "" });
    if (!ok) return;
    await banco().from("ideias_organizadas").update({ roteiro_id: id, atualizado_em: new Date().toISOString() }).eq("id", it.id); it.roteiro_id = id;
    toast("Roteiro criado em Meus roteiros."); pintarIdeias();
  }
  function lerPrint(arq) {
    return new Promise((ok) => { lerImagem(arq).then((i) => ok(reduzir(i, 1400, 0.85))).catch(() => ok("")); });
  }
  function pintarIdeias() {
    const sec = document.getElementById("aba-ferideias"); if (!sec) return;
    const f = ide.filtro, s = ide.sugestao;
    const lista = ide.lista.filter((x) => (!f.fim || x.finalidade === f.fim) && (!f.funil || x.funil === f.funil) && (!f.cat || x.categoria === f.cat));
    const chips = (k, l) => `<div class="fe-chips">${["", ...l].map((v) => `<button type="button" class="fe-chip${f[k] === v ? " on" : ""}" data-filtro="${k}" data-v="${esc(v)}">${v || "Todas"}</button>`).join("")}</div>`;
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga fe">
      <div class="fe-cab"><div><h2 class="fe-titulo">Roteiro a partir de uma <em>ideia</em></h2><p class="fe-sub">Escreva uma ideia ou cole um print (de post, comentário ou briefing). Eu leio, separo por categoria, finalidade e funil e mando para a lista Ideias de Meus roteiros, que é o seu banco de ideias. Se já tiver dia, ponho também no calendário.</p></div></div>
      <section class="fe-cartao">
        <textarea class="entrada fe-ideia-txt" data-ideia rows="4" placeholder="Ex.: fazer um vídeo mostrando 3 jeitos de usar o mesmo hidratante, para atrair marcas de skincare. (Pode colar um print aqui com Ctrl+V.)">${esc(ide.texto)}</textarea>
        <div class="fe-acoes">
          <label class="btn">${IC.imagem}${ide.imagem ? "Trocar print" : "Anexar print"}<input type="file" accept="image/*" hidden data-print></label>
          ${ide.imagem ? `<span class="fe-print"><img src="${ide.imagem}" alt="Print anexado"><button type="button" class="icone-btn" data-tirar-print aria-label="Tirar print">${IC.x}</button></span>` : ""}
          <button class="btn btn-principal" type="button" data-organizar ${ide.lendo ? "disabled" : ""}>${IC.brilho}${ide.lendo ? "Lendo…" : "Organizar com IA"}</button>
        </div>
      </section>
      ${s ? `<section class="fe-cartao fe-sugestao" data-sug style="--cor:${CORES_FIM[s.finalidade] || "#6b4a35"}"><h3 class="fe-h3">Como eu organizei <small>confira e mude o que quiser</small></h3>${camposIdeia(s)}
        <div class="fe-acoes"><button class="btn" type="button" data-descartar>Descartar</button><button class="btn" type="button" data-salvar-so>Só guardar aqui</button><button class="btn" type="button" data-salvar-post>Pôr no calendário</button><button class="btn btn-principal" type="button" data-salvar-roteiro>Mandar para Meus roteiros</button></div></section>` : ""}
      <section class="fe-cartao"><h3 class="fe-h3">Minhas ideias <small>${ide.lista.length}</small></h3>
        <div class="fe-filtros"><span>Finalidade</span>${chips("fim", FINS)}<span>Funil</span>${chips("funil", FUNIS)}<span>Categoria</span>${chips("cat", [...new Set(ide.lista.map((x) => x.categoria).filter(Boolean))])}</div>
        ${lista.length ? `<div class="fe-ideias">${lista.map((x) => `<article class="fe-ideia" style="--cor:${CORES_FIM[x.finalidade] || "#6b4a35"}">
          <div class="fe-ideia-tags"><span class="fe-tag forte">${esc(x.finalidade || "")}</span><span class="fe-tag">${esc(x.funil || "")}</span>${x.categoria ? `<span class="fe-tag">${esc(x.categoria)}</span>` : ""}${x.formato ? `<span class="fe-tag">${esc(x.formato)}</span>` : ""}${x.marca ? `<span class="fe-tag">${esc(x.marca)}</span>` : ""}</div>
          <h4>${esc(x.titulo || "Ideia")}</h4>${x.resumo ? `<p>${esc(x.resumo)}</p>` : ""}${x.gancho ? `<p class="fe-gancho">“${esc(x.gancho)}”</p>` : ""}
          <div class="fe-ideia-status">${x.post_id ? `<span class="fe-ok">✓ no Painel de conteúdo</span>` : ""}${x.roteiro_id ? `<span class="fe-ok">✓ em Meus roteiros</span>` : ""}</div>
          <div class="fe-acoes">${x.post_id ? "" : `<button class="btn btn-principal" type="button" data-post="${x.id}">Criar post</button>`}${x.roteiro_id ? "" : `<button class="btn" type="button" data-roteiro="${x.id}">Criar roteiro</button>`}<button class="icone-btn" type="button" data-editar-ideia="${x.id}" aria-label="Editar">${IC.lapis}</button><button class="icone-btn" type="button" data-apagar-ideia="${x.id}" aria-label="Excluir">${IC.lixo}</button></div>
        </article>`).join("")}</div>` : `<p class="fe-vazio">${ide.lista.length ? "Nenhuma ideia com esse filtro." : "As ideias que você organizar ficam aqui."}</p>`}
      </section></div>`;
    const txt = $("[data-ideia]", sec);
    txt.addEventListener("input", () => { ide.texto = txt.value; });
    txt.addEventListener("paste", async (e) => { const it = [...(e.clipboardData || {}).items || []].find((x) => /^image\//.test(x.type)); if (!it) return; e.preventDefault(); ide.imagem = await lerPrint(it.getAsFile()); pintarIdeias(); toast("Print anexado."); });
    $("[data-print]", sec).addEventListener("change", async (e) => { const a = e.target.files && e.target.files[0]; if (!a) return; ide.imagem = await lerPrint(a); pintarIdeias(); });
    $("[data-tirar-print]", sec)?.addEventListener("click", () => { ide.imagem = ""; pintarIdeias(); });
    $("[data-organizar]", sec).addEventListener("click", organizarIdeia);
    const sug = $("[data-sug]", sec);
    if (sug) {
      $("[data-descartar]", sug).addEventListener("click", () => { ide.sugestao = null; pintarIdeias(); });
      const salvarE = async (depois) => { const v = lerCampos(sug); const d = await salvarIdeia(v); pintarIdeias(); if (d && depois) await depois(d); };
      $("[data-salvar-so]", sug).addEventListener("click", () => salvarE(null));
      $("[data-salvar-roteiro]", sug).addEventListener("click", () => salvarE(criarRoteiro));
      $("[data-salvar-post]", sug).addEventListener("click", () => salvarE(criarPost));
    }
    $$("[data-filtro]", sec).forEach((b) => b.addEventListener("click", () => { ide.filtro[b.dataset.filtro] = b.dataset.v; pintarIdeias(); }));
    const acha = (id) => ide.lista.find((x) => String(x.id) === String(id));
    $$("[data-post]", sec).forEach((b) => b.addEventListener("click", () => criarPost(acha(b.dataset.post))));
    $$("[data-roteiro]", sec).forEach((b) => b.addEventListener("click", () => criarRoteiro(acha(b.dataset.roteiro))));
    $$("[data-editar-ideia]", sec).forEach((b) => b.addEventListener("click", async () => {
      const it = acha(b.dataset.editarIdeia);
      const v = await modal({ titulo: "Editar ideia", larga: true, corpo: camposIdeia(it), botoes: [{ texto: "Cancelar", valor: null }, { texto: "Salvar", classe: "btn-principal", valor: (k) => lerCampos(k) }] });
      if (!v) return;
      const { error } = await banco().from("ideias_organizadas").update({ ...v, atualizado_em: new Date().toISOString() }).eq("id", it.id);
      if (error) { toast(error.message, true); return; }
      Object.assign(it, v); pintarIdeias(); toast("Ideia atualizada.");
    }));
    $$("[data-apagar-ideia]", sec).forEach((b) => b.addEventListener("click", async () => {
      const it = acha(b.dataset.apagarIdeia);
      if (!(await confirmar("Excluir ideia", `Apago a ideia <b>${esc(it.titulo || "")}</b>. O post e o roteiro que você já criou com ela continuam onde estão.`, "Excluir", true))) return;
      const { error } = await banco().from("ideias_organizadas").delete().eq("id", it.id);
      if (error) { toast(error.message, true); return; }
      if (it.imagem) banco().storage.from("anexos").remove([it.imagem]);
      ide.lista = ide.lista.filter((x) => x !== it); pintarIdeias();
    }));
  }

  // ---------- abrir as abas ----------
  const carregado = {};
  document.addEventListener("painel:aba", async (e) => {
    const nome = e.detail;
    if (nome === "ferarquivos") { pintarArquivos(); if (!carregado.arq) { carregado.arq = true; await carregarLotes(); pintarArquivos(); } }
    if (nome === "fercapa") { pintarCapa(); if (!carregado.cap) { carregado.cap = true; await carregarCapas(); pintarCapa(); } }
    if (nome === "ferideias") { pintarIdeias(); if (!carregado.ide) { carregado.ide = true; await carregarIdeias(); pintarIdeias(); } }
  });
  const h0 = location.hash.replace("#", ""); if (["ferarquivos", "fercapa", "ferideias"].includes(h0)) setTimeout(() => document.dispatchEvent(new CustomEvent("painel:aba", { detail: h0 })), 700);
  window.painelFerramentas = { arq, cap, ide, avaliarLocal, nomear }; // usado nos testes
})();
