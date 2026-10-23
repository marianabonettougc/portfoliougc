// =========================================================
// PAINEL DE CONTEÚDO (Edge Function do Supabase)
// Criatividade > Painel de conteúdo (js/painel-conteudo.js) e a página do iPhone admin/salvar/.
// - { acao: "ideias", rotulo, quantidade, inspiracoes, notas, evitar, umaPorReferencia }
//   Cria ideias de conteúdo para o perfil da Mari (tema, tipo de UGC, funil, propósito,
//   hook, desenvolvimento do roteiro e CTA) seguindo o método de roteiro da Lara, que fica
//   só no Supabase (estilo_ugc.metodo e metodo_roteiro "references/tipos.md"), inspiradas nos
//   posts das pastas do Instagram dela ("Gravar em ..." e "Produzir vídeos assim"):
//   pode usar o mesmo tema, nunca as falas das criadoras. Com umaPorReferencia, cria uma
//   ideia para cada inspiração e devolve o número dela em "referencia". Junto com o método
//   entra a lógica de roteiro que atrai marca (teste do spec ad, vitrine para marca,
//   Stories de bastidor), com direção de cena, legenda pronta e "por que atrai marca".
//   Perfil de conteúdo (configuracoes chave "perfil_conteudo", JSON editado no cartão "Meu perfil
//   de conteúdo" do Painel): quem ela é, objetivo, pilares, tom de voz, o que evitar e o ritmo
//   (posts por semana, dias, horário, formatos, quantos de topo/meio/fundo por semana).
//   Com "slots" [{pilar, funil, formato}], cada ideia sai exatamente naquele pilar, funil e formato
//   (o painel distribui antes, para a variação não depender da IA).
// - { acao: "salvo", link, pasta }: ela salvou um post (atalho do iPhone ou admin/salvar/).
//   Responde na hora e, em segundo plano, lê o post (Apify), guarda no Laboratório com a
//   pasta, cria a ideia com roteiro no Painel do mês e manda notificação no iPhone (ntfy).
// - { acao: "notif_teste" }: notificação de teste no iPhone.
// As notificações saem pela função notificacoes (Web Push do painel instalado + app ntfy).
// Segredos: GROQ_API_KEY e APIFY_TOKEN (só no Supabase). Só a dona do painel pode usar.
// O tópico do ntfy (endereço das notificações) fica em configuracoes, chave "ntfy_topico".
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const GROQ = "https://api.groq.com/openai/v1";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PAINEL = "https://marianabonetto.com.br/admin/#planejar";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const txt = (x: unknown, n = 400) => String(x ?? "").replace(/\s*[—–]\s*/g, ", ").trim().slice(0, n);
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };
const semAcento = (s: string) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// mesmas travas da gerar-roteiro (construções banidas pela skill e ganchos batidos)
const FRASE_PROIBIDA = /\bn[aã]o [eé] (s[oó] |sobre |isso|apenas )[^.!?]{0,60}, [eé] |o problema n[aã]o [eé]|a[ií] eu (descobri|conheci)|hoje eu descobri|foi a[ií] que|foi quando|[eé] o tipo de|voc[eê] j[aá] reparou|voc[eê] sabia que|e sinceramente\?|isso muda (tudo|o jogo)|ol[aá],? pessoal|hoje vou falar sobre|queria compartilhar com voc[eê]s|hoje vim indicar|tem produtos que|se voc[eê] ainda t[aá] no ciclo|at[eé] (eu )?(descobrir|conhecer|encontrar)|at[eé] que (eu )?(descobri|conheci|encontrei)|mas n[aã]o [eé] (bem )?assim/i;
const GANCHO_BATIDO = /^\s*(voc[eê] j[aá] (cansou|acordou|se sentiu|sofreu)|cansad[ao] de|sabia que|descobri o segredo|chega de|quer saber como|\d+ passos simples|j[aá] acordou|adeus)/i;

