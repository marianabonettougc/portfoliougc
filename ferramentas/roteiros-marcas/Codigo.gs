/**
 * ROTEIROS PARA MARCAS (Google Docs)
 * Cada aba do documento é um roteiro. A marca abre o link, escolhe o gancho,
 * comenta e aprova. Você recebe um e-mail na hora e tudo fica na planilha de Feedback.
 */

// ====== SEUS DADOS (pode trocar) ======
const EMAIL_AVISO = "marianabonettougc@gmail.com";
const MEU_NOME = "Mari Bonetto";
const MINHA_ASSINATURA = "UGC Creator";
const ID_DO_DOCUMENTO = "1V7i4HEZhTdVCwgfPYsrdJ4zQ7S3_R8xDJw9I9RzcLzI";
// ======================================

const FUSO = "America/Sao_Paulo";
const COLUNAS_FEEDBACK = ["Data", "Roteiro (aba)", "Marca", "O que fez", "Parte", "Quem", "Texto", "Link do roteiro"];
const CAMPOS_FICHA = ["Produto", "Entrega", "Formato", "Duração", "Onde vai rodar"];
const CAMPOS_ANTES = [["Ideia do vídeo", ""], ["No set", ""]];
const CAMPOS_DEPOIS = [["Lettering", "texto na tela"], ["Tempo", ""], ["Pra confirmar com a marca", ""]];
const LIMITE_FOTO = 900000;

// Minha paleta
const COR = { creme: "#f6efe6", bege: "#efe3d3", cafe: "#6b4a35", texto: "#3d2b20", titulo: "#705548", destaque: "#a87058", branco: "#ffffff" };

/* ---------- Menu dentro do documento ---------- */

function onOpen() {
  DocumentApp.getUi()
    .createMenu("Roteiros")
    .addItem("Pegar o link deste roteiro", "linkDesteRoteiro")
    .addItem("Deixar esta aba na minha paleta", "aplicarPaleta")
    .addSeparator()
    .addItem("Abrir a planilha de Feedback", "abrirFeedback")
    .addItem("Testar o e-mail", "testarEmail")
    .addToUi();
}

function documento_() {
  try {
    const ativo = DocumentApp.getActiveDocument();
    if (ativo) return ativo;
  } catch (e) {}
  return DocumentApp.openById(ID_DO_DOCUMENTO);
}

// Lista as abas do documento: [{titulo, corpo}]
function abas_() {
  const doc = documento_();
  const lista = [];
  const andar = function (tabs) {
    tabs.forEach(function (t) {
      try { lista.push({ titulo: String(t.getTitle() || "").trim(), corpo: t.asDocumentTab().getBody() }); } catch (e) {}
      try { andar(t.getChildTabs()); } catch (e) {}
    });
  };
  try { andar(doc.getTabs()); } catch (e) {}
  if (!lista.length) lista.push({ titulo: "Roteiro", corpo: doc.getBody() });
  return lista;
}

function abaAtiva_() {
  const doc = documento_();
  try {
    const t = doc.getActiveTab();
    return { titulo: String(t.getTitle() || "").trim(), corpo: t.asDocumentTab().getBody() };
  } catch (e) {
    return abas_()[0];
  }
}

function acharAba_(nome) {
  const alvo = String(nome || "").trim().toLowerCase();
  if (!alvo) return null;
  const lista = abas_();
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].titulo.toLowerCase() === alvo) return lista[i];
  }
  return null;
}

function enderecoDoApp_() {
  const guardado = PropertiesService.getScriptProperties().getProperty("URL_APP");
  if (guardado) return guardado;
  let url = "";
  try { url = ScriptApp.getService().getUrl() || ""; } catch (e) {}
  return /\/exec$/.test(url) ? url : "";
}

function linkDoRoteiro_(aba) {
  const base = enderecoDoApp_();
  return base ? base + "?r=" + encodeURIComponent(aba) : "";
}

function janela_(titulo, corpoHtml, altura) {
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#3d2b20">' + corpoHtml + "</div>"
  ).setWidth(470).setHeight(altura || 220);
  DocumentApp.getUi().showModalDialog(html, titulo);
}

function campoCopiar_(link) {
  return '<input id="l" readonly style="width:100%;padding:10px;font-size:13px;border:1px solid #cdbba9;border-radius:8px" value="' + escaparHtml_(link) + '">' +
    '<p><button onclick="var l=document.getElementById(\'l\');l.select();document.execCommand(\'copy\');this.textContent=\'Copiado\'" ' +
    'style="background:#6b4a35;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer">Copiar link</button> ' +
    '<a href="' + escaparHtml_(link) + '" target="_blank" style="margin-left:10px;color:#6b4a35">Abrir</a></p>';
}

