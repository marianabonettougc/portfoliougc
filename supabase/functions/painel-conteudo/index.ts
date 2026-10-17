// =========================================================
// PAINEL DE CONTEÚDO (Edge Function do Supabase)
// Criatividade > Painel de conteúdo (js/painel-conteudo.js).
// { acao: "ideias", rotulo, quantidade, inspiracoes, notas, evitar }
//   Cria ideias de conteúdo para o perfil da Mari (tema, tipo de UGC, funil, propósito,
//   hook, desenvolvimento do roteiro e CTA) seguindo o método de roteiro da Lara, que fica
//   só no Supabase (estilo_ugc.metodo e metodo_roteiro "references/tipos.md"), inspiradas nos
//   posts das pastas do Instagram dela ("Gravar em ..." e "Produzir vídeos assim"):
//   pode usar o mesmo tema, nunca as falas das criadoras.
// Segredo: GROQ_API_KEY (só no Supabase). Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const GROQ = "https://api.groq.com/openai/v1";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const txt = (x: unknown, n = 400) => String(x ?? "").replace(/\s*[—–]\s*/g, ", ").trim().slice(0, n);
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };
// mesmas travas da gerar-roteiro (construções banidas pela skill e ganchos batidos)
const FRASE_PROIBIDA = /\bn[aã]o [eé] (s[oó] |sobre |isso|apenas )[^.!?]{0,60}, [eé] |o problema n[aã]o [eé]|a[ií] eu (descobri|conheci)|hoje eu descobri|foi a[ií] que|foi quando|[eé] o tipo de|voc[eê] j[aá] reparou|voc[eê] sabia que|e sinceramente\?|isso muda (tudo|o jogo)|ol[aá],? pessoal|hoje vou falar sobre|queria compartilhar com voc[eê]s|hoje vim indicar|tem produtos que|se voc[eê] ainda t[aá] no ciclo|at[eé] (eu )?(descobrir|conhecer|encontrar)|at[eé] que (eu )?(descobri|conheci|encontrei)|mas n[aã]o [eé] (bem )?assim/i;
const GANCHO_BATIDO = /^\s*(voc[eê] j[aá] (cansou|acordou|se sentiu|sofreu)|cansad[ao] de|sabia que|descobri o segredo|chega de|quer saber como|\d+ passos simples|j[aá] acordou|adeus)/i;

async function groq(chave: string, pedido: string, max = 3200) {
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
    tipo_ugc: txt(x.tipo_ugc, 60), funil: ["Topo", "Meio", "Fundo"].includes(x.funil) ? x.funil : "Topo",
    proposito: txt(x.proposito, 240), hook: txt(x.hook, 240),
    ganchos: (Array.isArray(x.ganchos) ? x.ganchos : []).map((g: unknown) => txt(g, 200)).filter(Boolean).slice(0, 3),
    desenvolvimento: txt(x.desenvolvimento, 2400), cta: txt(x.cta, 240), inspirado_em: txt(x.inspirado_em, 80),
    duracao_seg: Number(x.duracao_seg) > 0 ? Math.round(Number(x.duracao_seg)) : null,
  })).filter((x: any) => x.tema && x.hook);
}
function problemas(x: any) {
  const p: string[] = [];
  if (GANCHO_BATIDO.test(x.hook)) p.push(`gancho batido: "${x.hook}"`);
  for (const t of [x.hook, x.desenvolvimento, x.cta, ...x.ganchos]) { const m = String(t || "").match(FRASE_PROIBIDA); if (m) p.push(`construção proibida: "${m[0]}"`); }
  return p;
}

