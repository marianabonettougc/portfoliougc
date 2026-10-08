// =========================================================
// ASSISTENTE UGC (Edge Function do Supabase)
// Usada pelo Dashboard do aplicativo Gestão UGC:
// - acao "logo": descobre o site oficial de uma marca pelo nome e devolve o ícone/logo dela
// - acao "miniaturas": pega a capa dos vídeos de referência (TikTok, YouTube e, quando dá, Instagram)
// - acao "ideias": cria ideias de conteúdo a partir dos perfis concorrentes que a Mari cadastrou
//   e das referências que ela já transcreveu na aba Roteiros (tabela roteiros)
// - acao "adaptar": analisa um vídeo de referência (por que funcionou: gancho, desenvolvimento e CTA,
//   e como melhorar) e cria a versão da Mari em cima dele
// - acao "resultado": depois que ela posta, analisa as métricas do vídeo dela comparando com a referência
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

// ---------- minha versão de um vídeo de referência ----------
const lista = (x: unknown, n = 6) => (Array.isArray(x) ? x : []).map(semTravessao).filter(Boolean).slice(0, n);
const texto = (x: unknown, n = 600) => semTravessao(x).slice(0, n);
function resumoRef(r: any) {
  return `Perfil: ${r.perfil ? "@" + String(r.perfil).replace(/^@/, "") : "não informado"} (${r.origem || ""})
Título: ${r.titulo || ""}
Gancho: "${r.gancho || ""}" (tipo: ${r.gancho_tipo || "?"})
Desenvolvimento: ${String(r.desenvolvimento || "").replace(/\n/g, " / ")}
CTA: "${r.cta || ""}"
Por que prende (análise anterior): ${r.por_que || ""}
Visualizações da referência: ${r.visualizacoes || "não informado"}
Transcrição: ${String(r.transcricao || "").slice(0, 3500)}`;
}
async function adaptar(chave: string, corpo: any) {
  const r = corpo.referencia || {};
  const nichos = (Array.isArray(corpo.nichos) ? corpo.nichos : []).slice(0, 10).join(", ");
  const pedido = `Você é estrategista de conteúdo de uma criadora UGC brasileira (vídeos curtos para Reels e TikTok).
Ela quer pegar este vídeo de outra criadora como inspiração e fazer o vídeo dela em cima dele, sem copiar.
Nichos em que ela trabalha: ${nichos || "beleza, autocuidado, casa, maternidade"}.

VÍDEO DE REFERÊNCIA
${resumoRef(r)}

Responda SOMENTE um JSON assim:
{"funcionou":{"gancho":"por que o gancho prende (1 a 2 frases)","desenvolvimento":"por que o meio segura a atenção (1 a 2 frases)","cta":"por que o CTA funciona ou falha (1 frase)","geral":"resumo em 1 frase do motivo do vídeo ter dado certo para ela"},
"melhorar":["o que dá para fazer melhor que a referência", "..."],
"minha_versao":{"titulo":"até 5 palavras","ideia":"1 frase explicando o vídeo dela em cima desse","gancho":"frase de abertura pronta para falar","roteiro":["cena ou fala 1","cena 2","cena 3","cena 4"],"cta":"frase final pronta","formato":"ex.: Reels 30s, falando para a câmera","dicas_gravacao":["dica 1","dica 2"]}}
Regras: português do Brasil, frases simples e diretas, nunca use travessão (—), 3 a 4 itens em "melhorar".`;
  const j = await perguntarGroq(chave, pedido, 0.6);
  const f = j.funcionou || {}, v = j.minha_versao || {};
  return {
    funcionou: { gancho: texto(f.gancho), desenvolvimento: texto(f.desenvolvimento), cta: texto(f.cta), geral: texto(f.geral) },
    melhorar: lista(j.melhorar, 5),
    minha_versao: { titulo: texto(v.titulo, 50) || "Minha versão", ideia: texto(v.ideia, 300), gancho: texto(v.gancho, 300), roteiro: lista(v.roteiro, 8),
      cta: texto(v.cta, 300), formato: texto(v.formato, 80), dicas_gravacao: lista(v.dicas_gravacao, 4) },
  };
}
async function resultado(chave: string, corpo: any) {
  const p = corpo.plano || {}, m = p.metricas || {}, v = p.versao || {};
  const pedido = `Você é estrategista de conteúdo de uma criadora UGC brasileira. Ela gravou um vídeo inspirado em um vídeo de outra criadora e já tem as métricas.
Analise o resultado dela, comparando com a referência.

VÍDEO DE REFERÊNCIA (da outra criadora)
${resumoRef(p.referencia || {})}

VÍDEO DELA
Título: ${v.titulo || ""}
Gancho: "${v.gancho || ""}"
Roteiro: ${(v.roteiro || []).join(" / ")}
CTA: "${v.cta || ""}"
O que mudou na hora de gravar (anotação dela): ${p.notas || "nada informado"}

MÉTRICAS DELA (${m.dias || "?"} dias depois de postar)
Visualizações: ${m.visualizacoes || 0}. Curtidas: ${m.curtidas || 0}. Comentários: ${m.comentarios || 0}. Salvamentos: ${m.salvamentos || 0}. Compartilhamentos: ${m.compartilhamentos || 0}. Seguidores novos: ${m.seguidores || 0}. Retenção média: ${m.retencao || "não informado"}.

Responda SOMENTE um JSON assim:
{"veredito":"funcionou | funcionou em parte | não funcionou","resumo":"1 a 2 frases simples sobre o resultado","pra_mim":{"gancho":"como o gancho dela se saiu e por quê","desenvolvimento":"como o meio se saiu e por quê","cta":"como o CTA se saiu e por quê"},"comparando":"1 a 2 frases comparando com a referência","melhorar":["o que fazer no próximo vídeo","..."],"proximo_video":"1 ideia de próximo vídeo para repetir o que deu certo"}
Regras: português do Brasil, frases simples, nunca use travessão (—), 3 a 4 itens em "melhorar". Seja honesta, sem exagerar elogios.`;
  const j = await perguntarGroq(chave, pedido, 0.4);
  const pm = j.pra_mim || {};
  return { veredito: texto(j.veredito, 40), resumo: texto(j.resumo), pra_mim: { gancho: texto(pm.gancho), desenvolvimento: texto(pm.desenvolvimento), cta: texto(pm.cta) },
    comparando: texto(j.comparando), melhorar: lista(j.melhorar, 5), proximo_video: texto(j.proximo_video, 300) };
}

