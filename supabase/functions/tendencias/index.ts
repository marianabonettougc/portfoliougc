// =========================================================
// TENDÊNCIAS (Edge Function do Supabase) · Redes sociais > Tendências (js/metricas.js)
// Lê posts PÚBLICOS das hashtags que a Mari acompanha (Apify instagram-hashtag-scraper,
// sem login nenhum dela) e a IA (Groq) junta em tópicos em alta para o nicho dela.
// Tudo fica em configuracoes chave "redes_tendencias" (texto JSON):
//   {hashtags:[{tag, ativo}], run:{id, em}|null, buscadoEm, posts:[...], topicos:[...], analisadoEm, erro}
// Ações: { acao:"buscar" } inicia o run · { acao:"recolher" } guarda o que terminou
//        { acao:"analisar" } monta os tópicos · { acao:"hashtags", hashtags:[...] } salva a lista
// Segredos: APIFY_TOKEN e GROQ_API_KEY. Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const APIFY = "https://api.apify.com/v2";
const CHAVE = "redes_tendencias";
const POR_TAG = 20;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const txt = (x: unknown, n = 600) => String(x ?? "").replace(/\s*[—–]\s*/g, ", ").trim().slice(0, n);
const num = (x: unknown) => { const n = Number(x); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null; };
const limparTag = (t: unknown) => String(t || "").toLowerCase().replace(/^#/, "").replace(/[^a-z0-9_à-ú]/gi, "").slice(0, 40);
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };

const PADRAO = ["ugcbrasil", "achadinhos", "skincare", "cabelo", "maternidade"];

async function ler(supa: any) {
  const { data } = await supa.from("configuracoes").select("valor").eq("chave", CHAVE).maybeSingle();
  let v: any = {};
  try { v = data?.valor ? JSON.parse(data.valor) : {}; } catch { v = {}; }
  if (!Array.isArray(v.hashtags)) v.hashtags = PADRAO.map((tag) => ({ tag, ativo: true }));
  if (!Array.isArray(v.posts)) v.posts = [];
  if (!Array.isArray(v.topicos)) v.topicos = [];
  return v;
}
async function gravar(supa: any, v: any) {
  const { error } = await supa.from("configuracoes").upsert({ chave: CHAVE, valor: JSON.stringify(v), updated_at: new Date().toISOString() }, { onConflict: "chave" });
  if (error) throw new Error("Não consegui salvar: " + error.message);
}

function linha(x: any, tag: string) {
  const id = x.shortCode || x.id;
  if (!id || !x.url) return null;
  const video = x.type === "Video" || x.productType === "clips";
  return {
    tag, link: x.url, codigo: String(id), perfil: String(x.ownerUsername || "").toLowerCase(), legenda: txt(x.caption, 700),
    capa: x.displayUrl || null, tipo: video ? "Reel" : x.type === "Sidecar" ? "Carrossel" : "Post",
    curtidas: num(x.likesCount), comentarios: num(x.commentsCount), views: num(x.videoPlayCount || x.videoViewCount),
    publicado: x.timestamp || null,
    hashtags: (Array.isArray(x.hashtags) ? x.hashtags : []).slice(0, 12).map((h: unknown) => limparTag(h)).filter(Boolean),
  };
}

