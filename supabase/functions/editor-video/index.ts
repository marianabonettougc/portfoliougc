// =========================================================
// EDITOR DE VÍDEO (Edge Function do Supabase)
// Criatividade > Edição de vídeos (js/edicao.js).
// - FormData { acao: "transcrever", arquivo }: áudio (wav 16 kHz feito no navegador,
//   até 25 MB) transcrito pelo Whisper do Groq com o tempo de cada palavra.
// - JSON { acao: "plano", palavras, duracao, padrao, tema }: a IA lê a fala com os
//   tempos e o padrão de edição da Mari e devolve o plano: título do gancho,
//   trechos para tirar (repetição, erro, gaguejo), palavras de destaque, zooms,
//   efeitos sonoros, ideias de b-roll e dicas. Se ela colar o roteiro (cenas, falas e
//   voice-over que tinha idealizado), a edição segue o roteiro: escolhe a tomada que bate
//   com a fala escrita, usa o gancho do roteiro no título, tira b-roll e efeitos das
//   direções de cena e devolve "roteiro_check" (bloco gravado, faltou ou mudou).
// - JSON { acao: "corrigir", comentario, plano, opc, titulo, palavras, padrao, roteiro, historico }:
//   ela comenta o que não gostou; volta o plano corrigido, os ajustes visuais que mudam
//   (legenda, título, cor, efeitos), o que foi feito e uma regra para guardar no padrão.
// Segredo: GROQ_API_KEY (só no Supabase). Só a dona do painel pode usar.
// =========================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const EMAIL_DONA = "marianabonettougc@gmail.com";
const GROQ = "https://api.groq.com/openai/v1";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const txt = (x: unknown, n = 300) => String(x ?? "").replace(/\s*[—–]\s*/g, ", ").trim().slice(0, n);
const num = (x: unknown) => { const n = Number(x); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };
const EFEITOS = ["woosh", "suave", "pop", "click", "shutter", "typing", "riser", "hit", "ding", "cristal", "brilho", "spray", "mensagem", "relogio"];

