// =========================================================
// GERAR ROTEIRO (Edge Function do Supabase)
// Usada pelo aplicativo Gestão UGC (admin/gestao):
// - modo "ugc": cria roteiros UGC (hook, desenrolar, CTA) a partir da ideia dela (texto ou áudio já
//   transcrito), de imagens (produto, prints) e de um vídeo de referência; cada roteiro vem com tipo de
//   conteúdo UGC, tipo de funil, nicho, outras ideias de gancho e outros tipos de UGC
// - envio de áudio (multipart, campo "audio"): transcreve a ideia falada dela
// - { prompt }: modo antigo, texto livre
// Treino de estilo: o guia (tabela estilo_ugc) e exemplos reais (tabela estilo_videos, transcrições de
// 153 vídeos de Lara Dam e Isabelly Gervasio) entram no pedido para a IA escrever no mesmo tom delas.
// Pesquisa de produto: com "produtos" (o que ela tem), busca os produtos no Google pelo Apify (segredo APIFY_TOKEN;
// os buscadores bloqueiam servidor) e lê os links que ela colar. Sem Apify, tenta o Bing.
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
let modelosGroq: { texto: string; audio: string; visao: string } | null = null;
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
  // modelo que enxerga imagens (em out/2026 o Groq tem o Qwen 3.8; os Llama 4 foram aposentados)
  const visao = ["qwen/qwen3.8-27b", "meta-llama/llama-4-maverick-17b-128e-instruct", "meta-llama/llama-4-scout-17b-16e-instruct"].find((p) => ids.includes(p)) || ids.find((id) => /qwen3\.[5-9]|vision|llama-4|-vl/i.test(id)) || "qwen/qwen3.8-27b";
  console.log("Modelos do Groq em uso:", texto, audio, visao);
  if (ids.length) modelosGroq = { texto, audio, visao };
  return { texto, audio, visao };
}
// conversa com o Groq e devolve o texto da resposta (tenta de novo sem o modo JSON se o modelo não aceitar)
async function conversarGroq(chave: string, mensagens: unknown[], opcoes: { json?: boolean; temperatura?: number; max?: number; leve?: boolean } = {}) {
  const { texto: modelo } = await modelos(chave);
  const pedir = async (comJson: boolean) => fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: modelo, temperature: opcoes.temperatura ?? 0.2, ...(opcoes.max ? { max_tokens: opcoes.max } : {}), ...(opcoes.leve && /gpt-oss/.test(modelo) ? { reasoning_effort: "low" } : {}), ...(comJson ? { response_format: { type: "json_object" } } : {}), messages: mensagens }),
  });
  let r = await pedir(!!opcoes.json);
  let j = await r.json().catch(() => ({}));
  if (!r.ok && opcoes.json) { r = await pedir(false); j = await r.json().catch(() => ({})); }
  if (!r.ok) { if (r.status === 404 || /model/i.test(j?.error?.message || "")) modelosGroq = null; throw new Error(j?.error?.message || "Groq respondeu " + r.status); }
  return String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : {}; } };

const semTravessao = (t: unknown) => String(t ?? "").replace(/\s*—\s*/g, ", ").trim();
const txt = (x: unknown, n = 800) => semTravessao(x).slice(0, n);

// ---------- áudio: a ideia falada vira texto ----------
async function transcreverAudio(chave: string, arquivo: File) {
  if (arquivo.size > 25 * 1024 * 1024) throw new Error("O áudio é grande demais (máximo 25 MB).");
  const form = new FormData();
  form.append("file", arquivo, arquivo.name || "audio.webm");
  form.append("model", (await modelos(chave)).audio);
  form.append("language", "pt");
  form.append("response_format", "json");
  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "O limite grátis do Groq de hoje acabou. Tente mais tarde." : "Não consegui entender o áudio: " + (j?.error?.message || r.status));
  return String(j.text || "").trim();
}