function linkDesteRoteiro() {
  const ui = DocumentApp.getUi();
  const aba = abaAtiva_();
  const roteiro = lerRoteiro_(aba.titulo);
  if (!roteiro || !roteiro.partes.length) {
    ui.alert("Não achei o roteiro nesta aba (" + aba.titulo + "). Ela precisa ter as tabelas do modelo: ganchos e cenas.");
    return;
  }
  const repetidas = abas_().filter(function (a) { return a.titulo.toLowerCase() === aba.titulo.toLowerCase(); }).length;
  if (repetidas > 1) {
    ui.alert("Existem " + repetidas + " abas com o nome \"" + aba.titulo + "\". Dê um nome diferente para cada roteiro (exemplo: COZA-01) e tente de novo.");
    return;
  }
  const link = linkDoRoteiro_(aba.titulo);
  if (!link) {
    ui.alert("O link ainda não existe. Publique primeiro (Implantar > Nova implantação) e abra uma vez o endereço que o Google mostrar.");
    return;
  }
  janela_("Link para a marca",
    "<p>Link do roteiro <b>" + escaparHtml_(aba.titulo) + "</b> (" + escaparHtml_(roteiro.marca) + "):</p>" + campoCopiar_(link) +
    '<p style="color:#6e5646;font-size:12px">Teste numa janela anônima antes de mandar. Não mude o nome da aba depois de enviar.</p>', 240);
}

function abrirFeedback() {
  const link = planilhaFeedback_().getUrl();
  janela_("Planilha de Feedback", "<p>Tudo o que as marcas fazem fica guardado aqui:</p>" + campoCopiar_(link), 200);
}

function testarEmail() {
  planilhaFeedback_();
  MailApp.sendEmail({
    to: EMAIL_AVISO,
    subject: "Teste: avisos dos roteiros funcionando",
    body: "Se você recebeu este e-mail, os avisos dos roteiros estão funcionando.",
    name: "Roteiros " + MEU_NOME
  });
  DocumentApp.getUi().alert("E-mail de teste enviado para " + EMAIL_AVISO + ". Confira a caixa de entrada.");
}

/* ---------- Minha paleta no documento ---------- */

function aplicarPaleta() {
  const corpo = abaAtiva_().corpo;
  const texto = corpo.editAsText();
  const tamanho = texto.getText().length;
  if (tamanho) {
    texto.setFontFamily(0, tamanho - 1, "Poppins");
    texto.setForegroundColor(0, tamanho - 1, COR.texto);
  }
  const tabelas = corpo.getTables();
  tabelas.forEach(function (tabela) {
    try { tabela.setBorderColor(COR.cafe); } catch (e) {}
    for (let i = 0; i < tabela.getNumRows(); i++) {
      const linha = tabela.getRow(i);
      const n = linha.getNumCells();
      const primeiro = n ? linha.getCell(0).getText().trim() : "";
      const faixa = /^(ROTEIRO\s*\||GANCHOS\s*·|ROTEIRO\s*·)/i.test(primeiro);
      for (let j = 0; j < n; j++) {
        const celula = linha.getCell(j);
        const t = celula.editAsText();
        const fim = t.getText().length - 1;
        if (faixa) {
          celula.setBackgroundColor(COR.cafe);
          if (fim >= 0) {
            t.setForegroundColor(0, fim, COR.branco);
            if (/^ROTEIRO\s*\|/i.test(primeiro)) t.setFontFamily(0, fim, "DM Serif Display");
          }
          continue;
        }
        const rotulo = (j === 0 && n === 2) || /^(ESCOLHA|ÁUDIO|IMAGEM|REFERÊNCIA)/i.test(celula.getText().trim());
        const fundo = String(celula.getBackgroundColor() || "").toLowerCase();
        if (rotulo) celula.setBackgroundColor(COR.bege);
        else if (fundo && fundo !== "#ffffff") celula.setBackgroundColor(COR.creme);
        if (rotulo && fim >= 0) t.setForegroundColor(0, fim, COR.titulo);
      }
    }
  });
  DocumentApp.getUi().alert("Pronto. Esta aba está na sua paleta (creme, bege e café, com Poppins).");
}

/* ---------- Ler o roteiro do documento ---------- */

