// =========================================================
// FERRAMENTAS (Edge Function do Supabase) — Criatividade > Ferramentas (js/ferramentas.js)
// - JSON { acao: "take", nome, dur, fala, quadro, marca, job }: organizador de arquivos. Diz se o take é
//   gancho, produto em uso, b-roll, CTA ou outro, pela fala (transcrita antes pela editor-video) e por um quadro.
// - JSON { acao: "capa", imagem, plataforma }: checagem de capa. Nota de 0 a 10, textos com a caixa onde
//   estão (frações da imagem), tamanho e contraste, caixa do rosto e sugestões. O navegador cruza as caixas com
//   as áreas da interface do Instagram/TikTok e com o corte do grid.
// - JSON { acao: "ideia", texto, imagem, pilares }: organizador de ideias. Lê a ideia (ou o print) e devolve
//   título, resumo, categoria (pilar), finalidade (Publi, UGC, Conteúdos), funil, formato, marca, gancho e roteiro curto.
// Segredo: GROQ_API_KEY (só no Supabase). Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const GROQ = "https://api.groq.com/openai/v1";
const TEXTO = "openai/gpt-oss-120b";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const resposta = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const txt = (x: unknown, n = 300) => String(x ?? "").replace(/\s*[—–]\s*/g, ", ").trim().slice(0, n);
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };
const imagemOk = (q: unknown) => typeof q === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(q) && q.length < 1500000 ? q : "";
const caixa = (b: unknown) => { const a = Array.isArray(b) ? b.map(Number) : []; if (a.length !== 4 || a.some((x) => !Number.isFinite(x))) return null; const [x, y, w, h] = a.map((v) => Math.min(1, Math.max(0, v > 1 ? v / 100 : v))); return w > 0 && h > 0 ? [x, y, Math.min(w, 1 - x), Math.min(h, 1 - y)] : null; };

async function groq(chave: string, corpo: unknown) {
  const r = await fetch(`${GROQ}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "O limite grátis da IA deste minuto acabou. Espere um pouquinho e tente de novo." : "A IA não respondeu agora: " + (j?.error?.message || r.status));
  return String(j.choices?.[0]?.message?.content || "");
}
let visaoCache: string | null | undefined;
async function modeloVisao(chave: string) {
  if (visaoCache !== undefined) return visaoCache;
  try {
    const r = await fetch(`${GROQ}/models`, { headers: { Authorization: `Bearer ${chave}` } });
    const j = await r.json();
    const ids: string[] = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id));
    const pref = [/llama-4-maverick/i, /llama-4-scout/i, /llama-4/i, /vision/i, /(^|[-_/])vl([-_]|$)|qwen.*vl/i, /pixtral|gemma-3|kimi.*vl/i];
    visaoCache = null;
    const px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    for (const p of pref) for (const id of ids.filter((x) => p.test(x))) {
      const t = await fetch(`${GROQ}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: id, max_tokens: 5, messages: [{ role: "user", content: [{ type: "text", text: "Cor?" }, { type: "image_url", image_url: { url: px } }] }] }) });
      if (t.ok) { visaoCache = id; return visaoCache; }
    }
  } catch { visaoCache = null; }
  return visaoCache;
}
async function comVisao(chave: string, pergunta: string, imagens: string[], max = 1500) {
  const visao = imagens.length ? await modeloVisao(chave) : null;
  if (visao) {
    try { return { texto: await groq(chave, { model: visao, temperature: 0.2, max_tokens: max, response_format: { type: "json_object" }, messages: [{ role: "user", content: [{ type: "text", text: pergunta }, ...imagens.map((q) => ({ type: "image_url", image_url: { url: q } }))] }] }), visao: true }; }
    catch (e) { console.error("visao", e); }
  }
  return { texto: await groq(chave, { model: TEXTO, temperature: 0.2, max_tokens: max + 1500, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "user", content: pergunta + "\n\n(Não deu para ver a imagem; use só o texto.)" }] }), visao: false };
}

