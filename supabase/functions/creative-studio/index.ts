// =========================================================
// ESTÚDIO CRIATIVO (Edge Function do Supabase) — Edição > Criação de fotos (js/estudio-criativo.js)
// Claude como diretora de arte: lê fotos, prints de referência, PDF e briefing e devolve o design
// em JSON (páginas com elementos editáveis), validado aqui antes de voltar ao navegador.
// Motor: Claude (segredo ANTHROPIC_API_KEY). Sem essa chave, usa o Groq grátis com visão (GROQ_API_KEY).
// Ações (JSON):
//   status                       -> { motor, modelo }
//   gerar   { briefing, objetivo, formato{w,h}, tipo, fotos[], refs[], docs[], paleta, identidade }
//   pagina  { pedido, pagina, contexto, formato, fotos[] }  -> { pagina, resposta }
//   projeto { pedido, design, formato, fotos[], refs[] }    -> { design, resposta }
//   importar { url }  -> baixa a imagem do link (og:image no Instagram/Pinterest) e guarda no bucket
// Só a dona do painel pode usar. Nenhuma chave aparece no navegador.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const GROQ = "https://api.groq.com/openai/v1";
const ANTH = "https://api.anthropic.com/v1";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class ErroIA extends Error { status = 502; constructor(m: string, s = 502) { super(m); this.status = s; } }

