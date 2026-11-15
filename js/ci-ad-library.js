(() => {
  "use strict";
  const $ = (s, r=document) => r.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const supa = () => window.banco;
  let resultados = [], selecionados = new Set(), historico = [];
  const root = () => $("#ci-meta-library");
  const projeto = () => window.ciProjetoAtual?.() || null;
  const data = (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "Agora";
  const aviso = (msg, erro=false) => {
    const el = $("#ci-meta-status", root());
    if (el) { el.textContent=msg; el.className="ci-meta-status"+(erro?" erro":""); el.hidden=false; }
  };
  const busy = (on) => {
    const b=$("#ci-meta-search",root()); if(b){b.disabled=on;b.textContent=on?"Pesquisando…":"Pesquisar anúncios";}
  };
  function montar() {
    const el=root(); if(!el || el.dataset.ready==="1") return;
    el.dataset.ready="1";
    el.innerHTML = `
      <div class="ci-meta-top">
        <div><span class="ci-kicker">PESQUISA EXTERNA · META</span><h4>Buscar na Biblioteca de Anúncios</h4><p>Encontre anúncios públicos reais e transforme os textos disponíveis em referências criativas.</p></div>
        <span class="ci-meta-source">Fonte: Meta Ad Library</span>
      </div>
      <div class="ci-meta-search-grid">
        <label class="ci-meta-query">Marca, produto ou palavra-chave<input id="ci-meta-query" placeholder="Ex.: MRV, apartamento, sair do aluguel"></label>
        <label>País<select id="ci-meta-country"><option value="BR" selected>Brasil</option><option value="US">Estados Unidos</option><option value="PT">Portugal</option><option value="MX">México</option><option value="ALL">Todos os países</option></select></label>
        <label>Formato<select id="ci-meta-media"><option value="all">Todos</option><option value="video">Vídeo (quando identificado)</option></select></label>
        <label>Status<select id="ci-meta-active"><option value="active" selected>Somente ativos</option><option value="all">Todos disponíveis</option></select></label>
      </div>
      <div class="ci-meta-actions"><button class="ci-btn ci-primary" id="ci-meta-search" type="button">Pesquisar anúncios</button><span class="ci-muted">Até 30 resultados por pesquisa. A consulta pode consumir créditos do Apify.</span></div>
      <div id="ci-meta-status" class="ci-meta-status" role="status" hidden></div>
      <div id="ci-meta-results" class="ci-meta-results"><div class="ci-empty">Faça uma pesquisa para encontrar referências reais.</div></div>
      <div class="ci-meta-history"><div class="ci-meta-history-head"><h4>Pesquisas anteriores</h4><span class="ci-muted">Histórico deste projeto</span></div><div id="ci-meta-history-list" class="ci-meta-history-list"><span class="ci-muted">Carregando histórico…</span></div></div>`;
    $("#ci-meta-search",el).onclick=pesquisar;
    $("#ci-meta-query",el).value=$("#ci-brand")?.value || "";
    carregarHistorico();
  }
  async function pesquisar() {
    const p=projeto();
    if(!p?.id){aviso("Salve o briefing antes de pesquisar para vincular os resultados ao projeto.",true);return;}
    const query=$("#ci-meta-query",root()).value.trim() || $("#ci-brand")?.value.trim() || "";
    if(query.length<2){aviso("Digite uma marca, produto ou palavra-chave.",true);return;}
    const country=$("#ci-meta-country",root()).value;
    const mediaType=$("#ci-meta-media",root()).value;
    const activeOnly=$("#ci-meta-active",root()).value==="active";
    busy(true); aviso("Consultando a Biblioteca de Anúncios. Isso pode levar alguns segundos.");
    $("#ci-meta-results",root()).innerHTML='<div class="ci-meta-loading"><span class="ci-spinner"></span> Buscando anúncios públicos…</div>';
    try {
      const {data,error}=await supa().functions.invoke("ci-ad-library",{body:{query,country:country==="ALL"?"US":country,mediaType,activeOnly,maxResults:30}});
      if(error || data?.error) throw new Error(data?.error || error.message || "A busca não respondeu.");
      resultados=Array.isArray(data.ads)?data.ads:[];
      selecionados.clear();
      const row={project_id:p.id,query,country,active_only:activeOnly,media_type_filter:mediaType,result_count:resultados.length,results:resultados,library_search_url:data.library_search_url||""};
      const saved=await supa().from("creative_intelligence_searches").insert(row).select().single();
      if(saved.error) {
        aviso("Busca concluída, mas o histórico não foi salvo. Aplique sql-creative-intelligence-library.sql no Supabase. Erro: "+saved.error.message,true);
      } else {
        historico.unshift(saved.data); renderHistorico();
        aviso(resultados.length+" anúncio(s) retornado(s). Confira os dados e selecione os que deseja guardar.");
      }
      renderResultados();
      if(!resultados.length) $("#ci-meta-results",root()).innerHTML='<div class="ci-empty">A pesquisa não retornou anúncios. Tente uma palavra-chave mais específica ou remova o filtro de formato.</div>';
    } catch(e) {
      const msg=e.message||"Não foi possível pesquisar.";
      aviso(msg,true);
      $("#ci-meta-results",root()).innerHTML='<div class="ci-empty">Não foi possível recuperar anúncios nesta tentativa. Nenhum resultado fictício foi exibido.</div>';
    } finally { busy(false); }
  }
  function renderResultados() {
    const el=$("#ci-meta-results",root()); if(!el)return;
    if(!resultados.length){el.innerHTML='<div class="ci-empty">Nenhum anúncio encontrado nesta pesquisa.</div>';return;}
    el.innerHTML=`<div class="ci-meta-results-head"><b>${resultados.length} anúncios encontrados</b><span class="ci-muted">Selecione as referências que deseja salvar</span></div>`+resultados.map((a,i)=>{
      const checked=selecionados.has(i)?"checked":"";
      const status=a.is_active===true?"Ativo":a.is_active===false?"Inativo":"Status não informado";
      const texto=a.body||a.title||a.description||"A Biblioteca não disponibilizou o texto deste criativo.";
      return `<article class="ci-meta-ad">
        <label class="ci-meta-check"><input type="checkbox" data-meta-select="${i}" ${checked}><span></span></label>
        <div class="ci-meta-ad-body">
          <div class="ci-meta-ad-top"><b>${esc(a.page_name)}</b><span class="ci-meta-pill">${esc(a.media_type||"Formato não identificado")}</span><span class="ci-meta-pill">${esc(status)}</span></div>
          ${a.title?`<strong>${esc(a.title)}</strong>`:""}
          <p>${esc(texto)}</p>
          ${a.description?`<small>${esc(a.description)}</small>`:""}
          <div class="ci-meta-ad-foot"><span>${esc(a.library_id?"ID "+a.library_id:"ID não informado")}</span><span>${esc(a.start_date?"Início: "+data(a.start_date):"Data não informada")}</span><span>${esc((a.platforms||[]).join(", ")||"Plataforma não informada")}</span></div>
          ${a.snapshot_url?`<a href="${esc(a.snapshot_url)}" target="_blank" rel="noopener noreferrer">Abrir anúncio original ↗</a>`:"<span class='ci-muted'>Link original não retornado pela fonte.</span>"}
          ${a.video_url?`<a href="${esc(a.video_url)}" target="_blank" rel="noopener noreferrer">Abrir vídeo ↗</a>`:""}
        </div>
      </article>`;
    }).join("")+`<div class="ci-meta-savebar"><span class="ci-muted">${selecionados.size} selecionado(s)</span><button class="ci-btn ci-primary" id="ci-meta-save" ${selecionados.size?"":"disabled"}>Salvar referências selecionadas</button></div><p class="ci-muted">A IA só poderá analisar o conteúdo textual retornado. Para analisar cenas e falas de um vídeo, será necessária uma transcrição ou acesso audiovisual real.</p>`;
    $$("[data-meta-select]",el).forEach(input=>input.onchange=()=>{const i=Number(input.dataset.metaSelect);input.checked?selecionados.add(i):selecionados.delete(i);renderResultados();});
    $("#ci-meta-save",el)?.addEventListener("click",salvarSelecionados);
  }
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  async function salvarSelecionados() {
    const p=projeto(); if(!p?.id)return;
    const escolhidos=[...selecionados].map(i=>resultados[i]).filter(Boolean);
    if(!escolhidos.length)return;
    aviso("Salvando referências no projeto…");
    let salvos=0, duplicados=0, falhas=0;
    for(const a of escolhidos) {
      if(a.library_id) {
        const exists=await supa().from("creative_intelligence_ads").select("id").eq("project_id",p.id).eq("library_id",a.library_id).maybeSingle();
        if(exists.data?.id){duplicados++;continue;}
      }
      const url=a.snapshot_url||"https://www.facebook.com/ads/library/";
      const transcript=a.text_for_analysis||[a.body,a.title,a.description].filter(Boolean).join("\n");
      const row={project_id:p.id,title:(a.page_name||"Anunciante")+" · "+(a.title||a.library_id||"Anúncio da Meta"),url,platform:"Meta Ad Library",performance_note:[a.body,a.description].filter(Boolean).join("\n"),transcript,source:"meta_library",library_id:a.library_id,metadata:a};
      const {error}=await supa().from("creative_intelligence_ads").insert(row);
      if(error){falhas++;continue;} salvos++;
    }
    aviso(`${salvos} referência(s) salva(s), ${duplicados} duplicada(s), ${falhas} falha(s). Use “Analisar” na lista de anúncios para gerar a leitura estratégica.`,falhas>0);
    if(window.ciAtualizarAnuncios) await window.ciAtualizarAnuncios();
    selecionados.clear(); renderResultados();
  }
  async function carregarHistorico() {
    const p=projeto(), el=$("#ci-meta-history-list",root()); if(!p?.id||!el)return;
    const {data,error}=await supa().from("creative_intelligence_searches").select("id,query,country,result_count,created_at,results,library_search_url,active_only,media_type_filter").eq("project_id",p.id).order("created_at",{ascending:false}).limit(12);
    if(error){el.innerHTML='<span class="ci-muted">O histórico será habilitado após aplicar a migração SQL da Biblioteca de Referências.</span>';return;}
    historico=data||[]; renderHistorico();
  }
  function renderHistorico() {
    const el=$("#ci-meta-history-list",root()); if(!el)return;
    el.innerHTML=historico.length?historico.map(h=>`<button type="button" class="ci-meta-history-item" data-history="${h.id}"><span><b>${esc(h.query)}</b><small>${data(h.created_at)} · ${h.result_count} anúncios · ${esc(h.country)}</small></span><span>Reabrir ↗</span></button>`).join(""):'<span class="ci-muted">Nenhuma pesquisa salva neste projeto.</span>';
    $$("[data-history]",el).forEach(b=>b.onclick=()=>abrirHistorico(b.dataset.history));
  }
  function abrirHistorico(id) {
    const h=historico.find(x=>x.id===id); if(!h)return;
    resultados=Array.isArray(h.results)?h.results:[]; selecionados.clear();
    $("#ci-meta-query",root()).value=h.query||"";
    $("#ci-meta-country",root()).value=h.country||"BR";
    $("#ci-meta-media",root()).value=h.media_type_filter||"all";
    $("#ci-meta-active",root()).value=h.active_only===false?"all":"active";
    renderResultados(); aviso("Pesquisa anterior carregada. Os dados são os que foram salvos na data da consulta.");
  }
  window.initCIBiblioteca = montar;
  window.ciBibliotecaProjetoAlterado = () => { if(root()?.dataset.ready==="1"){ $("#ci-meta-query",root()).value=$("#ci-brand")?.value||""; resultados=[];selecionados.clear();$("#ci-meta-results",root()).innerHTML='<div class="ci-empty">Faça uma pesquisa para encontrar referências reais.</div>';carregarHistorico(); } };
})();
