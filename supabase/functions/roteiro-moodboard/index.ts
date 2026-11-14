// =========================================================
// ROTEIRO E MOODBOARD (Edge Function do Supabase), nov/2026, pedido da Mari
// Aba Marcas e jobs > Roteiros e Moodboard (js/moodboard.js). Segue o prompt que ela mandou:
// a partir do briefing, entrega (1) o ROTEIRO cena a cena em espelho (ÁUDIO/fala | IMAGEM/direção),
// nos 7 blocos dela, e (2) o conteúdo do MOOD BOARD (identidade da marca, paleta, conceito,
// diferenciais, referência de gancho, direção de arte) + lista de pendências.
// O desenho do mood board (PNG e PDF) é feito no navegador com as fotos dela.
// Ações:
//   site  { url }  -> lê o site da marca: título, descrição, cor do tema, texto e a imagem principal
//   gerar { briefing, paleta[], imagens[{tipo, url(dataURL)}], referencia{titulo, transcricao, analise} }
// As regras de linguagem são as da Skill UGC (sem travessão, sem construção banida, nunca inventar dado).
// Chave do Groq só no segredo GROQ_API_KEY. Só a dona do painel pode usar (função e_a_dona() do banco).
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class Limite extends Error {}
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const semTravessao = (t: unknown) => String(t ?? "").replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",").trim();
const txt = (x: unknown, n = 800) => semTravessao(typeof x === "string" || typeof x === "number" ? x : "").slice(0, n);
const lista = (x: unknown, n = 12, tam = 300) => (Array.isArray(x) ? x : x ? [x] : []).map((i) => txt(typeof i === "string" ? i : (i?.texto || i?.item || ""), tam)).filter(Boolean).slice(0, n);
const HEX = /^#[0-9a-f]{6}$/i;

// mesmas travas da Skill UGC (supabase/functions/skill-ugc)
const FRASE_PROIBIDA = /\bn[aã]o [eé] (s[oó] |sobre |isso|apenas )[^.!?]{0,60}, [eé] |o problema n[aã]o [eé]|a[ií] eu (descobri|conheci)|hoje eu descobri|foi a[ií] que|foi quando|[eé] o tipo de|voc[eê] j[aá] reparou|voc[eê] sabia que|e sinceramente\?|isso muda (tudo|o jogo)|ol[aá],? pessoal|hoje vou falar sobre|queria compartilhar com voc[eê]s|hoje vim indicar|tem produtos? que|se voc[eê] ainda t[aá] no ciclo|at[eé] que (eu )?(descobri|conheci|encontrei)|de um lado[^.!?]{0,60}do outro|n[aã]o [eé] [^.!?,]{1,40}, [eé] [^.!?]{1,40}|\bdescobri (o|a|os|as|esse|essa|este|esta|um|uma)\b|\b(a[ií]|ent[aã]o) (eu )?conheci\b|eu sou a mari|meu nome [eé]/i;
const GANCHO_BATIDO = /^\s*(voc[eê] j[aá] (cansou|acordou|se sentiu|sofreu)|cansad[ao] de|sabia que|descobri o segredo|chega de|quer saber como|\d+ passos simples|j[aá] acordou|adeus)/i;

const BLOCOS = ["Gancho", "Apresentação da solução", "Apresentação do produto", "Ativos e benefícios", "Praticidade / diferencial", "Demonstração do resultado", "Encerramento / CTA"];