function semAcento_(t) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function escaparHtml_(t) {
  return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function limparTexto_(t) {
  return String(t || "").replace(/[\u000b\r]/g, "\n").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function semAspas_(t) {
  return limparTexto_(t).replace(/^[“"']+/, "").replace(/[”"']+$/, "").trim();
}

// Tira a primeira linha (o nome da cena) e devolve [primeira linha, resto]
function separarPrimeiraLinha_(t) {
  const texto = limparTexto_(t);
  const p = texto.indexOf("\n");
  if (p < 0) return [texto, ""];
  return [texto.slice(0, p).trim(), texto.slice(p + 1).trim()];
}

function linkDaCelula_(celula) {
  let link = "";
  try {
    const t = celula.editAsText();
    const pontos = t.getTextAttributeIndices();
    for (let i = 0; i < pontos.length && !link; i++) link = t.getLinkUrl(pontos[i]) || "";
  } catch (e) {}
  const achado = link || (String(celula.getText()).match(/https?:\/\/\S+/) || [""])[0];
  return /^https?:\/\//i.test(achado) ? achado : "";
}

function fotoEmDados_(imagem) {
  try {
    const blob = imagem.getBlob();
    const bytes = blob.getBytes();
    if (bytes.length > LIMITE_FOTO) return "";
    return "data:" + (blob.getContentType() || "image/png") + ";base64," + Utilities.base64Encode(bytes);
  } catch (e) {
    return "";
  }
}

function fotoDaCelula_(celula) {
  try {
    const achado = celula.findElement(DocumentApp.ElementType.INLINE_IMAGE);
    return achado ? fotoEmDados_(achado.getElement().asInlineImage()) : "";
  } catch (e) {
    return "";
  }
}

// Logo: primeira imagem da aba que está fora das tabelas
function logoDaAba_(corpo) {
  try {
    const imagens = corpo.getImages();
    for (let i = 0; i < imagens.length; i++) {
      let pai = imagens[i].getParent();
      let dentroDeTabela = false;
      while (pai) {
        const tipo = pai.getType();
        if (tipo === DocumentApp.ElementType.TABLE_CELL) { dentroDeTabela = true; break; }
        if (tipo === DocumentApp.ElementType.BODY_SECTION) break;
        pai = pai.getParent();
      }
      if (!dentroDeTabela) return fotoEmDados_(imagens[i]);
    }
  } catch (e) {}
  return "";
}

function lerRoteiro_(nome) {
  const aba = acharAba_(nome);
  if (!aba) return null;
  const r = { aba: aba.titulo, marca: "", logo: "", titulo: "", creator: "", ficha: [], antes: [], depois: [], partes: [] };
  const campos = {};
  const rotulosCabeca = ["creator", "marca", "produto", "entrega", "formato", "duracao", "onde vai rodar", "logo"];
  const rotulosLinha = CAMPOS_ANTES.concat(CAMPOS_DEPOIS).map(function (c) { return semAcento_(c[0]); });
  let pesoFotos = 0;

  aba.corpo.getTables().forEach(function (tabela) {
    for (let i = 0; i < tabela.getNumRows(); i++) {
      const linha = tabela.getRow(i);
      const n = linha.getNumCells();
      const celulas = [];
      for (let j = 0; j < n; j++) celulas.push(linha.getCell(j));
      const textos = celulas.map(function (c) { return limparTexto_(c.getText()); });
      const primeiro = semAcento_(textos[0]).replace(/^[^a-z0-9]+/, "");

      // Cabeçalho: "MARCA: valor" dentro de cada célula
      let achouCabeca = false;
      textos.forEach(function (t, j) {
        const m = /^([^:\n]{2,20}):\s*([\s\S]*)$/.exec(t);
        if (!m) return;
        const rotulo = semAcento_(m[1]);
        if (rotulosCabeca.indexOf(rotulo) < 0) return;
        achouCabeca = true;
        const valor = limparTexto_(m[2]);
        if (rotulo === "logo") r.logo = linkDaCelula_(celulas[j]);
        else campos[rotulo] = valor;
      });
      if (achouCabeca) continue;

      // Ganchos: "☐ Gancho 1" | áudio | imagem
      const g = /^gancho\s*(\d+)/.exec(primeiro);
      if (g && n >= 2) {
        r.partes.push({ parte: "Gancho " + g[1], audio: semAspas_(textos[1]), imagem: n > 2 ? textos[2] : "", ref: n > 3 ? linkDaCelula_(celulas[3]) : "", foto: "" });
        continue;
      }

      // Cenas: "Cena 1 · nome + fala" | "Cena 1 + o que aparece" | referência
      if (/^cena\s*\d+/.test(primeiro)) {
        const a = separarPrimeiraLinha_(textos[0]);
        let imagem = n > 1 ? textos[1] : "";
        const b = separarPrimeiraLinha_(imagem);
        if (/^cena\s*\d+/.test(semAcento_(b[0]))) imagem = b[1];
        let foto = "";
        if (n > 2) {
          foto = fotoDaCelula_(celulas[2]);
          if (foto && pesoFotos + foto.length > 4000000) foto = "";
          pesoFotos += foto.length;
        }
        r.partes.push({ parte: a[0], audio: a[1], imagem: imagem, ref: n > 2 ? linkDaCelula_(celulas[2]) : "", foto: foto });
        continue;
      }

      // Linhas de duas colunas: "IDEIA DO VÍDEO" | texto
      if (n >= 2) {
        const rotulo = semAcento_(separarPrimeiraLinha_(textos[0])[0]);
        if (rotulosLinha.indexOf(rotulo) >= 0 && textos[1]) campos[rotulo] = textos[1];
      }
    }
  });

  r.marca = campos.marca || aba.titulo;
  r.creator = campos.creator || "";
  r.titulo = campos.produto || "";
  if (!r.logo) r.logo = logoDaAba_(aba.corpo);
  CAMPOS_FICHA.forEach(function (c) {
    const valor = campos[semAcento_(c)];
    if (valor) r.ficha.push({ rotulo: c, texto: valor });
  });
  [[CAMPOS_ANTES, r.antes], [CAMPOS_DEPOIS, r.depois]].forEach(function (par) {
    par[0].forEach(function (c) {
      const valor = campos[semAcento_(c[0])];
      if (valor) par[1].push({ parte: c[0], sub: c[1], texto: valor });
    });
  });
  return r;
}

/* ---------- Planilha de Feedback (criada sozinha) ---------- */

function planilhaFeedback_() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty("ID_FEEDBACK");
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create("Feedback dos roteiros");
    props.setProperty("ID_FEEDBACK", ss.getId());
    const nova = ss.getSheets()[0];
    nova.setName("Feedback");
  }
  return ss;
}

function abaFeedback_() {
  const ss = planilhaFeedback_();
  let sh = ss.getSheetByName("Feedback");
  if (!sh) sh = ss.getSheets()[0];
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLUNAS_FEEDBACK.length).setValues([COLUNAS_FEEDBACK])
      .setFontWeight("bold").setBackground("#6b4a35").setFontColor("#ffffff");
    sh.setFrozenRows(1);
    sh.setColumnWidth(7, 420);
  }
  return sh;
}