// ---------------- esquema do design (o mesmo do navegador) ----------------
export const FONTES = ["Bootzy", "DM Serif Display", "Poppins", "Instrument Serif", "Montserrat", "Fraunces", "Inter", "Playfair Display", "Arimo", "Caveat"];
const DECOS = ["estrela", "brilho", "seta", "coracao", "aspas", "sublinhado", "circulo-mao"];
const num = (v: any, a: number, b: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const cor = (v: any, d: string) => { const s = String(v ?? "").trim(); if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase(); if (/^#[0-9a-f]{3}$/i.test(s)) return ("#" + s.slice(1).split("").map((c) => c + c).join("")).toUpperCase(); if (s === "transparent") return s; return d; };
const txt = (v: any, n = 600) => String(v ?? "").replace(/\s*[—–]\s*/g, ", ").slice(0, n);
const fonte = (v: any, d: string) => { const s = String(v ?? ""); const f = FONTES.find((x) => x.toLowerCase() === s.toLowerCase()); return f || d; };

export function validarDesign(d: any, W: number, H: number, nFotos: number) {
  const avisos: string[] = [];
  if (!d || typeof d !== "object") throw new ErroIA("A IA devolveu um design vazio. Tente de novo.");
  const paleta = (Array.isArray(d.paleta) ? d.paleta : []).map((c: any) => cor(c, "")).filter(Boolean).slice(0, 8);
  const fontes = { titulo: fonte(d.fontes?.titulo, "DM Serif Display"), subtitulo: fonte(d.fontes?.subtitulo, "Poppins"), texto: fonte(d.fontes?.texto, "Poppins") };
  const pags = (Array.isArray(d.paginas) ? d.paginas : []).slice(0, 12).map((p: any, i: number) => validarPagina(p, W, H, nFotos, fontes, avisos, i));
  if (!pags.length) throw new ErroIA("A IA não montou nenhuma página. Tente de novo ou detalhe mais o pedido.");
  const tipo = ["carrossel", "post", "sequencia"].includes(d.tipo) ? d.tipo : pags.length > 1 ? "carrossel" : "post";
  return { design: { nome: txt(d.nome, 80) || "Novo projeto", tipo, direcao: { conceito: txt(d.direcao?.conceito, 400), porque: txt(d.direcao?.porque, 600) }, paleta, fontes, legenda: txt(d.legenda, 2200), paginas: pags }, avisos };
}

export function validarPagina(p: any, W: number, H: number, nFotos: number, fontes: any, avisos: string[], i = 0) {
  const els: any[] = [];
  const ids = new Set<string>();
  for (const e of (Array.isArray(p?.elementos) ? p.elementos : []).slice(0, 40)) {
    let id = String(e?.id || "").replace(/[^\w-]/g, "").slice(0, 40);
    if (!id || ids.has(id)) id = "e" + Math.random().toString(36).slice(2, 9);
    ids.add(id);
    const base = { id, x: num(e.x, -W, 2 * W, 0), y: num(e.y, -H, 2 * H, 0), rot: num(e.rot, -180, 180, 0), opac: num(e.opac, 0, 1, 1), nome: txt(e.nome, 40) };
    const t = String(e?.tipo || "");
    if (t === "texto") {
      const texto = txt(e.texto, 900);
      if (!texto.trim()) continue;
      const papel = ["titulo", "subtitulo", "texto"].includes(e.papel) ? e.papel : "texto";
      els.push({ ...base, tipo: "texto", texto, papel, w: num(e.w, 40, 2 * W, W * 0.8), tam: num(e.tam, 10, 400, 40),
        fonte: fonte(e.fonte, fontes[papel]), peso: num(e.peso, 100, 900, 400), italico: !!e.italico, cor: cor(e.cor, "#3D2B20"),
        alinh: ["left", "center", "right", "justify"].includes(e.alinh) ? e.alinh : "left", entrelinha: num(e.entrelinha, 0.7, 3, 1.2),
        espaco: num(e.espaco, -200, 1500, 0), maiusc: !!e.maiusc, fundo: e.fundo ? cor(e.fundo, "") : "" });
    } else if (t === "imagem") {
      const a = Math.round(Number(e.asset));
      if (!Number.isFinite(a) || a < 0 || a >= nFotos) { avisos.push(`Página ${i + 1}: a IA citou uma foto que não existe; tirei.`); continue; }
      els.push({ ...base, tipo: "imagem", asset: a, w: num(e.w, 40, 3 * W, W), h: num(e.h, 40, 3 * H, H * 0.6),
        focoX: num(e.focoX, 0, 1, 0.5), focoY: num(e.focoY, 0, 1, 0.4), zoom: num(e.zoom, 1, 4, 1), raio: num(e.raio, 0, 600, 0),
        borda: num(e.borda, 0, 60, 0), bordaCor: cor(e.bordaCor, "#FFFFFF") });
    } else if (t === "forma") {
      els.push({ ...base, tipo: "forma", forma: e.forma === "circulo" ? "circulo" : "retangulo", w: num(e.w, 2, 3 * W, 200), h: num(e.h, 2, 3 * H, 200),
        cor: cor(e.cor, "#EFE5D8"), borda: num(e.borda, 0, 80, 0), bordaCor: cor(e.bordaCor, "#3D2B20"), raio: num(e.raio, 0, 1000, 0) });
    } else if (t === "linha") {
      els.push({ ...base, tipo: "linha", w: num(e.w, 4, 3 * W, 300), espessura: num(e.espessura, 1, 60, 3), cor: cor(e.cor, "#3D2B20") });
    } else if (t === "deco") {
      els.push({ ...base, tipo: "deco", deco: DECOS.includes(e.deco) ? e.deco : "brilho", w: num(e.w, 10, W, 80), cor: cor(e.cor, "#A87058") });
    }
  }
  if (!els.length) avisos.push(`Página ${i + 1} veio sem elementos.`);
  return { id: String(p?.id || "p" + Math.random().toString(36).slice(2, 8)).slice(0, 30), papel: ["capa", "interna", "final"].includes(p?.papel) ? p.papel : i === 0 ? "capa" : "interna",
    nota: txt(p?.nota, 200), fundo: cor(p?.fundo, "#F6EFE6"), elementos: els };
}

// ---------------- prompt da diretora de arte ----------------
const DIRETORA = `Você é uma diretora de arte especializada em design editorial, branding pessoal, conteúdo para Instagram, comunicação visual e direção criativa para criadores de conteúdo. Seu trabalho é transformar ideias, fotografias, briefings e informações em designs profissionais, originais e visualmente interessantes.
Você não pensa como uma ferramenta de templates. Você pensa como uma profissional que entende composição, hierarquia, ritmo visual, tipografia, equilíbrio, contraste e narrativa.
Antes de criar, analise: 1) o objetivo do conteúdo; 2) o público; 3) a mensagem principal; 4) as imagens disponíveis; 5) a identidade visual oficial; 6) as referências; 7) a melhor composição para comunicar a mensagem.
Use as referências como inspiração, nunca para copiar. O perfil @feedautentico é referência importante de direção visual: composição, estética editorial, organização das informações, hierarquia tipográfica e criatividade nos carrosséis. Combine as referências e desenvolva uma solução original.
Não repita o mesmo layout em todas as páginas: variação visual com consistência. A capa desperta curiosidade com hierarquia clara. As internas são agradáveis de ler e bem distribuídas. A última pode ter conclusão ou chamada para ação quando fizer sentido.
Use as imagens de forma estratégica. Espaço em branco faz parte do design; não preencha tudo. Não use fontes aleatórias. Respeite a identidade visual oficial da criadora.
Evite: textos espremidos, elementos desalinhados, excesso de informação, fontes difíceis de ler, layouts repetidos, imagens distorcidas, margens inconsistentes, cara de template genérico.
Não invente informações, benefícios de produto, dados, depoimentos ou detalhes de campanha: use só o que está no briefing e nos materiais; se faltar, escreva texto neutro sem números. Não altere a aparência de pessoas ou produtos.
Textos em português do Brasil, primeira pessoa quando for a voz da criadora, sem travessão (use vírgula ou ponto).`;

function regrasFormato(W: number, H: number) {
  return `FORMATO: cada página tem ${W} x ${H} px. Coordenadas em px a partir do canto superior esquerdo. Margem segura de pelo menos 72 px nas bordas para texto.
RESPONDA SÓ COM JSON VÁLIDO (sem markdown, sem comentários), neste formato:
{"nome":"nome curto do projeto","tipo":"carrossel|post|sequencia","direcao":{"conceito":"a ideia visual em 1 frase","porque":"por que essa direção funciona para o objetivo"},
"paleta":["#HEX",...até 6],"fontes":{"titulo":FONTE,"subtitulo":FONTE,"texto":FONTE},"legenda":"legenda do post, curta, com até 5 hashtags no fim",
"paginas":[{"id":"p1","papel":"capa|interna|final","nota":"intenção da página","fundo":"#HEX","elementos":[ELEMENTO,...]}]}
FONTE é uma destas, escrita igual: ${FONTES.join(", ")}. "Bootzy" é a fonte própria dela (sem serifa, grossa e apertada, ótima para títulos de impacto).
ELEMENTO (a ordem da lista é a ordem das camadas: o primeiro fica atrás):
- texto: {"id","tipo":"texto","papel":"titulo|subtitulo|texto","texto","x","y","w" (largura da caixa; o texto quebra sozinho),"tam" (px),"fonte","peso" (100-900),"italico" (bool),"cor","alinh":"left|center|right","entrelinha" (ex 1.1),"espaco" (espaçamento entre letras em milésimos de em, ex 0, 80, 200),"maiusc" (bool),"rot" (graus),"opac" (0-1),"fundo" (cor de faixa atrás do texto ou "")}
- imagem: {"id","tipo":"imagem","asset" (número da foto enviada, começando em 0),"x","y","w","h" (a moldura; a foto preenche a moldura cortando, NUNCA distorce),"focoX","focoY" (0-1, ponto da foto que fica no centro do corte; rosto e produto nunca podem ser cortados),"zoom" (1-4),"raio" (cantos),"borda","bordaCor","rot","opac"}
- forma: {"id","tipo":"forma","forma":"retangulo|circulo","x","y","w","h","cor" (ou "transparent" para moldura),"borda","bordaCor","raio","rot","opac"}
- linha: {"id","tipo":"linha","x","y","w" (comprimento),"espessura","cor","rot"}
- deco: {"id","tipo":"deco","deco":"${DECOS.join("|")}","x","y","w","cor","rot"}
Tamanhos de referência em ${W}px de largura: título de capa 90 a 170, título interno 56 a 90, texto corrido 32 a 42 (nunca menos de 28), legenda pequena 24 a 28. Até ~45 palavras de texto por página interna.
Use ids únicos e estáveis. Contraste mínimo de leitura entre texto e fundo.`;
}

const IDENTIDADE_PADRAO = `Identidade oficial da Mari Bonetto (@maribonettougc, criadora UGC; nichos beleza, maternidade de crianças maiores, casa, achadinhos, autoestima): estética minimalista, editorial, elegante e feminina. Paleta oficial: creme #F6EFE6, papel #FFFDF9, café #6B4A35, terracota #A87058, texto #3D2B20, bege #EFE5D8, manteiga #FCEEA8 (destaque). Tipografia: Bootzy (fonte dela) ou DM Serif Display nos títulos, Poppins no texto. @ para assinatura: @maribonettougc.`;

// ---------------- motores ----------------
type Img = { media: string; b64: string; rotulo: string };
function dataUrl(s: any): { media: string; b64: string } | null {
  const m = String(s || "").match(/^data:([\w/+.-]+);base64,(.+)$/);
  return m ? { media: m[1], b64: m[2] } : null;
}
let modeloClaude: string | null = null;
async function claudeModelo(chave: string) {
  if (modeloClaude) return modeloClaude;
  const pref = Deno.env.get("CLAUDE_MODEL");
  if (pref) return (modeloClaude = pref);
  try {
    const r = await fetch(`${ANTH}/models?limit=50`, { headers: { "x-api-key": chave, "anthropic-version": "2023-06-01" } });
    const j = await r.json();
    const ids: string[] = (j.data || []).map((m: any) => String(m.id));
    modeloClaude = ids.find((i) => /sonnet/i.test(i)) || ids.find((i) => /opus/i.test(i)) || ids[0] || "claude-sonnet-4-5";
  } catch { modeloClaude = "claude-sonnet-4-5"; }
  return modeloClaude;
}
async function claude(chave: string, sistema: string, texto: string, imgs: Img[], docs: { b64: string; nome: string }[], maxTok = 12000) {
  const content: any[] = [];
  for (const d of docs.slice(0, 3)) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: d.b64 }, title: d.nome.slice(0, 80) });
  for (const im of imgs.slice(0, 18)) { content.push({ type: "text", text: im.rotulo }); content.push({ type: "image", source: { type: "base64", media_type: im.media, data: im.b64 } }); }
  content.push({ type: "text", text: texto });
  const modelo = await claudeModelo(chave);
  const r = await fetch(`${ANTH}/messages`, {
    method: "POST",
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modelo, max_tokens: maxTok, system: sistema, messages: [{ role: "user", content }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error?.message || String(r.status);
    if (r.status === 401) throw new ErroIA("A chave da Anthropic (ANTHROPIC_API_KEY) não foi aceita. Confira nos Secrets do Supabase.", 401);
    if (r.status === 429) throw new ErroIA("O limite de uso do Claude deste minuto acabou. Espere 1 minuto e tente de novo.", 429);
    if (r.status === 529 || r.status >= 500) throw new ErroIA("O Claude está sobrecarregado agora (" + msg + ").", 503);
    throw new ErroIA("O Claude recusou o pedido: " + msg, 502);
  }
  const out = (j.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  return { texto: out, modelo, cortado: j.stop_reason === "max_tokens" };
}

let visaoGroq: string | null | undefined;
async function groqModelos(chave: string) {
  const r = await fetch(`${GROQ}/models`, { headers: { Authorization: `Bearer ${chave}` } });
  const j = await r.json().catch(() => ({}));
  return (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id)) as string[];
}
async function groqVisao(chave: string) {
  if (visaoGroq !== undefined) return visaoGroq;
  visaoGroq = null;
  const ids = await groqModelos(chave);
  const pref = [/llama-4-maverick/i, /llama-4-scout/i, /llama-4/i, /vision/i, /qwen.*vl|(^|[-_/])vl([-_]|$)/i, /qwen3\.[5-9]|qwen-?[4-9]/i, /gemma-3|pixtral/i];
  const px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
  for (const p of pref) for (const id of ids.filter((x) => p.test(x))) {
    const t = await fetch(`${GROQ}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: id, max_tokens: 5, messages: [{ role: "user", content: [{ type: "text", text: "ok?" }, { type: "image_url", image_url: { url: px } }] }] }) });
    if (t.ok) return (visaoGroq = id);
  }
  return visaoGroq;
}
async function groqChat(chave: string, modelo: string, msgs: any[], maxTok: number, json = true) {
  const corpo: any = { model: modelo, max_tokens: maxTok, temperature: 0.7, messages: msgs };
  if (json) corpo.response_format = { type: "json_object" };
  if (/gpt-oss/.test(modelo)) corpo.reasoning_effort = "low";
  const r = await fetch(`${GROQ}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 429) throw new ErroIA("O limite grátis da IA deste minuto acabou. Espere 1 minuto e tente de novo.", 429);
    throw new ErroIA("A IA não respondeu agora: " + (j?.error?.message || r.status));
  }
  return String(j.choices?.[0]?.message?.content || "");
}
// Groq: 1) o modelo de visão descreve cada foto/print; 2) um modelo de texto monta o JSON
async function groqDesign(chave: string, sistema: string, texto: string, imgs: Img[]) {
  let descricoes = "";
  if (imgs.length) {
    const vis = await groqVisao(chave);
    if (!vis) throw new ErroIA("Nenhum modelo de visão grátis disponível agora no Groq. Ponha a ANTHROPIC_API_KEY para usar o Claude.", 503);
    const partes: string[] = [];
    for (let i = 0; i < imgs.length; i += 5) {
      const lote = imgs.slice(i, i + 5);
      const content: any[] = [{ type: "text", text: "Descreva cada imagem para uma diretora de arte, em português, em 2 a 4 linhas cada: o que aparece, onde está o rosto/produto (em % da largura e altura), cores dominantes, se é foto vertical ou horizontal, áreas vazias boas para texto. Se for print de post de referência, descreva composição, tipografia, hierarquia, cores e uso de espaço. Responda numerado com o rótulo de cada imagem." }];
      for (const im of lote) { content.push({ type: "text", text: im.rotulo }); content.push({ type: "image_url", image_url: { url: `data:${im.media};base64,${im.b64}` } }); }
      partes.push(await groqChat(chave, vis, [{ role: "user", content }], 1400, false));
    }
    descricoes = "\nDESCRIÇÃO DAS IMAGENS (você não as vê; use estas descrições):\n" + partes.join("\n");
  }
  const ids = await groqModelos(chave);
  const ordem = ["openai/gpt-oss-120b", "moonshotai/kimi-k2-instruct-0905", "moonshotai/kimi-k2-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct", "openai/gpt-oss-20b"].filter((m) => ids.includes(m));
  if (!ordem.length) ordem.push(ids.find((i) => /gpt-oss|llama|qwen|kimi/i.test(i) && !/whisper|guard|tts/i.test(i)) || "openai/gpt-oss-120b");
  let ultimo: unknown;
  for (const m of ordem) {
    try { return { texto: await groqChat(chave, m, [{ role: "system", content: sistema }, { role: "user", content: texto + descricoes }], 7000), modelo: "groq " + m, cortado: false }; }
    catch (e) { ultimo = e; if ((e as ErroIA).status === 429) continue; }
  }
  throw ultimo || new ErroIA("A IA não respondeu agora.");
}

function lerJson(t: string) {
  const limpo = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(limpo); } catch { /* segue */ }
  const a = limpo.indexOf("{"), b = limpo.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(limpo.slice(a, b + 1)); } catch { /* segue */ } }
  return null;
}

