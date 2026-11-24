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
  // "refacao" antigo é lido como ajustes: pedir ajuste e pedir refação são a mesma coisa (pedido da Mari, 23/11/2026)
  var ROTULO = { enviado: "Aguardando sua resposta", aprovado: "Aprovado", ajustes: "Ajustes solicitados", refacao: "Ajustes solicitados" };
  var NOME = { roteiro: "Roteiro", video: "Vídeo" };
  var FRASE = { aprovado: "aprovou", ajustes: "pediu ajustes", refacao: "pediu ajustes" };
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
  // ---------- vídeos: cada vídeo é uma entrega (título) com versões próprias ----------
  // entregas na ordem em que a Mari mandou a primeira vez; cada uma com o envio atual e quantos já foram
  function entregasDe(j){
    var vs = j.envios.filter(function(e){ return e.tipo === "video"; }), mapa = {}, lista = [];
    vs.forEach(function(e){
      var k = e.entrega || ("video:" + String(e.titulo || "").toLowerCase());
      if (!mapa[k]){ mapa[k] = { chave: k, envios: [] }; lista.push(mapa[k]); }
      mapa[k].envios.push(e);
    });
    lista.forEach(function(x, i){
      x.n = i + 1; x.atual = x.envios.filter(function(e){ return e.atual; })[0] || x.envios[x.envios.length - 1];
      x.titulo = x.atual.titulo || ("Vídeo " + x.n);
    });
    return lista;
  }
  function ordinal(n){ return n + "ª versão"; }
  function revisao(x, e){ var i = x.envios.indexOf(e) + 1; return i > 1 ? "atualização " + i + " · " : ""; }
  function resumoVideos(j){
    var es = entregasDe(j); if (!es.length) return null;
    var esp = es.filter(function(x){ return x.atual.situacao === "enviado"; }).length;
    var apr = es.filter(function(x){ return x.atual.situacao === "aprovado"; }).length;
    if (esp) return { cls: "enviado", txt: es.length > 1 ? esp + " de " + es.length + " para aprovar" : ROTULO.enviado, atual: es[0].atual };
    if (apr === es.length) return { cls: "aprovado", txt: es.length > 1 ? "Todos aprovados" : ROTULO.aprovado, atual: es[0].atual };
    return { cls: "ajustes", txt: ROTULO.ajustes, atual: es[0].atual };
  }

  // situação do projeto na lista: o envio mais novo que ainda espera resposta manda
  function situacaoDoJob(j){
    // roteiro nunca fica anexado aqui: a marca abre pela página do roteiro (j.doc)
    var rot = j.envios.filter(function(e){ return e.atual && e.tipo === "roteiro"; })[0];
    var atuais = j.envios.filter(function(e){ return e.atual && (e.tipo !== "roteiro" || j.doc); });
    if (rot && !j.doc && !atuais.some(function(e){ return e.situacao === "enviado"; })) return { cls: "", txt: "Roteiro em preparação" };
    if (!atuais.length) return { cls: "", txt: "Em preparação" };
    var esp = atuais.filter(function(e){ return e.situacao === "enviado"; })[0];
    if (esp) return { cls: "enviado", txt: esp.tipo === "video" ? (resumoVideos(j) || {}).txt || "Vídeo para aprovar" : NOME[esp.tipo] + " para aprovar" };
    var u = atuais.slice().sort(function(a, b){ return String(b.respondido_em || "").localeCompare(String(a.respondido_em || "")); })[0];
    return { cls: u.situacao, txt: ROTULO[u.situacao] };
  }

  // ---------- etapa do projeto (status do job na Mari) ----------
  var ETAPAS = ["Preparação", "Roteirização", "Aprovação do roteiro", "Gravação", "Edição", "Aprovação do vídeo", "Entregue"];
  var DA_ETAPA = { "aguardando briefing": 0, "aguardando produto": 0, "roteirização": 1, "aprovação de roteiro": 2, "gravação": 3, "em produção": 3,
    "edição": 4, "gravado": 4, "refação": 4, "conteúdo entregue": 5, "aprovação do conteúdo": 5 };
  function etapaIdx(j){
    var st = String(j.etapa || "").toLowerCase();
    if (st.indexOf("finalizado") === 0) return 6;
    if (st === "cancelado") return -1;
    if (st in DA_ETAPA) return DA_ETAPA[st];
    // sem etapa gravada: o que já foi enviado diz onde está
    var r = j.envios.filter(function(e){ return e.tipo === "roteiro" && e.atual; })[0];
    var v = j.envios.filter(function(e){ return e.tipo === "video" && e.atual; })[0];
    if (v) return v.situacao === "aprovado" ? 6 : 5;
    if (r) return r.situacao === "aprovado" ? 3 : 2;
    return 1;
  }
  function nomeEtapa(j){
    var i = etapaIdx(j), st = String(j.etapa || "").toLowerCase();
    if (i < 0) return "Cancelado";
    if (st === "refação") return "Edição (ajustes)";
    return ETAPAS[i];
  }
  function roteiroAprovado(j){ return j.envios.some(function(e){ return e.tipo === "roteiro" && e.atual && e.situacao === "aprovado"; }); }
  function barraHtml(j, grande){
    var i = etapaIdx(j);
    if (i < 0) return '<span class="meta">Projeto cancelado</span>';
    if (!grande) return '<span class="barra-et" aria-label="Etapa ' + (i + 1) + ' de ' + ETAPAS.length + '">' + ETAPAS.map(function(_, k){ return '<i class="' + (k < i ? "ok" : k === i ? "agora" : "") + '"></i>'; }).join("") + "</span>";
    return '<ol class="linha-et">' + ETAPAS.map(function(n, k){
      var rot = k === 2 && roteiroAprovado(j) && i > 2 ? "Roteiro aprovado" : (k === i ? nomeEtapa(j) : n);
      return '<li class="' + (k < i ? "ok" : k === i ? "agora" : "") + '"><span></span>' + esc(rot) + "</li>";
    }).join("") + "</ol>";
  }

  // situação de cada tipo de aprovação (roteiro e vídeo) num projeto
  function etapaDe(j, tipo){
    if (tipo === "roteiro"){
      var ev = j.envios.filter(function(e){ return e.tipo === "roteiro" && e.atual; })[0];
      if (!ev || !j.doc) return { cls: "espera", txt: "Em preparação", vazio: true };
      return { cls: ev.situacao, txt: ROTULO[ev.situacao], versao: ev.versao, em: ev.situacao === "enviado" ? ev.enviado_em : ev.respondido_em, enviado: ev.enviado_em };
    }
    var rv = resumoVideos(j);
    if (!rv) return { cls: "espera", txt: "Ainda não enviado", vazio: true };
    var n = entregasDe(j).length;
    return { cls: rv.cls, txt: rv.txt, qtd: n };
  }
  function etapasHtml(j){
    return '<span class="etapas">' + ["roteiro", "video"].map(function(t){ var s = etapaDe(j, t); return '<span class="pil p-' + s.cls + '">' + NOME[t] + ": " + esc(s.txt) + "</span>"; }).join("") + "</span>";
  }

  // ---------- pasta da marca ----------
  function telaPasta(){
    var jobs = dados.jobs || [];
    var cont = { esp: 0, prod: 0, ent: 0 };
    jobs.forEach(function(j){ var i = etapaIdx(j); if (situacaoDoJob(j).cls === "enviado") cont.esp++; else if (i === 6) cont.ent++; else if (i >= 0) cont.prod++; });
    var h = '<div class="barra">' + topo + (PREVIA ? "" : '<button id="b-sair" type="button">Sair</button>') + "</div>";
    h += "<h1>Olá, <em>" + esc(dados.marca || "marca") + "</em></h1>";
    h += '<p class="meta" style="margin:-8px 0 2px">Acompanhe por aqui o andamento dos seus conteúdos, aprovações e entregas.</p>';
    if (PREVIA) h += '<p class="feito aj">Prévia: é assim que a marca vê a pasta dela. Os botões ficam desligados aqui.</p>';
    h += '<div class="num"><div><strong>' + cont.esp + '</strong><span>Para você aprovar</span></div><div><strong>' + cont.prod + '</strong><span>Em produção</span></div><div><strong>' + cont.ent + '</strong><span>Entregues</span></div></div>';
    h += '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px"><h2>Seus projetos</h2><span class="rot">Acompanhamento</span></div>';
    if (!jobs.length) h += '<p class="cartao">Ainda não há projetos na sua pasta. Assim que a Mari enviar um roteiro, ele aparece aqui.</p>';
    else {
      var ord = jobs.slice().sort(function(a, b){ return (situacaoDoJob(a).cls === "enviado" ? 0 : 1) - (situacaoDoJob(b).cls === "enviado" ? 0 : 1); });
      h += '<div class="lista">' + ord.map(function(j){
        var s = situacaoDoJob(j);
        return '<button type="button" class="job" data-job="' + esc(j.id) + '"><span class="info"><span class="nome">' + esc(j.produto || j.marca || "Projeto") + "</span>" +
          (j.resumo ? '<span class="meta">' + esc(j.resumo) + "</span>" : "") +
          (j.etapa_em ? '<span class="meta" style="font-size:11.5px">Atualizado em ' + quando(j.etapa_em) + "</span>" : "") +
          '<span class="et-agora"><b>' + esc(nomeEtapa(j)) + "</b>" + barraHtml(j) + "</span>" + etapasHtml(j) + "</span>" +
          '<span class="seta" aria-hidden="true">›</span></button>';
      }).join("") + "</div>";
      // todas as aprovações, da mais nova para a mais antiga
      var todas = [];
      jobs.forEach(function(j){ j.envios.forEach(function(e){ if (e.tipo !== "roteiro" || j.doc) todas.push({ j: j, e: e }); }); });
      todas.sort(function(a, b){ return String(b.e.respondido_em || b.e.enviado_em || "").localeCompare(String(a.e.respondido_em || a.e.enviado_em || "")); });
      if (todas.length){
        h += '<h2>Todas as aprovações</h2><section class="cartao todas">' + todas.map(function(x){
          var e = x.e, quandoTxt = e.situacao === "enviado" ? "enviado em " + quando(e.enviado_em) : ROTULO[e.situacao].toLowerCase() + " em " + quando(e.respondido_em);
          return '<button type="button" class="linha" data-job="' + esc(x.j.id) + '"><span class="o"><span>' + esc(x.j.produto || x.j.marca || "Projeto") + " · " + (e.tipo === "video" && e.titulo ? esc(e.titulo) : NOME[e.tipo]) + (e.atual ? "" : " (versão anterior)") + '</span><span class="meta">' + quandoTxt + "</span></span>" +
            '<span class="pil p-' + e.situacao + '">' + ROTULO[e.situacao] + "</span></button>";
        }).join("") + "</section>";
      }
    }
    h += '<p class="pe">Área exclusiva da sua marca. Não compartilhe o link e a senha fora da equipe.</p>';
    pagina.innerHTML = h;
  }

  // ---------- um projeto ----------
  function hashJob(){ var m = location.hash.match(/^#p=([^&]+)(?:&e=(\d+))?/); return m ? { job: decodeURIComponent(m[1]), e: m[2] ? Number(m[2]) : 0 } : { job: "", e: 0 }; }
  // miniaturas pequenas no topo; tocar abre o vídeo embaixo
  function videosHtml(j, abertoId){
    var es = entregasDe(j); if (!es.length) return "";
    var aberto = es.filter(function(x){ return x.envios.some(function(e){ return e.id === abertoId; }); })[0] || null;
    var h = '<section class="cartao videos"><div class="topo"><h2>Vídeos para aprovação</h2>' + (es.length > 1 ? '<span class="meta">' + es.length + " vídeos</span>" : "") + "</div>";
    h += '<p class="meta">Toque no vídeo para assistir, ler o recado da Mari e responder.</p>';
    h += '<div class="minis">' + es.map(function(x){
      var e = x.atual;
      return '<button type="button" class="mini' + (aberto === x ? " aberta" : "") + '" data-entrega="' + e.id + '">' +
        '<span class="ord">' + ordinal(x.n) + "</span>" +
        '<span class="quadro">' + (e.video ? '<video src="' + esc(e.video) + '#t=0.8" muted playsinline preload="metadata" tabindex="-1"></video>' : "") + '<span class="play" aria-hidden="true">▶</span></span>' +
        '<span class="tit">' + esc(x.titulo) + "</span>" +
        '<span class="pil p-' + e.situacao + '">' + ROTULO[e.situacao] + "</span></button>";
    }).join("") + "</div>";
    if (aberto) h += entregaHtml(aberto);
    return h + "</section>";
  }
  function entregaHtml(x){
    var e = x.atual;
    var h = '<div class="entrega" data-envio="' + e.id + '">';
    h += '<div class="topo"><h3><span class="ord">' + ordinal(x.n) + "</span> " + esc(x.titulo) + '</h3><button type="button" class="fechar" data-fechar aria-label="Fechar o vídeo">×</button></div>';
    h += '<div class="meta">' + revisao(x, e) + "enviado em " + quando(e.enviado_em) + "</div>";
    if (e.conteudo) h += '<div class="recado"><b>Recado da Mari</b>' + esc(e.conteudo).split(/\n+/).map(function(l){ return "<p>" + l + "</p>"; }).join("") + "</div>";
    h += e.video ? '<video class="player" src="' + esc(e.video) + '" controls playsinline preload="metadata" controlslist="nodownload"></video>' : '<p class="meta">O vídeo não carregou. Atualize a página.</p>';
    if (e.situacao !== "aprovado" && e.marcaDagua) h += '<p class="aviso-md">Vídeo de aprovação, com marca d\'água. O arquivo em alta qualidade, sem marca d\'água, é liberado aqui depois da aprovação.</p>';
    if (e.situacao === "aprovado") h += e.alta
      ? '<div class="alta"><b>Arquivo final em alta qualidade, sem marca d\'água</b><a class="botao" href="' + esc(e.alta.url) + '" target="_blank" rel="noopener">Baixar em alta qualidade</a><span class="meta">Abre no Google Drive. Toque no ícone de download no alto da tela.</span></div>'
      : '<p class="aviso-md">Vídeo aprovado. A Mari vai liberar o arquivo em alta qualidade aqui em breve.</p>';
    if (e.situacao === "enviado"){
      h += '<div class="acoes"><button class="ok" data-abrir="aprovado">Aprovar vídeo</button><button data-abrir="ajustes">Pedir ajustes</button></div>';
      h += '<div class="caixa" data-form hidden><strong data-form-titulo></strong><span class="meta" data-form-dica></span>' +
        '<label data-campo-texto>O que precisa mudar?<textarea id="texto' + e.id + '" maxlength="4000"></textarea></label>' +
        '<label>Seu nome<input type="text" id="nome' + e.id + '" maxlength="80" autocomplete="name"></label>' +
        '<p class="erro" data-erro hidden></p><div class="dupla"><button data-cancelar>Voltar</button><button class="pri" data-enviar>Confirmar</button></div></div>';
    } else {
      h += '<p class="feito' + (e.situacao === "aprovado" ? "" : " aj") + '">' + ROTULO[e.situacao] + " em " + quando(e.respondido_em) + ". A Mari já foi avisada." + (e.situacao === "aprovado" ? "" : " A nova versão aparece aqui.") + "</p>";
    }
    var antigas = x.envios.filter(function(y){ return y !== e; });
    if (antigas.length){
      h += '<details><summary>Versões anteriores deste vídeo (' + antigas.length + ")</summary>" + antigas.slice().reverse().map(function(y){
        return '<div class="meta" style="margin-top:12px">' + revisao(x, y) + "enviado em " + quando(y.enviado_em) + " · " + ROTULO[y.situacao] + "</div>" +
          (y.video ? '<video class="player" src="' + esc(y.video) + '" controls playsinline preload="none"></video>' : "") +
          (y.conteudo ? '<div class="recado"><b>Recado da Mari</b><p>' + esc(y.conteudo) + "</p></div>" : "");
      }).join("") + "</details>";
    }
    return h + "</div>";
  }
  function telaJob(j, abertoId){
    var rotAtual = j.envios.filter(function(e){ return e.atual && e.tipo === "roteiro"; })[0];
    var temVideo = j.envios.some(function(e){ return e.tipo === "video"; });
    var h = '<div class="barra">' + topo + (PREVIA ? "" : '<button id="b-sair" type="button">Sair</button>') + "</div>";
    h += '<button type="button" class="voltar" data-voltar>‹ Seus projetos</button>';
    h += "<h1>" + esc(j.marca || dados.marca || "Seu projeto") + (j.produto ? " <em>" + esc(j.produto) + "</em>" : "") + "</h1>";
    if (j.resumo) h += '<p class="meta">' + esc(j.resumo) + "</p>";
    if (PREVIA) h += '<p class="feito aj">Prévia: os botões ficam desligados aqui.</p>';
    // vídeos em cima, separados por versão
    h += videosHtml(j, abertoId);
    h += '<section class="cartao"><div class="topo"><h2>Andamento do projeto</h2><span class="pil p-' + (etapaIdx(j) === 6 ? "aprovado" : "enviado") + '">' + esc(nomeEtapa(j)) + "</span></div>" + barraHtml(j, true) +
      (j.etapa_em ? '<p class="meta">Atualizado em ' + quando(j.etapa_em) + "</p>" : "") + "</section>";
    h += '<div class="status-job">' + ["roteiro", "video"].map(function(t){
      var s = etapaDe(j, t);
      return "<div><b>" + (t === "video" && s.qtd > 1 ? "Vídeos" : NOME[t]) + '</b><span class="pil p-' + s.cls + '" style="align-self:flex-start">' + esc(s.txt) + "</span>" +
        (s.versao ? '<span class="meta">versão ' + s.versao + (s.em ? " · " + quando(s.em) : "") + "</span>" : "") + "</div>";
    }).join("") + "</div>";
    // roteiro: só o link para a página do roteiro, nunca o texto aqui dentro
    if (j.doc){
      var sr = etapaDe(j, "roteiro");
      h += '<section class="cartao"><div class="topo"><h2>Roteiro</h2><span class="pil p-' + sr.cls + '">' + esc(sr.txt) + "</span></div>" +
        '<p class="meta">Toque para abrir o roteiro, escolher o gancho, comentar e aprovar. A Mari é avisada na hora.</p>' +
        '<a class="botao" href="' + esc(j.doc) + '" target="_blank" rel="noopener">Abrir o roteiro</a></section>';
    } else if (rotAtual){
      h += '<section class="cartao"><div class="topo"><h2>Roteiro</h2><span class="pil p-espera">Em preparação</span></div>' +
        '<p class="meta">O link do roteiro aparece aqui assim que a Mari liberar.</p></section>';
    }
    if (!j.doc && !rotAtual && !temVideo){
      h += '<p class="cartao">Ainda não há nada para aprovar neste projeto. Assim que a Mari enviar o roteiro ou o vídeo, ele aparece aqui.</p>';
    }
    if (j.historico.length){
      h += '<section class="cartao"><h2>Histórico</h2><div class="hist">' + j.historico.slice().reverse().map(function(x){
        var oque = x.de === "video" ? (x.titulo ? "vídeo " + x.titulo : "vídeo") : "roteiro versão " + x.versao;
        return "<div><time>" + quando(x.em) + "</time>" + esc(x.autor || "Marca") + " " + (FRASE[x.tipo] || x.tipo) + " · " + esc(oque) +
          (x.gancho ? "<q>Gancho escolhido: " + esc(x.gancho) + "</q>" : "") + (x.texto ? "<q>" + esc(x.texto) + "</q>" : "") + "</div>";
      }).join("") + "</div></section>";
    }
    pagina.innerHTML = h;
  }

  function desenhar(){
    var hj = hashJob(), id = hj.job;
    var j = id && dados && (dados.jobs || []).filter(function(x){ return x.id === id; })[0];
    if (j) telaJob(j, hj.e); else telaPasta();
  }

  var TEXTOS = {
    aprovado: ["Confirmar aprovação", "Ao confirmar, a aprovação fica registrada com seu nome, data e hora.", "Confirmar aprovação"],
    ajustes: ["Pedir ajustes", "Diga o que precisa mudar: o trecho e como deve ficar.", "Enviar pedido de ajustes"]
  };
  pagina.addEventListener("click", function(ev){
    var b = ev.target.closest("button"); if (!b) return;
    if (b.id === "b-sair"){ var g0 = ler(); if (!M && g0 && g0.m) M = g0.m; chamar({ acao: "sair" }).catch(function(){}); gravar(null); dados = null; history.replaceState(null, "", location.pathname + (M ? "?m=" + encodeURIComponent(M) : "")); telaLogin(); return; }
    if (b.dataset.job){ location.hash = "p=" + encodeURIComponent(b.dataset.job); return; }
    if (b.hasAttribute("data-voltar")){ location.hash = ""; return; }
    // miniatura: abre (ou fecha) o vídeo embaixo, sem rolar a página para o topo
    if (b.dataset.entrega || b.hasAttribute("data-fechar")){
      var hj = hashJob(), abrir = b.dataset.entrega && Number(b.dataset.entrega) !== hj.e ? b.dataset.entrega : "";
      history.replaceState(null, "", location.pathname + location.search + "#p=" + encodeURIComponent(hj.job) + (abrir ? "&e=" + abrir : ""));
      desenhar();
      var alvo = document.querySelector(".entrega") || document.querySelector(".videos");
      if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    var sec = b.closest("[data-envio]"); if (!sec) return;
    var form = sec.querySelector("[data-form]"), acoes = sec.querySelector(".acoes"), erro = sec.querySelector("[data-erro]");
    if (b.dataset.abrir){
      if (PREVIA) return;
      var tx = TEXTOS[b.dataset.abrir];
      form.dataset.tipo = b.dataset.abrir;
      form.querySelector("[data-form-titulo]").textContent = tx[0];
      form.querySelector("[data-form-dica]").textContent = tx[1];
      form.querySelector("[data-enviar]").textContent = tx[2];
      form.querySelector("[data-campo-texto]").firstChild.textContent = b.dataset.abrir === "aprovado" ? "Comentário (opcional)" : "O que precisa mudar?";
      erro.hidden = true; form.hidden = false; acoes.hidden = true;
      form.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else if (b.hasAttribute("data-cancelar")){
      form.hidden = true; acoes.hidden = false;
    } else if (b.hasAttribute("data-enviar")){
      if (ocupado) return;
      var id = sec.dataset.envio, tipo = form.dataset.tipo;
      var job = hashJob().job;
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