const CATEGORIAS_TAKE = ["gancho", "produto", "broll", "cta", "outro"];
async function take(chave: string, c: any) {
  const quadro = imagemOk(c.quadro);
  const pergunta = `Você organiza as gravações brutas de uma criadora brasileira de UGC (vídeos para marcas). Diga que tipo de take é este arquivo.
Arquivo: ${txt(c.nome, 120)} (${Number(c.dur || 0).toFixed(1)} s)${c.marca ? `\nMarca: ${txt(c.marca, 60)}` : ""}${c.job ? `\nJob: ${txt(c.job, 60)}` : ""}
Fala transcrita: ${c.fala ? `"${txt(c.fala, 1500)}"` : "(sem fala: o vídeo é mudo ou só tem barulho)"}
${quadro ? "A imagem é um quadro do meio do vídeo." : ""}
Categorias:
- "gancho": abertura, frase que prende ("você sabia", "pare de", pergunta, problema), começo de fala para a câmera;
- "produto": produto em uso real, demonstração, aplicando, mostrando resultado, falando do produto com ele na mão;
- "broll": imagens de apoio sem fala principal (close de textura, embalagem, ambiente, mãos, detalhes, cena da rotina);
- "cta": fechamento com chamada ("comenta", "link na bio", "corre", "cupom", "arrasta", "salva");
- "outro": erro, take descartável, teste de câmera, nada claro.
Responda SOMENTE um JSON: {"categoria":"gancho|produto|broll|cta|outro","resumo":"2 a 4 palavras sem acento para o nome do arquivo, ex.: aplicando serum","motivo":"1 frase curta","descartar":true ou false (só true se parece erro ou take ruim)}`;
  const r = await comVisao(chave, pergunta, quadro ? [quadro] : [], 400);
  const a = lerJson(r.texto);
  const categoria = CATEGORIAS_TAKE.includes(String(a.categoria)) ? String(a.categoria) : (c.fala ? "produto" : "broll");
  return { categoria, resumo: txt(a.resumo, 40), motivo: txt(a.motivo, 160), descartar: a.descartar === true, visao: r.visao };
}

async function capa(chave: string, c: any) {
  const img = imagemOk(c.imagem);
  if (!img) throw new Error("Não chegou a imagem da capa (use JPG ou PNG de até uns 5 MB).");
  const plataforma = c.plataforma === "tiktok" ? "TikTok" : "Instagram Reels";
  const pergunta = `Você é diretora de arte de capas de ${plataforma} de uma criadora brasileira de UGC. Avalie a CAPA da imagem (vertical, ${Number(c.w) || "?"} x ${Number(c.h) || "?"} px).
Responda SOMENTE um JSON:
{"nota": número de 0 a 10 (10 = capa que para o scroll, texto lido em 1 segundo no celular),
"resumo": "1 ou 2 frases",
"textos": [{"texto": "o que está escrito", "caixa": [x, y, largura, altura] em frações de 0 a 1 da imagem (x e y do canto de cima à esquerda), "tamanho": "pequeno" | "ok" | "grande" (pensando no celular e na miniatura do perfil), "contraste": "baixo" | "medio" | "alto"}],
"rosto": [x, y, largura, altura] em frações, ou null se não tem rosto,
"pontos_fortes": ["até 3, curtos"],
"sugestoes": ["até 6 mudanças objetivas e concretas, ex.: 'aumentar o título para ocupar 70% da largura', 'colocar contorno escuro no texto branco'"]}
Seja exigente com legibilidade: texto fino, pequeno ou sem contraste com o fundo derruba a nota. Português do Brasil, sem travessão.`;
  const r = await comVisao(chave, pergunta, [img], 1600);
  const a = lerJson(r.texto);
  const nivel = (v: unknown, l: string[], p: string) => l.includes(String(v)) ? String(v) : p;
  const textos = (Array.isArray(a.textos) ? a.textos : []).slice(0, 8).map((t: any) => ({ texto: txt(t.texto, 120), caixa: caixa(t.caixa), tamanho: nivel(t.tamanho, ["pequeno", "ok", "grande"], "ok"), contraste: nivel(t.contraste, ["baixo", "medio", "alto"], "medio") })).filter((t: any) => t.texto);
  const lista = (x: unknown, n: number, t = 200) => (Array.isArray(x) ? x : []).map((y) => txt(y, t)).filter(Boolean).slice(0, n);
  const nota = Math.min(10, Math.max(0, Math.round((Number(a.nota) || 0) * 10) / 10));
  return { nota, resumo: txt(a.resumo, 400), textos, rosto: caixa(a.rosto), pontos_fortes: lista(a.pontos_fortes, 3), sugestoes: lista(a.sugestoes, 6), visao: r.visao };
}