async function ideias(supa: any, chave: string, c: any) {
  const [{ data: est }, { data: tipos }] = await Promise.all([
    supa.from("estilo_ugc").select("metodo").eq("id", 1).maybeSingle(),
    supa.from("metodo_roteiro").select("conteudo").eq("arquivo", "references/tipos.md").maybeSingle(),
  ]);
  const metodo = txt(est?.metodo, 4000);
  const tiposTxt = txt(tipos?.conteudo, 3200);
  const insp = (Array.isArray(c.inspiracoes) ? c.inspiracoes : []).slice(0, 12).map((p: any, i: number) =>
    `${i + 1}. @${txt(p.perfil, 40) || "?"} (${txt(p.tipo, 20) || "post"}, pasta "${txt(p.colecao, 60)}")\nLegenda: ${txt(p.legenda, 260) || "sem legenda"}${p.transcricao ? "\nFala: " + txt(p.transcricao, 520) : ""}`).join("\n\n");
  const qtd = Math.min(6, Math.max(1, Number(c.quantidade) || 4));
  const pedido = `Você é roteirista de uma criadora brasileira de UGC (Mari Bonetto, mãe, nichos maternidade, cabelo, beleza, casa e tech). O perfil dela existe para atrair marcas: cada conteúdo precisa parar o scroll de quem não a segue E provar que ela sabe fazer o vídeo que uma marca precisa.

MÉTODO DE ROTEIRO (siga à risca):
${metodo}

TIPOS DE UGC (escolha um destes para cada ideia):
${tiposTxt}

INSPIRAÇÕES (posts que ela salvou nas pastas do Instagram para o mês de ${txt(c.rotulo, 40)}):
${insp || "Nenhuma inspiração enviada: use os nichos dela."}

${c.notas ? "PEDIDO DELA: " + txt(c.notas, 600) + "\n\n" : ""}${Array.isArray(c.evitar) && c.evitar.length ? "JÁ EXISTEM ESTES TEMAS (não repita): " + c.evitar.slice(0, 40).map((t: unknown) => txt(t, 80)).join("; ") + "\n\n" : ""}Crie ${qtd} ideias de conteúdo para o perfil dela. Regras:
- Inspire-se nos temas, formatos e estruturas das inspirações, mas NUNCA copie falas, frases, ganchos ou bordões das criadoras. Pode usar o mesmo tema com outro ângulo e palavras dela.
- Varie tipo de UGC, formato e funil entre as ideias.
- Desenvolvimento: as falas dela em primeira pessoa, no português falado, separadas por bloco. Para conteúdo de valor use GANCHO, CONTEXTO, CONTEÚDO, FECHAMENTO; se a ideia for publi de produto use GANCHO, IDENTIFICAÇÃO, SOLUÇÃO, PROVA, FECHAMENTO. Um bloco por linha, no formato "BLOCO: fala". Indique entre colchetes o que aparece na tela quando ajudar.
- Nunca invente número, preço, data ou nome de produto: o que depender de informação vira [campo entre colchetes].
- CTA com uma ação só (de preferência comentar uma palavra única).
- Nunca use travessão.

Responda SOMENTE um JSON:
{"ideias":[{"tema":"tema em poucas palavras","formato":"Reels | Carrossel | Stories","tipo_ugc":"um dos tipos acima","funil":"Topo | Meio | Fundo","proposito":"para que serve esse conteúdo no perfil dela (1 frase)","hook":"a primeira fala, para o dedo em 3 segundos","ganchos":["outra opção de gancho","mais uma"],"desenvolvimento":"GANCHO: ...\\nCONTEXTO: ...\\nCONTEÚDO: ...\\nFECHAMENTO: ...","cta":"o CTA","inspirado_em":"@perfil que inspirou (ou vazio)","duracao_seg":30}]}`;
  let saida = limpar(await groq(chave, pedido));
  // uma reescrita automática se aparecer construção banida ou gancho batido
  const ruins = saida.map((x: any, i: number) => ({ i, p: problemas(x) })).filter((r: any) => r.p.length);
  if (ruins.length) {
    try {
      const conserto = await groq(chave, `Reescreva só os trechos com problema destas ideias de roteiro, mantendo tema, formato, tipo, funil e propósito. Problemas: ${ruins.map((r: any) => `ideia ${r.i + 1}: ${r.p.join("; ")}`).join(" | ")}.
Regras: português falado, primeira pessoa, frases curtas, nada de "não é X, é Y", nada de "foi aí que", "aí eu descobri", "você sabia que", "você já reparou", ganchos batidos ("cansada de", "chega de", "adeus"), nunca travessão.
Ideias: ${JSON.stringify({ ideias: ruins.map((r: any) => saida[r.i]) })}
Responda SOMENTE o JSON {"ideias":[...]} com as ideias corrigidas, na mesma ordem e com os mesmos campos.`, 2600);
      const novas = limpar(conserto);
      ruins.forEach((r: any, k: number) => { if (novas[k] && !problemas(novas[k]).length) saida[r.i] = novas[k]; });
    } catch { /* fica a primeira versão */ }
  }
  return { ideias: saida };
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
    if (corpo.acao === "ideias") return resposta(await ideias(supa, chave, corpo));
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    const msg = String((e as Error).message || "");
    if (msg === "LIMITE") return resposta({ error: "O limite grátis da IA deste minuto acabou. Espere um minutinho e clique de novo.", limite: true }, 429);
    console.error(e);
    return resposta({ error: msg || "Algo deu errado." }, 502);
  }
});