async function pensar(sistema: string, texto: string, imgs: Img[], docs: { b64: string; nome: string }[], maxTok = 12000) {
  const anth = Deno.env.get("ANTHROPIC_API_KEY") || "";
  const groqK = Deno.env.get("GROQ_API_KEY") || "";
  const avisos: string[] = [];
  if (anth) {
    try {
      let r = await claude(anth, sistema, texto, imgs, docs, maxTok);
      let j = lerJson(r.texto);
      if (!j) { r = await claude(anth, sistema, texto + "\n\nATENÇÃO: sua resposta anterior não era JSON válido" + (r.cortado ? " (ficou cortada; seja mais enxuta)" : "") + ". Responda SÓ o JSON.", imgs, docs, maxTok); j = lerJson(r.texto); }
      if (j) return { json: j, motor: "claude", modelo: r.modelo, avisos };
      throw new ErroIA("O Claude respondeu fora do formato duas vezes.");
    } catch (e) {
      if (!groqK || (e as ErroIA).status === 401) throw e;
      avisos.push("Claude indisponível (" + (e as Error).message + "). Usei a IA grátis do Groq.");
    }
  }
  if (!groqK) throw new ErroIA("Nenhuma IA configurada: ponha ANTHROPIC_API_KEY (ou GROQ_API_KEY) nos Secrets do Supabase.", 500);
  if (docs.length) avisos.push("A IA grátis não lê PDF: cole o texto do briefing no campo (ou ponha a chave do Claude).");
  const r = await groqDesign(groqK, sistema, texto, imgs);
  const j = lerJson(r.texto);
  if (!j) throw new ErroIA("A IA devolveu uma resposta fora do formato. Tente de novo.");
  return { json: j, motor: "groq", modelo: r.modelo, avisos };
}

