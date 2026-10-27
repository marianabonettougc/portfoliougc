// =========================================================
// EDITOR: EXTRAS (Edge Function do Supabase)
// Criatividade > Edição de vídeos (js/edicao.js), abas "Referência", "Storyboard", "Variações" e "Carrossel".
// - JSON { acao: "referencia", pedido, focos, medidas, fala, quadros }: ela manda um vídeo de
//   referência e escreve o que quer copiar. O navegador mede (cortes, ritmo da fala, sons fora
//   da fala) e manda até 5 quadros pequenos. Um modelo de visão do Groq descreve os quadros
//   (legenda, título, textos, enquadramento) e o gpt-oss traduz tudo em ajustes do editor
//   (opc, só chaves conhecidas) + regras curtas para o plano.
// - JSON { acao: "carrossel", fala, titulo, tema, roteiro, n }: transforma o reel em carrossel
//   (capa + slides + legenda do post), na voz dela, em primeira pessoa.
// - JSON { acao: "storyboard", cenas, titulo, tema, roteiro, padrao, pedidos }: lê cada cena do
//   vídeo editado (tempo + fala) e devolve 2 sugestões concretas por cena, que dão para fazer no
//   editor dela (sons, zoom, corte, destaque, b-roll que ela grava), mais uma visão geral.
// - JSON { acao: "variacoes", cenas, titulo, tema, roteiro, n, mudar, duracao }: transforma o
//   vídeo aprovado em 3 a 5 cortes diferentes para Reels de teste (gancho novo, cena de abertura,
//   versão curta, ordem). O navegador confere se nenhuma ficou parecida demais.
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
const lerJson = (t: string) => { try { return JSON.parse(t); } catch { const m = t.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };

async function groq(chave: string, corpo: unknown) {
  const r = await fetch(`${GROQ}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "O limite grátis da IA deste minuto acabou. Espere um pouquinho e tente de novo." : "A IA não respondeu agora: " + (j?.error?.message || r.status));
  return String(j.choices?.[0]?.message?.content || "");
}

// modelo de visão disponível no Groq (a lista muda; escolhe pelo nome)
let visaoCache: string | null | undefined;
async function modeloVisao(chave: string) {
  if (visaoCache !== undefined) return visaoCache;
  try {
    const r = await fetch(`${GROQ}/models`, { headers: { Authorization: `Bearer ${chave}` } });
    const j = await r.json();
    const ids: string[] = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id));
    const pref = [/llama-4-maverick/i, /llama-4-scout/i, /llama-4/i, /vision/i, /(^|[-_/])vl([-_]|$)|qwen.*vl/i, /pixtral|gemma-3|kimi.*vl/i, /qwen3\.[5-9]|qwen-?[4-9]/i];
    visaoCache = null;
    // testa de verdade com uma imagem minúscula (o nome nem sempre diz se o modelo enxerga)
    const px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    for (const p of pref) for (const id of ids.filter((x) => p.test(x))) {
      const t = await fetch(`${GROQ}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: id, max_tokens: 5, messages: [{ role: "user", content: [{ type: "text", text: "Cor?" }, { type: "image_url", image_url: { url: px } }] }] }) });
      if (t.ok) { visaoCache = id; return visaoCache; }
    }
  } catch { visaoCache = null; }
  return visaoCache;
}

