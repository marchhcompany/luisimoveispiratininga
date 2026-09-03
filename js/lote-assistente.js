const LOTES_ASSISTENTE_ENDPOINT = 'https://sig.niteroi.rj.gov.br/server/rest/services/Hosted/NGP_SMF_SEREC_A_LOTES_PUBLICO/FeatureServer/30/query';
let assistenteQuadraId = null;
let assistenteLotes = [];

function escAssist(valor='') {
  return String(valor).replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
}

function instalarAssistenteLotes() {
  if (document.getElementById('modal-assistente-lotes')) return;
  const botoes = document.querySelector('header .flex.flex-wrap.items-center.gap-3.self-start');
  if (botoes) {
    const btn = document.createElement('button');
    btn.className = 'px-4 py-2 rounded-xl bg-violet-700 hover:bg-violet-600 text-white text-sm font-semibold flex items-center gap-2 transition';
    btn.innerHTML = '<i data-lucide="wand-sparkles" class="w-4 h-4"></i> Preencher em Lote';
    btn.onclick = abrirAssistenteLotes;
    botoes.insertBefore(btn, botoes.children[2] || null);
  }

  document.body.insertAdjacentHTML('beforeend', `
    <div id="modal-assistente-lotes" class="fixed inset-0 bg-black/90 backdrop-blur-md z-[80] hidden flex items-center justify-center p-3 md:p-5">
      <div class="bg-[#081427] border border-[#1b355e] w-full max-w-6xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div class="p-5 border-b border-[#122543] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div><span class="text-xs font-bold text-violet-400 uppercase tracking-wider">Assistente V4</span><h2 class="text-lg font-bold text-white">Preenchimento em lote por rua e lotes oficiais</h2><p class="text-[11px] text-slate-400 mt-1">Busque uma rua na base da Prefeitura, revise a sequência e associe os imóveis sem digitar endereço por endereço.</p></div>
          <button onclick="fecharAssistenteLotes()" class="text-slate-400 hover:text-white p-2"><i data-lucide="x" class="w-6 h-6"></i></button>
        </div>
        <div class="p-5 overflow-y-auto space-y-5 flex-1">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#050f1f] border border-[#14294b] rounded-xl p-4">
            <div><label class="text-[11px] text-slate-400 block mb-1">Quadra</label><select id="assist-quadra" onchange="selecionarQuadraAssistente()" class="w-full px-3 py-2 bg-[#081427] border border-[#1b355e] rounded-lg text-xs text-white"></select></div>
            <div class="md:col-span-2"><label class="text-[11px] text-slate-400 block mb-1">Rua / logradouro</label><input id="assist-rua" type="text" placeholder="Ex: Rua Wilson Vieira" class="w-full px-3 py-2 bg-[#081427] border border-[#1b355e] rounded-lg text-xs text-white"></div>
            <div class="flex items-end"><button onclick="buscarLotesDaRua()" class="w-full px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2"><i data-lucide="search" class="w-4 h-4"></i> Buscar lotes oficiais</button></div>
            <div class="md:col-span-4 flex flex-wrap gap-2 items-center justify-between"><span id="assist-status" class="text-[11px] text-slate-400">Escolha a quadra e informe a rua.</span><div class="flex flex-wrap gap-2"><button onclick="sugerirSequenciaLotes()" id="btn-sugerir-sequencia" disabled class="px-3 py-2 bg-violet-800 disabled:opacity-40 hover:bg-violet-700 text-white text-xs font-bold rounded-lg">Sugerir por ordem</button><button onclick="renomearQuadraPelaRua()" id="btn-renomear-quadra" disabled class="px-3 py-2 bg-slate-800 disabled:opacity-40 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg">Usar rua como nome da quadra</button><button onclick="salvarAssociacoesLotes()" id="btn-salvar-lotes" disabled class="px-4 py-2 bg-emerald-700 disabled:opacity-40 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg">Salvar associações revisadas</button></div></div>
          </div>
          <div class="bg-amber-950/20 border border-amber-800/50 rounded-xl p-3 text-[11px] text-amber-200 leading-relaxed"><strong>Importante:</strong> “Sugerir por ordem” apenas prepara uma sugestão visual. Nada é salvo até você revisar os lotes e clicar em “Salvar associações revisadas”. Isso evita atribuir número errado automaticamente.</div>
          <div id="assist-lista" class="space-y-3"></div>
        </div>
      </div>
    </div>`);
  if (window.lucide) lucide.createIcons();
}

function abrirAssistenteLotes() {
  instalarAssistenteLotes();
  const select = document.getElementById('assist-quadra');
  select.innerHTML = quadras.map(q => `<option value="${q.id}">${escAssist(q.tag)} — ${escAssist(q.nome)} (${q.casas.length})</option>`).join('');
  document.getElementById('modal-assistente-lotes').classList.remove('hidden');
  selecionarQuadraAssistente();
  if (window.lucide) lucide.createIcons();
}

