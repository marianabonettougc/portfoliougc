// =========================================================
// LER BRIEFING (Edge Function do Supabase), nov/2026, pedido da Mari
// Ela anexa o briefing do cliente (PDF, imagem ou texto) na hora de criar ou
// revisar um roteiro com a Skill UGC. O navegador tira o texto do PDF (pdf.js);
// PDF escaneado e imagem chegam aqui como imagens e o modelo de visão do Groq
// transcreve o texto de cada página. Depois o modelo de texto separa os campos
// que a Skill usa (marca, produto, objetivo, público, formato, duração, falas
// obrigatórias, proibições, menções) sem inventar nada.
// Corpo JSON: { texto?: string, imagens?: dataURL[] (até 6), nome?: string }
// Devolve: { texto, campos, paginas, cortado }
// Chave do Groq só no segredo GROQ_API_KEY. Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class Limite extends Error {}
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const semTravessao = (t: unknown) => String(t ?? "").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").trim();
const txt = (x: unknown, n = 800) => semTravessao(x).slice(0, n);
const lista = (x: unknown, n = 15, tam = 300) => (Array.isArray(x) ? x : x ? [x] : []).map((i) => txt(typeof i === "string" ? i : (i?.texto || i?.item || ""), tam)).filter(Boolean).slice(0, n);
const FORMATOS = ["Reels", "TikTok", "Stories", "Carrossel", "Anúncio (ads)", "YouTube Shorts"];

