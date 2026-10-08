// =========================================================
// ASSISTENTE UGC (Edge Function do Supabase)
// Usada pelo Dashboard do aplicativo Gestão UGC:
// - acao "logo": descobre o site oficial de uma marca pelo nome e devolve o ícone/logo dela
// - acao "ideias": cria ideias de conteúdo a partir dos perfis concorrentes que a Mari cadastrou
//   e das referências que ela já transcreveu na aba Roteiros (tabela roteiros)
// Usa o Groq com a chave guardada no Supabase (segredo GROQ_API_KEY), nunca no site.
// Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const semTravessao = (t: unknown) => String(t ?? "").replace(/\s*—\s*/g, ", ").trim();

// ---------- Groq: escolhe sozinho um modelo que ainda existe ----------
// O Groq aposenta modelos de tempos em tempos. Em vez de fixar um nome,
// pergunta a lista de modelos ativos e usa o melhor disponível.
let modelosGroq: { texto: string; audio: string } | null = null;
async function modelos(chave: string) {
  if (modelosGroq) return modelosGroq;
  let ids: string[] = [];
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${chave}` } });
    const j = await r.json();
    ids = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id));
  } catch { /* usa os nomes padrão abaixo */ }
  const preferidos = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct-0905", "moonshotai/kimi-k2-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct", "qwen/qwen3-32b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];
  const texto = preferidos.find((p) => ids.includes(p)) || ids.find((id) => !/whisper|guard|tts|playai|orpheus|compound|prompt|distil/i.test(id)) || "openai/gpt-oss-120b";
  const audio = ["whisper-large-v3-turbo", "whisper-large-v3"].find((p) => ids.includes(p)) || ids.find((id) => /whisper/i.test(id)) || "whisper-large-v3-turbo";
  console.log("Modelos do Groq em uso:", texto, audio);
  if (ids.length) modelosGroq = { texto, audio };
  return { texto, audio };
}
// conversa com o Groq e devolve o texto da resposta (tenta de novo sem o modo JSON se o modelo não aceitar)
async function conversarGroq(chave: string, mensagens: unknown[], opcoes: { json?: boolean; temperatura?: number; max?: number } = {}) {
  const { texto: modelo } = await modelos(chave);
  const pedir = async (comJson: boolean) => fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelo, temperature: opcoes.temperatura ?? 0.2, ...(opcoes.max ? { max_tokens: opcoes.max } : {}), ...(comJson ? { response_format: { type: "json_object" } } : {}), messages: mensagens }),
  });
  let r = await pedir(!!opcoes.json);
  let j = await r.json().catch(() => ({}));
  if (!r.ok && opcoes.json) { r = await pedir(false); j = await r.json().catch(() => ({})); }
  if (!r.ok) { if (r.status === 404 || /model/i.test(j?.error?.message || "")) modelosGroq = null; throw new Error(j?.error?.message || "Groq respondeu " + r.status); }
  return String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; } };

async function perguntarGroq(chave: string, pedido: string, temperatura = 0) {
  return lerJson(await conversarGroq(chave, [{ role: "user", content: pedido }], { json: true, temperatura }));
}

async function abrir(url: string, ms = 7000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { headers: { "User-Agent": NAVEGADOR, "Accept-Language": "pt-BR,pt;q=0.9" }, redirect: "follow", signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

// ---------- logo da marca ----------
async function logoDaMarca(chave: string, marca: string) {
  const r = await perguntarGroq(chave, `Qual é o domínio do site oficial da marca ou empresa "${marca}"? Considere marcas do Brasil primeiro.
Responda SOMENTE um JSON assim: {"dominio": "exemplo.com.br"}. Se não souber com segurança, responda {"dominio": null}.`);
  const dominio = String(r.dominio || "").toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").trim();
  if (!dominio || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dominio)) return { dominio: null, logo: null };
  // confere se o site existe e procura o ícone grande (apple-touch-icon) da página
  let logo: string | null = null;
  try {
    const pag = await abrir(`https://${dominio}`);
    const base = pag.url || `https://${dominio}`;
    const html = (await pag.text()).slice(0, 300000);
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
    const achar = (re: RegExp) => links.find((l) => re.test(l));
    const tag = achar(/rel=["'][^"']*apple-touch-icon/i) || achar(/rel=["'][^"']*icon[^"']*["'][^>]*sizes=["'](1[2-9]\d|[2-9]\d\d)/i);
    const href = tag?.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) logo = new URL(href.replace(/&amp;/g, "&"), base).toString();
  } catch {
    // o site pode bloquear robôs; o ícone do Google ainda funciona
  }
  return { dominio, logo: logo || `https://www.google.com/s2/favicons?domain=${dominio}&sz=128` };
}

