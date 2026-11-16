// Creative Intelligence · Biblioteca de Anúncios (versão 6)
//
// Ações (POST, JSON):
// - "pesquisar" (padrão): busca anúncios públicos na Biblioteca de Anúncios da Meta pelo Apify.
//     { query, country, mediaType: all|image|video, activeOnly, maxResults }
//     ordem: "impressoes" pede à Meta os de mais impressões primeiro (usado em Mais performando, função ci-melhores)
// - "analisar": lê o TEXTO de 1 a 6 anúncios (e a transcrição, se ela colou) e devolve a
//     análise de cada um, os padrões entre eles e ideias de conteúdo. Nunca vê imagem nem vídeo.
//     { ads: [...], projeto?: { brand, product, objective, audience } }
// - "status": diz se o token do Apify e a chave do Groq estão configurados e como está o
//     limite mensal do Apify (sem mostrar nenhum segredo).
//
// Segredos (só no Supabase): APIFY_TOKEN e GROQ_API_KEY. Só a dona do painel usa
// (ou o próprio banco, em testes, com o cabeçalho x-cron = segredos_servidor "cron_painel").
// Todo erro volta com { error, code, hint }: a tela mostra o motivo e o que fazer.
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const ACTOR = "agenttoolworks~ad-library-scraper";
const ACTOR_RESERVA = "curious_coder~facebook-ads-library-scraper";
const FONTE = "Meta Ad Library via Apify";
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