let modelosGroq: { texto: string; visao: string; reserva: string } | null = null;
async function modelos(chave: string) {
  if (modelosGroq) return modelosGroq;
  let ids: string[] = [];
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${chave}` } });
    const j = await r.json();
    ids = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id));
  } catch { /* nomes padrão */ }
  const texto = ["openai/gpt-oss-120b", "moonshotai/kimi-k2-instruct-0905", "qwen/qwen3-32b", "openai/gpt-oss-20b"].find((p) => ids.includes(p)) || "openai/gpt-oss-120b";
  const visao = ["qwen/qwen3.8-27b", "meta-llama/llama-4-maverick-17b-128e-instruct", "meta-llama/llama-4-scout-17b-16e-instruct"].find((p) => ids.includes(p)) || ids.find((id) => /qwen3\.[5-9]|vision|llama-4|-vl/i.test(id)) || "qwen/qwen3.8-27b";
  const reserva = [visao, "openai/gpt-oss-20b"].find((p) => p !== texto && (!ids.length || ids.includes(p))) || visao;
  const m = { texto, visao, reserva };
  if (ids.length) modelosGroq = m;
  return m;
}

async function groq(chave: string, corpo: Record<string, unknown>) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (r.status === 429 || r.status === 413) {
      const s = Number(String(j?.error?.message || "").match(/try again in ([\d.]+)s/)?.[1] || 0);
      if (tentativa < 2 && s && s <= 20) { await esperar(s * 1000 + 300); continue; }
      throw new Limite("groq");
    }
    throw new Error("Groq: " + (j?.error?.message || r.status));
  }
  throw new Limite("groq");
}
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };

// ---------- site da marca ----------
function urlSegura(u: string) {
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(u) ? u : "https://" + u); } catch { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  const h = url.hostname.toLowerCase();
  if (h === "localhost" || !h.includes(".") || /^[\d.]+$/.test(h) || h.includes(":") || /\.(local|internal)$/.test(h)) return null;
  return url;
}
const meta = (html: string, nome: string) => {
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nome}["'][^>]*content=["']([^"']+)["']`, "i"));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${nome}["']`, "i"));
  return (a?.[1] || b?.[1] || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
};
function b64(bytes: Uint8Array) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); }
async function lerSite(u: string) {
  const url = urlSegura(u);
  if (!url) return { erro: "Esse endereço não parece um site. Confira o link." };
  let html = "";
  try {
    const r = await fetch(url.href, { headers: { "User-Agent": "Mozilla/5.0 (compatible; painel-ugc)", "Accept-Language": "pt-BR,pt;q=0.9" }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return { erro: "O site não deixou ler a página (resposta " + r.status + "). Descreva a marca ou envie um print." };
    html = (await r.text()).slice(0, 600_000);
  } catch { return { erro: "Não consegui abrir o site agora. Descreva a marca ou envie um print." }; }
  const titulo = meta(html, "og:title") || (html.match(/<title[^>]*>([^<]+)</i)?.[1] || "").trim();
  const descricao = meta(html, "og:description") || meta(html, "description");
  const cores: string[] = [];
  const tema = meta(html, "theme-color"); if (HEX.test(tema)) cores.push(tema.toLowerCase());
  const texto = html.replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 1800);
  let imagem = "";
  const og = meta(html, "og:image");
  if (og) {
    try {
      const iu = urlSegura(new URL(og, url.href).href);
      if (iu) {
        const r = await fetch(iu.href, { signal: AbortSignal.timeout(10000) });
        const tipo = (r.headers.get("content-type") || "").split(";")[0];
        if (r.ok && /^image\/(png|jpe?g|webp)$/.test(tipo)) {
          const bytes = new Uint8Array(await r.arrayBuffer());
          if (bytes.length < 1_500_000) imagem = `data:${tipo};base64,${b64(bytes)}`;
        }
      }
    } catch { /* sem imagem */ }
  }
  return { titulo: txt(titulo, 200), descricao: txt(descricao, 500), cores, texto: semTravessao(texto), imagem, url: url.href };
}

// ---------- imagens: o que a IA vê ----------
async function descreverImagens(chave: string, imagens: { tipo: string; url: string }[]) {
  if (!imagens.length) return "";
  const { visao } = await modelos(chave);
  const nomes: Record<string, string> = { produto: "imagem do produto ou da marca", minha: "foto da creator (Mari)", referencia: "print da referência de vídeo" };
  const conteudo: any[] = [{ type: "text", text: `São ${imagens.length} imagens para um mood board de vídeo UGC, nesta ordem: ${imagens.map((i, n) => `${n + 1}) ${nomes[i.tipo] || i.tipo}`).join("; ")}. Para cada uma, escreva UMA linha começando com o número: o que aparece, cores dominantes, clima/estética, cenário, luz, e qualquer texto escrito (copie exato). Na referência, descreva também enquadramento e texto na tela. Só o que se vê, sem inventar.` }];
  for (const i of imagens) conteudo.push({ type: "image_url", image_url: { url: i.url } });
  return groq(chave, { model: visao, temperature: 0.1, max_tokens: 700, messages: [{ role: "user", content: conteudo }] });
}

