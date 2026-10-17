// =========================================================
// CRIATIVIDADE > LABORATÓRIO CRIATIVO (hash #laboratorio)
// Banco de ideias feito dos posts que a Mari salva no Instagram.
// - Entrada: links colados (um por linha), o arquivo dos salvos que o Instagram
//   entrega em "Baixar suas informações" (saved_posts.json ou .html: o painel
//   tira todos os links instagram.com/p|reel/... do arquivo) ou o arquivo
//   salvos_instagram.json do programa ferramentas/salvos.py (Instaloader rodando
//   no Mac dela, já com perfil, tipo e legenda).
// - Processar: lê o post (legenda, tipo, perfil, capa) pela função referencias
//   acao "post" (Apify); se for Reel, transcreve pela Supadata (mesma chave da
//   página Transcrever vídeo); depois a IA (referencias acao "laboratorio") tira
//   tema, formato, por que funciona e uma ideia de vídeo dela.
// - Tudo fica na tabela laboratorio (só a dona lê e grava).
// O painel avisa esta aba pelo evento "painel:aba" (js/admin.js, mostrarAba).
// =========================================================
(function () {
  "use strict";

  const ABA = "laboratorio";
  const ETAPAS = ["Nova", "Ideia pronta", "Vou gravar", "Gravado", "Descartada"];
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const banco = () => window.banco;
  const fmtData = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR"); };

  const st = { pronto: false, lista: [], filtro: "todos", busca: "", fila: [], rodando: 0, faltaTabela: false };

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

  // ---------- links ----------
  function linkLimpo(bruto) {
    const m = String(bruto || "").match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/i);
    if (!m) return null;
    const tipo = m[1].toLowerCase() === "p" ? "p" : "reel";
    return { link: `https://www.instagram.com/${tipo}/${m[2]}/`, codigo: m[2] };
  }
  function linksDoTexto(texto) {
    const vistos = new Map();
    String(texto || "").replace(/https?:\\?\/\\?\/(?:www\.)?instagram\.com\\?\/[^\s"'<>]+|instagram\.com\/[^\s"'<>]+/gi, (achado) => {
      const l = linkLimpo(achado.replace(/\\\//g, "/"));
      if (l && !vistos.has(l.codigo)) vistos.set(l.codigo, l);
      return achado;
    });
    return [...vistos.values()];
  }
  // arquivo do programa ferramentas/salvos.py (Instaloader no Mac dela): {"origem":"instaloader","salvos":[{link,codigo,perfil,tipo,legenda}]}
  function salvosDoPrograma(texto) {
    try {
      const j = JSON.parse(texto);
      if (!j || j.origem !== "instaloader" || !Array.isArray(j.salvos)) return null;
      return j.salvos.map((x) => { const l = linkLimpo(x.link); return l ? { ...l, perfil: x.perfil, tipo: ["Reel", "Carrossel", "Post"].includes(x.tipo) ? x.tipo : null, legenda: x.legenda, colecao: x.colecao || null } : null; }).filter(Boolean);
    } catch (e) { return null; }
  }
  // datas do arquivo do Instagram: {"string_map_data":{"Saved on":{"href":...,"timestamp":...}}}
  function datasDoArquivo(texto) {
    const datas = {};
    try {
      const j = JSON.parse(texto);
      const varrer = (o) => {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) { o.forEach(varrer); return; }
        const smd = o.string_map_data;
        if (smd) Object.values(smd).forEach((v) => { const l = v && v.href && linkLimpo(v.href); if (l && v.timestamp) datas[l.codigo] = new Date(Number(v.timestamp) * 1000).toISOString(); });
        Object.values(o).forEach(varrer);
      };
      varrer(j);
    } catch (e) { /* html ou texto: sem datas */ }
    return datas;
  }

  // ---------- banco ----------
  async function carregar() {
    const { data, error } = await banco().from("laboratorio").select("*").order("salvo_em", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false }).limit(3000);
    if (error) { st.faltaTabela = /laboratorio/.test(error.message || "") || error.code === "42P01" || error.code === "PGRST205"; st.lista = []; return; }
    st.lista = data || [];
  }
  async function adicionar(itens, datas) {
    const existentes = new Set(st.lista.map((r) => r.codigo));
    // itens do programa salvos.py já vêm com perfil, tipo e legenda: aí o processar pula a leitura pelo Apify
    const novos = itens.filter((i) => !existentes.has(i.codigo)).map((i) => ({ link: i.link, codigo: i.codigo, salvo_em: (datas && datas[i.codigo]) || null, status: "novo", etapa: "Nova",
      ...(i.tipo ? { perfil: i.perfil || null, tipo: i.tipo, legenda: i.legenda || null } : {}), ...(i.colecao ? { colecao: i.colecao } : {}) }));
    // posts que já estavam aqui ganham a pasta do Instagram (Gravar em..., Produzir vídeos assim)
    for (const i of itens.filter((x) => x.colecao && existentes.has(x.codigo))) {
      const r = st.lista.find((x) => x.codigo === i.codigo);
      if (r && r.colecao !== i.colecao) await banco().from("laboratorio").update({ colecao: i.colecao }).eq("id", r.id);
    }
    if (!novos.length) { if (itens.some((x) => x.colecao)) await carregar(); return 0; }
    for (let k = 0; k < novos.length; k += 200) {
      const { error } = await banco().from("laboratorio").upsert(novos.slice(k, k + 200), { onConflict: "link", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    await carregar();
    return novos.length;
  }
  async function atualizar(id, campos) {
    const { data, error } = await banco().from("laboratorio").update(campos).eq("id", id).select().maybeSingle();
    if (error) throw new Error(error.message);
    const i = st.lista.findIndex((r) => r.id === id);
    const novo = data || { ...(i >= 0 ? st.lista[i] : { id }), ...campos };
    if (i >= 0) st.lista[i] = novo;
    return novo;
  }
  async function chamarFuncao(corpo) {
    const { data, error } = await banco().functions.invoke("referencias", { body: corpo });
    let msg = data && data.error;
    if (error) { try { msg = (await error.context.json()).error; } catch (e) { /* segue */ } msg = msg || "A função não respondeu agora."; }
    if (msg) throw new Error(msg);
    return data;
  }
  // capa: a imagem do Instagram expira, então guarda uma cópia pequena
  async function capaGuardada(link, url) {
    if (!url) return null;
    try {
      const { data } = await banco().functions.invoke("capa-video", { body: { link, imagem: url } });
      if (!data || !data.imagem) return null;
      return await new Promise((ok) => {
        const img = new Image();
        img.onload = () => { const l = Math.min(1, 360 / img.width); const c = document.createElement("canvas"); c.width = Math.round(img.width * l); c.height = Math.round(img.height * l); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); try { ok(c.toDataURL("image/jpeg", 0.7)); } catch (e) { ok(null); } };
        img.onerror = () => ok(null); img.src = data.imagem;
      });
    } catch (e) { return null; }
  }

  // ---------- processar (ler post, transcrever, ideia) ----------
  async function processar(r) {
    const id = r.id;
    if (st.fila.includes(id)) return;
    st.fila.push(id);
    pintar();
    try {
      r = await atualizar(r.id, { status: "processando", erro: null });
      pintar();
      let info = { perfil: r.perfil, tipo: r.tipo, legenda: r.legenda };
      if (!r.tipo) {
        info = await chamarFuncao({ acao: "post", link: r.link });
        const capa = await capaGuardada(r.link, info.capa);
        r = await atualizar(r.id, { perfil: info.perfil, tipo: info.tipo, legenda: info.legenda, capa: capa || r.capa || null });
        pintar();
      }
      let transcricao = r.transcricao || "";
      let semFala = false;
      if (!transcricao && r.tipo === "Reel") {
        if (window.painelSupadata && window.painelSupadata.transcrever) {
          try { transcricao = (await window.painelSupadata.transcrever(r.link)).texto || ""; }
          catch (e) { if (e && e.tipo === "vazio") semFala = true; else if (e && e.tipo === "chave") throw new Error("Conecte a Supadata na página Transcrever vídeo para transcrever os Reels."); else throw e; }
        }
        if (transcricao) r = await atualizar(r.id, { transcricao });
      }
      const ideia = await chamarFuncao({ acao: "laboratorio", post: { perfil: r.perfil, tipo: r.tipo, legenda: r.legenda, transcricao } });
      r = await atualizar(r.id, { ideia: { ...ideia, semFala }, status: "pronto", etapa: r.etapa === "Nova" ? "Ideia pronta" : r.etapa, erro: null });
    } catch (e) {
      try { await atualizar(id, { status: "erro", erro: String(e.message || e).slice(0, 300) }); } catch (x) { /* segue */ }
    }
    st.fila = st.fila.filter((x) => x !== id);
    pintar();
  }
  async function processarVarios(n) {
    const alvo = st.lista.filter((r) => r.status === "novo" || r.status === "erro").slice(0, n);
    if (!alvo.length) { toast("Nada novo para processar."); return; }
    toast(`Processando ${alvo.length}… pode continuar usando o painel.`);
    // 2 de cada vez para não estourar os limites dos serviços
    let i = 0;
    const trabalhador = async () => { while (i < alvo.length) { const r = alvo[i++]; await processar(r); } };
    await Promise.all([trabalhador(), trabalhador()]);
    toast("Pronto: ideias atualizadas.");
  }

  // ---------- tela ----------
  const ic = {
    insta: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6"/></svg>',
    lampada: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
    seta: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    mais: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    arquivo: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7.5L19 8v12.5H7z"/><path d="M14 3.5V8h5"/></svg>'
  };
  const statusTxt = (r) => st.fila.includes(r.id) || r.status === "processando" ? ["Processando…", "amarelo"]
    : r.status === "pronto" ? ["Ideia pronta", "verde"] : r.status === "erro" ? ["Erro", "vermelho"] : ["Novo", "cinza"];

  function filtrados() {
    const b = st.busca.trim().toLowerCase();
    return st.lista.filter((r) => {
      if (st.filtro === "fila" && r.status !== "pronto") return false;
      if (st.filtro === "novos" && !(r.status === "novo" || r.status === "erro")) return false;
      if (["Vou gravar", "Gravado", "Descartada"].includes(st.filtro) && r.etapa !== st.filtro) return false;
      if (st.filtro === "fila" && ["Gravado", "Descartada"].includes(r.etapa)) return false;
      if (!b) return true;
      const i = r.ideia || {};
      return [r.perfil, r.legenda, r.transcricao, i.tema, i.formato, i.ideia && i.ideia.titulo, i.ideia && i.ideia.gancho].join(" ").toLowerCase().includes(b);
    });
  }

  function montar(sec) {
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga lab">
      <header class="cr-cabeca cr-cabeca-linha"><div><h2>Laboratório criativo</h2><p>Os posts que você salva no Instagram viram banco de ideias: o painel lê, transcreve e transforma cada um em ideia de conteúdo.</p></div>
        <div class="cr-acoes-topo"><button class="btn" type="button" id="lab-proc5">${ic.lampada}Processar próximos 5</button><button class="btn btn-principal" type="button" id="lab-proc20">Processar próximos 20</button></div></header>
      <div class="lab-entrada">
        <div class="lab-col">
          <label class="lab-rotulo" for="lab-links">Colar links de posts salvos</label>
          <textarea id="lab-links" class="entrada" rows="3" placeholder="https://www.instagram.com/reel/...  (um por linha, pode colar vários)"></textarea>
          <button class="btn btn-principal" type="button" id="lab-add">${ic.mais}Adicionar ao laboratório</button>
        </div>
        <div class="lab-col">
          <span class="lab-rotulo">Trazer todos os salvos de uma vez</span>
          <p class="lab-ajuda">No Instagram: <b>Sua atividade › Baixar suas informações › Algumas das suas informações › Salvos</b>, formato JSON. Quando chegar o e-mail, baixe, abra o .zip e envie aqui o arquivo <b>saved_posts.json</b>.</p>
          <label class="btn" style="cursor:pointer">${ic.arquivo}Enviar arquivo dos salvos<input type="file" id="lab-arquivo" accept=".json,.html,.htm,.txt" hidden></label>
          <details class="lab-mac"><summary>Mais rápido, pelo computador Windows (na hora, sem esperar e-mail)</summary>
            <p class="lab-ajuda">Aperte a tecla <b>Windows</b>, digite <b>PowerShell</b> e abra. Cole a linha abaixo e aperte Enter. Ele entra pelo Instagram que já está aberto no seu navegador (sem senha; se não achar, pede a senha ali mesmo, que não fica salva e não vem para o painel), lê os seus salvos devagar com o nome de cada pasta (como "Gravar em outubro" e "Produzir vídeos assim", que vão para o Painel de conteúdo) e grava <b>salvos_instagram.json</b> na Área de Trabalho. Se abrir a Microsoft Store pedindo o Python, instale e rode a linha de novo.</p>
            <div class="lab-comando"><code id="lab-cmd">irm https://marianabonetto.com.br/ferramentas/salvos.py -OutFile "$HOME\\salvos.py"; python "$HOME\\salvos.py"</code><button class="btn" type="button" id="lab-copiar">Copiar</button></div>
            <p class="lab-ajuda">Vai com calma: usar programas no Instagram tem um risco pequeno de ele pedir confirmação ou bloquear por um tempo. Rodar no seu próprio computador, com a sua internet e de vez em quando, é o jeito mais seguro.</p>
          </details>
        </div>
      </div>
      <div class="lab-numeros" id="lab-numeros"></div>
      <div class="cr-busca"><input type="search" id="lab-busca" placeholder="Buscar por perfil, tema, legenda ou ideia..." aria-label="Buscar"></div>
      <div class="cr-filtros"><div class="cr-chips" id="lab-filtros"></div></div>
      <div id="lab-lista"></div>
    </div>`;
    $("#lab-add", sec).addEventListener("click", async () => {
      const itens = linksDoTexto($("#lab-links", sec).value);
      if (!itens.length) { toast("Não achei nenhum link de post do Instagram aí.", true); return; }
      try { const n = await adicionar(itens); $("#lab-links", sec).value = ""; toast(n ? `${n} post${n > 1 ? "s" : ""} no laboratório.` : "Esses posts já estavam aqui."); pintar(); }
      catch (e) { toast("Não consegui salvar: " + e.message, true); }
    });
    $("#lab-arquivo", sec).addEventListener("change", async (e) => {
      const arq = e.target.files[0]; e.target.value = "";
      if (!arq) return;
      const texto = await arq.text();
      const doPrograma = salvosDoPrograma(texto);
      const itens = doPrograma || linksDoTexto(texto);
      if (!itens.length) { toast("Não achei links de posts nesse arquivo. Envie o saved_posts.json do Instagram.", true); return; }
      try { const n = await adicionar(itens, datasDoArquivo(texto)); toast(`${itens.length} salvos no arquivo, ${n} novos no laboratório.`); pintar(); }
      catch (err) { toast("Não consegui salvar: " + err.message, true); }
    });
    $("#lab-copiar", sec).addEventListener("click", async () => { try { await navigator.clipboard.writeText($("#lab-cmd", sec).textContent); toast("Copiado. Cole no PowerShell."); } catch (e) { toast("Selecione a linha e copie com Ctrl+C.", true); } });
    $("#lab-proc5", sec).addEventListener("click", () => processarVarios(5));
    $("#lab-proc20", sec).addEventListener("click", () => processarVarios(20));
    $("#lab-busca", sec).addEventListener("input", (e) => { st.busca = e.target.value; pintarLista(); });
  }

  function pintar() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec || !$("#lab-lista", sec)) return;
    const total = st.lista.length, prontos = st.lista.filter((r) => r.status === "pronto").length;
    const transcritos = st.lista.filter((r) => r.transcricao).length, gravar = st.lista.filter((r) => r.etapa === "Vou gravar").length;
    $("#lab-numeros", sec).innerHTML = [["Salvos", total], ["Transcritos", transcritos], ["Com ideia", prontos], ["Vou gravar", gravar]].map(([t, n]) => `<div class="lab-num"><b>${n}</b><span>${t}</span></div>`).join("");
    const filtros = [["todos", "Todos"], ["fila", "Fila de ideias"], ["novos", "Sem processar"], ["Vou gravar", "Vou gravar"], ["Gravado", "Gravados"], ["Descartada", "Descartados"]];
    $("#lab-filtros", sec).innerHTML = filtros.map(([k, t]) => `<button type="button" class="cr-chip${st.filtro === k ? " ativo" : ""}" data-f="${esc(k)}">${t}</button>`).join("");
    $$("[data-f]", sec).forEach((b) => b.addEventListener("click", () => { st.filtro = b.dataset.f; pintar(); }));
    pintarLista();
  }

  function pintarLista() {
    const sec = document.getElementById("aba-" + ABA);
    const caixa = $("#lab-lista", sec);
    if (st.faltaTabela) { caixa.innerHTML = `<p class="faixa faixa-erro">A tabela do Laboratório ainda não existe no banco.</p>`; return; }
    const lista = filtrados();
    if (!lista.length) { caixa.innerHTML = `<p class="cr-vazio">${ic.lampada}${st.lista.length ? "Nada nesse filtro." : "Cole links ou envie o arquivo dos seus salvos para começar."}</p>`; return; }
    caixa.innerHTML = `<div class="lab-tabela">` + lista.slice(0, 300).map((r) => {
      const [stt, cor] = statusTxt(r);
      const i = r.ideia || {};
      return `<div class="lab-linha" data-id="${r.id}">
        <div class="lab-capa">${r.capa ? `<img src="${esc(r.capa)}" alt="" loading="lazy">` : ic.insta}</div>
        <div class="lab-info"><b>${r.perfil ? "@" + esc(r.perfil) : esc(r.codigo || "post")}</b><small>${esc(r.tipo || "Instagram")}${r.salvo_em ? " · salvo em " + fmtData(r.salvo_em) : ""}</small></div>
        <div class="lab-ideia">${i.ideia && i.ideia.titulo ? `<b>${esc(i.ideia.titulo)}</b><small>${esc(i.ideia.gancho || i.por_que_funciona || "")}</small>` : `<small>${r.status === "erro" ? esc(r.erro || "Deu erro") : "Ainda sem ideia"}</small>`}</div>
        <div class="lab-tags">${i.tema ? `<span class="lab-tag">${esc(i.tema)}</span>` : ""}${i.formato ? `<span class="lab-tag">${esc(i.formato)}</span>` : ""}</div>
        <span class="lab-status ${cor}">${stt}</span>
        <span class="lab-etapa">${esc(r.etapa)}</span>
        <button class="btn" type="button" data-abrir>Abrir${ic.seta}</button>
      </div>`;
    }).join("") + `</div>` + (lista.length > 300 ? `<p class="cr-sub">Mostrando 300 de ${lista.length}. Use a busca ou os filtros.</p>` : "");
    $$(".lab-linha", caixa).forEach((l) => $("[data-abrir]", l).addEventListener("click", () => abrir(st.lista.find((r) => String(r.id) === l.dataset.id))));
  }

  // ---------- janela de um post ----------
  let dlg = null;
  function abrir(r) {
    if (!r) return;
    if (!dlg) {
      dlg = document.createElement("dialog");
      dlg.className = "janela larga";
      document.body.appendChild(dlg);
      dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    }
    const i = r.ideia || {}, id = i.ideia || {};
    dlg.innerHTML = `<div class="janela-cabeca"><div><small class="janela-sobretitulo">Laboratório criativo</small><h2>${r.perfil ? "@" + esc(r.perfil) : "Post salvo"} · ${esc(r.tipo || "Instagram")}</h2></div>
        <button class="icone-btn" type="button" data-fechar aria-label="Fechar"><svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="janela-corpo lab-janela">
        ${id.titulo ? `<section class="lab-bloco lab-destaque"><small>Ideia para você</small><h3>${esc(id.titulo)}</h3>${id.gancho ? `<p class="lab-gancho">“${esc(id.gancho)}”</p>` : ""}<p>${esc(id.descricao || "")}</p></section>` : ""}
        ${i.por_que_funciona || i.tema ? `<section class="lab-bloco"><small>Por que esse post funciona</small><p>${esc(i.por_que_funciona || "")}</p><p class="lab-meta">${[i.tema && "Tema: " + esc(i.tema), i.formato && "Formato: " + esc(i.formato), i.gancho_original && "Gancho do post: “" + esc(i.gancho_original) + "”"].filter(Boolean).join(" · ")}</p></section>` : ""}
        ${r.transcricao ? `<section class="lab-bloco"><small>O que a pessoa fala</small><p class="lab-texto">${esc(r.transcricao)}</p></section>` : (i.semFala ? `<section class="lab-bloco"><small>Transcrição</small><p>Esse vídeo não tem fala (só música ou texto na tela).</p></section>` : "")}
        ${r.legenda ? `<section class="lab-bloco"><small>Legenda</small><p class="lab-texto">${esc(r.legenda)}</p></section>` : ""}
        ${r.status === "erro" ? `<p class="faixa faixa-erro">${esc(r.erro || "Deu erro ao processar.")}</p>` : ""}
        <div class="lab-etapas"><span>Etapa:</span>${ETAPAS.map((e) => `<button type="button" class="cr-chip${r.etapa === e ? " ativo" : ""}" data-etapa="${esc(e)}">${esc(e)}</button>`).join("")}</div>
      </div>
      <div class="janela-rodape lab-rodape">
        <a class="btn" href="${esc(r.link)}" target="_blank" rel="noopener">${ic.insta}Ver no Instagram</a>
        <button class="btn btn-perigo" type="button" data-excluir>Excluir</button>
        <span style="flex:1"></span>
        <button class="btn" type="button" data-processar>${r.status === "pronto" ? "Gerar de novo" : "Processar agora"}</button>
        ${id.titulo ? `<button class="btn btn-principal" type="button" data-quadro>Mandar para Meus roteiros</button>` : ""}
      </div>`;
    $("[data-fechar]", dlg).addEventListener("click", () => dlg.close());
    $$("[data-etapa]", dlg).forEach((b) => b.addEventListener("click", async () => { try { const n = await atualizar(r.id, { etapa: b.dataset.etapa }); pintar(); abrir(n); } catch (e) { toast(e.message, true); } }));
    $("[data-processar]", dlg).addEventListener("click", async () => { dlg.close(); await processar(r.status === "pronto" ? { ...r, status: "novo" } : r); const n = st.lista.find((x) => x.id === r.id); if (n && n.status === "pronto") abrir(n); else if (n && n.status === "erro") toast(n.erro || "Deu erro.", true); });
    $("[data-excluir]", dlg).addEventListener("click", async () => {
      if (!confirm("Excluir esse post do laboratório?")) return;
      const { error } = await banco().from("laboratorio").delete().eq("id", r.id);
      if (error) { toast(error.message, true); return; }
      st.lista = st.lista.filter((x) => x.id !== r.id); dlg.close(); pintar();
    });
    const q = $("[data-quadro]", dlg);
    if (q) q.addEventListener("click", async () => {
      if (!window.painelRoteiros || !window.painelRoteiros.salvarNoQuadro) { toast("Abra Meus roteiros uma vez e tente de novo.", true); return; }
      const conteudo = [id.gancho && "GANCHO:\n" + id.gancho, id.descricao && "IDEIA:\n" + id.descricao, i.por_que_funciona && "POR QUE FUNCIONA (referência):\n" + i.por_que_funciona, "REFERÊNCIA:\n" + r.link].filter(Boolean).join("\n\n");
      const ok = await window.painelRoteiros.salvarNoQuadro({ id: "lab" + r.id + "-" + Date.now().toString(36), titulo: id.titulo, plataforma: "Instagram", status: "Em aberto", finalidade: "Conteúdos", etapa: "Ideias", conteudo, gancho: id.gancho || "", formato: i.formato || "", referencia: r.link, dataPublicacao: "" });
      if (ok) { await atualizar(r.id, { etapa: "Vou gravar" }); pintar(); dlg.close(); toast("Ideia mandada para Meus roteiros (coluna Ideias)."); }
    });
    if (!dlg.open) dlg.showModal();
  }

  async function abrirAba() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec) return;
    if (!st.pronto) { montar(sec); st.pronto = true; }
    await carregar();
    pintar();
  }
  document.addEventListener("painel:aba", (e) => { if (e.detail === ABA) abrirAba(); });
  if (location.hash === "#" + ABA) setTimeout(abrirAba, 600);
})();
