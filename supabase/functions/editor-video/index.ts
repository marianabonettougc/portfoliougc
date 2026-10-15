// =========================================================
// EDITOR DE VÍDEO (Edge Function do Supabase)
// Criatividade > Edição de vídeos (js/edicao.js).
// - FormData { acao: "transcrever", arquivo }: áudio (wav 16 kHz feito no navegador,
//   até 25 MB) transcrito pelo Whisper do Groq com o tempo de cada palavra.
// - JSON { acao: "plano", palavras, duracao, padrao, tema }: a IA lê a fala com os
//   tempos e o padrão de edição da Mari e devolve o plano: título do gancho,
//   trechos para tirar (repetição, erro, gaguejo), palavras de destaque, zooms,
//   efeitos sonoros, ideias de b-roll e dicas.
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
const txt = (x: unknown, n = 300) => String(x ?? "").replace(/\s*[—–]\s*/g, ", ").trim().slice(0, n);
const num = (x: unknown) => { const n = Number(x); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };
const EFEITOS = ["woosh", "pop", "click", "shutter", "typing", "riser", "hit", "ding"];

async function transcrever(chave: string, arquivo: File) {
  if (arquivo.size > 25 * 1024 * 1024) throw new Error("Esse trecho de áudio passou de 25 MB.");
  const f = new FormData();
  f.append("model", "whisper-large-v3-turbo");
  f.append("response_format", "verbose_json");
  f.append("language", "pt");
  f.append("timestamp_granularities[]", "word");
  f.append("timestamp_granularities[]", "segment");
  f.append("file", arquivo, "audio.wav");
  const r = await fetch(`${GROQ}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: f });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "O limite grátis do Groq acabou por agora. Espere um pouco e tente de novo." : "O Whisper não conseguiu transcrever: " + (j?.error?.message || r.status));
  const palavras = (Array.isArray(j.words) ? j.words : []).map((w: any) => ({ w: String(w.word || "").trim(), s: num(w.start) ?? 0, e: num(w.end) ?? 0 })).filter((w: any) => w.w);
  return { texto: String(j.text || "").trim(), palavras, duracao: num(j.duration) };
}

async function plano(chave: string, c: any) {
  const palavras = (Array.isArray(c.palavras) ? c.palavras : []).slice(0, 4000);
  if (!palavras.length) throw new Error("Não tem fala nesse vídeo para eu planejar a edição.");
  const fala = palavras.map((p: any) => `[${Number(p.s).toFixed(1)}] ${p.w}`).join(" ");
  const pedido = `Você é videomaker e editor de Reels de uma criadora brasileira de UGC. Planeje a edição do vídeo bruto abaixo seguindo o PADRÃO DE EDIÇÃO dela.

PADRÃO DE EDIÇÃO:
${txt(c.padrao, 6000)}

${c.tema ? "TEMA / MARCA: " + txt(c.tema, 300) + "\n" : ""}DURAÇÃO DO BRUTO: ${num(c.duracao) ?? "?"} s
FALA (cada palavra com o segundo em que começa, no tempo do vídeo bruto):
${fala}

Responda SOMENTE um JSON:
{"titulo":"título do gancho para os 3 primeiros segundos, até 6 palavras, sem emoji",
"remover":[{"de":0.0,"ate":0.0,"motivo":"repetição | erro | gaguejo | fala de bastidor"}],
"destaques":[{"t":0.0,"palavra":"palavra forte que merece cor de destaque"}],
"zooms":[{"t":0.0}],
"efeitos":[{"t":0.0,"tipo":"woosh | pop | click | shutter | typing | riser | hit | ding","por_que":"curto"}],
"broll":[{"t":0.0,"ideia":"o que gravar de apoio para cobrir esse trecho, 1 frase"}],
"musica":"clima de música sugerido, 1 frase",
"dicas":["até 4 dicas curtas e concretas para esse vídeo"]}

Regras:
- "remover": quando ela repete uma frase (tomada errada), fique com a ÚLTIMA versão e marque as anteriores para tirar. Tire também "vamos de novo", "peraí", gaguejos e falas que não são do roteiro. Use os tempos da fala. Não marque silêncios (o painel já corta).
- "destaques": 1 a cada 4 ou 5 segundos, só palavras que carregam a ideia (benefício, número, nome do produto).
- "zooms": 1 a cada 5 a 8 segundos, em frases de ênfase.
- "efeitos": riser logo antes do gancho/revelação, hit logo depois da revelação, pop quando entra texto ou título (inclua um pop em 0.1 para o título), woosh nas mudanças de assunto, click/shutter em listas e cortes rápidos, typing quando ela fala de algo escrito. Exagere um pouco no começo e depois use com moderação (no máximo 1 a cada 3 segundos).
- Todos os tempos em segundos do bruto, com 1 casa decimal.
- Português do Brasil. Nunca use travessão.`;
  const r = await fetch(`${GROQ}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-oss-120b", temperature: 0.3, max_tokens: 4000, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "user", content: pedido }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "O limite grátis da IA deste minuto acabou. Espere um pouquinho e tente de novo." : "A IA não respondeu agora. Tente de novo.");
  const a = lerJson(String(j.choices?.[0]?.message?.content || ""));
  const lista = (x: unknown) => (Array.isArray(x) ? x : []);
  return {
    titulo: txt(a.titulo, 60),
    remover: lista(a.remover).map((x: any) => ({ de: num(x.de), ate: num(x.ate), motivo: txt(x.motivo, 60) })).filter((x: any) => x.de != null && x.ate != null && x.ate > x.de),
    destaques: lista(a.destaques).map((x: any) => ({ t: num(x.t), palavra: txt(x.palavra, 40) })).filter((x: any) => x.t != null),
    zooms: lista(a.zooms).map((x: any) => ({ t: num(x.t) })).filter((x: any) => x.t != null),
    efeitos: lista(a.efeitos).map((x: any) => ({ t: num(x.t), tipo: String(x.tipo || "").toLowerCase().trim(), por_que: txt(x.por_que, 80) })).filter((x: any) => x.t != null && EFEITOS.includes(x.tipo)),
    broll: lista(a.broll).map((x: any) => ({ t: num(x.t), ideia: txt(x.ideia, 200) })).filter((x: any) => x.ideia),
    musica: txt(a.musica, 200),
    dicas: lista(a.dicas).map((x: any) => txt(x, 200)).filter(Boolean).slice(0, 4),
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
    if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
      const form = await req.formData();
      const arq = form.get("arquivo");
      if (!(arq instanceof File)) return resposta({ error: "Faltou o áudio." }, 400);
      return resposta(await transcrever(chave, arq));
    }
    const corpo = await req.json().catch(() => ({}));
    if (corpo.acao === "plano") return resposta(await plano(chave, corpo));
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ error: String((e as Error).message || "Algo deu errado.") }, 502);
  }
});
