// =========================================================
// CRIATIVIDADE > PAINEL DE CONTEÚDO (hash #planejar)
// Painel semanal do mês (estética do "Meu painel de conteúdo" que a Mari mandou):
// dias da semana em colunas, cada post com formato, tema, horário e status do roteiro.
// - Inspirações: posts do Laboratório (tabela laboratorio) que vieram das pastas do
//   Instagram dela pelo programa ferramentas/salvos.py: "Gravar em <mês>" e
//   "Produzir vídeos assim" (coluna colecao).
// - Gerar ideias: função painel-conteudo (método de roteiro da Lara, que fica só no
//   Supabase) devolve tema, tipo de UGC, funil, propósito, hook, desenvolvimento e CTA,
//   inspirados nas pastas sem copiar as falas. As ideias entram nos próximos dias livres.
// - Tudo fica na tabela painel_conteudo (só a dona). Cada post vai para Meus roteiros
//   com um clique (window.painelRoteiros.salvarNoQuadro).
// =========================================================
(function () {
  "use strict";

  const ABA = "planejar";
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const banco = () => window.banco;
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
  const STATUS = ["Ideia", "Roteirizado", "Gravado", "Editado", "Postado"];
  const FORMATOS = ["Reels", "Carrossel", "Stories"];
  const FUNIS = ["Topo", "Meio", "Fundo"];
  const TIPOS = ["Falado com a câmera", "Teatro encenando uma situação", "Dois personagens comparativos", "Rotina ou dia a dia", "Testando o produto ou demonstração", "Focado em ads", "Problema versus solução", "Unboxing", "Sorteador de assuntos", "Várias vozes ou personagens com locução", "Entrevista de rua", "React", "Tutorial walkthrough", "Decupagem por frase"];
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deIso = (s) => { const [a, m, d] = String(s).split("-").map(Number); return new Date(a, m - 1, d); };
  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const hoje = new Date();
  const st = { pronto: false, mes: `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`, semana: 0, posts: [], lab: [], faltaTabela: false, gerando: false, transcrevendo: false };

  let tempoToast = null;
  function toast(texto, erro) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = texto; t.classList.toggle("erro", Boolean(erro)); t.classList.add("visivel");
    clearTimeout(tempoToast); tempoToast = setTimeout(() => t.classList.remove("visivel"), erro ? 5200 : 2600);
  }
  const rotuloMes = (m) => { const [a, n] = m.split("-").map(Number); return `${MESES[n - 1]} de ${a}`; };
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

  // ---------- banco ----------
  async function carregar() {
    const [a, b] = await Promise.all([
      banco().from("painel_conteudo").select("*").eq("mes", st.mes).order("data", { ascending: true, nullsFirst: false }).order("id"),
      banco().from("laboratorio").select("id,link,codigo,perfil,tipo,legenda,transcricao,colecao,capa").not("colecao", "is", null).limit(1000),
    ]);
    if (a.error) { st.faltaTabela = true; st.posts = []; } else { st.faltaTabela = false; st.posts = a.data || []; }
    st.lab = b.error ? [] : (b.data || []);
  }
  async function salvar(post) {
    const campos = { ...post }; delete campos.id; delete campos.criado_em;
    if (post.id) {
      const { error } = await banco().from("painel_conteudo").update(campos).eq("id", post.id);
      if (error) throw new Error(error.message);
      const i = st.posts.findIndex((x) => x.id === post.id); if (i >= 0) st.posts[i] = { ...st.posts[i], ...campos };
      return st.posts[i];
    }
    const { data, error } = await banco().from("painel_conteudo").insert({ ...campos, mes: campos.mes || st.mes }).select().maybeSingle();
    if (error) throw new Error(error.message);
    const novo = data || { ...campos, mes: st.mes, id: Date.now() };
    st.posts.push(novo);
    return novo;
  }

  // ---------- pastas do Instagram ----------
  function pastasDoMes() {
    const nomeMes = semAcento(MESES[Number(st.mes.split("-")[1]) - 1]);
    const gravar = st.lab.filter((p) => { const c = semAcento(p.colecao); return c.includes("gravar") && c.includes(nomeMes); });
    const assim = st.lab.filter((p) => { const c = semAcento(p.colecao); return c.includes("produzir") || c.includes("videos assim"); });
    const outras = [...new Set(st.lab.map((p) => p.colecao))].filter((c) => !gravar.some((p) => p.colecao === c) && !assim.some((p) => p.colecao === c));
    return { gravar, assim, outras };
  }

  // ---------- gerar ideias ----------
  function proximosDiasLivres(qtd) {
    const [a, m] = st.mes.split("-").map(Number);
    const ultimo = new Date(a, m, 0).getDate();
    const ocupados = new Set(st.posts.filter((p) => p.data).map((p) => p.data));
    const inicio = a === hoje.getFullYear() && m === hoje.getMonth() + 1 ? hoje.getDate() + 1 : 1;
    const livres = [];
    for (let d = inicio; d <= ultimo && livres.length < qtd; d++) { const s = iso(new Date(a, m - 1, d)); if (!ocupados.has(s)) livres.push(s); }
    return livres;
  }
  async function gerar(qtd, notas) {
    if (st.gerando) return;
    const { gravar, assim } = pastasDoMes();
    const insp = [...gravar, ...assim].sort((x, y) => (y.transcricao ? 1 : 0) - (x.transcricao ? 1 : 0)).slice(0, 12)
      .map((p) => ({ perfil: p.perfil, tipo: p.tipo, colecao: p.colecao, legenda: p.legenda, transcricao: p.transcricao }));
    st.gerando = true; pintar();
    let feitas = 0, tentativas = 0;
    try {
      while (feitas < qtd && tentativas < 6) {
        tentativas++;
        const lote = Math.min(3, qtd - feitas);
        const { data, error } = await banco().functions.invoke("painel-conteudo", { body: { acao: "ideias", rotulo: rotuloMes(st.mes), quantidade: lote, inspiracoes: insp, notas, evitar: st.posts.map((p) => p.tema) } });
        let msg = data && data.error, limite = data && data.limite;
        if (error) { try { const j = await error.context.json(); msg = j.error; limite = j.limite; } catch (e) { /* segue */ } msg = msg || "A função não respondeu agora."; }
        if (limite) { toast("Esperando 1 minuto pelo limite grátis da IA… pode continuar usando o painel."); await espera(62000); continue; }
        if (msg) throw new Error(msg);
        const dias = proximosDiasLivres((data.ideias || []).length);
        for (const [k, x] of (data.ideias || []).entries()) {
          await salvar({ data: dias[k] || null, horario: "12h", formato: x.formato, tema: x.tema, tipo_ugc: x.tipo_ugc, funil: x.funil, proposito: x.proposito, hook: x.hook, ganchos: x.ganchos, desenvolvimento: x.desenvolvimento, cta: x.cta, status: "Roteirizado", inspiracao: { perfil: x.inspirado_em, duracao_seg: x.duracao_seg } });
          feitas++;
        }
        pintar();
      }
      toast(`${feitas} ideia${feitas === 1 ? "" : "s"} com roteiro no painel de ${rotuloMes(st.mes)}.`);
    } catch (e) { toast(e.message, true); }
    st.gerando = false;
    const prim = st.posts.filter((p) => p.data).map((p) => p.data).sort()[0];
    if (prim) st.semana = semanaDe(prim);
    pintar();
  }

  // ---------- transcrever os Reels das pastas ----------
  async function transcreverPastas() {
    if (st.transcrevendo) return;
    if (!window.painelSupadata || !window.painelSupadata.transcrever) { toast("Abra a página Transcrever vídeo uma vez e tente de novo.", true); return; }
    const { gravar, assim } = pastasDoMes();
    const alvo = [...gravar, ...assim].filter((p) => p.tipo === "Reel" && !p.transcricao).slice(0, 12);
    if (!alvo.length) { toast("Os Reels das pastas já estão transcritos."); return; }
    st.transcrevendo = true; pintar();
    let ok = 0;
    for (const p of alvo) {
      try {
        const r = await window.painelSupadata.transcrever(p.link);
        if (r && r.texto) { await banco().from("laboratorio").update({ transcricao: r.texto }).eq("id", p.id); p.transcricao = r.texto; ok++; }
      } catch (e) { if (e && e.tipo === "chave") { toast("Conecte a Supadata na página Transcrever vídeo.", true); break; } }
      pintar();
    }
    st.transcrevendo = false; pintar();
    toast(`${ok} Reel${ok === 1 ? "" : "s"} transcrito${ok === 1 ? "" : "s"}.`);
  }

  // ---------- semanas do mês ----------
  function semanasDoMes() {
    const [a, m] = st.mes.split("-").map(Number);
    const primeiro = new Date(a, m - 1, 1), ultimo = new Date(a, m, 0);
    const ini = new Date(primeiro); ini.setDate(ini.getDate() - ((ini.getDay() + 6) % 7));
    const semanas = [];
    for (let d = new Date(ini); d <= ultimo; d.setDate(d.getDate() + 7)) {
      semanas.push(Array.from({ length: 7 }, (_, k) => { const x = new Date(d); x.setDate(x.getDate() + k); return x; }));
    }
    return semanas;
  }
  function semanaDe(dataIso) { const s = semanasDoMes(); const i = s.findIndex((sem) => sem.some((d) => iso(d) === dataIso)); return i < 0 ? 0 : i; }

  // ---------- tela ----------
  const ic = {
    brilho: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    mais: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    esq: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    dir: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    x: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    pasta: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
  };
  function opcoesMes() {
    const lista = [];
    for (let k = -2; k <= 4; k++) { const d = new Date(hoje.getFullYear(), hoje.getMonth() + k, 1); lista.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
    if (!lista.includes(st.mes)) lista.push(st.mes);
    return lista;
  }

  function montar(sec) {
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga pc">
      <div class="pc-folha">
        <span class="pc-fita" aria-hidden="true"></span>
        <div class="pc-sobre">Painel de conteúdo · <span id="pc-sobre-mes"></span></div>
        <div class="pc-topo">
          <h2 class="pc-titulo">Meu painel de <em>conteúdo</em></h2>
          <div class="pc-acoes">
            <label class="pc-rot" for="pc-mes">Gravar em</label>
            <select class="entrada" id="pc-mes" aria-label="Mês"></select>
          </div>
        </div>
        <p class="pc-sub">abro, vejo o que gravar hoje e não perco tempo decidindo</p>
        <div class="pc-numeros" id="pc-numeros"></div>
        <div class="pc-semana-nav"><button class="icone-btn" type="button" id="pc-ant" aria-label="Semana anterior">${ic.esq}</button><b id="pc-semana-rot"></b><button class="icone-btn" type="button" id="pc-prox" aria-label="Próxima semana">${ic.dir}</button></div>
        <div class="pc-quadro" id="pc-quadro"></div>
        <div class="pc-banco" id="pc-banco"></div>
      </div>
      <div class="pc-baixo">
        <section class="pc-cartao pc-gerar">
          <h3 class="pc-h3">Criar ideias com roteiro</h3>
          <p class="pc-ajuda">Uso o método da Lara e me inspiro nos posts das suas pastas do Instagram, sem copiar as falas. Cada ideia vem com tema, tipo de UGC, funil, propósito, hook, desenvolvimento e CTA, e já entra nos próximos dias livres.</p>
          <textarea class="entrada" id="pc-notas" rows="2" placeholder="Algum pedido? Ex.: foco em maternidade, uma publi de cabelo, conteúdo para atrair marcas de casa..."></textarea>
          <div class="pc-linha"><select class="entrada" id="pc-qtd" aria-label="Quantas ideias"><option value="3">3 ideias</option><option value="6" selected>6 ideias</option><option value="9">9 ideias</option></select>
            <button class="btn btn-principal" type="button" id="pc-gerar"></button></div>
        </section>
        <section class="pc-cartao" id="pc-pastas"></section>
      </div>
    </div>`;
    const sel = $("#pc-mes", sec);
    sel.addEventListener("change", async () => { st.mes = sel.value; st.semana = 0; await carregar(); ajustarSemana(); pintar(); });
    $("#pc-ant", sec).addEventListener("click", () => { st.semana = Math.max(0, st.semana - 1); pintar(); });
    $("#pc-prox", sec).addEventListener("click", () => { st.semana = Math.min(semanasDoMes().length - 1, st.semana + 1); pintar(); });
    $("#pc-gerar", sec).addEventListener("click", () => gerar(Number($("#pc-qtd", sec).value), $("#pc-notas", sec).value.trim()));
  }
  function ajustarSemana() {
    const [a, m] = st.mes.split("-").map(Number);
    st.semana = a === hoje.getFullYear() && m === hoje.getMonth() + 1 ? semanaDe(iso(hoje)) : 0;
  }

  function cartaoPost(p) {
    const ok = p.status !== "Ideia";
    return `<button type="button" class="pc-post f-${esc(semAcento(p.formato || "reels"))}" data-id="${p.id}">
      <small>${esc((p.formato || "Reels").toUpperCase())}</small>
      <b>${esc(p.tema || "Sem tema")}</b>
      <span>${esc(p.horario || "")}${p.horario ? " · " : ""}${esc(p.status === "Ideia" ? "ideia" : p.status === "Roteirizado" ? "roteiro" : p.status.toLowerCase())}${ok ? " ✓" : ""}</span>
    </button>`;
  }

  function pintar() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec || !$("#pc-quadro", sec)) return;
    $("#pc-mes", sec).innerHTML = opcoesMes().map((m) => `<option value="${m}" ${m === st.mes ? "selected" : ""}>${rotuloMes(m)}</option>`).join("");
    $("#pc-sobre-mes", sec).textContent = rotuloMes(st.mes);
    if (st.faltaTabela) { $("#pc-quadro", sec).innerHTML = `<p class="faixa faixa-erro">A tabela do Painel de conteúdo ainda não existe no banco.</p>`; return; }
    const doMes = st.posts;
    const formatos = new Set(doMes.map((p) => p.formato).filter(Boolean)).size;
    const rot = doMes.filter((p) => p.status !== "Ideia").length;
    $("#pc-numeros", sec).innerHTML = `<div><b>${doMes.length}</b><span>posts no mês</span></div><div><b>${formatos}</b><span>formatos em teste</span></div><div><b>${rot} de ${doMes.length}</b><span>roteirizados</span></div>`;
    const semanas = semanasDoMes(); st.semana = Math.min(st.semana, semanas.length - 1);
    const sem = semanas[st.semana], mesNum = Number(st.mes.split("-")[1]) - 1;
    $("#pc-semana-rot", sec).textContent = `Semana ${st.semana + 1} · ${sem[0].getDate()}/${pad(sem[0].getMonth() + 1)} a ${sem[6].getDate()}/${pad(sem[6].getMonth() + 1)}`;
    $("#pc-quadro", sec).innerHTML = sem.map((d, k) => {
      const s = iso(d), fora = d.getMonth() !== mesNum, eHoje = s === iso(hoje);
      const lista = doMes.filter((p) => p.data === s);
      return `<div class="pc-dia${fora ? " fora" : ""}${eHoje ? " hoje" : ""}" data-dia="${s}">
        <div class="pc-dia-cab"><span>${DIAS[k]}</span><small>${d.getDate()}</small></div>
        ${lista.map(cartaoPost).join("")}
        ${fora ? "" : `<button type="button" class="pc-add" data-novo="${s}" aria-label="Novo post">${ic.mais}</button>`}
      </div>`;
    }).join("");
    const semData = doMes.filter((p) => !p.data);
    $("#pc-banco", sec).innerHTML = semData.length ? `<div class="pc-banco-cab">Banco de ideias <small>${semData.length} sem dia</small></div><div class="pc-banco-lista">${semData.map(cartaoPost).join("")}</div>` : "";
    $$("[data-id]", sec).forEach((b) => b.addEventListener("click", () => abrir(st.posts.find((p) => String(p.id) === b.dataset.id))));
    $$("[data-novo]", sec).forEach((b) => b.addEventListener("click", () => abrir({ data: b.dataset.novo, horario: "12h", formato: "Reels", status: "Ideia", funil: "Topo" })));
    // arrastar um post para outro dia
    $$(".pc-post", sec).forEach((b) => { b.draggable = true; b.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", b.dataset.id)); });
    $$(".pc-dia", sec).forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("alvo"); });
      col.addEventListener("dragleave", () => col.classList.remove("alvo"));
      col.addEventListener("drop", async (e) => {
        e.preventDefault(); col.classList.remove("alvo");
        const p = st.posts.find((x) => String(x.id) === e.dataTransfer.getData("text/plain"));
        if (!p || p.data === col.dataset.dia) return;
        try { await salvar({ id: p.id, data: col.dataset.dia }); pintar(); } catch (er) { toast(er.message, true); }
      });
    });
    const bt = $("#pc-gerar", sec);
    bt.disabled = st.gerando; bt.innerHTML = st.gerando ? "Criando ideias…" : `${ic.brilho}Criar ideias do mês`;
    pintarPastas();
  }

  function pintarPastas() {
    const box = $("#pc-pastas"); if (!box) return;
    const { gravar, assim, outras } = pastasDoMes();
    const nomeMes = MESES[Number(st.mes.split("-")[1]) - 1];
    const lista = (arr) => arr.length ? `<ul class="pc-insp">${arr.slice(0, 8).map((p) => `<li><a href="${esc(p.link)}" target="_blank" rel="noopener">@${esc(p.perfil || "post")}</a> <small>${esc(p.tipo || "")}${p.transcricao ? " · transcrito" : ""}</small><span>${esc(String(p.legenda || "").split("\n")[0].slice(0, 90))}</span></li>`).join("")}</ul>${arr.length > 8 ? `<p class="pc-ajuda">e mais ${arr.length - 8}</p>` : ""}` : "";
    const faltaReel = [...gravar, ...assim].filter((p) => p.tipo === "Reel" && !p.transcricao).length;
    box.innerHTML = `<h3 class="pc-h3">${ic.pasta}Suas pastas do Instagram</h3>
      <div class="pc-pasta"><b>Gravar em ${esc(nomeMes)}</b><small>${gravar.length} post${gravar.length === 1 ? "" : "s"}</small></div>${lista(gravar)}
      <div class="pc-pasta"><b>Produzir vídeos assim</b><small>${assim.length} post${assim.length === 1 ? "" : "s"}</small></div>${lista(assim)}
      ${faltaReel ? `<button class="btn" type="button" id="pc-transcrever" ${st.transcrevendo ? "disabled" : ""}>${st.transcrevendo ? "Transcrevendo…" : `Transcrever ${faltaReel} Reel${faltaReel === 1 ? "" : "s"} (ideias melhores)`}</button>` : ""}
      ${!gravar.length && !assim.length ? `<p class="pc-ajuda">Ainda não chegaram posts dessas pastas. No <a href="#laboratorio">Laboratório criativo</a>, use <b>"Mais rápido, pelo Mac"</b>: o programa traz os seus salvos com o nome da pasta (crie no Instagram as pastas <b>Gravar em ${esc(nomeMes)}</b> e <b>Produzir vídeos assim</b>). Depois envie o arquivo lá. Sem pastas, as ideias saem só do método e dos seus nichos.</p>` : ""}
      ${outras.length ? `<p class="pc-ajuda">Outras pastas que chegaram: ${outras.map(esc).join(", ")}.</p>` : ""}`;
    const t = $("#pc-transcrever", box); if (t) t.addEventListener("click", transcreverPastas);
  }

  // ---------- janela do post ----------
  let dlg = null;
  function abrir(p) {
    if (!p) return;
    if (!dlg) { dlg = document.createElement("dialog"); dlg.className = "janela larga"; document.body.appendChild(dlg); dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); }
    const opt = (arr, v) => arr.map((x) => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("");
    const tipos = TIPOS.includes(p.tipo_ugc) || !p.tipo_ugc ? TIPOS : [p.tipo_ugc, ...TIPOS];
    const ganchos = Array.isArray(p.ganchos) ? p.ganchos : [];
    const insp = p.inspiracao || {};
    dlg.innerHTML = `<div class="janela-cabeca"><div><small class="janela-sobretitulo">Painel de conteúdo · ${esc(rotuloMes(st.mes))}</small><h2>${p.id ? esc(p.tema || "Post") : "Novo post"}</h2></div><button class="icone-btn" type="button" data-fechar aria-label="Fechar">${ic.x}</button></div>
      <div class="janela-corpo pc-form">
        <label class="campo pc-largo"><span>Tema</span><input name="tema" value="${esc(p.tema)}"></label>
        <div class="pc-grade4">
          <label class="campo"><span>Dia</span><input type="date" name="data" value="${esc(p.data || "")}"></label>
          <label class="campo"><span>Horário</span><input name="horario" value="${esc(p.horario || "")}" placeholder="12h"></label>
          <label class="campo"><span>Formato</span><select name="formato">${opt(FORMATOS, p.formato)}</select></label>
          <label class="campo"><span>Status</span><select name="status">${opt(STATUS, p.status)}</select></label>
        </div>
        <div class="pc-grade2">
          <label class="campo"><span>Tipo de UGC</span><select name="tipo_ugc"><option value=""></option>${opt(tipos, p.tipo_ugc)}</select></label>
          <label class="campo"><span>Funil</span><select name="funil">${opt(FUNIS, p.funil)}</select></label>
        </div>
        <label class="campo pc-largo"><span>Propósito</span><input name="proposito" value="${esc(p.proposito)}" placeholder="Para que serve esse conteúdo no seu perfil"></label>
        <label class="campo pc-largo"><span>Hook</span><textarea name="hook" rows="2">${esc(p.hook)}</textarea></label>
        ${ganchos.length ? `<div class="pc-ganchos"><small>Outras opções de gancho (toque para usar)</small>${ganchos.map((g) => `<button type="button" class="cr-chip" data-gancho>${esc(g)}</button>`).join("")}</div>` : ""}
        <label class="campo pc-largo"><span>Desenvolvimento do roteiro</span><textarea name="desenvolvimento" rows="9">${esc(p.desenvolvimento)}</textarea></label>
        <label class="campo pc-largo"><span>CTA</span><input name="cta" value="${esc(p.cta)}"></label>
        <label class="campo pc-largo"><span>Notas</span><textarea name="notas" rows="2">${esc(p.notas)}</textarea></label>
        ${insp.perfil || insp.duracao_seg ? `<p class="pc-ajuda">${insp.perfil ? `Inspirado em ${esc(insp.perfil)}. ` : ""}${insp.duracao_seg ? `Duração estimada: ${insp.duracao_seg}s.` : ""}</p>` : ""}
      </div>
      <div class="janela-rodape">${p.id ? `<button class="btn btn-perigo" type="button" data-excluir>Excluir</button>` : ""}<span style="flex:1"></span>
        ${p.id ? `<button class="btn" type="button" data-quadro>Mandar para Meus roteiros</button>` : ""}
        <button class="btn btn-principal" type="button" data-salvar>Salvar</button></div>`;
    const ler = () => { const o = { ...p }; $$("[name]", dlg).forEach((el) => { o[el.name] = el.value.trim() || null; }); o.status = o.status || "Ideia"; return o; };
    $("[data-fechar]", dlg).addEventListener("click", () => dlg.close());
    $$("[data-gancho]", dlg).forEach((b) => b.addEventListener("click", () => { const h = $("[name=hook]", dlg); const antigo = h.value; h.value = b.textContent; b.textContent = antigo; }));
    $("[data-salvar]", dlg).addEventListener("click", async () => {
      try { const o = ler(); if (o.data && !o.data.startsWith(st.mes)) { o.mes = o.data.slice(0, 7); } await salvar(o); if (o.mes && o.mes !== st.mes) st.posts = st.posts.filter((x) => x.mes === st.mes || !x.mes); dlg.close(); if (o.data) st.semana = semanaDe(o.data); pintar(); toast("Post salvo."); }
      catch (e) { toast("Não consegui salvar: " + e.message, true); }
    });
    const ex = $("[data-excluir]", dlg);
    if (ex) ex.addEventListener("click", async () => {
      if (!confirm("Excluir esse post do painel?")) return;
      const { error } = await banco().from("painel_conteudo").delete().eq("id", p.id);
      if (error) { toast(error.message, true); return; }
      st.posts = st.posts.filter((x) => x.id !== p.id); dlg.close(); pintar();
    });
    const q = $("[data-quadro]", dlg);
    if (q) q.addEventListener("click", async () => {
      if (!window.painelRoteiros || !window.painelRoteiros.salvarNoQuadro) { toast("Abra Meus roteiros uma vez e tente de novo.", true); return; }
      const o = ler();
      const conteudo = [o.proposito && "PROPÓSITO:\n" + o.proposito, o.hook && "HOOK:\n" + o.hook, o.desenvolvimento && "DESENVOLVIMENTO:\n" + o.desenvolvimento, o.cta && "CTA:\n" + o.cta].filter(Boolean).join("\n\n");
      const ok = await window.painelRoteiros.salvarNoQuadro({ id: "pc" + p.id + "-" + Date.now().toString(36), titulo: o.tema || "Post do painel", plataforma: "Instagram", status: "Em aberto", finalidade: "Conteúdos", etapa: o.status === "Ideia" ? "Ideias" : "Roteirização", conteudo, gancho: o.hook || "", formato: o.formato || "", tipoUgc: o.tipo_ugc || "", funil: o.funil || "", dataPublicacao: o.data || "" });
      if (ok) { await salvar({ ...o, id: p.id }); dlg.close(); pintar(); toast("Mandado para Meus roteiros."); }
    });
    if (!dlg.open) dlg.showModal();
  }

  async function abrirAba() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec) return;
    if (!st.pronto) { montar(sec); st.pronto = true; await carregar(); ajustarSemana(); }
    else await carregar();
    pintar();
  }
  document.addEventListener("painel:aba", (e) => { if (e.detail === ABA) abrirAba(); });
  if (location.hash === "#" + ABA) setTimeout(abrirAba, 600);
})();