function fecharAssistenteLotes() {
  document.getElementById('modal-assistente-lotes')?.classList.add('hidden');
}

function selecionarQuadraAssistente() {
  assistenteQuadraId = Number(document.getElementById('assist-quadra')?.value);
  assistenteLotes = [];
  const q = quadras.find(x => Number(x.id) === assistenteQuadraId);
  const rua = document.getElementById('assist-rua');
  if (q && rua && (!rua.value || rua.dataset.quadra !== String(q.id))) {
    const primeiraRua = q.casas.find(c => c.rua && !String(c.rua).includes('preencher'))?.rua || '';
    rua.value = primeiraRua;
    rua.dataset.quadra = String(q.id);
  }
  atualizarBotoesAssistente(false);
  renderizarListaAssistente();
}

function normalizarTextoBusca(txt='') {
  return txt.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
}

function centroideGeometria(geometry) {
  const rings = geometry?.rings || [];
  const pts = rings.flat();
  if (!pts.length) return {lat:'', lng:''};
  const soma = pts.reduce((acc,p) => ({x:acc.x+Number(p[0]||0), y:acc.y+Number(p[1]||0)}), {x:0,y:0});
  return {lat:(soma.y/pts.length).toFixed(7), lng:(soma.x/pts.length).toFixed(7)};
}

