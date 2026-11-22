// =========================================================
// ÁREA DO CLIENTE (marianabonetto.com.br/cliente/)
// A marca abre o link que a Mari mandou (/cliente/?m=<código da marca>) e digita só a senha
// criada no painel (Aprovações > Área do cliente). Vê só a pasta dela: os projetos, o roteiro para aprovar, as versões e o histórico.
// Fala só com a Edge Function portal-cliente. A sessão fica neste aparelho (localStorage "mbPortal").
// ?previa=<id do acesso> = a Mari vendo como a marca vê (usa o login dela no painel; nada é registrado).
// =========================================================
(function(){
  var FN = "https://ztpzcmeiypnstswasxdw.supabase.co/functions/v1/portal-cliente";
  var CHAVE = "sb_publishable_TxLJkErn4N9jD8rDLV1EnQ_sppuB9VZ"; // chave pública (a mesma do site)
  var GUARDA = "mbPortal";
  var q = new URLSearchParams(location.search), PREVIA = q.get("previa") || "";
  var M = String(q.get("m") || "").trim().toLowerCase(); // código da marca no link
  var pagina = document.getElementById("pagina");
  var ROTULO = { enviado: "Aguardando sua resposta", aprovado: "Aprovado", ajustes: "Ajustes solicitados", refacao: "Refação solicitada" };
  var NOME = { roteiro: "Roteiro", video: "Vídeo" };
  var FRASE = { aprovado: "aprovou", ajustes: "pediu ajustes", refacao: "pediu refação" };
  var dados = null, ocupado = false;

  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function quando(iso){ try{ return new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }).replace(",", " às"); }catch(e){ return ""; } }
  // sessão deste aparelho; se o link é de outra marca, pede a senha dessa outra
  function ler(){ try{ var v = JSON.parse(localStorage.getItem(GUARDA) || "null"); return v && v.s && new Date(v.expira).getTime() > Date.now() && (!M || v.m === M) ? v : null; }catch(e){ return null; } }
  function gravar(v){ try{ if (v) localStorage.setItem(GUARDA, JSON.stringify(v)); else localStorage.removeItem(GUARDA); }catch(e){} }
  function tokenDaMari(){
    try{ for (var i = 0; i < localStorage.length; i++){ var k = localStorage.key(i); if (/^sb-.*-auth-token$/.test(k)){ var v = JSON.parse(localStorage.getItem(k)); if (v && v.access_token) return v.access_token; } } }catch(e){}
    return "";
  }
  function chamar(corpo){
    var auth = CHAVE;
    if (PREVIA){ corpo.acao = corpo.acao === "pasta" ? "previa" : corpo.acao; corpo.marca_id = PREVIA; auth = tokenDaMari() || CHAVE; }
    else { var g = ler(); if (g) corpo.s = g.s; }
    return fetch(FN, { method:"POST", headers:{ "Content-Type":"application/json", apikey:CHAVE, Authorization:"Bearer " + auth }, body:JSON.stringify(corpo) })
      .then(function(r){ return r.json().then(function(j){ j.status = r.status; return j; }); });
  }
  var topo = '<span class="rot">Mari Bonetto · UGC Creator</span>';

  // ---------- entrar: só a senha (a marca vem do link) ----------
  function telaLogin(aviso){
    if (!M){
      var g = null; try{ g = JSON.parse(localStorage.getItem(GUARDA) || "null"); }catch(e){}
      if (g && g.m){ location.replace(location.pathname + "?m=" + encodeURIComponent(g.m)); return; }
      pagina.innerHTML = topo + '<h1>Área do <em>cliente</em></h1><p class="cartao">Abra esta área pelo link que a Mari enviou para a sua marca.</p>';
      return;
    }
    pagina.innerHTML = topo + '<h1 id="t-marca">Área do <em>cliente</em></h1>' +
      '<p class="meta">Aqui ficam os roteiros e conteúdos para aprovar e o histórico de cada projeto. Digite a senha que a Mari enviou.</p>' +
      '<form class="cartao" id="f-entrar" autocomplete="on">' +
      '<input type="text" name="username" value="' + esc(M) + '" autocomplete="username" hidden>' +
      '<label>Senha<input type="password" id="senha" autocomplete="current-password" required></label>' +
      '<p class="erro" id="erro"' + (aviso ? "" : " hidden") + '>' + esc(aviso || "") + '</p>' +
      '<button class="pri" type="submit" id="b-entrar">Entrar</button></form>' +
      '<p class="pe">Esqueceu a senha? Fale com a Mari para receber uma nova.</p>';
    fetch(FN, { method:"POST", headers:{ "Content-Type":"application/json", apikey:CHAVE, Authorization:"Bearer " + CHAVE }, body:JSON.stringify({ acao:"marca", m:M }) })
      .then(function(r){ return r.json(); })
      .then(function(r){
        var t = document.getElementById("t-marca"); if (!t) return;
        if (r.marca) t.innerHTML = "Área da <em>" + esc(r.marca) + "</em>";
        else if (r.error){ pagina.innerHTML = topo + '<h1>Link <em>indisponível</em></h1><p class="cartao">' + esc(r.error) + "</p>"; }
      }).catch(function(){});
    document.getElementById("senha").focus();
    document.getElementById("f-entrar").addEventListener("submit", function(ev){
      ev.preventDefault();
      var b = document.getElementById("b-entrar"), erro = document.getElementById("erro");
      var senha = document.getElementById("senha").value;
      if (!senha){ erro.textContent = "Escreva sua senha."; erro.hidden = false; return; }
      b.disabled = true; b.textContent = "Entrando...";
      fetch(FN, { method:"POST", headers:{ "Content-Type":"application/json", apikey:CHAVE, Authorization:"Bearer " + CHAVE }, body:JSON.stringify({ acao:"entrar", login:M, senha:senha }) })
        .then(function(r){ return r.json(); })
        .then(function(r){
          if (!r.ok){ erro.textContent = r.error || "Não consegui entrar."; erro.hidden = false; b.disabled = false; b.textContent = "Entrar"; return; }
          gravar({ s:r.s, m:M, marca:r.marca, expira:r.expira }); carregar();
        })
        .catch(function(){ erro.textContent = "Sem conexão. Tente de novo."; erro.hidden = false; b.disabled = false; b.textContent = "Entrar"; });
    });
  }

  // ---------- roteiro ----------
  function ganchosDe(texto){
    var linhas = String(texto || "").split("\n"), lista = [];
    for (var i = 0; i < linhas.length; i++){
      var m = linhas[i].match(/^[\s☐□•*\-]*gancho\s*(\d+)\s*[:.)\-·]*\s*(.*)$/i);
      if (!m) continue;
      var fala = m[2].trim();
      if (!fala){ for (var k = i + 1; k < linhas.length && k < i + 4; k++){ if (linhas[k].trim()){ fala = linhas[k].trim(); break; } } }
      if (fala && !lista.some(function(g){ return g.n === m[1]; })) lista.push({ n: m[1], fala: fala.slice(0, 500) });
    }
    return lista.length > 1 ? lista : [];
  }
  var TITULO = /^(roteiro|ganchos?|cena|etapa|cta|legenda|lettering|ideia|tempo|no set|identifica[cç][aã]o|solu[cç][aã]o|prova|fechamento|contexto|conte[uú]do|desenvolvimento|hook|texto na tela|b-?roll|chamada|pra confirmar|para confirmar|creator|marca|produto|entrega|formato|dura[cç][aã]o|onde vai rodar)\b/i;
  function roteiroHtml(texto){
    return String(texto || "").split("\n").map(function(l){
      var t = l.trim();
      if (!t) return "";
      if (/^[-_=]{6,}$/.test(t)) return "<hr>";
      var curta = t.length <= 70;
      if (curta && (TITULO.test(t) && !/[.!?]"?$/.test(t) || (t === t.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(t)))) return '<p class="tit">' + esc(t) + "</p>";
      return "<p>" + esc(t) + "</p>";
    }).join("");
  }
  // situação do projeto na lista: o envio mais novo que ainda espera resposta manda
  function situacaoDoJob(j){
    var atuais = j.envios.filter(function(e){ return e.atual && !(j.doc && e.tipo === "roteiro"); });
    if (j.doc && !atuais.some(function(e){ return e.situacao === "enviado"; })) return { cls: "enviado", txt: "Roteiro no Google Doc" };
    if (!atuais.length) return { cls: "", txt: "Em preparação" };
    var esp = atuais.filter(function(e){ return e.situacao === "enviado"; })[0];
    if (esp) return { cls: "enviado", txt: NOME[esp.tipo] + " para aprovar" };
    var u = atuais.slice().sort(function(a, b){ return String(b.respondido_em || "").localeCompare(String(a.respondido_em || "")); })[0];
    return { cls: u.situacao, txt: ROTULO[u.situacao] };
  }

  // ---------- pasta da marca ----------
  function telaPasta(){
    var jobs = dados.jobs || [];
    var cont = { esp: 0, apr: 0, aj: 0 };
    jobs.forEach(function(j){ var s = situacaoDoJob(j).cls; if (s === "enviado") cont.esp++; else if (s === "aprovado") cont.apr++; else if (s === "ajustes" || s === "refacao") cont.aj++; });
    var h = '<div class="barra">' + topo + (PREVIA ? "" : '<button id="b-sair" type="button">Sair</button>') + "</div>";
    h += "<h1>Olá, <em>" + esc(dados.marca || "marca") + "</em></h1>";
    if (PREVIA) h += '<p class="feito aj">Prévia: é assim que a marca vê a pasta dela. Os botões ficam desligados aqui.</p>';
    h += '<div class="num"><div><strong>' + cont.esp + '</strong><span>Para você aprovar</span></div><div><strong>' + cont.aj + '</strong><span>Com ajustes pedidos</span></div><div><strong>' + cont.apr + '</strong><span>Aprovados</span></div></div>';
    h += "<h2>Seus projetos</h2>";
    if (!jobs.length) h += '<p class="cartao">Ainda não há projetos na sua pasta. Assim que a Mari enviar um roteiro, ele aparece aqui.</p>';
    else {
      var ord = jobs.slice().sort(function(a, b){ return (situacaoDoJob(a).cls === "enviado" ? 0 : 1) - (situacaoDoJob(b).cls === "enviado" ? 0 : 1); });
      h += '<div class="lista">' + ord.map(function(j){
        var s = situacaoDoJob(j);
        return '<button type="button" class="job" data-job="' + esc(j.id) + '"><span class="info"><span class="nome">' + esc(j.produto || j.marca || "Projeto") + "</span>" +
          (j.resumo ? '<span class="meta">' + esc(j.resumo) + "</span>" : "") + "</span>" +
          (s.cls ? '<span class="pil p-' + s.cls + '">' + esc(s.txt) + "</span>" : '<span class="meta">' + esc(s.txt) + "</span>") + '<span class="seta" aria-hidden="true">›</span></button>';
      }).join("") + "</div>";
    }
    h += '<p class="pe">Área exclusiva da sua marca. Não compartilhe o link e a senha fora da equipe.</p>';
    pagina.innerHTML = h;
  }

  // ---------- um projeto ----------
  function telaJob(j){
    var atuais = j.envios.filter(function(e){ return e.atual && !(j.doc && e.tipo === "roteiro"); });
    atuais.sort(function(a, b){ return (a.situacao === "enviado" ? 0 : 1) - (b.situacao === "enviado" ? 0 : 1) || (a.tipo === "video" ? 0 : 1) - (b.tipo === "video" ? 0 : 1); });
    var h = '<div class="barra">' + topo + (PREVIA ? "" : '<button id="b-sair" type="button">Sair</button>') + "</div>";
    h += '<button type="button" class="voltar" data-voltar>‹ Seus projetos</button>';
    h += "<h1>" + esc(j.marca || dados.marca || "Seu projeto") + (j.produto ? " <em>" + esc(j.produto) + "</em>" : "") + "</h1>";
    if (j.resumo) h += '<p class="meta">' + esc(j.resumo) + "</p>";
    if (PREVIA) h += '<p class="feito aj">Prévia: os botões ficam desligados aqui.</p>';
    if (j.doc){
      h += '<section class="cartao"><div class="topo"><h2>Roteiro para aprovação</h2></div>' +
        '<p class="meta">Este roteiro está no Google Doc. Abra para ler, comentar e aprovar. A Mari é avisada na hora.</p>' +
        '<a class="botao" href="' + esc(j.doc) + '" target="_blank" rel="noopener">Abrir o roteiro</a></section>';
    }
    if (!j.doc && !atuais.length){
      h += '<p class="cartao">Ainda não há nada para aprovar neste projeto.</p>';
    }
    atuais.forEach(function(e){
      var gs = e.tipo === "roteiro" ? ganchosDe(e.conteudo) : [];
      h += '<section class="cartao" data-envio="' + e.id + '">';
      h += '<div class="topo"><h2>' + NOME[e.tipo] + ' para aprovação</h2><span class="pil p-' + e.situacao + '">' + ROTULO[e.situacao] + "</span></div>";
      h += '<div class="meta">' + (e.titulo ? esc(e.titulo) + " · " : "") + "versão " + e.versao + " · enviado em " + quando(e.enviado_em) + "</div>";
      if (e.tipo === "video") h += e.video ? '<video class="player" src="' + esc(e.video) + '" controls playsinline preload="metadata"></video>' : '<p class="meta">O vídeo não carregou. Atualize a página.</p>';
      if (e.conteudo) h += '<div class="roteiro">' + roteiroHtml(e.conteudo) + "</div>";
      if (e.situacao === "enviado"){
        if (gs.length){
          h += '<div class="ganchos"><strong>Qual gancho você prefere?</strong>' + gs.map(function(g){
            return '<label class="gancho"><input type="radio" name="g' + e.id + '" value="' + esc("Gancho " + g.n + ": " + g.fala) + '"><span><b>Gancho ' + esc(g.n) + "</b><br>" + esc(g.fala) + "</span></label>";
          }).join("") + "</div>";
        }
        h += '<div class="acoes"><button class="ok" data-abrir="aprovado">Aprovar ' + NOME[e.tipo].toLowerCase() + '</button><div class="dupla"><button data-abrir="ajustes">Pedir ajustes</button><button data-abrir="refacao">Pedir refação</button></div></div>';
        h += '<div class="caixa" data-form hidden><strong data-form-titulo></strong><span class="meta" data-form-dica></span>' +
          '<label data-campo-texto>O que precisa mudar?<textarea id="texto' + e.id + '" maxlength="4000"></textarea></label>' +
          '<label>Seu nome<input type="text" id="nome' + e.id + '" maxlength="80" autocomplete="name"></label>' +
          '<p class="erro" data-erro hidden></p><div class="dupla"><button data-cancelar>Voltar</button><button class="pri" data-enviar>Confirmar</button></div></div>';
      } else {
        h += '<p class="feito' + (e.situacao === "aprovado" ? "" : " aj") + '">' + (e.situacao === "aprovado" ? "Aprovado" : ROTULO[e.situacao]) + " em " + quando(e.respondido_em) + ". A Mari já foi avisada." + (e.situacao === "aprovado" ? "" : " A nova versão aparece aqui na sua pasta.") + "</p>";
      }
      h += "</section>";
    });
    if (j.historico.length){
      h += '<section class="cartao"><h2>Histórico</h2><div class="hist">' + j.historico.slice().reverse().map(function(x){
        return "<div><time>" + quando(x.em) + "</time>" + esc(x.autor || "Marca") + " " + (FRASE[x.tipo] || x.tipo) + " · " + NOME[x.de].toLowerCase() + " versão " + x.versao +
          (x.gancho ? "<q>Gancho escolhido: " + esc(x.gancho) + "</q>" : "") + (x.texto ? "<q>" + esc(x.texto) + "</q>" : "") + "</div>";
      }).join("") + "</div></section>";
    }
    var antigas = j.envios.filter(function(e){ return !e.atual && !(j.doc && e.tipo === "roteiro"); });
    if (antigas.length){
      h += '<details class="cartao"><summary>Versões anteriores (' + antigas.length + ")</summary>" + antigas.slice().reverse().map(function(e){
        return '<div class="meta" style="margin-top:12px">' + NOME[e.tipo] + " versão " + e.versao + " · " + quando(e.enviado_em) + "</div>" +
          (e.tipo === "video" && e.video ? '<video class="player" src="' + esc(e.video) + '" controls playsinline preload="none"></video>' : "") + '<div class="roteiro">' + roteiroHtml(e.conteudo) + "</div>";
      }).join("") + "</details>";
    }
    pagina.innerHTML = h;
  }

  function desenhar(){
    var m = location.hash.match(/^#p=(.+)$/), id = m ? decodeURIComponent(m[1]) : "";
    var j = id && dados && (dados.jobs || []).filter(function(x){ return x.id === id; })[0];
    if (j) telaJob(j); else telaPasta();
  }

  var TEXTOS = {
    aprovado: ["Confirmar aprovação", "Ao confirmar, a aprovação fica registrada com seu nome, data e hora.", "Confirmar aprovação"],
    ajustes: ["Pedir ajustes", "Para mudanças pontuais. Diga o trecho e como deve ficar.", "Enviar pedido de ajustes"],
    refacao: ["Pedir refação", "Para quando a proposta precisa de uma versão nova. Explique o motivo.", "Enviar pedido de refação"]
  };
  pagina.addEventListener("click", function(ev){
    var b = ev.target.closest("button"); if (!b) return;
    if (b.id === "b-sair"){ var g0 = ler(); if (!M && g0 && g0.m) M = g0.m; chamar({ acao: "sair" }).catch(function(){}); gravar(null); dados = null; history.replaceState(null, "", location.pathname + (M ? "?m=" + encodeURIComponent(M) : "")); telaLogin(); return; }
    if (b.dataset.job){ location.hash = "p=" + encodeURIComponent(b.dataset.job); return; }
    if (b.hasAttribute("data-voltar")){ location.hash = ""; return; }
    var sec = b.closest("[data-envio]"); if (!sec) return;
    var form = sec.querySelector("[data-form]"), acoes = sec.querySelector(".acoes"), erro = sec.querySelector("[data-erro]");
    if (b.dataset.abrir){
      if (PREVIA) return;
      var tx = TEXTOS[b.dataset.abrir];
      form.dataset.tipo = b.dataset.abrir;
      form.querySelector("[data-form-titulo]").textContent = tx[0];
      form.querySelector("[data-form-dica]").textContent = tx[1];
      form.querySelector("[data-enviar]").textContent = tx[2];
      form.querySelector("[data-campo-texto]").firstChild.textContent = b.dataset.abrir === "aprovado" ? "Comentário (opcional)" : (b.dataset.abrir === "refacao" ? "Por que precisa refazer?" : "O que precisa mudar?");
      erro.hidden = true; form.hidden = false; acoes.hidden = true;
      form.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else if (b.hasAttribute("data-cancelar")){
      form.hidden = true; acoes.hidden = false;
    } else if (b.hasAttribute("data-enviar")){
      if (ocupado) return;
      var id = sec.dataset.envio, tipo = form.dataset.tipo;
      var m = location.hash.match(/^#p=(.+)$/), job = m ? decodeURIComponent(m[1]) : "";
      var nome = document.getElementById("nome" + id).value.trim(), texto = document.getElementById("texto" + id).value.trim();
      var g = sec.querySelector('input[name="g' + id + '"]:checked');
      var falta = !nome ? "Escreva seu nome." : (tipo !== "aprovado" && texto.length < 3 ? "Explique o que precisa mudar." : "");
      if (falta){ erro.textContent = falta; erro.hidden = false; return; }
      ocupado = true; b.disabled = true; b.textContent = "Enviando...";
      try{ localStorage.setItem("mbPortalNome", nome); }catch(e){}
      chamar({ acao: "responder", job: job, envio: Number(id), tipo: tipo, nome: nome, texto: texto, gancho: g ? g.value : "" }).then(function(r){
        ocupado = false;
        if (r.sair){ gravar(null); telaLogin(r.error); return; }
        if (r.error && !r.versaoNova){ erro.textContent = r.error; erro.hidden = false; b.disabled = false; b.textContent = TEXTOS[tipo][2]; return; }
        carregar();
      }).catch(function(){ ocupado = false; erro.textContent = "Sem conexão. Tente de novo."; erro.hidden = false; b.disabled = false; b.textContent = TEXTOS[tipo][2]; });
    }
  });
  // nome lembrado neste aparelho para não digitar de novo
  pagina.addEventListener("focusin", function(ev){
    var t = ev.target; if (!t.id || t.id.indexOf("nome") !== 0 || t.value) return;
    try{ t.value = localStorage.getItem("mbPortalNome") || ""; }catch(e){}
  });
  window.addEventListener("hashchange", function(){ if (dados){ desenhar(); window.scrollTo(0, 0); } });

  function carregar(){
    return chamar({ acao: "pasta" }).then(function(d){
      if (d.sair || d.status === 401){ gravar(null); telaLogin(d.error); return; }
      if (d.error){ pagina.innerHTML = topo + '<p class="cartao">' + esc(d.error) + "</p>"; return; }
      dados = d; desenhar();
    }).catch(function(){ pagina.innerHTML = topo + '<p class="cartao">Sem conexão. Atualize a página para tentar de novo.</p>'; });
  }
  // volta para a tela: busca de novo (a Mari pode ter mandado versão nova)
  document.addEventListener("visibilitychange", function(){ if (document.visibilityState === "visible" && dados && !ocupado && !document.querySelector("[data-form]:not([hidden])")) carregar(); });

  if (PREVIA || ler()) carregar(); else telaLogin();
})();
