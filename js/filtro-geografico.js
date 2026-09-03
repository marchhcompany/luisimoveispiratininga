const LIMITES_QUADRAS_KEY = 'luis_territorial_limites_quadras_v1';
let limitesQuadras = (() => { try { return JSON.parse(localStorage.getItem(LIMITES_QUADRAS_KEY) || '{}'); } catch { return {}; } })();
let mapaLimiteQuadra = null;
let camadaLimiteQuadra = null;
let pontosLimiteQuadra = [];

function salvarLimitesQuadras() {
  localStorage.setItem(LIMITES_QUADRAS_KEY, JSON.stringify(limitesQuadras));
}

function instalarFiltroGeografico() {
  const aguardar = () => {
    if (!document.getElementById('modal-assistente-lotes') || typeof buscarLotesDaRua !== 'function') {
      setTimeout(aguardar, 120);
      return;
    }
    if (document.getElementById('assist-bairro')) return;

    const rua = document.getElementById('assist-rua');
    const bloco = rua?.parentElement?.parentElement;
    if (bloco) {
      bloco.classList.remove('md:grid-cols-4');
      bloco.classList.add('md:grid-cols-6');
      rua.parentElement.classList.remove('md:col-span-2');
      rua.parentElement.classList.add('md:col-span-2');
      rua.parentElement.insertAdjacentHTML('afterend', `
        <div><label class="text-[11px] text-slate-400 block mb-1">Bairro</label><input id="assist-bairro" value="Piratininga" type="text" class="w-full px-3 py-2 bg-[#081427] border border-[#1b355e] rounded-lg text-xs text-white"></div>
        <div class="flex items-end"><button onclick="abrirDefinicaoAreaQuadra()" class="w-full px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2"><i data-lucide="scan" class="w-4 h-4"></i> Definir área</button></div>`);
      const botaoBusca = bloco.querySelector('button[onclick="buscarLotesDaRua()"]')?.parentElement;
      if (botaoBusca) botaoBusca.classList.add('md:col-span-1');
    }

    const aviso = document.querySelector('#modal-assistente-lotes .bg-amber-950\/20');
    aviso?.insertAdjacentHTML('beforebegin', `<div id="assist-area-status" class="bg-indigo-950/20 border border-indigo-800/50 rounded-xl p-3 text-[11px] text-indigo-200 leading-relaxed"></div>`);

    document.body.insertAdjacentHTML('beforeend', `
      <div id="modal-area-quadra" class="fixed inset-0 bg-black/90 backdrop-blur-md z-[95] hidden flex items-center justify-center p-3 md:p-5">
        <div class="bg-[#081427] border border-[#1b355e] w-full max-w-5xl max-h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div class="p-5 border-b border-[#122543] flex items-center justify-between gap-3">
            <div><span class="text-xs font-bold text-indigo-400 uppercase tracking-wider">Filtro geográfico</span><h2 class="text-lg font-bold text-white">Definir área da quadra</h2><p class="text-[11px] text-slate-400 mt-1">Clique ao redor da quadra no mapa. Use pelo menos 3 pontos e depois salve.</p></div>
            <button onclick="fecharDefinicaoAreaQuadra()" class="text-slate-400 hover:text-white p-2"><i data-lucide="x" class="w-6 h-6"></i></button>
          </div>
          <div class="p-4 flex flex-wrap gap-2 border-b border-[#122543] bg-[#050f1f]">
            <button onclick="usarMinhaLocalizacaoArea()" class="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg">Minha localização</button>
            <button onclick="desfazerPontoArea()" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg">Desfazer ponto</button>
            <button onclick="limparAreaQuadra()" class="px-3 py-2 bg-rose-950 hover:bg-rose-900 text-rose-200 text-xs font-semibold rounded-lg">Limpar desenho</button>
            <button onclick="salvarAreaQuadra()" class="ml-auto px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg">Salvar área da quadra</button>
          </div>
          <div id="mapa-area-quadra" style="height:min(72vh,680px);min-height:430px"></div>
        </div>
      </div>`);

    const buscaOriginal = buscarLotesDaRua;
    window.buscarLotesDaRuaSemFiltro = buscaOriginal;
    window.buscarLotesDaRua = buscarLotesFiltradosPorArea;

    const selecionarOriginal = selecionarQuadraAssistente;
    window.selecionarQuadraAssistente = function() {
      selecionarOriginal();
      atualizarStatusAreaQuadra();
    };

    atualizarStatusAreaQuadra();
    if (window.lucide) lucide.createIcons();
  };
  aguardar();
}