// ---------- o pedido (prompt da Mari) ----------
function montarPedido(b: any, paleta: string[], visto: string, ref: any) {
  const linha = (rotulo: string, v: unknown, n = 500) => { const t = txt(v, n); return t ? `- ${rotulo}: ${t}` : `- ${rotulo}: (não informado)`; };
  const briefing = [
    linha("Marca / produto", [b.marca, b.produto].filter(Boolean).join(" · "), 400),
    linha("Objetivo da campanha", b.objetivo),
    linha("Público-alvo", b.publico),
    linha("Formato e duração", [b.formato, b.duracao ? b.duracao + " segundos" : ""].filter(Boolean).join(", "), 200),
    linha("Plataformas", Array.isArray(b.plataformas) ? b.plataformas.join(", ") : b.plataformas, 200),
    linha("Diferenciais do produto", b.diferenciais, 900),
    linha("Objeções do público", b.objecoes),
    linha("Do's & Don'ts / termos proibidos / frases obrigatórias", b.regras, 900),
    linha("Claims liberados pela marca", b.claims),
    linha("Peças que a Mari recebeu", b.pecas, 300),
    linha("Referências (links ou descrição)", b.referencias),
    linha("Site da marca", b.siteResumo, 900),
    linha("CTA, link e cupom", b.cta, 300),
    linha("@ oficial da marca", b.arroba, 100),
    b.briefingTexto ? `- Briefing enviado pela marca (texto): ${txt(b.briefingTexto, 2600)}` : "",
    b.respostas ? `- Respostas da Mari às perguntas: ${txt(b.respostas, 600)}` : "",
  ].filter(Boolean).join("\n");
  const falas = txt(b.falas, 1500);
  const refTxt = ref && (ref.transcricao || ref.analise)
    ? `VÍDEO DE REFERÊNCIA (${txt(ref.titulo, 120)}):\nTranscrição: ${txt(ref.transcricao, 1300)}\n${ref.analise ? "Análise já feita: " + txt(ref.analise, 700) : ""}` : "";
  return `Você é roteirista e designer de conteúdo UGC da Mari Bonetto (@maribonettougc), criadora de conteúdo (maternidade e autocuidado, beleza e cabelo, moda, bem-estar, achadinhos de casa e tech). A partir do briefing no fim, entregue DUAS coisas: (1) um ROTEIRO cena a cena no formato espelho (ÁUDIO/fala | IMAGEM/direção) e (2) o conteúdo de um MOOD BOARD visual que una a estética da marca, as fotos dela, a imagem do produto e as referências.

ANTES DE ESCREVER
- Analise tudo: briefing, o que foi visto nas imagens, o vídeo de referência e o site da marca. Se há vídeo de referência, descreva o estilo (edição, ritmo, textos na tela, gancho) e use como base.
- Capte a identidade da marca (cores, clima, tom). A paleta sai do produto/da marca, nunca genérica.${paleta.length ? ` As cores tiradas das imagens do produto e da marca são: ${paleta.join(", ")}. Use EXATAMENTE esses hex na paleta, na mesma ordem, e só dê nome e uso a cada um.` : " Não vieram cores das imagens: proponha de 4 a 5 cores a partir do que você sabe da marca e do produto."}
- O que faltar de essencial (peças recebidas, CTA/link, @ oficial, duração, formato, claims liberados) vai para "pendencias" como pergunta objetiva para confirmar com a marca.

ROTEIRO (sempre estes 7 blocos, nesta ordem)
1 Gancho. 2 Apresentação da solução. 3 Apresentação do produto. 4 Ativos e benefícios. 5 Praticidade / diferencial. 6 Demonstração do resultado. 7 Encerramento / CTA.
${falas ? `A marca mandou falas prontas. Use-as literalmente no bloco certo e complete o resto:\n${falas}` : "A marca não mandou falas prontas: crie as falas a partir do briefing."}
Cada bloco tem "fala" (ÁUDIO, o que a Mari diz) e "imagem" (IMAGEM: enquadramento, ação, cenário, texto na tela).
Regras de linguagem (método dela): português falado, primeira pessoa, frases curtas, como amiga dando dica. Nunca use travessão. Nunca use falso contraste ("não é X, é Y"), falsa revelação ("aí eu descobri", "foi aí que", "até que conheci"), "você sabia que", "olá pessoal", "hoje vou falar sobre", nem se apresentar pelo nome. Gancho com detalhe concreto do produto ou da situação, nada de "cansada de", "chega de", "sabia que". CTA com uma ação só. NUNCA invente número, preço, prazo, resultado, cupom, ativo ou claim: o que o briefing não diz vira campo entre colchetes, ex.: "[confirme: cupom]". Respeite termos proibidos e inclua as frases obrigatórias. ${b.duracao ? `O total das falas deve caber em ${b.duracao} segundos (cerca de ${Math.round(Number(b.duracao) * 2.75)} palavras).` : ""}

Responda SÓ com este JSON:
{"titulo":"ROTEIRO DE FALAS | produto + marca","referencia":{"estilo":"estilo do vídeo de referência: edição, ritmo, textos na tela, gancho (\\"\\" se não há referência)","como_usar":"como isso entra neste vídeo"},"identidade":{"clima":"","tom":"","paleta":[{"hex":"#rrggbb","nome":"","uso":""}]},"falas":[{"bloco":"Gancho","fala":"","imagem":""}],"ganchos_extra":["outra opção de gancho","mais uma"],"moodboard":{"conceito":"uma frase que resume o visual","palavras":["3 a 5 palavras do clima"],"diferenciais":["3 a 6 diferenciais/benefícios curtos, só do briefing"],"gancho_referencia":"o gancho de referência em uma linha (fala ou cena)","cenario":"","luz":"","figurino":"","enquadramentos":"","texto_na_tela":"estilo dos textos na tela"},"pendencias":["o que confirmar com a marca"]}

${visto ? "O QUE FOI VISTO NAS IMAGENS ENVIADAS:\n" + txt(visto, 1500) + "\n\n" : ""}${refTxt ? refTxt + "\n\n" : ""}BRIEFING
${briefing}`;
}

