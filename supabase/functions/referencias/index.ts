// =========================================================
// REFERÊNCIAS (Edge Function do Supabase)
// Usada pela Central de Referências (aba Roteiros do painel):
// - { acao: "analise", referencia }: panorama, por que chama atenção, pontos fortes, desenvolvimento
//   do vídeo com os tempos e o que dá para melhorar. Desde nov/2026 (pedido da Mari) a referência
//   pode vir com "cenas" [{ini, fim, imagem}] (um quadro de cada cena, tirado no navegador) e "voz"
//   (ritmo, pausas, tom e energia medidos no navegador): o modelo de visão descreve cada cena e a
//   análise passa a falar do que aparece e de como a voz é usada, cena por cena.
// - { acao: "video", link, id }: baixa o vídeo de um link do Instagram (ou TikTok) pelo Apify e guarda
//   no bucket "videos" (pasta transcricoes/), ligado à linha de roteiros, para o painel poder ver as cenas
// - { acao: "ideias", referencia, produto, objetivo, nicho, formato, tom, material }: ideias de vídeos
//   novos da Mari usando o que funcionou na referência, mais ganchos alternativos
// - { acao: "post", link }: dados de um post do Instagram (legenda, tipo, perfil, capa) pelo Apify (segredo APIFY_TOKEN)
// - { acao: "laboratorio", post }: transforma um post salvo (legenda + transcrição) numa ideia de conteúdo dela
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

