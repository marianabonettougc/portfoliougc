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
// - Meu perfil de conteúdo (configuracoes chave "perfil_conteudo", JSON): quem ela é, objetivo,
//   pilares, tom de voz, o que evitar e o ritmo (posts por semana, dias, horário, formatos,
//   topo/meio/fundo por semana). A grade é distribuída AQUI antes de chamar a IA (planejarSlots):
//   cada espaço do ritmo recebe pilar (rodízio, o menos usado primeiro), funil e formato, e a
//   função painel-conteudo escreve a ideia exatamente naquele lugar. "Refazer com ajuste" na
//   janela do post regera só aquele post no mesmo dia, pilar, funil e formato.
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
  const ROTEIROS = ["Spec ad", "Vitrine para marca", "Stories de bastidor"];
  const TIPOS = ["Falado com a câmera", "Teatro encenando uma situação", "Dois personagens comparativos", "Rotina ou dia a dia", "Testando o produto ou demonstração", "Focado em ads", "Problema versus solução", "Unboxing", "Sorteador de assuntos", "Várias vozes ou personagens com locução", "Entrevista de rua", "React", "Tutorial walkthrough", "Decupagem por frase"];
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deIso = (s) => { const [a, m, d] = String(s).split("-").map(Number); return new Date(a, m - 1, d); };
  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  // mesmo padrão da função painel-conteudo (PERFIL_PADRAO); ela edita no cartão
  const PERFIL_PADRAO = {
    quem: "Criadora de conteúdo UGC e mãe. Não tenho um nicho fechado: crio beleza, moda, bem-estar, maternidade, achadinhos, cabelo, casa e tech, porque no UGC dá para trabalhar com tudo.",
    objetivo: "Alinhar os conteúdos do Instagram para as marcas começarem a me seguir e me contratar. As pessoas precisam me conhecer.",
    pilares: [
      { nome: "Maternidade e autocuidado", descricao: "Me reencontrando depois de ser mãe: emagreci, voltei a cuidar de mim. Junta maternidade com beleza e autocuidado." },
      { nome: "Beleza e cabelo", descricao: "Skincare, make, cuidados com o cabelo, produto em uso real." },
      { nome: "Moda", descricao: "Looks do dia a dia de mãe, peças que funcionam, achados de roupa." },
      { nome: "Bem-estar", descricao: "Rotina, hábitos, cuidar do corpo e da cabeça." },
      { nome: "Achadinhos de casa e tech", descricao: "Coisas para casa e tecnologia que eu comprei e uso." },
    ],
    tom: 'Divertido e um pouco sarcástico, sem humor palhaço. Tom de amiga dando dica, como numa conversa: "amiga, olha, hoje eu comprei uma luminária, ela é maravilhosa, tem iluminação assim e assim, gostei bastante porque ela faz isso".',
    evitar: "Vícios de linguagem e gírias (eu não falo desse jeito). Esquetes, personagens, ceninhas e historinhas: quero UGC falando para a câmera com o produto em uso real.",
    ritmo: { porSemana: 3, dias: [0, 2, 4], horario: "12h", formatos: ["Reels", "Carrossel"], funil: { Topo: 1, Meio: 2, Fundo: 0 } },
  };
  const CMD_WIN = 'irm https://marianabonetto.com.br/ferramentas/salvos.py -OutFile "$HOME\\salvos.py"; python "$HOME\\salvos.py"';
  const hoje = new Date();
  const st = { pronto: false, mes: `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`, semana: 0, posts: [], lab: [], faltaTabela: false, gerando: false, transcrevendo: false, perfil: PERFIL_PADRAO };

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
    try {
      const { data: ap } = await banco().from("app_state").select("data").limit(1).maybeSingle();
      st.agenda = montarAgenda((ap && ap.data) || {});
    } catch (e) { st.agenda = []; }
    const c = await banco().from("configuracoes").select("chave,valor").in("chave", ["ntfy_topico", "perfil_conteudo", "temas_semana"]);
    const cfg = Object.fromEntries((c.data || []).map((x) => [x.chave, x.valor]));
    st.topico = cfg.ntfy_topico || "";
    try { st.temas = JSON.parse(cfg.temas_semana || "{}") || {}; } catch (e) { st.temas = {}; }
    try { const p = JSON.parse(cfg.perfil_conteudo || ""); st.perfil = { ...PERFIL_PADRAO, ...p, ritmo: { ...PERFIL_PADRAO.ritmo, ...(p.ritmo || {}), funil: { ...PERFIL_PADRAO.ritmo.funil, ...((p.ritmo || {}).funil || {}) } } }; } catch (e) { st.perfil = PERFIL_PADRAO; }
  }
  // Planner unido ao Painel (out/2026): prazos das publis (UGC's & Publis) e itens do antigo Planner aparecem no calendário
  function montarAgenda(est) {
    const out = [], fim = /conclu|cancel|finaliz/i;
    (est.jobs || []).forEach((j) => {
      if (fim.test(j.status || "")) return;
      const ent = j.entregaveis || {};
      Object.values(ent).forEach((lista) => (Array.isArray(lista) ? lista : []).forEach((it) => {
        if (it.concluido) return;
        [["prazoRoteiro", "Roteiro"], ["prazoConteudo", "Entregar"], ["prazoPostagem", "Postar"]].forEach(([k, verbo]) => {
          if (it[k]) out.push({ data: String(it[k]).slice(0, 10), tipo: "publi", rotulo: "PUBLI · " + String(j.marca || "").toUpperCase(), texto: `${verbo}: ${it.label || "entrega"}${Number(it.quantidade) > 1 ? " (" + it.quantidade + ")" : ""}`, ir: "campanhas" });
        });
      }));
    });
    (est.planner || []).forEach((it) => { if (it.data && !/entreg|feito|postado/i.test(it.status || "")) out.push({ data: String(it.data).slice(0, 10), tipo: "agenda", rotulo: "AGENDA" + (it.marca ? " · " + String(it.marca).toUpperCase() : ""), texto: it.titulo || "Compromisso", ir: it.roteiroId ? "quadro" : "" }); });
    return out;
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
  // espaços do ritmo dela no mês (dias da semana do perfil), cada um com pilar, funil e formato.
  // modo "mes": todos os espaços livres do mês; modo "semana": só os da próxima semana com espaço.
  function planejarSlots(modo) {
    const r = st.perfil.ritmo || PERFIL_PADRAO.ritmo;
    const [a, m] = st.mes.split("-").map(Number);
    const ultimo = new Date(a, m, 0).getDate();
    const inicio = a === hoje.getFullYear() && m === hoje.getMonth() + 1 ? hoje.getDate() + 1 : 1;
    const dias = (r.dias && r.dias.length ? r.dias : [0, 2, 4]).slice().sort();
    const ocupados = new Set(st.posts.filter((p) => p.data).map((p) => p.data));
    const porSemana = Math.max(1, Number(r.porSemana) || dias.length);
    // funil da semana: ex. Topo 1 + Meio 2 = [Topo, Meio, Meio], intercalado
    const fun = r.funil || { Topo: 1, Meio: 2 };
    const sequenciaFunil = [];
    const restam = { Topo: Number(fun.Topo) || 0, Meio: Number(fun.Meio) || 0, Fundo: Number(fun.Fundo) || 0 };
    while (sequenciaFunil.length < porSemana && (restam.Topo + restam.Meio + restam.Fundo) > 0) {
      for (const f of ["Topo", "Meio", "Fundo"]) if (restam[f] > 0 && sequenciaFunil.length < porSemana) { sequenciaFunil.push(f); restam[f]--; }
    }
    while (sequenciaFunil.length < porSemana) sequenciaFunil.push("Meio");
    const formatos = r.formatos && r.formatos.length ? r.formatos : ["Reels"];
    const pilares = (st.perfil.pilares || []).map((x) => x.nome).filter(Boolean);
    const uso = new Map(pilares.map((n) => [n, st.posts.filter((p) => p.pilar === n).length]));
    const usoForm = new Map(formatos.map((f) => [f, st.posts.filter((p) => p.formato === f).length]));
    const slots = [];
    const semanas = semanasDoMes();
    for (const sem of semanas) {
      // dias do ritmo desta semana dentro do mês, a partir de amanhã
      const daSemana = dias.map((k) => sem[k]).filter((d) => d.getMonth() === m - 1 && d.getDate() >= inicio).slice(0, porSemana);
      const jaNaSemana = st.posts.filter((p) => p.data && sem.some((d) => iso(d) === p.data));
      const funisUsados = jaNaSemana.map((p) => p.funil);
      const faltam = sequenciaFunil.slice();
      funisUsados.forEach((f) => { const i = faltam.indexOf(f); if (i >= 0) faltam.splice(i, 1); });
      const livres = daSemana.filter((d) => !ocupados.has(iso(d))).slice(0, Math.max(0, porSemana - jaNaSemana.length));
      livres.forEach((d, i) => {
        const pilar = pilares.slice().sort((x, y) => uso.get(x) - uso.get(y) || pilares.indexOf(x) - pilares.indexOf(y))[0] || "";
        if (pilar) uso.set(pilar, uso.get(pilar) + 1);
        const formato = formatos.slice().sort((x, y) => usoForm.get(x) - usoForm.get(y))[0];
        usoForm.set(formato, usoForm.get(formato) + 1);
        slots.push({ data: iso(d), horario: r.horario || "12h", pilar, funil: faltam[i] || "Meio", formato });
      });
      if (modo === "semana" && slots.length) break;
    }
    return slots;
  }
  // posts das pastas que ainda não viraram ideia neste mês
  function referenciasLivres() {
    const { gravar, assim } = pastasDoMes();
    const usados = new Set(st.posts.map((p) => p.inspiracao && p.inspiracao.link).filter(Boolean));
    return [...gravar, ...assim].filter((p) => !usados.has(p.link));
  }
  async function chamarIdeias(corpo) {
    for (let t = 0; t < 4; t++) {
      const { data, error } = await banco().functions.invoke("painel-conteudo", { body: corpo });
      let msg = data && data.error, limite = data && data.limite;
      if (error) { try { const j = await error.context.json(); msg = j.error; limite = j.limite; } catch (e) { /* segue */ } msg = msg || "A função não respondeu agora."; }
      if (limite) { toast("Esperando 1 minuto pelo limite grátis da IA… pode continuar usando o painel."); await espera(62000); continue; }
      if (msg) throw new Error(msg);
      return data.ideias || [];
    }
    throw new Error("A IA está sem limite agora. Tente de novo daqui a alguns minutos.");
  }
  // monta a grade no ritmo dela: cada espaço (dia + pilar + funil + formato) vira uma ideia com roteiro.
  // Se houver posts nas pastas, cada espaço usa um como referência (com o link), até acabarem.
  async function gerar(modo, notas) {
    if (st.gerando) return;
    const slots = planejarSlots(modo);
    if (!slots.length) { toast(`A grade de ${rotuloMes(st.mes)} já está cheia no seu ritmo. Aumente os posts por semana no seu perfil ou escolha outro mês.`, true); return; }
    const refs = referenciasLivres();
    st.gerando = true; st.progresso = `0 de ${slots.length}`; pintar();
    let feitas = 0;
    const base = { acao: "ideias", rotulo: rotuloMes(st.mes), notas };
    try {
      for (let k = 0; k < slots.length; k += 3) {
        const lote = slots.slice(k, k + 3);
        const loteRefs = refs.splice(0, lote.length);
        const comRef = loteRefs.length === lote.length;
        const ideias = await chamarIdeias({ ...base, quantidade: lote.length, evitar: st.posts.map((p) => p.tema),
          slots: lote.map((x) => ({ pilar: x.pilar, funil: x.funil, formato: x.formato })),
          umaPorReferencia: comRef, inspiracoes: comRef ? loteRefs.map((p) => ({ perfil: p.perfil, tipo: p.tipo, colecao: p.colecao, legenda: p.legenda, transcricao: p.transcricao })) : [] });
        for (const [n, x] of ideias.entries()) {
          const sl = lote[n]; if (!sl) break;
          const r = comRef ? loteRefs[n] : null;
          await salvar({ data: sl.data, horario: sl.horario, pilar: sl.pilar || x.pilar || null, formato: sl.formato, funil: sl.funil, tema: x.tema, tipo_ugc: x.tipo_ugc, proposito: x.proposito, hook: x.hook, ganchos: x.ganchos, desenvolvimento: x.desenvolvimento, cta: x.cta, tipo_roteiro: x.tipo_roteiro, legenda: x.legenda, porque: x.porque, status: "Roteirizado",
            inspiracao: r ? { link: r.link, perfil: r.perfil ? "@" + r.perfil : x.inspirado_em, colecao: r.colecao, legenda: String(r.legenda || "").split("\n")[0].slice(0, 160), duracao_seg: x.duracao_seg } : { perfil: x.inspirado_em, duracao_seg: x.duracao_seg } });
          feitas++;
        }
        st.progresso = `${feitas} de ${slots.length}`;
        pintar();
      }
      toast(`${feitas} post${feitas === 1 ? "" : "s"} com roteiro na grade de ${rotuloMes(st.mes)}.`);
    } catch (e) { toast(e.message, true); }
    st.gerando = false;
    const prim = st.posts.filter((p) => p.data && p.data >= iso(hoje)).map((p) => p.data).sort()[0] || st.posts.filter((p) => p.data).map((p) => p.data).sort()[0];
    if (prim) st.semana = semanaDe(prim);
    pintar();
  }

  // refaz um post no mesmo lugar (dia, pilar, funil, formato) com o ajuste que ela escreveu
  async function refazer(p, ajuste) {
    const notas = `REFAZER UM POST. Ajuste pedido: ${ajuste || "uma versão melhor, mais no meu tom"}. Versão anterior (não repita igual): tema "${p.tema || ""}", hook "${p.hook || ""}".`;
    const ideias = await chamarIdeias({ acao: "ideias", rotulo: rotuloMes(st.mes), notas, quantidade: 1, evitar: st.posts.filter((x) => x.id !== p.id).map((x) => x.tema),
      slots: [{ pilar: p.pilar || "", funil: p.funil || "Meio", formato: p.formato || "Reels" }] });
    const x = ideias[0];
    if (!x) throw new Error("A IA não devolveu a nova versão. Tente de novo.");
    return salvar({ id: p.id, tema: x.tema, tipo_ugc: x.tipo_ugc, proposito: x.proposito, hook: x.hook, ganchos: x.ganchos, desenvolvimento: x.desenvolvimento, cta: x.cta, tipo_roteiro: x.tipo_roteiro, legenda: x.legenda, porque: x.porque, status: "Roteirizado" });
  }

  // ---------- meu perfil de conteúdo ----------
  async function salvarPerfil(perfil) {
    const { error } = await banco().from("configuracoes").upsert({ chave: "perfil_conteudo", valor: JSON.stringify(perfil), updated_at: new Date().toISOString() }, { onConflict: "chave" });
    if (error) throw new Error(error.message);
    st.perfil = perfil;
  }
  function pintarPerfil() {
    const box = $("#pc-perfil"); if (!box) return;
    const p = st.perfil, r = p.ritmo || PERFIL_PADRAO.ritmo;
    // só redesenha quando o perfil muda (não apaga o que ela está digitando)
    const assinatura = JSON.stringify(p);
    if (box.dataset.v === assinatura) return;
    box.dataset.v = assinatura;
    const aberto = box.querySelector("details") ? box.querySelector("details").open : false;
    const pil = (p.pilares || []).map((x) => x.nome + (x.descricao ? ": " + x.descricao : "")).join("\n");
    const chk = (nome, valor, marcado, rot) => `<label class="pc-chk"><input type="checkbox" name="${nome}" value="${valor}" ${marcado ? "checked" : ""}>${rot}</label>`;
    box.innerHTML = `<details ${aberto ? "open" : ""}><summary class="pc-perfil-cab"><span class="pc-h3">${ic.brilho}Meu perfil de <em>conteúdo</em></span>
        <span class="pc-perfil-resumo">${esc(r.porSemana)} posts por semana · ${esc((r.dias || []).map((d) => DIAS[d]).join(", "))} · ${esc((r.formatos || []).join(" ou "))} · ${["Topo", "Meio", "Fundo"].filter((f) => Number(r.funil[f]) > 0).map((f) => `${r.funil[f]} ${f.toLowerCase()}`).join(" + ")} · ${(p.pilares || []).length} pilares</span></summary>
      <form class="pc-perfil-form" id="pc-perfil-form">
        <p class="pc-ajuda">Tudo o que a IA lê antes de montar a grade. Quanto mais específico, menos genérico sai.</p>
        <div class="pc-grade2">
          <label class="campo"><span>Quem eu sou</span><textarea name="quem" rows="3">${esc(p.quem)}</textarea></label>
          <label class="campo"><span>Objetivo do perfil</span><textarea name="objetivo" rows="3">${esc(p.objetivo)}</textarea></label>
        </div>
        <label class="campo"><span>Pilares (um por linha: Nome: do que fala)</span><textarea name="pilares" rows="5">${esc(pil)}</textarea></label>
        <div class="pc-grade2">
          <label class="campo"><span>Tom de voz</span><textarea name="tom" rows="3">${esc(p.tom)}</textarea></label>
          <label class="campo"><span>Nunca usar</span><textarea name="evitar" rows="3">${esc(p.evitar)}</textarea></label>
        </div>
        <div class="pc-ritmo">
          <label class="campo"><span>Posts por semana</span><input type="number" name="porSemana" min="1" max="14" value="${esc(r.porSemana)}"></label>
          <label class="campo"><span>Horário</span><input name="horario" value="${esc(r.horario || "12h")}"></label>
          <div class="campo"><span>Dias de postar</span><div class="pc-chks">${DIAS.map((d, k) => chk("dias", k, (r.dias || []).includes(k), d)).join("")}</div></div>
          <div class="campo"><span>Formatos</span><div class="pc-chks">${FORMATOS.map((f) => chk("formatos", f, (r.formatos || []).includes(f), f)).join("")}</div></div>
          <div class="campo"><span>Por semana: topo · meio · fundo</span><div class="pc-chks">${FUNIS.map((f) => `<label class="pc-num">${f}<input type="number" name="funil_${f}" min="0" max="14" value="${esc(r.funil[f] || 0)}"></label>`).join("")}</div></div>
        </div>
        <div class="pc-linha"><button class="btn btn-principal" type="submit">Salvar meu perfil</button><button class="login-link" type="button" id="pc-perfil-padrao">voltar ao padrão</button></div>
      </form></details>`;
    $("#pc-perfil-form", box).addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, v = (n) => f.elements[n].value.trim();
      const marcados = (n) => [...f.querySelectorAll(`[name=${n}]:checked`)].map((x) => x.value);
      const pilares = v("pilares").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(":"); return i > 0 ? { nome: l.slice(0, i).trim(), descricao: l.slice(i + 1).trim() } : { nome: l, descricao: "" }; });
      const funil = Object.fromEntries(FUNIS.map((x) => [x, Math.max(0, Number(v("funil_" + x)) || 0)]));
      const dias = marcados("dias").map(Number);
      const porSemana = Math.max(1, Number(v("porSemana")) || 3);
      if (!pilares.length) { toast("Coloque pelo menos um pilar.", true); return; }
      if (!dias.length) { toast("Marque os dias em que você quer postar.", true); return; }
      if (dias.length < porSemana) { toast(`Você marcou ${dias.length} dia${dias.length === 1 ? "" : "s"} para ${porSemana} posts por semana. Marque mais dias.`, true); return; }
      const somaFunil = funil.Topo + funil.Meio + funil.Fundo;
      if (somaFunil !== porSemana) { toast(`Topo + meio + fundo somam ${somaFunil}, mas são ${porSemana} posts por semana. Ajuste para bater.`, true); return; }
      const novo = { quem: v("quem"), objetivo: v("objetivo"), pilares, tom: v("tom"), evitar: v("evitar"),
        ritmo: { porSemana, dias, horario: v("horario") || "12h", formatos: marcados("formatos").length ? marcados("formatos") : ["Reels"], funil } };
      try { await salvarPerfil(novo); pintar(); toast("Perfil salvo. A próxima grade já sai com ele."); } catch (er) { toast("Não consegui salvar: " + er.message, true); }
    });
    $("#pc-perfil-padrao", box).addEventListener("click", async () => { if (!confirm("Voltar o perfil para o padrão?")) return; try { await salvarPerfil(PERFIL_PADRAO); pintar(); toast("Perfil voltou ao padrão."); } catch (er) { toast(er.message, true); } });
  }

  // ---------- arquivo das pastas (salvos_instagram.json do programa) ----------
  async function importarArquivo(arq) {
    let j;
    try { j = JSON.parse(await arq.text()); } catch (e) { toast("Esse arquivo não é o salvos_instagram.json do programa.", true); return; }
    const lista = Array.isArray(j && j.salvos) ? j.salvos : [];
    if (!lista.length) { toast("O arquivo veio sem salvos. Rode o programa de novo.", true); return; }
    const comPasta = lista.filter((x) => x.colecao);
    const { data: existentes } = await banco().from("laboratorio").select("id,link,colecao").limit(5000);
    const porLink = new Map((existentes || []).map((r) => [r.link, r]));
    const novos = [];
    for (const x of lista) {
      const m = String(x.link || "").match(/instagram\.com\/(p|reel|reels|tv)\/([\w-]+)/i);
      if (!m) continue;
      const link = `https://www.instagram.com/${m[1].toLowerCase() === "p" ? "p" : "reel"}/${m[2]}/`;
      const ja = porLink.get(link);
      if (ja) { if (x.colecao && ja.colecao !== x.colecao) await banco().from("laboratorio").update({ colecao: x.colecao }).eq("id", ja.id); continue; }
      novos.push({ link, codigo: m[2], perfil: x.perfil || null, tipo: ["Reel", "Carrossel", "Post"].includes(x.tipo) ? x.tipo : null, legenda: x.legenda || null, colecao: x.colecao || null, status: "novo", etapa: "Nova" });
    }
    for (let k = 0; k < novos.length; k += 200) {
      const { error } = await banco().from("laboratorio").upsert(novos.slice(k, k + 200), { onConflict: "link", ignoreDuplicates: true });
      if (error) { toast("Não consegui salvar: " + error.message, true); return; }
    }
    await carregar(); pintar();
    const pastas = [...new Set(comPasta.map((x) => x.colecao))];
    toast(`${lista.length} salvos lidos${pastas.length ? `, pastas: ${pastas.join(", ")}` : ""}.`);
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
    sino: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></svg>',
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
        <div class="pc-cal-cab">
          <div><h3 class="pc-cal-tit">Calendário de <span id="pc-nsem"></span> semanas</h3>
            <p class="pc-ajuda">Arraste um post para outro dia para mudar a data. No celular, abra o post e troque a data. O + em cada dia cria uma pauta para ele.</p></div>
          <div class="pc-cal-nav"><button class="icone-btn" type="button" id="pc-ant" aria-label="Mês anterior">${ic.esq}</button><button class="icone-btn" type="button" id="pc-prox" aria-label="Próximo mês">${ic.dir}</button><button class="btn pc-btn-hoje" type="button" id="pc-hoje">Esta semana</button><span id="pc-semana-rot"></span></div>
        </div>
        <div class="pc-legenda" id="pc-legenda"></div>
        <div class="pc-cal" id="pc-quadro"></div>
        <div class="pc-banco" id="pc-banco"></div>
      </div>
      <button type="button" class="btn pc-config-btn" id="pc-config-btn" aria-expanded="false"></button>
      <div id="pc-config" hidden>
      <section class="pc-cartao pc-perfil" id="pc-perfil"></section>
      <div class="pc-baixo">
        <section class="pc-cartao pc-gerar">
          <h3 class="pc-h3">Gerar a grade no meu ritmo</h3>
          <p class="pc-ajuda" id="pc-gerar-ajuda"></p>
          <textarea class="entrada" id="pc-notas" rows="2" placeholder="Algum pedido? Ex.: foco em maternidade, uma publi de cabelo, conteúdo para atrair marcas de casa..."></textarea>
          <div class="pc-linha"><select class="entrada" id="pc-qtd" aria-label="Quanto gerar"><option value="mes" selected>Mês completo</option><option value="semana">Só a próxima semana</option></select>
            <button class="btn btn-principal" type="button" id="pc-gerar"></button></div>
        </section>
        <section class="pc-cartao" id="pc-pastas"></section>
        <section class="pc-cartao pc-iphone" id="pc-iphone"></section>
      </div>
      </div>
    </div>`;
    const cfgBtn = $("#pc-config-btn", sec), cfgBox = $("#pc-config", sec);
    const mostrarCfg = (abre) => { cfgBox.hidden = !abre; cfgBtn.setAttribute("aria-expanded", String(abre)); cfgBtn.innerHTML = abre ? `${ic.x}Fechar configurações` : `${ic.brilho}Configurar e gerar ideias <small>meu perfil, gerar a grade, pastas do Instagram e iPhone</small>`; try { localStorage.setItem("pc-config", abre ? "1" : "0"); } catch (e) { /* sem armazenamento */ } };
    let abreCfg = false; try { abreCfg = localStorage.getItem("pc-config") === "1"; } catch (e) { /* sem armazenamento */ }
    mostrarCfg(abreCfg);
    cfgBtn.addEventListener("click", () => mostrarCfg(cfgBox.hidden));
    const sel = $("#pc-mes", sec);
    sel.addEventListener("change", async () => { st.mes = sel.value; st.semana = 0; await carregar(); ajustarSemana(); pintar(); });
    const trocarMes = async (k) => { const [a, m] = st.mes.split("-").map(Number); const d = new Date(a, m - 1 + k, 1); st.mes = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; await carregar(); ajustarSemana(); pintar(); };
    $("#pc-ant", sec).addEventListener("click", () => trocarMes(-1));
    $("#pc-prox", sec).addEventListener("click", () => trocarMes(1));
    $("#pc-hoje", sec).addEventListener("click", async () => {
      const atual = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`;
      if (st.mes !== atual) { st.mes = atual; await carregar(); pintar(); }
      ajustarSemana(); const alvo = $("#pc-sem-" + st.semana, sec); if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#pc-qtd", sec).addEventListener("change", pintar);
    $("#pc-gerar", sec).addEventListener("click", () => gerar($("#pc-qtd", sec).value, $("#pc-notas", sec).value.trim()));
  }
  function ajustarSemana() {
    const [a, m] = st.mes.split("-").map(Number);
    st.semana = a === hoje.getFullYear() && m === hoje.getMonth() + 1 ? semanaDe(iso(hoje)) : 0;
  }

  // cor do cartão pelo pilar (na paleta dela); Stories aparecem como texto no dia, como na referência
  const CORES_PIL = 6;
  const indicePilar = (nome) => { const i = (st.perfil.pilares || []).findIndex((x) => x.nome === nome); return i < 0 ? -1 : i % CORES_PIL; };
  const funilIc = '<svg class="traco pc-funil" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M7 10h10M10 15h4M11.5 19.5h1"/></svg>';
  function cartaoPost(p) {
    const status = p.status === "Ideia" ? "ideia" : p.status === "Roteirizado" ? "roteiro ✓" : String(p.status || "").toLowerCase() + " ✓";
    if ((p.formato || "") === "Stories") return `<button type="button" class="pc-story" data-id="${p.id}"><b>Stories:</b> ${esc(p.tema || "sem tema")}<span>${esc(status)}</span></button>`;
    const i = indicePilar(p.pilar);
    return `<button type="button" class="pc-post pil-${i < 0 ? "x" : i}" data-id="${p.id}" title="${esc([p.pilar, p.tipo_roteiro].filter(Boolean).join(" · "))}">
      <small>${funilIc}${esc([(p.funil || "").toUpperCase(), (p.formato || "Reels").toUpperCase()].filter(Boolean).join(" · "))}</small>
      <b>${esc(p.tema || "Sem tema")}</b>
      <span>${esc(p.horario || "")}${p.horario ? " · " : ""}${esc(status)}${p.tipo_roteiro === "Spec ad" ? " · spec ad" : p.tipo_roteiro === "Vitrine para marca" ? " · vitrine" : ""}</span>
    </button>`;
  }
  async function salvarTema(seg, texto) {
    st.temas = { ...(st.temas || {}) }; if (texto) st.temas[seg] = texto; else delete st.temas[seg];
    const { error } = await banco().from("configuracoes").upsert({ chave: "temas_semana", valor: JSON.stringify(st.temas), updated_at: new Date().toISOString() }, { onConflict: "chave" });
    if (error) toast(error.message, true);
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
    const nomesPil = (st.perfil.pilares || []).map((x) => x.nome);
    const contaPil = nomesPil.map((n) => `${esc(n)} <b>${doMes.filter((p) => p.pilar === n).length}</b>`).join(" · ");
    const contaFun = FUNIS.map((f) => `${f} <b>${doMes.filter((p) => p.funil === f).length}</b>`).join(" · ");
    $("#pc-numeros", sec).innerHTML = `<div><b>${doMes.length}</b><span>posts no mês</span></div><div><b>${formatos}</b><span>formatos em teste</span></div><div><b>${rot} de ${doMes.length}</b><span>roteirizados</span></div>
      <p class="pc-mix">Pilares: ${contaPil || "defina no seu perfil"}<br>Funil: ${contaFun}</p>`;
    const semanas = semanasDoMes(); st.semana = Math.min(st.semana, semanas.length - 1);
    const mesNum = Number(st.mes.split("-")[1]) - 1, br = (d) => `${d.getDate()}/${pad(d.getMonth() + 1)}`;
    $("#pc-nsem", sec).textContent = semanas.length;
    $("#pc-semana-rot", sec).textContent = `${br(semanas[0][0])} a ${br(semanas[semanas.length - 1][6])}`;
    $("#pc-legenda", sec).innerHTML = (st.perfil.pilares || []).map((x, i) => `<span><i class="pil-${i % CORES_PIL}"></i>${esc(x.nome)}</span>`).join("") + `<span><i class="pil-st"></i>Stories (texto no dia)</span><span><i class="pil-publi"></i>Publis e compromissos</span>`;
    $("#pc-quadro", sec).innerHTML = semanas.map((sem, n) => {
      const seg = iso(sem[0]), daSemana = doMes.filter((p) => p.data && p.data >= seg && p.data <= iso(sem[6]));
      const fun = FUNIS.map((f) => `<span class="pc-fun" title="${f}">${funilIc}${f} ${daSemana.filter((p) => p.funil === f).length}</span>`).join("");
      const tema = (st.temas || {})[seg];
      return `<section class="pc-sem${sem.some((d) => iso(d) === iso(hoje)) ? " atual" : ""}" id="pc-sem-${n}">
        <div class="pc-sem-cab"><b>Semana ${n + 1}</b><small>${br(sem[0])} a ${br(sem[6])}</small><span class="pc-chip">${daSemana.length} POST${daSemana.length === 1 ? "" : "S"}</span>${fun}
          <button type="button" class="pc-tema${tema ? " tem" : ""}" data-tema="${seg}" title="Tema da semana (toque para mudar)">${tema ? esc(tema) : "+ tema da semana"}</button></div>
        <div class="pc-quadro">${sem.map((d, k) => {
          const s2 = iso(d), fora = d.getMonth() !== mesNum, eHoje = s2 === iso(hoje);
          const lista = doMes.filter((p) => p.data === s2);
          return `<div class="pc-dia${fora ? " fora" : ""}${eHoje ? " hoje" : ""}" data-dia="${s2}">
            <div class="pc-dia-cab"><span>${DIAS[k]}</span><b>${d.getDate()}</b>${fora ? "" : `<button type="button" class="pc-add" data-novo="${s2}" aria-label="Novo post em ${d.getDate()}/${pad(d.getMonth() + 1)}">${ic.mais}</button>`}</div>
            ${lista.map(cartaoPost).join("")}
            ${(st.agenda || []).filter((x) => x.data === s2).map((x) => `<button type="button" class="pc-agenda ${x.tipo}" ${x.ir ? `data-ir="${x.ir}"` : ""} title="${x.ir === "campanhas" ? "Abrir em UGC's & Publis" : ""}"><small>${esc(x.rotulo)}</small>${esc(x.texto)}</button>`).join("")}
          </div>`;
        }).join("")}</div>
      </section>`;
    }).join("");
    $$("[data-ir]", sec).forEach((b) => b.addEventListener("click", () => { location.hash = "#" + b.dataset.ir; }));
    $$("[data-tema]", sec).forEach((b) => b.addEventListener("click", async () => {
      const atual = (st.temas || {})[b.dataset.tema] || "";
      const novo = prompt("Tema desta semana (ex.: Black Friday para marcas). Deixe vazio para tirar.", atual);
      if (novo === null) return; await salvarTema(b.dataset.tema, novo.trim()); pintar();
    }));
    const semData = doMes.filter((p) => !p.data);
    $("#pc-banco", sec).innerHTML = semData.length ? `<div class="pc-banco-cab">Banco de ideias <small>${semData.length} sem dia</small></div><div class="pc-banco-lista">${semData.map(cartaoPost).join("")}</div>` : "";
    $$("[data-id]", sec).forEach((b) => b.addEventListener("click", () => abrir(st.posts.find((p) => String(p.id) === b.dataset.id))));
    $$("[data-novo]", sec).forEach((b) => b.addEventListener("click", () => abrir({ data: b.dataset.novo, horario: "12h", formato: "Reels", status: "Ideia", funil: "Topo" })));
    // arrastar um post para outro dia
    $$(".pc-post, .pc-story", sec).forEach((b) => { b.draggable = true; b.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", b.dataset.id)); });
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
    const livres = referenciasLivres().length;
    const espacos = planejarSlots($("#pc-qtd", sec).value).length;
    bt.disabled = st.gerando; bt.innerHTML = st.gerando ? `Montando a grade… ${esc(st.progresso || "")}` : espacos ? `${ic.brilho}Gerar ${espacos} post${espacos === 1 ? "" : "s"}` : `${ic.brilho}Grade cheia`;
    const r = st.perfil.ritmo || PERFIL_PADRAO.ritmo;
    $("#pc-gerar-ajuda", sec).textContent = `No seu ritmo (${r.porSemana} por semana, ${(r.dias || []).map((d) => DIAS[d]).join(", ")}), cada espaço livre ganha um pilar em rodízio, o funil da semana e o formato, e a IA escreve o roteiro no seu tom pelo método da Lara (hook, desenvolvimento com direção de cena, CTA e legenda).${livres ? ` ${livres} post${livres === 1 ? "" : "s"} das suas pastas entram como referência, com o link, sem copiar as falas.` : ""}`;
    pintarPerfil();
    pintarPastas();
    pintarIphone();
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
      ${!gravar.length && !assim.length ? `<div class="pc-passos"><p class="pc-ajuda">Está em 0 porque o Instagram não deixa nenhum site ler suas pastas de salvos sozinho. Tem dois jeitos de trazer: pelo iPhone (cartão abaixo, cada post que você salvar) ou tudo de uma vez pelo computador.</p><p class="pc-ajuda"><b>Trazer as pastas inteiras (no Windows):</b></p>
        <ol class="pc-ajuda"><li>Aperte a tecla <b>Windows</b>, digite <b>PowerShell</b> e abra.</li><li>Cole a linha abaixo e aperte <b>Enter</b>. Se abrir a Microsoft Store pedindo o Python, instale e rode a linha de novo.</li><li>Ele entra pelo Instagram que já está aberto no seu navegador (sem senha) e grava <b>salvos_instagram.json</b> na Área de Trabalho.</li><li>Envie esse arquivo no botão abaixo.</li></ol>
        <div class="lab-comando"><code id="pc-cmd">${CMD_WIN}</code><button class="btn" type="button" id="pc-copiar">Copiar</button></div></div>` : ""}
      <label class="btn pc-enviar">${ic.pasta}Enviar arquivo das pastas<input type="file" id="pc-arquivo" accept=".json" hidden></label>
      ${outras.length ? `<p class="pc-ajuda">Outras pastas que chegaram: ${outras.map(esc).join(", ")}.</p>` : ""}`;
    const t = $("#pc-transcrever", box); if (t) t.addEventListener("click", transcreverPastas);
    const c = $("#pc-copiar", box); if (c) c.addEventListener("click", async () => { try { await navigator.clipboard.writeText(CMD_WIN); toast("Copiado. Cole no PowerShell."); } catch (e) { toast("Selecione a linha e copie com Ctrl+C.", true); } });
    $("#pc-arquivo", box).addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) importarArquivo(f); });
  }

  // ---------- iPhone: salvar pelo atalho e receber a ideia por notificação (app ntfy) ----------
  const LINK_SALVAR = "https://marianabonetto.com.br/admin/salvar/?l=";
  async function ligarNotificacoes() {
    const letras = "abcdefghijkmnpqrstuvwxyz23456789";
    const aleat = [...crypto.getRandomValues(new Uint8Array(18))].map((n) => letras[n % letras.length]).join("");
    const topico = "mari-painel-" + aleat;
    const { error } = await banco().from("configuracoes").upsert({ chave: "ntfy_topico", valor: topico, updated_at: new Date().toISOString() }, { onConflict: "chave" });
    if (error) { toast("Não consegui ligar: " + error.message, true); return; }
    st.topico = topico; pintarIphone();
  }
  async function testarNotificacao(bt) {
    bt.disabled = true;
    const { data, error } = await banco().functions.invoke("painel-conteudo", { body: { acao: "notif_teste" } });
    let msg = data && data.error;
    if (error) { try { msg = (await error.context.json()).error; } catch (e) { msg = "A função não respondeu agora."; } }
    bt.disabled = false;
    toast(msg || "Mandei! Olhe o iPhone.", Boolean(msg));
  }
  function pintarIphone() {
    const box = $("#pc-iphone"); if (!box) return;
    const copiar = (id, texto, aviso) => { const b = $(id, box); if (b) b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(texto); toast(aviso); } catch (e) { toast("Selecione e copie com Ctrl+C.", true); } }); };
    box.innerHTML = `<h3 class="pc-h3">${ic.sino}No iPhone: salvou, chegou a ideia</h3>
      <p class="pc-ajuda">O Instagram não avisa ninguém quando você salva um post. Então, no iPhone, você manda o post para o painel pelo botão de compartilhar: eu guardo na pasta, crio a ideia com roteiro nesta grade e te mando uma notificação com o hook e o CTA.</p>
      <p class="pc-ajuda">A notificação chega no painel instalado na Tela de Início (ative em <a href="#notificacoes">Geral > Notificações no celular</a>). O app ntfy abaixo é opcional, uma reserva.</p>
      ${st.topico ? `<details class="pc-passos" open><summary><b>1. Notificações (uma vez)</b></summary><ol class="pc-ajuda">
          <li>Instale o app grátis <b>ntfy</b> na App Store.</li>
          <li>Abra, toque em <b>+</b> e cole este nome em <b>Topic</b> (deixe o servidor como está): <span class="lab-comando"><code>${esc(st.topico)}</code><button class="btn" type="button" id="pc-copiar-topico">Copiar</button></span></li>
          <li>Permita as notificações e toque em <button class="btn" type="button" id="pc-testar">Mandar teste</button></li></ol>
          <p class="pc-ajuda">Esse nome é o endereço secreto das suas notificações. Não mostre para ninguém. Se vazar, toque em <button class="login-link" type="button" id="pc-novo-topico">trocar o endereço</button>.</p></details>
        <details class="pc-passos"><summary><b>2. Atalho "Salvar no painel" (uma vez)</b></summary><ol class="pc-ajuda">
          <li>Abra o app <b>Atalhos</b>, toque em <b>+</b> e dê o nome <b>Salvar no painel</b>.</li>
          <li>Toque no ⓘ (ou na setinha do nome) e ligue <b>Mostrar na Folha de Compartilhamento</b>. Em tipos, deixe só <b>URLs</b>.</li>
          <li>Adicione a ação <b>Codificar URL</b> (ela usa a Entrada do Atalho).</li>
          <li>Adicione a ação <b>Abrir URLs</b> e escreva este endereço, colocando no fim a variável <b>URL Codificada</b>: <span class="lab-comando"><code>${LINK_SALVAR}</code><button class="btn" type="button" id="pc-copiar-link">Copiar</button></span></li>
          <li>Na primeira vez a página pede seu e-mail e senha do painel. Depois fica salvo.</li></ol></details>
        <details class="pc-passos"><summary><b>3. No dia a dia</b></summary><ol class="pc-ajuda">
          <li>No Instagram, salve o post na pasta como sempre.</li>
          <li>Toque no aviãozinho de compartilhar, depois em <b>Compartilhar em…</b> (ou <b>Mais</b>) e escolha <b>Salvar no painel</b>.</li>
          <li>Toque na pasta. Em 1 ou 2 minutos chega a notificação com a ideia. Tocando nela, abre este painel.</li></ol>
          <p class="pc-ajuda">Sem o atalho também dá: copie o link do post e abra <a href="../admin/salvar/" target="_blank" rel="noopener">marianabonetto.com.br/admin/salvar</a> (dá para pôr na Tela de Início).</p></details>`
        : `<button class="btn btn-principal" type="button" id="pc-ligar">Ligar as notificações no iPhone</button>`}`;
    const l = $("#pc-ligar", box); if (l) l.addEventListener("click", ligarNotificacoes);
    const t = $("#pc-testar", box); if (t) t.addEventListener("click", () => testarNotificacao(t));
    const n = $("#pc-novo-topico", box); if (n) n.addEventListener("click", () => { if (confirm("Trocar o endereço? Depois você assina o novo no app ntfy.")) ligarNotificacoes(); });
    copiar("#pc-copiar-topico", st.topico, "Copiado. Cole no app ntfy.");
    copiar("#pc-copiar-link", LINK_SALVAR, "Copiado. Cole na ação Abrir URLs.");
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
        ${insp.link ? `<div class="pc-ref"><small>Referência</small><a href="${esc(insp.link)}" target="_blank" rel="noopener">${esc(insp.perfil || "Abrir o post")} · abrir no Instagram</a>${insp.legenda ? `<span>${esc(insp.legenda)}</span>` : ""}${insp.colecao ? `<em>pasta ${esc(insp.colecao)}</em>` : ""}</div>` : ""}
        <label class="campo pc-largo"><span>Tema</span><input name="tema" value="${esc(p.tema)}"></label>
        <div class="pc-grade4">
          <label class="campo"><span>Dia</span><input type="date" name="data" value="${esc(p.data || "")}"></label>
          <label class="campo"><span>Horário</span><input name="horario" value="${esc(p.horario || "")}" placeholder="12h"></label>
          <label class="campo"><span>Formato</span><select name="formato">${opt(FORMATOS, p.formato)}</select></label>
          <label class="campo"><span>Status</span><select name="status">${opt(STATUS, p.status)}</select></label>
        </div>
        <div class="pc-grade2">
          <label class="campo"><span>Pilar</span><select name="pilar"><option value=""></option>${opt([...new Set([...(st.perfil.pilares || []).map((x) => x.nome), ...(p.pilar ? [p.pilar] : [])])], p.pilar)}</select></label>
          ${p.id ? `<div class="campo"><span>Não gostou? Refazer com ajuste</span><div class="pc-linha"><input class="entrada" id="pc-ajuste" placeholder="Ex.: mais leve, troca por produto de casa"><button class="btn" type="button" data-refazer>Refazer</button></div></div>` : ""}
        </div>
        <div class="pc-grade3">
          <label class="campo"><span>Tipo de roteiro</span><select name="tipo_roteiro"><option value=""></option>${opt(ROTEIROS, p.tipo_roteiro)}</select></label>
          <label class="campo"><span>Tipo de UGC</span><select name="tipo_ugc"><option value=""></option>${opt(tipos, p.tipo_ugc)}</select></label>
          <label class="campo"><span>Funil</span><select name="funil">${opt(FUNIS, p.funil)}</select></label>
        </div>
        ${p.porque ? `<div class="pc-porque"><small>Por que atrai marca</small>${esc(p.porque)}</div>` : ""}
        <label class="campo pc-largo"><span>Propósito</span><input name="proposito" value="${esc(p.proposito)}" placeholder="Para que serve esse conteúdo no seu perfil"></label>
        <label class="campo pc-largo"><span>Hook</span><textarea name="hook" rows="2">${esc(p.hook)}</textarea></label>
        ${ganchos.length ? `<div class="pc-ganchos"><small>Outras opções de gancho (toque para usar)</small>${ganchos.map((g) => `<button type="button" class="cr-chip" data-gancho>${esc(g)}</button>`).join("")}</div>` : ""}
        <label class="campo pc-largo"><span>Desenvolvimento do roteiro</span><textarea name="desenvolvimento" rows="9">${esc(p.desenvolvimento)}</textarea></label>
        <label class="campo pc-largo"><span>CTA</span><input name="cta" value="${esc(p.cta)}"></label>
        <label class="campo pc-largo"><span>Legenda e hashtags</span><textarea name="legenda" rows="4">${esc(p.legenda)}</textarea></label>
        <label class="campo pc-largo"><span>Notas</span><textarea name="notas" rows="2">${esc(p.notas)}</textarea></label>
        ${insp.duracao_seg || (!insp.link && insp.perfil) ? `<p class="pc-ajuda">${!insp.link && insp.perfil ? `Inspirado em ${esc(insp.perfil)}. ` : ""}${insp.duracao_seg ? `Duração estimada: ${insp.duracao_seg}s.` : ""}</p>` : ""}
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
    const rf = $("[data-refazer]", dlg);
    if (rf) rf.addEventListener("click", async () => {
      rf.disabled = true; rf.textContent = "Refazendo…";
      try { const o = ler(); await salvar({ ...o, id: p.id }); const novo = await refazer({ ...p, ...o }, $("#pc-ajuste", dlg).value.trim()); pintar(); abrir(novo); toast("Nova versão pronta."); }
      catch (e) { toast(e.message, true); rf.disabled = false; rf.textContent = "Refazer"; }
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
      const conteudo = [o.proposito && "PROPÓSITO:\n" + o.proposito, o.hook && "HOOK:\n" + o.hook, o.desenvolvimento && "DESENVOLVIMENTO:\n" + o.desenvolvimento, o.cta && "CTA:\n" + o.cta, o.legenda && "LEGENDA:\n" + o.legenda, p.porque && "POR QUE ATRAI MARCA:\n" + p.porque, insp.link && "REFERÊNCIA:\n" + insp.link].filter(Boolean).join("\n\n");
      const ok = await window.painelRoteiros.salvarNoQuadro({ id: "pc" + p.id + "-" + Date.now().toString(36), titulo: o.tema || "Post do painel", plataforma: "Instagram", status: "Em aberto", finalidade: "Conteúdos", etapa: o.status === "Ideia" ? "Ideias" : "Roteirização", conteudo, gancho: o.hook || "", formato: o.formato || "", tipoUgc: o.tipo_ugc || "", funil: o.funil || "", referencia: insp.link || "", dataPublicacao: o.data || "" });
      if (ok) { await salvar({ ...o, id: p.id }); dlg.close(); pintar(); toast("Mandado para Meus roteiros."); }
    });
    // sininho "Importante, notificar" (js/lembretes.js) com o post certo
    if (p.id) { dlg.dataset.lembreteTipo = "post"; dlg.dataset.lembreteId = String(p.id); dlg.dataset.lembreteTitulo = (p.formato ? p.formato + ": " : "") + (p.tema || "Post do painel"); }
    else { delete dlg.dataset.lembreteId; delete dlg.dataset.lembreteTitulo; }
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