async function ideia(chave: string, c: any) {
  const img = imagemOk(c.imagem);
  const pilares = (Array.isArray(c.pilares) ? c.pilares : []).map((p: unknown) => txt(p, 60)).filter(Boolean).slice(0, 10);
  if (!txt(c.texto) && !img) throw new Error("Escreva a ideia ou mande um print.");
  const pergunta = `Você organiza ideias de conteúdo de uma criadora brasileira de UGC (ela é contratada por marcas para fazer vídeos e também posta conteúdo próprio para atrair marcas).
${txt(c.texto) ? `IDEIA OU ANOTAÇÃO DELA:\n${txt(c.texto, 3000)}\n` : ""}${img ? "A imagem é um print (post, comentário ou briefing). Leia o que está escrito nele.\n" : ""}
Responda SOMENTE um JSON:
{"titulo":"até 8 palavras",
"resumo":"1 ou 2 frases do que é a ideia",
"categoria":"${pilares.length ? "um destes pilares: " + pilares.join(" | ") : "o nicho (ex.: Beleza, Maternidade, Casa)"}",
"finalidade":"Publi" (trabalho pago para uma marca, briefing) | "UGC" (vídeo de produto para a marca usar, ou spec ad para portfólio) | "Conteúdos" (conteúdo próprio do perfil dela),
"funil":"Topo" (alcance, gente nova) | "Meio" (confiança, educação, prova) | "Fundo" (contratação, venda, CTA forte),
"formato":"Reels" | "Carrossel" | "Stories",
"marca":"marca citada ou \\"\\"",
"gancho":"uma frase de gancho na voz dela, primeira pessoa",
"roteiro":"roteiro curto em 3 blocos: GANCHO, DESENVOLVIMENTO, CTA (cada um em 1 ou 2 linhas, com direção de cena entre colchetes)"}
Português do Brasil, sem travessão, sem gírias.`;
  const r = await comVisao(chave, pergunta, img ? [img] : [], 1400);
  const a = lerJson(r.texto);
  const de = (v: unknown, l: string[], p: string) => l.find((x) => x.toLowerCase() === String(v || "").toLowerCase()) || p;
  return {
    titulo: txt(a.titulo, 90) || "Ideia nova", resumo: txt(a.resumo, 400), categoria: txt(a.categoria, 60),
    finalidade: de(a.finalidade, ["Publi", "UGC", "Conteúdos"], "Conteúdos"), funil: de(a.funil, ["Topo", "Meio", "Fundo"], "Topo"),
    formato: de(a.formato, ["Reels", "Carrossel", "Stories"], "Reels"), marca: txt(a.marca, 60), gancho: txt(a.gancho, 200), roteiro: txt(a.roteiro, 1500), visao: r.visao,
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
    if (corpo.acao === "take") return resposta(await take(chave, corpo));
    if (corpo.acao === "capa") return resposta(await capa(chave, corpo));
    if (corpo.acao === "ideia") return resposta(await ideia(chave, corpo));
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ error: String((e as Error).message || "Algo deu errado.") }, 502);
  }
});