function atualizarStatusAreaQuadra() {
  const el = document.getElementById('assist-area-status');
  if (!el) return;
  const id = Number(document.getElementById('assist-quadra')?.value || assistenteQuadraId);
  const pts = limitesQuadras[id];
  el.innerHTML = Array.isArray(pts) && pts.length >= 3
    ? `<strong>Área salva:</strong> esta quadra possui um limite geográfico com ${pts.length} pontos. A busca será restrita a <strong>Piratininga + rua + esta área</strong>.`
    : `<strong>Área ainda não definida.</strong> Clique em “Definir área” e marque o contorno desta quadra no mapa. Depois a busca ficará restrita somente a esse trecho.`;
}

function abrirDefinicaoAreaQuadra() {
  assistenteQuadraId = Number(document.getElementById('assist-quadra')?.value || assistenteQuadraId);
  document.getElementById('modal-area-quadra')?.classList.remove('hidden');
  pontosLimiteQuadra = Array.isArray(limitesQuadras[assistenteQuadraId]) ? limitesQuadras[assistenteQuadraId].map(p => [Number(p[0]), Number(p[1])]) : [];
  if (!mapaLimiteQuadra) {
    mapaLimiteQuadra = L.map('mapa-area-quadra').setView([-22.9528, -43.0612], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:20, attribution:'&copy; OpenStreetMap contributors'}).addTo(mapaLimiteQuadra);
    camadaLimiteQuadra = L.layerGroup().addTo(mapaLimiteQuadra);
    mapaLimiteQuadra.on('click', e => {
      pontosLimiteQuadra.push([Number(e.latlng.lat.toFixed(7)), Number(e.latlng.lng.toFixed(7))]);
      renderizarDesenhoArea();
    });
  }
  setTimeout(() => {
    mapaLimiteQuadra.invalidateSize();
    renderizarDesenhoArea();
    if (pontosLimiteQuadra.length >= 3) mapaLimiteQuadra.fitBounds(L.latLngBounds(pontosLimiteQuadra), {padding:[30,30]});
  }, 80);
}

function fecharDefinicaoAreaQuadra() {
  document.getElementById('modal-area-quadra')?.classList.add('hidden');
}

function renderizarDesenhoArea() {
  if (!camadaLimiteQuadra) return;
  camadaLimiteQuadra.clearLayers();
  pontosLimiteQuadra.forEach((p,i) => L.circleMarker(p,{radius:6,color:'#818cf8',fillColor:'#6366f1',fillOpacity:1}).addTo(camadaLimiteQuadra).bindTooltip(String(i+1),{permanent:true,direction:'top'}));
  if (pontosLimiteQuadra.length >= 2) L.polyline(pontosLimiteQuadra,{color:'#818cf8',weight:2,dashArray:'5,5'}).addTo(camadaLimiteQuadra);
  if (pontosLimiteQuadra.length >= 3) L.polygon(pontosLimiteQuadra,{color:'#6366f1',weight:2,fillColor:'#4f46e5',fillOpacity:.15}).addTo(camadaLimiteQuadra);
}

function desfazerPontoArea() {
  pontosLimiteQuadra.pop();
  renderizarDesenhoArea();
}

function limparAreaQuadra() {
  pontosLimiteQuadra = [];
  renderizarDesenhoArea();
}

function usarMinhaLocalizacaoArea() {
  if (!navigator.geolocation) return alert('Este navegador não oferece geolocalização.');
  navigator.geolocation.getCurrentPosition(pos => mapaLimiteQuadra?.setView([pos.coords.latitude,pos.coords.longitude],18), () => alert('Não foi possível obter sua localização.'), {enableHighAccuracy:true,timeout:12000});
}

function salvarAreaQuadra() {
  if (pontosLimiteQuadra.length < 3) return alert('Marque pelo menos 3 pontos ao redor da quadra.');
  limitesQuadras[assistenteQuadraId] = pontosLimiteQuadra;
  salvarLimitesQuadras();
  atualizarStatusAreaQuadra();
  fecharDefinicaoAreaQuadra();
  const status = document.getElementById('assist-status');
  if (status) status.innerText = 'Área da quadra salva. Agora clique em “Buscar lotes oficiais”.';
}