// ajustes que a aba Referência pode mudar no editor (mesmas regras da editor-video + estilos)
const OPC_VALORES = `estilo: "capcut" (legenda limpa, minúscula, sombra suave; o padrão dela) | "minimal" (fina e branca) | "bold" (forte com contorno)
fonteLeg: "arimo" (sem serifa firme, tipo Helvetica Bold) | "montserrat" (sem serifa forte) | "poppins" (sem serifa média) | "nunito" (arredondada forte) | "dmserif" (serifada itálica) | "instrument" (serifada itálica fina) | "minha" (a fonte Bootzy dela)
fonteTitulo: fonte do título do gancho: "dmserif" (serifada itálica, padrão) | "instrument" (serifada itálica fina) | "montserrat" | "poppins" | "arimo" | "nunito"
corLegenda: cor da legenda em hexadecimal (padrão "#fff3b0"); corTitulo: cor do título em hexadecimal ou "" (igual à legenda)
porLegenda: palavras por legenda, 1 a 4; tamLeg: tamanho da legenda 0.7 a 1.5 (1 normal); maiusculas: true/false
sombra: "suave" | "dura"
altura: altura da legenda 0.35 (alto) a 0.88 (bem embaixo); ladoLeg: "centro" | "esquerda" | "direita"; alturaTitulo: altura do título 0.1 a 0.6 (padrão 0.24)
ritmo: "normal" (deixa respiro) | "rapido" (corta respiros) | "turbo" (sem pausa)
sons: quantidade de efeitos sonoros: "nenhum" | "impacto" | "poucos" | "medio" | "muitos"
dinamismo: "calmo" | "normal" | "dinamico"
transicao: "nenhuma" | "punch" (zoom rápido no corte) | "deslize"
zoomCortes, zoomEnfase, flash, tremer, titulo, legenda, efeitos, sonsTitulo: true/false`;
const LISTA = (l: (string | number)[]) => (v: any) => l.includes(v) ? v : undefined;
const COR = (v: any) => /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : undefined;
const FAIXA = (a: number, b: number) => (v: any) => Number.isFinite(Number(v)) ? Math.min(b, Math.max(a, Number(v))) : undefined;
const OPC_OK: Record<string, (v: any) => any> = {
  estilo: LISTA(["capcut", "minimal", "bold"]),
  fonteLeg: LISTA(["minha", "arimo", "montserrat", "poppins", "nunito", "dmserif", "instrument"]),
  fonteTitulo: LISTA(["dmserif", "instrument", "montserrat", "poppins", "arimo", "nunito"]),
  corLegenda: COR, corTitulo: (v) => v === "" ? "" : COR(v),
  porLegenda: (v) => [1, 2, 3, 4].includes(Number(v)) ? Number(v) : undefined,
  tamLeg: FAIXA(0.7, 1.5), altura: FAIXA(0.35, 0.88), alturaTitulo: FAIXA(0.1, 0.6),
  sombra: LISTA(["suave", "dura"]), ladoLeg: LISTA(["centro", "esquerda", "direita"]),
  ritmo: LISTA(["normal", "rapido", "turbo"]), sons: LISTA(["nenhum", "impacto", "poucos", "medio", "muitos"]),
  dinamismo: LISTA(["calmo", "normal", "dinamico"]), transicao: LISTA(["nenhuma", "punch", "deslize"]),
};
for (const k of ["maiusculas", "zoomCortes", "zoomEnfase", "flash", "tremer", "titulo", "legenda", "efeitos", "sonsTitulo"]) OPC_OK[k] = (v) => typeof v === "boolean" ? v : undefined;