// ---------- cenas e voz ----------
const GROQ = "https://api.groq.com/openai/v1";
let visaoCache: string | null | undefined;
async function modeloVisao(chave: string) {
  if (visaoCache !== undefined) return visaoCache;
  try {
    const j = await (await fetch(`${GROQ}/models`, { headers: { Authorization: `Bearer ${chave}` } })).json();
    const ids: string[] = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id));
    const pref = [/qwen3\.[5-9]/i, /llama-4-maverick/i, /llama-4-scout/i, /llama-4/i, /vision/i, /(^|[-_/])vl([-_]|$)|qwen.*vl/i, /pixtral|gemma-3|kimi.*vl/i];
    visaoCache = null;
    const px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    for (const p of pref) for (const id of ids.filter((x) => p.test(x))) {
      const t = await fetch(`${GROQ}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: id, max_tokens: 5, messages: [{ role: "user", content: [{ type: "text", text: "Cor?" }, { type: "image_url", image_url: { url: px } }] }] }) });
      if (t.ok) { visaoCache = id; return visaoCache; }
    }
  } catch { visaoCache = null; }
  return visaoCache;
}
const imagemOk = (i: unknown) => /^data:image\/(png|jpe?g|webp);base64,/.test(String(i || "")) && String(i).length < 400_000;
// o modelo de visão descreve cada cena (lotes de 4 quadros)
async function descreverCenas(chave: string, cenas: any[]) {
  const visao = await modeloVisao(chave);
  const saida: any[] = cenas.map(() => ({}));
  if (!visao) return { lidas: saida, visao: false };
  for (let i = 0; i < cenas.length; i += 4) {
    const lote = cenas.slice(i, i + 4);
    const pedido = `Estes são ${lote.length} quadros de cenas seguidas de um Reels de UGC (um quadro por cena, na ordem). Para cada quadro, descreva em português do Brasil, curto e concreto, o que se VÊ (nada de supor o que não aparece).
Responda SOMENTE um JSON: {"cenas":[{"n":1,"enquadramento":"close no rosto | plano médio | detalhe do produto | mãos | tela do celular | ambiente","visual":"o que acontece: quem aparece, o que faz, produto, cenário, luz, expressão (1 frase)","texto_tela":"texto escrito na tela, se tiver, senão vazio"}]}
${lote.map((c, k) => `Quadro ${k + 1}: cena de ${mmss(Number(c.ini) || 0)} a ${mmss(Number(c.fim) || 0)}`).join("\n")}`;
    try {
      const pedir = () => fetch(`${GROQ}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: visao, temperature: 0.2, max_tokens: 900, messages: [{ role: "user", content: [{ type: "text", text: pedido }, ...lote.map((c) => ({ type: "image_url", image_url: { url: c.imagem } }))] }] }) });
      let r = await pedir();
      if (r.status === 429) { await esperar(8000); r = await pedir(); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) continue;
      const lido = lerJson(String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, ""));
      (Array.isArray(lido.cenas) ? lido.cenas : []).forEach((d: any, k: number) => {
        const idx = i + (Number(d.n) >= 1 && Number(d.n) <= lote.length ? Number(d.n) - 1 : k);
        if (idx < saida.length) saida[idx] = { enquadramento: txt(d.enquadramento, 60), visual: txt(d.visual, 260), texto_tela: txt(d.texto_tela, 160) };
      });
    } catch { /* segue com as outras */ }
  }
  return { lidas: saida, visao: true };
}
function falaEntre(ref: any, ini: number, fim: number) {
  const segs = Array.isArray(ref.segmentos) ? ref.segmentos : [];
  return segs.filter((s: any, i: number) => { const a = Number(s.ini) || 0; const b = Number(segs[i + 1]?.ini ?? a + 3); return a < fim && b > ini; }).map((s: any) => txt(s.texto, 200)).join(" ").slice(0, 260);
}
function textoVoz(v: any) {
  if (!v || typeof v !== "object") return "";
  const l: string[] = [];
  if (v.palavrasPorSeg) l.push(`Ritmo médio: ${v.palavrasPorSeg} palavras por segundo (média de creator: 2,75; rápida: 3,7)`);
  if (v.ritmoGancho) l.push(`Ritmo nos 3 primeiros segundos: ${v.ritmoGancho} palavras por segundo`);
  if (v.primeiraFala != null) l.push(`A primeira fala começa em ${v.primeiraFala} s`);
  if (v.pausas != null) l.push(`Pausas de mais de 0,4 s: ${v.pausas} (a maior com ${v.maiorPausa || 0} s); ${v.falaPct ?? "?"}% do vídeo com voz`);
  if (v.tomHz) l.push(`Tom médio da voz: ${v.tomHz} Hz; variação de tom: ${v.variacaoTom} semitons (até 3 = monótona, 4 a 7 = expressiva, acima de 8 = bem animada)`);
  if (v.variacaoVolume != null) l.push(`Variação de volume na fala: ${v.variacaoVolume} dB (até 4 = bem constante; acima de 8 = muda bastante)`);
  if (v.somDeFundo) l.push(`Som nos trechos sem fala: ${v.somDeFundo}`);
  if (Array.isArray(v.trechos) && v.trechos.length) l.push("Por cena (tempo, palavras por segundo, energia de 0 a 100): " + v.trechos.slice(0, 16).map((t: any) => `${mmss(Number(t.ini) || 0)} ${t.pps ?? "-"} pal/s energia ${t.energia ?? "-"}`).join("; "));
  return l.join("\n").slice(0, 1800);
}