function pontoDentroPoligono(lat, lng, poligono) {
  let dentro = false;
  for (let i=0,j=poligono.length-1;i<poligono.length;j=i++) {
    const yi=poligono[i][0], xi=poligono[i][1], yj=poligono[j][0], xj=poligono[j][1];
    const cruza = ((yi>lat)!==(yj>lat)) && (lng < (xj-xi)*(lat-yi)/((yj-yi)||1e-12)+xi);
    if (cruza) dentro=!dentro;
  }
  return dentro;
}

async function buscarLotesFiltradosPorArea() {
  const rua = document.getElementById('assist-rua')?.value.trim();
  const bairro = document.getElementById('assist-bairro')?.value.trim() || 'Piratininga';
  const status = document.getElementById('assist-status');
  const id = Number(document.getElementById('assist-quadra')?.value || assistenteQuadraId);
  const poligono = limitesQuadras[id];
  if (!rua) { if(status) status.innerText='Digite o nome da rua para buscar.'; return; }
  if (!Array.isArray(poligono) || poligono.length < 3) {
    if (status) status.innerText = 'Defina primeiro a área desta quadra no mapa. Assim evitamos trazer centenas de lotes.';
    abrirDefinicaoAreaQuadra();
    return;
  }
  assistenteLotes = [];
  atualizarBotoesAssistente(false);
  if (status) status.innerText = 'Consultando somente rua + Piratininga + área desta quadra...';
  try {
    const termoRua = normalizarTextoBusca(rua).replace(/'/g,"''");
    const termoBairro = normalizarTextoBusca(bairro).replace(/'/g,"''");
    const lats = poligono.map(p=>Number(p[0])), lngs = poligono.map(p=>Number(p[1]));
    const envelope = `${Math.min(...lngs)},${Math.min(...lats)},${Math.max(...lngs)},${Math.max(...lats)}`;
    const where = `UPPER(tx_logrado) LIKE '%${termoRua}%' AND UPPER(tx_bairro) LIKE '%${termoBairro}%'`;
    const params = new URLSearchParams({
      f:'json', where, geometry:envelope, geometryType:'esriGeometryEnvelope', inSR:'4326', spatialRel:'esriSpatialRelIntersects',
      outFields:'tx_insct,tx_logrado,tx_nroport,tx_bairro', returnGeometry:'true', outSR:'4326', resultRecordCount:'2000'
    });
    const resp = await fetch(`${LOTES_ASSISTENTE_ENDPOINT}?${params.toString()}`);
    if (!resp.ok) throw new Error('Falha HTTP');
    const json = await resp.json();
    const features = json.features || [];
    assistenteLotes = features.map((f,i) => {
      const a=f.attributes||{}; const c=centroideGeometria(f.geometry);
      return {id:i,inscricao:a.tx_insct||'',rua:a.tx_logrado||rua,numero:a.tx_nroport||'',bairro:a.tx_bairro||bairro,latitude:c.lat,longitude:c.lng};
    }).filter(l => Number(l.latitude) && Number(l.longitude) && pontoDentroPoligono(Number(l.latitude),Number(l.longitude),poligono))
      .sort((a,b)=>{
        const na=parseInt(String(a.numero).replace(/\D/g,''),10), nb=parseInt(String(b.numero).replace(/\D/g,''),10);
        if(Number.isFinite(na)&&Number.isFinite(nb)) return na-nb;
        return String(a.numero).localeCompare(String(b.numero),'pt-BR',{numeric:true});
      });
    const nomes=[...new Set(assistenteLotes.map(l=>l.rua).filter(Boolean))];
    if (status) status.innerText = assistenteLotes.length
      ? `${assistenteLotes.length} lotes encontrados dentro da área da quadra${nomes.length?` • ${nomes.slice(0,2).join(' / ')}`:''}. Agora revise a sequência.`
      : 'Nenhum lote dessa rua foi encontrado dentro da área marcada. Ajuste o contorno ou confira o nome da rua.';
    atualizarBotoesAssistente(assistenteLotes.length>0);
    renderizarListaAssistente();
  } catch(e) {
    console.error(e);
    if (status) status.innerText='Não foi possível consultar a base oficial agora. Tente novamente.';
  }
}

instalarFiltroGeografico();