function lerEstado_(aba) {
  const estado = { gancho: "", aprovado: null, comentarios: [] };
  const sh = abaFeedback_();
  if (sh.getLastRow() < 2) return estado;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getDisplayValues();
  const alvo = String(aba).trim().toLowerCase();
  v.forEach(function (l) {
    if (String(l[1]).trim().toLowerCase() !== alvo) return;
    const tipo = semAcento_(l[3]);
    if (tipo === "gancho escolhido") estado.gancho = l[4];
    else if (tipo === "aprovacao") estado.aprovado = { nome: l[5], quando: l[0] };
    else if (tipo === "comentario") estado.comentarios.push({ parte: l[4], nome: l[5], texto: l[6], quando: l[0] });
  });
  return estado;
}

/* ---------- Página que a marca abre ---------- */

function doGet(e) {
  try {
    const url = ScriptApp.getService().getUrl();
    if (/\/exec$/.test(url)) PropertiesService.getScriptProperties().setProperty("URL_APP", url);
  } catch (erro) {}

  const nome = e && e.parameter ? e.parameter.r : "";
  const roteiro = nome ? lerRoteiro_(nome) : null;
  const valido = roteiro && roteiro.partes.length;
  const dados = valido
    ? { ok: true, roteiro: roteiro, estado: lerEstado_(roteiro.aba), autora: MEU_NOME, assinatura: MINHA_ASSINATURA }
    : { ok: false, autora: MEU_NOME, assinatura: MINHA_ASSINATURA };
  const json = JSON.stringify(dados).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, " ");
  const html = PAGINA.replace("__DADOS__", function () { return json; });
  return HtmlService.createHtmlOutput(html)
    .setTitle(valido ? "Roteiro " + roteiro.marca : "Roteiro")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/* ---------- Receber a resposta da marca ---------- */

function limpar_(t, max) {
  return String(t == null ? "" : t).replace(/\s+$/g, "").replace(/^\s+/g, "").slice(0, max);
}

function paraCelula_(t) {
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function registrar(p) {
  p = p || {};
  const roteiro = lerRoteiro_(p.r);
  if (!roteiro || !roteiro.partes.length) throw new Error("Roteiro não encontrado.");
  const tipo = String(p.tipo || "");
  const nome = limpar_(p.nome, 80);
  const texto = limpar_(p.texto, 2000);
  let parte = limpar_(p.parte, 120);
  let oQueFez = "";

  if (tipo === "gancho") {
    oQueFez = "Gancho escolhido";
  } else if (tipo === "comentario") {
    oQueFez = "Comentário";
    if (!texto) throw new Error("Escreva o comentário antes de enviar.");
  } else if (tipo === "aprovar") {
    oQueFez = "Aprovação";
    if (!nome) throw new Error("Escreva o nome de quem está aprovando.");
    parte = "";
  } else {
    throw new Error("Pedido inválido.");
  }
  if (tipo !== "aprovar") {
    const existe = roteiro.partes.concat(roteiro.antes, roteiro.depois).some(function (x) { return x.parte === parte; });
    if (!existe) throw new Error("Essa parte não existe mais no roteiro. Atualize a página.");
  }

  const link = linkDoRoteiro_(roteiro.aba);
  const quando = Utilities.formatDate(new Date(), FUSO, "dd/MM/yyyy HH:mm");
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    abaFeedback_().appendRow([quando, roteiro.aba, roteiro.marca, oQueFez, parte, paraCelula_(nome), paraCelula_(texto), link]);
    SpreadsheetApp.flush();
  } finally {
    trava.releaseLock();
  }

  try {
    avisar_(roteiro, oQueFez, parte, nome, texto, link, quando);
  } catch (erro) {
    console.error("Não consegui mandar o e-mail: " + erro);
  }
  return lerEstado_(roteiro.aba);
}