async function referencia(chave: string, c: any) {
  const quadros: string[] = (Array.isArray(c.quadros) ? c.quadros : []).filter((q: unknown) => typeof q === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(q as string) && (q as string).length < 900000).slice(0, 5);
  const pedido = txt(c.pedido, 1500);
  const focos = (Array.isArray(c.focos) ? c.focos : []).map((f: unknown) => txt(f, 30)).filter(Boolean).slice(0, 8);
  const m = c.medidas || {};
  // 1) visão: descreve os quadros (se tiver modelo de visão no Groq)
  let visto = "";
  const visao = quadros.length ? await modeloVisao(chave) : null;
  if (visao) {
    const tempos = (Array.isArray(m.temposQuadros) ? m.temposQuadros : []).map((t: unknown) => Number(t).toFixed(1) + " s").join(", ");
    try {
      visto = txt(await groq(chave, {
        model: visao, temperature: 0.2, max_tokens: 900,
        messages: [{ role: "user", content: [
          { type: "text", text: `Estes são ${quadros.length} quadros de um Reels vertical de referência (nos tempos ${tempos || "em ordem"}). Descreva SÓ o que dá para ver, em português, curto e objetivo, em tópicos:\n- LEGENDA DE FALA: tem? posição na tela (alto, meio, baixo; centro, esquerda, direita), quantas palavras por vez, maiúscula ou minúscula, tipo de fonte (sem serifa firme, serifada itálica, arredondada, manuscrita...), peso, cor, contorno ou sombra, se tem caixinha/fundo atrás.\n- TÍTULO OU TEXTO DE GANCHO: tem? onde, fonte, cor, tamanho, quantas linhas.\n- OUTROS ELEMENTOS: figurinhas, fotos ou cartões em volta da pessoa, setas, emojis, barra de progresso, textos de lista.\n- ENQUADRAMENTO E CÂMERA: plano (rosto, meio corpo, corpo inteiro), mudanças de zoom entre os quadros, b-roll/produto.\n- COR E LUZ: tom geral (quente, frio, claro, escuro), se parece filtro.\nNão invente o que não aparece.` },
          ...quadros.map((q) => ({ type: "image_url", image_url: { url: q } })),
        ] }],
      }), 2500);
    } catch (e) { visto = ""; console.error("visao", e); }
  }
  // 2) traduz em ajustes do editor
  const texto = `Você é editor de Reels de uma criadora brasileira de UGC. Ela mandou um vídeo de REFERÊNCIA e quer copiar coisas dele na edição dos vídeos dela (copiar o jeito, não o conteúdo).

O QUE ELA QUER COPIAR (prioridade máxima): ${pedido || "(não escreveu; copie o estilo geral da edição)"}${focos.length ? "\nPARTES MARCADAS: " + focos.join(", ") : ""}

MEDIDAS FEITAS NO VÍDEO DE REFERÊNCIA:
- duração: ${m.duracao ?? "?"} s; cortes (trocas de plano): ${m.cortes ?? "?"}; duração média de cada plano: ${m.planoMedio ?? "?"} s
- fala: ${m.palavras ?? "?"} palavras, ${m.ppm ?? "?"} palavras por minuto; pausas maiores que 0,4 s: ${m.pausas ?? "?"}
- sons percebidos fora da fala (efeitos sonoros prováveis, estimativa): ${m.sonsFora ?? "?"}${m.sonsPorSeg ? ` (1 a cada ${m.sonsPorSeg} s)` : ""}
- tem música de fundo contínua (estimativa): ${m.musica == null ? "?" : m.musica ? "sim" : "não"}

${visto ? "O QUE APARECE NOS QUADROS (visão):\n" + visto + "\n\n" : "Não deu para analisar a imagem; use só as medidas e o pedido.\n\n"}${c.fala ? "FALA DA REFERÊNCIA (para entender o ritmo e o gancho, não para copiar o texto):\n" + txt(c.fala, 2500) + "\n\n" : ""}AJUSTES DO EDITOR QUE VOCÊ PODE MUDAR:
${OPC_VALORES}

GOSTOS DELA (respeite sempre, mesmo que a referência tenha): nunca caixinhas ou cartões por cima da imagem, nunca fundo desfocado atrás de texto, nunca o mesmo efeito sonoro repetido o vídeo todo, nada de zoom vai-e-volta exagerado, legenda e textos nunca cobrindo o rosto.

Responda SOMENTE um JSON:
{"resumo":"2 ou 3 frases dizendo como é a edição da referência",
"viu":["até 8 observações curtas e concretas sobre a referência (legenda, título, ritmo, sons, câmera)"],
"opc":{"só os ajustes que mudam para ficar parecido com o que ela quer copiar"},
"regras":["até 6 regras curtas para o plano da edição (sons, zooms, cortes, b-roll, título) no formato de instrução, ex.: 'woosh suave em toda troca de assunto, 1 som a cada 2 s'"],
"nao_da":["o que a referência tem e o editor não faz (ex.: fotos em volta da pessoa, texto atrás da pessoa), com o jeito de fazer à mão no CapCut"],
"nome_estilo":"nome curto para salvar como estilo, 2 a 4 palavras"}
Mude só o que tem relação com o que ela pediu (se ela pediu só a legenda, não mexa em sons e ritmo). Português do Brasil. Nunca use travessão.`;
  const a = lerJson(await groq(chave, { model: "openai/gpt-oss-120b", temperature: 0.2, max_tokens: 3000, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "user", content: texto }] }));
  const opc: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a.opc || {})) { const f = OPC_OK[k]; const ok = f ? f(v) : undefined; if (ok !== undefined) opc[k] = ok; }
  const lista = (x: unknown, n: number, t = 220) => (Array.isArray(x) ? x : []).map((y) => txt(y, t)).filter(Boolean).slice(0, n);
  return { resumo: txt(a.resumo, 500), viu: lista(a.viu, 8), opc, regras: lista(a.regras, 6, 260), nao_da: lista(a.nao_da, 5, 260), nome_estilo: txt(a.nome_estilo, 40) || "Estilo da referência", visao: Boolean(visto), modelo_visao: visao || "" };
}