// ---------------- entrada ----------------
function juntarImagens(corpo: any) {
  const imgs: Img[] = [];
  const fotos = (Array.isArray(corpo.fotos) ? corpo.fotos : []).slice(0, 12);
  fotos.forEach((f: any, i: number) => { const d = dataUrl(f.dataUrl); if (d) imgs.push({ ...d, rotulo: `FOTO asset=${i}: ${txt(f.nome, 80)}${f.notas ? " (" + txt(f.notas, 200) + ")" : ""}` }); });
  const refs = (Array.isArray(corpo.refs) ? corpo.refs : []).slice(0, 8);
  const textoRefs: string[] = [];
  refs.forEach((r: any, i: number) => {
    const d = dataUrl(r.dataUrl);
    if (d) imgs.push({ ...d, rotulo: `REFERÊNCIA ${i + 1} (só inspiração, não copiar): ${txt(r.titulo, 80)} [${txt(r.tipo, 30)}]${r.notas ? " Nota dela: " + txt(r.notas, 300) : ""}` });
    else textoRefs.push(`- ${txt(r.titulo, 80)} [${txt(r.tipo, 30)}] ${txt(r.url, 200)}${r.notas ? " Nota: " + txt(r.notas, 300) : ""} (sem imagem: use só a nota)`);
  });
  const docs = (Array.isArray(corpo.docs) ? corpo.docs : []).slice(0, 3).map((d: any) => ({ b64: dataUrl(d.dataUrl)?.b64 || "", nome: txt(d.nome, 80) })).filter((d: any) => d.b64);
  return { imgs, nFotos: fotos.length, textoRefs, docs };
}