// ---------- ideias de conteúdo ----------
async function ideias(chave: string, supa: any, corpo: any) {
  const concorrentes = (Array.isArray(corpo.concorrentes) ? corpo.concorrentes : []).slice(0, 15)
    .map((c: any) => `${c.rede === "tiktok" ? "TikTok" : "Instagram"} @${String(c.usuario || "").replace(/^@/, "")}`).join(", ");
  const nichos = (Array.isArray(corpo.nichos) ? corpo.nichos : []).slice(0, 10).join(", ");
  const { data: refs } = await supa.from("roteiros")
    .select("titulo, perfil, origem, link, gancho, desenvolvimento, cta, por_que, etiquetas")
    .eq("de_quem", "outra").eq("exemplo", false).order("criado_em", { ascending: false }).limit(15);
  const referencias = (refs || []).map((r: any, i: number) =>
    `${i + 1}. @${r.perfil || "?"} (${r.origem || ""}) ${r.titulo || ""}. Gancho: "${r.gancho || ""}". Estrutura: ${String(r.desenvolvimento || "").replace(/\n/g, " / ")}. CTA: "${r.cta || ""}". Por que funciona: ${r.por_que || ""}. Link: ${r.link || ""}`).join("\n");
  const pedido = `Você ajuda uma criadora de conteúdo UGC brasileira a ter ideias de vídeos curtos (Reels e TikTok) que mostram para marcas que ela sabe vender produtos.
Perfis que ela acompanha (concorrentes): ${concorrentes || "nenhum cadastrado"}.
Nichos em que ela trabalha: ${nichos || "beleza, casa, maternidade"}.
Vídeos de referência que ela já salvou e transcreveu:
${referencias || "nenhum ainda"}

Crie 6 ideias de vídeo que ela pode reproduzir com o jeito dela, inspiradas no estilo desses perfis e referências (sem copiar).
Responda SOMENTE um JSON: {"ideias":[{"titulo":"até 4 palavras","descricao":"1 frase curta","gancho":"frase de abertura","formato":"ex.: Reels 30s","passos":["passo 1","passo 2","passo 3"],"inspirado_em":"@perfil de onde veio a inspiração ou vazio","link":"link da referência usada ou vazio"}]}
Regras: português do Brasil, frases simples, nunca use travessão (—), não invente links (use só os links das referências acima).`;
  const r = await perguntarGroq(chave, pedido, 0.8);
  const linksValidos = new Set((refs || []).map((x: any) => x.link).filter(Boolean));
  const lista = (Array.isArray(r.ideias) ? r.ideias : []).slice(0, 6).map((x: any) => ({
    titulo: semTravessao(x.titulo).slice(0, 40),
    descricao: semTravessao(x.descricao).slice(0, 140),
    gancho: semTravessao(x.gancho),
    formato: semTravessao(x.formato),
    passos: (Array.isArray(x.passos) ? x.passos : []).map(semTravessao).filter(Boolean).slice(0, 5),
    inspirado_em: semTravessao(x.inspirado_em).slice(0, 40),
    link: linksValidos.has(x.link) ? x.link : "",
  })).filter((x: any) => x.titulo);
  return { ideias: lista, referencias: (refs || []).length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user || user.email !== EMAIL_DONA) return resposta({ erro: "Não autorizado" }, 401);
    const chave = Deno.env.get("GROQ_API_KEY") || "";
    if (!chave) return resposta({ erro: "Falta a chave do Groq no Supabase (GROQ_API_KEY)." }, 500);
    const corpo = await req.json().catch(() => ({}));
    if (corpo.acao === "logo") {
      const marca = String(corpo.marca || "").trim().slice(0, 80);
      if (!marca) return resposta({ erro: "Falta o nome da marca." }, 400);
      return resposta(await logoDaMarca(chave, marca));
    }
    if (corpo.acao === "ideias") return resposta(await ideias(chave, supa, corpo));
    return resposta({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ erro: "Algo deu errado. Tente de novo." }, 500);
  }
});
