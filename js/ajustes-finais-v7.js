// Ajustes finais de clareza e desempenho para a operação de captação.
(() => {
  const PAGE_SIZE = 8;
  const quantidadeVisivelPorQuadra = new Map();

  function atualizarTextosPainel() {
    const stat = document.getElementById('stat-concluidas');
    if (!stat) return;
    const card = stat.parentElement;
    const titulo = card?.querySelector('span');
    if (titulo) titulo.textContent = 'Áreas Mapeadas';
    const descricoes = card?.querySelectorAll('div.text-xs');
    if (descricoes?.length) descricoes[descricoes.length - 1].textContent = 'Trechos percorridos até o momento';
  }

  // O painel mostra áreas já trabalhadas, sem sugerir que Piratininga tenha somente 8 quadras.
  window.atualizarTotais = function atualizarTotaisV7() {
    recalcular();
    const concluidas = quadras.filter(q => q.status === 'Captação Realizada').length;
    const statConcluidas = document.getElementById('stat-concluidas');
    const statImoveis = document.getElementById('stat-imoveis');
    const statContatos = document.getElementById('stat-contatos');
    const statImportados = document.getElementById('stat-importados');
    if (statConcluidas) statConcluidas.innerText = String(concluidas);
    if (statImoveis) statImoveis.innerText = quadras.reduce((a,q)=>a+q.imoveis,0);
    if (statContatos) statContatos.innerText = quadras.reduce((a,q)=>a+q.contatos,0);
    const importados = quadras.reduce((a,q)=>a+q.casas.filter(c=>c.origem==='github').length,0);
    if (statImportados) statImportados.innerText = `${importados} via GitHub`;
    const setor = document.getElementById('setor-contagem');
    if (setor) setor.innerText = `Praia de Piratininga — ${concluidas} áreas mapeadas até o momento`;
    atualizarTextosPainel();
  };

  // A galeria abre apenas as primeiras 8 fotos. As demais entram em blocos sob demanda.
  window.renderizarListaGaleria = function renderizarListaGaleriaV7(q) {
    const container = document.getElementById('galeria-lista');
    if (!container) return;
    container.innerHTML = '';
    const badge = document.getElementById('badge-total-casas');
    if (badge) badge.innerText = q.casas.length;

    if (!q.casas.length) {
      container.innerHTML = '<div class="col-span-full py-8 text-center text-slate-500 text-xs italic">Nenhum imóvel cadastrado nesta quadra.</div>';
      return;
    }

    const limite = Math.min(quantidadeVisivelPorQuadra.get(q.id) || PAGE_SIZE, q.casas.length);
    quantidadeVisivelPorQuadra.set(q.id, limite);

    q.casas.slice(0, limite).forEach((casa, index) => {
      let badgeClasse='bg-slate-800 text-slate-300 border-slate-700';
      if(casa.situacao==='Particular') badgeClasse='bg-emerald-950/80 text-emerald-300 border-emerald-800';
      if(casa.situacao==='Terreno') badgeClasse='bg-amber-950/80 text-amber-300 border-amber-800';
      if(casa.situacao==='Concorrente') badgeClasse='bg-blue-950/80 text-sky-300 border-blue-800';

      const origem=casa.origem==='github'?'<span class="absolute bottom-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded bg-black/70 text-sky-300 border border-sky-700/60">GITHUB</span>':'';
      const foto=casa.foto||'';
      const endereco=textoSeguro(enderecoCasa(casa));
      const lote=casa.lote?`<p class="text-[10px] text-slate-400">Lote/inscrição: <span class="text-slate-200">${textoSeguro(casa.lote)}</span></p>`:'';
      const gps=casa.latitude&&casa.longitude?'<span title="Localização registrada" class="text-emerald-400"><i data-lucide="map-pin" class="w-3 h-3"></i></span>':'';
      const prioridade = index < 2 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy" fetchpriority="low"';
      const imagem = foto
        ? `<img src="${textoSeguro(foto)}" alt="Foto do imóvel" ${prioridade} decoding="async" width="640" height="440" class="w-full h-full object-cover">`
        : '<div class="w-full h-full flex items-center justify-center text-slate-600 text-xs">Sem foto</div>';

      container.insertAdjacentHTML('beforeend',`<div draggable="true" data-casa-index="${index}" class="bg-[#050f1f] border border-[#14294b] rounded-xl overflow-hidden flex flex-col justify-between hover:border-[#1d3d70] transition cursor-grab active:cursor-grabbing"><div class="relative h-44 bg-black">${imagem}<span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeClasse}">${textoSeguro(casa.situacao||'Fechada')}</span>${origem}<div class="absolute top-2 right-2 flex items-center gap-1"><button onclick="event.stopPropagation();moverCasaSeta(${index},-1)" ${index===0?'disabled':''} title="Mover para trás" class="p-1.5 rounded-md bg-black/70 hover:bg-slate-700 text-white disabled:opacity-30"><i data-lucide="arrow-left" class="w-3.5 h-3.5"></i></button><button onclick="event.stopPropagation();moverCasaSeta(${index},1)" ${index===q.casas.length-1?'disabled':''} title="Mover para frente" class="p-1.5 rounded-md bg-black/70 hover:bg-slate-700 text-white disabled:opacity-30"><i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></button><button onclick="event.stopPropagation();editarCasa(${index})" title="Editar" class="p-1.5 rounded-md bg-black/70 hover:bg-[#0094ff] text-white"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button><button onclick="event.stopPropagation();excluirCasa(${index})" title="Excluir" class="p-1.5 rounded-md bg-black/70 hover:bg-rose-600 text-rose-300"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button></div></div><div class="p-3.5 space-y-2"><div class="flex items-center justify-between gap-2"><span class="text-[10px] text-slate-500 font-bold">#${String(index+1).padStart(2,'0')}</span>${gps}</div><p class="font-bold text-white text-xs leading-snug">${endereco}</p>${lote}<p class="text-[11px] text-slate-300 flex items-start gap-1.5"><i data-lucide="phone" class="w-3 h-3 text-[#0094ff] shrink-0 mt-0.5"></i><span>${textoSeguro(casa.telefone||'Sem contato anotado')}</span></p><button onclick="editarCasa(${index})" class="w-full py-1.5 bg-[#0b1b36] hover:bg-[#112a54] text-sky-400 text-[11px] font-semibold rounded-lg">Editar informações</button></div></div>`);
    });

    if (limite < q.casas.length) {
      const restantes = q.casas.length - limite;
      container.insertAdjacentHTML('beforeend', `<div class="col-span-full flex justify-center pt-2"><button id="btn-carregar-mais-fotos" class="px-5 py-2.5 rounded-xl bg-[#0b1b36] hover:bg-[#14305c] border border-[#1d3d70] text-sky-300 text-xs font-bold">Carregar mais fotos (${restantes} restantes)</button></div>`);
      document.getElementById('btn-carregar-mais-fotos')?.addEventListener('click', () => {
        quantidadeVisivelPorQuadra.set(q.id, Math.min(limite + PAGE_SIZE, q.casas.length));
        window.renderizarListaGaleria(q);
      });
    }

    configurarDragDrop(container,q);
    if(window.lucide) lucide.createIcons();
  };

  const abrirGaleriaOriginal = window.abrirGaleria;
  window.abrirGaleria = function abrirGaleriaV7(id) {
    quantidadeVisivelPorQuadra.set(id, PAGE_SIZE);
    return abrirGaleriaOriginal(id);
  };

  // Prepara a conexão dos tiles do mapa para reduzir a espera na primeira abertura.
  if (!document.querySelector('link[data-osm-preconnect]')) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://tile.openstreetmap.org';
    link.crossOrigin = 'anonymous';
    link.dataset.osmPreconnect = '1';
    document.head.appendChild(link);
  }

  let mapaPreparado = false;
  function prepararMapa() {
    if (mapaPreparado) return;
    mapaPreparado = true;
    try {
      if (typeof preaquecerTilesMapa === 'function') preaquecerTilesMapa();
    } catch (e) { console.debug('Pré-aquecimento do mapa adiado.', e); }
  }
  document.querySelectorAll('[onclick*="abrirMapaTerritorial"]').forEach(btn => {
    btn.addEventListener('pointerenter', prepararMapa, {once:true});
    btn.addEventListener('focus', prepararMapa, {once:true});
    btn.addEventListener('touchstart', prepararMapa, {once:true, passive:true});
  });

  atualizarTextosPainel();
  window.atualizarTotais();
})();