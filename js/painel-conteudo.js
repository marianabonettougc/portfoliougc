// =========================================================
// CONTEÚDO > CONTEÚDOS (hash #planejar), reestruturado em out/2026 com as referências estilo Trello dela:
// quatro áreas sobre o MESMO registro de painel_conteudo (st.todos): Visão geral (indicadores, próximos,
// planejamento do mês, fluxo e plano da semana), Quadro de produção (colunas = status, arrastar muda o status),
// Calendário editorial (mensal e semanal, arrastar muda a data), Banco de ideias (status Ideia + pastas do Instagram)
// e Planejamento anual (nov/2026: narrativa, calendário do ano, temas, ideias, ritmo e 2 meses à frente).
// Ajustes e IA (perfil, gerar grade, pastas, iPhone) abre por botão. Status: STATUS (nomes antigos em STATUS_ANTIGO).
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
  // etapas do quadro de produção (out/2026); os nomes antigos continuam valendo (STATUS_ANTIGO)
  const STATUS = ["Ideia", "Roteirizado", "Para gravar", "Em edição", "Pronto", "Publicado"];
  const STATUS_ANTIGO = { Gravado: "Em edição", Editado: "Pronto", Postado: "Publicado", "Para postar": "Pronto", Agendado: "Pronto" };
  // cor de cada coluna do Quadro de produção (mesma paleta das colunas de UGC's & Publis, nov/2026)
  const COR_STATUS = { Ideia: "#d9a46a", Roteirizado: "#b98a5e", "Para gravar": "#c98f7a", "Em edição": "#6b4a35", Pronto: "#c9a24a", Publicado: "#4f7a54" };
  // Arquivado (nov/2026, pedido da Mari): conteúdo que não vai mais sair. Fica numa coluna fechada no fim do quadro
  // e some do calendário, da semana e dos números (st.todos só tem os ativos; os arquivados ficam em st.arquivados).
  const ARQ = "Arquivado";
  const COLUNAS = [...STATUS, ARQ];
  COR_STATUS[ARQ] = "#b8a593";
  const normStatus = (s) => s === ARQ ? ARQ : STATUS_ANTIGO[s] || (STATUS.includes(s) ? s : "Ideia");
  const nomeStatus = (x) => (x === "Ideia" ? "Sem roteiro" : x);
  // Meus roteiros dentro do Quadro (nov/2026): etapa do roteiro no aplicativo -> etapa do conteúdo
  const ETAPA_ROT = { Ideias: "Ideia", "Roteirização": "Roteirizado", "Revisão": "Roteirizado", "Em Aprovação": "Roteirizado", "Gravação": "Para gravar", "Edição": "Em edição", "Pronto para postar": "Pronto", Finalizado: "Publicado" };
  const NICHOS = ["Maternidade", "Autocuidado", "Beleza e cabelo", "Moda", "Bem-estar", "Achadinhos de casa e tech"];
  const TIPOS_CONTEUDO = ["Orgânico", "UGC", "Publi"];
  const PRODUZIR = ["Ideia", "Roteirizado", "Para gravar"];
  const FORMATOS = ["Reels", "Carrossel", "Foto", "Stories"];
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
  const hoje = new Date();
  // todos: todos os conteúdos (um registro por conteúdo, o mesmo em todas as visões); posts: só os do mês do calendário
  const st = { pronto: false, arquivados: [], roteiros: [], rotVistos: [], mes: `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`, semana: 0, todos: [], lab: [], faltaTabela: false, gerando: false, transcrevendo: false, perfil: PERFIL_PADRAO,
    cal: (() => { try { return localStorage.getItem("pc-calvista") || "5sem"; } catch (e) { return "5sem"; } })(), semIni: null, ini5: null, filtro: { q: "", nicho: "", formato: "", funil: "", tipo: "" }, ideiaFiltro: "" };
  const mesDe = (p) => (p.data ? String(p.data).slice(0, 7) : p.mes);
  Object.defineProperty(st, "posts", { get: () => st.todos.filter((p) => mesDe(p) === st.mes) });

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
      banco().from("painel_conteudo").select("*").order("data", { ascending: true, nullsFirst: false }).order("id").limit(3000),
      banco().from("laboratorio").select("id,link,codigo,perfil,tipo,legenda,transcricao,colecao,capa").not("colecao", "is", null).limit(1000),
    ]);
    if (a.error) { st.faltaTabela = true; st.todos = []; st.arquivados = []; } else {
      st.faltaTabela = false;
      const lista = (a.data || []).map((p) => ({ ...p, status: normStatus(p.status) }));
      st.todos = lista.filter((p) => p.status !== ARQ); st.arquivados = lista.filter((p) => p.status === ARQ);
    }
    st.lab = b.error ? [] : (b.data || []);
    try {
      const { data: ap } = await banco().from("app_state").select("data").limit(1).maybeSingle();
      st.agenda = montarAgenda((ap && ap.data) || {});
      st.roteiros = (ap && ap.data && Array.isArray(ap.data.roteiros)) ? ap.data.roteiros : [];
    } catch (e) { st.agenda = []; st.roteiros = []; }
    const c = await banco().from("configuracoes").select("chave,valor").in("chave", ["ntfy_topico", "perfil_conteudo", "temas_semana", "roteiros_no_quadro"]);
    const cfg = Object.fromEntries((c.data || []).map((x) => [x.chave, x.valor]));
    st.topico = cfg.ntfy_topico || "";
    try { st.temas = JSON.parse(cfg.temas_semana || "{}") || {}; } catch (e) { st.temas = {}; }
    try { st.rotVistos = JSON.parse(cfg.roteiros_no_quadro || "[]") || []; } catch (e) { st.rotVistos = []; }
    if (!st.faltaTabela) { try { await unirRoteiros(); } catch (e) { /* o quadro abre mesmo assim */ } }
    try { const p = JSON.parse(cfg.perfil_conteudo || ""); st.perfil = { ...PERFIL_PADRAO, ...p, ritmo: { ...PERFIL_PADRAO.ritmo, ...(p.ritmo || {}), funil: { ...PERFIL_PADRAO.ritmo.funil, ...((p.ritmo || {}).funil || {}) } } }; } catch (e) { st.perfil = PERFIL_PADRAO; }
  }
  // ---------- Meus roteiros dentro do Quadro de produção (nov/2026, pedido da Mari: "pode juntar") ----------
  // Os roteiros continuam guardados no aplicativo (app_state.roteiros, editor da Skill UGC), mas cada roteiro vira UM
  // cartão no Quadro: liga ao conteúdo de mesmo título (ou ao conteúdo de origem) ou cria o conteúdo, ligado por roteiro_id.
  // configuracoes "roteiros_no_quadro" guarda os ids já vistos: se ela excluir o cartão, o roteiro não volta sozinho.
  const roteiroDe = (p) => (p && p.roteiro_id ? (st.roteiros || []).find((r) => String(r.id) === String(p.roteiro_id)) : null);
  const acharConteudo = (id) => st.todos.find((x) => String(x.id) === String(id)) || (st.arquivados || []).find((x) => String(x.id) === String(id));
  async function unirRoteiros() {
    if (st.unindo) return; st.unindo = true;
    try {
      const rots = st.roteiros || [], todos = [...st.todos, ...(st.arquivados || [])];
      const vistos = new Set((st.rotVistos || []).map(String)), antes = vistos.size;
      todos.forEach((p) => { if (p.roteiro_id) vistos.add(String(p.roteiro_id)); });
      const ligados = new Set(todos.map((p) => String(p.roteiro_id || "")).filter(Boolean));
      for (const r of rots) {
        const rid = String(r.id || ""); if (!rid || ligados.has(rid)) continue;
        let alvo = null;
        if (r.origem && r.origem.tipo === "conteudo") alvo = todos.find((p) => !p.roteiro_id && String(p.id) === String(r.origem.id));
        const tit = semAcento(r.titulo).trim();
        if (!alvo && tit) alvo = todos.find((p) => !p.roteiro_id && semAcento(p.tema).trim() === tit);
        if (alvo) { await salvar({ id: alvo.id, roteiro_id: rid }); ligados.add(rid); vistos.add(rid); continue; }
        if (vistos.has(rid)) continue;
        const cli = String(r.cliente || "").trim(), t0 = String(r.titulo || "").trim();
        const generico = !t0 || /^(marca\s*\/\s*cliente:?|roteiro( do google docs)?|\d+ roteiros( do google docs)?)$/i.test(t0);
        const qtd = (t0.match(/^(\d+) roteiros/i) || [])[1];
        const tema = generico ? `${cli ? "Roteiro " + cli : "Roteiro sem título"}${qtd ? ` (${qtd} roteiros)` : ""}` : t0;
        const tipo = /publi/i.test(r.finalidade || "") ? "Publi" : /ugc/i.test(r.finalidade || "") ? "UGC" : cli ? "Publi" : "Orgânico";
        const formato = /carross/i.test(r.formato || "") ? "Carrossel" : /stor/i.test(r.formato || "") && !/reel/i.test(r.formato || "") ? "Stories" : /foto/i.test(r.formato || "") ? "Foto" : "Reels";
        const data = /^\d{4}-\d{2}-\d{2}/.test(r.dataPublicacao || "") ? String(r.dataPublicacao).slice(0, 10) : null;
        await salvar({ tema, status: ETAPA_ROT[r.etapa] || "Roteirizado", data, formato, tipo_conteudo: tipo, marca: cli || null, roteiro_id: rid, funil: "Meio", hook: r.gancho || null, horario: (st.perfil.ritmo || {}).horario || "12h" });
        ligados.add(rid); vistos.add(rid);
      }
      if (vistos.size !== antes) {
        st.rotVistos = [...vistos];
        await banco().from("configuracoes").upsert({ chave: "roteiros_no_quadro", valor: JSON.stringify(st.rotVistos), updated_at: new Date().toISOString() }, { onConflict: "chave" });
      }
    } finally { st.unindo = false; }
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
  // um conteúdo = um registro: mudar status, data ou classificação atualiza o mesmo registro (quadro, calendário e visão geral)
  async function salvar(post) {
    const campos = { ...post }; delete campos.id; delete campos.criado_em;
    if (campos.data) campos.mes = String(campos.data).slice(0, 7);
    if ("status" in campos) campos.status = normStatus(campos.status);
    campos.atualizado_em = new Date().toISOString();
    if (post.id) {
      const { error } = await banco().from("painel_conteudo").update(campos).eq("id", post.id);
      if (error) throw new Error(error.message);
      const atual = acharConteudo(post.id); if (atual) Object.assign(atual, campos);
      // arquivar tira dos ativos (calendário, semana, números); desarquivar devolve
      if (atual && "status" in campos) {
        st.todos = st.todos.filter((x) => x !== atual); st.arquivados = (st.arquivados || []).filter((x) => x !== atual);
        (atual.status === ARQ ? st.arquivados : st.todos).push(atual);
      }
      return atual || { ...post, ...campos };
    }
    const { data, error } = await banco().from("painel_conteudo").insert({ ...campos, mes: campos.mes || st.mes }).select().maybeSingle();
    if (error) throw new Error(error.message);
    const novo = data ? { ...data, status: normStatus(data.status) } : { ...campos, mes: campos.mes || st.mes, id: Date.now() };
    (novo.status === ARQ ? (st.arquivados = st.arquivados || []) : st.todos).push(novo);
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
          await salvar({ data: sl.data, horario: sl.horario, pilar: sl.pilar || x.pilar || null, formato: sl.formato, funil: sl.funil, tema: x.tema, tipo_conteudo: x.tipo_conteudo || null, nicho: x.nicho || null, tipo_ugc: x.tipo_ugc, proposito: x.proposito, hook: x.hook, ganchos: x.ganchos, desenvolvimento: x.desenvolvimento, cta: x.cta, tipo_roteiro: x.tipo_roteiro, legenda: x.legenda, porque: x.porque, status: "Roteirizado",
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
    return salvar({ id: p.id, tema: x.tema, tipo_conteudo: x.tipo_conteudo || p.tipo_conteudo || null, nicho: x.nicho || p.nicho || null, tipo_ugc: x.tipo_ugc, proposito: x.proposito, hook: x.hook, ganchos: x.ganchos, desenvolvimento: x.desenvolvimento, cta: x.cta, tipo_roteiro: x.tipo_roteiro, legenda: x.legenda, porque: x.porque, status: "Roteirizado" });
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
    $("#pc-perfil-padrao", box).addEventListener("click", async () => { if (!(await painelDialogo.confirmar("Voltar o perfil para o padrão?", { ok: "Voltar ao padrão" }))) return; try { await salvarPerfil(PERFIL_PADRAO); pintar(); toast("Perfil voltou ao padrão."); } catch (er) { toast(er.message, true); } });
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
    ajustes: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    seta: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    lixo: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    pasta: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
    relogio: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    sino: '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></svg>',
  };
  function opcoesMes() {
    const lista = [];
    for (let k = -2; k <= 4; k++) { const d = new Date(hoje.getFullYear(), hoje.getMonth() + k, 1); lista.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
    if (!lista.includes(st.mes)) lista.push(st.mes);
    return lista;
  }

  const icAno = '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M9 3.5v4M15 3.5v4M8 14h3M8 17h6"/></svg>';
  function montar(sec) {
    sec.innerHTML = `<div class="cr-pagina cr-pagina-larga pc pc2">
      <header class="pc2-cab">
        <div><small class="pc2-sobre">Conteúdos</small><h2 class="pc2-titulo">Meus <em>conteúdos</em></h2></div>
        <div class="pc2-cab-acoes"><button class="btn pc2-btn-ano" type="button" data-pcaba="ano" title="Narrativa, ritmo, temas do ano e 2 meses à frente">${icAno}Planejar o ano</button><button class="btn btn-principal" type="button" id="pc-novo">${ic.mais}Novo conteúdo</button></div>
      </header>
      <nav class="sub-abas pc-abas" aria-label="Partes de Conteúdos">
        <button type="button" class="sub-aba" data-pcaba="geral">Esta semana</button><button type="button" class="sub-aba" data-pcaba="quadro">Quadro de produção</button><button type="button" class="sub-aba" data-pcaba="cal">Calendário</button><button type="button" class="sub-aba" data-pcaba="ideias">Ideias</button>
      </nav>
      <p class="desc-aba" id="pc-desc"></p>
      <section data-pcpar="geral" id="pc-geral"></section>
      <section data-pcpar="quadro" id="pc-kanban"></section>
      <section data-pcpar="cal" class="pc2-cal">
        <div class="pc-cal-cab">
          <div class="pc2-cal-tit"><select class="entrada" id="pc-mes" aria-label="Mês"></select><span class="pc-ajuda" id="pc-sobre-mes" hidden></span>
            <div class="pc2-seg" role="group" aria-label="Visualização"><button type="button" data-calvista="5sem">5 semanas</button><button type="button" data-calvista="mes">Mensal</button><button type="button" data-calvista="semana">Semanal</button></div></div>
          <div class="pc-cal-nav"><button class="icone-btn" type="button" id="pc-ant" aria-label="Anterior">${ic.esq}</button><button class="icone-btn" type="button" id="pc-prox" aria-label="Próximo">${ic.dir}</button><button class="btn pc-btn-hoje" type="button" id="pc-hoje">Hoje</button><span id="pc-semana-rot"></span></div>
        </div>
        <p class="pc-ajuda pc2-dica">Arraste um conteúdo para outro dia para mudar a data. O + cria um conteúdo naquele dia. Toque num conteúdo para ver tudo.</p>
        <div class="pc-legenda" id="pc-legenda"></div>
        <div class="pc-numeros" id="pc-numeros" hidden></div><span id="pc-nsem" hidden></span>
        <div class="pc-cal" id="pc-quadro"></div>
        <div class="pc-cal" id="pc-semanal" hidden></div>
      </section>
      <nav class="pc2-seg pc2-subideias" data-pcpar="ideias ganchos" role="group" aria-label="Ideias e ganchos"><button type="button" data-pcsub="ideias">Banco de ideias</button><button type="button" data-pcsub="ganchos">Ganchos magnéticos</button></nav>
      <section data-pcpar="ideias" id="pc-ideias"></section>
      <section data-pcpar="ganchos" id="pc-ganchos"></section>
      <section data-pcpar="ano" id="pc-ano"></section>
      <div id="pc-config" data-pcpar="ano">
        <div class="pc2-cfg-cab"><h3 class="pc2-h">Meu ritmo e <em>IA</em></h3></div>
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
        </div>
        <details class="pc2-automacao"><summary><h3 class="pc2-h">Salvos do Instagram <em>no automático</em></h3><small>atalho do iPhone e agente diário</small></summary>
          <div class="pc-baixo">
            <section class="pc-cartao pc-iphone" id="pc-iphone"></section>
            <section class="pc-cartao pc-agente" id="pc-agente"></section>
          </div>
        </details>
      </div>
    </div>`;
    // Abas (nov/2026, reorganização pedida pela Mari): Banco de ideias e Ganchos dividem a aba "Ideias e ganchos";
    // os antigos Ajustes e IA (ritmo, gerar a grade, pastas, iPhone, agente) ficam dentro de Planejamento. A escolha fica guardada.
    const ABA_DA_PARTE = { ganchos: "ideias", cfg: "ano" };
    // Para que serve cada parte (nov/2026, pedido da Mari)
    const DESC_PARTE = {
      geral: "Esta semana: o plano dos próximos dias. Arraste os conteúdos entre os dias, mude a data ou use o + para criar um novo naquele dia.",
      quadro: "Quadro de produção: em que etapa cada conteúdo está, da ideia até postado. Abra um cartão para escrever o roteiro.",
      cal: "Calendário: o mês inteiro com os seus posts e as datas das publis. Arraste um conteúdo para mudar o dia.",
      ideias: "Banco de ideias: ideias guardadas para usar depois, incluindo as que chegam todo dia dos seus Salvos do Instagram.",
      ganchos: "Ganchos magnéticos: frases de abertura para testar nos vídeos. Marque se funcionaram ou não para saber quais repetir.",
      ano: "Planejar o ano: a narrativa, o seu ritmo de posts, os temas do ano e a grade gerada pela IA. Aqui também ficam os Salvos no automático.",
    };
    const tituloPartes = { geral: DESC_PARTE.geral, quadro: DESC_PARTE.quadro, cal: DESC_PARTE.cal, ideias: DESC_PARTE.ideias, ano: DESC_PARTE.ano };
    $$("[data-pcaba]", sec).forEach((b) => { if (tituloPartes[b.dataset.pcaba]) b.title = tituloPartes[b.dataset.pcaba]; });
    $$("[data-pcsub]", sec).forEach((b) => { if (DESC_PARTE[b.dataset.pcsub]) b.title = DESC_PARTE[b.dataset.pcsub]; });
    const mostrarParte = (k) => {
      if (k === "cfg") k = "ano";
      const aba = ABA_DA_PARTE[k] || k;
      $$("[data-pcaba]", sec).forEach((b) => { b.classList.toggle("ativa", b.dataset.pcaba === aba); b.setAttribute("aria-current", b.dataset.pcaba === aba ? "page" : "false"); });
      $$("[data-pcpar]", sec).forEach((p) => { p.hidden = !p.dataset.pcpar.split(" ").includes(k); });
      $$("[data-pcsub]", sec).forEach((b) => b.classList.toggle("ativa", b.dataset.pcsub === k));
      const pd = $("#pc-desc", sec); if (pd) { pd.textContent = DESC_PARTE[k] || ""; pd.hidden = !DESC_PARTE[k]; }
      try { localStorage.setItem("pc-parte2", k); } catch (e) { /* sem armazenamento */ }
    };
    st.mostrarParte = mostrarParte;
    window.painelConteudos = { parte: (k) => mostrarParte(k) };
    // Meus roteiros é a página do aplicativo (#quadro), com este mesmo cabeçalho e abas em cima (js/admin.js)
    $$("[data-pcir]", sec).forEach((b) => b.addEventListener("click", () => { location.hash = "#" + b.dataset.pcir; }));
    let parte = "geral"; try { parte = localStorage.getItem("pc-parte2") || "geral"; } catch (e) { /* sem armazenamento */ }
    mostrarParte(["geral", "quadro", "cal", "ideias", "ganchos", "ano"].includes(parte) ? parte : "geral");
    $$("[data-pcaba]", sec).forEach((b) => b.addEventListener("click", () => {
      let k = b.dataset.pcaba;
      if (k === "ideias") { try { if (localStorage.getItem("pc-sub-ideias") === "ganchos") k = "ganchos"; } catch (e) { /* sem armazenamento */ } }
      mostrarParte(k);
    }));
    $$("[data-pcsub]", sec).forEach((b) => b.addEventListener("click", () => { try { localStorage.setItem("pc-sub-ideias", b.dataset.pcsub); } catch (e) { /* sem armazenamento */ } mostrarParte(b.dataset.pcsub); }));
    $("#pc-novo", sec).addEventListener("click", () => abrir(novoConteudo({})));
    $$("[data-calvista]", sec).forEach((b) => b.addEventListener("click", () => { st.cal = b.dataset.calvista; try { localStorage.setItem("pc-calvista", st.cal); } catch (e) { /* sem armazenamento */ } if (st.cal === "semana" && !st.semIni) st.semIni = segundaDe(iso(hoje)); pintar(); }));
    const sel = $("#pc-mes", sec);
    sel.addEventListener("change", () => { st.mes = sel.value; st.semana = 0; ajustarSemana(); pintar(); });
    const trocarMes = (k) => {
      if (st.cal === "5sem") { const d = deIso(st.ini5 || segundaDe(iso(hoje))); d.setDate(d.getDate() + 7 * k); st.ini5 = iso(d); st.mes = st.ini5.slice(0, 7); pintar(); return; }
      if (st.cal === "semana") { const d = deIso(st.semIni || segundaDe(iso(hoje))); d.setDate(d.getDate() + 7 * k); st.semIni = iso(d); st.mes = st.semIni.slice(0, 7); pintar(); return; }
      const [a, m] = st.mes.split("-").map(Number); const d = new Date(a, m - 1 + k, 1); st.mes = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; ajustarSemana(); pintar();
    };
    $("#pc-ant", sec).addEventListener("click", () => trocarMes(-1));
    $("#pc-prox", sec).addEventListener("click", () => trocarMes(1));
    $("#pc-hoje", sec).addEventListener("click", () => {
      st.mes = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`; st.semIni = segundaDe(iso(hoje)); st.ini5 = segundaDe(iso(hoje)); ajustarSemana(); pintar();
      if (st.cal === "mes") { const alvo = $("#pc-sem-" + st.semana, sec); if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" }); }
    });
    $("#pc-qtd", sec).addEventListener("change", pintar);
    $("#pc-gerar", sec).addEventListener("click", () => gerar($("#pc-qtd", sec).value, $("#pc-notas", sec).value.trim()));
  }
  const segundaDe = (dataIso) => { const d = deIso(dataIso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
  // conteúdo novo: o mesmo formulário em qualquer lugar (coluna do quadro, dia do calendário, banco de ideias)
  const novoConteudo = (extra) => ({ horario: (st.perfil.ritmo || {}).horario || "12h", formato: "Reels", status: "Ideia", funil: "Topo", ...extra });
  function ajustarSemana() {
    const [a, m] = st.mes.split("-").map(Number);
    st.semana = a === hoje.getFullYear() && m === hoje.getMonth() + 1 ? semanaDe(iso(hoje)) : 0;
  }

  // cor do cartão pelo pilar (na paleta dela); Stories aparecem como texto no dia, como na referência
  const CORES_PIL = 6;
  const indicePilar = (nome) => { const i = (st.perfil.pilares || []).findIndex((x) => x.nome === nome); return i < 0 ? -1 : i % CORES_PIL; };
  const funilIc = '<svg class="traco pc-funil" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M7 10h10M10 15h4M11.5 19.5h1"/></svg>';
  // calendário = só agenda: pílulas de publicação (orgânico ou publi), gravação e compromissos dos jobs
  const ehPubli = (p) => Boolean(p.marca) || p.tipo_conteudo === "Publi";
  const tipoTxt = (p) => (ehPubli(p) ? "Publi" + (p.marca ? " · " + p.marca : "") : p.tipo_conteudo || "");
  function pilulas(s2) {
    const pubs = st.todos.filter((p) => p.data === s2).map((p) => `<button type="button" class="pc3-pill ${ehPubli(p) ? "k-publi" : "k-org"}${p.status === "Publicado" ? " feito" : ""}" data-id="${p.id}" data-arrasta="pub:${p.id}" title="${esc([p.tema, p.formato, tipoTxt(p), p.horario, p.status].filter(Boolean).join(" · "))}">${esc(p.tema || "Sem título")}</button>`);
    const gravs = st.todos.filter((p) => p.data_gravacao === s2 && p.status !== "Publicado").map((p) => `<button type="button" class="pc3-pill k-grav" data-id="${p.id}" data-arrasta="grav:${p.id}" title="Gravação de ${esc(p.tema || "")}">Gravar: ${esc(p.tema || "Sem título")}</button>`);
    const comp = (st.agenda || []).filter((x) => x.data === s2).map((x) => `<button type="button" class="pc3-pill k-comp" ${x.ir ? `data-ir="${x.ir}"` : ""} title="${esc(x.rotulo + ": " + x.texto)}">${esc(x.texto)} · ${esc(x.rotulo.replace(/^PUBLI · /, "").replace(/^AGENDA · ?/, "").toLowerCase())}</button>`);
    return gravs.join("") + pubs.join("") + comp.join("");
  }
  function celulaDia(d, fora) {
    const s2 = iso(d);
    return `<div class="pc3-dia${fora ? " fora" : ""}${s2 === iso(hoje) ? " hoje" : ""}" data-dia="${s2}"><div class="pc3-dia-cab"><b>${d.getDate()}</b><button type="button" class="pc3-add" data-novo="${s2}" aria-label="Novo conteúdo em ${d.getDate()}/${pad(d.getMonth() + 1)}">${ic.mais}</button></div>${pilulas(s2)}</div>`;
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
    const semanas = semanasDoMes(); st.semana = Math.min(st.semana, semanas.length - 1);
    const mesNum = Number(st.mes.split("-")[1]) - 1, br = (d) => `${d.getDate()}/${pad(d.getMonth() + 1)}`;
    $("#pc-semana-rot", sec).textContent = rotuloMes(st.mes);
    $("#pc-legenda", sec).innerHTML = `<span><i class="k-org"></i>Orgânico</span><span><i class="k-publi"></i>Publi</span><span><i class="k-grav"></i>Gravação</span><span><i class="k-comp"></i>Entregas e compromissos de jobs</span>`;
    $("#pc-quadro", sec).innerHTML = `<div class="pc3-cal-dias">${DIAS.map((d) => `<span>${d}</span>`).join("")}</div>` + semanas.map((sem, n) => {
      const seg = iso(sem[0]), tema = (st.temas || {})[seg];
      return `<div class="pc3-sem${sem.some((d) => iso(d) === iso(hoje)) ? " atual" : ""}" id="pc-sem-${n}">
        <button type="button" class="pc3-tema${tema ? " tem" : ""}" data-tema="${seg}" title="Tema da semana">${tema ? esc(tema) : "+ tema da semana"}</button>
        <div class="pc3-grade">${sem.map((d) => celulaDia(d, d.getMonth() !== mesNum)).join("")}</div></div>`;
    }).join("");
    pintarSemanal(sec);
    $$("[data-tema]", sec).forEach((b) => b.addEventListener("click", async () => {
      const atual = (st.temas || {})[b.dataset.tema] || "";
      const novo = await painelDialogo.texto("Tema desta semana (ex.: Black Friday para marcas). Deixe vazio para tirar.", atual);
      if (novo === null) return; await salvarTema(b.dataset.tema, novo.trim()); pintar();
    }));
    pintarGeral(sec); pintarKanban(sec); pintarIdeias(sec); pintarGanchos(sec); pintarAno(sec);
    const cal = $("[data-pcpar=cal]", sec);
    ligarCliques(cal);
    $$("[data-ir]", cal).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); location.hash = "#" + b.dataset.ir; }));
    $$("[data-novo]", cal).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); abrir(novoConteudo({ data: b.dataset.novo, status: "Roteirizado" })); }));
    // arrastar: a publicação muda a data de publicação; a gravação muda a data de gravação (sempre o mesmo cadastro)
    $$("[data-arrasta]", cal).forEach((b) => { b.draggable = true; b.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/cal", b.dataset.arrasta)); });
    $$(".pc3-dia", cal).forEach((col) => {
      col.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("text/cal")) { e.preventDefault(); col.classList.add("alvo"); } });
      col.addEventListener("dragleave", () => col.classList.remove("alvo"));
      col.addEventListener("drop", async (e) => {
        e.preventDefault(); col.classList.remove("alvo");
        const [tipo, id] = String(e.dataTransfer.getData("text/cal")).split(":");
        const p = st.todos.find((x) => String(x.id) === id); if (!p) return;
        const campo = tipo === "grav" ? "data_gravacao" : "data";
        if (p[campo] === col.dataset.dia) return;
        try { await salvar({ id: p.id, [campo]: col.dataset.dia }); pintar(); toast(tipo === "grav" ? "Gravação remarcada." : "Data de publicação mudada."); } catch (er) { toast(er.message, true); }
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
    pintarAgente();
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
      ${!gravar.length && !assim.length ? `<p class="pc-ajuda">Está em 0. Por segurança da sua conta, nenhum programa entra mais no seu Instagram: traga os posts pelo iPhone (cartão abaixo, cada post que você salvar) ou colando o link em Referências &gt; Salvos do Instagram.</p>` : ""}
      <label class="btn pc-enviar">${ic.pasta}Enviar arquivo das pastas<input type="file" id="pc-arquivo" accept=".json" hidden></label>
      ${outras.length ? `<p class="pc-ajuda">Outras pastas que chegaram: ${outras.map(esc).join(", ")}.</p>` : ""}`;
    const t = $("#pc-transcrever", box); if (t) t.addEventListener("click", transcreverPastas);
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
    const n = $("#pc-novo-topico", box); if (n) n.addEventListener("click", async () => { if (await painelDialogo.confirmar("Trocar o endereço? Depois você assina o novo no app ntfy.", { ok: "Trocar" })) ligarNotificacoes(); });
    copiar("#pc-copiar-topico", st.topico, "Copiado. Cole no app ntfy.");
    copiar("#pc-copiar-link", LINK_SALVAR, "Copiado. Cole na ação Abrir URLs.");
  }

  // ---------- Agente diário dos Salvos (nov/2026) ----------
  // Uma tarefa agendada do Claude roda 1x por dia (~14h), confere salvos_ativo em configuracoes
  // e, se estiver ligado, abre os Salvos do Instagram no Chrome dela, manda os posts novos das pastas
  // para a função salvos-diarios (ideia com roteiro nesta grade + notificação). Chaves: salvos_horario (HH:MM),
  // salvos_ativo ("sim"/"nao"), salvos_ultima_execucao (AAAA-MM-DD, a tarefa grava).
  // Desligado em 10/11/2026: ele abria o Instagram dela no Chrome todo dia (automação na conta logada).
  // A Meta restringiu os anúncios da conta em 09/11/2026; a tarefa agendada foi pausada e salvos_ativo = "nao".
  async function pintarAgente() {
    const box = $("#pc-agente"); if (!box) return;
    box.innerHTML = `<h3 class="pc-h3">${ic.relogio}Agente diário dos Salvos</h3>
      <p class="pc-ajuda"><b>Desligado por segurança.</b> Ele abria o seu Instagram no navegador todos os dias, e esse tipo de acesso automático pode ser visto como suspeito pela Meta. Os posts continuam chegando pelo atalho do iPhone ou colando o link em Referências.</p>`;
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
    const rot = roteiroDe(p);
    const blocoRoteiro = p.roteiro_id ? `<details class="pc-editor-secao pc-roteiro" open><summary><strong>Roteiro</strong><span>${rot ? esc([rot.cliente && String(rot.cliente).trim(), rot.etapa].filter(Boolean).join(" · ") || "guardado no editor de roteiros") : "guardado no editor de roteiros"}</span></summary><div class="pc-editor-conteudo">
        ${rot && rot.conteudo ? `<div class="pc-rot-texto">${esc(rot.conteudo)}</div>` : `<p class="pc-ajuda">O texto deste roteiro fica no editor de roteiros. Toque em Editar roteiro para ver e mudar.</p>`}
        <div class="pc-rot-acoes"><button class="btn" type="button" data-abrir-roteiro>${ic.brilho}Editar roteiro</button>${rot && rot.conteudo ? `<button class="btn" type="button" data-copiar-roteiro>Copiar roteiro</button>` : ""}</div>
        </div></details>` : "";
    dlg.innerHTML = `<div class="janela-cabeca"><div><small class="janela-sobretitulo">Conteúdos · ${esc(nomeStatus(p.status || "Ideia"))}</small><h2>${p.id ? esc(p.tema || "Conteúdo") : "Novo conteúdo"}</h2></div><button class="icone-btn" type="button" data-fechar aria-label="Fechar">${ic.x}</button></div>
      <div class="janela-corpo pc-form pc-editor-compacto">
        ${insp.link ? `<div class="pc-ref"><small>Referência</small><a href="${esc(insp.link)}" target="_blank" rel="noopener">${esc(insp.perfil || "Abrir o post")} · abrir no Instagram</a>${insp.legenda ? `<span>${esc(insp.legenda)}</span>` : ""}${insp.colecao ? `<em>pasta ${esc(insp.colecao)}</em>` : ""}</div>` : ""}
        <section class="pc-editor-bloco">
          <div class="pc-editor-bloco-cab"><span class="pc-editor-numero">01</span><div><strong>Informações</strong><small>Quando e como este conteúdo será publicado</small></div></div>
          <label class="campo pc-largo"><span>Título do conteúdo</span><input name="tema" value="${esc(p.tema)}"></label>
          <div class="pc-editor-dados-grid">
            <label class="campo"><span>Publicação</span><input type="date" name="data" value="${esc(p.data || "")}"></label>
            <label class="campo"><span>Gravação</span><input type="date" name="data_gravacao" value="${esc(p.data_gravacao || "")}"></label>
            <label class="campo"><span>Horário</span><input name="horario" value="${esc(p.horario || "")}" placeholder="12h"></label>
            <label class="campo"><span>Formato</span><select name="formato">${opt(FORMATOS, p.formato)}</select></label>
            <label class="campo"><span>Etapa de produção</span><select name="status">${COLUNAS.map((x) => `<option value="${esc(x)}" ${x === p.status ? "selected" : ""}>${esc(nomeStatus(x))}</option>`).join("")}</select></label>
          </div>
        </section>
        <section class="pc-editor-bloco">
          <div class="pc-editor-bloco-cab"><span class="pc-editor-numero">02</span><div><strong>Classificação</strong><small>Organize o conteúdo por tipo, nicho e pilar</small></div></div>
          <div class="pc-editor-class-grid">
            <label class="campo"><span>Tipo</span><select name="tipo_conteudo"><option value=""></option>${opt(TIPOS_CONTEUDO, p.tipo_conteudo)}</select></label>
            <label class="campo"><span>Nicho</span><select name="nicho"><option value=""></option>${opt([...new Set([...NICHOS, ...(p.nicho ? [p.nicho] : [])])], p.nicho)}</select></label>
            <label class="campo"><span>Pilar</span><select name="pilar"><option value=""></option>${opt([...new Set([...(st.perfil.pilares || []).map((x) => x.nome), ...(p.pilar ? [p.pilar] : [])])], p.pilar)}</select></label>
            <label class="campo"><span>Marca <small>(somente para publicidade)</small></span><input name="marca" value="${esc(p.marca || "")}" placeholder="Nome da marca"></label>
          </div>
          ${p.id ? `<div class="pc-editor-refazer"><div><strong>Quer testar outra abordagem?</strong><small>Peça um ajuste e gere uma nova versão deste conteúdo.</small></div><div class="pc-linha"><input class="entrada" id="pc-ajuste" placeholder="Ex.: mais leve, trocar o produto ou o gancho"><button class="btn" type="button" data-refazer>Refazer</button></div></div>` : ""}
        </section>
        ${blocoRoteiro}
        <details class="pc-editor-secao" open><summary><strong>03 · Estratégia</strong><span>Direção criativa, objetivo e gancho</span></summary><div class="pc-editor-conteudo">
        <div class="pc-grade3">
          <label class="campo"><span>Tipo de roteiro</span><select name="tipo_roteiro"><option value=""></option>${opt(ROTEIROS, p.tipo_roteiro)}</select></label>
          <label class="campo"><span>Tipo de UGC</span><select name="tipo_ugc"><option value=""></option>${opt(tipos, p.tipo_ugc)}</select></label>
          <label class="campo"><span>Funil</span><select name="funil">${opt(FUNIS, p.funil)}</select></label>
        </div>
        ${p.porque ? `<details class="pc-editor-extra"><summary>Por que atrai marca</summary><p>${esc(p.porque)}</p></details>` : ""}
        <label class="campo pc-largo"><span>Objetivo</span><input name="proposito" value="${esc(p.proposito)}" placeholder="Para que serve esse conteúdo no seu perfil"></label>
        <label class="campo pc-largo"><span>Hook</span><textarea name="hook" rows="2">${esc(p.hook)}</textarea></label>
        <div class="pg-usar-linha"><button type="button" class="btn btn-mini" data-usar-gancho>${ic.brilho}Usar um gancho magnético</button><button type="button" class="btn btn-mini pg-auto-btn" data-gancho-auto title="A IA escolhe o gancho que mais combina com este produto e já preenche">${ic.brilho}Escolher o melhor pra mim</button>${(st.ganchos || []).filter((g) => p.id && g.post_id === p.id).map((g) => `<span class="pg-testando">testando: ${esc(semAspas(g.texto).slice(0, 60))}</span>`).join("")}</div>
        ${ganchos.length ? `<details class="pc-editor-extra pc-editor-ganchos"><summary>Outras opções de gancho (${ganchos.length})</summary><div class="pc-ganchos">${ganchos.map((g) => `<button type="button" class="cr-chip" data-gancho>${esc(g)}</button>`).join("")}</div></details>` : ""}
        </div></details>
        <details class="pc-editor-secao"><summary><strong>04 · Roteiro e publicação</strong><span>Desenvolvimento, CTA, legenda e notas</span></summary><div class="pc-editor-conteudo">
        <label class="campo pc-largo"><span>Desenvolvimento do roteiro</span><textarea name="desenvolvimento" rows="9">${esc(p.desenvolvimento)}</textarea></label>
        <label class="campo pc-largo"><span>CTA</span><input name="cta" value="${esc(p.cta)}"></label>
        <label class="campo pc-largo"><span>Legenda e hashtags</span><textarea name="legenda" rows="4">${esc(p.legenda)}</textarea></label>
        <label class="campo pc-largo"><span>Notas</span><textarea name="notas" rows="2">${esc(p.notas)}</textarea></label>
        ${insp.duracao_seg || (!insp.link && insp.perfil) ? `<p class="pc-ajuda">${!insp.link && insp.perfil ? `Inspirado em ${esc(insp.perfil)}. ` : ""}${insp.duracao_seg ? `Duração estimada: ${insp.duracao_seg}s.` : ""}</p>` : ""}
        </div></details>
      </div>
      <div class="janela-rodape pc-editor-rodape">${p.id ? `<button class="btn btn-perigo" type="button" data-excluir>Excluir</button>` : ""}<span class="pc-editor-espaco"></span>
        ${p.id && !p.roteiro_id ? `<details class="pc-editor-mais"><summary>Mais ações <span>⌄</span></summary><div class="pc-editor-mais-menu"><button class="btn" type="button" data-quadro title="Copia o que está aqui para o editor de roteiros e liga os dois">Levar para o editor de roteiros</button><button class="btn" type="button" data-skill>Criar roteiro com a Skill</button></div></details>` : ""}
        <button class="btn btn-principal" type="button" data-salvar>Salvar alterações</button></div>`;
    const ler = () => { const o = { ...p }; delete o.ganchoTeste; $$("[name]", dlg).forEach((el) => { o[el.name] = el.value.trim() || null; }); o.status = o.status || "Ideia"; return o; };
    $("[data-fechar]", dlg).addEventListener("click", () => dlg.close());
    $$("[data-gancho]", dlg).forEach((b) => b.addEventListener("click", () => { const h = $("[name=hook]", dlg); const antigo = h.value; h.value = b.textContent; b.textContent = antigo; }));
    delete dlg.dataset.ganchoTeste; if (p.ganchoTeste) dlg.dataset.ganchoTeste = String(p.ganchoTeste);
    const ug = $("[data-usar-gancho]", dlg);
    if (ug) ug.addEventListener("click", () => escolherGancho(dlg, p));
    const ga = $("[data-gancho-auto]", dlg);
    if (ga) ga.addEventListener("click", async () => {
      const antes = ga.innerHTML; ga.disabled = true; ga.textContent = "Escolhendo o melhor gancho…";
      try { await ganchoComIA(dlg, p, null); } finally { ga.disabled = false; ga.innerHTML = antes; }
    });
    $("[data-salvar]", dlg).addEventListener("click", async () => {
      try { const o = ler(); if (o.data && !o.data.startsWith(st.mes)) { o.mes = o.data.slice(0, 7); } const salvo = await salvar(o); const gt = dlg.dataset.ganchoTeste && (st.ganchos || []).find((g) => String(g.id) === dlg.dataset.ganchoTeste); if (gt && salvo && salvo.id) { try { await marcarTeste(gt, salvo.id); } catch (e2) { /* o conteúdo já salvou */ } } dlg.close(); if (o.data) st.semana = semanaDe(o.data); pintar(); toast("Conteúdo salvo."); }
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
      if (!(await painelDialogo.confirmar(`Excluir este conteúdo? Ele sai do quadro, do calendário e da semana.${p.roteiro_id ? " O roteiro continua guardado no editor de roteiros." : ""}`, { ok: "Excluir", perigo: true }))) return;
      const { error } = await banco().from("painel_conteudo").delete().eq("id", p.id);
      if (error) { toast(error.message, true); return; }
      st.todos = st.todos.filter((x) => x.id !== p.id); st.arquivados = (st.arquivados || []).filter((x) => x.id !== p.id); dlg.close(); pintar();
    });
    const q = $("[data-quadro]", dlg);
    if (q) q.addEventListener("click", async () => {
      if (!window.painelRoteiros || !window.painelRoteiros.salvarNoQuadro) { toast("Abra o editor de roteiros uma vez e tente de novo.", true); return; }
      const o = ler();
      const conteudo = [o.proposito && "PROPÓSITO:\n" + o.proposito, o.hook && "HOOK:\n" + o.hook, o.desenvolvimento && "DESENVOLVIMENTO:\n" + o.desenvolvimento, o.cta && "CTA:\n" + o.cta, o.legenda && "LEGENDA:\n" + o.legenda, p.porque && "POR QUE ATRAI MARCA:\n" + p.porque, insp.link && "REFERÊNCIA:\n" + insp.link].filter(Boolean).join("\n\n");
      const rid = "pc" + p.id + "-" + Date.now().toString(36);
      const ok = await window.painelRoteiros.salvarNoQuadro({ id: rid, titulo: o.tema || "Post do painel", plataforma: "Instagram", status: "Em aberto", finalidade: "Conteúdos", etapa: o.status === "Ideia" ? "Ideias" : "Roteirização", conteudo, gancho: o.hook || "", formato: o.formato || "", tipoUgc: o.tipo_ugc || "", funil: o.funil || "", referencia: insp.link || "", dataPublicacao: o.data || "",
        origem: { tipo: "conteudo", id: String(p.id) }, historico: [{ em: new Date().toISOString(), acao: "Veio de Conteúdos" }] });
      // os dois ficam ligados: o conteúdo guarda o id do roteiro (sem cópia solta)
      if (ok) { await salvar({ ...o, id: p.id, roteiro_id: rid }); st.rotVistos = [...new Set([...(st.rotVistos || []), rid])]; dlg.close(); pintar(); toast("Roteiro criado e ligado a este cartão."); }
    });
    const ar = $("[data-abrir-roteiro]", dlg);
    if (ar) ar.addEventListener("click", () => { dlg.close(); if (window.painelSkill) window.painelSkill.abrirRoteiro(p.roteiro_id); });
    const cr = $("[data-copiar-roteiro]", dlg);
    if (cr) cr.addEventListener("click", async () => { try { await navigator.clipboard.writeText(rot.conteudo); toast("Roteiro copiado."); } catch (e) { toast("Não consegui copiar.", true); } });
    const sk = $("[data-skill]", dlg);
    if (sk) sk.addEventListener("click", async () => {
      const o = ler();
      try { await salvar({ ...o, id: p.id }); } catch (e) { /* segue com o que tem */ }
      dlg.close();
      if (window.painelSkill) window.painelSkill.criarRoteiro({ conteudoId: p.id, ideia: ideiaDoConteudo(o, insp), inicial: { formato: /tiktok/i.test(o.formato || "") ? "TikTok" : /stor/i.test(o.formato || "") ? "Stories" : /carross/i.test(o.formato || "") ? "Carrossel" : "Reels", objetivo: o.proposito || "", marca: o.marca || "" } });
    });
    // sininho "Importante, notificar" (js/lembretes.js) com o post certo
    if (p.id) { dlg.dataset.lembreteTipo = "post"; dlg.dataset.lembreteId = String(p.id); dlg.dataset.lembreteTitulo = (p.formato ? p.formato + ": " : "") + (p.tema || "Post do painel"); }
    else { delete dlg.dataset.lembreteId; delete dlg.dataset.lembreteTitulo; }
    if (!dlg.open) dlg.showModal();
  }

  // ---------- plano da semana (chega pronto todo sábado às 8h; função painel-conteudo acao "plano_semana") ----------
  const pl = { atual: null, lista: [], idx: 0, gerando: false };
  async function carregarPlano() {
    const { data, error } = await banco().from("planos_semana").select("*").order("semana", { ascending: false }).limit(8);
    pl.lista = error ? [] : (data || []);
    pl.idx = Math.min(pl.idx, Math.max(0, pl.lista.length - 1));
    pl.atual = pl.lista[pl.idx] || null;
  }
  const brCurta = (d) => `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}`;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const ROT_ITEM = { gravar: "Gravar", postar: "Postar", publi: "Publi", agenda: "Agenda" };
  function pintarPlano() {
    const box = document.getElementById("pc-plano"); if (!box) return;
    const r = pl.atual;
    const topo = `<div class="pc-plano-cab"><div><h3 class="pc2-h">Plano da <em>semana</em></h3><p class="pc-ajuda">Gravar e postar. Chega pronto todo sábado às 8h.</p></div>
      <div class="pc-plano-acoes">${pl.lista.length > 1 ? `<select class="entrada" id="pc-plano-sem" aria-label="Qual semana">${pl.lista.map((x, i) => `<option value="${i}" ${i === pl.idx ? "selected" : ""}>${brCurta(x.semana)} a ${brCurta(x.plano && x.plano.fim || x.semana)}</option>`).join("")}</select>` : ""}
      <button class="btn" type="button" id="pc-plano-gerar"${pl.gerando ? " disabled" : ""}>${pl.gerando ? "Montando…" : r ? "Montar de novo" : "Montar agora"}</button>
      ${r ? `<button class="btn" type="button" id="pc-plano-editar">Editar foco</button><button class="btn btn-perigo" type="button" id="pc-plano-excluir">Excluir</button>` : ""}</div></div>`;
    if (!r) { box.innerHTML = topo + `<p class="pc-ajuda">Ainda não tem plano. O primeiro chega no sábado de manhã, ou clique em Montar agora.</p>`; ligarPlano(box); return; }
    const p = r.plano || {}, c = p.contas || {};
    sincronizarPlano(p);
    // visual de quadro (nov/2026, pedido da Mari: igual ao Organize de UGC's & Publis): um dia = uma coluna, uma tarefa = um cartão
    const SV = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const IC_PL = {
      gravar: SV('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>'),
      postar: SV('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>'),
      hora: SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
      ok: SV('<path d="m5 12 5 5 9-10"/>'),
      abrir: SV('<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
      tirar: SV('<path d="M6 6l12 12M18 6 6 18"/>'),
      mover: SV('<path d="M8 7 4 12l4 5M16 7l4 5-4 5M4 12h16"/>'),
    };
    const separar = (it) => {
      let t = String(it.texto || "").replace(/^(Gravar|Postar)\s+/i, "").trim(), fmt = "", hora = "";
      const mf = t.match(/^(Reels?|Carrossel|Stories|Story|TikTok|Foto|Post|V[ií]deo|Shorts)\b\s*:?\s*/i);
      if (mf) { fmt = mf[1]; t = t.slice(mf[0].length); }
      const mh = t.match(/\s*(?:às|as)\s+(\d{1,2}(?::\d{2}|h\d{0,2})?)\s*$/i);
      if (mh) { hora = mh[1]; t = t.slice(0, mh.index); }
      return { titulo: t.trim() || String(it.texto || ""), fmt, hora };
    };
    const tarefas = (d) => (d.itens || []).filter((it) => it.tipo === "gravar" || it.tipo === "postar");
    const todas = (p.dias || []).flatMap(tarefas), feitas = todas.filter((it) => it.feito).length;
    const pct = todas.length ? Math.round(feitas / todas.length * 100) : 0;
    const cartao = (it, onde) => {
      const x = separar(it), tipo = it.tipo === "gravar" ? "gravar" : "postar";
      // o cartão mostra o conteúdo como ele está agora (título, formato e horário editados aparecem aqui)
      const post = it.post_id && acharConteudo(it.post_id);
      if (post) { x.titulo = post.tema || x.titulo; x.fmt = post.formato || x.fmt; if (tipo === "postar") x.hora = post.horario || x.hora; }
      return `<div class="pq-card pq-${tipo}${it.feito ? " feito" : ""}" draggable="true" data-item="${esc(it.id)}" data-onde="${onde}">
        <div class="pq-card-topo"><span class="pq-ico">${IC_PL[tipo]}</span><span class="pq-tipo">${ROT_ITEM[tipo]}</span>
          <span class="pq-acoes"><button type="button" class="pq-btn" data-mover="${esc(it.id)}" data-onde="${onde}" title="Mudar de dia" aria-label="Mudar de dia">${IC_PL.mover}</button>${it.post_id ? `<button type="button" class="pq-btn" data-post="${it.post_id}" title="Abrir e editar o conteúdo" aria-label="Abrir e editar o conteúdo">${IC_PL.abrir}</button>` : ""}<button type="button" class="pq-btn" data-tirar="${esc(it.id)}" data-onde="${onde}" title="Tirar do plano" aria-label="Tirar do plano">${IC_PL.tirar}</button></span></div>
        <button type="button" class="pq-titulo" data-editar="${esc(it.id)}" data-onde="${onde}" title="Editar">${esc(x.titulo)}</button>
        ${x.fmt ? `<div class="pq-sub">${esc(x.fmt)}</div>` : ""}
        <div class="pq-rodape">${x.hora ? `<span class="pq-hora">${IC_PL.hora}${esc(x.hora)}</span>` : `<span></span>`}
          <label class="pq-feito"><input type="checkbox" data-feito="${esc(it.id)}" data-onde="${onde}" ${it.feito ? "checked" : ""}><span>${it.feito ? IC_PL.ok + "Feito" : "Marcar feito"}</span></label></div>
      </div>`;
    };
    const hj = iso(hoje);
    box.innerHTML = topo + `
      ${r.foco ? `<p class="pc-plano-foco"><b>Foco:</b> ${esc(r.foco)}</p>` : ""}
      <div class="pq-resumo"><div class="pq-resumo-linha"><span>${plural(feitas, "tarefa feita", "tarefas feitas")} de ${todas.length} · ${plural(todas.filter((it) => it.tipo === "postar").length, "post", "posts")}${p.novos ? ` (${plural(p.novos, "ideia nova", "ideias novas")} com roteiro)` : ""}</span><span>${pct}%</span></div><div class="pq-barra"><span style="width:${pct}%"></span></div>
        <div class="pq-legenda"><span class="pq-leg pq-gravar">${IC_PL.gravar}Gravar</span><span class="pq-leg pq-postar">${IC_PL.postar}Postar</span></div></div>
      ${p.aviso ? `<p class="faixa faixa-erro">${esc(p.aviso)}</p>` : ""}
      <p class="pc-ajuda pq-dica">Arraste um cartão para outro dia (ou toque em ⇆) para mudar a data. Toque no título para editar. O + coloca um conteúdo naquele dia.</p>
      <div class="pq-quadro">${(p.dias || []).map((d) => { const its = tarefas(d), passou = d.data < hj; return `<div class="pq-col${d.data === hj ? " hoje" : ""}${passou ? " passou" : ""}${its.length ? "" : " vazia"}" data-dia="${d.data}">
        <div class="pq-col-topo"><span class="pq-ponto"></span><span class="pq-col-nome">${esc(d.nome)}${d.data === hj ? ` <em>hoje</em>` : ""}</span><span class="pq-col-data">${brCurta(d.data)}</span><span class="pq-col-n">${its.length}</span><button type="button" class="pq-btn pq-add" data-add-dia="${d.data}" title="Colocar um conteúdo neste dia" aria-label="Colocar um conteúdo neste dia">${ic.mais}</button></div>
        ${its.map((it) => cartao(it, d.data)).join("") || `<div class="pq-vazio">Dia livre · arraste para cá</div>`}</div>`; }).join("")}</div>`;
    const qd = $(".pq-quadro", box), colHoje = $(".pq-col.hoje", box);
    if (qd && colHoje) qd.scrollLeft = Math.max(0, colHoje.offsetLeft - qd.offsetLeft - 8);
    ligarPlano(box);
  }
  async function salvarPlano(campos) {
    const { error } = await banco().from("planos_semana").update({ ...campos, atualizado_em: new Date().toISOString() }).eq("id", pl.atual.id);
    if (error) throw error;
    Object.assign(pl.atual, campos);
  }
  function itensDe(onde) { const p = pl.atual.plano; return onde === "propostas" ? p.propostas : ((p.dias || []).find((d) => d.data === onde) || {}).itens || []; }
  function ligarPlano(box) {
    const sel = $("#pc-plano-sem", box); if (sel) sel.addEventListener("change", () => { pl.idx = Number(sel.value); pl.atual = pl.lista[pl.idx]; pintarPlano(); });
    $("#pc-plano-gerar", box).addEventListener("click", async () => {
      if (pl.atual && !(await painelDialogo.confirmar("Montar o plano de novo? Os dias livres do seu ritmo ganham ideias novas e o que você marcou como feito recomeça.", { ok: "Montar de novo" }))) return;
      pl.gerando = true; pintarPlano();
      try {
        const { data, error } = await banco().functions.invoke("painel-conteudo", { body: { acao: "plano_semana" } });
        if (error || (data && data.error)) throw new Error((data && data.error) || (error && error.message) || "erro");
        pl.idx = 0; await carregarPlano(); await carregar(); pintar(); toast("Plano da semana pronto.");
      } catch (er) { toast("Não consegui montar o plano: " + er.message, true); }
      pl.gerando = false; pintarPlano();
    });
    const ed = $("#pc-plano-editar", box); if (ed) ed.addEventListener("click", async () => {
      const novo = await painelDialogo.texto("Foco desta semana (uma frase para lembrar o que importa):", pl.atual.foco || "", { linhas: 3 });
      if (novo == null) return;
      try { await salvarPlano({ foco: novo.trim() || null }); pintarPlano(); toast("Foco salvo."); } catch (er) { toast(er.message, true); }
    });
    const ex = $("#pc-plano-excluir", box); if (ex) ex.addEventListener("click", async () => {
      if (!(await painelDialogo.confirmar("Excluir este plano da semana? Os posts do calendário continuam.", { ok: "Excluir", perigo: true }))) return;
      const { error } = await banco().from("planos_semana").delete().eq("id", pl.atual.id);
      if (error) { toast(error.message, true); return; }
      pl.idx = 0; await carregarPlano(); pintarPlano(); toast("Plano excluído.");
    });
    $$("[data-feito]", box).forEach((c) => c.addEventListener("change", async () => {
      const it = itensDe(c.dataset.onde).find((x) => x.id === c.dataset.feito); if (!it) return;
      it.feito = c.checked;
      try { await salvarPlano({ plano: pl.atual.plano }); } catch (er) { it.feito = !c.checked; toast(er.message, true); pintarPlano(); return; }
      // nov/2026 (pedido da Mari): marcar feito já anda o cartão no Quadro de produção (não precisa atualizar duas vezes)
      const post = it.post_id && acharConteudo(it.post_id);
      if (post) {
        const ordem = (x) => STATUS.indexOf(x);
        let novo = null;
        if (c.checked) novo = it.tipo === "gravar" ? (ordem(post.status) < ordem("Em edição") ? "Em edição" : null) : (post.status !== "Publicado" ? "Publicado" : null);
        else novo = it.tipo === "postar" && post.status === "Publicado" ? "Pronto" : it.tipo === "gravar" && post.status === "Em edição" ? "Para gravar" : null;
        if (novo) {
          const antes = post.status;
          try { await salvar({ id: post.id, status: novo }); pintar(); toast(`${post.tema || "Conteúdo"} foi para ${nomeStatus(novo)} no quadro.`); }
          catch (er) { post.status = antes; toast("O plano salvou, mas o quadro não: " + er.message, true); }
          return;
        }
      }
      pintarPlano();
    }));
    $$("[data-tirar]", box).forEach((b) => b.addEventListener("click", async () => {
      const lista = itensDe(b.dataset.onde), i = lista.findIndex((x) => x.id === b.dataset.tirar); if (i < 0) return;
      const [tirado] = lista.splice(i, 1);
      const pp = pl.atual.plano; if (tirado.post_id) pp.tirados = [...new Set([...(pp.tirados || []), `${tirado.tipo}:${tirado.post_id}`])];
      try { await salvarPlano({ plano: pp }); pintarPlano(); } catch (er) { lista.splice(i, 0, tirado); toast(er.message, true); pintarPlano(); }
    }));
    $$("[data-post]", box).forEach((b) => b.addEventListener("click", async () => {
      let p = st.todos.find((x) => String(x.id) === b.dataset.post);
      if (!p) { const { data } = await banco().from("painel_conteudo").select("*").eq("id", b.dataset.post).maybeSingle(); p = data; }
      if (p) abrir(p); else toast("Esse post não existe mais no calendário.", true);
    }));
    $$("[data-ir]", box).forEach((b) => b.addEventListener("click", () => { location.hash = "#" + b.dataset.ir; }));
    // nov/2026 (pedido da Mari: "autonomia de editar e mudar de data arrastando, igual Trello")
    $$(".pq-card[data-item]", box).forEach((c) => {
      c.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plano", c.dataset.item + "|" + c.dataset.onde); e.dataTransfer.effectAllowed = "move"; c.classList.add("arrastando"); });
      c.addEventListener("dragend", () => c.classList.remove("arrastando"));
    });
    $$(".pq-col[data-dia]", box).forEach((col) => {
      col.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("text/plano")) { e.preventDefault(); col.classList.add("alvo"); } });
      col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("alvo"); });
      col.addEventListener("drop", (e) => { e.preventDefault(); col.classList.remove("alvo"); const [id, de] = String(e.dataTransfer.getData("text/plano")).split("|"); moverItemPlano(id, de, col.dataset.dia); });
    });
    $$("[data-mover]", box).forEach((b) => b.addEventListener("click", (e) => {
      e.stopPropagation();
      const dias = (pl.atual.plano.dias || []).filter((d) => d.data !== b.dataset.onde);
      popPlano(b, dias.map((d) => [`${d.nome} · ${brCurta(d.data)}`, () => moverItemPlano(b.dataset.mover, b.dataset.onde, d.data)]), "Mudar para");
    }));
    $$("[data-editar]", box).forEach((b) => b.addEventListener("click", async () => {
      const it = itensDe(b.dataset.onde).find((x) => x.id === b.dataset.editar); if (!it) return;
      const post = it.post_id && acharConteudo(it.post_id);
      if (post) { abrir(post); return; }
      const novo = await painelDialogo.texto("Editar a tarefa:", it.texto || "", { linhas: 2 });
      if (novo == null || !novo.trim()) return;
      const antes = it.texto; it.texto = novo.trim();
      try { await salvarPlano({ plano: pl.atual.plano }); pintarPlano(); } catch (er) { it.texto = antes; toast(er.message, true); }
    }));
    $$("[data-add-dia]", box).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); adicionarNoDia(b, b.dataset.addDia); }));
  }
  // menu pequeno (mesmo visual do ••• do quadro)
  function popPlano(bt, opcoes, titulo) {
    document.querySelectorAll(".pc3-pop").forEach((x) => x.remove());
    const pop = document.createElement("div"); pop.className = "pc3-pop pq-pop";
    pop.innerHTML = (titulo ? `<small>${esc(titulo)}</small>` : "") + opcoes.map(([t], i) => `<button type="button" data-i="${i}">${esc(t)}</button>`).join("");
    document.body.appendChild(pop);
    const r = bt.getBoundingClientRect();
    pop.style.top = Math.max(8, Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 4)) + "px";
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + "px";
    const fechar = () => { pop.remove(); document.removeEventListener("click", fora, true); };
    const fora = (e) => { if (!pop.contains(e.target)) fechar(); };
    setTimeout(() => document.addEventListener("click", fora, true), 0);
    pop.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; fechar(); opcoes[Number(b.dataset.i)][1](); });
  }
  // mover um cartão de dia: muda o plano e a data do próprio conteúdo (postar = publicação, gravar = gravação)
  async function moverItemPlano(id, de, para) {
    if (!pl.atual || !id || de === para) return;
    const plano = pl.atual.plano, origem = itensDe(de), i = origem.findIndex((x) => x.id === id);
    const dia = (plano.dias || []).find((d) => d.data === para); if (i < 0 || !dia) return;
    const [it] = origem.splice(i, 1); dia.itens = dia.itens || []; dia.itens.push(it);
    try { await salvarPlano({ plano }); } catch (er) { dia.itens.pop(); origem.splice(i, 0, it); toast(er.message, true); pintarPlano(); return; }
    const post = it.post_id && acharConteudo(it.post_id);
    if (post) {
      const campo = it.tipo === "gravar" ? "data_gravacao" : "data";
      try { await salvar({ id: post.id, [campo]: para }); } catch (er) { toast("O plano mudou, mas a data do conteúdo não: " + er.message, true); }
    }
    pintar();
    const d = (plano.dias || []).find((x) => x.data === para);
    toast(`${it.tipo === "gravar" ? "Gravação" : "Publicação"} mudada para ${d ? d.nome.toLowerCase() : ""} ${brCurta(para)}.`);
  }
  // + do dia: escolher o que gravar ou postar naquele dia (um conteúdo que já existe ou um novo)
  function adicionarNoDia(bt, dia) {
    popPlano(bt, [
      ["Postar neste dia", () => escolherConteudo(bt, dia, "postar")],
      ["Gravar neste dia", () => escolherConteudo(bt, dia, "gravar")],
    ], `${brCurta(dia)}: o que fazer?`);
  }
  function escolherConteudo(bt, dia, tipo) {
    const campo = tipo === "gravar" ? "data_gravacao" : "data";
    const lista = st.todos.filter((p) => p.status !== "Publicado" && p[campo] !== dia && !/stories/i.test(p.formato || ""))
      .map((p) => ({ p, k: (p.data && p.data < iso(hoje) ? "1" : "0") + String(p.data || "9") })).sort((a, b) => a.k.localeCompare(b.k)).map((x) => x.p).slice(0, 15);
    popPlano(bt, [
      ["+ Novo conteúdo", () => abrir(novoConteudo(tipo === "gravar" ? { data_gravacao: dia, status: "Para gravar" } : { data: dia, status: "Roteirizado" }))],
      ...lista.map((p) => [`${p.tema || "Sem título"}${p.data ? " · " + brCurta(p.data) : ""}`, async () => {
        const pp = pl.atual && pl.atual.plano; if (pp && pp.tirados) pp.tirados = pp.tirados.filter((k) => k !== `${tipo}:${p.id}`);
        try { await salvar({ id: p.id, [campo]: dia }); pintar(); toast(`${p.tema || "Conteúdo"}: ${tipo} em ${brCurta(dia)}.`); } catch (er) { toast(er.message, true); }
      }]),
    ], tipo === "gravar" ? "Gravar qual conteúdo?" : "Postar qual conteúdo?");
  }
  // o plano acompanha os conteúdos: data mudada no calendário ou na janela leva o cartão para o dia certo,
  // e conteúdo com data nesta semana entra sozinho (menos o que ela tirou do plano)
  function sincronizarPlano(p) {
    const dias = p.dias || []; if (!dias.length || !pl.atual) return;
    const datas = new Set(dias.map((d) => d.data)), tirados = new Set(p.tirados || []);
    let mexeu = false;
    const diaDe = (dt) => dias.find((d) => d.data === dt);
    dias.forEach((d) => (d.itens || []).slice().forEach((it) => {
      if (it.tipo !== "gravar" && it.tipo !== "postar") return;
      const post = it.post_id && acharConteudo(it.post_id); if (!post) return;
      const alvo = it.tipo === "gravar" ? post.data_gravacao : post.data;
      if (alvo && alvo !== d.data && datas.has(alvo)) { d.itens.splice(d.itens.indexOf(it), 1); const nd = diaDe(alvo); nd.itens = [...(nd.itens || []), it]; mexeu = true; }
    }));
    const tem = new Set(dias.flatMap((d) => (d.itens || []).filter((it) => it.post_id).map((it) => `${it.tipo}:${it.post_id}`)));
    st.todos.forEach((post) => {
      [["postar", post.data], ["gravar", post.data_gravacao]].forEach(([tipo, dt]) => {
        const k = `${tipo}:${post.id}`;
        if (!dt || !datas.has(dt) || tem.has(k) || tirados.has(k) || /stories/i.test(post.formato || "")) return;
        if (tipo === "gravar" && post.status !== "Ideia" && STATUS.indexOf(post.status) >= STATUS.indexOf("Em edição")) return;
        const nd = diaDe(dt);
        nd.itens = [...(nd.itens || []), { id: `m-${tipo}-${post.id}`, tipo, post_id: post.id, texto: `${tipo === "gravar" ? "Gravar" : "Postar"} ${post.formato || "Reels"}: ${post.tema || "Sem título"}${tipo === "postar" && post.horario ? " às " + post.horario : ""}`, feito: tipo === "postar" && post.status === "Publicado" }];
        tem.add(k); mexeu = true;
      });
    });
    if (mexeu) salvarPlano({ plano: p }).catch(() => { /* aparece certo na tela; salva na próxima mudança */ });
  }

  // ---------- calendário semanal (as mesmas pílulas e o mesmo arrastar do mensal) ----------
  // ---------- 5 semanas (nov/2026, referência da Mari): cada semana numa linha, resumo (posts, topo, meio, fundo, tema),
  // cartões coloridos pelo pilar com "FUNIL · FORMATO" no topo; Stories em texto; gravações e compromissos em pílulas pequenas
  const CORES_5S = [["#a8573f", "#fff"], ["#4a3324", "#fff"], ["#ead08a", "#3d2b20"], ["#c98f5e", "#fff"], ["#8a6650", "#fff"], ["#e3c3a2", "#3d2b20"]];
  const corPilar = (p) => { const i = indicePilar(p.pilar); return CORES_5S[i < 0 ? 4 : i % CORES_5S.length]; };
  function cartao5(p) {
    if (/stories/i.test(p.formato || "")) return `<button type="button" class="pc5-story${p.status === "Publicado" ? " feito" : ""}" data-id="${p.id}" data-arrasta="pub:${p.id}"><b>Stories:</b> ${esc(p.tema || p.hook || "Sem título")}</button>`;
    const [bg, cor] = corPilar(p);
    return `<button type="button" class="pc5-card${p.status === "Publicado" ? " feito" : ""}" style="--bg:${bg};--cor:${cor}" data-id="${p.id}" data-arrasta="pub:${p.id}" title="${esc([p.pilar, p.status, p.horario, ehPubli(p) ? tipoTxt(p) : ""].filter(Boolean).join(" · "))}">
      <small>${funilIc}${esc((p.funil || "Topo").toUpperCase())} · ${esc((p.formato || "Reels").toUpperCase())}${ehPubli(p) ? " · PUBLI" : ""}</small><span>${esc(p.tema || p.hook || "Sem título")}</span></button>`;
  }
  function pintar5(sec) {
    const ini = st.ini5 || segundaDe(iso(hoje)); st.ini5 = ini;
    const br = (d) => `${d.getDate()}/${d.getMonth() + 1}`;
    const semanas = [...Array(5)].map((_, w) => [...Array(7)].map((_, k) => { const d = deIso(ini); d.setDate(d.getDate() + w * 7 + k); return d; }));
    $("#pc-semana-rot", sec).textContent = `${br(semanas[0][0])} a ${br(semanas[4][6])}`;
    const pil = (st.perfil.pilares || []).slice(0, 6), temas = [...new Set(semanas.map((sem) => (st.temas || {})[iso(sem[0])]).filter(Boolean))];
    $("#pc-legenda", sec).innerHTML = pil.map((x, i) => `<span><i style="background:${CORES_5S[i % CORES_5S.length][0]}"></i>${esc(x.nome)}</span>`).join("") + temas.map((t) => `<span class="pc5-tema-leg">${esc(t)}</span>`).join("");
    $("#pc-quadro", sec).innerHTML = semanas.map((sem, n) => {
      const seg = iso(sem[0]), tema = (st.temas || {})[seg], doSem = st.todos.filter((p) => p.data >= iso(sem[0]) && p.data <= iso(sem[6]));
      const conta = (f) => doSem.filter((p) => (p.funil || "") === f).length;
      return `<div class="pc5-sem${sem.some((d) => iso(d) === iso(hoje)) ? " atual" : ""}" id="pc-sem-${n}">
        <div class="pc5-cab"><b>Semana ${n + 1}</b><span>${br(sem[0])} a ${br(sem[6])}</span><span class="pc5-n">${doSem.length} post${doSem.length === 1 ? "" : "s"}</span>
          <span class="pc5-f" title="Topo">${funilIc}T ${conta("Topo")}</span><span class="pc5-f" title="Meio">${funilIc}M ${conta("Meio")}</span><span class="pc5-f" title="Fundo">${funilIc}F ${conta("Fundo")}</span>
          <button type="button" class="pc5-tema${tema ? " tem" : ""}" data-tema="${seg}" title="Tema ou campanha da semana">${tema ? esc(tema) : "+ tema da semana"}</button></div>
        <div class="pc5-grade">${sem.map((d) => { const s2 = iso(d), ps = st.todos.filter((p) => p.data === s2).sort((a, b) => String(a.horario || "").localeCompare(String(b.horario || "")));
          const gravs = st.todos.filter((p) => p.data_gravacao === s2 && p.status !== "Publicado").map((p) => `<button type="button" class="pc3-pill k-grav" data-id="${p.id}" data-arrasta="grav:${p.id}">Gravar: ${esc(p.tema || "Sem título")}</button>`).join("");
          const comp = (st.agenda || []).filter((x) => x.data === s2).map((x) => `<button type="button" class="pc3-pill k-comp" ${x.ir ? `data-ir="${x.ir}"` : ""} title="${esc(x.rotulo + ": " + x.texto)}">${esc(x.texto)}</button>`).join("");
          return `<div class="pc3-dia pc5-dia${s2 === iso(hoje) ? " hoje" : ""}" data-dia="${s2}"><div class="pc3-dia-cab"><span><small>${DIAS[(d.getDay() + 6) % 7]}</small><b>${d.getDate()}</b></span><button type="button" class="pc3-add" data-novo="${s2}" aria-label="Novo post em ${br(d)}">${ic.mais}</button></div>${ps.map(cartao5).join("")}${gravs}${comp}</div>`; }).join("")}</div></div>`;
    }).join("");
  }
  function pintarSemanal(sec) {
    const semana = st.cal === "semana";
    $$("[data-calvista]", sec).forEach((b) => b.classList.toggle("ativa", b.dataset.calvista === st.cal));
    $("#pc-quadro", sec).hidden = semana; $("#pc-semanal", sec).hidden = !semana;
    if (st.cal === "5sem") { pintar5(sec); return; }
    if (!semana) return;
    const ini = st.semIni || segundaDe(iso(hoje)); st.semIni = ini;
    const dias = [...Array(7)].map((_, k) => { const d = deIso(ini); d.setDate(d.getDate() + k); return d; });
    const br = (d) => `${d.getDate()}/${pad(d.getMonth() + 1)}`;
    $("#pc-semana-rot", sec).textContent = `${br(dias[0])} a ${br(dias[6])}`;
    $("#pc-semanal", sec).innerHTML = `<div class="pc3-cal-dias">${DIAS.map((d) => `<span>${d}</span>`).join("")}</div><div class="pc3-grade pc3-grade-semana">${dias.map((d) => celulaDia(d, false)).join("")}</div>`;
  }

  // ---------- regras dos números (cada conteúdo conta uma vez em cada indicador) ----------
  // planejado = publicação no mês; sem roteiro = Ideia; em andamento = Roteirizado + Para gravar + Em edição;
  // agendado = Pronto com publicação de hoje em diante; publicado = Publicado; pendente = publicação já passou e não publicou
  const ANDAMENTO = ["Roteirizado", "Para gravar", "Em edição"];
  const contar = (lista, sts) => lista.filter((p) => sts.includes(p.status)).length;
  const dataCurta = (d) => { if (!d) return ""; const x = deIso(d); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`; };
  const pendente = (p) => p.data && p.data < iso(hoje) && p.status !== "Publicado";
  const slugSt = (x) => semAcento(x).replace(/[^a-z]+/g, "-");
  function pintarGeral(sec) {
    const box = $("#pc-geral", sec); if (!box) return;
    const T = st.todos, hj = iso(hoje);
    const mesAtual = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`, doMes = T.filter((p) => p.data && p.data.startsWith(mesAtual));
    const pub = contar(doMes, ["Publicado"]), pct = doMes.length ? Math.round((pub / doMes.length) * 100) : 0;
    const agend = doMes.filter((p) => p.status === "Pronto" && p.data >= hj).length, pend = T.filter(pendente).length;
    const anel = `<svg class="pc3-anel" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="50"/><circle cx="60" cy="60" r="50" style="stroke-dasharray:${(pct / 100) * 314.16} 314.16"/></svg>`;
    box.innerHTML = `<div class="pc3-geral">
      <div class="pc3-col-esq">
        <!-- Próximos conteúdos saiu (nov/2026, pedido da Mari): repetia o Plano da semana e o Calendário -->
        <section class="pc3-bloco" id="pc-plano-bloco"><div class="pc-plano" id="pc-plano"></div></section>
      </div>
      <aside class="pc3-col-dir">
        <section class="pc3-bloco pc3-mes">
          <h3 class="pc2-h">${esc(MESES[hoje.getMonth()][0].toUpperCase() + MESES[hoje.getMonth()].slice(1))}</h3>
          <div class="pc3-anel-box">${anel}<b>${pct}%</b><small>publicado</small></div>
          <dl class="pc3-stats"><div><dt>Planejados</dt><dd>${doMes.length}</dd></div><div><dt>Em andamento</dt><dd>${contar(doMes, ANDAMENTO)}</dd></div><div><dt>Agendados</dt><dd>${agend}</dd></div><div><dt>Publicados</dt><dd>${pub}</dd></div></dl>
          ${pend ? `<button type="button" class="pc3-pend" data-ir-parte="quadro">${pend} ${pend === 1 ? "conteúdo passou" : "conteúdos passaram"} da data sem publicar · ver no quadro</button>` : ""}
        </section>
      </aside></div>`;
    $$("[data-ir-parte]", box).forEach((b) => b.addEventListener("click", () => st.mostrarParte(b.dataset.irParte)));
    ligarCliques(box);
    pintarPlano();
  }

  // ---------- quadro de produção (colunas = status; arrastar muda o status do mesmo registro) ----------
  function filtrados(base) {
    const f = st.filtro, q = semAcento(f.q);
    return (base || st.todos).filter((p) => (!q || semAcento(p.tema).includes(q)) && (!f.nicho || (p.nicho || p.pilar) === f.nicho) && (!f.formato || p.formato === f.formato) && (!f.funil || p.funil === f.funil)
      && (!f.tipo || (f.tipo === "Publi" ? ehPubli(p) : !ehPubli(p) && p.tipo_conteudo === f.tipo)));
  }
  const corNicho = (n) => { const k = NICHOS.indexOf(n); return k < 0 ? "x" : String(k); };
  const icCal = '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/></svg>';
  const icCam = '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="12.5" height="10" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3z"/></svg>';
  // cor do pilar (a mesma do calendário, paleta dela); nicho sem pilar usa a cor do nicho
  const corDoCartao = (p) => { const k = indicePilar(p.pilar); if (k >= 0) return CORES_5S[k % CORES_5S.length]; const n = NICHOS.indexOf(p.nicho); return n >= 0 ? CORES_5S[n % CORES_5S.length] : ["#d8c8b6", "#3d2b20"]; };
  const icRot = '<svg class="traco" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4M10 12h5M10 15.5h5"/></svg>';
  function cartaoKanban(p) {
    const nicho = p.nicho || p.pilar, [bg] = corDoCartao(p), atrasado = pendente(p) && p.status !== ARQ;
    return `<article class="pc3-card qp-card${atrasado ? " atrasado" : ""}" draggable="true" data-id="${p.id}" tabindex="0" style="--pil:${bg}">
      <div class="pc3-card-top"><span class="qp-tags">${nicho ? `<span class="qp-chip">${esc(nicho)}</span>` : `<span class="qp-chip qp-sem">sem nicho</span>`}${ehPubli(p) ? `<span class="qp-publi">Publi${p.marca ? " · " + esc(p.marca) : ""}</span>` : ""}</span><button type="button" class="pc3-menu" data-menu="${p.id}" aria-label="Opções">•••</button></div>
      <b>${esc(p.tema || "Sem título")}</b>
      <div class="qp-meta"><span>${esc([p.formato, ehPubli(p) ? "" : p.tipo_conteudo].filter(Boolean).join(" · ") || "Reels")}</span>${p.roteiro_id ? `<span class="qp-rot" title="Tem roteiro: abre dentro do cartão">${icRot}roteiro</span>` : ""}</div>
      <div class="pc3-card-rodape">${p.data ? `<span class="${atrasado ? "qp-atraso" : ""}" title="${atrasado ? "Passou da data de publicação" : "Publicação"}">${icCal}${dataCurta(p.data)}</span>` : `<span class="vazio">sem data</span>`}${p.data_gravacao && p.status !== "Publicado" ? `<span title="Gravação">${icCam}${dataCurta(p.data_gravacao)}</span>` : ""}</div>
    </article>`;
  }
  function pintarKanban(sec) {
    const box = $("#pc-kanban", sec); if (!box) return;
    const f = st.filtro, lista = filtrados(), arq = filtrados(st.arquivados || []);
    const nichos = [...new Set([...NICHOS, ...st.todos.map((p) => p.nicho || p.pilar).filter(Boolean)])];
    const sel = (k, rot, ops) => `<select class="entrada" data-filtro="${k}" aria-label="${rot}"><option value="">${rot}</option>${ops.map((o) => `<option ${f[k] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    const foco = document.activeElement && document.activeElement.id === "pc-busca";
    const atrasados = st.todos.filter(pendente);
    const comRot = st.todos.filter((p) => p.roteiro_id).length;
    box.innerHTML = `<div class="pc3-painel qp">
      <div class="qp-topo"><div><h3 class="pc2-h">Quadro de <em>produção</em></h3><p class="pc-ajuda">Cada cartão é um conteúdo, do roteiro ao publicado. O roteiro abre dentro do cartão${comRot ? ` (${comRot} ${comRot === 1 ? "cartão tem" : "cartões têm"} roteiro)` : ""}.</p></div>
        <div class="qp-topo-acoes">${atrasados.length ? `<button type="button" class="btn qp-btn-arq" id="pc-arquivar">${atrasados.length} ${atrasados.length === 1 ? "atrasado" : "atrasados"}: arquivar</button>` : ""}<button type="button" class="btn" id="pc-novo-rot">${icRot}Novo roteiro</button></div></div>
      <div class="pc3-painel-cab"><div class="pc2-filtros"><input class="entrada" type="search" id="pc-busca" placeholder="Buscar pelo título" value="${esc(f.q)}">
        ${sel("nicho", "Nicho", nichos)}${sel("formato", "Formato", FORMATOS)}${sel("funil", "Funil", FUNIS)}${sel("tipo", "Tipo", ["Orgânico", "UGC", "Publi"])}
        ${f.q || f.nicho || f.formato || f.funil || f.tipo ? `<button type="button" class="pc2-link" id="pc-limpar">limpar</button>` : ""}</div></div>
      <div class="pc2-kanban pc3-kanban">${COLUNAS.map((col) => {
        let cards = col === ARQ ? arq : lista.filter((p) => p.status === col);
        const total = cards.length;
        if (col === "Publicado" || col === ARQ) cards = cards.sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))).slice(0, 30);
        else cards = cards.sort((a, b) => String(a.data || "9").localeCompare(String(b.data || "9")));
        const cor = COR_STATUS[col] || "#a87058", fechada = col === ARQ && !st.verArq;
        return `<section class="pc2-col pc3-col qp-col${col === ARQ ? " qp-arq" : ""}${fechada ? " fechada" : ""}" data-col="${esc(col)}" style="--cor:${cor}"><div class="pc2-col-cab"><i class="pc3-ponto"></i><b>${esc(nomeStatus(col))}</b><span>${total}</span>${col === ARQ ? `<button type="button" class="pc2-link qp-ver-arq" id="pc-ver-arq">${fechada ? "ver" : "fechar"}</button>` : `<button type="button" class="pc2-mais" data-criar="${esc(col)}" aria-label="Adicionar em ${esc(nomeStatus(col))}">${ic.mais}</button>`}</div>
          <div class="pc2-col-lista">${fechada ? `<p class="pc2-vazio pc3-vazio">${total ? "Conteúdos que não vão sair. Arraste para cá ou toque em ver." : "Arraste para cá o que não vai mais sair"}</p>` : cards.map(cartaoKanban).join("") || `<p class="pc2-vazio pc3-vazio">Arraste para cá</p>`}</div></section>`;
      }).join("")}</div></div>`;
    ligarCliques(box);
    const busca = $("#pc-busca", box);
    busca.addEventListener("input", () => { st.filtro.q = busca.value; pintarKanban(sec); });
    if (foco) { const b = $("#pc-busca", box); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    $$("[data-filtro]", box).forEach((x) => x.addEventListener("change", () => { st.filtro[x.dataset.filtro] = x.value; pintarKanban(sec); }));
    const lp = $("#pc-limpar", box); if (lp) lp.addEventListener("click", () => { st.filtro = { q: "", nicho: "", formato: "", funil: "", tipo: "" }; pintarKanban(sec); });
    const va = $("#pc-ver-arq", box); if (va) va.addEventListener("click", () => { st.verArq = !st.verArq; pintarKanban(sec); });
    const nr = $("#pc-novo-rot", box); if (nr) nr.addEventListener("click", () => { if (window.painelSkill) window.painelSkill.criarRoteiro({}); });
    const ar = $("#pc-arquivar", box); if (ar) ar.addEventListener("click", async () => {
      const lista2 = st.todos.filter(pendente);
      const nomes = lista2.slice(0, 8).map((p) => `• ${p.tema || "Sem título"} (${dataCurta(p.data)})`).join("\n") + (lista2.length > 8 ? `\n• e mais ${lista2.length - 8}` : "");
      if (!(await painelDialogo.confirmar(`Arquivar ${lista2.length} ${lista2.length === 1 ? "conteúdo que passou" : "conteúdos que passaram"} da data sem publicar?\n\n${nomes}\n\nEles saem do calendário e da semana, mas ficam na coluna Arquivado. Dá para trazer de volta arrastando.`, { ok: "Arquivar" }))) return;
      ar.disabled = true; let n = 0;
      for (const p of lista2) { try { await salvar({ id: p.id, status: ARQ }); n++; } catch (e) { /* segue com os outros */ } }
      pintar(); toast(`${n} ${n === 1 ? "conteúdo arquivado" : "conteúdos arquivados"}.`);
    });
    $$("[data-criar]", box).forEach((b) => b.addEventListener("click", () => abrir(novoConteudo({ status: b.dataset.criar }))));
    $$("[data-menu]", box).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); menuCartao(b, acharConteudo(b.dataset.menu)); }));
    $$(".pc3-card", box).forEach((c) => { c.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/kanban", c.dataset.id); c.classList.add("arrastando"); }); c.addEventListener("dragend", () => c.classList.remove("arrastando")); c.addEventListener("keydown", (e) => { if (e.key === "Enter") c.click(); }); });
    $$(".pc2-col", box).forEach((col) => {
      col.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("text/kanban")) { e.preventDefault(); col.classList.add("alvo"); } });
      col.addEventListener("dragleave", () => col.classList.remove("alvo"));
      col.addEventListener("drop", (e) => { e.preventDefault(); col.classList.remove("alvo"); moverStatus(e.dataTransfer.getData("text/kanban"), col.dataset.col); });
    });
  }
  async function moverStatus(id, status) {
    const p = acharConteudo(id); if (!p || !status || p.status === status) return;
    try { await salvar({ id: p.id, status }); pintar(); toast(`${p.tema || "Conteúdo"}: ${nomeStatus(status)}.`); } catch (er) { toast(er.message, true); }
  }
  async function excluirConteudo(p) {
    if (!(await painelDialogo.confirmar(`Excluir "${p.tema || "este conteúdo"}"? Ele sai do quadro, do calendário e da semana.${p.roteiro_id ? " O roteiro continua guardado no editor de roteiros." : ""}`, { ok: "Excluir", perigo: true }))) return false;
    const { error } = await banco().from("painel_conteudo").delete().eq("id", p.id);
    if (error) { toast(error.message, true); return false; }
    st.todos = st.todos.filter((x) => x.id !== p.id); st.arquivados = (st.arquivados || []).filter((x) => x.id !== p.id);
    if (st.ideias) st.ideias.forEach((it) => { if (it.post_id === p.id) it.post_id = null; });
    pintar(); toast("Conteúdo excluído."); return true;
  }
  // menu ••• do cartão: editar, mover (útil no celular, onde não dá para arrastar) e excluir
  function menuCartao(bt, p) {
    if (!p) return;
    document.querySelectorAll(".pc3-pop").forEach((x) => x.remove());
    const pop = document.createElement("div"); pop.className = "pc3-pop";
    pop.innerHTML = `<button type="button" data-a="abrir">Abrir e editar</button>${p.roteiro_id ? `<button type="button" data-a="roteiro">Editar roteiro</button>` : ""}${COLUNAS.filter((x) => x !== p.status).map((x) => `<button type="button" data-a="mover" data-v="${esc(x)}">${x === ARQ ? "Arquivar" : "Mover para " + esc(nomeStatus(x))}</button>`).join("")}<button type="button" data-a="excluir" class="perigo">Excluir</button>`;
    document.body.appendChild(pop);
    const r = bt.getBoundingClientRect();
    pop.style.top = Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 4) + "px";
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.right - pop.offsetWidth)) + "px";
    const fechar = () => { pop.remove(); document.removeEventListener("click", fora, true); };
    const fora = (e) => { if (!pop.contains(e.target)) fechar(); };
    setTimeout(() => document.addEventListener("click", fora, true), 0);
    pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]"); if (!b) return; fechar();
      if (b.dataset.a === "roteiro") { if (window.painelSkill) window.painelSkill.abrirRoteiro(p.roteiro_id); return; }
      if (b.dataset.a === "abrir") abrir(p); else if (b.dataset.a === "mover") moverStatus(p.id, b.dataset.v); else excluirConteudo(p);
    });
  }

  // ---------- banco de ideias (tabela ideias_organizadas; ideia só vira conteúdo pelo botão Transformar em conteúdo) ----------
  const SITUACOES = [["minha", "Minhas ideias"], ["desenvolver", "Para desenvolver"], ["descartada", "Descartadas"]];
  async function carregarIdeias() {
    const { data, error } = await banco().from("ideias_organizadas").select("*").order("criado_em", { ascending: false }).limit(1000);
    st.ideias = error ? [] : (data || []);
  }
  async function salvarIdeia(campos, id) {
    const dados = { ...campos, atualizado_em: new Date().toISOString() };
    if (id) {
      const { error } = await banco().from("ideias_organizadas").update(dados).eq("id", id); if (error) throw new Error(error.message);
      const it = st.ideias.find((x) => x.id === id); if (it) Object.assign(it, dados); return it;
    }
    const { data, error } = await banco().from("ideias_organizadas").insert(dados).select().maybeSingle(); if (error) throw new Error(error.message);
    const novo = data || { ...dados, id: Date.now(), criado_em: new Date().toISOString() }; st.ideias.unshift(novo); return novo;
  }
  // o que um conteúdo leva para a Skill UGC (Meus roteiros)
  function ideiaDoConteudo(o, insp) {
    return [o.tema && "Tema: " + o.tema, o.proposito && "Objetivo: " + o.proposito, o.hook && "Gancho que eu pensei: " + o.hook, o.desenvolvimento && "Rascunho:\n" + o.desenvolvimento, o.cta && "CTA: " + o.cta, o.notas && "Notas: " + o.notas, insp && insp.link && "Inspiração: " + insp.link].filter(Boolean).join("\n");
  }
  async function desenvolverComIA(p) {
    const notas = `DESENVOLVER ESTA IDEIA DELA EM ROTEIRO: "${p.tema || ""}". ${p.notas ? "Observações dela: " + p.notas + "." : ""} ${p.inspiracao && p.inspiracao.link ? "Inspiração: " + p.inspiracao.link + "." : ""} Mantenha o tema dela.`;
    const ideias = await chamarIdeias({ acao: "ideias", rotulo: rotuloMes(mesDe(p) || st.mes), notas, quantidade: 1, evitar: st.todos.filter((x) => x.id !== p.id).map((x) => x.tema),
      slots: [{ pilar: p.pilar || "", funil: p.funil || "Topo", formato: p.formato || "Reels" }] });
    const x = ideias[0]; if (!x) throw new Error("A IA não devolveu o roteiro. O conteúdo ficou criado; tente de novo pela janela dele.");
    return salvar({ id: p.id, tipo_conteudo: p.tipo_conteudo || x.tipo_conteudo || null, nicho: p.nicho || x.nicho || null,
      tipo_ugc: x.tipo_ugc, proposito: x.proposito, hook: x.hook, ganchos: x.ganchos, desenvolvimento: x.desenvolvimento, cta: x.cta, tipo_roteiro: x.tipo_roteiro, legenda: x.legenda, porque: x.porque });
  }
  const transformando = new Set();
  function janelaIdeia(titulo, corpo, okTxt) {
    return new Promise((res) => {
      const d = document.createElement("dialog"); d.className = "janela pc3-janela";
      d.innerHTML = `<form method="dialog"><div class="janela-cabeca"><h2>${titulo}</h2></div><div class="janela-corpo pc3-form">${corpo}</div>
        <div class="janela-rodape"><button class="btn" type="button" data-x>Cancelar</button><button class="btn btn-principal" type="submit">${okTxt}</button></div></form>`;
      document.body.appendChild(d); let val = null;
      d.querySelector("[data-x]").onclick = () => d.close();
      d.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); val = Object.fromEntries(new FormData(e.target)); d.close(); });
      d.addEventListener("close", () => { d.remove(); res(val); });
      d.showModal();
    });
  }
  async function transformarIdeia(it) {
    const ja = it.post_id && st.todos.find((p) => p.id === it.post_id);
    if (ja) { toast("Essa ideia já virou conteúdo. Abrindo."); abrir(ja); return; }
    if (transformando.has(it.id)) return;
    const v = await janelaIdeia("Transformar em conteúdo", `<p class="pc-ajuda">"${esc(it.titulo || it.texto || "")}" entra no Quadro de produção. A ideia continua guardada e ligada a ele.</p>
      <label class="campo"><span>Começa em</span><select name="status"><option value="Ideia">Sem roteiro</option><option value="Roteirizado">Roteirizado (a Skill UGC escreve o roteiro em Meus roteiros)</option><option value="Para gravar">Para gravar</option></select></label>
      <div class="pc-grade2"><label class="campo"><span>Gravação (opcional)</span><input type="date" name="data_gravacao"></label><label class="campo"><span>Publicação (opcional)</span><input type="date" name="data"></label></div>
      <div class="pc-grade2"><label class="campo"><span>Formato</span><select name="formato">${FORMATOS.map((f) => `<option ${f === (it.formato || "Reels") ? "selected" : ""}>${f}</option>`).join("")}</select></label><label class="campo"><span>Funil</span><select name="funil">${FUNIS.map((f) => `<option ${f === (it.funil || "Topo") ? "selected" : ""}>${f}</option>`).join("")}</select></label></div>`, "Transformar");
    if (!v) return;
    transformando.add(it.id); pintar();
    try {
      const nicho = NICHOS.includes(it.categoria) ? it.categoria : null;
      const novo = await salvar({ tema: it.titulo || String(it.texto || "").slice(0, 120), nicho, pilar: it.pilar || (!nicho ? it.categoria : null) || null, formato: v.formato, funil: v.funil, status: v.status === "Roteirizado" ? "Ideia" : v.status,
        data: v.data || null, data_gravacao: v.data_gravacao || null, mes: (v.data || "").slice(0, 7) || st.mes, notas: [it.notas, it.resumo].filter(Boolean).join("\n") || null, hook: it.gancho || null, desenvolvimento: it.roteiro || null,
        marca: it.finalidade === "Publi" ? it.marca || null : null, tipo_conteudo: it.finalidade === "Publi" ? "Publi" : it.finalidade === "Conteúdos" ? "Orgânico" : it.finalidade === "UGC" ? "UGC" : null,
        inspiracao: it.link ? { link: it.link } : null });
      await salvarIdeia({ post_id: novo.id }, it.id);
      if (v.status === "Roteirizado") {
        // a Skill UGC é o motor único de roteiro: abre Meus roteiros com a ideia; ao salvar lá, o conteúdo fica ligado e vira Roteirizado
        toast("Conteúdo criado. Abrindo a Skill UGC no editor de roteiros…");
        if (window.painelSkill) window.painelSkill.criarRoteiro({ conteudoId: novo.id, ideia: ideiaDoConteudo(novo, novo.inspiracao), inicial: { formato: /tiktok/i.test(novo.formato || "") ? "TikTok" : /stor/i.test(novo.formato || "") ? "Stories" : /carross/i.test(novo.formato || "") ? "Carrossel" : "Reels" } });
      } else toast(`Conteúdo criado em ${v.status === "Ideia" ? "Sem roteiro" : v.status} no quadro.`);
    } catch (er) { toast("Não consegui transformar: " + er.message, true); }
    transformando.delete(it.id); pintar();
  }
  function camposIdeia(it) {
    return `<label class="campo"><span>Ideia</span><input name="titulo" required value="${esc(it.titulo || "")}"></label>
      <div class="pc-grade2"><label class="campo"><span>Nicho</span><select name="categoria"><option value=""></option>${[...new Set([...NICHOS, ...(it.categoria ? [it.categoria] : [])])].map((n) => `<option ${n === it.categoria ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label class="campo"><span>Pilar</span><select name="pilar"><option value=""></option>${[...new Set([...(st.perfil.pilares || []).map((x) => x.nome), ...(it.pilar ? [it.pilar] : [])])].map((n) => `<option ${n === it.pilar ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label></div>
      <label class="campo"><span>Link de inspiração</span><input name="link" type="url" placeholder="https://" value="${esc(it.link || "")}"></label>
      <label class="campo"><span>Observações</span><textarea name="notas" rows="3">${esc(it.notas || it.resumo || "")}</textarea></label>
      <label class="campo"><span>Situação</span><select name="situacao">${SITUACOES.map(([k, t]) => `<option value="${k}" ${k === (it.situacao || "minha") ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  }
  function pintarIdeias(sec) {
    const box = $("#pc-ideias", sec); if (!box) return;
    if (!st.ideias) { box.innerHTML = `<p class="pc-ajuda">Carregando ideias…</p>`; return; }
    const sit = st.ideiaSit || "minha", nf = st.ideiaFiltro, q = semAcento(st.ideiaBusca || "");
    const daSit = st.ideias.filter((it) => (it.situacao || "minha") === sit);
    const lista = daSit.filter((it) => (!nf || it.categoria === nf) && (!q || semAcento([it.titulo, it.texto, it.notas, it.resumo].join(" ")).includes(q)));
    const nichos = [...new Set([...NICHOS, ...st.ideias.map((it) => it.categoria).filter(Boolean)])];
    const foco = document.activeElement && document.activeElement.id === "pc-ideia-busca";
    box.innerHTML = `<div class="pc3-painel">
      <form class="pc3-rapida" id="pc-ideia-rapida"><input class="entrada" name="titulo" required placeholder="Escreva uma ideia e aperte Enter"><select class="entrada" name="categoria" aria-label="Nicho"><option value="">Nicho</option>${NICHOS.map((n) => `<option>${esc(n)}</option>`).join("")}</select><select class="entrada" name="pilar" aria-label="Pilar"><option value="">Pilar</option>${(st.perfil.pilares || []).map((x) => `<option>${esc(x.nome)}</option>`).join("")}</select><button class="btn btn-principal" type="submit">${ic.mais}Guardar</button><button class="btn" type="button" data-organizar title="Escreva solto ou cole um print: a IA separa as ideias">Organizar ideia ou print</button></form>
      <div class="pc3-ideias-cab"><nav class="pc2-seg" aria-label="Situação">${SITUACOES.map(([k, t]) => `<button type="button" data-sit="${k}" class="${k === sit ? "ativa" : ""}">${t} <small>${st.ideias.filter((it) => (it.situacao || "minha") === k).length}</small></button>`).join("")}</nav>
        <div class="pc2-filtros"><input class="entrada" type="search" id="pc-ideia-busca" placeholder="Pesquisar ideias" value="${esc(st.ideiaBusca || "")}"><select class="entrada" id="pc-ideia-nicho" aria-label="Nicho"><option value="">Todos os nichos</option>${nichos.map((n) => `<option ${nf === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div></div>
      ${lista.length ? `<div class="pc3-ideias">${lista.map((it) => { const virou = it.post_id && st.todos.some((p) => p.id === it.post_id); return `<article class="pc3-ideia">
          <div class="pc3-card-top">${it.categoria ? `<span class="pc3-chip c-${corNicho(it.categoria)}">${esc(it.categoria)}</span>` : "<span></span>"}<small>${it.criado_em ? dataCurta(String(it.criado_em).slice(0, 10)) : ""}</small></div>
          <b>${esc(it.titulo || String(it.texto || "").slice(0, 120) || "Sem título")}</b>
          ${it.notas || it.resumo ? `<p>${esc(String(it.notas || it.resumo).slice(0, 160))}</p>` : ""}
          ${it.link ? `<a class="pc3-link" href="${esc(it.link)}" target="_blank" rel="noopener">inspiração</a>` : ""}
          <div class="pc3-ideia-acoes">${virou ? `<button type="button" class="btn btn-mini" data-ver="${it.id}">Ver conteúdo</button>` : `<button type="button" class="btn btn-mini btn-principal" data-transformar="${it.id}" ${transformando.has(it.id) ? "disabled" : ""}>${transformando.has(it.id) ? "Criando…" : "Transformar em conteúdo"}</button>`}
            <button type="button" class="btn btn-mini" data-editar-ideia="${it.id}">Editar</button><button type="button" class="btn btn-mini btn-perigo" data-apagar-ideia="${it.id}" aria-label="Excluir ideia">${ic.lixo}</button></div>
        </article>`; }).join("")}</div>`
        : `<p class="pc-ajuda pc3-vazio">${daSit.length ? "Nenhuma ideia com esse filtro." : sit === "minha" ? "Nenhuma ideia guardada ainda. Escreva acima." : "Nada aqui."}</p>`}
    </div>`;
    const acha = (id) => st.ideias.find((x) => String(x.id) === String(id));
    const org = $("[data-organizar]", box); if (org) org.addEventListener("click", () => { location.hash = "#ferideias"; });
    $("#pc-ideia-rapida", box).addEventListener("submit", async (e) => {
      e.preventDefault(); const fd = new FormData(e.target), v = (k) => String(fd.get(k) || "").trim();
      try { await salvarIdeia({ titulo: v("titulo"), texto: v("titulo"), categoria: v("categoria") || null, pilar: v("pilar") || null, situacao: sit === "descartada" ? "minha" : sit }); pintarIdeias(sec); toast("Ideia guardada."); $("#pc-ideia-rapida input", box) && $("#pc-ideia-rapida [name=titulo]", $("#pc-ideias")).focus(); }
      catch (er) { toast("Não consegui guardar: " + er.message, true); }
    });
    $$("[data-sit]", box).forEach((b) => b.addEventListener("click", () => { st.ideiaSit = b.dataset.sit; pintarIdeias(sec); }));
    const bu = $("#pc-ideia-busca", box); bu.addEventListener("input", () => { st.ideiaBusca = bu.value; pintarIdeias(sec); });
    if (foco) { const b = $("#pc-ideia-busca", box); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    $("#pc-ideia-nicho", box).addEventListener("change", (e) => { st.ideiaFiltro = e.target.value; pintarIdeias(sec); });
    $$("[data-transformar]", box).forEach((b) => b.addEventListener("click", () => { const it = acha(b.dataset.transformar); if (it) transformarIdeia(it); }));
    $$("[data-ver]", box).forEach((b) => b.addEventListener("click", () => { const it = acha(b.dataset.ver); const p = it && st.todos.find((x) => x.id === it.post_id); if (p) abrir(p); }));
    $$("[data-editar-ideia]", box).forEach((b) => b.addEventListener("click", async () => {
      const it = acha(b.dataset.editarIdeia); if (!it) return;
      const v = await janelaIdeia("Editar ideia", camposIdeia(it), "Salvar"); if (!v) return;
      try { await salvarIdeia({ titulo: v.titulo.trim(), categoria: v.categoria || null, pilar: v.pilar || null, link: v.link.trim() || null, notas: v.notas.trim() || null, situacao: v.situacao }, it.id); pintarIdeias(sec); toast("Ideia salva."); }
      catch (er) { toast("Não salvou: " + er.message, true); }
    }));
    $$("[data-apagar-ideia]", box).forEach((b) => b.addEventListener("click", async () => {
      const it = acha(b.dataset.apagarIdeia); if (!it) return;
      if (!(await painelDialogo.confirmar(`Excluir a ideia "${it.titulo || ""}"?${it.post_id ? " O conteúdo que veio dela continua no quadro." : ""}`, { ok: "Excluir", perigo: true }))) return;
      const { error } = await banco().from("ideias_organizadas").delete().eq("id", it.id);
      if (error) { toast(error.message, true); return; }
      st.ideias = st.ideias.filter((x) => x.id !== it.id); pintarIdeias(sec); toast("Ideia excluída.");
    }));
  }
  // ---------- GANCHOS MAGNÉTICOS (nov/2026, carrossel "40 ideias de ganchos" da @giubeckers) ----------
  // Tabela ganchos (só a dona): texto (modelo com [campos]), tipo Verbal | Textual | Visual | Microgancho, exemplo (na voz dela),
  // origem (@giubeckers, Agente diário, Minha), referencia (link), lote (dia em que chegou), status Para testar | Testando |
  // Funcionou | Não funcionou, favorito, post_id (conteúdo em que está sendo testado), resultado, usos.
  // A tarefa diária dos Salvos (Claude, 14h) acrescenta ganchos novos com origem "Agente diário" e lote = o dia.
  // Na janela do conteúdo, "Usar um gancho magnético" põe o gancho no Hook e marca o teste naquele conteúdo.
  const TIPOS_G = [["Verbal", "o que você fala nos primeiros segundos"], ["Textual", "a head que aparece na tela"], ["Visual", "o que a pessoa vê antes de processar sua fala"], ["Microgancho", "para continuar assistindo até o final"]];
  const STATUS_G = ["Para testar", "Testando", "Funcionou", "Não funcionou"];
  const ORDEM_ESC = { Funcionou: 0, "Para testar": 1, Testando: 2, "Não funcionou": 3 };
  const COR_G = { Verbal: "0", Textual: "1", Visual: "2", Microgancho: "3" };
  const hojeIso = () => iso(new Date());
  async function carregarGanchos() {
    const { data, error } = await banco().from("ganchos").select("*").order("criado_em", { ascending: false }).order("id").limit(2000);
    if (error) { st.ganchos = []; st.ganchosErro = /does not exist|relation|schema cache/i.test(error.message) ? "tabela" : error.message; return; }
    st.ganchosErro = null; st.ganchos = data || [];
  }
  async function salvarGancho(campos, id) {
    const dados = { ...campos, atualizado_em: new Date().toISOString() };
    if (id) {
      const { error } = await banco().from("ganchos").update(dados).eq("id", id); if (error) throw new Error(error.message);
      const g = (st.ganchos || []).find((x) => x.id === id); if (g) Object.assign(g, dados); return g;
    }
    const { data, error } = await banco().from("ganchos").insert(dados).select().maybeSingle();
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "Esse gancho já está na lista." : error.message);
    st.ganchos = [data, ...(st.ganchos || [])]; return data;
  }
  const semAspas = (t) => String(t || "").trim().replace(/^["“]+|["”]+$/g, "");
  function camposGancho(g) {
    return `<label class="campo"><span>Gancho (modelo, use [colchetes] no que muda)</span><textarea name="texto" rows="2" required>${esc(g.texto || "")}</textarea></label>
      <div class="pc-grade2"><label class="campo"><span>Tipo</span><select name="tipo">${TIPOS_G.map(([t]) => `<option ${t === (g.tipo || "Verbal") ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="campo"><span>Status</span><select name="status">${STATUS_G.map((t) => `<option ${t === (g.status || "Para testar") ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
      <label class="campo"><span>Na minha voz (exemplo)</span><textarea name="exemplo" rows="2">${esc(g.exemplo || "")}</textarea></label>
      <label class="campo"><span>Resultado do teste</span><textarea name="resultado" rows="2" placeholder="Ex.: Reels de [data], retenção nos 3 s, visualizações, comentários">${esc(g.resultado || "")}</textarea></label>
      <label class="campo"><span>Link de referência</span><input name="referencia" type="url" placeholder="https://" value="${esc(g.referencia || "")}"></label>`;
  }
  function pintarGanchos(sec) {
    const box = $("#pc-ganchos", sec); if (!box) return;
    if (!st.ganchos) { box.innerHTML = `<p class="pc-ajuda">Carregando ganchos…</p>`; return; }
    if (st.ganchosErro) { box.innerHTML = `<p class="pc-ajuda pc3-vazio">${st.ganchosErro === "tabela" ? "A lista de ganchos ainda não foi criada no banco." : "Não consegui carregar os ganchos: " + esc(st.ganchosErro)}</p>`; return; }
    const todos = st.ganchos, tipo = st.gTipo || "", stt = st.gStatus || "", ori = st.gOrigem || "", q = semAcento(st.gBusca || "");
    const lista = todos.filter((g) => (!tipo || g.tipo === tipo) && (!stt || g.status === stt) && (!ori || g.origem === ori || (ori === "Outras" && !["@giubeckers", "Agente diário", "Minha"].includes(g.origem))) && (!st.gFav || g.favorito)
      && (!q || semAcento([g.texto, g.exemplo, g.resultado].join(" ")).includes(q)))
      .sort((a, b) => (b.favorito - a.favorito) || String(b.lote || "").localeCompare(String(a.lote || "")) || a.id - b.id);
    const conta = (f) => todos.filter(f).length;
    const novosHoje = todos.filter((g) => g.origem === "Agente diário" && g.lote === hojeIso());
    const origens = [...new Set(todos.map((g) => g.origem).filter(Boolean))];
    const foco = document.activeElement && document.activeElement.id === "pc-g-busca";
    box.innerHTML = `<div class="pc3-painel pg">
      <div class="pg-tipos">${TIPOS_G.map(([t, d]) => `<div class="pg-tipo c-${COR_G[t]}"><b>${t === "Microgancho" ? "Microganchos" : t}</b><span>${d}</span></div>`).join("")}</div>
      <div class="pg-nums"><div><b>${todos.length}</b><span>ganchos</span></div><div><b>${conta((g) => g.status === "Para testar")}</b><span>para testar</span></div><div><b>${conta((g) => g.status === "Testando")}</b><span>testando</span></div><div><b>${conta((g) => g.status === "Funcionou")}</b><span>funcionaram</span></div><div><b>${conta((g) => g.origem === "Agente diário")}</b><span>do agente diário</span></div></div>
      ${novosHoje.length ? `<div class="pg-hoje"><b>${novosHoje.length} ${novosHoje.length === 1 ? "gancho novo chegou" : "ganchos novos chegaram"} hoje</b> pela busca diária dos seus salvos. <button type="button" class="btn btn-mini" data-g-hoje>Ver os de hoje</button></div>` : ""}
      <form class="pc3-rapida" id="pc-g-rapido"><input class="entrada" name="texto" required placeholder="Escreva um gancho seu e aperte Enter (use [colchetes] no que muda)"><select class="entrada" name="tipo" aria-label="Tipo">${TIPOS_G.map(([t]) => `<option>${t}</option>`).join("")}</select><button class="btn btn-principal" type="submit">${ic.mais}Guardar</button></form>
      <div class="pc3-ideias-cab"><nav class="pc2-seg" aria-label="Tipo de gancho"><button type="button" data-g-tipo="" class="${!tipo ? "ativa" : ""}">Todos <small>${todos.length}</small></button>${TIPOS_G.map(([t]) => `<button type="button" data-g-tipo="${t}" class="${tipo === t ? "ativa" : ""}">${t === "Microgancho" ? "Microganchos" : t} <small>${conta((g) => g.tipo === t)}</small></button>`).join("")}</nav>
        <div class="pc2-filtros"><input class="entrada" type="search" id="pc-g-busca" placeholder="Pesquisar ganchos" value="${esc(st.gBusca || "")}">
          <select class="entrada" id="pc-g-status" aria-label="Status"><option value="">Todos os status</option>${STATUS_G.map((t) => `<option ${stt === t ? "selected" : ""}>${t}</option>`).join("")}</select>
          <select class="entrada" id="pc-g-origem" aria-label="De onde veio"><option value="">Todas as origens</option>${origens.map((o) => `<option ${ori === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>
          <button type="button" class="btn ${st.gFav ? "btn-principal" : ""}" id="pc-g-fav" aria-pressed="${st.gFav ? "true" : "false"}">★ Favoritos</button></div></div>
      ${lista.length ? `<div class="pc3-ideias">${lista.map((g) => { const post = g.post_id && st.todos.find((p) => p.id === g.post_id); return `<article class="pc3-ideia pg-card ${g.favorito ? "fav" : ""}">
          <div class="pc3-card-top"><span class="pc3-chip c-${COR_G[g.tipo] || "x"}">${esc(g.tipo)}</span><small>${esc(g.origem || "")}${g.lote ? " · " + dataCurta(String(g.lote).slice(0, 10)) : ""}</small></div>
          <b>${esc(semAspas(g.texto))}</b>
          ${g.exemplo ? `<p><em>Na sua voz:</em> ${esc(g.exemplo)}</p>` : ""}
          ${g.resultado ? `<p class="pg-res"><em>Resultado:</em> ${esc(g.resultado)}</p>` : ""}
          ${post ? `<button type="button" class="pg-post" data-g-post="${post.id}">testando em: ${esc(post.tema || "conteúdo")}</button>` : ""}
          ${g.referencia ? `<a class="pc3-link" href="${esc(g.referencia)}" target="_blank" rel="noopener">referência</a>` : ""}
          <div class="pg-status"><select class="entrada" data-g-st="${g.id}" aria-label="Status do teste">${STATUS_G.map((t) => `<option ${t === g.status ? "selected" : ""}>${t}</option>`).join("")}</select>
            <button type="button" class="icone-btn pg-estrela ${g.favorito ? "ligada" : ""}" data-g-favoritar="${g.id}" aria-label="${g.favorito ? "Tirar dos favoritos" : "Favoritar"}" aria-pressed="${g.favorito ? "true" : "false"}">★</button></div>
          <div class="pc3-ideia-acoes"><button type="button" class="btn btn-mini btn-principal" data-g-usar="${g.id}">Criar conteúdo com ele</button><button type="button" class="btn btn-mini" data-g-copiar="${g.id}">Copiar</button>
            <button type="button" class="btn btn-mini" data-g-editar="${g.id}">Editar</button><button type="button" class="btn btn-mini btn-perigo" data-g-apagar="${g.id}" aria-label="Excluir gancho">${ic.lixo}</button></div>
        </article>`; }).join("")}</div>`
        : `<p class="pc-ajuda pc3-vazio">${todos.length ? "Nenhum gancho com esse filtro." : "Nenhum gancho ainda."}</p>`}
    </div>`;
    const acha = (id) => st.ganchos.find((x) => String(x.id) === String(id));
    const repinta = () => pintarGanchos(sec);
    $("#pc-g-rapido", box).addEventListener("submit", async (e) => {
      e.preventDefault(); const fd = new FormData(e.target);
      try { await salvarGancho({ texto: String(fd.get("texto") || "").trim(), tipo: fd.get("tipo"), origem: "Minha", lote: hojeIso() }); repinta(); toast("Gancho guardado."); const i = $("#pc-g-rapido [name=texto]", sec); if (i) i.focus(); }
      catch (er) { toast("Não guardei: " + er.message, true); }
    });
    $$("[data-g-tipo]", box).forEach((b) => b.addEventListener("click", () => { st.gTipo = b.dataset.gTipo; repinta(); }));
    const bu = $("#pc-g-busca", box); bu.addEventListener("input", () => { st.gBusca = bu.value; repinta(); });
    if (foco) { const b = $("#pc-g-busca", box); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    $("#pc-g-status", box).addEventListener("change", (e) => { st.gStatus = e.target.value; repinta(); });
    $("#pc-g-origem", box).addEventListener("change", (e) => { st.gOrigem = e.target.value; repinta(); });
    $("#pc-g-fav", box).addEventListener("click", () => { st.gFav = !st.gFav; repinta(); });
    const hj = $("[data-g-hoje]", box); if (hj) hj.addEventListener("click", () => { st.gOrigem = "Agente diário"; st.gTipo = ""; st.gStatus = ""; st.gBusca = ""; repinta(); });
    $$("[data-g-st]", box).forEach((s) => s.addEventListener("change", async () => {
      try { await salvarGancho({ status: s.value }, acha(s.dataset.gSt).id); repinta(); toast("Status salvo."); } catch (er) { toast("Não salvou: " + er.message, true); }
    }));
    $$("[data-g-favoritar]", box).forEach((b) => b.addEventListener("click", async () => {
      const g = acha(b.dataset.gFavoritar); try { await salvarGancho({ favorito: !g.favorito }, g.id); repinta(); } catch (er) { toast("Não salvou: " + er.message, true); }
    }));
    $$("[data-g-copiar]", box).forEach((b) => b.addEventListener("click", async () => {
      const g = acha(b.dataset.gCopiar); try { await navigator.clipboard.writeText(semAspas(g.texto)); toast("Gancho copiado."); } catch (er) { toast("Não consegui copiar neste navegador.", true); }
    }));
    $$("[data-g-post]", box).forEach((b) => b.addEventListener("click", () => abrir(st.todos.find((p) => String(p.id) === b.dataset.gPost))));
    $$("[data-g-usar]", box).forEach((b) => b.addEventListener("click", () => {
      const g = acha(b.dataset.gUsar); const campos = aplicarGancho({}, g);
      abrir(novoConteudo({ ...campos, notas: "Teste do gancho magnético: " + semAspas(g.texto), ganchoTeste: g.id }));
    }));
    $$("[data-g-editar]", box).forEach((b) => b.addEventListener("click", async () => {
      const g = acha(b.dataset.gEditar); if (!g) return;
      const v = await janelaIdeia("Editar gancho", camposGancho(g), "Salvar"); if (!v) return;
      try { await salvarGancho({ texto: v.texto.trim(), tipo: v.tipo, status: v.status, exemplo: v.exemplo.trim() || null, resultado: v.resultado.trim() || null, referencia: v.referencia.trim() || null }, g.id); repinta(); toast("Gancho salvo."); }
      catch (er) { toast("Não salvou: " + er.message, true); }
    }));
    $$("[data-g-apagar]", box).forEach((b) => b.addEventListener("click", async () => {
      const g = acha(b.dataset.gApagar); if (!g) return;
      if (!(await painelDialogo.confirmar(`Excluir o gancho "${semAspas(g.texto).slice(0, 80)}"?`, { ok: "Excluir", perigo: true }))) return;
      const { error } = await banco().from("ganchos").delete().eq("id", g.id);
      if (error) { toast(error.message, true); return; }
      st.ganchos = st.ganchos.filter((x) => x.id !== g.id); repinta(); toast("Gancho excluído.");
    }));
  }
  // onde cada tipo entra no conteúdo: verbal vira a 1ª fala, textual vira o texto na tela, visual vira a cena de abertura,
  // microgancho entra no meio do desenvolvimento
  function aplicarGancho(o, g, adaptado) {
    const t = semAspas(g.texto), ex = g.exemplo && !/skill proíbe|cuidado/i.test(g.exemplo) ? g.exemplo : "";
    const a = adaptado ? String(adaptado).replace(/^\[ABERTURA:\s*/i, "").replace(/^TEXTO NA TELA:\s*/i, "").replace(/^MICROGANCHO NO MEIO:\s*/i, "").replace(/\]$/, "").trim() : "";
    const tira = (txt, re) => String(txt || "").split("\n").filter((l) => !re.test(l.trim())).join("\n").trim();
    if (g.tipo === "Verbal") return { hook: a || ex || t };
    if (g.tipo === "Textual") return { hook: [tira(o.hook, /^TEXTO NA TELA:/i), "TEXTO NA TELA: " + (a || ex || t)].filter(Boolean).join("\n") };
    if (g.tipo === "Visual") return { hook: ["[ABERTURA: " + (a || ex || t) + "]", tira(o.hook, /^\[ABERTURA:/i)].filter(Boolean).join("\n") };
    return { desenvolvimento: [tira(o.desenvolvimento, /^MICROGANCHO NO MEIO:/i), "MICROGANCHO NO MEIO: " + (a || (ex && !/^(Em |No |Na |Antes |Depois |Com )/.test(ex) ? ex : t))].filter(Boolean).join("\n") };
  }
  // nov/2026: a IA (função gancho-ia) adapta o gancho ao produto do conteúdo; g = null escolhe o melhor da lista sozinha
  function lerConteudoDaJanela(dlgPost, p) {
    const v = (n) => { const el = $(`[name=${n}]`, dlgPost); return el ? el.value.trim() : ""; };
    const insp = p.inspiracao || {};
    return { tema: v("tema"), marca: v("marca"), nicho: v("nicho"), formato: v("formato"), tipo_roteiro: v("tipo_roteiro"), tipo_ugc: v("tipo_ugc"), funil: v("funil"),
      proposito: v("proposito"), hook: v("hook"), desenvolvimento: v("desenvolvimento"), cta: v("cta"), notas: v("notas"), referencia: [insp.perfil, insp.legenda].filter(Boolean).join(": ") };
  }
  async function ganchoComIA(dlgPost, p, g) {
    const todos = st.ganchos || [];
    if (!todos.length) { toast("Nenhum gancho na lista ainda.", true); return false; }
    const candidatos = g ? [g] : todos.filter((x) => x.status !== "Não funcionou").sort((a, b) => (b.favorito - a.favorito) || (ORDEM_ESC[a.status] - ORDEM_ESC[b.status]) || a.id - b.id).slice(0, 90);
    const conteudo = lerConteudoDaJanela(dlgPost, p);
    let r = null;
    try {
      const { data, error } = await banco().functions.invoke("gancho-ia", { body: { conteudo, auto: !g, ganchos: candidatos.map((x) => ({ id: x.id, texto: x.texto, tipo: x.tipo, exemplo: x.exemplo, status: x.status, favorito: x.favorito })) } });
      if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch (e2) { /* sem corpo */ } throw new Error(m); }
      if (data && data.error) throw new Error(data.error);
      r = data;
    } catch (er) {
      if (!g) { toast("Não consegui escolher agora: " + er.message, true); return false; }
      toast("A IA não respondeu (" + er.message + "). Coloquei o gancho no modelo original.", true);
    }
    const usado = (r && todos.find((x) => String(x.id) === String(r.id))) || g;
    const atual = { hook: $("[name=hook]", dlgPost).value.trim(), desenvolvimento: $("[name=desenvolvimento]", dlgPost).value.trim() };
    const novo = aplicarGancho(usado.tipo === "Verbal" ? {} : atual, usado, r && r.texto);
    if (novo.hook != null) $("[name=hook]", dlgPost).value = novo.hook;
    if (novo.desenvolvimento != null) {
      $("[name=desenvolvimento]", dlgPost).value = novo.desenvolvimento;
      const sec = $("[name=desenvolvimento]", dlgPost).closest("details"); if (sec) sec.open = true;
    }
    const linha = $(".pg-usar-linha", dlgPost);
    if (linha) {
      let nota = $(".pg-porque", dlgPost);
      if (!nota) { nota = document.createElement("p"); nota.className = "pc-ajuda pg-porque"; linha.after(nota); }
      nota.innerHTML = `<b>${esc(usado.tipo)} · ${esc(semAspas(usado.texto).slice(0, 70))}</b>${r && r.porque ? "<br>" + esc(r.porque) : ""}`;
    }
    const onde = usado.tipo === "Microgancho" ? "no meio do roteiro" : usado.tipo === "Textual" ? "como texto na tela" : usado.tipo === "Visual" ? "como cena de abertura" : "no Hook";
    if (p.id) { try { await marcarTeste(usado, p.id); toast(`Gancho ${r ? "adaptado ao produto e " : ""}colocado ${onde}. Ficou "Testando" neste conteúdo. Lembre de salvar.`); } catch (er) { toast("Apliquei, mas não marquei o teste: " + er.message, true); } }
    else { dlgPost.dataset.ganchoTeste = String(usado.id); toast(`Gancho ${r ? "adaptado ao produto e " : ""}colocado ${onde}. Ao salvar, ele fica marcado como testando.`); }
    return true;
  }
  async function marcarTeste(g, postId) {
    const campos = { post_id: postId, usos: (g.usos || 0) + 1 };
    if (g.status === "Para testar") campos.status = "Testando";
    await salvarGancho(campos, g.id);
  }
  function escolherGancho(dlgPost, p) {
    const d = document.createElement("dialog"); d.className = "janela pc3-janela pg-escolher";
    let tipo = "", q = "";
    const desenhar = () => {
      const lista = (st.ganchos || []).filter((g) => (!tipo || g.tipo === tipo) && (!q || semAcento([g.texto, g.exemplo].join(" ")).includes(semAcento(q))))
        .sort((a, b) => (b.favorito - a.favorito) || (ORDEM_ESC[a.status] - ORDEM_ESC[b.status]) || a.id - b.id);
      $(".pg-lista", d).innerHTML = lista.length ? lista.map((g) => `<button type="button" class="pg-opcao" data-g="${g.id}"><span class="pc3-chip c-${COR_G[g.tipo] || "x"}">${esc(g.tipo)}</span><b>${esc(semAspas(g.texto))}</b>${g.exemplo ? `<small>${esc(g.exemplo)}</small>` : ""}<i>${esc(g.status)}${g.favorito ? " · ★" : ""}</i></button>`).join("")
        : `<p class="pc-ajuda">${(st.ganchos || []).length ? "Nada com esse filtro." : "Nenhum gancho na lista ainda."}</p>`;
      $$(".pg-opcao", d).forEach((b) => b.addEventListener("click", async () => {
        const g = st.ganchos.find((x) => String(x.id) === b.dataset.g); if (!g || d.classList.contains("ocupado")) return;
        d.classList.add("ocupado"); b.classList.add("carregando"); const i = $("i", b); if (i) i.textContent = "Adaptando ao seu produto…";
        await ganchoComIA(dlgPost, p, g);
        d.close();
      }));
    };
    d.innerHTML = `<div class="janela-cabeca"><h2>Ganchos <em>magnéticos</em></h2><button class="icone-btn" type="button" data-x aria-label="Fechar">${ic.x}</button></div>
      <div class="janela-corpo"><p class="pc-ajuda">Clique num gancho e eu adapto ao produto deste conteúdo, já preenchido. Verbal vira a primeira fala, Textual o texto na tela, Visual a cena de abertura e Microgancho vai para o meio do roteiro.</p>
        <button type="button" class="btn btn-principal pg-auto" data-auto>${ic.brilho}Escolher o melhor gancho pra este produto</button>
        <div class="pg-escolher-filtros"><nav class="pc2-seg" aria-label="Tipo"><button type="button" data-t="" class="ativa">Todos</button>${TIPOS_G.map(([t]) => `<button type="button" data-t="${t}">${t === "Microgancho" ? "Micro" : t}</button>`).join("")}</nav><input class="entrada" type="search" placeholder="Pesquisar" data-q></div>
        <div class="pg-lista"></div></div>`;
    document.body.appendChild(d);
    $("[data-x]", d).addEventListener("click", () => d.close());
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    d.addEventListener("close", () => d.remove());
    $$("[data-t]", d).forEach((b) => b.addEventListener("click", () => { tipo = b.dataset.t; $$("[data-t]", d).forEach((x) => x.classList.toggle("ativa", x === b)); desenhar(); }));
    $("[data-q]", d).addEventListener("input", (e) => { q = e.target.value; desenhar(); });
    $("[data-auto]", d).addEventListener("click", async (e) => {
      const b = e.currentTarget; if (d.classList.contains("ocupado")) return;
      d.classList.add("ocupado"); b.textContent = "Analisando o produto e escolhendo…";
      const ok = await ganchoComIA(dlgPost, p, null);
      if (ok) d.close(); else { d.classList.remove("ocupado"); b.innerHTML = `${ic.brilho}Escolher o melhor gancho pra este produto`; }
    });
    desenhar(); d.showModal();
  }
  // ---------- PLANEJAMENTO ANUAL (nov/2026, carrossel "planejamento de conteúdo para 2027 com IA" da @giubeckers) ----------
  // Método em 6 passos: 1 narrativa, 2 calendário do ano (datas do público + quando as MARCAS fecham UGC), 3 temas macro
  // do mês por pilar, 4 ideias por tema, 5 frequência (o ritmo do perfil_conteudo) e 6 trabalhar 2 meses à frente.
  // Tudo em configuracoes chave "planejamento_anual" = {anos: {"2027": {narrativa {quem, paraQuem, vende}, campanha,
  // meses {"1".."12": {foco, datas[], marcas, temas {pilar: tema}, ideias [{id, titulo, pilar, formato, funil, ideiaId}]}}}}}.
  // "Mandar para o Banco de ideias" grava em ideias_organizadas (a mesma do Banco de ideias) e guarda ideiaId (não duplica).
  const P1 = "Maternidade e autocuidado", P2 = "Beleza e cabelo", P3 = "Moda", P4 = "Bem-estar", P5 = "Achadinhos de casa e tech";
  const idA = () => "pa" + Math.random().toString(36).slice(2, 9);
  const ide = (titulo, pilar, formato, funil) => ({ id: idA(), titulo, pilar, formato, funil });
  const NARRATIVA_PADRAO = {
    quem: "Sou a Mari, mãe de duas meninas e criadora UGC. Me perdi na maternidade e estou me reencontrando: emagreci e voltei a cuidar de mim.",
    paraQuem: "Mulheres e mães que querem voltar a se cuidar sem complicar, e as marcas que querem falar com elas com conteúdo real.",
    vende: "Vídeos UGC e publis para marcas de beleza, cabelo, moda, bem-estar, casa e tech: falando para a câmera, com o produto em uso de verdade.",
  };
  const ANO_2027 = {
    narrativa: NARRATIVA_PADRAO,
    campanha: "Em semana de campanha ou data forte, sobe para 4 posts e o Stories fica diário.",
    meses: {
      1: { foco: "Recomeço: me reencontrando no ano novo", datas: ["Ano Novo (01/01)", "Férias escolares", "Verão"],
        marcas: "Fecham Carnaval e volta às aulas. Hora de mandar portfólio para Dia da Mulher, Dia do Consumidor e Páscoa.",
        temas: { [P1]: "Metas reais de mãe para 2027 (cuidar de mim sem culpa)", [P2]: "Pele e cabelo no verão: sol, piscina e mar", [P3]: "Looks frescos para as férias com as meninas", [P4]: "Rotina possível nas férias escolares", [P5]: "Organizar a casa para começar o ano" },
        ideias: [ide("O que eu prometo pra mim em 2027 (e não é dieta)", P1, "Reels", "Meio"), ide("Eu esquecia de mim: 3 cuidados que voltaram para a minha rotina", P1, "Carrossel", "Meio"),
          ide("Protetor solar que não deixa a pele branca nem melada", P2, "Reels", "Topo"), ide("Meu cabelo depois da piscina: o que eu passo para não ressecar", P2, "Reels", "Topo"),
          ide("3 looks de férias que funcionam correndo atrás de criança", P3, "Carrossel", "Meio"), ide("A primeira foto de praia em que eu gostei de mim em anos", P1, "Foto", "Meio"),
          ide("Férias com duas filhas em casa: a rotina que salva o meu dia", P4, "Reels", "Meio"), ide("Água, sono e 10 minutos só meus: o básico que eu voltei a fazer", P4, "Carrossel", "Meio"),
          ide("Organizei a despensa para o ano: os potes que valeram a pena", P5, "Reels", "Topo"), ide("Os achadinhos de casa que eu mais usei em 2026", P5, "Carrossel", "Topo"),
          ide("Minha bolsa de praia de mãe: o que nunca falta", P1, "Reels", "Topo"), ide("Bastidor: como eu gravo um vídeo UGC com as meninas de férias em casa", P1, "Reels", "Fundo")] },
      2: { foco: "Volta às aulas e Carnaval", datas: ["Volta às aulas", "Carnaval (06 a 10/02)"],
        marcas: "Fecham Páscoa, Dia da Mulher e Dia do Consumidor. Começam a falar de Dia das Mães: portfólio de beleza e maternidade em dia.",
        temas: { [P1]: "Volta às aulas: a manhã de uma mãe de duas", [P2]: "Make e cabelo que aguentam calor e Carnaval", [P3]: "Looks de Carnaval sem fantasia completa", [P4]: "Voltar a treinar depois das férias", [P5]: "Material escolar e organização da rotina das meninas" },
        ideias: [ide("A manhã da volta às aulas aqui em casa, do despertador ao portão", P1, "Reels", "Meio"), ide("Lancheira sem drama: o que eu mando para as meninas", P1, "Carrossel", "Meio"),
          ide("Material escolar: o que eu comprei e o que eu não compro mais", P5, "Reels", "Topo"), ide("Organizei o cantinho de estudo das meninas", P5, "Carrossel", "Topo"),
          ide("Make que aguenta o bloquinho: testei no calor", P2, "Reels", "Topo"), ide("Cabelo preso de Carnaval em 5 minutos", P2, "Reels", "Topo"),
          ide("3 looks de Carnaval com peças que eu já tenho", P3, "Carrossel", "Meio"), ide("Voltei a treinar depois das férias: como eu encaixo na rotina", P4, "Reels", "Meio"),
          ide("Pele depois do Carnaval: o que eu faço no dia seguinte", P2, "Carrossel", "Meio"), ide("Meu primeiro Carnaval me sentindo eu de novo", P1, "Foto", "Meio"),
          ide("O que eu faço com a primeira hora sozinha depois que elas entram na escola", P4, "Reels", "Meio"), ide("Bastidor: briefing de Dia das Mães chegando, como eu me preparo", P1, "Reels", "Fundo")] },
      3: { foco: "Mês da mulher e da autoestima. Portfólio forte: marcas fecham Dia das Mães", datas: ["Dia da Mulher (08/03)", "Dia do Consumidor (15/03)", "Outono (20/03)", "Páscoa (28/03)"],
        marcas: "Alta temporada de Dia das Mães em beleza, moda e casa. Prospectar ativamente e postar mais prova de trabalho (fundo de funil).",
        temas: { [P1]: "Mulher antes de mãe: o que eu voltei a fazer por mim", [P2]: "Pele na troca de estação", [P3]: "Peças de transição do verão para o outono", [P4]: "Hábitos que ajudaram a minha autoestima", [P5]: "Achados do Dia do Consumidor que valem o desconto" }, ideias: [] },
      4: { foco: "Dia das Mães em produção", datas: ["Dia Mundial da Saúde (07/04)", "Outono"],
        marcas: "Últimos fechamentos de Dia das Mães e começo de Dia dos Namorados. Mostrar as publis já feitas.",
        temas: { [P1]: "O que eu queria ganhar de Dia das Mães de verdade", [P2]: "Kit de autocuidado que eu daria para uma mãe", [P3]: "Looks de outono para a rotina de mãe", [P4]: "Cuidados de saúde que eu vivia adiando", [P5]: "Presentes de casa e tech para o Dia das Mães" }, ideias: [] },
      5: { foco: "Dia das Mães (09/05)", datas: ["Dia do Trabalhador (01/05)", "Dia das Mães (09/05)"],
        marcas: "Fecham Dia dos Namorados, festa junina e inverno.",
        temas: { [P1]: "Ser mãe de meninas e me reencontrar: a minha história", [P2]: "Make rápida para o almoço de Dia das Mães", [P3]: "Look para o Dia das Mães", [P4]: "Pedir ajuda também é autocuidado", [P5]: "Presentes de última hora que eu indicaria" }, ideias: [] },
      6: { foco: "Inverno e Dia dos Namorados", datas: ["Dia dos Namorados (12/06)", "Festa junina", "Inverno (21/06)"],
        marcas: "Fecham férias de julho, Dia dos Pais e inverno.",
        temas: { [P1]: "Mãe também namora: tempo a dois", [P2]: "Pele e cabelo no frio", [P3]: "Looks de inverno quentinhos e práticos", [P4]: "Rotina de sono no frio", [P5]: "Achados para a casa no inverno" }, ideias: [] },
      7: { foco: "Férias escolares", datas: ["Férias escolares", "Dia dos Avós (26/07)"],
        marcas: "Fecham Dia dos Pais, volta às aulas do 2º semestre e Dia das Crianças.",
        temas: { [P1]: "Férias com as meninas sem perder a cabeça", [P2]: "Cabelo no inverno: hidratação, secador e babyliss", [P3]: "Looks de férias de inverno", [P4]: "Movimentar o corpo nas férias", [P5]: "Tech e achados que salvam as férias" }, ideias: [] },
      8: { foco: "Dia dos Pais e recomeço do 2º semestre", datas: ["Dia dos Pais (08/08)", "Volta às aulas do 2º semestre"],
        marcas: "Fecham Dia das Crianças, 9.9 e Dia do Cliente. Começam a sondar a Black Friday.",
        temas: { [P1]: "Dividir as tarefas da casa com o marido", [P2]: "Skincare de volta à rotina", [P3]: "Peças coringa para o 2º semestre", [P4]: "Recomeçar no meio do ano", [P5]: "Presentes de Dia dos Pais de casa e tech" }, ideias: [] },
      9: { foco: "Primavera e portfólio pronto para a Black Friday", datas: ["9.9", "Dia do Cliente (15/09)", "Primavera (23/09)"],
        marcas: "Começam a fechar Black Friday e 10.10: mês de prospectar com força e reforçar o fundo de funil.",
        temas: { [P1]: "Um ano me reencontrando: o que mudou", [P2]: "Pele e cabelo na primavera", [P3]: "Cores e looks de primavera", [P4]: "Hábitos que eu mantive o ano inteiro", [P5]: "Achadinhos do 9.9 que eu uso de verdade" }, ideias: [] },
      10: { foco: "Dia das Crianças e aquecimento da Black Friday", datas: ["10.10", "Dia das Crianças (12/10)"],
        marcas: "Fecham Black Friday e 11.11. Começam as conversas de Natal.",
        temas: { [P1]: "Dia das Crianças: o que elas pedem e o que eu dou", [P2]: "A minha lista de beleza para a Black Friday", [P3]: "Looks de meia-estação", [P4]: "Cuidar de mim no fim do ano", [P5]: "Presentes de Dia das Crianças de casa e tech" }, ideias: [] },
      11: { foco: "Black Friday (26/11)", datas: ["11.11", "Black Friday (26/11)", "Cyber Monday (29/11)"],
        marcas: "Fecham Natal, verão e ano novo. Muita publi no ar: equilibrar com conteúdo de meio de funil.",
        temas: { [P1]: "O que eu compro e o que eu não compro na Black Friday sendo mãe", [P2]: "Beleza que vale a pena na Black Friday", [P3]: "Peças para as festas de fim de ano", [P4]: "Comprar menos e melhor", [P5]: "Achadinhos de casa e tech com desconto de verdade" }, ideias: [] },
      12: { foco: "Natal e retrospectiva", datas: ["Natal (25/12)", "Réveillon (31/12)", "Férias escolares"],
        marcas: "Fecham janeiro (verão e volta às aulas). Hora de atualizar o portfólio e planejar 2028.",
        temas: { [P1]: "Retrospectiva: o meu ano me reencontrando", [P2]: "Make de festa que eu mesma faço", [P3]: "Looks de Natal e Réveillon", [P4]: "Descansar sem culpa nas festas", [P5]: "Presentes de Natal práticos que eu daria" }, ideias: [] },
    },
  };
  const PASSOS_ANO = [["narrativa", "Narrativa"], ["frequencia", "Frequência"], ["janela", "2 meses à frente"], ["calendario", "Calendário do ano"], ["mes", "Temas e ideias do mês"]];
  const MES_NICHO = (pilar) => (pilar === P1 ? "Maternidade" : NICHOS.includes(pilar) ? pilar : null);
  const pa = { dados: null, ano: "2027", mes: null, salvando: false, gerando: null };
  async function carregarAno() {
    const { data } = await banco().from("configuracoes").select("valor").eq("chave", "planejamento_anual").maybeSingle();
    let d = null; try { d = data && JSON.parse(data.valor); } catch (e) { d = null; }
    pa.dados = d && d.anos ? d : { anos: { 2027: JSON.parse(JSON.stringify(ANO_2027)) } };
    // primeira vez: grava o 2027 preenchido para os ids das ideias ficarem fixos
    if (!(d && d.anos)) { try { await salvarAno(); } catch (e) { /* tenta de novo na próxima edição */ } }
    if (!pa.dados.anos[pa.ano]) pa.ano = Object.keys(pa.dados.anos).sort()[0];
  }
  async function salvarAno() {
    const { error } = await banco().from("configuracoes").upsert({ chave: "planejamento_anual", valor: JSON.stringify(pa.dados), updated_at: new Date().toISOString() }, { onConflict: "chave" });
    if (error) throw new Error(error.message);
    // confere que gravou de verdade
    const { data } = await banco().from("configuracoes").select("valor").eq("chave", "planejamento_anual").maybeSingle();
    if (!data || data.valor !== JSON.stringify(pa.dados)) throw new Error("o banco não confirmou o salvamento");
  }
  const anoAtual = () => pa.dados.anos[pa.ano];
  const mesDoAno = (m) => { const a = anoAtual(); a.meses = a.meses || {}; a.meses[m] = a.meses[m] || { foco: "", datas: [], marcas: "", temas: {}, ideias: [] }; const x = a.meses[m]; x.temas = x.temas || {}; x.ideias = x.ideias || []; x.datas = x.datas || []; return x; };
  // quantos posts o ritmo dela pede naquele mês (dias do ritmo, 0 = SEG)
  function postsNoMes(ano, m) {
    const dias = (st.perfil.ritmo || PERFIL_PADRAO.ritmo).dias || [];
    let n = 0; const d = new Date(Number(ano), m - 1, 1);
    while (d.getMonth() === m - 1) { if (dias.includes((d.getDay() + 6) % 7)) n++; d.setDate(d.getDate() + 1); }
    return n;
  }
  // os 2 próximos meses deste ano de planejamento (a partir do mês que vem); antes do ano começar, janeiro e fevereiro
  function janelaMeses() {
    const ano = Number(pa.ano), out = [];
    for (let k = 1; out.length < 2 && k <= 24; k++) { const d = new Date(hoje.getFullYear(), hoje.getMonth() + k, 1); if (d.getFullYear() === ano) out.push(d.getMonth() + 1); else if (d.getFullYear() > ano) break; }
    if (!out.length && ano > hoje.getFullYear()) return [1, 2];
    return out;
  }
  const naBanco = (i) => i.ideiaId && (st.ideias || []).some((x) => String(x.id) === String(i.ideiaId));
  function progressoMes(m) {
    const x = mesDoAno(m), pil = (st.perfil.pilares || []).map((p) => p.nome), chave = `${pa.ano}-${pad(m)}`;
    const temas = pil.filter((p) => String(x.temas[p] || "").trim()).length;
    const roteiros = st.todos.filter((p) => mesDe(p) === chave && normStatus(p.status) !== "Ideia").length;
    return { meta: postsNoMes(pa.ano, m), temas, totalTemas: pil.length, ideias: x.ideias.length, banco: x.ideias.filter(naBanco).length, roteiros };
  }
  const barra = (v, t) => `<span class="pa-barra"><i style="width:${t ? Math.min(100, Math.round((v / t) * 100)) : 0}%"></i></span>`;
  function pintarAno(sec) {
    const box = $("#pc-ano", sec); if (!box) return;
    if (!pa.dados) { box.innerHTML = `<p class="pc-ajuda">Carregando o planejamento…</p>`; return; }
    const a = anoAtual(), n = a.narrativa || {}, r = st.perfil.ritmo || PERFIL_PADRAO.ritmo, jan = janelaMeses();
    const fun = r.funil || {}, funTxt = FUNIS.filter((f) => fun[f]).map((f) => `${fun[f]} ${f.toLowerCase()}`).join(" + ");
    const anos = [...new Set([...Object.keys(pa.dados.anos), pa.ano])].sort();
    box.innerHTML = `<div class="pa">
      <div class="pa-topo"><div><h3 class="pc2-h">Planejamento <em>${esc(pa.ano)}</em></h3><p class="pc-ajuda">Do ano para o mês: narrativa, datas, temas, ideias e o seu ritmo, sempre com 2 meses prontos à frente.</p></div>
        <div class="pa-topo-acoes"><select class="entrada" id="pa-ano" aria-label="Ano">${anos.map((x) => `<option ${x === pa.ano ? "selected" : ""}>${x}</option>`).join("")}</select><button class="btn" type="button" id="pa-novo-ano">${ic.mais}Começar ${Number(anos[anos.length - 1]) + 1}</button></div></div>
      <nav class="pa-passos" aria-label="Passos">${PASSOS_ANO.map(([k, t], i) => `<button type="button" data-pa-ir="${k}"><b>${i + 1}</b>${t}</button>`).join("")}</nav>
      <div class="pa-duas">
        <section class="pc-cartao" id="pa-narrativa"><div class="pa-cab"><h4 class="pa-h">1. Minha narrativa</h4><button class="btn btn-mini" type="button" id="pa-ed-narr">Editar</button></div>
          <p class="pc-ajuda">É o contexto de tudo: quem você é, para quem fala e o que vende.</p>
          <dl class="pa-narr"><dt>Quem eu sou</dt><dd>${esc(n.quem || "")}</dd><dt>Para quem</dt><dd>${esc(n.paraQuem || "")}</dd><dt>O que eu vendo</dt><dd>${esc(n.vende || "")}</dd></dl></section>
        <section class="pc-cartao" id="pa-frequencia"><div class="pa-cab"><h4 class="pa-h">2. Frequência por semana</h4><button class="btn btn-mini" type="button" id="pa-ritmo">Mudar o ritmo</button></div>
          <p class="pa-grande">${r.porSemana} posts por semana</p>
          <div class="pa-semana">${DIAS.map((d, i) => `<span class="${(r.dias || []).includes(i) ? "on" : ""}">${d}</span>`).join("")}</div>
          <p class="pc-ajuda">${esc((r.formatos || []).join(", "))}${funTxt ? " · " + esc(funTxt) : ""}${r.horario ? " · às " + esc(r.horario) : ""}</p>
          <p class="pa-campanha"><b>Semana de campanha:</b> <span>${esc(a.campanha || "")}</span> <button type="button" class="pa-link" id="pa-ed-camp">editar</button></p></section>
      </div>
      <section class="pc-cartao" id="pa-janela"><div class="pa-cab"><h4 class="pa-h">3. Dois meses à frente</h4></div>
        <p class="pc-ajuda">Quando um mês começa, o seguinte já está pensado. Assim sobra espaço para conteúdo no flow e para pauta quente.</p>
        <div class="pa-jan">${jan.map((m) => { const p = progressoMes(m); return `<button type="button" class="pa-jan-mes" data-pa-mes="${m}"><b>${MESES[m - 1]}</b><small>${p.meta} posts no seu ritmo</small>
          <span class="pa-linha"><span>Temas</span>${barra(p.temas, p.totalTemas)}<em>${p.temas}/${p.totalTemas}</em></span>
          <span class="pa-linha"><span>Ideias</span>${barra(p.ideias, p.meta)}<em>${p.ideias}/${p.meta}</em></span>
          <span class="pa-linha"><span>Roteiros</span>${barra(p.roteiros, p.meta)}<em>${p.roteiros}/${p.meta}</em></span></button>`; }).join("") || `<p class="pc-ajuda">Este ano já passou da janela. Escolha outro ano.</p>`}</div></section>
      <section class="pc-cartao" id="pa-calendario"><div class="pa-cab"><h4 class="pa-h">4. Calendário de ${esc(pa.ano)}</h4></div>
        <p class="pc-ajuda">Em cada mês: as datas do seu público e quando as <b>marcas</b> fecham UGC (elas contratam de 1 a 2 meses antes da data). Toque num mês para ver temas e ideias.</p>
        <div class="pa-meses">${MESES.map((nome, i) => { const m = i + 1, x = mesDoAno(m), p = progressoMes(m); return `<button type="button" class="pa-mes${pa.mes === m ? " ativo" : ""}${jan.includes(m) ? " janela" : ""}" data-pa-mes="${m}">
          <span class="pa-mes-cab"><b>${nome}</b>${jan.includes(m) ? `<small class="pa-tag">agora</small>` : ""}</span>
          ${x.foco ? `<span class="pa-foco">${esc(x.foco)}</span>` : ""}
          <span class="pa-datas">${x.datas.map((d) => `<i>${esc(d)}</i>`).join("")}</span>
          ${x.marcas ? `<span class="pa-marcas"><b>Marcas:</b> ${esc(x.marcas)}</span>` : ""}
          <span class="pa-cont">${p.temas}/${p.totalTemas} temas · ${p.ideias} ideias</span></button>`; }).join("")}</div></section>
      <section id="pa-mes">${pa.mes ? detalheMes(pa.mes) : ""}</section>
    </div>`;
    ligarAno(sec, box);
  }
  function detalheMes(m) {
    const x = mesDoAno(m), pil = (st.perfil.pilares || []).map((p) => p.nome), p = progressoMes(m);
    const cont = FUNIS.map((f) => `${x.ideias.filter((i) => i.funil === f).length} ${f.toLowerCase()}`).join(" · ");
    const porPilar = [...pil, ...new Set(x.ideias.map((i) => i.pilar).filter((q) => q && !pil.includes(q)))];
    return `<div class="pc-cartao pa-det">
      <div class="pa-cab"><h4 class="pa-h">5. ${MESES[m - 1]} de ${esc(pa.ano)}</h4><div class="pa-topo-acoes"><button class="btn btn-mini" type="button" id="pa-ed-mes">Editar foco, datas e marcas</button><button class="icone-btn" type="button" id="pa-fechar" aria-label="Fechar o mês">${ic.x}</button></div></div>
      <div class="pa-det-info"><p><b>Foco:</b> ${esc(x.foco || "sem foco ainda")}</p><p><b>Datas:</b> ${x.datas.length ? x.datas.map(esc).join(", ") : "nenhuma"}</p><p><b>Marcas:</b> ${esc(x.marcas || "")}</p></div>
      <h5 class="pa-sub">Temas macro do mês, um por pilar</h5>
      <div class="pa-temas">${pil.map((pi, k) => `<label class="pa-tema pa-c${k % 6}"><span>${esc(pi)}</span><textarea class="entrada" rows="2" data-pa-tema="${esc(pi)}" placeholder="Tema deste pilar no mês">${esc(x.temas[pi] || "")}</textarea></label>`).join("")}</div>
      <div class="pa-cab pa-cab-ideias"><h5 class="pa-sub">Ideias do mês <small>${x.ideias.length} de ${p.meta} posts · ${cont}</small></h5>
        <div class="pa-topo-acoes">${x.ideias.some((i) => !naBanco(i)) ? `<button class="btn btn-mini btn-principal" type="button" id="pa-todas">Mandar todas para o Banco de ideias</button>` : x.ideias.length ? `<span class="pa-ok">Todas no Banco de ideias</span>` : ""}</div></div>
      ${porPilar.map((pi) => { const lista = x.ideias.filter((i) => (i.pilar || "") === pi); const tema = x.temas[pi];
        return `<div class="pa-grupo"><div class="pa-grupo-cab"><b>${esc(pi)}</b>${tema ? `<small>${esc(tema)}</small>` : ""}${tema ? `<button type="button" class="btn btn-mini" data-pa-ia="${esc(pi)}" ${pa.gerando ? "disabled" : ""}>${pa.gerando === pi ? "Pedindo à IA…" : ic.brilho + "3 ideias com IA"}</button>` : ""}</div>
          ${lista.length ? `<ul class="pa-ideias">${lista.map((i) => `<li><span class="pa-ideia-t">${esc(i.titulo)}</span><span class="pa-ideia-m">${esc(i.formato || "")} · ${esc(i.funil || "")}</span>
            ${naBanco(i) ? `<span class="pa-ok">no banco</span>` : `<button type="button" class="btn btn-mini" data-pa-banco="${i.id}">Mandar para o banco</button>`}<button type="button" class="pa-x" data-pa-tirar="${i.id}" aria-label="Tirar a ideia">${ic.x}</button></li>`).join("")}</ul>` : `<p class="pc-ajuda pa-vazio">Nenhuma ideia neste pilar ainda.</p>`}</div>`; }).join("")}
      <form class="pc3-rapida pa-nova" id="pa-nova"><input class="entrada" name="titulo" required placeholder="Nova ideia para ${MESES[m - 1]}"><select class="entrada" name="pilar" aria-label="Pilar">${pil.map((q) => `<option>${esc(q)}</option>`).join("")}</select><select class="entrada" name="formato" aria-label="Formato">${FORMATOS.map((f) => `<option>${f}</option>`).join("")}</select><select class="entrada" name="funil" aria-label="Funil">${FUNIS.map((f) => `<option ${f === "Meio" ? "selected" : ""}>${f}</option>`).join("")}</select><button class="btn btn-principal" type="submit">${ic.mais}Adicionar</button></form>
    </div>`;
  }
  async function gravarAno(msg) {
    try { await salvarAno(); if (msg) toast(msg); } catch (er) { toast("Não salvou: " + er.message, true); }
  }
  async function ideiaParaBanco(m, i) {
    if (naBanco(i)) return;
    const x = mesDoAno(m), tema = x.temas[i.pilar];
    const novo = await salvarIdeia({ titulo: i.titulo, texto: i.titulo, pilar: i.pilar || null, categoria: MES_NICHO(i.pilar), formato: i.formato || null, funil: i.funil || null, finalidade: "Conteúdos", situacao: "minha",
      notas: `Planejamento ${pa.ano} · ${MESES[m - 1]}${tema ? " · tema: " + tema : ""}` });
    i.ideiaId = novo.id;
  }
  function ligarAno(sec, box) {
    const repintar = () => { pintarAno(sec); };
    $$("[data-pa-ir]", box).forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.paIr;
      if (k === "mes" && !pa.mes) { pa.mes = janelaMeses()[0] || 1; repintar(); }
      const alvo = $("#pa-" + k, sec); if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    $("#pa-ano", box).addEventListener("change", (e) => { pa.ano = e.target.value; pa.mes = null; repintar(); });
    $("#pa-novo-ano", box).addEventListener("click", async () => {
      const novo = String(Math.max(...Object.keys(pa.dados.anos).map(Number)) + 1);
      if (!(await painelDialogo.confirmar(`Começar o planejamento de ${novo}? A narrativa e o texto de campanha vêm de ${pa.ano}; os meses começam vazios.`, { ok: "Começar" }))) return;
      const base = anoAtual();
      pa.dados.anos[novo] = { narrativa: { ...(base.narrativa || NARRATIVA_PADRAO) }, campanha: base.campanha || "", meses: {} };
      pa.ano = novo; pa.mes = null; await gravarAno(`Planejamento de ${novo} criado.`); repintar();
    });
    $("#pa-ed-narr", box).addEventListener("click", async () => {
      const n = anoAtual().narrativa || {};
      const v = await janelaIdeia("Minha narrativa", `<p class="pc-ajuda">Escreva o que você faz, para quem e o que vende. É o ponto de partida dos temas e das ideias.</p>
        <label class="campo"><span>Quem eu sou</span><textarea name="quem" rows="3">${esc(n.quem || "")}</textarea></label>
        <label class="campo"><span>Para quem eu falo</span><textarea name="paraQuem" rows="3">${esc(n.paraQuem || "")}</textarea></label>
        <label class="campo"><span>O que eu vendo</span><textarea name="vende" rows="3">${esc(n.vende || "")}</textarea></label>`, "Salvar");
      if (!v) return;
      anoAtual().narrativa = { quem: v.quem.trim(), paraQuem: v.paraQuem.trim(), vende: v.vende.trim() };
      await gravarAno("Narrativa salva."); repintar();
    });
    $("#pa-ritmo", box).addEventListener("click", () => { if (st.mostrarParte) st.mostrarParte("cfg"); const pf = $("#pc-perfil", sec); if (pf) pf.scrollIntoView({ behavior: "smooth", block: "start" }); });
    $("#pa-ed-camp", box).addEventListener("click", async () => {
      const t = await painelDialogo.texto("O que muda em semana de campanha ou data forte?", anoAtual().campanha || "", { linhas: 3 });
      if (t === null) return; anoAtual().campanha = t.trim(); await gravarAno("Salvo."); repintar();
    });
    $$("[data-pa-mes]", box).forEach((b) => b.addEventListener("click", () => {
      pa.mes = Number(b.dataset.paMes); repintar();
      const d = $("#pa-mes", sec); if (d) d.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    if (!pa.mes) return;
    const m = pa.mes, x = mesDoAno(m);
    $("#pa-fechar", box).addEventListener("click", () => { pa.mes = null; repintar(); });
    $("#pa-ed-mes", box).addEventListener("click", async () => {
      const v = await janelaIdeia(`${MESES[m - 1]}: foco, datas e marcas`, `<label class="campo"><span>Foco do mês</span><input name="foco" value="${esc(x.foco || "")}"></label>
        <label class="campo"><span>Datas do seu público (uma por linha)</span><textarea name="datas" rows="4">${esc(x.datas.join("\n"))}</textarea></label>
        <label class="campo"><span>Calendário das marcas (o que elas fecham neste mês)</span><textarea name="marcas" rows="3">${esc(x.marcas || "")}</textarea></label>`, "Salvar");
      if (!v) return;
      x.foco = v.foco.trim(); x.datas = v.datas.split("\n").map((s) => s.trim()).filter(Boolean); x.marcas = v.marcas.trim();
      await gravarAno(`${MESES[m - 1]} salvo.`); repintar();
    });
    $$("[data-pa-tema]", box).forEach((inp) => inp.addEventListener("change", async () => {
      const pi = inp.dataset.paTema, t = inp.value.trim();
      if (t) x.temas[pi] = t; else delete x.temas[pi];
      await gravarAno("Tema salvo."); repintar();
    }));
    $("#pa-nova", box).addEventListener("submit", async (e) => {
      e.preventDefault(); const fd = new FormData(e.target), v = (k) => String(fd.get(k) || "").trim();
      x.ideias.push(ide(v("titulo"), v("pilar"), v("formato"), v("funil")));
      await gravarAno("Ideia adicionada."); repintar();
      const f = $("#pa-nova [name=titulo]", sec); if (f) f.focus();
    });
    $$("[data-pa-tirar]", box).forEach((b) => b.addEventListener("click", async () => {
      const i = x.ideias.find((q) => q.id === b.dataset.paTirar); if (!i) return;
      if (!(await painelDialogo.confirmar(`Tirar "${i.titulo}" do planejamento?${naBanco(i) ? " A cópia no Banco de ideias continua lá." : ""}`, { ok: "Tirar", perigo: true }))) return;
      x.ideias = x.ideias.filter((q) => q.id !== i.id); await gravarAno("Ideia tirada."); repintar();
    }));
    $$("[data-pa-banco]", box).forEach((b) => b.addEventListener("click", async () => {
      const i = x.ideias.find((q) => q.id === b.dataset.paBanco); if (!i) return;
      b.disabled = true;
      try { await ideiaParaBanco(m, i); await salvarAno(); toast("Ideia no Banco de ideias."); } catch (er) { toast("Não mandou: " + er.message, true); }
      repintar();
    }));
    const todas = $("#pa-todas", box);
    if (todas) todas.addEventListener("click", async () => {
      todas.disabled = true; let n = 0;
      try { for (const i of x.ideias) { if (!naBanco(i)) { await ideiaParaBanco(m, i); n++; } } await salvarAno(); toast(`${n} ideia${n === 1 ? "" : "s"} no Banco de ideias.`); }
      catch (er) { try { await salvarAno(); } catch (e2) { /* segue */ } toast(`Mandei ${n}, depois deu erro: ${er.message}`, true); }
      repintar();
    });
    $$("[data-pa-ia]", box).forEach((b) => b.addEventListener("click", async () => {
      const pi = b.dataset.paIa, tema = x.temas[pi]; if (!tema || pa.gerando) return;
      const n = anoAtual().narrativa || {};
      pa.gerando = pi; repintar();
      try {
        const lista = await chamarIdeias({ acao: "ideias", rotulo: `${MESES[m - 1]} de ${pa.ano}`, quantidade: 3,
          notas: `PLANEJAMENTO ANUAL. Tema macro do mês para o pilar "${pi}": "${tema}". Foco do mês: ${x.foco || ""}. Datas: ${x.datas.join(", ")}. Quem eu sou: ${n.quem || ""} Para quem: ${n.paraQuem || ""} Quero 3 ideias diferentes dentro desse tema.`,
          evitar: x.ideias.map((i) => i.titulo), slots: ["Topo", "Meio", "Meio"].map((f, k) => ({ pilar: pi, funil: f, formato: ["Reels", "Carrossel", "Reels"][k] })) });
        lista.forEach((q, k) => { if (q && q.tema) x.ideias.push(ide(q.tema, pi, q.formato || ["Reels", "Carrossel", "Reels"][k], q.funil || ["Topo", "Meio", "Meio"][k])); });
        await salvarAno(); toast(lista.length ? `${lista.length} ideias novas em ${pi}.` : "A IA não devolveu ideias agora.", !lista.length);
      } catch (er) { toast("A IA não respondeu: " + er.message, true); }
      pa.gerando = null; repintar();
    }));
  }

  // os cartões de cada área abrem o mesmo formulário do conteúdo
  function ligarCliques(raiz) { $$("[data-id]", raiz).forEach((b) => b.addEventListener("click", () => abrir(acharConteudo(b.dataset.id)))); }

  async function abrirAba() {
    const sec = document.getElementById("aba-" + ABA);
    if (!sec) return;
    if (!st.pronto) { montar(sec); st.pronto = true; await Promise.all([carregar(), carregarIdeias(), carregarGanchos(), carregarAno().catch(() => { pa.dados = { anos: { 2027: JSON.parse(JSON.stringify(ANO_2027)) } }; })]); ajustarSemana(); }
    else await Promise.all([carregar(), carregarIdeias(), carregarGanchos(), carregarAno().catch(() => {})]);
    pintar();
    try { await carregarPlano(); } catch (er) { pl.lista = []; pl.atual = null; }
    pintarPlano();
  }
  document.addEventListener("painel:aba", (e) => { if (e.detail === ABA) abrirAba(); });
  if (location.hash === "#" + ABA) setTimeout(abrirAba, 600);
})();