let modelosGroq: { texto: string; visao: string } | null = null;
async function modelos(chave: string) {
  if (modelosGroq) return modelosGroq;
  let ids: string[] = [];
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${chave}` } });
    const j = await r.json();
    ids = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id));
  } catch { /* nomes padrão */ }
  const texto = ["openai/gpt-oss-120b", "moonshotai/kimi-k2-instruct-0905", "qwen/qwen3-32b", "openai/gpt-oss-20b"].find((p) => ids.includes(p)) || "openai/gpt-oss-120b";
  const visao = ["qwen/qwen3.8-27b", "meta-llama/llama-4-maverick-17b-128e-instruct", "meta-llama/llama-4-scout-17b-16e-instruct"].find((p) => ids.includes(p)) || ids.find((id) => /qwen3\.[5-9]|vision|llama-4|-vl/i.test(id)) || "qwen/qwen3.8-27b";
  if (ids.length) modelosGroq = { texto, visao };
  return { texto, visao };
}

async function groq(chave: string, corpo: Record<string, unknown>) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (r.status === 429) {
      const s = Number(String(j?.error?.message || "").match(/try again in ([\d.]+)s/)?.[1] || 0);
      if (tentativa < 2 && s && s <= 20) { await esperar(s * 1000 + 300); continue; }
      throw new Limite("groq");
    }
    throw new Error("Groq: " + (j?.error?.message || r.status));
  }
  throw new Limite("groq");
}

// transcreve o texto de uma página (imagem) do briefing
async function lerPagina(chave: string, imagem: string, n: number) {
  const { visao } = await modelos(chave);
  return groq(chave, {
    model: visao, temperature: 0.1, max_tokens: 2200,
    messages: [{ role: "user", content: [
      { type: "text", text: "Esta é a página " + n + " de um briefing de marca para uma creator de UGC. Transcreva TODO o texto que aparece, na ordem de leitura, sem resumir e sem corrigir (copie frases, @, #, links, cupons e números exatamente). Tabelas viram linhas \"coluna: valor\". Se houver foto de produto ou exemplo visual, descreva em uma linha entre colchetes. Não acrescente nada que não está na imagem." },
      { type: "image_url", image_url: { url: imagem } },
    ] }],
  });
}

const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };

async function separarCampos(chave: string, texto: string) {
  const { texto: modelo } = await modelos(chave);
  const pedido = `Abaixo está o briefing de uma marca para um vídeo UGC da creator Mari. Separe as informações em JSON. Regras: copie do briefing, nunca invente; o que não estiver escrito fica "" ou []. Falas obrigatórias são frases que a marca exige que sejam ditas (copie literal). Proibições incluem palavras, promessas, comparações com concorrentes, temas e cuidados de compliance. Menções são @, #, links, cupons e códigos.

JSON:
{"marca":"","produto":"nome do produto e versão","objetivo":"o que a marca quer com o vídeo","publico":"","formato":"um destes se o briefing disser: ${FORMATOS.join(", ")}","duracao":0,"mensagens_chave":["mensagens ou benefícios que precisam aparecer"],"obrigatorias":["falas literais exigidas"],"proibicoes":["o que não pode"],"mencoes":["@, #, links, cupom"],"entregaveis":"quantos vídeos, formatos, versões","prazos":"datas de roteiro, gravação, envio e postagem","tom":"tom de voz pedido","cenas":["cenas, enquadramentos ou demonstrações pedidas"],"resumo":"o briefing em tópicos curtos, só o que importa para escrever o roteiro"}

"duracao" em segundos (número; 0 se não disser). Responda só o JSON.

BRIEFING:
${texto}`;
  const bruto = await groq(chave, { model: modelo, temperature: 0.1, max_tokens: 1800, reasoning_effort: /gpt-oss/.test(modelo) ? "low" : undefined, response_format: { type: "json_object" }, messages: [{ role: "user", content: pedido }] });
  const j = lerJson(bruto);
  const formato = FORMATOS.find((f) => f.toLowerCase() === String(j.formato || "").toLowerCase()) || "";
  const dur = Math.round(Number(j.duracao) || 0);
  return {
    marca: txt(j.marca, 120), produto: txt(j.produto, 300), objetivo: txt(j.objetivo, 400), publico: txt(j.publico, 300), formato,
    duracao: dur >= 5 && dur <= 600 ? dur : 0,
    mensagens_chave: lista(j.mensagens_chave), obrigatorias: lista(j.obrigatorias, 10), proibicoes: lista(j.proibicoes, 20),
    mencoes: lista(j.mencoes, 15, 200), entregaveis: txt(j.entregaveis, 400), prazos: txt(j.prazos, 400), tom: txt(j.tom, 300),
    cenas: lista(j.cenas, 10), resumo: txt(j.resumo, 2500),
  };
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

    const c = await req.json().catch(() => ({}));
    const imagens = (Array.isArray(c.imagens) ? c.imagens : []).map(String).filter((i: string) => /^data:image\/(png|jpe?g|webp);base64,/.test(i) && i.length < 4_000_000).slice(0, 6);
    let texto = String(c.texto || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    const paginas: string[] = [];
    for (let i = 0; i < imagens.length; i++) paginas.push(await lerPagina(chave, imagens[i], i + 1));
    if (paginas.length) texto = [texto, ...paginas.map((p, i) => (paginas.length > 1 ? `[página ${i + 1}]\n` : "") + p)].filter(Boolean).join("\n\n");
    if (texto.replace(/\s/g, "").length < 20) return resposta({ error: "Não achei texto nesse briefing. Confira se o arquivo abre direitinho ou cole o texto." }, 422);
    // limite grátis do Groq: 8000 tokens por minuto, então o modelo lê no máximo uns 15 mil caracteres
    const cortado = texto.length > 15000;
    const campos = await separarCampos(chave, texto.slice(0, 15000));
    return resposta({ texto: semTravessao(texto).slice(0, 30000), campos, paginas: paginas.length, cortado });
  } catch (e) {
    if (e instanceof Limite) return resposta({ error: "O limite grátis da IA (Groq) encheu neste minuto. Espere 1 minuto e tente de novo.", limite: true }, 429);
    console.error(e);
    return resposta({ error: "Não consegui ler o briefing agora. Tente de novo em instantes." }, 502);
  }
});