// ---------- imagens: descreve o que aparece (produto, marca, texto) ----------
async function descreverImagens(chave: string, imagens: string[]) {
  const validas = imagens.filter((i) => /^data:image\/(png|jpe?g|webp);base64,/.test(i) && i.length < 3_500_000).slice(0, 4);
  if (!validas.length) return "";
  const { visao } = await modelos(chave);
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: visao, temperature: 0.2, max_tokens: 900, messages: [{ role: "user", content: [
      { type: "text", text: "Descreva em português, em tópicos curtos, o que aparece nestas imagens para uma criadora de UGC fazer um roteiro: produto, marca, embalagem, cores, textos escritos, ambiente e qualquer ideia ou anotação visível. Seja objetiva." },
      ...validas.map((url) => ({ type: "image_url", image_url: { url } })),
    ] }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("Visão falhou:", j?.error?.message); return ""; }
  return String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

// ---------- pesquisa dos produtos dela (Google pelo Apify, Bing de reserva e links que ela colar) ----------
const NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const limparHtml = (h: string) => h.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&nbsp;|&ensp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
async function abrir(url: string, ms = 6000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { headers: { "User-Agent": NAVEGADOR, "Accept-Language": "pt-BR,pt;q=0.9" }, redirect: "follow", signal: ctl.signal }); } finally { clearTimeout(t); }
}
async function buscarBing(termo: string) {
  try {
    const html = await (await abrir("https://www.bing.com/search?setlang=pt-BR&cc=BR&q=" + encodeURIComponent(termo))).text();
    return html.split('<li class="b_algo"').slice(1, 6).map((b) => {
      const titulo = limparHtml(b.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] || "");
      const trecho = limparHtml(b.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] || "");
      return titulo || trecho ? `- ${titulo}: ${trecho}` : "";
    }).filter(Boolean).join("\n").slice(0, 900);
  } catch { return ""; }
}
async function lerPagina(url: string) {
  try {
    const html = (await (await abrir(url)).text()).slice(0, 400000);
    const meta = (p: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, "i"))?.[1] || "";
    const titulo = limparHtml(meta("og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const desc = limparHtml(meta("og:description") || meta("description"));
    const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join(" ");
    const descLd = limparHtml(ld.match(/"description"\s*:\s*"([^"]{20,1500})"/)?.[1] || "");
    const preco = ld.match(/"price"\s*:\s*"?([\d.,]+)/)?.[1] || "";
    return `- ${titulo}${preco ? " (preço R$ " + preco + ")" : ""}: ${desc} ${descLd}`.slice(0, 900);
  } catch { return ""; }
}
// Google pelo Apify: um run só para todos os produtos (uns 25 segundos)
async function buscarGoogle(nomes: string[]) {
  const token = Deno.env.get("APIFY_TOKEN") || "";
  if (!token) return null;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 55000);
    const r = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${token}&timeout=50`, { method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ queries: nomes.join("\n"), countryCode: "br", languageCode: "pt-BR", searchLanguage: "pt", resultsPerPage: 10, maxPagesPerQuery: 1 }) });
    clearTimeout(t);
    const itens = await r.json().catch(() => null);
    if (!Array.isArray(itens) || !itens.length) return null;
    return itens.map((it: any) => {
      const ia = it.aiOverview?.content ? limparHtml(String(it.aiOverview.content)).slice(0, 700) : "";
      const org = (it.organicResults || []).filter((o: any) => !/instagram\.com|tiktok\.com|youtube\.com/.test(o.url || "")).slice(0, 4)
        .map((o: any) => `- ${limparHtml(String(o.title || ""))}: ${limparHtml(String(o.description || ""))}`).join("\n");
      return `Sobre "${it.searchQuery?.term || ""}":\n${ia ? "Resumo do Google: " + ia + "\n" : ""}${org}`.slice(0, 1300);
    }).join("\n");
  } catch { return null; }
}
async function pesquisarProdutos(texto: string) {
  const links = [...new Set((texto.match(/https?:\/\/[^\s)]+/g) || []))].slice(0, 2);
  const nomes = texto.replace(/https?:\/\/[^\s)]+/g, " ").split(/\n|;/).map((l) => l.split(/[(:]| - /)[0].trim()).filter((l) => l.length > 3 && l.length < 90).slice(0, 3);
  const [paginas, google] = await Promise.all([Promise.all(links.map(lerPagina)), nomes.length ? buscarGoogle(nomes) : Promise.resolve("")]);
  const busca = google !== null ? google : (await Promise.all(nomes.map(async (n) => { const r = await buscarBing(n); return r ? `Sobre "${n}":\n${r}` : ""; }))).join("\n");
  return [...paginas, busca].filter(Boolean).join("\n").slice(0, 2400);
}

// ---------- treino de estilo (guia + exemplos reais das criadoras referência) ----------
const CATEGORIAS: Record<string, string[]> = { beleza: ["beleza"], autocuidado: ["beleza", "saude"], casa: ["casa"], moda: ["moda"], "alimentação": ["food", "gastronomia"], alimentos: ["food", "gastronomia"],
  "life fit": ["saude", "food"], fitness: ["saude"], maternidade: ["casa", "outro"], pet: ["casa", "outro"], "eletrônicos": ["tech"], infantil: ["casa", "outro"] };
async function estilo(supa: any, nicho: string, curto: boolean) {
  try {
    const { data: g } = await supa.from("estilo_ugc").select("guia").eq("id", 1).maybeSingle();
    const cats = CATEGORIAS[String(nicho || "").toLowerCase()] || [];
    let q = supa.from("estilo_videos").select("transcricao, criadora, marca").neq("categoria", "depoimento").limit(40);
    if (cats.length) q = q.in("categoria", cats);
    const { data: vids } = await q;
    const lista = (vids || []).filter((v: any) => String(v.transcricao || "").length > 200).sort(() => Math.random() - 0.5).slice(0, 1);
    const exemplos = lista.map((v: any, i: number) => `Exemplo ${i + 1} (${v.criadora === "laradam" ? "Lara Dam" : "Isabelly Gervasio"}${v.marca ? ", " + v.marca : ""}): "${String(v.transcricao).replace(/\[música\]|Música/gi, "").replace(/\s+/g, " ").trim().slice(0, curto ? 400 : 600)}"`).join("\n");
    return { guia: String(g?.guia || "").slice(0, curto ? 2200 : 5000), exemplos };
  } catch { return { guia: "", exemplos: "" }; }
}

const GANCHOS = `1. Problema / Identificação: gera conexão com quem assiste.
2. Antes e depois: mostra contraste e resultado.
3. Promessa: abre com o que mais chama atenção.
4. Comparativo: "testei", "antes vs depois".
5. Lista / Curiosidade: gera valor e mantém o público assistindo.
6. Opinião forte: quebra o padrão do feed.
7. Objeção: contorna dúvidas sem parecer venda.
8. Prova / Depoimento: parece natural e espontâneo.
9. Urgência: cria aquele "quero agora".`;
const TIPOS_UGC = "Review sincero, Unboxing, Tutorial ou passo a passo, Antes e depois, Problema e solução, Rotina (arrume-se comigo), POV, Comparativo, Mitos e verdades, Lista, Reação, Produto no dia a dia, Falando para a câmera, Teste ou desafio, Storytelling, ASMR, Bastidores";

async function roteirosUgc(chave: string, c: any, supa: any, curto = false): Promise<any> {
  const ref = c.referencia || null;
  const qtd = Math.min(3, Math.max(1, Number(c.quantidade) || 2));
  if (qtd === 3) curto = true; // 3 roteiros ocupam mais espaço na resposta: manda o guia mais curto
  const imagens = Array.isArray(c.imagens) ? c.imagens.map(String) : [];
  const [descricao, pesquisa, est] = await Promise.all([
    c._descricao !== undefined ? c._descricao : imagens.length ? descreverImagens(chave, imagens) : "",
    c._pesquisa !== undefined ? c._pesquisa : c.produtos ? pesquisarProdutos(String(c.produtos)) : "",
    estilo(supa, c.nicho, curto),
  ]);
  const pedido = `Você é roteirista de UGC de uma criadora brasileira que é contratada por marcas para produzir vídeos curtos (Reels, TikTok e Stories).
Todo roteiro precisa passar em dois testes ao mesmo tempo:
1) Para o scroll de quem não a segue (hook forte nos primeiros 1 a 3 segundos, nunca começa explicando o produto).
2) Teste do anúncio: se uma marca cortasse o vídeo e postasse como anúncio pago, funcionaria sem mudar o roteiro. O produto aparece em cena (na mão, embalagem visível, uso real), o benefício é específico (de preferência com número, tempo ou resultado) e o CTA é para quem compraria o produto. Nunca misture CTA de compra com "marcas, me contratem". Espontâneo, com cara de conteúdo real, mas com estrutura de venda por trás.