async function gerar(corpo: any) {
  const W = num(corpo.formato?.w, 400, 3000, 1080), H = num(corpo.formato?.h, 400, 3000, 1350);
  const { imgs, nFotos, textoRefs, docs } = juntarImagens(corpo);
  const tipo = ["carrossel", "post", "sequencia"].includes(corpo.tipo) ? corpo.tipo : "auto";
  const paleta = Array.isArray(corpo.paleta?.cores) && corpo.paleta.cores.length ? `Paleta escolhida para este design: ${corpo.paleta.nome || ""} ${corpo.paleta.cores.join(", ")} (use estas cores).` : "Use a paleta oficial, salvo se o briefing pedir outra.";
  const sistema = DIRETORA + "\n\n" + (txt(corpo.identidade, 1500) || IDENTIDADE_PADRAO) + "\n\n" + regrasFormato(W, H);
  const pedido = `BRIEFING: ${txt(corpo.briefing, 4000) || "(sem texto; decida pelo material)"}
OBJETIVO: ${txt(corpo.objetivo, 300) || "(decida)"}
TIPO: ${tipo === "auto" ? "decida você se é carrossel (3 a 10 páginas), post único ou sequência, pelo briefing e pelo material" : tipo + (tipo === "post" ? " (1 página)" : "")}
${corpo.paginas ? "NÚMERO DE PÁGINAS: " + num(corpo.paginas, 1, 12, 6) : ""}
${paleta}
FOTOS DISPONÍVEIS: ${nFotos} (asset 0 a ${Math.max(0, nFotos - 1)}). ${nFotos ? "Escolha quais fotos funcionam melhor em cada página; não é obrigatório usar todas." : "Não há fotos: crie com tipografia, formas e cor."}
${textoRefs.length ? "REFERÊNCIAS SEM IMAGEM:\n" + textoRefs.join("\n") : ""}
${txt(corpo.textoExtra, 6000) ? "TEXTOS E INFORMAÇÕES ENVIADOS:\n" + txt(corpo.textoExtra, 6000) : ""}
Crie agora o design completo e devolva só o JSON.`;
  const r = await pensar(sistema, pedido, imgs, docs);
  const v = validarDesign(r.json, W, H, nFotos);
  return { ...v, avisos: [...r.avisos, ...v.avisos], motor: r.motor, modelo: r.modelo };
}