async function buscar(supa: any, token: string) {
  const v = await ler(supa);
  const tags = v.hashtags.filter((h: any) => h.ativo).map((h: any) => h.tag).slice(0, 8);
  if (!tags.length) throw new Error("Ligue pelo menos uma hashtag.");
  const corpo = { hashtags: tags, resultsType: "posts", resultsLimit: POR_TAG, onlyPostsNewerThan: "30 days" };
  const r = await fetch(`${APIFY}/acts/apify~instagram-hashtag-scraper/runs?token=${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 402) throw new Error("Os créditos do Apify deste mês acabaram.");
  if (!r.ok || !j?.data?.id) throw new Error("O Apify não começou a busca agora. Tente de novo daqui a pouco.");
  v.run = { id: j.data.id, em: new Date().toISOString(), tags };
  v.erro = "";
  await gravar(supa, v);
  return { iniciado: true, tags };
}

async function recolher(supa: any, token: string) {
  const v = await ler(supa);
  if (!v.run?.id) return { pronto: true, total: v.posts.length };
  const st = (await (await fetch(`${APIFY}/actor-runs/${v.run.id}?token=${token}`)).json().catch(() => ({})))?.data?.status;
  if (st === "RUNNING" || st === "READY") return { pronto: false };
  if (st !== "SUCCEEDED") { v.run = null; v.erro = "A busca no Apify não terminou bem (" + (st || "sem resposta") + ")."; await gravar(supa, v); return { pronto: true, erro: v.erro }; }
  const itens = await (await fetch(`${APIFY}/actor-runs/${v.run.id}/dataset/items?token=${token}&clean=true`)).json().catch(() => []);
  const tags: string[] = v.run.tags || [];
  const lista: any[] = [];
  const vistos = new Set<string>();
  for (const x of Array.isArray(itens) ? itens : []) {
    const hs = (Array.isArray(x.hashtags) ? x.hashtags : []).map((h: unknown) => limparTag(h));
    const legenda = String(x.caption || "").toLowerCase();
    const tag = limparTag(x.inputUrl?.split("/tags/")[1]) || tags.find((t) => hs.includes(t) || legenda.includes("#" + t)) || tags[0] || "";
    const l = linha(x, tag);
    if (!l || vistos.has(l.codigo)) continue;
    vistos.add(l.codigo);
    lista.push(l);
  }
  const forca = (p: any) => (p.views || 0) + (p.curtidas || 0) * 20 + (p.comentarios || 0) * 60;
  lista.sort((a, b) => forca(b) - forca(a));
  v.posts = lista.slice(0, 60);
  v.buscadoEm = new Date().toISOString();
  v.run = null;
  v.erro = lista.length ? "" : "O Apify não devolveu posts dessas hashtags agora.";
  await gravar(supa, v);
  return { pronto: true, total: v.posts.length };
}

let modelo = "";
async function modeloTexto(chave: string) {
  if (modelo) return modelo;
  try {
    const j = await (await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${chave}` } })).json();
    const ids = (j.data || []).map((m: any) => String(m.id));
    modelo = ["openai/gpt-oss-120b", "qwen/qwen3-32b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"].find((p) => ids.includes(p)) || "openai/gpt-oss-120b";
  } catch { modelo = "openai/gpt-oss-120b"; }
  return modelo;
}