function avisar_(roteiro, oQueFez, parte, nome, texto, link, quando) {
  let assunto = roteiro.marca + ": ";
  if (oQueFez === "Aprovação") assunto += "roteiro APROVADO por " + nome;
  else if (oQueFez === "Gancho escolhido") assunto += "escolheu o " + parte;
  else assunto += "comentou em " + parte;

  const linhas = [
    ["Marca", roteiro.marca],
    ["Roteiro", roteiro.titulo ? roteiro.titulo + " (aba " + roteiro.aba + ")" : roteiro.aba],
    ["O que fez", oQueFez],
    ["Parte", parte],
    ["Quem", nome],
    ["Texto", texto],
    ["Quando", quando]
  ].filter(function (l) { return l[1]; });

  const corpo = linhas.map(function (l) { return l[0] + ": " + l[1]; }).join("\n") + (link ? "\n\nAbrir o roteiro: " + link : "");
  const html =
    '<div style="font-family:Arial,sans-serif;color:#3d2b20;max-width:560px">' +
    '<h2 style="color:#705548;margin:0 0 12px">' + escaparHtml_(assunto) + "</h2>" +
    '<table style="border-collapse:collapse;width:100%">' +
    linhas.map(function (l) {
      return '<tr><td style="padding:8px 10px;border-bottom:1px solid #eadfd2;color:#6e5646;white-space:nowrap;vertical-align:top">' + escaparHtml_(l[0]) +
        '</td><td style="padding:8px 10px;border-bottom:1px solid #eadfd2;white-space:pre-wrap">' + escaparHtml_(l[1]) + "</td></tr>";
    }).join("") +
    "</table>" +
    (link ? '<p style="margin:18px 0"><a href="' + escaparHtml_(link) + '" style="background:#6b4a35;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block">Abrir o roteiro</a></p>' : "") +
    "</div>";

  MailApp.sendEmail({ to: EMAIL_AVISO, subject: assunto, body: corpo, htmlBody: html, name: "Roteiros " + MEU_NOME });
}

/* ---------- Visual da página ---------- */