async function pagina(corpo: any) {
  const W = num(corpo.formato?.w, 400, 3000, 1080), H = num(corpo.formato?.h, 400, 3000, 1350);
  const { imgs, nFotos, docs } = juntarImagens(corpo);
  const sistema = DIRETORA + "\n\n" + (txt(corpo.identidade, 1500) || IDENTIDADE_PADRAO) + "\n\n" + regrasFormato(W, H) +
    `\n\nAGORA VOCÊ ESTÁ EDITANDO UMA PÁGINA SÓ. Responda {"resposta":"o que você mudou, em 1 ou 2 frases","pagina":{"id","papel","nota","fundo","elementos":[...]}}. Mude só o que o pedido pede e preserve o resto (mantenha os ids dos elementos que continuam). Não invente texto novo de conteúdo se o pedido não pedir; pode reescrever títulos se o pedido for sobre chamada ou leitura.`;
  const pedido = `PEDIDO: ${txt(corpo.pedido, 800)}
CONTEXTO DO PROJETO: ${txt(JSON.stringify(corpo.contexto || {}), 2500)}
PÁGINA ATUAL (JSON): ${JSON.stringify(corpo.pagina || {}).slice(0, 20000)}`;
  const r = await pensar(sistema, pedido, imgs, docs, 8000);
  const j = r.json?.pagina ? r.json : { pagina: r.json };
  const avisos: string[] = [...r.avisos];
  const fontes = corpo.contexto?.fontes || { titulo: "DM Serif Display", subtitulo: "Poppins", texto: "Poppins" };
  return { pagina: validarPagina(j.pagina, W, H, nFotos, fontes, avisos), resposta: txt(j.resposta, 400), avisos, motor: r.motor, modelo: r.modelo };
}