async function buscarLotesDaRua() {
  const rua = document.getElementById('assist-rua')?.value.trim();
  const status = document.getElementById('assist-status');
  if (!rua) { status.innerText = 'Digite o nome da rua para buscar.'; return; }
  status.innerText = 'Consultando lotes oficiais da Prefeitura...';
  atualizarBotoesAssistente(false);
  try {
    const termo = normalizarTextoBusca(rua).replace(/'/g,"''");
    const params = new URLSearchParams({
      f:'json',
      where:`UPPER(tx_logrado) LIKE '%${termo}%'`,
      outFields:'tx_insct,tx_logrado,tx_nroport,tx_bairro',
      returnGeometry:'true',
      outSR:'4326',
      resultRecordCount:'2000'
    });
    let resp = await fetch(`${LOTES_ASSISTENTE_ENDPOINT}?${params.toString()}`);
    if (!resp.ok) throw new Error('Falha HTTP');
    let json = await resp.json();
    let features = json.features || [];

    if (!features.length) {
      const palavra = termo.split(' ').filter(p => p.length > 3).pop() || termo;
      const p2 = new URLSearchParams({f:'json',where:`UPPER(tx_logrado) LIKE '%${palavra.replace(/'/g,"''")}%'`,outFields:'tx_insct,tx_logrado,tx_nroport,tx_bairro',returnGeometry:'true',outSR:'4326',resultRecordCount:'2000'});
      resp = await fetch(`${LOTES_ASSISTENTE_ENDPOINT}?${p2.toString()}`);
      json = await resp.json();
      features = json.features || [];
    }

    assistenteLotes = features.map((f,i) => {
      const a = f.attributes || {};
      const c = centroideGeometria(f.geometry);
      return {id:i, inscricao:a.tx_insct || '', rua:a.tx_logrado || rua, numero:a.tx_nroport || '', bairro:a.tx_bairro || 'Piratininga', latitude:c.lat, longitude:c.lng};
    }).sort((a,b) => {
      const na = parseInt(String(a.numero).replace(/\D/g,''),10), nb = parseInt(String(b.numero).replace(/\D/g,''),10);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na-nb;
      return String(a.numero).localeCompare(String(b.numero),'pt-BR',{numeric:true});
    });

    const nomes = [...new Set(assistenteLotes.map(l => l.rua).filter(Boolean))];
    status.innerText = assistenteLotes.length ? `${assistenteLotes.length} lotes encontrados${nomes.length ? ` • ${nomes.slice(0,2).join(' / ')}` : ''}. Revise antes de salvar.` : 'Nenhum lote encontrado. Confira a grafia da rua.';
    atualizarBotoesAssistente(assistenteLotes.length > 0);
    renderizarListaAssistente();
  } catch (e) {
    console.error(e);
    status.innerText = 'Não foi possível consultar a base oficial agora. Tente novamente.';
  }
}

function atualizarBotoesAssistente(ativo) {
  ['btn-sugerir-sequencia','btn-renomear-quadra','btn-salvar-lotes'].forEach(id => { const el=document.getElementById(id); if(el) el.disabled=!ativo; });
}

function optionLote(lote, selecionado='') {
  const label = `${lote.numero || 's/n'} • ${lote.rua}${lote.inscricao ? ` • ${lote.inscricao}` : ''}`;
  return `<option value="${lote.id}" ${String(selecionado)===String(lote.id)?'selected':''}>${escAssist(label)}</option>`;
}

function renderizarListaAssistente() {
  const lista = document.getElementById('assist-lista');
  const q = quadras.find(x => Number(x.id) === assistenteQuadraId);
  if (!lista || !q) return;
  if (!q.casas.length) { lista.innerHTML = '<div class="text-center py-8 text-slate-500 text-xs">Esta quadra não possui imóveis.</div>'; return; }
  lista.innerHTML = q.casas.map((casa,index) => {
    const selecionado = casa._assistLoteId ?? '';
    const endereco = typeof enderecoCasa === 'function' ? enderecoCasa(casa) : (casa.rua || casa.endereco || 'Endereço a preencher');
    const foto = casa.foto ? `<img src="${escAssist(casa.foto)}" class="w-20 h-16 object-cover rounded-lg bg-black" alt="">` : '<div class="w-20 h-16 rounded-lg bg-slate-900 flex items-center justify-center text-[9px] text-slate-600">Sem foto</div>';
    return `<div class="bg-[#050f1f] border border-[#14294b] rounded-xl p-3 grid grid-cols-[80px_1fr] md:grid-cols-[80px_1fr_1.4fr] gap-3 items-center">
      ${foto}
      <div class="min-w-0"><div class="text-[10px] text-sky-400 font-bold">#${index+1} • ${escAssist(casa.id || '')}</div><div class="text-xs text-white font-semibold truncate">${escAssist(endereco)}</div><div class="text-[10px] text-slate-500 mt-1">Atual: ${escAssist(casa.lote || 'sem lote')}</div></div>
      <div class="col-span-2 md:col-span-1"><label class="text-[10px] text-slate-400 block mb-1">Associar ao lote oficial</label><select data-assist-index="${index}" onchange="marcarSelecaoLote(${index},this.value)" class="w-full px-3 py-2 bg-[#081427] border border-[#1b355e] rounded-lg text-xs text-white"><option value="">— revisar / não associar —</option>${assistenteLotes.map(l=>optionLote(l,selecionado)).join('')}</select></div>
    </div>`;
  }).join('');
}

function marcarSelecaoLote(index, loteId) {
  const q = quadras.find(x => Number(x.id) === assistenteQuadraId);
  if (!q?.casas[index]) return;
  q.casas[index]._assistLoteId = loteId === '' ? '' : Number(loteId);
}

function sugerirSequenciaLotes() {
  const q = quadras.find(x => Number(x.id) === assistenteQuadraId);
  if (!q || !assistenteLotes.length) return;
  q.casas.forEach((casa,index) => { casa._assistLoteId = index < assistenteLotes.length ? assistenteLotes[index].id : ''; });
  renderizarListaAssistente();
  document.getElementById('assist-status').innerText = `Sugestão preparada por ordem crescente de número. Revise os ${q.casas.length} imóveis antes de salvar.`;
}

function renomearQuadraPelaRua() {
  const q = quadras.find(x => Number(x.id) === assistenteQuadraId);
  const rua = assistenteLotes[0]?.rua || document.getElementById('assist-rua')?.value.trim();
  if (!q || !rua) return;
  q.nome = rua;
  salvar();
  document.getElementById('assist-status').innerText = `Quadra renomeada para “${rua}”.`;
}

function salvarAssociacoesLotes() {
  const q = quadras.find(x => Number(x.id) === assistenteQuadraId);
  if (!q) return;
  let total = 0;
  q.casas.forEach(casa => {
    if (casa._assistLoteId === '' || casa._assistLoteId === undefined) return;
    const lote = assistenteLotes.find(l => Number(l.id) === Number(casa._assistLoteId));
    if (!lote) return;
    casa.rua = lote.rua || casa.rua;
    casa.numero = lote.numero || casa.numero;
    casa.lote = lote.inscricao || casa.lote;
    casa.bairro = lote.bairro || casa.bairro || 'Piratininga';
    casa.latitude = lote.latitude || casa.latitude;
    casa.longitude = lote.longitude || casa.longitude;
    casa.endereco = `${casa.rua}${casa.numero ? `, nº ${casa.numero}` : ''}`;
    delete casa._assistLoteId;
    total++;
  });
  salvar();
  renderizarListaAssistente();
  if (typeof renderizarImoveisNoMapa === 'function' && mapaTerritorial) renderizarImoveisNoMapa(false);
  document.getElementById('assist-status').innerText = `${total} imóvel${total===1?'':'is'} atualizado${total===1?'':'s'} com dados oficiais de lote e coordenadas.`;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalarAssistenteLotes);
else instalarAssistenteLotes();