// ---------- texto ----------
const semTravessao = (t: unknown) => String(t ?? "").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",");
const str = (v: unknown, max = 1200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const bloco = (v: unknown, max = 4000) =>
  String(v ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const first = (...values: unknown[]) => values.find((v) => v !== undefined && v !== null && String(v).trim() !== "");
const texto = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") return texto((v as any).text ?? (v as any).markup ?? "");
  return "";
};
const link = (v: unknown, max = 1800) => {
  const s = str(texto(v) || v, max);
  return /^https?:\/\//i.test(s) ? s : "";
};
function dataIso(v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number" || /^\d{9,13}$/.test(String(v))) {
    const n = Number(v);
    const d = new Date(n < 1e12 ? n * 1000 : n);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
const listaTexto = (v: unknown, max = 12, tam = 60) =>
  (Array.isArray(v) ? v : []).map((i) => str(i, tam)).filter(Boolean).slice(0, max);

// ---------- normalização (aceita o formato do Actor principal e o do reserva) ----------
function cartoes(x: any, s: any) {
  const origem = Array.isArray(x.cards) ? x.cards : Array.isArray(s.cards) ? s.cards : [];
  return origem.slice(0, 8).map((c: any) => ({
    title: str(texto(c.title), 300),
    body: bloco(texto(c.body), 800),
    image_url: link(first(c.imageUrl, c.image_url, c.original_image_url, c.resized_image_url, c.video_preview_image_url)),
    video_url: link(first(c.videoUrl, c.video_url, c.video_hd_url, c.video_sd_url)),
    link_url: link(first(c.linkUrl, c.link_url)),
  })).filter((c: any) => c.title || c.body || c.image_url || c.video_url);
}
function formato(bruto: string, temVideo: boolean, temImagem: boolean, qtdCartoes: number) {
  const f = bruto.toLowerCase();
  if (/video|reel/.test(f)) return "video";
  if (/carousel|carrossel|multi/.test(f)) return "carousel";
  if (/dynamic|dco|dpa|catalog/.test(f)) return "dynamic";
  if (/image|photo|meme/.test(f)) return "image";
  if (/text/.test(f)) return "text";
  if (temVideo) return "video";
  if (qtdCartoes > 1) return "carousel";
  if (temImagem) return "image";
  return "unknown";
}
const ROTULO_FORMATO: Record<string, string> = {
  video: "Vídeo", image: "Imagem", carousel: "Carrossel", dynamic: "Catálogo dinâmico", text: "Texto", unknown: "Não identificado",
};

function normalizar(x: any, index: number, paisBusca: string) {
  const s = x && typeof x.snapshot === "object" && x.snapshot ? x.snapshot : {};
  const id = str(first(x.adId, x.libraryId, x.adArchiveID, x.adArchiveId, x.ad_archive_id, x.archive_id, x.ad_id, x.id), 120);
  const page = str(first(x.advertiserName, x.pageName, x.page_name, s.page_name, x.advertiser_name, x.sponsor), 180);
  const cards = cartoes(x, s);
  const body = bloco(first(texto(x.body), texto(s.body), x.bodyText, x.body_text, x.adText, x.ad_text, x.ad_creative_bodies?.[0], cards[0]?.body));
  const title = str(first(texto(x.title), texto(s.title), x.headline, x.ad_creative_link_titles?.[0], cards[0]?.title), 500);
  const description = str(first(x.description, x.linkDescription, x.link_description, s.link_description, x.ad_creative_link_descriptions?.[0]), 1000);
  const image = link(first(x.imageUrl, x.image_url, s.images?.[0]?.original_image_url, s.images?.[0]?.resized_image_url, cards.find((c: any) => c.image_url)?.image_url));
  const video = link(first(x.videoUrl, x.video_url, x.videoUrls?.[0], s.videos?.[0]?.video_hd_url, s.videos?.[0]?.video_sd_url, cards.find((c: any) => c.video_url)?.video_url));
  const preview = link(first(x.videoPreviewUrl, x.video_preview_image_url, s.videos?.[0]?.video_preview_image_url)) || image;
  const fmt = formato(str(first(x.format, x.mediaType, x.media_type, s.display_format, x.creativeFormat, x.adFormat), 60), !!video, !!image, cards.length);
  const ativoBruto = first(x.isActive, x.is_active, x.active);
  const ativo = typeof ativoBruto === "boolean" ? ativoBruto
    : /^(true|active|ativo)$/i.test(String(ativoBruto ?? "")) ? true
    : /^(false|inactive|inativo)$/i.test(String(ativoBruto ?? "")) ? false : null;
  const plataformas = listaTexto(first(x.publisherPlatforms, x.publisher_platforms, x.publisherPlatform, x.publisher_platform), 8, 40)
    .map((p) => p.toUpperCase().replace(/_/g, " "));
  const paises = listaTexto(first(x.countries, x.ad_reached_countries), 30, 3).map((p) => p.toUpperCase());
  const url = link(first(x.adLibraryUrl, x.ad_library_url, x.adLibraryURL, x.snapshotUrl, x.ad_snapshot_url, x.url))
    || (/^\d{6,}$/.test(id) ? `https://www.facebook.com/ads/library/?id=${id}` : "");
  const cta = str(first(x.ctaText, x.cta_text, s.cta_text), 80);
  return {
    library_id: id || null,
    page_name: page || "Anunciante não identificado",
    page_id: str(first(x.advertiserId, x.pageId, x.page_id, s.page_id), 60) || null,
    body, title, description,
    cta_text: cta,
    link_url: link(first(x.linkUrl, x.link_url, s.link_url)),
    display_url: str(first(x.displayUrl, x.display_url, s.caption), 200),
    snapshot_url: url,
    image_url: image || null,
    video_url: video || null,
    preview_url: preview || null,
    cards,
    format: fmt,
    media_type: ROTULO_FORMATO[fmt],
    is_active: ativo,
    start_date: dataIso(first(x.firstShown, x.startDate, x.start_date, x.startDateFormatted, x.ad_delivery_start_time)),
    stop_date: dataIso(first(x.lastShown, x.endDate, x.end_date, x.endDateFormatted, x.ad_delivery_stop_time)),
    platforms: plataformas,
    countries: paises,
    country: paises.length === 1 ? paises[0] : paisBusca,
    matches_query: typeof x.matchesQuery === "boolean" ? x.matchesQuery : null,
    collation_count: Number(first(x.collationCount, x.collation_count, x.adsCount, x.ads_count)) > 1 ? Number(first(x.collationCount, x.collation_count, x.adsCount, x.ads_count)) : null,
    total_in_library: Number.isFinite(Number(x.totalInLibrary)) && Number(x.totalInLibrary) > 0 ? Number(x.totalInLibrary) : null,
    text_for_analysis: [title, body, description, cta ? `CTA: ${cta}` : ""].filter(Boolean).join("\n"),
    raw_source: FONTE,
    position: index,
  };
}

// ---------- Apify ----------
function erroApify(status: number, payload: any, bruto: string): Falha {
  const tipo = str(payload?.error?.type, 80);
  const detalhe = str(payload?.error?.message || payload?.message || (typeof payload?.error === "string" ? payload.error : "") || bruto, 240);
  const junto = `${tipo} ${detalhe}`.toLowerCase();
  const com = (m: string) => detalhe ? `${m} Resposta do Apify: ${detalhe}` : m;
  if (status === 401 || /token-not-found|token is not valid|authentication/.test(junto))
    return new Falha("apify_token_invalido", "O token do Apify foi recusado.", "Gere um token novo em console.apify.com (Settings, API & Integrations) e troque o segredo APIFY_TOKEN nas Edge Functions do Supabase.", 502);
  if (/monthly usage|usage hard limit|hard limit exceeded/.test(junto))
    return new Falha("apify_limite_mensal", "A conta do Apify atingiu o limite de uso deste mês.", "Em console.apify.com, veja Billing. O plano grátis renova no início do ciclo; para pesquisar antes disso é preciso aumentar o limite mensal ou mudar de plano.", 502);
  if (status === 402 || /not-enough|insufficient.*(credit|funds|usage)|payment/.test(junto))
    return new Falha("apify_sem_creditos", com("O Apify recusou a pesquisa por falta de créditos."), "Confira o saldo em console.apify.com, Billing.", 502);
  if (status === 403 || /insufficient-permissions|permission|not-rented|forbidden/.test(junto))
    return new Falha("apify_sem_permissao", com("O token do Apify não tem permissão para rodar este serviço."), "Use um token com acesso completo (não restrito a Actors específicos) no segredo APIFY_TOKEN.", 502);
  if (status === 404 || /actor-not-found|record-not-found|not found/.test(junto))
    return new Falha("actor_indisponivel", "O serviço de pesquisa (Actor do Apify) não foi encontrado ou saiu do ar.", "Avise o Claude para trocar o Actor da função ci-ad-library.", 502);
  if (status === 429 || /rate-limit|too many/.test(junto))
    return new Falha("apify_limite_requisicoes", "O Apify está limitando as requisições agora.", "Espere 1 minuto e pesquise de novo.", 429);
  if (status === 408 || /timeout|timed.?out/.test(junto))
    return new Falha("tempo_excedido", "A pesquisa passou do tempo de espera.", "Tente com menos resultados ou um termo mais específico.", 504);
  if (/run-failed|did not succeed|actor run/.test(junto))
    return new Falha("actor_falhou", com("A pesquisa começou, mas o serviço não conseguiu ler a Biblioteca de Anúncios da Meta."), "Costuma ser bloqueio momentâneo da Meta. Tente de novo em alguns minutos.", 502);
  if (status >= 500)
    return new Falha("apify_fora_do_ar", com(`O Apify respondeu com erro interno (${status}).`), "Tente de novo em alguns minutos.", 502);
  return new Falha("apify_erro", com(`O Apify recusou a pesquisa (código ${status}).`), "Se continuar, mostre esta mensagem ao Claude.", 502);
}

async function rodarActor(token: string, actor: string, entrada: unknown) {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=110&format=json&clean=true`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(entrada),
      signal: AbortSignal.timeout(125_000),
    });
  } catch (e) {
    const m = String((e as Error)?.message || e);
    if (/timed out|timeout|abort/i.test(m)) throw new Falha("tempo_excedido", "A pesquisa passou do tempo de espera.", "Tente com menos resultados ou um termo mais específico.", 504);
    throw new Falha("comunicacao", "Não consegui falar com o Apify.", "Pode ser instabilidade de rede. Tente de novo em instantes.", 502);
  }
  const bruto = await response.text();
  let payload: any = null;
  try { payload = JSON.parse(bruto); } catch { /* resposta sem JSON */ }
  if (!response.ok) {
    console.error("ci-ad-library apify", actor, response.status, str(payload?.error?.type, 60), str(payload?.error?.message || bruto, 200));
    throw erroApify(response.status, payload, payload ? "" : bruto);
  }
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : null;
  if (!rows) {
    console.error("ci-ad-library apify resposta inesperada", actor, str(bruto, 200));
    throw new Falha("resposta_invalida", "O Apify respondeu em um formato que não reconheci.", "Mostre esta mensagem ao Claude para ajustar a leitura da resposta.", 502);
  }
  return rows.filter((r: any) => r && typeof r === "object" && !r.error && (r.rowType === undefined || r.rowType === "ad"));
}

async function pesquisar(token: string, body: any, teste: boolean) {
  const query = str(body.query, 180);
  const country = str(body.country || "BR", 3).toUpperCase();
  const activeOnly = body.activeOnly !== false;
  const mediaType = ["video", "image"].includes(body.mediaType) ? body.mediaType : "all";
  const maxResults = Math.max(5, Math.min(50, Math.round(Number(body.maxResults)) || 20));
  if (query.length < 2) throw new Falha("termo_curto", "Digite uma marca, produto ou palavra-chave com pelo menos 2 letras.", "", 400);
  if (!/^(?:[A-Z]{2}|ALL)$/.test(country)) throw new Falha("pais_invalido", "País inválido.", "Escolha um país da lista.", 400);

  const libraryUrl = new URL("https://www.facebook.com/ads/library/");
  libraryUrl.searchParams.set("active_status", activeOnly ? "active" : "all");
  libraryUrl.searchParams.set("ad_type", "all");
  libraryUrl.searchParams.set("country", country);
  libraryUrl.searchParams.set("q", query);
  libraryUrl.searchParams.set("search_type", "keyword_unordered");
  libraryUrl.searchParams.set("media_type", mediaType);
  if (body.ordem === "impressoes") {
    libraryUrl.searchParams.set("sort_data[direction]", "desc");
    libraryUrl.searchParams.set("sort_data[mode]", "total_impressions");
  }
  const endereco = libraryUrl.toString();

  const usarReserva = teste && body.actor === "reserva";
  let rows: any[] = [];
  let actorUsado = ACTOR;
  const principal = () => rodarActor(token, ACTOR, {
    // só startUrls: mandar "query" junto faria o Actor rodar duas buscas (e cobrar as duas)
    startUrls: [{ url: endereco }],
    platforms: ["meta"],
    maxResultsPerPlatform: maxResults,
    activeOnly,
    includeDetails: false,
    proxy: "none",
  });
  const reserva = () => rodarActor(token, ACTOR_RESERVA, { urls: [{ url: endereco }], count: Math.max(10, maxResults), scrapeAdDetails: false });
  if (usarReserva) { rows = await reserva(); actorUsado = ACTOR_RESERVA; }
  else {
    try { rows = await principal(); }
    catch (e) {
      // só troca de Actor quando o problema é do Actor, nunca quando é da conta (token, crédito, limite)
      if (e instanceof Falha && ["actor_indisponivel", "actor_falhou"].includes(e.code)) {
        console.error("ci-ad-library: Actor principal falhou, tentando o reserva:", e.code);
        try { rows = await reserva(); actorUsado = ACTOR_RESERVA; } catch (e2) { throw e2 instanceof Falha && !["actor_indisponivel", "actor_falhou"].includes(e2.code) ? e2 : e; }
      } else throw e;
    }
  }

  const vistos = new Set<string>();
  const ads = rows.map((r, i) => normalizar(r, i, country))
    .filter((a) => a.snapshot_url || a.library_id || a.body || a.title)
    .filter((a) => { const k = a.library_id || `${a.page_name}|${a.title}|${a.body.slice(0, 80)}`; if (vistos.has(k)) return false; vistos.add(k); return true; })
    .slice(0, maxResults)
    .map((a, i) => ({ ...a, position: i }));
  return {
    ok: true,
    query, country, active_only: activeOnly, media_type_filter: mediaType, max_results: maxResults,
    source: FONTE, searched_at: new Date().toISOString(),
    result_count: ads.length, ads,
    total_in_library: ads.find((a) => a.total_in_library)?.total_in_library ?? null,
    library_search_url: endereco,
    ...(teste ? { actor: actorUsado, amostra_bruta: rows.slice(0, 1) } : {}),
  };
}

// ---------- Groq (análise) ----------
async function modeloTexto(chave: string) {
  const preferidos = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct-0905", "qwen/qwen3-32b", "openai/gpt-oss-20b"];
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${chave}` } });
    const j = await r.json();
    const ids: string[] = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id));
    return preferidos.filter((p) => ids.includes(p)).concat(preferidos).filter((v, i, a) => a.indexOf(v) === i);
  } catch { return preferidos; }
}
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } } };

async function pedirIA(chave: string, sistema: string, pedido: string, max: number) {
  const fila = (await modeloTexto(chave)).slice(0, 3);
  let limite = false, ultimo = "";
  for (const modelo of fila) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelo, temperature: 0.35, max_tokens: max,
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
  console.error("ci-ad-library ia:", ultimo);
  if (limite) throw new Falha("ia_limite", "A IA atingiu o limite de uso por minuto.", "Espere 1 minuto e peça a análise de novo. Com menos anúncios por vez o limite demora mais a chegar.", 429);
  throw new Falha("ia_sem_resposta", "A IA não devolveu uma análise utilizável agora.", "Tente de novo em instantes.", 502);
}

const t = (v: unknown, n = 500) => str(semTravessao(typeof v === "string" || typeof v === "number" ? v : ""), n);
const lista = (v: unknown, n = 6, tam = 260) =>
  (Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v] : []).map((i) => t(typeof i === "string" ? i : (i?.texto || i?.item || i?.titulo || ""), tam)).filter(Boolean).slice(0, n);

async function analisar(chave: string, body: any) {
  const entrada = (Array.isArray(body.ads) ? body.ads : []).slice(0, 6).map((a: any) => {
    const cards = (Array.isArray(a.cards) ? a.cards : []).slice(0, 4).map((c: any) => [str(c.title, 120), str(c.body, 200)].filter(Boolean).join(": ")).filter(Boolean);
    const transcricao = bloco(a.transcript, 1500);
    const textoAnuncio = bloco([a.title && `Título: ${str(a.title, 300)}`, a.body && `Texto principal: ${bloco(a.body, 1100)}`, a.description && `Descrição do link: ${str(a.description, 300)}`, a.cta_text && `Botão (CTA): ${str(a.cta_text, 60)}`, cards.length && `Cartões do carrossel: ${cards.join(" | ")}`].filter(Boolean).join("\n"), 1900);
    return {
      marca: str(a.page_name, 120) || "Anunciante não identificado",
      formato: str(a.media_type || a.format, 40) || "não identificado",
      inicio: str(a.start_date, 20), ativo: a.is_active === true ? "sim" : a.is_active === false ? "não" : "não informado",
      plataformas: listaTexto(a.platforms, 6, 30).join(", "),
      textoAnuncio, transcricao,
    };
  }).filter((a: any) => a.textoAnuncio.length + a.transcricao.length >= 12);
  if (!entrada.length) throw new Falha("sem_texto", "Esses anúncios não têm texto para analisar.", "A Meta não devolveu o texto deles. Abra a referência, cole a transcrição ou a descrição do vídeo e analise de novo.", 400);

  const p = body.projeto && typeof body.projeto === "object" ? body.projeto : null;
  const contexto = p ? [p.brand && `Marca do projeto dela: ${str(p.brand, 80)}`, p.product && `Produto: ${str(p.product, 120)}`, p.objective && `Objetivo: ${str(p.objective, 160)}`, p.audience && `Público: ${str(p.audience, 160)}`].filter(Boolean).join("\n") : "";
  const sistema = `Você é estrategista de criativos de performance e trabalha com a Mari, criadora de conteúdo UGC brasileira. Você estuda anúncios reais da Biblioteca de Anúncios da Meta para ela aprender o mecanismo e criar roteiros próprios, sem copiar.
Regras:
- Você só tem o TEXTO de cada anúncio (título, texto principal, descrição, botão) e, às vezes, uma transcrição colada por ela. Você NÃO viu imagem nem vídeo. Nunca descreva cena, visual, pessoa, cenário ou edição.
- Cite trechos literais entre aspas quando apontar gancho, argumento ou CTA.
- Se o texto não mostra alguma coisa, escreva "não dá para saber pelo texto". Nunca invente dado, métrica, resultado ou preço.
- "motivos" são hipóteses de por que o anúncio pode gerar interesse, nunca comprovação de desempenho.
- Seja específico e prático, frases curtas, português do Brasil, sem travessão.
- Responda só com JSON.`;
  const pedido = `${contexto ? contexto + "\n\n" : ""}${entrada.map((a: any, i: number) => `ANÚNCIO ${i + 1}
Anunciante: ${a.marca} | Formato informado pela Meta: ${a.formato} | Início: ${a.inicio || "não informado"} | Ativo: ${a.ativo}${a.plataformas ? ` | Plataformas: ${a.plataformas}` : ""}
${a.textoAnuncio || "(a Meta não devolveu texto)"}${a.transcricao ? `\nTranscrição ou descrição colada por ela:\n${a.transcricao}` : ""}`).join("\n\n")}

Devolva este JSON (um item em "analises" para cada anúncio, na mesma ordem):
{"analises":[{"indice":1,"gancho":"a abertura, literal, e o tipo de gancho","abordagem":"o ângulo criativo usado","problema":"a dor ou situação apresentada","solucao":"o que é oferecido como saída","beneficios":["benefícios destacados"],"argumentos":["argumentos de venda, com trecho literal"],"estrutura":"os blocos na ordem em que aparecem","cta":"a chamada para ação, literal","linguagem":"tom, vocabulário e jeito de falar","identificacao":"com quem o texto conversa e o que gera identificação","motivos":["hipóteses de por que pode gerar interesse e conversão"],"como_adaptar":"como a Mari usa esse mecanismo em um roteiro UGC próprio, sem copiar","ideias":["2 ideias de conteúdo UGC, cada uma com a primeira fala"]}],${entrada.length > 1 ? `"padroes":{"resumo":"o que esses anúncios têm em comum, em 2 frases","ganchos":["padrões de gancho que se repetem"],"abordagens":["ângulos que se repetem"],"estruturas":["estruturas que se repetem"],"ctas":["padrões de CTA"],"oportunidades":["o que nenhum deles faz e ela pode explorar"]},` : ""}"ideias":[{"titulo":"nome curto da ideia","gancho":"primeira fala","angulo":"o ângulo","formato":"Reels, Carrossel ou Stories"}]}
Em "ideias" gerais, traga 3 ideias novas construídas a partir do conjunto.`;

  const out = await pedirIA(chave, sistema, pedido, Math.min(4200, 900 + entrada.length * 560));
  const agora = new Date().toISOString();
  const analises = entrada.map((a: any, i: number) => {
    const x = (out.analises as any[]).find((y) => Number(y?.indice) === i + 1) || out.analises[i] || {};
    const base = a.transcricao ? "texto_e_transcricao" : "texto";
    const r = {
      tipo: "anuncio", versao: 1, em: agora, base,
      limites: a.transcricao
        ? "Análise feita com o texto do anúncio e com a transcrição ou descrição que você colou. A IA não viu a imagem nem o vídeo."
        : "Análise feita só com o texto do anúncio (título, texto principal, descrição e botão). A IA não viu a imagem nem o vídeo.",
      gancho: t(x.gancho, 500), abordagem: t(x.abordagem, 500), problema: t(x.problema, 500), solucao: t(x.solucao, 500),
      beneficios: lista(x.beneficios), argumentos: lista(x.argumentos), estrutura: t(x.estrutura, 800), cta: t(x.cta, 300),
      linguagem: t(x.linguagem, 500), identificacao: t(x.identificacao, 500), motivos: lista(x.motivos),
      como_adaptar: t(x.como_adaptar, 700), ideias: lista(x.ideias, 3, 400),
    };
    // mesmas chaves da análise da Skill UGC, para as telas antigas do projeto continuarem lendo
    return {
      ...r,
      observado: { gancho: r.gancho, formato: a.formato, estrutura: r.estrutura, ritmo: r.linguagem, argumentos: r.argumentos, cta: r.cta },
      interpretacao: { por_que_funciona: r.motivos.join(" "), publico: r.identificacao, emocao: r.problema, como_adaptar: r.como_adaptar },
    };
  });
  const pd = out.padroes && typeof out.padroes === "object" ? out.padroes : null;
  return {
    ok: true, analises,
    padroes: entrada.length > 1 && pd ? { resumo: t(pd.resumo, 600), ganchos: lista(pd.ganchos), abordagens: lista(pd.abordagens), estruturas: lista(pd.estruturas), ctas: lista(pd.ctas), oportunidades: lista(pd.oportunidades) } : null,
    ideias: (Array.isArray(out.ideias) ? out.ideias : []).slice(0, 4).map((i: any) => ({ titulo: t(i?.titulo, 120), gancho: t(i?.gancho, 300), angulo: t(i?.angulo, 300), formato: t(i?.formato, 40) })).filter((i: any) => i.titulo || i.gancho),
    analisados: analises.length, em: agora,
  };
}