async function projeto(corpo: any) {
  const W = num(corpo.formato?.w, 400, 3000, 1080), H = num(corpo.formato?.h, 400, 3000, 1350);
  const { imgs, nFotos, textoRefs, docs } = juntarImagens(corpo);
  const sistema = DIRETORA + "\n\n" + (txt(corpo.identidade, 1500) || IDENTIDADE_PADRAO) + "\n\n" + regrasFormato(W, H) +
    `\n\nAGORA VOCÊ ESTÁ AJUSTANDO O PROJETO INTEIRO. Responda o JSON do design completo com uma chave a mais "resposta" (o que mudou, em 1 ou 2 frases). Preserve ids e textos de conteúdo que não precisam mudar.`;
  const pedido = `PEDIDO: ${txt(corpo.pedido, 800)}
${textoRefs.length ? "REFERÊNCIAS SEM IMAGEM:\n" + textoRefs.join("\n") : ""}
DESIGN ATUAL (JSON): ${JSON.stringify(corpo.design || {}).slice(0, 60000)}`;
  const r = await pensar(sistema, pedido, imgs, docs);
  const v = validarDesign(r.json, W, H, nFotos);
  return { ...v, resposta: txt(r.json?.resposta, 400), avisos: [...r.avisos, ...v.avisos], motor: r.motor, modelo: r.modelo };
}