function arrumar(j: any, paletaDela: string[]) {
  const falasIn = Array.isArray(j.falas) ? j.falas : [];
  const falas = BLOCOS.map((bloco, i) => {
    const f = falasIn[i] || {};
    return { bloco, fala: txt(f.fala, 900), imagem: txt(f.imagem, 600) };
  });
  const id = j.identidade || {}, mb = j.moodboard || {}, rf = j.referencia || {};
  const nomes = (Array.isArray(id.paleta) ? id.paleta : []).map((c: any) => ({ hex: String(c?.hex || "").toLowerCase(), nome: txt(c?.nome, 40), uso: txt(c?.uso, 80) }));
  const paleta = paletaDela.length
    ? paletaDela.map((hex, i) => ({ hex, nome: nomes[i]?.nome || "", uso: nomes[i]?.uso || "" }))
    : nomes.filter((c: any) => HEX.test(c.hex)).slice(0, 6);
  return {
    titulo: txt(j.titulo, 200),
    referencia: { estilo: txt(rf.estilo, 700), como_usar: txt(rf.como_usar, 400) },
    identidade: { clima: txt(id.clima, 300), tom: txt(id.tom, 300), paleta, paleta_sugerida: !paletaDela.length },
    falas,
    ganchos_extra: lista(j.ganchos_extra, 3, 300),
    moodboard: {
      conceito: txt(mb.conceito, 300), palavras: lista(mb.palavras, 5, 40), diferenciais: lista(mb.diferenciais, 6, 160),
      gancho_referencia: txt(mb.gancho_referencia, 300), cenario: txt(mb.cenario, 300), luz: txt(mb.luz, 200),
      figurino: txt(mb.figurino, 200), enquadramentos: txt(mb.enquadramentos, 300), texto_na_tela: txt(mb.texto_na_tela, 200),
    },
    pendencias: lista(j.pendencias, 12, 300),
  };
}
function problemas(r: any) {
  const erros: string[] = [];
  r.falas.forEach((f: any, i: number) => {
    if (!f.fala) erros.push(`bloco ${i + 1} (${f.bloco}) ficou sem fala`);
    const m = f.fala.match(FRASE_PROIBIDA); if (m) erros.push(`construção proibida "${m[0]}" no bloco ${i + 1}`);
  });
  if (GANCHO_BATIDO.test(r.falas[0].fala)) erros.push(`gancho batido: "${r.falas[0].fala}"`);
  return erros;
}

