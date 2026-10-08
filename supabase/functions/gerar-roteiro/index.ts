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

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 1000,
        messages: [
          { role: "system", content: "Você escreve roteiros de vídeos curtos para uma criadora de conteúdo UGC, em português do Brasil. Nunca use travessão (—)." },
          { role: "user", content: String(prompt).slice(0, 8000) },
        ],
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return resposta({ error: j?.error?.message || "Falha no Groq" }, 502);
    const texto = String(j.choices?.[0]?.message?.content || "").replace(/\s*—\s*/g, ", ").trim();
    return resposta({ texto: texto || "Não foi possível gerar o roteiro. Tente novamente." });
  } catch (e) {
    console.error(e);
    return resposta({ error: "Algo deu errado ao gerar o roteiro." }, 500);
  }
});