async function carrossel(chave: string, c: any) {
  const n = Math.min(10, Math.max(4, Number(c.n) || 7));
  const texto = `Você escreve carrosséis de Instagram para uma criadora brasileira de UGC, na voz dela, em primeira pessoa (como se ela mesma tivesse escrito), natural e direta, sem cara de propaganda. Transforme o Reels abaixo em um carrossel de ${n} cartões.

${c.tema ? "TEMA / MARCA: " + txt(c.tema, 300) + "\n" : ""}${c.titulo ? "TÍTULO DO REELS: " + txt(c.titulo, 120) + "\n" : ""}${c.roteiro ? "ROTEIRO:\n" + txt(c.roteiro, 2500) + "\n" : ""}FALA DO REELS:
${txt(c.fala, 6000)}

Responda SOMENTE um JSON:
{"slides":[{"titulo":"curto, até 7 palavras","texto":"até 26 palavras, ou \\"\\" na capa"}],
"legenda":"legenda do post em primeira pessoa, 3 a 6 linhas curtas, com uma pergunta ou CTA no fim, até 5 hashtags no fim",
"destaque":"uma palavra do título da capa para ir em itálico"}
Regras: o 1º cartão é a capa (gancho forte, sem texto); o último é o fechamento com CTA (salvar, comentar ou mandar para alguém). Os do meio levam uma ideia cada, na ordem da fala. Não invente números, resultados ou promessas que ela não falou. Nada de travessão. Português do Brasil.`;
  const a = lerJson(await groq(chave, { model: "openai/gpt-oss-120b", temperature: 0.5, max_tokens: 3000, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "user", content: texto }] }));
  const slides = (Array.isArray(a.slides) ? a.slides : []).map((s: any) => ({ titulo: txt(s.titulo, 80), texto: txt(s.texto, 260) })).filter((s: any) => s.titulo || s.texto).slice(0, 10);
  if (!slides.length) throw new Error("A IA não montou o carrossel agora. Tente de novo.");
  return { slides, legenda: txt(a.legenda, 2200), destaque: txt(a.destaque, 30) };
}

// cenas que o navegador manda: [{ i, de, ate, fala }] (tempo do vídeo editado, em segundos)
function lerCenas(c: any) {
  return (Array.isArray(c.cenas) ? c.cenas : []).slice(0, 40).map((x: any, k: number) => ({
    i: Number.isInteger(Number(x.i)) ? Number(x.i) : k,
    de: Math.max(0, Number(x.de) || 0), ate: Math.max(0, Number(x.ate) || 0), fala: txt(x.fala, 400),
  }));
}
const linhaCena = (x: any) => `CENA ${x.i + 1} (${x.de.toFixed(1)} a ${x.ate.toFixed(1)} s, ${(x.ate - x.de).toFixed(1)} s): "${x.fala || "(sem fala)"}"`;
const SONS_DELA = "woosh, whoosh suave, pop, clique, shutter (câmera), typing, riser, hit, ding, ding de cristal, brilho (sparkle), spray (borrifo), mensagem chegando, tique-taque";