// baixa a imagem de um link (direto ou og:image da página) e guarda no bucket da dona
async function importar(supa: any, uid: string, corpo: any) {
  const url = String(corpo.url || "").trim();
  if (!/^https:\/\//i.test(url)) throw new ErroIA("Link inválido.", 400);
  const UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
  let img = url, titulo = "";
  let r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,image/*" }, redirect: "follow" });
  let tipo = r.headers.get("content-type") || "";
  if (tipo.includes("text/html")) {
    const html = (await r.text()).slice(0, 400000);
    const meta = (p: string) => (html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, "i")) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, "i")) || [])[1];
    img = (meta("og:image") || meta("twitter:image") || "").replace(/&amp;/g, "&");
    titulo = (meta("og:title") || "").replace(/&amp;/g, "&").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).slice(0, 120);
    if (!img) throw new ErroIA("Esse site não deixou ler a imagem pelo link (o Instagram costuma bloquear). Envie um print da referência.", 422);
    r = await fetch(img, { headers: { "User-Agent": UA } });
    tipo = r.headers.get("content-type") || "";
  }
  if (!r.ok || !/^image\//.test(tipo)) throw new ErroIA("Não consegui baixar a imagem desse link. Envie um print.", 422);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length > 12 * 1024 * 1024) throw new ErroIA("Imagem grande demais (mais de 12 MB).", 413);
  const ext = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg";
  const caminho = `${uid}/refs/${crypto.randomUUID()}.${ext}`;
  const { error } = await supa.storage.from("estudio-criativo").upload(caminho, buf, { contentType: tipo.split(";")[0], upsert: false });
  if (error) throw new ErroIA("Não consegui guardar a imagem: " + error.message, 500);
  return { storage_path: caminho, titulo, origem: img };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ error: "Use POST." }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user || user.email !== EMAIL_DONA) return resposta({ error: "Não autorizado" }, 401);
    const corpo = await req.json().catch(() => ({}));
    if (corpo.acao === "status") {
      const anth = Deno.env.get("ANTHROPIC_API_KEY");
      return resposta({ motor: anth ? "claude" : Deno.env.get("GROQ_API_KEY") ? "groq" : "nenhum", modelo: anth ? await claudeModelo(anth) : null });
    }
    if (corpo.acao === "gerar") return resposta(await gerar(corpo));
    if (corpo.acao === "pagina") return resposta(await pagina(corpo));
    if (corpo.acao === "projeto") return resposta(await projeto(corpo));
    if (corpo.acao === "importar") return resposta(await importar(supa, user.id, corpo));
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ error: String((e as Error).message || "Algo deu errado.") }, (e as ErroIA).status || 502);
  }
});