async function analise(chave: string, ref: any) {
  const temTempo = Array.isArray(ref.segmentos) && ref.segmentos.length;
  const cenasIn = (Array.isArray(ref.cenas) ? ref.cenas : []).filter((c: any) => imagemOk(c.imagem)).slice(0, 14);
  const { lidas, visao } = cenasIn.length ? await descreverCenas(chave, cenasIn) : { lidas: [], visao: false };
  const cenasTxt = cenasIn.map((c: any, i: number) => {
    const d = lidas[i] || {};
    return `Cena ${i + 1} [${mmss(Number(c.ini) || 0)} a ${mmss(Number(c.fim) || 0)}]${d.enquadramento ? " " + d.enquadramento + ":" : ""} ${d.visual || "(sem descrição)"}${d.texto_tela ? ` | texto na tela: "${d.texto_tela}"` : ""}${falaEntre(ref, Number(c.ini) || 0, Number(c.fim) || 0) ? ` | fala: "${falaEntre(ref, Number(c.ini) || 0, Number(c.fim) || 0)}"` : ""}`;
  }).join("\n").slice(0, 4200);
  const voz = textoVoz(ref.voz);
  const comCenas = cenasIn.length > 0, comVoz = Boolean(voz);
  const pedido = `Você analisa vídeos curtos de UGC (Reels, TikTok) para uma criadora brasileira que é contratada por marcas.
Analise o vídeo de referência abaixo${comCenas ? " olhando TODAS as cenas (o que aparece em cada uma)" : ""}${comVoz ? " e a VOZ (ritmo, pausas, tom, energia)" : ""}, não só o texto falado. Responda SOMENTE um JSON:
{"panorama":"2 frases: o que a criadora faz no vídeo e qual a abordagem${comCenas ? ", incluindo como é filmado" : ""}",
"motivos":["por que esse vídeo chama atenção, 3 a 5 itens curtos${comCenas || comVoz ? " (considere imagem e voz, não só a fala)" : ""}"],
"pontos_fortes":["o que ele faz bem, 3 a 6 itens curtos"],
"desenvolvimento":[{"ini":"00:00","fim":"00:03","parte":"Hook | Contexto | Desenvolvimento | Prova | CTA","texto":"o que acontece nesse trecho (fala e imagem), 1 frase"}],
${comCenas ? `"cenas":[{"n":1,"funcao":"Hook | Contexto | Demonstração | Prova | Resultado | CTA | B-roll","por_que":"por que essa cena está ali e o que ela faz pelo vídeo (1 frase)","dica":"como ela pode gravar uma cena assim (1 frase curta)"}],
"visual":["o que a filmagem faz de bom: enquadramentos, troca de cena, produto em uso, luz, texto na tela, 2 a 4 itens"],` : ""}
${comVoz ? `"voz":{"resumo":"1 a 2 frases: como a voz é usada (ritmo, tom, energia) e o efeito disso","ritmo":"1 frase sobre a velocidade e se muda no gancho","entonacao":"1 frase sobre o tom: monótono ou expressivo, onde sobe","pausas":"1 frase sobre as pausas e respiros","dicas":["como ela pode usar a voz igual na versão dela, 2 a 3 itens"]},` : ""}
"melhorar":["o que daria para fazer melhor na versão dela, 2 a 3 itens"]}
Regras: português do Brasil, frases curtas e concretas, tiradas do vídeo (nada genérico que serviria para qualquer vídeo). Use os números da voz para falar dela, mas em linguagem simples (sem Hz nem dB na resposta). ${comCenas ? `O array "cenas" tem exatamente ${cenasIn.length} itens, um para cada cena listada, na mesma ordem. ` : ""}${temTempo ? "Use os tempos da transcrição para o desenvolvimento." : "A transcrição não tem tempos: estime os tempos pela ordem das falas (uns 2,75 palavras por segundo)."} Nunca use travessão (—).

${ref.duracao ? `Duração do vídeo: ${ref.duracao} segundos.` : ""}
${ref.titulo ? `Título: ${txt(ref.titulo, 120)}` : ""}
${comCenas ? `CENAS DO VÍDEO (${cenasIn.length}, descritas pelo que aparece no quadro de cada uma):\n${cenasTxt}\n` : ""}
${comVoz ? `VOZ (medida no áudio do vídeo):\n${voz}\n` : ""}
Transcrição:
${transcricaoComTempo(ref).slice(0, comCenas ? 3500 : 6000)}`;
  const j = await perguntar(chave, pedido, comCenas || comVoz ? 3800 : 3000);
  const cenasIA = Array.isArray(j.cenas) ? j.cenas : [];
  const v = j.voz && typeof j.voz === "object" ? j.voz : null;
  return {
    panorama: txt(j.panorama, 600), motivos: lista(j.motivos, 6), pontos_fortes: lista(j.pontos_fortes, 7), melhorar: lista(j.melhorar, 4),
    desenvolvimento: (Array.isArray(j.desenvolvimento) ? j.desenvolvimento : []).slice(0, 10).map((d: any) => ({ ini: txt(d.ini, 8), fim: txt(d.fim, 8), parte: txt(d.parte, 30), texto: txt(d.texto, 300) })).filter((d: any) => d.texto),
    cenas: cenasIn.map((c: any, i: number) => {
      const ia = cenasIA.find((x: any) => Number(x.n) === i + 1) || cenasIA[i] || {};
      const d = lidas[i] || {};
      return { ini: Number(c.ini) || 0, fim: Number(c.fim) || 0, enquadramento: d.enquadramento || "", visual: d.visual || "", texto_tela: d.texto_tela || "",
        fala: falaEntre(ref, Number(c.ini) || 0, Number(c.fim) || 0), funcao: txt(ia.funcao, 30), por_que: txt(ia.por_que, 300), dica: txt(ia.dica, 240) };
    }),
    visual: lista(j.visual, 5),
    voz: v ? { resumo: txt(v.resumo, 400), ritmo: txt(v.ritmo, 260), entonacao: txt(v.entonacao, 260), pausas: txt(v.pausas, 260), dicas: lista(v.dicas, 4), medidas: ref.voz || null } : (ref.voz ? { medidas: ref.voz } : null),
    viuCenas: comCenas, ouviuVoz: comVoz, semVisao: comCenas && !visao,
    feitaEm: new Date().toISOString(),
  };
}

