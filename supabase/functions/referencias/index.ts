// =========================================================
// REFERÊNCIAS (Edge Function do Supabase)
// Usada pela Central de Referências (aba Roteiros do painel):
// - { acao: "analise", referencia }: panorama, por que chama atenção, pontos fortes, desenvolvimento
//   do vídeo com os tempos e o que dá para melhorar
// - { acao: "ideias", referencia, produto, objetivo, nicho, formato, tom, material }: ideias de vídeos
//   novos da Mari usando o que funcionou na referência, mais ganchos alternativos
// Usa o Groq (segredo GROQ_API_KEY) e o resumo do método da skill roteiro-ugc (tabela estilo_ugc).
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
const semTravessao = (t: unknown) => String(t ?? "").replace(/\s*[—–]\s*/g, ", ").trim();
// ganchos batidos e construções proibidas pelo método da skill (mesma lista da gerar-roteiro)
const BATIDO = /^\s*(voc[eê] j[aá] |voc[eê] sabia|sabia que|cansad[ao] de|descobri|chega de|quer saber como|\d+ passos simples|se (o )?seu .* pare tudo|adeus)/i;
const PROIBIDA = /a[ií] eu (descobri|conheci)|at[eé] (que )?(eu )?descobri|foi a[ií] que|isso muda (tudo|o jogo)|n[aã]o [eé] (s[oó] |sobre )[^.!?]{0,60}, [eé] |ningu[eé]m (te )?conta/i;
const PRAZO = /\b\d+ (dias?|semanas?|minutos?|meses)\b|\b(uma|duas|tr[eê]s) semanas?\b/i;
const ruim = (t: string) => BATIDO.test(t) || PROIBIDA.test(t);
const txt = (x: unknown, n = 800) => semTravessao(x).slice(0, n);
const lista = (v: unknown, n = 8, t = 300) => (Array.isArray(v) ? v : []).map((x) => txt(x, t)).filter(Boolean).slice(0, n);
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// escolhe um modelo de texto que ainda existe no Groq
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
async function perguntar(chave: string, pedido: string, max = 3500) {
  const m = await modeloTexto(chave);
  const pedir = () => fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: m, temperature: 0.5, max_tokens: max, response_format: { type: "json_object" }, ...(/gpt-oss/.test(m) ? { reasoning_effort: "low" } : {}), messages: [{ role: "user", content: pedido }] }),
  });
  let r = await pedir(); let j = await r.json().catch(() => ({}));
  const espera = r.status === 429 ? Number(String(j?.error?.message || "").match(/try again in ([\d.]+)s/)?.[1] || 0) : 0;
  if (espera && espera <= 20) { await esperar(espera * 1000 + 300); r = await pedir(); j = await r.json().catch(() => ({})); }
  if (!r.ok) throw new Error(r.status === 429 ? "O limite grátis da IA deste minuto acabou. Espere um pouquinho e tente de novo." : "A IA não respondeu agora. Tente de novo.");
  return lerJson(String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, ""));
}
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`;
// transcrição com os tempos (quando a transcrição tem), para a IA dividir o vídeo em partes
function transcricaoComTempo(ref: any) {
  const segs = Array.isArray(ref.segmentos) ? ref.segmentos : [];
  if (segs.length) return segs.map((s: any) => `[${mmss(Number(s.ini) || 0)}] ${txt(s.texto, 400)}`).join("\n").slice(0, 6000);
  return txt(ref.transcricao, 6000);
}

async function analise(chave: string, ref: any) {
  const temTempo = Array.isArray(ref.segmentos) && ref.segmentos.length;
  const pedido = `Você analisa vídeos curtos de UGC (Reels, TikTok) para uma criadora brasileira que é contratada por marcas.
Analise o vídeo de referência abaixo e responda SOMENTE um JSON:
{"panorama":"2 frases: o que a criadora faz no vídeo e qual a abordagem",
"motivos":["por que esse vídeo chama atenção, 3 a 5 itens curtos"],
"pontos_fortes":["o que ele faz bem, 3 a 6 itens curtos"],
"desenvolvimento":[{"ini":"00:00","fim":"00:03","parte":"Hook | Contexto | Desenvolvimento | Prova | CTA","texto":"o que acontece nesse trecho, 1 frase"}],
"melhorar":["o que daria para fazer melhor na versão dela, 2 a 3 itens"]}
Regras: português do Brasil, frases curtas e concretas, tiradas do vídeo (nada genérico que serviria para qualquer vídeo). ${temTempo ? "Use os tempos da transcrição para o desenvolvimento." : "A transcrição não tem tempos: estime os tempos pela ordem das falas (uns 2,75 palavras por segundo)."} Nunca use travessão (—).