const PAGINA = String.raw`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<base target="_blank">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --creme:#f6efe6; --papel:#fffdf9; --cafe:#6b4a35; --cafe2:#8a634b; --texto:#3d2b20; --suave:#6e5646; --titulo:#705548; --ital:#a87058; --linha:#e6d9c9; --verde:#4f7a54; --vermelho:#c5533f; }
  * { box-sizing:border-box; }
  html, body { margin:0; }
  body { background:var(--creme); color:var(--texto); font-family:Poppins, Arial, sans-serif; font-size:15px; line-height:1.55; -webkit-text-size-adjust:100%; }
  .folha { max-width:720px; margin:0 auto; padding:28px 16px 90px; }
  .topo { text-align:center; padding:8px 0 22px; }
  .logo { max-width:150px; max-height:84px; object-fit:contain; margin:0 auto 14px; display:block; }
  .sobre { font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--cafe2); margin:0 0 6px; }
  h1 { font-family:"DM Serif Display", Georgia, serif; font-weight:400; color:var(--titulo); font-size:34px; line-height:1.1; margin:0; overflow-wrap:anywhere; }
  .tit { font-family:"DM Serif Display", Georgia, serif; font-style:italic; color:var(--ital); font-size:20px; margin:8px 0 0; overflow-wrap:anywhere; }
  .por { color:var(--suave); font-size:13px; margin:10px 0 0; }
  .como { background:var(--papel); border:1px solid var(--linha); border-radius:14px; padding:14px 16px; margin:0 0 26px; color:var(--suave); font-size:14px; }
  .como b { color:var(--texto); font-weight:600; }
  h2 { font-family:"DM Serif Display", Georgia, serif; font-weight:400; color:var(--titulo); font-size:24px; margin:30px 0 4px; }
  h2 i { color:var(--ital); }
  .dica { color:var(--suave); font-size:13px; margin:0 0 14px; }
  .cartao { background:var(--papel); border:1px solid var(--linha); border-radius:16px; padding:16px; margin:0 0 14px; }
  .cartao.escolhido { border-color:var(--verde); box-shadow:0 0 0 2px rgba(79,122,84,.18); }
  .parte { display:inline-block; font-size:11px; letter-spacing:.14em; text-transform:uppercase; font-weight:600; color:#fff; background:var(--cafe); border-radius:99px; padding:4px 12px; margin:0 0 12px; }
  .escolhido .parte { background:var(--verde); }
  .rot { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--cafe2); font-weight:600; margin:10px 0 2px; }
  .txt { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; }
  .txt.fala { font-size:16px; }
  .ficha { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:1px; background:var(--linha); border:1px solid var(--linha); border-radius:14px; overflow:hidden; margin:0 0 14px; }
  .ficha div { background:var(--papel); padding:10px 14px; }
  .ficha .rot { margin:0 0 1px; }
  .ficha div:last-child:nth-child(odd) { grid-column:1 / -1; }
  .ficha p { margin:0; overflow-wrap:anywhere; }
  .foto { display:block; width:100%; max-height:420px; object-fit:cover; border-radius:12px; margin:12px 0 0; border:1px solid var(--linha); }
  .acoes { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 0; }
  button, .bt { font-family:inherit; font-size:14px; font-weight:500; border-radius:10px; padding:10px 16px; cursor:pointer; border:1px solid var(--cafe); background:transparent; color:var(--cafe); text-decoration:none; display:inline-flex; align-items:center; gap:6px; min-height:42px; }
  button.cheio { background:var(--cafe); color:#fff; }
  button.verde { background:var(--verde); border-color:var(--verde); color:#fff; }
  button:disabled { opacity:.55; cursor:default; }
  .caixa { margin:12px 0 0; display:none; }
  .caixa.aberta { display:block; }
  textarea, input[type=text] { width:100%; font-family:inherit; font-size:16px; color:var(--texto); background:#fff; border:1px solid #cdbba9; border-radius:10px; padding:11px 12px; margin:0 0 8px; }
  textarea { min-height:92px; resize:vertical; }
  textarea:focus, input:focus { outline:2px solid rgba(107,74,53,.3); border-color:var(--cafe); }
  .coment { border-left:3px solid var(--ital); background:#faf3ea; border-radius:0 10px 10px 0; padding:9px 12px; margin:10px 0 0; font-size:14px; }
  .coment small { display:block; color:var(--suave); font-size:12px; margin-top:3px; }
  .coment p { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; }
  .aprovar { background:var(--papel); border:1px solid var(--linha); border-radius:16px; padding:20px 16px; margin:30px 0 0; text-align:center; }
  .aprovar h2 { margin-top:0; }
  .aprovar input { max-width:380px; text-align:center; }
  .aprovar button { width:100%; max-width:380px; justify-content:center; font-size:16px; padding:13px 16px; }
  .selo { background:#edf3ea; border:1px solid var(--verde); color:#33563a; border-radius:14px; padding:14px 16px; margin:0 0 22px; text-align:center; font-weight:500; }
  .rodape { text-align:center; color:var(--suave); font-size:12px; margin:34px 0 0; }
  .aviso { position:fixed; left:50%; bottom:22px; transform:translateX(-50%) translateY(30px); background:var(--texto); color:#fff; padding:11px 18px; border-radius:99px; font-size:14px; opacity:0; transition:all .25s; max-width:90%; text-align:center; pointer-events:none; z-index:9; }
  .aviso.ver { opacity:1; transform:translateX(-50%) translateY(0); }
  .aviso.erro { background:var(--vermelho); }
  .vazio { text-align:center; padding:70px 10px; color:var(--suave); }
  @media (max-width:520px) { h1 { font-size:28px; } .folha { padding-top:18px; } .acoes button, .acoes .bt { flex:1 1 auto; justify-content:center; } }
</style>
</head>
<body>
<div class="folha" id="folha"></div>
<div class="aviso" id="aviso"></div>
<script>
var DADOS = __DADOS__;
var estado = DADOS.estado || { gancho: "", aprovado: null, comentarios: [] };
var ultimoNome = "";
var rascunhos = {};
var abertas = {};

function el(tag, classe, texto) {
  var e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto != null) e.textContent = texto;
  return e;
}

function avisar(msg, erro) {
  var a = document.getElementById("aviso");
  a.textContent = msg;
  a.className = "aviso ver" + (erro ? " erro" : "");
  clearTimeout(avisar.t);
  avisar.t = setTimeout(function () { a.className = "aviso"; }, erro ? 5000 : 2800);
}

function ehGancho(p) { return !p.texto && /^\s*gancho/i.test(p.parte); }
function ehFoto(link) { return /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(link); }
function idDoDrive(link) {
  var m = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]{20,})/i.exec(link);
  return m ? m[1] : "";
}
function linkDaFoto(link) {
  var id = idDoDrive(link);
  return id ? "https://drive.google.com/thumbnail?id=" + id + "&sz=w1200" : link;
}

function botaoRef(link) {
  var a = el("a", "bt", "Ver referência");
  a.href = link; a.target = "_blank"; a.rel = "noopener";
  return a;
}

function enviar(dados, botao, depois) {
  if (botao) { botao.disabled = true; botao.dataset.txt = botao.textContent; botao.textContent = "Enviando..."; }
  dados.r = DADOS.roteiro.aba;
  google.script.run
    .withSuccessHandler(function (novo) {
      estado = novo || estado;
      if (depois) depois();
      desenhar();
    })
    .withFailureHandler(function (erro) {
      if (botao) { botao.disabled = false; botao.textContent = botao.dataset.txt; }
      avisar(String((erro && erro.message) || erro || "Não deu certo. Tente de novo.").replace(/^Error:\s*/, ""), true);
    })
    .registrar(dados);
}

function cartao(p) {
  var gancho = ehGancho(p);
  var c = el("div", "cartao" + (gancho && estado.gancho === p.parte ? " escolhido" : ""));
  c.appendChild(el("div", "parte", p.parte + (gancho && estado.gancho === p.parte ? " · escolhido" : "")));
  if (p.sub) c.appendChild(el("div", "rot", p.sub));
  if (p.texto) c.appendChild(el("p", "txt", p.texto));
  if (p.audio) { c.appendChild(el("div", "rot", "Áudio · o que eu falo")); c.appendChild(el("p", "txt fala", p.audio)); }
  if (p.imagem) { c.appendChild(el("div", "rot", "Imagem · o que aparece")); c.appendChild(el("p", "txt", p.imagem)); }

  var acoes = el("div", "acoes");
  if (p.foto) {
    var fo = el("img", "foto"); fo.alt = "Referência de " + p.parte; fo.src = p.foto;
    c.appendChild(fo);
  }
  if (p.ref) {
    if (ehFoto(p.ref) || idDoDrive(p.ref)) {
      var img = el("img", "foto");
      img.alt = "Referência de " + p.parte;
      img.loading = "lazy";
      img.onerror = function () { img.remove(); acoes.insertBefore(botaoRef(p.ref), acoes.firstChild); };
      img.src = linkDaFoto(p.ref);
      c.appendChild(img);
    } else {
      acoes.appendChild(botaoRef(p.ref));
    }
  }

  if (gancho) {
    var eg = el("button", estado.gancho === p.parte ? "verde" : "cheio", estado.gancho === p.parte ? "Gancho escolhido" : "Escolher este gancho");
    if (estado.gancho === p.parte) eg.disabled = true;
    eg.onclick = function () {
      enviar({ tipo: "gancho", parte: p.parte, nome: ultimoNome }, eg, function () { avisar("Gancho escolhido. Obrigada!"); });
    };
    acoes.appendChild(eg);
  }

  var bc = el("button", "", "Comentar");
  acoes.appendChild(bc);
  c.appendChild(acoes);

  var caixa = el("div", "caixa" + (abertas[p.parte] ? " aberta" : ""));
  var ta = el("textarea"); ta.placeholder = "Escreva seu comentário sobre " + p.parte; ta.maxLength = 2000; ta.value = rascunhos[p.parte] || "";
  ta.oninput = function () { rascunhos[p.parte] = ta.value; };
  var nm = el("input"); nm.type = "text"; nm.placeholder = "Seu nome (opcional)"; nm.maxLength = 80; nm.value = ultimoNome;
  nm.oninput = function () { ultimoNome = nm.value; };
  var be = el("button", "cheio", "Enviar comentário");
  be.onclick = function () {
    var t = ta.value.trim();
    if (!t) { avisar("Escreva o comentário antes de enviar.", true); ta.focus(); return; }
    enviar({ tipo: "comentario", parte: p.parte, nome: nm.value.trim(), texto: t }, be, function () {
      rascunhos[p.parte] = ""; abertas[p.parte] = false; avisar("Comentário enviado. Obrigada!");
    });
  };
  caixa.appendChild(ta); caixa.appendChild(nm); caixa.appendChild(be);
  c.appendChild(caixa);
  bc.onclick = function () {
    abertas[p.parte] = !abertas[p.parte];
    caixa.className = "caixa" + (abertas[p.parte] ? " aberta" : "");
    if (abertas[p.parte]) ta.focus();
  };

  estado.comentarios.forEach(function (k) {
    if (k.parte !== p.parte) return;
    var d = el("div", "coment");
    d.appendChild(el("p", "", k.texto));
    d.appendChild(el("small", "", (k.nome || "Marca") + " · " + k.quando));
    c.appendChild(d);
  });
  return c;
}

function desenhar() {
  var f = document.getElementById("folha");
  f.textContent = "";
  if (!DADOS.ok) {
    var v = el("div", "vazio");
    v.appendChild(el("h1", "", "Roteiro não encontrado"));
    v.appendChild(el("p", "", "Confira se o link está completo ou peça um novo link para " + DADOS.autora + "."));
    f.appendChild(v);
    return;
  }
  var r = DADOS.roteiro;
  var topo = el("div", "topo");
  if (r.logo) {
    var lg = el("img", "logo"); lg.alt = "Logo " + r.marca; lg.onerror = function () { lg.remove(); }; lg.src = linkDaFoto(r.logo);
    topo.appendChild(lg);
  }
  topo.appendChild(el("p", "sobre", "Roteiro para aprovação"));
  topo.appendChild(el("h1", "", r.marca));
  if (r.titulo) topo.appendChild(el("p", "tit", r.titulo));
  topo.appendChild(el("p", "por", "por " + (r.creator || DADOS.autora + " · " + DADOS.assinatura)));
  f.appendChild(topo);

  if (estado.aprovado) {
    f.appendChild(el("div", "selo", "Roteiro aprovado por " + estado.aprovado.nome + " em " + estado.aprovado.quando));
  }

  var ganchos = r.partes.filter(ehGancho);
  var cenas = r.partes.filter(function (p) { return !ehGancho(p); });

  var como = el("div", "como");
  como.innerHTML = (ganchos.length > 1 ? "<b>1.</b> Escolha o gancho que preferir. " : "") +
    "<b>" + (ganchos.length > 1 ? "2." : "1.") + "</b> Comente em qualquer parte, se quiser algum ajuste. " +
    "<b>" + (ganchos.length > 1 ? "3." : "2.") + "</b> Quando estiver tudo certo, aprove o roteiro no fim da página.";
  f.appendChild(como);

  if (r.ficha.length) {
    var fi = el("div", "ficha");
    r.ficha.forEach(function (c) {
      var d = el("div"); d.appendChild(el("div", "rot", c.rotulo)); d.appendChild(el("p", "", c.texto)); fi.appendChild(d);
    });
    f.appendChild(fi);
  }
  r.antes.forEach(function (p) { f.appendChild(cartao(p)); });

  if (ganchos.length) {
    var h = el("h2"); h.innerHTML = ganchos.length > 1 ? "Escolha o <i>gancho</i>" : "O <i>gancho</i>";
    f.appendChild(h);
    f.appendChild(el("p", "dica", ganchos.length > 1 ? "São " + ganchos.length + " opções para o começo do vídeo. Escolha uma." : "É o começo do vídeo."));
    ganchos.forEach(function (p) { f.appendChild(cartao(p)); });
  }
  if (cenas.length) {
    var h2 = el("h2"); h2.innerHTML = "O <i>roteiro</i>";
    f.appendChild(h2);
    f.appendChild(el("p", "dica", "Depois do gancho, cena por cena: o que eu falo e o que aparece."));
    cenas.forEach(function (p) { f.appendChild(cartao(p)); });
  }

  if (r.depois.length) {
    var h4 = el("h2"); h4.innerHTML = "Para <i>fechar</i>";
    f.appendChild(h4);
    r.depois.forEach(function (p) { f.appendChild(cartao(p)); });
  }

  var ap = el("div", "aprovar");
  var h3 = el("h2"); h3.innerHTML = estado.aprovado ? "Roteiro <i>aprovado</i>" : "Tudo <i>certo?</i>";
  ap.appendChild(h3);
  if (estado.aprovado) {
    ap.appendChild(el("p", "dica", "Obrigada! Já recebi a aprovação e vou seguir para a gravação."));
  } else {
    ap.appendChild(el("p", "dica", "Escreva seu nome e aprove o roteiro para eu seguir para a gravação."));
    var ni = el("input"); ni.type = "text"; ni.placeholder = "Nome de quem aprova"; ni.maxLength = 80; ni.value = ultimoNome;
    ni.oninput = function () { ultimoNome = ni.value; };
    var ba = el("button", "verde", "Aprovar roteiro");
    ba.onclick = function () {
      var n = ni.value.trim();
      if (!n) { avisar("Escreva o nome de quem está aprovando.", true); ni.focus(); return; }
      if (ganchos.length > 1 && !estado.gancho) { avisar("Escolha um dos ganchos antes de aprovar.", true); window.scrollTo(0, 0); return; }
      enviar({ tipo: "aprovar", nome: n }, ba, function () { avisar("Roteiro aprovado. Obrigada!"); });
    };
    ap.appendChild(ni); ap.appendChild(document.createElement("br")); ap.appendChild(ba);
  }
  f.appendChild(ap);
  f.appendChild(el("p", "rodape", r.creator || DADOS.autora + " · " + DADOS.assinatura));
}

desenhar();
</script>
</body>
</html>`;