// ---------- baixar o vídeo de um link (para ver as cenas) ----------
async function apify(ator: string, entrada: unknown) {
  const token = Deno.env.get("APIFY_TOKEN") || "";
  if (!token) throw new Error("Falta o APIFY_TOKEN no Supabase.");
  const r = await fetch(`https://api.apify.com/v2/acts/${ator}/run-sync-get-dataset-items?token=${token}&timeout=110`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entrada) });
  if (!r.ok) throw new Error(r.status === 402 ? "Os créditos do Apify deste mês acabaram." : "Não consegui ler esse post agora.");
  const itens = await r.json().catch(() => []);
  return Array.isArray(itens) ? itens.find((x: any) => x && !x.error) : null;
}
async function videoDoLink(supa: any, link: string, id: unknown) {
  if (!/^https?:\/\//i.test(link)) throw new Error("Essa referência não tem link de vídeo.");
  let url = "";
  if (/instagram\.com/i.test(link)) {
    const p = await apify("apify~instagram-scraper", { directUrls: [link], resultsType: "posts", resultsLimit: 1, addParentData: false });
    url = p?.videoUrl || "";
  } else if (/tiktok\.com/i.test(link)) {
    const p = await apify("clockworks~tiktok-scraper", { postURLs: [link], resultsPerPage: 1, shouldDownloadVideos: true, shouldDownloadCovers: false });
    url = (Array.isArray(p?.mediaUrls) && p.mediaUrls[0]) || p?.videoMeta?.downloadAddr || "";
  } else throw new Error("Por enquanto o painel baixa o vídeo só de links do Instagram e do TikTok.");
  if (!url) throw new Error("Não achei o arquivo de vídeo nesse post.");
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("A rede social não deixou baixar o vídeo agora.");
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length < 20_000) throw new Error("O vídeo baixado veio vazio.");
  if (buf.length > 50 * 1024 * 1024) throw new Error("Esse vídeo passa de 50 MB, o limite para guardar no painel.");
  const path = `transcricoes/${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}-link.mp4`;
  const { error } = await supa.storage.from("videos").upload(path, buf, { contentType: "video/mp4", upsert: false });
  if (error) throw new Error(/exceed|size/i.test(error.message || "") ? "O espaço do painel para vídeos encheu (1 GB do plano grátis)." : "Não consegui guardar o vídeo: " + error.message);
  if (id) await supa.from("roteiros").update({ video_path: path, video_tamanho: buf.length }).eq("id", id);
  return { path, tamanho: buf.length };
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

// ---------- Laboratório criativo ----------
async function postInstagram(link: string) {
  const token = Deno.env.get("APIFY_TOKEN") || "";
  if (!token) throw new Error("Falta o APIFY_TOKEN no Supabase.");
  const r = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}&timeout=90`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directUrls: [link], resultsType: "posts", resultsLimit: 1, addParentData: false }),
  });
  if (!r.ok) throw new Error(r.status === 402 ? "Os créditos do Apify deste mês acabaram." : "Não consegui ler esse post agora.");
  const itens = await r.json().catch(() => []);
  const p = Array.isArray(itens) ? itens.find((x: any) => x && !x.error) : null;
  if (!p) throw new Error("O Instagram não mostrou esse post (pode ser privado ou ter sido apagado).");
  const tipo = p.type === "Video" || p.productType === "clips" ? "Reel" : p.type === "Sidecar" ? "Carrossel" : "Post";
  return { perfil: p.ownerUsername || null, tipo, legenda: txt(p.caption, 4000) || null, capa: p.displayUrl || null, video: p.videoUrl || null, data: p.timestamp || null };
}
async function ideiaDoPost(chave: string, post: any, supa: any) {
  let metodo = "";
  try { const { data } = await supa.from("estilo_ugc").select("metodo").eq("id", 1).maybeSingle(); metodo = String(data?.metodo || "").slice(0, 1200); } catch { /* sem método */ }
  const pedido = `Você ajuda uma criadora brasileira de UGC (contratada por marcas para fazer vídeos) a transformar posts que ela salvou no Instagram em ideias de conteúdo próprias.

POST SALVO (${txt(post.tipo, 20) || "post"} de @${txt(post.perfil, 60) || "alguém"})
Legenda: ${txt(post.legenda, 1500) || "sem legenda"}
O que a pessoa fala no vídeo: ${txt(post.transcricao, 2500) || "sem fala (carrossel, foto ou vídeo só com música)"}
${metodo ? "\n" + metodo : ""}

Responda SOMENTE um JSON:
{"tema":"até 4 palavras","formato":"ex.: Review, Tutorial, Lista, Storytelling, Opinião, Antes e depois, Bastidores","gancho_original":"a primeira frase ou ideia que prende no post (curta)","por_que_funciona":"1 frase: o que faz esse post chamar atenção",
"ideia":{"titulo":"até 7 palavras","descricao":"2 frases: o vídeo que ELA faria usando o que funciona no post, aplicado a UGC ou a um produto do nicho dela","gancho":"a primeira frase do vídeo dela, pronta para falar"}}
Português do Brasil. Nunca invente número, prazo ou resultado. Ganchos proibidos: começar com "Você já...", "Você sabia...", "Sabia que...", "Descobri...", "Cansada de...", "Chega de...". Nunca use travessão.`;
  const j = await perguntar(chave, pedido, 1500);
  const i = j.ideia || {};
  const g = txt(i.gancho, 300);
  return { tema: txt(j.tema, 60), formato: txt(j.formato, 60), gancho_original: txt(j.gancho_original, 300), por_que_funciona: txt(j.por_que_funciona, 400),
    ideia: { titulo: txt(i.titulo, 90), descricao: txt(i.descricao, 600), gancho: ruim(g) || PRAZO.test(g) ? "" : g } };
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
    if (corpo.acao === "post") return resposta(await postInstagram(String(corpo.link || "")));
    if (corpo.acao === "laboratorio") return resposta(await ideiaDoPost(chave, corpo.post || {}, supa));
    if (corpo.acao === "video") return resposta(await videoDoLink(supa, String(corpo.link || ""), corpo.id));
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
