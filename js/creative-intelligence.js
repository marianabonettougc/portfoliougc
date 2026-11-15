/* Creative Intelligence — briefing, biblioteca de anúncios e análise criativa */
(() => {
  "use strict";
  const $ = (s, r=document) => r.querySelector(s), $ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const supa = () => window.banco;
  let projeto = null, anuncios = [], analiseAtual = null;
  const sec = () => $("#aba-creative-intelligence");
  const aviso = (msg, erro=false) => { const el=$("#ci-aviso",sec()); if(el){el.textContent=msg;el.className="ci-aviso"+(erro?" erro":"");el.hidden=false;} };
  const limparAviso = () => { const el=$("#ci-aviso",sec()); if(el) el.hidden=true; };
  const id = () => window.crypto?.randomUUID?.() || String(Date.now())+Math.random().toString(16).slice(2);
  const data = (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "Agora";
  const vazio = () => ({brand:"",product:"",objective:"",audience:"",briefing:"",voice:"",deliverables:"",restrictions:""});
  function layout(){
    sec().innerHTML = `
      <div class="ci">
        <header class="ci-head"><div><span class="ci-kicker">PESQUISA + ESTRATÉGIA + CRIAÇÃO</span><h2>Creative <em>Intelligence</em></h2><p>Transforme briefings e referências de anúncios em decisões criativas e roteiros originais.</p></div><button class="ci-btn ci-primary" id="ci-novo">＋ Novo projeto</button></header>
        <div class="ci-stats"><article><small>Projetos salvos</small><b id="ci-total">0</b></article><article><small>Anúncios analisados</small><b id="ci-ads-total">0</b></article><article><small>Referências por revisar</small><b id="ci-pendentes">0</b></article></div>
        <div class="ci-grid">
          <aside class="ci-card ci-lista"><div class="ci-card-head"><div><h3>Seus projetos</h3><p>Briefings organizados por cliente</p></div><input id="ci-busca" placeholder="Buscar projeto..." aria-label="Buscar projeto"></div><div id="ci-projetos" class="ci-project-list"><div class="ci-empty">Carregando projetos...</div></div></aside>
          <main class="ci-main">
            <div class="ci-card ci-intro" id="ci-inicio"><span class="ci-kicker">SEU LABORATÓRIO CRIATIVO</span><h3>Comece pelo briefing.</h3><p>Cadastre o que a marca pediu, adicione anúncios de referência e analise os mecanismos criativos antes de escrever.</p><button class="ci-btn ci-primary" id="ci-comecar">Criar primeiro projeto</button></div>
            <div id="ci-editor" hidden>
              <div class="ci-card"><div class="ci-card-head"><div><span class="ci-kicker">ETAPA 01</span><h3>Briefing do cliente</h3><p>O contexto que vai orientar toda a pesquisa.</p></div><span class="ci-tag">Projeto</span></div>
                <div class="ci-form">
                  <label>Marca<input id="ci-brand" placeholder="Ex.: Pantene"></label><label>Produto ou serviço<input id="ci-product" placeholder="Ex.: Linha de reconstrução"></label>
                  <label>Objetivo do conteúdo<input id="ci-objective" placeholder="Ex.: Apresentar benefícios e gerar interesse"></label><label>Público-alvo<input id="ci-audience" placeholder="Ex.: Mulheres com cabelos danificados"></label>
                  <label class="wide">Briefing completo<textarea id="ci-briefing" rows="6" placeholder="Cole aqui o briefing enviado pelo cliente..."></textarea></label>
                  <label>Tom de voz solicitado<input id="ci-voice" placeholder="Ex.: próximo, espontâneo e educativo"></label><label>Entregáveis<input id="ci-deliverables" placeholder="Ex.: 1 Reels de 30 segundos"></label>
                  <label class="wide">Obrigatoriedades e restrições<textarea id="ci-restrictions" rows="3" placeholder="Falas obrigatórias, claims permitidos, proibições, hashtags..."></textarea></label>
                </div><div class="ci-actions"><button class="ci-btn ci-primary" id="ci-salvar">Salvar briefing</button><span id="ci-save-state" class="ci-muted"></span></div>
              </div>
              <div class="ci-card"><div class="ci-card-head"><div><span class="ci-kicker">ETAPA 02</span><h3>Biblioteca de anúncios</h3><p>Guarde anúncios de concorrentes e referências do mesmo segmento.</p></div></div>
                <div class="ci-form ci-ad-form"><label>Nome / marca do anúncio<input id="ci-ad-title" placeholder="Ex.: Anúncio de reconstrução capilar"></label><label>Link do anúncio<input id="ci-ad-url" type="url" placeholder="https://..."></label><label>Plataforma<select id="ci-ad-platform"><option>Instagram / Meta</option><option>TikTok</option><option>YouTube</option><option>Pinterest</option><option>Outra</option></select></label><label>Indicador observado<input id="ci-ad-performance" placeholder="Ex.: ativo há 45 dias, muitas interações..."></label><label class="wide">Transcrição, legenda ou descrição do vídeo<textarea id="ci-ad-transcript" rows="4" placeholder="Cole a transcrição ou descreva o que acontece no anúncio. A análise de fala depende deste conteúdo."></textarea></label></div>
                <div class="ci-actions"><button class="ci-btn" id="ci-add-ad">＋ Adicionar referência</button><span class="ci-muted">A biblioteca não presume métricas que a plataforma não disponibiliza.</span></div><div id="ci-anuncios" class="ci-ad-list"></div>
              </div>
              <div class="ci-card"><div class="ci-card-head"><div><span class="ci-kicker">ETAPA 03</span><h3>Análise criativa</h3><p>Entenda o gancho, a narrativa, a linguagem e o que pode ser adaptado sem copiar.</p></div></div><div id="ci-analysis-empty" class="ci-empty">Adicione uma referência com transcrição para iniciar a análise.</div><div id="ci-analysis" hidden></div></div>
              <div class="ci-card"><div class="ci-card-head"><div><span class="ci-kicker">ETAPA 04</span><h3>Da análise ao roteiro</h3><p>Gere caminhos criativos e um primeiro roteiro alinhado ao briefing.</p></div></div><div class="ci-actions"><button class="ci-btn ci-primary" id="ci-gerar" disabled>Gerar ideias e roteiro com IA</button><span class="ci-muted">Usa a Skill UGC já configurada no seu painel.</span></div><div id="ci-roteiro" hidden></div></div>
            </div>
          </main>
        </div>
        <div id="ci-aviso" class="ci-aviso" role="status" hidden></div>
      </div>`;
    $("#ci-novo",sec()).onclick=novo; $("#ci-comecar",sec()).onclick=novo;
    $("#ci-salvar",sec()).onclick=salvarProjeto; $("#ci-add-ad",sec()).onclick=adicionarAnuncio;
    $("#ci-gerar",sec()).onclick=gerarRoteiro; $("#ci-busca",sec()).oninput=renderProjetos;
    carregar();
  }
  function campos(){
    return {brand:$("#ci-brand",sec()).value.trim(),product:$("#ci-product",sec()).value.trim(),objective:$("#ci-objective",sec()).value.trim(),audience:$("#ci-audience",sec()).value.trim(),briefing:$("#ci-briefing",sec()).value.trim(),voice:$("#ci-voice",sec()).value.trim(),deliverables:$("#ci-deliverables",sec()).value.trim(),restrictions:$("#ci-restrictions",sec()).value.trim()};
  }
  function preencher(p){
    const c=p||vazio(); projeto=p; $("#ci-inicio",sec()).hidden=true; $("#ci-editor",sec()).hidden=false;
    for(const [k,v] of Object.entries({brand:"brand",product:"product",objective:"objective",audience:"audience",briefing:"briefing",voice:"voice",deliverables:"deliverables",restrictions:"restrictions"})) $("#ci-"+k,sec()).value=c[v]||"";
    renderAnuncios(); renderAnalise(); $("#ci-gerar",sec()).disabled=!c.briefing;
  }
  async function carregar(){
    limparAviso(); const {data,error}=await supa().from("creative_intelligence_projects").select("*").order("updated_at",{ascending:false});
    if(error){aviso("A tabela da Biblioteca Criativa ainda não foi criada no Supabase. Aplique o arquivo sql-creative-intelligence.sql antes de usar.",true);$("#ci-projetos",sec()).innerHTML='<div class="ci-empty">Configure o banco para salvar seus projetos.</div>';return;}
    window.ciProjetos=data||[]; renderProjetos(); $("#ci-total",sec()).textContent=(data||[]).length;
    const {count}=await supa().from("creative_intelligence_ads").select("*",{count:"exact",head:true}); $("#ci-ads-total",sec()).textContent=count||0;
    const {count:pend}=await supa().from("creative_intelligence_ads").select("*",{count:"exact",head:true}).is("analysis","null"); $("#ci-pendentes",sec()).textContent=pend||0;
  }
  function renderProjetos(){
    const q=($("#ci-busca",sec())?.value||"").toLowerCase(); const arr=(window.ciProjetos||[]).filter(p=>(p.brand+" "+p.product).toLowerCase().includes(q));
    $("#ci-projetos",sec()).innerHTML=arr.length?arr.map(p=>`<button class="ci-project ${projeto?.id===p.id?"active":""}" data-id="${p.id}"><b>${esc(p.brand||"Sem marca")}</b><span>${esc(p.product||"Projeto sem produto")}</span><small>Atualizado em ${data(p.updated_at)}</small></button>`).join(""):'<div class="ci-empty">Nenhum projeto ainda. Crie o primeiro briefing.</div>';
    $$(".ci-project",sec()).forEach(b=>b.onclick=()=>abrirProjeto(b.dataset.id));
  }
  async function novo(){ preencher(vazio()); anuncios=[]; analiseAtual=null; projeto=null; renderProjetos(); $("#ci-anuncios",sec()).innerHTML=""; $("#ci-analysis",sec()).hidden=true; $("#ci-analysis-empty",sec()).hidden=false; $("#ci-roteiro",sec()).hidden=true; }
  async function abrirProjeto(pid){
    limparAviso(); const {data,error}=await supa().from("creative_intelligence_projects").select("*").eq("id",pid).single(); if(error){aviso(error.message,true);return;}
    const {data:ads}=await supa().from("creative_intelligence_ads").select("*").eq("project_id",pid).order("created_at",{ascending:false}); anuncios=ads||[];
    preencher(data); renderProjetos();
  }
  async function salvarProjeto(){
    limparAviso(); const c=campos(); if(!c.brand&&!c.product&&!c.briefing){aviso("Preencha pelo menos a marca, o produto ou o briefing.",true);return;}
    const payload={...c,updated_at:new Date().toISOString()};
    const res=projeto?.id?await supa().from("creative_intelligence_projects").update(payload).eq("id",projeto.id).select().single():await supa().from("creative_intelligence_projects").insert(payload).select().single();
    if(res.error){aviso("Não consegui salvar: "+res.error.message,true);return;} projeto=res.data; $("#ci-save-state",sec()).textContent="Salvo agora"; await carregar(); renderProjetos();
  }
  async function adicionarAnuncio(){
    if(!projeto?.id){await salvarProjeto();if(!projeto?.id)return;}
    const title=$("#ci-ad-title",sec()).value.trim(), url=$("#ci-ad-url",sec()).value.trim(), transcript=$("#ci-ad-transcript",sec()).value.trim();
    if(!title||!url){aviso("Informe o nome e o link da referência.",true);return;}
    try{new URL(url)}catch{aviso("Confira o link do anúncio.",true);return;}
    const row={project_id:projeto.id,title,url,platform:$("#ci-ad-platform",sec()).value,performance_note:$("#ci-ad-performance",sec()).value.trim(),transcript};
    const {data,error}=await supa().from("creative_intelligence_ads").insert(row).select().single(); if(error){aviso(error.message,true);return;}
    anuncios.unshift(data); ["ci-ad-title","ci-ad-url","ci-ad-performance","ci-ad-transcript"].forEach(k=>$("#"+k,sec()).value=""); renderAnuncios(); await carregar();
  }
  function renderAnuncios(){
    $("#ci-anuncios",sec()).innerHTML=anuncios.length?anuncios.map(a=>`<article class="ci-ad"><div><b>${esc(a.title)}</b><small>${esc(a.platform)} · ${data(a.created_at)}</small><a href="${esc(a.url)}" target="_blank" rel="noopener">Abrir anúncio ↗</a></div><div class="ci-ad-actions"><button class="ci-btn ci-small" data-analisar="${a.id}">Analisar</button><button class="ci-btn ci-small" data-excluir="${a.id}">Excluir</button></div></article>`).join(""):'<div class="ci-empty">Suas referências salvas aparecerão aqui.</div>';
    $$("[data-analisar]",sec()).forEach(b=>b.onclick=()=>analisar(b.dataset.analisar)); $$("[data-excluir]",sec()).forEach(b=>b.onclick=()=>excluirAnuncio(b.dataset.excluir));
  }
  async function excluirAnuncio(aid){const {error}=await supa().from("creative_intelligence_ads").delete().eq("id",aid);if(error){aviso(error.message,true);return;}anuncios=anuncios.filter(a=>a.id!==aid);renderAnuncios();await carregar();}
  async function analisar(aid){
    const a=anuncios.find(x=>x.id===aid); if(!a)return; if((a.transcript||"").trim().length<30){aviso("Para analisar o anúncio, cole uma transcrição, legenda ou descrição com pelo menos 30 caracteres.",true);return;}
    aviso("Analisando o mecanismo criativo com a Skill UGC...");
    const {data,error}=await supa().functions.invoke("skill-ugc",{body:{acao:"analisar",transcricao:a.transcript,perfil:a.title,legenda:a.performance_note||"",duracao_seg:0}});
    if(error||data?.error){aviso(data?.error||error.message,true);return;}
    a.analysis=data.analise; const {error:saveError}=await supa().from("creative_intelligence_ads").update({analysis:data.analise,analyzed_at:new Date().toISOString()}).eq("id",aid);
    if(saveError){aviso("Análise pronta, mas não consegui salvá-la: "+saveError.message,true);return;}
    analiseAtual=data.analise; renderAnalise(); $("#ci-gerar",sec()).disabled=false; aviso("Análise salva. Agora você pode transformar os aprendizados em um roteiro.");
    await carregar();
  }
  function renderAnalise(){
    const a=anuncios.find(x=>x.analysis); const el=$("#ci-analysis",sec()); if(!el)return;
    if(!a){el.hidden=true;$("#ci-analysis-empty",sec()).hidden=false;return;}
    el.hidden=false;$("#ci-analysis-empty",sec()).hidden=true;const o=a.analysis.observado||{},i=a.analysis.interpretacao||{};
    el.innerHTML=`<div class="ci-analysis-grid"><section><h4>O que foi observado</h4><dl><dt>Gancho</dt><dd>${esc(o.gancho)}</dd><dt>Formato</dt><dd>${esc(o.formato)}</dd><dt>Estrutura</dt><dd>${esc(o.estrutura)}</dd><dt>Ritmo</dt><dd>${esc(o.ritmo)}</dd><dt>CTA</dt><dd>${esc(o.cta)}</dd></dl></section><section><h4>Leitura estratégica · hipótese</h4><dl><dt>Por que pode funcionar</dt><dd>${esc(i.por_que_funciona)}</dd><dt>Público</dt><dd>${esc(i.publico)}</dd><dt>Emoção</dt><dd>${esc(i.emocao)}</dd><dt>Como adaptar sem copiar</dt><dd>${esc(i.como_adaptar)}</dd></dl></section></div><h4>Ideias derivadas</h4><ul class="ci-ideas">${(a.analysis.ideias||[]).map(x=>"<li>"+esc(x)+"</li>").join("")}</ul><p class="ci-muted">A leitura estratégica é uma hipótese criativa, não uma comprovação de desempenho.</p>`;
  }
  async function gerarRoteiro(){
    if(!projeto?.id){aviso("Salve o briefing primeiro.",true);return;}
    const c=campos(), a=anuncios.find(x=>x.analysis), insight=a?.analysis?.interpretacao?.como_adaptar||"";
    aviso("Criando caminhos criativos e roteiro...");
    const briefing=[c.briefing,"Marca: "+c.brand,"Produto: "+c.product,"Objetivo: "+c.objective,"Público: "+c.audience,"Tom de voz: "+c.voice,"Entregáveis: "+c.deliverables,"Obrigatoriedades e restrições: "+c.restrictions,insight?"Aprendizado de referência (adaptar o mecanismo, nunca copiar): "+insight:""].filter(Boolean).join("\n");
    const {data,error}=await supa().functions.invoke("skill-ugc",{body:{acao:"criar",briefing,marca:c.brand,produto:c.product,objetivo:c.objective,publico:c.audience,duracao:0}});
    if(error||data?.error){aviso(data?.error||error.message,true);return;}
    const r=data.roteiro||{};const blocos=r.blocos||[];const out=$("#ci-roteiro",sec());out.hidden=false;
    out.innerHTML=`<div class="ci-script-head"><span class="ci-kicker">ROTEIRO GERADO PELA SKILL UGC</span><h4>${esc(c.brand)} · ${esc(c.product)}</h4></div>${(r.ganchos||[]).length?'<h4>Opções de gancho</h4><ol>'+r.ganchos.map(x=>'<li>'+esc(typeof x==="string"?x:x.texto||x.fala||JSON.stringify(x))+'</li>').join("")+'</ol>':""}${blocos.map(b=>`<article class="ci-scene"><b>${esc(b.titulo||b.tipo||"Cena")}</b><p>${esc(b.fala||b.texto||"")}</p><small>${esc(b.cena||b.visual||"")}</small></article>`).join("")}<button class="ci-btn" id="ci-copiar">Copiar roteiro</button>`;
    $("#ci-copiar",sec()).onclick=()=>navigator.clipboard?.writeText(blocos.map(b=>(b.titulo||b.tipo||"Cena")+"\n"+(b.fala||b.texto||"")+"\n"+(b.cena||b.visual||"")).join("\n\n"));
    aviso("Roteiro gerado. Revise as obrigatoriedades antes de enviar à marca.");
  }
  document.addEventListener("painel:aba",e=>{if(e.detail==="creative-intelligence")layout();});
})();