async function analisar(supa: any, chave: string) {
  const v = await ler(supa);
  if (!v.posts.length) throw new Error("Busque as hashtags primeiro.");
  const { data: perfil } = await supa.from("configuracoes").select("valor").eq("chave", "perfil_conteudo").maybeSingle();
  let pilares = "";
  try { pilares = (JSON.parse(perfil?.valor || "{}").pilares || []).map((p: any) => p.nome).join(", "); } catch { /* sem perfil */ }
  const { data: meus } = await supa.from("painel_conteudo").select("tema,formato,status,data").order("data", { ascending: false }).limit(40);
  const minhas = (meus || []).map((m: any) => `${m.tema} (${m.formato}, ${m.status})`).join("; ").slice(0, 2500);
  const posts = v.posts.slice(0, 30).map((p: any, i: number) =>
    `${i + 1}. #${p.tag} · ${p.tipo} · ${p.views ? p.views + " views" : ""} ${p.curtidas ?? "?"} curtidas · ${p.comentarios ?? "?"} coment. · "${txt(p.legenda, 220).replace(/\n/g, " ")}"`).join("\n");
  const pedido = `Você ajuda uma criadora brasileira de UGC (@maribonettougc) a ver o que está em alta no nicho dela no Instagram.
Pilares dela: ${pilares || "beleza e cabelo, autocuidado, maternidade (filhas já crianças), moda, bem-estar, achadinhos de casa e tech"}.
Conteúdos que ela já tem ou planejou: ${minhas || "nenhum"}.

POSTS PÚBLICOS DAS HASHTAGS QUE ELA ACOMPANHA (últimos 30 dias, mais fortes primeiro):
${posts}

Junte esses posts em 4 a 6 tópicos em alta. Responda SOMENTE um JSON:
{"topicos":[{"titulo":"tema curto","calor":"Em alta" ou "Subindo","hashtag":"a hashtag principal sem #","resumo":"2 frases: o que está acontecendo, citando o que os posts mostram","provas":[números dos posts da lista que sustentam o tópico],"encaixe":"1 frase: como isso conversa com o que ela já tem ou com um pilar dela","gancho":"um gancho em primeira pessoa, do jeito dela falar para a câmera","acao":"Aproveitar agora" ou "Fazer uma série" ou "Ficar de olho"}]}
Regras: português do Brasil, frases curtas e concretas, nada genérico. Nunca invente números (use só os da lista). Nunca use travessão. Gancho sem esquete, sem "você sabia que", "cansada de", "chega de", "não é X, é Y", "aí eu descobri", "foi aí que", sem gírias.`;
  const m = await modeloTexto(chave);
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: m, temperature: 0.4, max_tokens: 2600, response_format: { type: "json_object" }, ...(/gpt-oss/.test(m) ? { reasoning_effort: "low" } : {}), messages: [{ role: "user", content: pedido }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "O limite grátis da IA deste minuto acabou. Espere 1 minuto e tente de novo." : "A IA não respondeu agora. Tente de novo.");
  const a = lerJson(String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, ""));
  const topicos = (Array.isArray(a.topicos) ? a.topicos : []).slice(0, 6).map((t: any, i: number) => ({
    id: Date.now().toString(36) + i,
    titulo: txt(t.titulo, 80), calor: t.calor === "Subindo" ? "Subindo" : "Em alta", hashtag: limparTag(t.hashtag),
    resumo: txt(t.resumo, 400), encaixe: txt(t.encaixe, 260), gancho: txt(t.gancho, 200),
    acao: ["Aproveitar agora", "Fazer uma série", "Ficar de olho"].includes(t.acao) ? t.acao : "Aproveitar agora",
    provas: (Array.isArray(t.provas) ? t.provas : []).map((n: unknown) => Number(n) - 1).filter((n: number) => n >= 0 && n < v.posts.length).slice(0, 4).map((n: number) => v.posts[n].codigo),
  })).filter((t: any) => t.titulo);
  if (!topicos.length) throw new Error("A IA não montou os tópicos. Tente de novo.");
  v.topicos = topicos;
  v.analisadoEm = new Date().toISOString();
  await gravar(supa, v);
  return { topicos };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user || user.email !== EMAIL_DONA) return resposta({ error: "Não autorizado" }, 401);
    const corpo = await req.json().catch(() => ({}));
    const token = Deno.env.get("APIFY_TOKEN") || "";
    if (corpo.acao === "hashtags") {
      const v = await ler(supa);
      const vistos = new Set<string>();
      v.hashtags = (Array.isArray(corpo.hashtags) ? corpo.hashtags : []).map((h: any) => ({ tag: limparTag(h.tag), ativo: h.ativo !== false }))
        .filter((h: any) => h.tag && !vistos.has(h.tag) && vistos.add(h.tag)).slice(0, 12);
      await gravar(supa, v);
      return resposta({ hashtags: v.hashtags });
    }
    if (corpo.acao === "buscar" || corpo.acao === "recolher") {
      if (!token) return resposta({ error: "Falta o APIFY_TOKEN no Supabase." }, 500);
      return resposta(corpo.acao === "buscar" ? await buscar(supa, token) : await recolher(supa, token));
    }
    if (corpo.acao === "analisar") {
      const chave = Deno.env.get("GROQ_API_KEY") || "";
      if (!chave) return resposta({ error: "Falta a chave do Groq no Supabase (GROQ_API_KEY)." }, 500);
      return resposta(await analisar(supa, chave));
    }
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ error: String((e as Error).message || "Algo deu errado.") }, 502);
  }
});