async function storyboard(chave: string, c: any) {
  const cenas = lerCenas(c);
  if (!cenas.length) throw new Error("Não chegou nenhuma cena para analisar.");
  const texto = `Você é a editora de Reels de uma criadora brasileira de UGC (publis e conteúdo de produto, falando para a câmera, produto em uso real). Ela já tem a edição montada e quer revisar cena por cena, como num storyboard. Para CADA cena, dê 2 sugestões curtas e concretas para deixar a cena melhor.

${c.tema ? "TEMA / MARCA: " + txt(c.tema, 200) + "\n" : ""}${c.titulo ? "TÍTULO DO GANCHO NA TELA: " + txt(c.titulo, 120) + "\n" : ""}${c.roteiro ? "ROTEIRO DELA:\n" + txt(c.roteiro, 1800) + "\n" : ""}${c.pedidos ? "O QUE ELA PEDIU PARA ESTA EDIÇÃO: " + txt(c.pedidos, 600) + "\n" : ""}
PADRÃO DE EDIÇÃO DELA (resumo):
${txt(c.padrao, 2500)}

CENAS DO VÍDEO EDITADO:
${cenas.map(linhaCena).join("\n")}

O QUE O EDITOR DELA CONSEGUE FAZER (sugira só isso, citando a palavra ou o momento exato):
- efeito sonoro num momento (só destes: ${SONS_DELA}), dizendo em qual palavra;
- zoom de ênfase ou zoom rápido no corte numa palavra;
- palavra de destaque na legenda;
- cortar um pedaço da fala (repetição, frase fraca, começo lento) dizendo de onde até onde;
- trocar a ordem da cena (ex.: trazer para o começo) ou encurtar;
- b-roll que ELA mesma pode gravar (close do produto, textura, produto em uso real, print de tela), dizendo em qual fala entra;
- flash rápido no corte para o produto; mudar o título do gancho (só na cena 1).

GOSTOS DELA (nunca sugira o contrário): nada de caixinhas ou cartões por cima da imagem, nada de fundo desfocado atrás de texto, nada do mesmo som repetido o vídeo todo, nada de zoom vai-e-volta exagerado, nada de esquete ou personagem, legenda nunca cobrindo o rosto, nunca mexer na cor do vídeo.

Responda SOMENTE um JSON:
{"geral":"1 ou 2 frases sobre o vídeo inteiro (o que já funciona e o principal para melhorar)",
"cenas":[{"i":0,"sugestoes":["até 140 caracteres cada, em forma de instrução, ex.: 'Pop baixinho quando aparecer \\"hidratação\\" na legenda'","..."]}]}
Uma entrada por cena, com o mesmo "i". Português do Brasil. Nunca use travessão.`;
  const a = lerJson(await groq(chave, { model: "openai/gpt-oss-120b", temperature: 0.4, max_tokens: 4000, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "user", content: texto }] }));
  const validos = new Set(cenas.map((x: any) => x.i));
  const saida = (Array.isArray(a.cenas) ? a.cenas : []).filter((x: any) => validos.has(Number(x.i))).map((x: any) => ({
    i: Number(x.i), sugestoes: (Array.isArray(x.sugestoes) ? x.sugestoes : []).map((s: unknown) => txt(s, 180)).filter(Boolean).slice(0, 3),
  }));
  if (!saida.length) throw new Error("A IA não montou as sugestões agora. Tente de novo.");
  return { geral: txt(a.geral, 400), cenas: saida };
}