${ref.duracao ? `Duração do vídeo: ${ref.duracao} segundos.` : ""}
${ref.titulo ? `Título: ${txt(ref.titulo, 120)}` : ""}
Transcrição:
${transcricaoComTempo(ref)}`;
  const j = await perguntar(chave, pedido, 3000);
  return {
    panorama: txt(j.panorama, 600), motivos: lista(j.motivos, 6), pontos_fortes: lista(j.pontos_fortes, 7), melhorar: lista(j.melhorar, 4),
    desenvolvimento: (Array.isArray(j.desenvolvimento) ? j.desenvolvimento : []).slice(0, 10).map((d: any) => ({ ini: txt(d.ini, 8), fim: txt(d.fim, 8), parte: txt(d.parte, 30), texto: txt(d.texto, 300) })).filter((d: any) => d.texto),
    feitaEm: new Date().toISOString(),
  };
}

// imagens que ela anexou (produto, briefing): o modelo que enxerga descreve o que aparece
async function descreverImagens(chave: string, imagens: unknown) {
  const validas = (Array.isArray(imagens) ? imagens : []).map(String).filter((i) => /^data:image\/(png|jpe?g|webp);base64,/.test(i) && i.length < 3_500_000).slice(0, 4);
  if (!validas.length) return "";
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen/qwen3.8-27b", temperature: 0.2, max_tokens: 700, messages: [{ role: "user", content: [
        { type: "text", text: "Descreva em português, em tópicos curtos, o que aparece nestas imagens para uma criadora de UGC: produto, marca, embalagem, textos escritos e ambiente." },
        ...validas.map((url) => ({ type: "image_url", image_url: { url } })),
      ] }] }),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim().slice(0, 1200) : "";
  } catch { return ""; }
}

async function ideias(chave: string, c: any, supa: any) {
  const ref = c.referencia || {};
  const imagens = await descreverImagens(chave, c.imagens);
  let metodo = "";
  try { const { data } = await supa.from("estilo_ugc").select("metodo").eq("id", 1).maybeSingle(); metodo = String(data?.metodo || "").slice(0, 1600); } catch { /* sem método */ }
  const pedido = `Você cria ideias de vídeos UGC para uma criadora brasileira que é contratada por marcas.
Use o vídeo de referência como base: o que fez ele funcionar (formato, ordem dos blocos, tipo de gancho, ritmo) aplicado ao produto ou tema dela. Nada de ideias genéricas: cada ideia precisa dizer o que acontece no vídeo dela.

VÍDEO DE REFERÊNCIA
${ref.gancho ? `Gancho: "${txt(ref.gancho, 300)}"` : ""}
${ref.analise?.panorama ? `Panorama: ${txt(ref.analise.panorama, 400)}` : ""}
Transcrição: ${txt(ref.transcricao, 2200)}

O QUE ELA QUER
Produto ou tema: ${txt(c.produto, 400) || "não informou (sugira com base no nicho)"}
Objetivo do conteúdo: ${txt(c.objetivo, 80) || "escolha o melhor"}
Nicho: ${txt(c.nicho, 60) || "o mesmo da referência"}
Formato: ${txt(c.formato, 60) || "escolha o melhor"}
Tom de voz: ${txt(c.tom, 60) || "conversacional"}
${c.material ? "Material de apoio que ela mandou:\n" + txt(c.material, 2000) : ""}
${imagens ? "O que aparece nas imagens que ela mandou:\n" + imagens : ""}
${metodo ? "\n" + metodo : ""}

Responda SOMENTE um JSON:
{"ideias":[{"titulo":"até 6 palavras","descricao":"1 frase: o que acontece no vídeo e o que mantém da referência","gancho":"a primeira frase do vídeo, pronta para falar","formato":"ex.: Review / Opinião"}],
"ganchos":["5 outras formas de começar o vídeo, prontas para falar"]}
Crie 5 ideias diferentes entre si. Português do Brasil. Nunca invente resultado, prazo (dias, semanas, minutos), número ou preço que ela não contou. Ganchos proibidos: começar com "Você já...", "Você sabia...", "Sabia que...", "Descobri...", "Cansada de...", "Chega de...", "Se o seu... pare tudo", "Ninguém te conta"; nada de "até que descobri" ou "isso muda tudo". Todo gancho tem um detalhe concreto do produto ou da situação dela. Nunca use travessão.`;
  const j = await perguntar(chave, pedido, 3000);
  return {
    // gancho batido ou com prazo inventado sai (a ideia fica, sem o gancho sugerido)
    ideias: (Array.isArray(j.ideias) ? j.ideias : []).slice(0, 6).map((i: any) => { const g = txt(i.gancho, 300); return { titulo: txt(i.titulo, 70), descricao: txt(i.descricao, 300), gancho: ruim(g) || PRAZO.test(g) ? "" : g, formato: txt(i.formato, 60) }; }).filter((i: any) => i.titulo),
    ganchos: lista(j.ganchos, 8).filter((g) => !ruim(g) && !PRAZO.test(g)).slice(0, 6),
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
    const corpo = await req.json().catch(() => ({}));
    const ref = corpo.referencia || {};
    if (!ref.transcricao && !(Array.isArray(ref.segmentos) && ref.segmentos.length)) return resposta({ error: "Essa referência ainda não tem transcrição." }, 400);
    if (corpo.acao === "analise") return resposta(await analise(chave, ref));
    if (corpo.acao === "ideias") return resposta(await ideias(chave, corpo, supa));
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ error: String((e as Error).message || "Algo deu errado.") }, 502);
  }
});