async function gerar(chave: string, c: any) {
  const b = c.briefing && typeof c.briefing === "object" ? c.briefing : {};
  if (!txt(b.marca, 100) && !txt(b.produto, 100) && !txt(b.briefingTexto, 100)) return resposta({ error: "Preencha pelo menos a marca e o produto." }, 422);
  const paleta = (Array.isArray(c.paleta) ? c.paleta : []).map((h: unknown) => String(h).toLowerCase()).filter((h: string) => HEX.test(h)).slice(0, 6);
  const imagens = (Array.isArray(c.imagens) ? c.imagens : [])
    .filter((i: any) => i && /^data:image\/(png|jpe?g|webp);base64,/.test(String(i.url)) && String(i.url).length < 900_000)
    .map((i: any) => ({ tipo: String(i.tipo || ""), url: String(i.url) })).slice(0, 3);
  const avisos: string[] = [];
  let visto = "";
  try { visto = await descreverImagens(chave, imagens); } catch { if (imagens.length) avisos.push("Não consegui olhar as imagens agora; o roteiro foi feito só com o texto do briefing."); }
  const pedido = montarPedido(b, paleta, visto, c.referencia);
  const { texto, reserva } = await modelos(chave);
  const chamar = (modelo: string, msgs: any[]) => groq(chave, { model: modelo, temperature: 0.6, max_tokens: 3300, reasoning_effort: /gpt-oss/.test(modelo) ? "low" : undefined, response_format: { type: "json_object" }, messages: msgs });
  let bruto = "";
  try { bruto = await chamar(texto, [{ role: "user", content: pedido }]); }
  catch (e) { if (!(e instanceof Limite)) throw e; bruto = await chamar(reserva, [{ role: "user", content: pedido }]); }
  let r = arrumar(lerJson(bruto), paleta);
  if (!r.falas.some((f) => f.fala)) { bruto = await chamar(reserva, [{ role: "user", content: pedido }]); r = arrumar(lerJson(bruto), paleta); }
  if (!r.falas.some((f) => f.fala)) return resposta({ error: "A IA devolveu uma resposta vazia. Tente de novo em instantes." }, 502);
  // uma passada de conserto, no modelo reserva (cota separada)
  let erros = problemas(r);
  if (erros.length) {
    try {
      const conserto = await groq(chave, { model: reserva, temperature: 0.4, max_tokens: 2200, response_format: { type: "json_object" }, messages: [{ role: "user", content: `Reescreva só as falas com problema deste roteiro UGC, mantendo o sentido, o tom falado e os campos entre colchetes. Sem travessão, sem "não é X, é Y", sem "aí eu descobri", "foi aí que", "você sabia que". Não invente dados.\nProblemas:\n- ${erros.join("\n- ")}\n\nFalas atuais (JSON):\n${JSON.stringify(r.falas.map((f) => ({ bloco: f.bloco, fala: f.fala })))}\n\nResponda SÓ com {"falas":[{"bloco":"","fala":""}]} com os 7 blocos na mesma ordem.` }] });
      const nf = lerJson(conserto).falas;
      if (Array.isArray(nf) && nf.length === 7) {
        const antes = r.falas.map((f) => f.fala);
        r.falas.forEach((f, i) => { const t = txt(nf[i]?.fala, 900); if (t) f.fala = t; });
        const depois = problemas(r);
        if (depois.length > erros.length) r.falas.forEach((f, i) => { f.fala = antes[i]; }); else erros = depois;
      }
    } catch { /* segue com o aviso */ }
    for (const e of erros) avisos.push("Revise: " + e);
  }
  return resposta({ resultado: r, avisos, viuImagens: Boolean(visto), modelo: texto });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: dona } = await supa.rpc("e_a_dona");
    if (dona !== true) return resposta({ error: "Não autorizado" }, 401);
    const c = await req.json().catch(() => ({}));
    if (c.acao === "site") return resposta(await lerSite(String(c.url || "")));
    const chave = Deno.env.get("GROQ_API_KEY") || "";
    if (!chave) return resposta({ error: "Falta a chave do Groq no Supabase (GROQ_API_KEY)." }, 500);
    return await gerar(chave, c);
  } catch (e) {
    if (e instanceof Limite) return resposta({ error: "O limite grátis da IA (Groq) encheu neste minuto. Espere 1 minuto e tente de novo.", limite: true }, 429);
    console.error(e);
    return resposta({ error: "Não consegui criar o roteiro agora. Tente de novo em instantes." }, 502);
  }
});