async function variacoes(chave: string, c: any) {
  const cenas = lerCenas(c);
  if (cenas.length < 2) throw new Error("O vídeo precisa ter pelo menos 2 cenas para virar variações.");
  const n = Math.min(5, Math.max(3, Number(c.n) || 3));
  const m = c.mudar || {};
  const dur = Number(c.duracao) || cenas.reduce((s: number, x: any) => Math.max(s, x.ate), 0);
  const pedidos: string[] = [];
  if (m.gancho !== false) pedidos.push("TODA variação tem um título de gancho NOVO (diferente do atual e dos das outras) e, quando fizer sentido, abre com outra cena (abrir_com) que funcione como gancho");
  if (m.curta) pedidos.push("pelo menos UMA variação é a versão curta, de 20 a 30 s: diga em \"cortar\" quais cenas sair (nunca a cena do CTA nem a que mostra o produto principal)");
  if (m.ordem) pedidos.push("pelo menos UMA variação muda a ordem: resultado primeiro (começa pelo resultado ou pela parte mais forte e depois conta) ou história primeiro; diga a ordem nova completa em \"ordem\"");
  const texto = `Você é a editora de Reels de uma criadora brasileira de UGC. Ela aprovou a edição de um vídeo e quer postar ${n} cortes diferentes dele como Reels de teste no Instagram (o Instagram mostra cada um para quem não segue, e ela vê qual gancho funciona). O Instagram ignora vídeo duplicado, então as versões têm que ser diferentes DE VERDADE, não só um título trocado.

${c.tema ? "TEMA / MARCA: " + txt(c.tema, 200) + "\n" : ""}TÍTULO ATUAL DO GANCHO: ${txt(c.titulo, 120) || "(sem título)"}
${c.roteiro ? "ROTEIRO DELA:\n" + txt(c.roteiro, 1500) + "\n" : ""}DURAÇÃO ATUAL: ${dur.toFixed(1)} s

CENAS (na ordem atual):
${cenas.map(linhaCena).join("\n")}

O QUE ELA QUER QUE MUDE:
- ${pedidos.join("\n- ") || "gancho novo em cada versão"}

Regras dos títulos: curtos (até 8 palavras), em primeira pessoa ou falando com quem assiste, sem clickbait mentiroso, sem prometer o que ela não fala no vídeo, sem travessão, sem emoji. "titulo_destaque" é UMA palavra do título que vai em itálico.

Responda SOMENTE um JSON:
{"variacoes":[{"nome":"2 a 4 palavras que dizem o que mudou, ex.: 'Resultado primeiro'",
"titulo":"gancho novo","titulo_destaque":"palavra",
"abrir_com":número da cena que abre o vídeo (o "i") ou null para manter,
"ordem":[lista completa de "i" na nova ordem] ou null para manter,
"cortar":[lista de "i" que saem] ou [],
"por_que":"1 frase: por que essa versão pode prender mais"}]}
Exatamente ${n} variações. Use só os números de cena que existem. Português do Brasil.`;
  const a = lerJson(await groq(chave, { model: "openai/gpt-oss-120b", temperature: 0.6, max_tokens: 4000, reasoning_effort: "low", response_format: { type: "json_object" }, messages: [{ role: "user", content: texto }] }));
  const validos = cenas.map((x: any) => x.i);
  const ok = (v: unknown) => validos.includes(Number(v));
  const saida = (Array.isArray(a.variacoes) ? a.variacoes : []).slice(0, n).map((v: any) => {
    let ordem = Array.isArray(v.ordem) ? [...new Set(v.ordem.map(Number).filter(ok))] : null;
    if (ordem && ordem.length !== validos.length) ordem = ordem.length ? [...ordem, ...validos.filter((i: number) => !ordem!.includes(i))] : null;
    const cortar = (Array.isArray(v.cortar) ? v.cortar : []).map(Number).filter(ok);
    return {
      nome: txt(v.nome, 40) || "Variação", titulo: txt(v.titulo, 80), titulo_destaque: txt(v.titulo_destaque, 30),
      abrir_com: ok(v.abrir_com) ? Number(v.abrir_com) : null, ordem, cortar: [...new Set(cortar)].slice(0, Math.max(0, validos.length - 2)),
      por_que: txt(v.por_que, 220),
    };
  }).filter((v: any) => v.titulo);
  if (!saida.length) throw new Error("A IA não montou as variações agora. Tente de novo.");
  return { variacoes: saida };
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
    if (corpo.acao === "referencia") return resposta(await referencia(chave, corpo));
    if (corpo.acao === "carrossel") return resposta(await carrossel(chave, corpo));
    if (corpo.acao === "storyboard") return resposta(await storyboard(chave, corpo));
    if (corpo.acao === "variacoes") return resposta(await variacoes(chave, corpo));
    if (corpo.acao === "visao") { const r = await fetch(`${GROQ}/models`, { headers: { Authorization: `Bearer ${chave}` } }); const j = await r.json().catch(() => ({})); return resposta({ modelo: await modeloVisao(chave), modelos: (j.data || []).map((m: any) => m.id) }); }
    return resposta({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return resposta({ error: String((e as Error).message || "Algo deu errado.") }, 502);
  }
});