async function transcrever(chave: string, arquivo: File) {
  if (arquivo.size > 25 * 1024 * 1024) throw new Error("Esse trecho de áudio passou de 25 MB.");
  const f = new FormData();
  f.append("model", "whisper-large-v3-turbo");
  f.append("response_format", "verbose_json");
  f.append("language", "pt");
  f.append("timestamp_granularities[]", "word");
  f.append("timestamp_granularities[]", "segment");
  f.append("file", arquivo, /\.(m4a|mp4|wav|mp3|webm|ogg)$/i.test(arquivo.name || "") ? arquivo.name : "audio.wav");
  const r = await fetch(`${GROQ}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: f });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "O limite grátis do Groq acabou por agora. Espere um pouco e tente de novo." : "O Whisper não conseguiu transcrever: " + (j?.error?.message || r.status));
  const palavras = (Array.isArray(j.words) ? j.words : []).map((w: any) => ({ w: String(w.word || "").trim(), s: num(w.start) ?? 0, e: num(w.end) ?? 0 })).filter((w: any) => w.w);
  return { texto: String(j.text || "").trim(), palavras, duracao: num(j.duration) };
}

function normalizar(a: any) {
  const lista = (x: unknown) => (Array.isArray(x) ? x : []);
  return {
    titulo: txt(a.titulo, 60),
    titulo_destaque: txt(a.titulo_destaque, 30),
    remover: lista(a.remover).map((x: any) => ({ de: num(x.de), ate: num(x.ate), motivo: txt(x.motivo, 60) })).filter((x: any) => x.de != null && x.ate != null && x.ate > x.de),
    destaques: lista(a.destaques).map((x: any) => ({ t: num(x.t), palavra: txt(x.palavra, 40) })).filter((x: any) => x.t != null),
    zooms: lista(a.zooms).map((x: any) => ({ t: num(x.t) })).filter((x: any) => x.t != null),
    efeitos: lista(a.efeitos).map((x: any) => ({ t: num(x.t), tipo: String(x.tipo || "").toLowerCase().trim(), por_que: txt(x.por_que, 80) })).filter((x: any) => x.t != null && EFEITOS.includes(x.tipo)),
    broll: lista(a.broll).map((x: any) => ({ t: num(x.t), ideia: txt(x.ideia, 200) })).filter((x: any) => x.ideia),
    musica: txt(a.musica, 200),
    dicas: lista(a.dicas).map((x: any) => txt(x, 200)).filter(Boolean).slice(0, 4),
    roteiro_check: lista(a.roteiro_check).map((x: any) => ({ bloco: txt(x.bloco, 80), status: ["gravado", "faltou", "mudou"].includes(String(x.status).toLowerCase().trim()) ? String(x.status).toLowerCase().trim() : "gravado", t: num(x.t), obs: txt(x.obs, 220) })).filter((x: any) => x.bloco).slice(0, 20),
  };
}

async function plano(chave: string, c: any) {
  const palavras = (Array.isArray(c.palavras) ? c.palavras : []).slice(0, 4000);
  if (!palavras.length) throw new Error("Não tem fala nesse vídeo para eu planejar a edição.");
  const fala = palavras.map((p: any) => `[${Number(p.s).toFixed(1)}] ${p.w}`).join(" ");
  const pedido = `Você é videomaker e editor de Reels de uma criadora brasileira de UGC. Planeje a edição do vídeo bruto abaixo seguindo o PADRÃO DE EDIÇÃO dela.

PADRÃO DE EDIÇÃO:
${txt(c.padrao, 6000)}

${c.tema ? "TEMA / MARCA: " + txt(c.tema, 300) + "\n" : ""}${c.roteiro ? `ROTEIRO QUE ELA IDEALIZOU (cenas, falas, voice-over e direções; use como guia da edição):
${txt(c.roteiro, 3500)}

` : ""}DURAÇÃO DO BRUTO: ${num(c.duracao) ?? "?"} s
FALA (cada palavra com o segundo em que começa, no tempo do vídeo bruto):
${fala}

Responda SOMENTE um JSON:
{"titulo":"título do gancho para os 3 primeiros segundos, condensado, de 3 a 6 palavras, sem emoji","titulo_destaque":"a palavra do título que vai na fonte de destaque",
"remover":[{"de":0.0,"ate":0.0,"motivo":"repetição | erro | gaguejo | fala de bastidor"}],
"destaques":[{"t":0.0,"palavra":"palavra forte que merece cor de destaque"}],
"zooms":[{"t":0.0}],
"efeitos":[{"t":0.0,"tipo":"woosh | suave | pop | click | shutter | typing | riser | hit | ding | cristal | brilho | spray | mensagem | relogio","por_que":"curto"}],
"broll":[{"t":0.0,"ideia":"o que gravar de apoio para cobrir esse trecho, 1 frase"}],
"musica":"clima de música sugerido, 1 frase",
"dicas":["até 4 dicas curtas e concretas para esse vídeo"]${c.roteiro ? `,
"roteiro_check":[{"bloco":"nome curto do bloco ou cena do roteiro","status":"gravado | faltou | mudou","t":0.0,"obs":"curto: onde está na fala, o que faltou gravar ou o que ficou diferente"}]` : ""}}

Regras:
- "remover": quando ela repete uma frase (tomada errada), fique com a ÚLTIMA versão e marque as anteriores para tirar. Tire também "vamos de novo", "peraí", gaguejos e falas que não são do roteiro. Use os tempos da fala. Não marque silêncios (o painel já corta).
- "destaques": as PALAVRAS CHAMATIVAS (viram texto grande colorido na tela, com pop): 1 a cada 5 a 7 segundos, só palavras que carregam a ideia (benefício, número, nome do produto, a virada da frase). Nunca palavrinhas como "de", "que", "eu".
- "zooms": 1 a cada 3 a 5 segundos, em frases de ênfase (ela gosta de dinamismo).
- "efeitos": riser logo antes do gancho/revelação, hit logo depois da revelação, pop quando entra texto na tela (o painel já põe sozinho os cliques do título, não marque pop para o título), woosh nas mudanças de assunto, click/shutter em listas e cortes rápidos, typing quando ela fala de algo escrito, spray quando ela borrifa ou aplica o produto (perfume, spray de cabelo), brilho (sparkle, bem baixinho) quando o produto brilha ou na névoa, suave (whoosh suave) no corte para o rosto ou em momento delicado, cristal (ding de cristal) quando o produto aparece inteiro e quando ela fala o nome do produto ou da marca, mensagem quando entra print de conversa/WhatsApp, relogio (tique-taque) quando ela fala de fixação, duração ou "no fim do dia". Nunca ponha efeito por cima de áudio de prova (áudio de WhatsApp, depoimento). Ela gosta de vídeo bem dinâmico: 1 efeito a cada 1,5 a 2 segundos, exagerando nos 3 primeiros segundos. O painel já põe sozinho sons nos cortes e nas entradas de legenda; marque aqui os momentos de sentido (revelação, produto aparecendo, lista, digitação, gesto do produto).
- Todos os tempos em segundos do bruto, com 1 casa decimal.${c.roteiro ? `
- COM ROTEIRO: compare a fala com o roteiro bloco a bloco. Quando ela gravou o mesmo trecho mais de uma vez, fique com a tomada mais fiel ao roteiro (se empatar, a última) e marque as outras em "remover". Não corte falas que estão no roteiro. Fala fora do roteiro que parece bastidor ou erro vai para "remover".
- COM ROTEIRO: o título sai do gancho do roteiro (condensado). Direções de cena, texto na tela e voice-over do roteiro viram "broll" (no tempo do bloco correspondente, dizendo "do roteiro: ...") e efeitos (texto na tela = pop, troca de cena = woosh).
- COM ROTEIRO: "roteiro_check" com todos os blocos do roteiro, na ordem. "faltou" quando o bloco não aparece na fala (diga o que gravar), "mudou" quando ela falou diferente de um jeito que muda a ideia. "t" é o segundo do bruto onde o bloco começa (0 se faltou).` : ""}
- Português do Brasil. Nunca use travessão.`;
  const r = await fetch(`${GROQ}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-oss-120b", temperature: 0.3, max_tokens: 4500, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "user", content: pedido }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "O limite grátis da IA deste minuto acabou. Espere um pouquinho e tente de novo." : "A IA não respondeu agora. Tente de novo.");
  return normalizar(lerJson(String(j.choices?.[0]?.message?.content || "")));
}

// correção: ela comenta o que não gostou e a IA devolve o plano corrigido, os ajustes visuais
// (estilo da legenda, título, cor, volume dos efeitos...) e uma regra curta para o padrão
const OPC_VALORES = `estilo: "capcut" (Poppins média, minúscula, sombra suave, o padrão dela) | "minimal" (fina e branca) | "bold" (forte com contorno) | "caixa" (caixinha bege)
fonteLeg: fonte da legenda: "minha" (a Bootzy que ela enviou, a preferida dela) | "montserrat" (sem serifa forte) | "poppins" (sem serifa média) | "nunito" (arredondada forte) | "dmserif" (serifada itálica) | "instrument" (serifada itálica fina)
sombra: "suave" | "dura" (sombra preta deslocada)
corLegenda: cor da legenda capcut em hexadecimal (padrão "#fff3b0", amarelo clarinho)
porLegenda: palavras por legenda no estilo capcut, de 1 a 4
chamativas: true ou false (palavras de destaque viram texto grande colorido com sombra dura e frase manuscrita)
sonsChamativas: true ou false (pop quando entra palavra chamativa)
confete, tremer (tremidinha no impacto), flash (flash na troca de cena): true ou false
estiloTitulo: "simples" (limpo, serifada itálica, o padrão dela; NUNCA use caixinhas, ela odiou) | "etapas" (em etapas com clique) | "frase" (frase gigante, 3 cores) | "caixa" (caixinhas)
altura: número de 0.35 (legenda no alto) a 0.88 (legenda bem embaixo)
cor: cor do destaque em hexadecimal, ex. "#f2c14e"
vol: volume dos efeitos de 0 a 1.2
sonsTitulo: true ou false (o painel põe sozinho cliques/pop na entrada do título; false tira esses sons)
maiusculas, titulo, efeitos, silencio, erros, zoomCortes, zoomEnfase: true ou false (efeitos false tira todos os sons)`;
const OPC_OK: Record<string, (v: any) => any> = {
  estilo: (v) => ["capcut", "minimal", "bold", "caixa"].includes(v) ? v : undefined,
  estiloTitulo: (v) => ["simples", "etapas", "frase", "caixa"].includes(v) ? v : undefined,
  fonteLeg: (v) => ["minha", "montserrat", "poppins", "nunito", "dmserif", "instrument"].includes(v) ? v : undefined,
  sombra: (v) => ["suave", "dura"].includes(v) ? v : undefined,
  corLegenda: (v) => /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : undefined,
  porLegenda: (v) => [1, 2, 3, 4].includes(Number(v)) ? Number(v) : undefined,
  altura: (v) => Number.isFinite(Number(v)) ? Math.min(0.88, Math.max(0.35, Number(v))) : undefined,
  cor: (v) => /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : undefined,
  vol: (v) => Number.isFinite(Number(v)) ? Math.min(1.2, Math.max(0, Number(v))) : undefined,
};
for (const k of ["chamativas", "sonsChamativas", "confete", "tremer", "flash", "sonsTitulo", "maiusculas", "titulo", "efeitos", "silencio", "erros", "zoomCortes", "zoomEnfase"]) OPC_OK[k] = (v) => typeof v === "boolean" ? v : undefined;

async function corrigir(chave: string, c: any) {
  const palavras = (Array.isArray(c.palavras) ? c.palavras : []).slice(0, 3000);
  const fala = palavras.map((p: any) => `[${Number(p.s).toFixed(1)}] ${p.w}`).join(" ");
  const atual = { titulo: txt(c.titulo, 60), ...(c.plano || {}) };
  delete (atual as any).roteiro_check;
  const pedido = `Você é videomaker e editor de Reels de uma criadora brasileira de UGC. Você editou um vídeo e ela pediu correções. Corrija a edição exatamente como ela pediu.

PADRÃO DE EDIÇÃO DELA (tirado das referências que ela mandou):
${txt(c.padrao, 4000)}

${c.roteiro ? "ROTEIRO DELA:\n" + txt(c.roteiro, 2000) + "\n\n" : ""}FALA DO VÍDEO BRUTO (segundo em que cada palavra começa):
${fala}

PLANO ATUAL DA EDIÇÃO:
${JSON.stringify(atual).slice(0, 6000)}

AJUSTES VISUAIS ATUAIS: ${JSON.stringify(c.opc || {})}
AJUSTES POSSÍVEIS:
${OPC_VALORES}

${Array.isArray(c.historico) && c.historico.length ? "CORREÇÕES QUE ELA JÁ PEDIU NESTE VÍDEO (continue respeitando): " + c.historico.slice(-5).map((h: unknown) => txt(h, 300)).join(" | ") + "\n\n" : ""}O QUE ELA PEDIU AGORA: ${txt(c.comentario, 1500)}

Responda SOMENTE um JSON com o plano inteiro já corrigido (mesmo formato do plano atual, com todos os campos, mesmo os que não mudaram), mais:
"opc": só os ajustes visuais que mudam (ex. {"estilo":"bold","maiusculas":true}),
"resposta": 1 ou 2 frases curtas dizendo o que você mudou,
"regra": uma regra curta e geral para o padrão de edição dela valer nos próximos vídeos (ex. "Legenda em maiúsculas, forte com contorno, no meio da tela"), ou "" se a correção só vale para este vídeo.
Se ela pedir para corrigir o TEXTO de uma legenda, explique na resposta que ela pode editar direto na lista de Legendas (o texto da legenda não muda por aqui). Regras: efeitos só destes tipos: woosh, suave, pop, click, shutter, typing, riser, hit, ding, cristal, brilho, spray, mensagem, relogio. Tempos em segundos do bruto. Português do Brasil. Nunca use travessão.`;
  const r = await fetch(`${GROQ}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-oss-120b", temperature: 0.2, max_tokens: 4500, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "user", content: pedido }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "O limite grátis da IA deste minuto acabou. Espere um pouquinho e tente de novo." : "A IA não respondeu agora. Tente de novo.");
  const a = lerJson(String(j.choices?.[0]?.message?.content || ""));
  const novo = normalizar(a);
  const opc: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a.opc || {})) { const f = OPC_OK[k]; const ok = f ? f(v) : undefined; if (ok !== undefined) opc[k] = ok; }
  return { plano: novo, opc, resposta: txt(a.resposta, 400), regra: txt(a.regra, 300) };
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
      const arq = form.get("arquivo");
      if (!(arq instanceof File)) return resposta({ error: "Faltou o áudio." }, 400);
      return resposta(await transcrever(chave, arq));
    }
    const corpo = await req.json().catch(() => ({}));
    if (corpo.acao === "plano") return resposta(await plano(chave, corpo));
    if (corpo.acao === "corrigir") return resposta(await corrigir(chave, corpo));
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ error: String((e as Error).message || "Algo deu errado.") }, 502);
  }
});