ESTRUTURA OBRIGATÓRIA de cada roteiro: HOOK (forte, faz parar de rolar) → DESENROLAR (entrega o que o hook prometeu, mostra o produto em uso e transforma em benefício) → CTA (ação clara, nunca termina em "e foi isso").

Tipos de gancho que ela usa (escolha um para cada roteiro e varie entre os roteiros):
${GANCHOS}

Tipos de conteúdo UGC: ${TIPOS_UGC}.
Tipos de funil: Topo de funil (descoberta, atrai quem não conhece), Meio de funil (consideração, educa e tira dúvidas), Fundo de funil (conversão, leva a comprar).

${est.guia ? "COMO ESCREVER (guia de estilo tirado do estudo dos vídeos de Lara Dam e Isabelly Gervasio, as referências de UGC que ela admira; escreva no mesmo tom e nível delas, sem copiar frases inteiras):\n" + est.guia : ""}
${est.exemplos ? "TRANSCRIÇÕES REAIS DELAS PARA SENTIR O TOM:\n" + est.exemplos : ""}

O QUE ELA QUER
${c.produtos ? "Produtos que ela tem e informações dela (use os produtos dela, com nome, e as experiências reais que ela contar): " + txt(c.produtos, 1500) : ""}
${pesquisa ? "O QUE ENCONTREI NA INTERNET SOBRE OS PRODUTOS (use só o que for coerente; não invente números, preços ou ativos que não estejam aqui ou no que ela contou):\n" + pesquisa : ""}
Ideia dela: ${txt(c.ideia, 3000) || "não escreveu, use as outras informações"}
Produto ou marca: ${txt(c.produto, 200) || "não informado (pode ser um produto genérico do nicho)"}
Nicho: ${txt(c.nicho, 80) || "escolha o que mais combina"}
Tipo de UGC desejado: ${txt(c.tipo, 80) || "escolha o melhor"}
Funil desejado: ${txt(c.funil, 40) || "escolha o melhor"}
Plataforma: ${txt(c.plataforma, 40) || "Reels"}
${descricao ? "O que aparece nas imagens que ela mandou:\n" + descricao : ""}
${ref ? `VÍDEO DE REFERÊNCIA (de outra criadora; crie algo parecido no estilo e na estrutura, sem copiar as falas)
Gancho: "${txt(ref.gancho, 400)}" (tipo ${txt(ref.gancho_tipo, 40)})
Estrutura: ${txt(String(ref.desenvolvimento || "").replace(/\n/g, " / "), 800)}
CTA: "${txt(ref.cta, 300)}"
Por que prende: ${txt(ref.por_que, 400)}
Transcrição: ${txt(ref.transcricao, curto ? 900 : 1500)}` : ""}
${c.ajuste ? "AJUSTE PEDIDO POR ELA: " + txt(c.ajuste, 600) : ""}
${Array.isArray(c.anteriores) && c.anteriores.length ? "Não repita estes hooks que já foram sugeridos: " + c.anteriores.map((x: unknown) => `"${txt(x, 160)}"`).join("; ") : ""}

