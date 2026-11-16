// Creative Intelligence · Mais performando (versão 1, nov/2026, pedido da Mari)
// Recebe os anúncios de uma pesquisa da Biblioteca de Anúncios (função ci-ad-library, ação pesquisar),
// ranqueia pelos sinais públicos de desempenho e pede à IA (Groq) os melhores ganchos e a análise.
// POST { ads: [...], query }. Só a dona do painel (ou o banco com x-cron = segredos_servidor "cron_painel").
// Segredo (só no Supabase): GROQ_API_KEY. Todo erro volta { ok:false, code, error, hint }.
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class Falha extends Error {
  code: string; hint: string; status: number;
  constructor(code: string, message: string, hint = "", status = 502) {
    super(message); this.code = code; this.hint = hint; this.status = status;
  }
}

const semTravessao = (t: unknown) => String(t ?? "").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");
const str = (v: unknown, max = 1200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const bloco = (v: unknown, max = 4000) =>
  String(v ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const t = (v: unknown, n = 500) => str(semTravessao(typeof v === "string" || typeof v === "number" ? v : ""), n);
const lista = (v: unknown, n = 6, tam = 260) =>
  (Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v] : []).map((i) => t(typeof i === "string" ? i : (i?.texto || i?.item || i?.titulo || ""), tam)).filter(Boolean).slice(0, n);

// ---------- Groq ----------
async function modeloTexto(chave: string) {
  const preferidos = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct-0905", "qwen/qwen3-32b", "openai/gpt-oss-20b"];
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${chave}` } });
    const j = await r.json();
    const ids: string[] = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id));
    return preferidos.filter((p) => ids.includes(p)).concat(preferidos).filter((v, i, a) => a.indexOf(v) === i);
  } catch { return preferidos; }
}
const lerJson = (s: string) => { try { return JSON.parse(s); } catch { const m = s.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } } };

async function pedirIA(chave: string, sistema: string, pedido: string, max: number) {
  const fila = (await modeloTexto(chave)).slice(0, 3);
  let limite = false, ultimo = "";
  for (const modelo of fila) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelo, temperature: 0.4, max_tokens: max,
          ...(/gpt-oss/.test(modelo) ? { reasoning_effort: "low" } : {}),
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: sistema }, { role: "user", content: pedido }],
        }),
        signal: AbortSignal.timeout(70_000),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) throw new Falha("ia_chave_invalida", "A chave do Groq foi recusada.", "Troque o segredo GROQ_API_KEY nas Edge Functions do Supabase.", 502);
      if (r.status === 429 || r.status === 413) { limite = true; ultimo = str(j?.error?.message, 160); continue; }
      if (!r.ok) { ultimo = str(j?.error?.message, 160); continue; }
      const out = lerJson(String(j?.choices?.[0]?.message?.content || ""));
      if (out && Array.isArray(out.analises) && out.analises.length) return out;
      ultimo = "resposta incompleta";
    } catch (e) {
      if (e instanceof Falha) throw e;
      ultimo = String((e as Error)?.message || e).slice(0, 160);
    }
  }
  console.error("ci-melhores ia:", ultimo);
  if (limite) throw new Falha("ia_limite", "A IA atingiu o limite de uso por minuto.", "Espere 1 minuto e toque em Tentar de novo. A busca não precisa ser refeita.", 429);
  throw new Falha("ia_sem_resposta", "A IA não devolveu uma análise utilizável agora.", "Toque em Tentar de novo em instantes. A busca não precisa ser refeita.", 502);
}

// ---------- Mais performando (nov/2026, pedido da Mari) ----------
// A Meta não mostra vendas, cliques nem views de anúncio comercial. Os sinais públicos que o mercado
// usa para achar o que está dando certo são: tempo no ar (ninguém paga meses por um anúncio que não
// vende), quantas versões usam o mesmo texto (a marca escala o que funciona) e se segue ativo.
const chaveTexto = (a: any) => String([a.title, a.body].filter(Boolean).join(" "))
  .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/https?:\S+/g, "")
  .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);

// a abertura do anúncio: a primeira frase do texto principal (o título costuma ser só o nome da marca ou do produto)
function abertura(a: any) {
  const corpo = String(a.body || "").replace(/\r/g, "").trim();
  const base = corpo || String(a.title || "");
  const linha = base.split(/\n+/).map((l) => l.trim()).find((l) => l.replace(/[^\p{L}\p{N}]/gu, "").length >= 3) || "";
  const m = linha.match(/^.{8,}?[.!?…](?=\s|$)/u);
  const frase = m ? m[0] : linha;
  return frase.length > 180 ? str(frase, 175).replace(/\s+\S*$/, "") + "…" : str(frase, 180);
}

function diasNoAr(a: any) {
  if (!a.start_date) return 0;
  const ini = new Date(a.start_date + "T00:00:00Z").getTime();
  const fim = a.is_active === false && a.stop_date ? new Date(a.stop_date + "T00:00:00Z").getTime() : Date.now();
  return isNaN(ini) || isNaN(fim) ? 0 : Math.max(0, Math.round((fim - ini) / 86400000));
}

function ranquear(lista: any[], porImpressoes = false) {
  const grupos = new Map<string, any[]>();
  for (const a of lista) {
    const k = chaveTexto(a);
    if (k.length < 12) continue; // sem texto não dá para estudar o gancho
    const g = grupos.get(k) || []; g.push(a); grupos.set(k, g);
  }
  return [...grupos.values()].map((g) => {
    const dias = Math.max(...g.map(diasNoAr));
    const meta = Math.max(0, ...g.map((a) => Number(a.collation_count) || 0));
    const variacoes = Math.max(g.length, meta);
    const ativo = g.some((a) => a.is_active === true);
    const video = g.some((a) => a.format === "video");
    const marcas = new Set(g.map((a) => a.page_name)).size;
    // posição na lista que a Meta devolveu ordenada por mais impressões (0 = a mais vista)
    const posicao = Math.min(...g.map((a) => Number.isFinite(Number(a.position)) ? Number(a.position) : 99));
    // pontos: alcance em impressões (até 200), 0,8 por dia no ar (até 6 meses), 12 por versão a mais, 15 se segue ativo, 8 se é vídeo
    const pontos = (porImpressoes ? Math.max(0, 50 - posicao) * 4 : 0) + Math.round(Math.min(dias, 180) * 0.8) + (variacoes - 1) * 12 + (ativo ? 15 : 0) + (video ? 8 : 0) + (marcas - 1) * 10;
    const base = g.slice().sort((x, y) => diasNoAr(y) - diasNoAr(x))[0];
    return { ad: base, dias, variacoes, ativo, video, pontos, posicao: posicao < 99 ? posicao + 1 : null };
  }).sort((x, y) => y.pontos - x.pontos);
}

async function melhores(chave: string, body: any) {
  const query = str(body.query, 180);
  const brutos = (Array.isArray(body.ads) ? body.ads : []).slice(0, 80);
  if (!brutos.length) throw new Falha("sem_anuncios", "Nenhum anúncio para ranquear.", "Pesquise de novo com outro termo.", 400);
  const porImpressoes = body.ordem === "impressoes";
  // buscou uma marca: a busca da Meta é por palavra e traz anúncios de outras páginas; fica só com os da marca
  const norm = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
  const q = norm(query);
  const daMarca = q.length >= 2 ? brutos.filter((a: any) => { const pg = norm(a.page_name); return pg && (pg.includes(q) || (pg.length >= 3 && q.includes(pg))); }) : [];
  const soMarca = daMarca.length >= 4;
  const ranking = ranquear(soMarca ? daMarca : brutos, porImpressoes);
  if (!ranking.length) throw new Falha("sem_texto", "Os anúncios encontrados não têm texto para estudar.", "A Meta não devolveu o texto deles. Tente outro termo ou só vídeos.", 400);
  const top = ranking.slice(0, 6);

  const sistema = `Você é estrategista de criativos de performance e trabalha com a Mari, criadora de conteúdo UGC brasileira (@maribonettougc, mãe de duas meninas, Valinhos/SP).
Você recebe os anúncios mais fortes da Biblioteca de Anúncios da Meta para um tema, já ranqueados por sinais públicos: posição na lista de mais impressões da Meta, dias no ar e quantas versões usam o mesmo texto.
Regras:
- Você só tem o TEXTO do anúncio. Não viu imagem nem vídeo. Nunca descreva cena, pessoa ou edição.
- O gancho de cada anúncio é a "Abertura" que eu mando, copiada literalmente. Nunca use o título nem o nome da marca como gancho.
- Em "por que vale modelar", explique a MECÂNICA (identificação, contraste, quebra de objeção, promessa com número, prova, curiosidade, urgência...) e cite o sinal (ex.: "3º com mais impressões", "15 versões no ar", "há 120 dias rodando"). Nunca invente venda, view ou resultado.
- Ganchos novos para ela modelam a mecânica dos melhores, nunca copiam frase, valor ou promessa da marca. Primeira pessoa, fala natural de UGC, até 15 palavras. Ela tem duas filhas: diga \"minhas filhas\" ou \"as meninas\", nunca \"meus filhos\".
- Nos ganchos novos, NUNCA invente número, porcentagem, pesquisa, dado ou resultado. Use só situação, dor, contraste, pergunta ou objeção.
- Português do Brasil, frases curtas, sem travessão. Responda só com JSON.`;
  const pedido = `Tema pesquisado: "${query || "não informado"}"

${top.map((r, i) => `ANÚNCIO ${i + 1}
Anunciante: ${str(r.ad.page_name, 100)} | Formato: ${r.video ? "vídeo" : str(r.ad.media_type || r.ad.format, 30)} ${r.posicao && porImpressoes ? ` | Posição entre os de mais impressões: ${r.posicao}º` : ""} | Dias no ar: ${r.dias || "não informado"} | Versões com o mesmo texto: ${r.variacoes} | ${r.ativo ? "ativo" : "encerrado"}
Abertura (o gancho, literal): "${abertura(r.ad)}"
${[r.ad.title && `Título: ${str(r.ad.title, 200)}`, r.ad.body && `Texto: ${bloco(r.ad.body, 650)}`, r.ad.cta_text && `Botão: ${str(r.ad.cta_text, 40)}`].filter(Boolean).join("\n")}`).join("\n\n")}

Devolva este JSON (um item em "analises" por anúncio, na mesma ordem):
{"analises":[{"indice":1,"gancho":"a Abertura, literal","tipo":"tipo de gancho em 2 a 4 palavras","por_que":"por que vale modelar: a mecânica + o sinal, em até 2 frases","estrutura":"os blocos do texto em ordem, curto"}],
"melhores_ganchos":[{"indice":1,"gancho":"literal","tipo":"tipo","por_que":"1 frase"}],
"o_que_levar":"a estrutura que se repete nos melhores, em 2 frases",
"padroes":["3 padrões que se repetem"],
"oportunidades":["2 coisas que nenhum deles faz e ela pode explorar"],
"ganchos_para_voce":[{"gancho":"gancho novo para ela gravar","mecanica":"qual mecânica modela","de":1}]}
"melhores_ganchos": os 5 ganchos mais fortes do conjunto, do melhor para o pior. "ganchos_para_voce": 6 ganchos novos.`;

  const out = await pedirIA(chave, sistema, pedido, 3200);
  const an = Array.isArray(out.analises) ? out.analises : [];
  const agora = new Date().toISOString();
  return {
    ok: true, query, em: agora,
    estudados: brutos.length, criativos: ranking.length,
    so_marca: soMarca,
    metodo: (soMarca ? `Fiquei só com os anúncios das páginas de "${query}" (${daMarca.length} de ${brutos.length}). ` : "") + (porImpressoes ? "Pedi à Meta os anúncios com mais impressões primeiro. " : "") + "A Meta não mostra vendas nem cliques de anúncio comercial, então ranqueei pelos sinais públicos: " + (porImpressoes ? "posição entre os mais vistos, " : "") + "há quanto tempo está no ar, quantas versões usam o mesmo texto e se continua ativo. A IA leu só o texto, não assistiu aos vídeos.",
    ranking: top.map((r, i) => {
      const x = an.find((y: any) => Number(y?.indice) === i + 1) || an[i] || {};
      return {
        ad: { ...r.ad, text_for_analysis: undefined, cards: Array.isArray(r.ad.cards) ? r.ad.cards.slice(0, 3) : [] }, posicao: r.posicao, dias: r.dias, variacoes: r.variacoes, ativo: r.ativo, video: r.video, pontos: r.pontos,
        gancho: abertura(r.ad) || t(x.gancho, 300), tipo: t(x.tipo, 60), por_que: t(x.por_que, 500), estrutura: t(x.estrutura, 400),
      };
    }),
    melhores_ganchos: (Array.isArray(out.melhores_ganchos) ? out.melhores_ganchos : []).slice(0, 5)
      .map((g: any) => { const i = Number(g?.indice) || 0, ref = top[i - 1]; return { gancho: (ref && abertura(ref.ad)) || t(g?.gancho, 300), tipo: t(g?.tipo, 60), por_que: t(g?.por_que, 300), indice: ref ? i : null }; })
      .filter((g: any, i: number, todos: any[]) => g.gancho && todos.findIndex((x) => x.gancho === g.gancho) === i),
    o_que_levar: t(out.o_que_levar, 600),
    padroes: lista(out.padroes, 4),
    oportunidades: lista(out.oportunidades, 3),
    ganchos_para_voce: (Array.isArray(out.ganchos_para_voce) ? out.ganchos_para_voce : []).slice(0, 6)
      .map((g: any) => ({ gancho: t(g?.gancho, 240), mecanica: t(g?.mecanica, 120), de: Number(g?.de) || null }))
      .filter((g: any) => g.gancho),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, code: "metodo", error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    let teste = false;
    const cron = req.headers.get("x-cron") || "";
    if (cron.length >= 20) {
      const srv = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: seg } = await srv.from("segredos_servidor").select("valor").eq("chave", "cron_painel").maybeSingle();
      if (seg?.valor && seg.valor === cron) teste = true;
    }
    if (!teste) {
      const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
      const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
      if (!user || user.email !== EMAIL_DONA) throw new Falha("nao_autorizado", "Sua sessão expirou ou não tem acesso a esta ferramenta.", "Saia do painel e entre de novo.", 401);
    }
    const groq = Deno.env.get("GROQ_API_KEY") || "";
    if (!groq) throw new Falha("ia_sem_chave", "A análise precisa da chave do Groq.", "Cadastre o segredo GROQ_API_KEY nas Edge Functions do Supabase.", 503);
    const body = await req.json().catch(() => ({}));
    return json(await melhores(groq, body));
  } catch (error) {
    if (error instanceof Falha) {
      console.error("ci-melhores:", error.code, error.message);
      return json({ ok: false, code: error.code, error: error.message, hint: error.hint }, error.status);
    }
    console.error("ci-melhores erro inesperado:", String((error as Error)?.message || error));
    return json({ ok: false, code: "erro_interno", error: "A função encontrou um erro inesperado.", hint: "Tente de novo. Se continuar, mostre esta mensagem ao Claude." }, 500);
  }
});
