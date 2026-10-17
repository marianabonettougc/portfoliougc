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
// - { acao: "salvo", link, pasta }: ela salvou um post (atalho do iPhone ou admin/salvar/).
//   Responde na hora e, em segundo plano, lê o post (Apify), guarda no Laboratório com a
//   pasta, cria a ideia com roteiro no Painel do mês e manda notificação no iPhone (ntfy).
// - { acao: "notif_teste" }: notificação de teste no iPhone.
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
    tipo_ugc: txt(x.tipo_ugc, 60), funil: ["Topo", "Meio", "Fundo"].includes(x.funil) ? x.funil : "Topo",
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
  const [{ data: est }, { data: tipos }] = await Promise.all([
    supa.from("estilo_ugc").select("metodo").eq("id", 1).maybeSingle(),
    supa.from("metodo_roteiro").select("conteudo").eq("arquivo", "references/tipos.md").maybeSingle(),
  ]);
  const metodo = txt(est?.metodo, 4000);
  const tiposTxt = txt(tipos?.conteudo, 3000);
  const insp = (Array.isArray(c.inspiracoes) ? c.inspiracoes : []).slice(0, 12).map((p: any, i: number) =>
    `${i + 1}. @${txt(p.perfil, 40) || "?"} (${txt(p.tipo, 20) || "post"}, pasta "${txt(p.colecao, 60)}")\nLegenda: ${txt(p.legenda, 260) || "sem legenda"}${p.transcricao ? "\nFala: " + txt(p.transcricao, 480) : ""}`).join("\n\n");
  const porRef = Boolean(c.umaPorReferencia) && Array.isArray(c.inspiracoes) && c.inspiracoes.length > 0;
  const qtd = porRef ? Math.min(3, c.inspiracoes.length) : Math.min(3, Math.max(1, Number(c.quantidade) || 3));
  const pedido = `Você é roteirista sênior de uma criadora brasileira de UGC (Mari Bonetto, mãe, nichos maternidade, cabelo, beleza, casa e tech). O perfil dela existe para ser contratada por marcas: cada conteúdo precisa parar o scroll de quem não a segue, gerar comentário, curtida e salvamento, e provar que ela sabe fazer o vídeo que uma marca precisa.

MÉTODO DE ROTEIRO DA LARA (siga à risca):
${metodo}

${ROTEIRO_MARCAS}

TIPOS DE UGC (escolha um destes para cada ideia):
${tiposTxt}

INSPIRAÇÕES (posts que ela salvou nas pastas do Instagram para o mês de ${txt(c.rotulo, 40)}):
${insp || "Nenhuma inspiração enviada: use os nichos dela."}

${c.notas ? "PEDIDO DELA: " + txt(c.notas, 600) + "\n\n" : ""}${Array.isArray(c.evitar) && c.evitar.length ? "JÁ EXISTEM ESTES TEMAS (não repita): " + c.evitar.slice(0, 40).map((t: unknown) => txt(t, 80)).join("; ") + "\n\n" : ""}${porRef ? `Crie exatamente UMA ideia para CADA inspiração (${qtd} ideias), na mesma ordem: a ideia 1 parte da inspiração 1, a 2 da 2 e assim por diante. Use o mesmo tema e o recurso que fez a inspiração funcionar, adaptados ao nicho e à vida dela. No campo "referencia" coloque o número da inspiração.` : `Crie ${qtd} ideias de conteúdo para o perfil dela.`} Regras:
- Inspire-se nos temas, formatos e estruturas das inspirações, mas NUNCA copie falas, frases, ganchos ou bordões das criadoras. Mesmo tema, outro ângulo, palavras dela.
- A maioria das ideias é "Spec ad"; use "Vitrine para marca" e "Stories de bastidor" quando o tema pedir. Varie tipo de UGC, formato e funil.
- Desenvolvimento completo e gravável: as falas dela em primeira pessoa, no português falado, um bloco por linha no formato "BLOCO: fala [direção de cena]". Spec ad: GANCHO, IDENTIFICAÇÃO, SOLUÇÃO, PROVA, FECHAMENTO. Vitrine: GANCHO, CONTEXTO, CONTEÚDO, FECHAMENTO. Carrossel: um bloco por slide (SLIDE 1, SLIDE 2...). Reels com 25 a 45 segundos de fala.
- Nunca invente número, preço, data, resultado ou nome de produto: o que depender de informação vira [campo entre colchetes].
- CTA com uma ação só, coerente com o tipo de roteiro (de preferência comentar uma palavra única).
- Legenda pronta para postar (2 a 4 linhas, repetindo a palavra do CTA) e 5 a 8 hashtags de nicho no fim.
- Nunca use travessão.

Responda SOMENTE um JSON:
{"ideias":[{"tema":"tema em poucas palavras","formato":"Reels | Carrossel | Stories","tipo_roteiro":"Spec ad | Vitrine para marca | Stories de bastidor","tipo_ugc":"um dos tipos acima","funil":"Topo | Meio | Fundo","proposito":"o que esse conteúdo faz pelo perfil dela (atrair qual marca, gerar qual reação)","hook":"a primeira fala, para o dedo em 3 segundos","ganchos":["outra opção de gancho","mais uma"],"desenvolvimento":"GANCHO: ... [cena]\\nIDENTIFICAÇÃO: ... [cena]\\n...","cta":"o CTA","legenda":"legenda pronta + hashtags","porque":"1 ou 2 frases: por que esse roteiro passa no teste do spec ad e atrai marca","inspirado_em":"@perfil que inspirou (ou vazio)","referencia":1,"duracao_seg":35}]}`;
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
async function notificar(supa: any, titulo: string, texto: string) {
  const { data } = await supa.from("configuracoes").select("valor").eq("chave", "ntfy_topico").maybeSingle();
  const topico = String(data?.valor || "").replace(/"/g, "").trim();
  if (!topico) return false;
  const r = await fetch("https://ntfy.sh/", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: topico, title: titulo.slice(0, 120), message: texto.slice(0, 3800), tags: ["sparkles"], click: PAINEL }),
  }).catch(() => null);
  return Boolean(r?.ok);
}
const pad = (n: number) => String(n).padStart(2, "0");
function hojeBR() { const d = new Date(Date.now() - 3 * 3600 * 1000); return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }; }
function mesDaPasta(pasta: string) {
  const h = hojeBR(); const s = semAcento(pasta);
  const i = MESES.findIndex((m) => s.includes(semAcento(m)));
  if (i < 0) return `${h.a}-${pad(h.m)}`;
  return `${i + 1 < h.m ? h.a + 1 : h.a}-${pad(i + 1)}`;
}
async function proximoDiaLivre(supa: any, mes: string) {
  const { data } = await supa.from("painel_conteudo").select("data").eq("mes", mes);
  const ocupados = new Set((data || []).map((x: any) => x.data).filter(Boolean));
  const [a, m] = mes.split("-").map(Number); const h = hojeBR();
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  for (let d = a === h.a && m === h.m ? h.d + 1 : 1; d <= ultimo; d++) { const s = `${a}-${pad(m)}-${pad(d)}`; if (!ocupados.has(s)) return s; }
  return null;
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
  let ideias: any[] = [];
  for (let t = 0; t < 3 && !ideias.length; t++) {
    try { ideias = await criarIdeias(supa, chave, { rotulo: `${MESES[mm - 1]} de ${a}`, umaPorReferencia: true, inspiracoes: [{ perfil: post.perfil, tipo: post.tipo, colecao: post.colecao, legenda: post.legenda, transcricao: post.transcricao }] }); }
    catch (e) { if (String((e as Error).message) === "LIMITE") await new Promise((ok) => setTimeout(ok, 30000)); else break; }
  }
  const x = ideias[0];
  const quem = post.perfil ? "@" + String(post.perfil).replace(/^@/, "") : "a criadora";
  if (!x) { await notificar(supa, "Referência salva", `Guardei o post de ${quem}${pasta ? ` na pasta ${pasta}` : ""}, mas a IA não respondeu agora. Abra o Painel de conteúdo e clique em Montar a grade.`); return; }
  const data = await proximoDiaLivre(supa, mes);
  await supa.from("painel_conteudo").insert({ mes, data, horario: "12h", formato: x.formato, tipo_roteiro: x.tipo_roteiro, tema: x.tema, tipo_ugc: x.tipo_ugc, funil: x.funil,
    proposito: x.proposito, hook: x.hook, ganchos: x.ganchos, desenvolvimento: x.desenvolvimento, cta: x.cta, legenda: x.legenda, porque: x.porque, status: "Roteirizado",
    inspiracao: { link: post.link || link, perfil: post.perfil ? "@" + String(post.perfil).replace(/^@/, "") : x.inspirado_em, colecao: post.colecao || pasta || null, legenda: String(post.legenda || "").split("\n")[0].slice(0, 160), duracao_seg: x.duracao_seg } });
  const dia = data ? `${data.slice(8, 10)}/${data.slice(5, 7)}` : "sem dia definido";
  await notificar(supa, `Nova ideia: ${x.tema}`, `${x.formato} · ${x.tipo_roteiro} · ${dia}\nHook: "${x.hook}"\nCTA: ${x.cta}\nReferência: ${quem}\nToque para abrir o roteiro completo no Painel.`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
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
      return ok ? resposta({ ok: true }) : resposta({ error: "As notificações ainda não estão ligadas no painel." }, 400);
    }
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    const msg = String((e as Error).message || "");
    if (msg === "LIMITE") return resposta({ error: "O limite grátis da IA deste minuto acabou. Espere um minutinho e clique de novo.", limite: true }, 429);
    console.error(e);
    return resposta({ error: msg || "Algo deu errado." }, 502);
  }
});
