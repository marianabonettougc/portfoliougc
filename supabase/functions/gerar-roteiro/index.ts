// =========================================================
// GERAR ROTEIRO (Edge Function do Supabase)
// Usada pelo aplicativo Gestão UGC (admin/gestao) no botão "Gerar roteiro com IA".
// Usa o Groq com a chave guardada no Supabase (segredo GROQ_API_KEY), nunca no site.
// Só a dona do painel pode usar.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user || user.email !== EMAIL_DONA) return resposta({ error: "Não autorizado" }, 401);

    const { prompt } = await req.json().catch(() => ({}));
    if (!prompt) return resposta({ error: "Prompt ausente" }, 400);
    const chave = Deno.env.get("GROQ_API_KEY") || "";
    if (!chave) return resposta({ error: "Falta a chave do Groq no Supabase (GROQ_API_KEY)." }, 500);

    let texto = "";
    try {
      texto = (await conversarGroq(chave, [
        { role: "system", content: "Você escreve roteiros de vídeos curtos para uma criadora de conteúdo UGC, em português do Brasil. Nunca use travessão (—)." },
        { role: "user", content: String(prompt).slice(0, 8000) },
      ], { temperatura: 0.7, max: 4000 })).replace(/\s*—\s*/g, ", ");
    } catch (e) {
      return resposta({ error: String((e as Error).message || "Falha no Groq") }, 502);
    }
    return resposta({ texto: texto || "Não foi possível gerar o roteiro. Tente novamente." });
  } catch (e) {
    console.error(e);
    return resposta({ error: "Algo deu errado ao gerar o roteiro." }, 500);
  }
});