// perfil padrão (o que a Mari contou em out/2026); ela edita no Painel
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
  tom: "Divertido e um pouco sarcástico, sem humor palhaço. Tom de amiga dando dica, como numa conversa: \"amiga, olha, hoje eu comprei uma luminária, ela é maravilhosa, tem iluminação assim e assim, gostei bastante porque ela faz isso\".",
  evitar: "Vícios de linguagem e gírias (eu não falo desse jeito). Esquetes, personagens, ceninhas e historinhas: quero UGC falando para a câmera com o produto em uso real.",
  ritmo: { porSemana: 3, dias: [0, 2, 4], horario: "12h", formatos: ["Reels", "Carrossel"], funil: { Topo: 1, Meio: 2, Fundo: 0 } },
};
async function lerPerfil(supa: any) {
  const { data } = await supa.from("configuracoes").select("valor").eq("chave", "perfil_conteudo").maybeSingle();
  try { const p = JSON.parse(data?.valor || ""); return { ...PERFIL_PADRAO, ...p, ritmo: { ...PERFIL_PADRAO.ritmo, ...(p.ritmo || {}) } }; } catch { return PERFIL_PADRAO; }
}
function textoPerfil(p: any) {
  const pil = (Array.isArray(p.pilares) ? p.pilares : []).map((x: any) => `- ${txt(x.nome, 60)}${x.descricao ? ": " + txt(x.descricao, 220) : ""}`).join("\n");
  return `PERFIL DE CONTEÚDO DELA (siga sempre):
Quem é: ${txt(p.quem, 500)}
Objetivo do perfil: ${txt(p.objetivo, 300)}
Pilares de conteúdo:
${pil}
Tom de voz: ${txt(p.tom, 500)}
Nunca: ${txt(p.evitar, 400)}`;
}

const ROTEIRO_MARCAS = `ROTEIROS QUE ATRAEM MARCAS (o objetivo dela é ser contratada, não só engajar):
- Todo roteiro de Reels ou carrossel passa em duas perguntas: (1) para o scroll de quem não a segue nos 3 primeiros segundos? (2) se uma marca cortasse esse vídeo e postasse como anúncio pago, funcionaria sem mudar o roteiro? (teste do spec ad). Se a resposta da 2 for não, reescreva.
- Tipo de roteiro:
  * "Spec ad" (o padrão): parece conteúdo espontâneo, mas tem estrutura de anúncio. Produto ou categoria nomeado, mostrado em cena na mão dela com uso real (não só citado), benefício específico e concreto, CTA de consumidor (comentar uma palavra para receber o link, cupom, "salva para comprar depois"). Sem "me contrate" no meio.
  * "Vitrine para marca": fala com quem contrata. Prova em vez de história pessoal: bastidor do processo (briefing virando roteiro, escolha de take, antes e depois da edição), resultado de trabalho, depoimento. CTA de contato: "comenta PORTFOLIO", "link de contato na bio".
  * "Stories de bastidor": para quem já chegou no perfil. Processo cru de gravação, figurinha de enquete ou caixinha, proximidade.
- Ganchos que funcionam: pergunta provocativa sobre um hábito; "motivos plausíveis para [ação ligada ao produto]"; meta com número ("meta: [resultado] em [tempo]"); começar no meio de uma cena reconhecível do dia a dia; prova crua primeiro. Varie o padrão de gancho entre as ideias.
- Engajamento: o roteiro provoca comentário (pergunta de escolha, opinião, "qual você usaria?") e salvamento (lista útil, passo a passo), além da curtida.
- Evitar: lifestyle genérico e confessional em Reels de descoberta (isso é para Stories), CTA vago ou ausente, produto só citado, misturar CTA de compra com "me contrate" no mesmo roteiro.
- O desenvolvimento traz direção de cena entre colchetes em cada bloco: o que a câmera mostra, o que ela faz com as mãos, texto na tela.`;