Crie ${qtd} roteiro(s) diferentes entre si. Responda SOMENTE um JSON assim:
{"roteiros":[{"titulo":"até 6 palavras","tipo_ugc":"um dos tipos de UGC","funil":"Topo de funil | Meio de funil | Fundo de funil","funil_por_que":"1 frase","nicho":"nicho","formato":"ex.: Reels 30s, falando para a câmera","gancho_tipo":"um dos 9 tipos de gancho","hook":{"fala":"fala ou texto na tela","visual":"o que a câmera mostra"},"desenrolar":[{"fala":"...","visual":"..."}],"cta":{"fala":"...","visual":"..."},"legenda":"legenda curta","hashtags":"#... #...","por_que_funciona":"1 a 2 frases","outros_ganchos":[{"tipo":"um dos 9 tipos","texto":"outro hook pronto para a mesma ideia"}],"outros_tipos_ugc":[{"tipo":"outro tipo de UGC","ideia":"como essa ideia ficaria nesse formato"}]}]}
Regras: português do Brasil, frases faladas naturais e curtas, 3 a 5 passos no desenrolar, 3 itens em outros_ganchos (tipos diferentes do usado), 2 itens em outros_tipos_ugc, nunca use travessão (—).
NUNCA invente números, porcentagens, prazos ou resultados ("40% mais brilho", "dura 48h"). Use só números que ela contou ou que aparecem na pesquisa acima; sem número confiável, use o tempo de uso dela e detalhes que dá para ver e sentir (textura, cheiro, toque, antes e depois na câmera).
Não invente cupom, desconto, frete grátis ou preço: se ela não contou e a pesquisa não mostrou, faça o CTA sem oferta (ex.: "o link tá aqui embaixo", "salva pra lembrar").
gancho_tipo deve ser exatamente um destes nomes: Problema / Identificação, Antes e depois, Promessa, Comparativo, Lista / Curiosidade, Opinião forte, Objeção, Prova / Depoimento, Urgência.`;
  let saida = "";
  try { saida = await conversarGroq(chave, [{ role: "user", content: pedido }], { json: true, temperatura: 0.8, max: qtd === 3 ? 3800 : 3000, leve: true }); }
  catch (e) {
    // o plano grátis do Groq limita o tamanho do pedido: tenta de novo com menos exemplos
    if (!c._curto && /too large|tokens per minute|TPM|413/i.test(String((e as Error).message))) return roteirosUgc(chave, { ...c, _curto: true, quantidade: Math.min(qtd, 2), _descricao: descricao, _pesquisa: pesquisa.slice(0, 900) }, supa, true);
    throw e;
  }
  const j = lerJson(saida);
  const parte = (p: any) => ({ fala: txt(p?.fala, 500), visual: txt(p?.visual, 300) });
  const roteiros = (Array.isArray(j.roteiros) ? j.roteiros : []).slice(0, qtd).map((r: any) => ({
    titulo: txt(r.titulo, 60) || "Roteiro UGC", tipo_ugc: txt(r.tipo_ugc, 60), funil: txt(r.funil, 30), funil_por_que: txt(r.funil_por_que, 200),
    nicho: txt(r.nicho, 40), formato: txt(r.formato, 80), gancho_tipo: txt(r.gancho_tipo, 40), hook: parte(r.hook),
    desenrolar: (Array.isArray(r.desenrolar) ? r.desenrolar : []).slice(0, 7).map(parte).filter((p: any) => p.fala || p.visual),
    cta: parte(r.cta), legenda: txt(r.legenda, 600), hashtags: txt(r.hashtags, 300), por_que_funciona: txt(r.por_que_funciona, 400),
    outros_ganchos: (Array.isArray(r.outros_ganchos) ? r.outros_ganchos : []).slice(0, 4).map((g: any) => ({ tipo: txt(g?.tipo, 40), texto: txt(g?.texto, 300) })).filter((g: any) => g.texto),
    outros_tipos_ugc: (Array.isArray(r.outros_tipos_ugc) ? r.outros_tipos_ugc : []).slice(0, 3).map((g: any) => ({ tipo: txt(g?.tipo, 40), ideia: txt(g?.ideia, 300) })).filter((g: any) => g.tipo),
  })).filter((r: any) => r.hook.fala);
  return { roteiros, viuImagens: !!descricao, pesquisa: pesquisa || "" };
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
      const arquivo = form.get("audio");
      if (!(arquivo instanceof File)) return resposta({ error: "Nenhum áudio foi enviado." }, 400);
      try { return resposta({ texto: semTravessao(await transcreverAudio(chave, arquivo)) }); }
      catch (e) { return resposta({ error: String((e as Error).message) }, 422); }
    }
    const corpo = await req.json().catch(() => ({}));
    if (corpo.modo === "ugc") {
      try { return resposta(await roteirosUgc(chave, corpo, supa)); }
      catch (e) { console.error(e); return resposta({ error: "Não consegui criar os roteiros agora. Tente de novo em instantes." }, 502); }
    }
    const { prompt } = corpo;
    if (!prompt) return resposta({ error: "Prompt ausente" }, 400);

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