// ---------- capas dos vídeos de referência (para os cards de inspiração) ----------
async function miniaturas(links: string[]) {
  const saida: Record<string, { imagem: string | null; autor?: string | null }> = {};
  await Promise.all(links.slice(0, 30).map(async (link) => {
    try {
      if (/tiktok\.com/i.test(link)) {
        const r = await abrir(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`, 6000);
        const j = await r.json();
        saida[link] = { imagem: j.thumbnail_url || null, autor: j.author_unique_id || null };
      } else if (/youtube\.com|youtu\.be/i.test(link)) {
        const id = link.match(/(?:shorts\/|v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1];
        saida[link] = { imagem: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null };
      } else if (/instagram\.com/i.test(link)) {
        // o Instagram costuma bloquear servidores; quando deixa, pega a imagem de prévia da página
        const r = await abrir(link, 6000);
        const html = await r.text();
        const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i);
        saida[link] = { imagem: m ? m[1].replace(/&amp;/g, "&") : null };
      } else saida[link] = { imagem: null };
    } catch {
      saida[link] = { imagem: null };
    }
  }));
  return { miniaturas: saida };
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
    if (corpo.acao === "adaptar") return resposta(await adaptar(chave, corpo));
    if (corpo.acao === "resultado") return resposta(await resultado(chave, corpo));
    if (corpo.acao === "miniaturas") return resposta(await miniaturas((Array.isArray(corpo.links) ? corpo.links : []).map(String).filter((l: string) => /^https?:\/\//.test(l))));
    return resposta({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ erro: "Algo deu errado. Tente de novo." }, 500);
  }
});
