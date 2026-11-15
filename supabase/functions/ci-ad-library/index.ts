import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const ACTOR = "agenttoolworks~ad-library-scraper";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const str = (v: unknown, max = 1200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const first = (...values: unknown[]) => values.find((v) => v !== undefined && v !== null && String(v).trim() !== "");

function normalizar(x: any, index: number) {
  const id = str(first(x.libraryId, x.adArchiveId, x.ad_archive_id, x.id, x.archive_id), 120);
  const page = str(first(x.pageName, x.page_name, x.advertiserName, x.advertiser_name, x.sponsor, x.name), 180) || "Anunciante não identificado";
  const body = str(first(x.body, x.adText, x.ad_text, x.ad_creative_bodies?.[0], x.creativeBody, x.text, x.caption), 4000);
  const title = str(first(x.title, x.ad_creative_link_titles?.[0], x.linkTitle, x.headline), 500);
  const description = str(first(x.description, x.ad_creative_link_descriptions?.[0], x.linkDescription), 1000);
  const snapshot = str(first(x.snapshotUrl, x.ad_snapshot_url, x.adLibraryUrl, x.ad_library_url, x.url, x.libraryUrl), 1800);
  const media = str(first(x.mediaType, x.media_type, x.format, x.adFormat, x.ad_format, x.type), 80).toLowerCase();
  const videoUrl = str(first(x.videoUrl, x.video_url, x.video?.url, x.creative?.videoUrl), 1800);
  const active = x.isActive ?? x.is_active ?? x.active ?? (String(first(x.status, x.adStatus, "")).toLowerCase().includes("active"));
  const start = first(x.startDate, x.start_date, x.ad_delivery_start_time, x.deliveryStartTime);
  const stop = first(x.endDate, x.end_date, x.ad_delivery_stop_time, x.deliveryStopTime);
  const platforms = Array.isArray(x.publisherPlatforms) ? x.publisherPlatforms : Array.isArray(x.publisher_platforms) ? x.publisher_platforms : [];
  const textForAnalysis = [body, title, description].filter(Boolean).join("\n");
  const inferredVideo = /video|reel|movie/i.test(media) || !!videoUrl;
  return {
    library_id: id || null,
    page_name: page,
    body,
    title,
    description,
    snapshot_url: snapshot,
    video_url: videoUrl || null,
    media_type: inferredVideo ? "Vídeo" : (media ? media : "Não identificado"),
    is_active: typeof active === "boolean" ? active : null,
    start_date: start ? str(start, 80) : null,
    stop_date: stop ? str(stop, 80) : null,
    platforms,
    country: str(first(x.country, x.ad_reached_countries?.[0], "BR"), 20),
    text_for_analysis: textForAnalysis,
    raw_source: "Meta Ad Library via Apify",
    position: index,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const token = auth.replace(/^Bearer\s+/i, "");
    const { data: { user } } = await supa.auth.getUser(token);
    if (!user || user.email !== EMAIL_DONA) return json({ error: "Não autorizado." }, 401);

    const apify = Deno.env.get("APIFY_TOKEN") || "";
    if (!apify) return json({ error: "A busca precisa do segredo APIFY_TOKEN configurado no Supabase. Nenhum anúncio foi pesquisado." }, 503);

    const body = await req.json().catch(() => ({}));
    const query = str(body.query, 180);
    const country = str(body.country || "BR", 2).toUpperCase();
    const activeOnly = body.activeOnly !== false;
    const mediaType = body.mediaType === "video" ? "video" : "all";
    const maxResults = Math.max(5, Math.min(50, Number(body.maxResults) || 30));
    if (query.length < 2) return json({ error: "Digite uma marca, produto ou palavra-chave com pelo menos 2 caracteres." }, 400);
    if (!/^[A-Z]{2}$/.test(country)) return json({ error: "País inválido. Use um código de duas letras, como BR." }, 400);

    const libraryUrl = new URL("https://www.facebook.com/ads/library/");
    libraryUrl.searchParams.set("active_status", activeOnly ? "active" : "all");
    libraryUrl.searchParams.set("ad_type", "all");
    libraryUrl.searchParams.set("country", country);
    libraryUrl.searchParams.set("q", query);
    libraryUrl.searchParams.set("search_type", "keyword_unordered");
    libraryUrl.searchParams.set("media_type", mediaType);

    const actorUrl = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(apify)}&timeout=120&format=json&clean=true`;
    const response = await fetch(actorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        startUrls: [{ url: libraryUrl.toString() }],
        platforms: ["meta"],
        countries: [country],
        maxResultsPerPlatform: maxResults,
        activeOnly,
        includeDetails: false,
        strictMatch: true,
        proxy: "none",
      }),
      signal: AbortSignal.timeout(130_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = str(payload?.error?.message || payload?.message || payload?.error || "", 300);
      const hint = response.status === 402 ? "Os créditos do Apify acabaram." :
        response.status === 401 || response.status === 403 ? "O token do Apify não tem acesso a esse serviço." :
        response.status === 429 ? "O serviço de pesquisa está temporariamente limitado. Tente novamente mais tarde." :
        "O serviço de pesquisa não conseguiu concluir a consulta.";
      return json({ error: detail ? `${hint} Detalhe: ${detail}` : hint, provider_status: response.status }, 502);
    }
    const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : [];
    let ads = rows.map(normalizar).filter((a: any) => a.snapshot_url || a.library_id || a.body || a.title);
    if (mediaType === "video") {
      const video = ads.filter((a: any) => a.media_type === "Vídeo");
      if (video.length) ads = video;
    }
    return json({
      query, country, active_only: activeOnly, media_type_filter: mediaType,
      source: "Meta Ad Library via Apify", searched_at: new Date().toISOString(),
      result_count: ads.length, ads,
      notice: "Os dados refletem somente os campos disponibilizados pela Biblioteca de Anúncios. A análise audiovisual exige acesso ao vídeo ou uma transcrição.",
      library_search_url: libraryUrl.toString(),
    });
  } catch (error) {
    const message = String((error as Error)?.message || error);
    console.error("ci-ad-library:", message);
    return json({ error: /timed out|abort/i.test(message) ? "A pesquisa excedeu o tempo de espera. Tente novamente com outro termo ou menos resultados." : "Não foi possível concluir a pesquisa agora. Tente novamente em instantes." }, 502);
  }
});