async function status(apify: string, groq: string) {
  const r: any = { ok: true, apify_token: !!apify, groq_chave: !!groq, actor: ACTOR.replace("~", "/") };
  if (apify) {
    try {
      const resp = await fetch("https://api.apify.com/v2/users/me/limits", { headers: { Authorization: `Bearer ${apify}` }, signal: AbortSignal.timeout(15_000) });
      const j = await resp.json().catch(() => null);
      if (resp.ok && j?.data) {
        const usado = Number(j.data.current?.monthlyUsageUsd), teto = Number(j.data.limits?.maxMonthlyUsageUsd);
        r.apify = { valido: true, uso_mes_usd: Number.isFinite(usado) ? Math.round(usado * 100) / 100 : null, limite_mes_usd: Number.isFinite(teto) ? teto : null, ciclo_termina: j.data.monthlyUsageCycle?.endAt || null };
        r.apify.no_limite = Number.isFinite(usado) && Number.isFinite(teto) && teto > 0 && usado >= teto;
      } else r.apify = { valido: false, motivo: erroApify(resp.status, j, "").message };
    } catch { r.apify = { valido: null, motivo: "Não consegui falar com o Apify agora." }; }
  }
  return r;
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

    const body = await req.json().catch(() => ({}));
    const acao = str(body.acao || "pesquisar", 20);
    const apify = Deno.env.get("APIFY_TOKEN") || "";
    const groq = Deno.env.get("GROQ_API_KEY") || "";

    if (acao === "status") return json(await status(apify, groq));
    if (acao === "analisar") {
      if (!groq) throw new Falha("ia_sem_chave", "A análise precisa da chave do Groq.", "Cadastre o segredo GROQ_API_KEY nas Edge Functions do Supabase.", 503);
      return json(await analisar(groq, body));
    }
    if (acao === "pesquisar") {
      if (!apify) throw new Falha("apify_token_ausente", "A pesquisa precisa do token do Apify.", "Cadastre o segredo APIFY_TOKEN nas Edge Functions do Supabase. Nenhum anúncio foi pesquisado.", 503);
      return json(await pesquisar(apify, body, teste));
    }
    throw new Falha("acao_invalida", "Ação desconhecida.", "", 400);
  } catch (error) {
    if (error instanceof Falha) {
      console.error("ci-ad-library:", error.code, error.message);
      return json({ ok: false, code: error.code, error: error.message, hint: error.hint }, error.status);
    }
    const message = String((error as Error)?.message || error);
    console.error("ci-ad-library erro inesperado:", message);
    return json({ ok: false, code: "erro_interno", error: "A função encontrou um erro inesperado.", hint: "Tente de novo. Se continuar, mostre esta mensagem ao Claude." }, 500);
  }
});