async function groq(chave: string, pedido: string, max = 3600) {
  const r = await fetch(`${GROQ}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-oss-120b", temperature: 0.7, max_tokens: max, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "user", content: pedido }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "LIMITE" : "A IA não respondeu agora. Tente de novo.");
  return lerJson(String(j.choices?.[0]?.message?.content || ""));
}

function limpar(a: any) {
  const lista = Array.isArray(a?.ideias) ? a.ideias : [];
  return lista.map((x: any) => ({
    tema: txt(x.tema, 120), formato: ["Reels", "Carrossel", "Stories"].includes(x.formato) ? x.formato : "Reels",
    tipo_roteiro: ["Spec ad", "Vitrine para marca", "Stories de bastidor"].includes(x.tipo_roteiro) ? x.tipo_roteiro : (x.formato === "Stories" ? "Stories de bastidor" : "Spec ad"),
    pilar: txt(x.pilar, 60), tipo_ugc: txt(x.tipo_ugc, 60), funil: ["Topo", "Meio", "Fundo"].includes(x.funil) ? x.funil : "Topo",
    proposito: txt(x.proposito, 260), hook: txt(x.hook, 260),
    ganchos: (Array.isArray(x.ganchos) ? x.ganchos : []).map((g: unknown) => txt(g, 200)).filter(Boolean).slice(0, 3),
    desenvolvimento: txt(x.desenvolvimento, 3200), cta: txt(x.cta, 260), legenda: txt(x.legenda, 900), porque: txt(x.porque, 320),
    inspirado_em: txt(x.inspirado_em, 80),
    duracao_seg: Number(x.duracao_seg) > 0 ? Math.round(Number(x.duracao_seg)) : null,
    referencia: Number(x.referencia) > 0 ? Math.round(Number(x.referencia)) : null,
  })).filter((x: any) => x.tema && x.hook);
}
function problemas(x: any) {
  const p: string[] = [];
  if (GANCHO_BATIDO.test(x.hook)) p.push(`gancho batido: "${x.hook}"`);
  for (const t of [x.hook, x.desenvolvimento, x.cta, x.legenda, ...x.ganchos]) { const m = String(t || "").match(FRASE_PROIBIDA); if (m) p.push(`construção proibida: "${m[0]}"`); }
  return p;
}

async function criarIdeias(supa: any, chave: string, c: any) {
  const [{ data: est }, { data: tipos }, perfil] = await Promise.all([
    supa.from("estilo_ugc").select("metodo").eq("id", 1).maybeSingle(),
    supa.from("metodo_roteiro").select("conteudo").eq("arquivo", "references/tipos.md").maybeSingle(),
    lerPerfil(supa),
  ]);
  const slots = (Array.isArray(c.slots) ? c.slots : []).slice(0, 3).map((s: any) => ({ pilar: txt(s.pilar, 60), funil: ["Topo", "Meio", "Fundo"].includes(s.funil) ? s.funil : "Topo", formato: ["Reels", "Carrossel", "Stories"].includes(s.formato) ? s.formato : "Reels" }));
  const metodo = txt(est?.metodo, 4000);
  const tiposTxt = txt(tipos?.conteudo, 3000);
  const insp = (Array.isArray(c.inspiracoes) ? c.inspiracoes : []).slice(0, 12).map((p: any, i: number) =>
    `${i + 1}. @${txt(p.perfil, 40) || "?"} (${txt(p.tipo, 20) || "post"}, pasta "${txt(p.colecao, 60)}")\nLegenda: ${txt(p.legenda, 260) || "sem legenda"}${p.transcricao ? "\nFala: " + txt(p.transcricao, 480) : ""}`).join("\n\n");
  const porRef = Boolean(c.umaPorReferencia) && Array.isArray(c.inspiracoes) && c.inspiracoes.length > 0;
  const qtd = porRef ? Math.min(3, c.inspiracoes.length) : slots.length ? slots.length : Math.min(3, Math.max(1, Number(c.quantidade) || 3));
  const funilTxt = `FUNIL: Topo = para quem não a conhece (descoberta, parar o scroll, tema amplo e identificável). Meio = para quem já viu um vídeo dela (mostrar quem ela é, gerar confiança e conexão, prova de que o produto funciona na vida real dela, o porquê das escolhas). Fundo = conversão (contato de marca, link, cupom).`;
  const slotsTxt = slots.length ? `\n\nCADA IDEIA TEM UM LUGAR FIXO NA GRADE (obrigatório, na mesma ordem):\n${slots.map((s: any, i: number) => `Ideia ${i + 1}: pilar "${s.pilar}", funil ${s.funil}, formato ${s.formato}`).join("\n")}\nRepita o pilar, o funil e o formato exatamente como estão.` : "";
  const pedido = `Você é roteirista sênior de uma criadora brasileira de UGC (Mari Bonetto). O perfil dela existe para ser contratada por marcas: cada conteúdo precisa parar o scroll de quem não a segue, gerar comentário, curtida e salvamento, e provar que ela sabe fazer o vídeo que uma marca precisa.

${textoPerfil(perfil)}

${funilTxt}

MÉTODO DE ROTEIRO DA LARA (siga à risca):
${metodo}

${ROTEIRO_MARCAS}

TIPOS DE UGC (escolha um destes para cada ideia):
${tiposTxt}

INSPIRAÇÕES (posts que ela salvou nas pastas do Instagram para o mês de ${txt(c.rotulo, 40)}):
${insp || "Nenhuma inspiração enviada: use os nichos dela."}

${c.notas ? "PEDIDO DELA: " + txt(c.notas, 600) + "\n\n" : ""}${Array.isArray(c.evitar) && c.evitar.length ? "JÁ EXISTEM ESTES TEMAS (não repita): " + c.evitar.slice(0, 40).map((t: unknown) => txt(t, 80)).join("; ") + "\n\n" : ""}${porRef ? `Crie exatamente UMA ideia para CADA inspiração (${qtd} ideias), na mesma ordem: a ideia 1 parte da inspiração 1, a 2 da 2 e assim por diante. Use o mesmo tema e o recurso que fez a inspiração funcionar, adaptados ao nicho e à vida dela. No campo "referencia" coloque o número da inspiração.` : `Crie ${qtd} ideias de conteúdo para o perfil dela.`}${slotsTxt} Regras:
- Fale como ela: tom de amiga contando uma dica, divertido e com uma pitada de sarcasmo, frases naturais. Sem gírias, sem vícios de linguagem ("tipo assim", "né", "gente", "mano", "bora", "miga", "socorro"), sem humor exagerado.
- Nada de esquete, personagem, encenação, várias vozes ou historinha: ela fala para a câmera com o produto em uso real. Não escolha tipos de UGC de teatro, personagens ou várias vozes.
- O pilar de cada ideia é um dos pilares do perfil, com o nome igual.
- Inspire-se nos temas, formatos e estruturas das inspirações, mas NUNCA copie falas, frases, ganchos ou bordões das criadoras. Mesmo tema, outro ângulo, palavras dela.
- A maioria das ideias é "Spec ad"; use "Vitrine para marca" e "Stories de bastidor" quando o tema pedir. Varie o tipo de UGC e o padrão de gancho.
- Desenvolvimento completo e gravável: as falas dela em primeira pessoa, no português falado, um bloco por linha no formato "BLOCO: fala [direção de cena]". Spec ad: GANCHO, IDENTIFICAÇÃO, SOLUÇÃO, PROVA, FECHAMENTO. Vitrine: GANCHO, CONTEXTO, CONTEÚDO, FECHAMENTO. Carrossel: um bloco por slide (SLIDE 1, SLIDE 2...). Reels com 25 a 45 segundos de fala.
- Nunca invente número, preço, data, resultado ou nome de produto: o que depender de informação vira [campo entre colchetes].
- CTA com uma ação só, coerente com o tipo de roteiro (de preferência comentar uma palavra única).
- Legenda pronta para postar (2 a 4 linhas, repetindo a palavra do CTA) e 5 a 8 hashtags de nicho no fim.
- Nunca use travessão.

Responda SOMENTE um JSON:
{"ideias":[{"tema":"tema em poucas palavras","pilar":"nome do pilar","formato":"Reels | Carrossel | Stories","tipo_roteiro":"Spec ad | Vitrine para marca | Stories de bastidor","tipo_ugc":"um dos tipos acima","funil":"Topo | Meio | Fundo","proposito":"o que esse conteúdo faz pelo perfil dela (atrair qual marca, gerar qual reação)","hook":"a primeira fala, para o dedo em 3 segundos","ganchos":["outra opção de gancho","mais uma"],"desenvolvimento":"GANCHO: ... [cena]\\nIDENTIFICAÇÃO: ... [cena]\\n...","cta":"o CTA","legenda":"legenda pronta + hashtags","porque":"1 ou 2 frases: por que esse roteiro passa no teste do spec ad e atrai marca","inspirado_em":"@perfil que inspirou (ou vazio)","referencia":1,"duracao_seg":35}]}`;
  const saida = limpar(await groq(chave, pedido));
  // uma reescrita automática se aparecer construção banida ou gancho batido
  const ruins = saida.map((x: any, i: number) => ({ i, p: problemas(x) })).filter((r: any) => r.p.length);
  if (ruins.length) {
    try {
      const conserto = await groq(chave, `Reescreva só os trechos com problema destas ideias de roteiro, mantendo todos os campos e a qualidade. Problemas: ${ruins.map((r: any) => `ideia ${r.i + 1}: ${r.p.join("; ")}`).join(" | ")}.
Regras: português falado, primeira pessoa, frases curtas, nada de "não é X, é Y", nada de "foi aí que", "aí eu descobri", "você sabia que", "você já reparou", ganchos batidos ("cansada de", "chega de", "adeus"), nunca travessão.
Ideias: ${JSON.stringify({ ideias: ruins.map((r: any) => saida[r.i]) })}
Responda SOMENTE o JSON {"ideias":[...]} com as ideias corrigidas, na mesma ordem e com os mesmos campos.`, 3200);
      const novas = limpar(conserto);
      ruins.forEach((r: any, k: number) => { if (novas[k] && !problemas(novas[k]).length) saida[r.i] = { ...novas[k], referencia: saida[r.i].referencia }; });
    } catch { /* fica a primeira versão */ }
  }
  // o lugar na grade manda: pilar, funil e formato do slot
  saida.forEach((x: any, i: number) => { const s = slots[i]; if (s) { x.pilar = s.pilar; x.funil = s.funil; x.formato = s.formato; if (x.formato !== "Stories" && x.tipo_roteiro === "Stories de bastidor") x.tipo_roteiro = "Spec ad"; } });
  return saida;
}

// ---------- salvar uma referência (iPhone) ----------
async function lerPost(link: string) {
  const token = Deno.env.get("APIFY_TOKEN") || "";
  if (!token) return null;
  try {
    const r = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=90`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directUrls: [link], resultsType: "posts", resultsLimit: 1, addParentData: false }),
    });
    const itens = await r.json().catch(() => []);
    const p = Array.isArray(itens) ? itens.find((x: any) => x && !x.error && (x.shortCode || x.caption || x.ownerUsername)) : null;
    if (!p) return null;
    const tipo = p.type === "Video" || p.productType === "clips" ? "Reel" : p.type === "Sidecar" ? "Carrossel" : "Post";
    return { perfil: p.ownerUsername || null, tipo, legenda: String(p.caption || "").slice(0, 4000) || null, publicado_em: p.timestamp || null };
  } catch { return null; }
}
// manda pela função notificacoes (celular com o painel instalado + app ntfy), com o login dela
let AUTH = "";
async function notificar(_supa: any, titulo: string, texto: string) {
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notificacoes`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: AUTH },
    body: JSON.stringify({ acao: "enviar", titulo: titulo.slice(0, 120), texto: texto.slice(0, 3000), url: PAINEL }),
  }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  return Boolean(r?.ok && (j.celulares || j.ntfy));
}
const pad = (n: number) => String(n).padStart(2, "0");
function hojeBR() { const d = new Date(Date.now() - 3 * 3600 * 1000); return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }
function mesDaPasta(pasta: string) {
  const h = hojeBR(); const s = semAcento(pasta);
  const i = MESES.findIndex((m) => s.includes(semAcento(m)));
  if (i < 0) return `${h.a}-${pad(h.m)}`;
  return `${i + 1 < h.m ? h.a + 1 : h.a}-${pad(i + 1)}`;
}
// próximo dia livre do ritmo dela (dias da semana do perfil) + o pilar menos usado e o funil que falta na semana
async function proximoSlot(supa: any, mes: string, perfil: any) {
  const { data } = await supa.from("painel_conteudo").select("data,pilar,funil,formato").eq("mes", mes);
  const posts = data || [];
  const ocupados = new Set(posts.map((x: any) => x.data).filter(Boolean));
  const [a, m] = mes.split("-").map(Number); const h = hojeBR();
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const dias: number[] = Array.isArray(perfil.ritmo?.dias) && perfil.ritmo.dias.length ? perfil.ritmo.dias : [0, 1, 2, 3, 4, 5, 6];
  let dia: string | null = null;
  for (let d = a === h.a && m === h.m ? h.d + 1 : 1; d <= ultimo && !dia; d++) {
    const dow = (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7; const s = `${a}-${pad(m)}-${pad(d)}`;
    if (dias.includes(dow) && !ocupados.has(s)) dia = s;
  }
  if (!dia) for (let d = a === h.a && m === h.m ? h.d + 1 : 1; d <= ultimo && !dia; d++) { const s = `${a}-${pad(m)}-${pad(d)}`; if (!ocupados.has(s)) dia = s; }
  const nomes = (perfil.pilares || []).map((p: any) => p.nome).filter(Boolean);
  const conta = (k: string, v: string) => posts.filter((x: any) => x[k] === v).length;
  const pilar = nomes.slice().sort((x: string, y: string) => conta("pilar", x) - conta("pilar", y))[0] || "";
  const fun = perfil.ritmo?.funil || { Topo: 1, Meio: 2 };
  const funil = ["Topo", "Meio", "Fundo"].filter((f) => Number(fun[f]) > 0).sort((x, y) => conta("funil", x) / Number(fun[x]) - conta("funil", y) / Number(fun[y]))[0] || "Topo";
  const forms: string[] = perfil.ritmo?.formatos?.length ? perfil.ritmo.formatos : ["Reels"];
  const formato = forms.slice().sort((x, y) => conta("formato", x) - conta("formato", y))[0];
  return { dia, pilar, funil, formato, horario: perfil.ritmo?.horario || "12h" };
}
async function processarSalvo(supa: any, chave: string, linkBruto: string, pasta: string) {
  const m = linkBruto.match(/instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/([\w-]+)/i)!;
  const codigo = m[2];
  const link = `https://www.instagram.com/${m[1].toLowerCase() === "p" ? "p" : "reel"}/${codigo}/`;
  const { data: achados } = await supa.from("laboratorio").select("*").ilike("link", `%/${codigo}/%`).limit(1);
  let post: any = achados?.[0] || null;
  if (!post || !post.legenda) {
    const info = await lerPost(link);
    const campos: any = { link: post?.link || link, codigo, colecao: pasta || post?.colecao || null, ...(info || {}) };
    if (post) { await supa.from("laboratorio").update(campos).eq("id", post.id); post = { ...post, ...campos }; }
    else { const r = await supa.from("laboratorio").insert(campos).select().maybeSingle(); post = r.data || campos; }
  } else if (pasta && post.colecao !== pasta) { await supa.from("laboratorio").update({ colecao: pasta }).eq("id", post.id); post.colecao = pasta; }
  const mes = mesDaPasta(pasta || "");
  const [a, mm] = mes.split("-").map(Number);
  const slot = await proximoSlot(supa, mes, await lerPerfil(supa));
  let ideias: any[] = [];
  for (let t = 0; t < 3 && !ideias.length; t++) {
    try { ideias = await criarIdeias(supa, chave, { rotulo: `${MESES[mm - 1]} de ${a}`, umaPorReferencia: true, slots: slot.pilar ? [{ pilar: slot.pilar, funil: slot.funil, formato: slot.formato }] : [], inspiracoes: [{ perfil: post.perfil, tipo: post.tipo, colecao: post.colecao, legenda: post.legenda, transcricao: post.transcricao }] }); }
    catch (e) { if (String((e as Error).message) === "LIMITE") await new Promise((ok) => setTimeout(ok, 30000)); else break; }
  }
  const x = ideias[0];
  const quem = post.perfil ? "@" + String(post.perfil).replace(/^@/, "") : "a criadora";
  if (!x) { await notificar(supa, "Referência salva", `Guardei o post de ${quem}${pasta ? ` na pasta ${pasta}` : ""}, mas a IA não respondeu agora. Abra o Painel de conteúdo e clique em Montar a grade.`); return; }
  const data = slot.dia;
  await supa.from("painel_conteudo").insert({ mes, data, horario: slot.horario, formato: x.formato, pilar: x.pilar || slot.pilar || null, tipo_roteiro: x.tipo_roteiro, tema: x.tema, tipo_ugc: x.tipo_ugc, funil: x.funil,
    proposito: x.proposito, hook: x.hook, ganchos: x.ganchos, desenvolvimento: x.desenvolvimento, cta: x.cta, legenda: x.legenda, porque: x.porque, status: "Roteirizado",
    inspiracao: { link: post.link || link, perfil: post.perfil ? "@" + String(post.perfil).replace(/^@/, "") : x.inspirado_em, colecao: post.colecao || pasta || null, legenda: String(post.legenda || "").split("\n")[0].slice(0, 160), duracao_seg: x.duracao_seg } });
  const dia = data ? `${data.slice(8, 10)}/${data.slice(5, 7)}` : "sem dia definido";
  await notificar(supa, `Nova ideia: ${x.tema}`, `${x.formato} · ${x.pilar ? x.pilar + " · " : ""}${x.tipo_roteiro} · ${dia}\nHook: "${x.hook}"\nCTA: ${x.cta}\nReferência: ${quem}\nToque para abrir o roteiro completo no Painel.`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    AUTH = auth;
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user || user.email !== EMAIL_DONA) return resposta({ error: "Não autorizado" }, 401);
    const chave = Deno.env.get("GROQ_API_KEY") || "";
    if (!chave) return resposta({ error: "Falta a chave do Groq no Supabase (GROQ_API_KEY)." }, 500);
    const corpo = await req.json().catch(() => ({}));
    if (corpo.acao === "ideias") return resposta({ ideias: await criarIdeias(supa, chave, corpo) });
    if (corpo.acao === "salvo") {
      const link = String(corpo.link || "");
      if (!/instagram\.com\/(?:[\w.]+\/)?(p|reels?|tv)\/[\w-]+/i.test(link)) return resposta({ error: "Esse link não é de um post do Instagram." }, 400);
      // responde na hora; ler o post, criar o roteiro e notificar acontece em segundo plano
      // @ts-ignore EdgeRuntime existe no Supabase
      EdgeRuntime.waitUntil(processarSalvo(supa, chave, link, txt(corpo.pasta, 80)).catch((e) => console.error(e)));
      return resposta({ ok: true });
    }
    if (corpo.acao === "notif_teste") {
      const ok = await notificar(supa, "Painel da Mari", "Notificações funcionando! Quando você salvar uma referência pelo atalho, a ideia com roteiro chega aqui.");
      return ok ? resposta({ ok: true }) : resposta({ error: "Nenhum celular ativado ainda (Geral > Notificações no celular)." }, 400);
    }
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    const msg = String((e as Error).message || "");
    if (msg === "LIMITE") return resposta({ error: "O limite grátis da IA deste minuto acabou. Espere um minutinho e clique de novo.", limite: true }, 429);
    console.error(e);
    return resposta({ error: msg || "Algo deu errado." }, 502);
  }
});
