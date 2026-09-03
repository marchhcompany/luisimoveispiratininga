const LOTES_MAPA_ENDPOINT = 'https://sig.niteroi.rj.gov.br/server/rest/services/Hosted/NGP_SMF_SEREC_A_LOTES_PUBLICO/FeatureServer/30/query';
let mapaTerritorial = null;
let camadaImoveis = null;
let camadaLotes = null;
let marcadorUsuario = null;

function escMapa(valor='') {
  return String(valor).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function obterImoveisGeolocalizados(filtroQuadra='todas') {
  const itens = [];
  quadras.forEach(q => {
    if (filtroQuadra !== 'todas' && String(q.id) !== String(filtroQuadra)) return;
    (q.casas || []).forEach((casa, index) => {
      const lat = Number(casa.latitude);
      const lng = Number(casa.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      itens.push({ q, casa, index, lat, lng });
    });
  });
  return itens;
}

function popularFiltroQuadrasMapa() {
  const select = document.getElementById('mapa-filtro-quadra');
  if (!select) return;
  const atual = select.value || 'todas';
  select.innerHTML = '<option value="todas">Todas as quadras</option>' + quadras.map(q => `<option value="${q.id}">${escMapa(q.tag)} — ${escMapa(q.nome)}</option>`).join('');
  if ([...select.options].some(o => o.value === atual)) select.value = atual;
}

function criarMapaSeNecessario() {
  if (mapaTerritorial) return;
  mapaTerritorial = L.map('mapa-territorial', { zoomControl: true }).setView([-22.9528, -43.0612], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(mapaTerritorial);
  camadaImoveis = L.layerGroup().addTo(mapaTerritorial);
  camadaLotes = L.geoJSON(null, {
    style: { color: '#22d3ee', weight: 1.5, fillColor: '#0891b2', fillOpacity: 0.08 },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      layer.bindPopup(`<div style="min-width:190px"><strong>${escMapa(p.tx_logrado || 'Lote cadastral')}</strong><br>Nº: ${escMapa(p.tx_nroport || '—')}<br>Bairro: ${escMapa(p.tx_bairro || '—')}<br>Inscrição: ${escMapa(p.tx_insct || '—')}</div>`);
    }
  }).addTo(mapaTerritorial);
}

function abrirMapaTerritorial() {
  document.getElementById('modal-mapa')?.classList.remove('hidden');
  popularFiltroQuadrasMapa();
  criarMapaSeNecessario();
  setTimeout(() => {
    mapaTerritorial.invalidateSize();
    renderizarImoveisNoMapa(true);
  }, 80);
}

function fecharMapaTerritorial() {
  document.getElementById('modal-mapa')?.classList.add('hidden');
}

function renderizarImoveisNoMapa(ajustar=false) {
  if (!mapaTerritorial || !camadaImoveis) return;
  camadaImoveis.clearLayers();
  const filtro = document.getElementById('mapa-filtro-quadra')?.value || 'todas';
  const itens = obterImoveisGeolocalizados(filtro);
  const bounds = [];
  itens.forEach(({q,casa,index,lat,lng}) => {
    const endereco = typeof enderecoCasa === 'function' ? enderecoCasa(casa) : (casa.rua || casa.endereco || 'Endereço a preencher');
    const foto = casa.foto ? `<img src="${escMapa(casa.foto)}" style="width:100%;height:90px;object-fit:cover;border-radius:8px;margin:6px 0">` : '';
    const marker = L.marker([lat,lng]).addTo(camadaImoveis);
    marker.bindPopup(`<div style="min-width:210px">${foto}<strong>${escMapa(endereco)}</strong><br><span>${escMapa(q.tag)} — ${escMapa(q.nome)}</span><br><span>Lote: ${escMapa(casa.lote || '—')}</span><br><button onclick="abrirImovelDoMapa(${q.id},${index})" style="margin-top:8px;padding:6px 9px;border:0;border-radius:7px;background:#0284c7;color:#fff;font-weight:700;cursor:pointer">Abrir imóvel</button></div>`);
    bounds.push([lat,lng]);
  });
  const contador = document.getElementById('mapa-contador');
  if (contador) contador.innerText = `${itens.length} imóvel${itens.length === 1 ? '' : 'is'} com GPS`;
  if (ajustar && bounds.length) mapaTerritorial.fitBounds(bounds, {padding:[35,35], maxZoom:18});
}

function abrirImovelDoMapa(quadraId, index) {
  fecharMapaTerritorial();
  abrirGaleria(quadraId);
  setTimeout(() => editarCasa(index), 100);
}

function localizarNoMapa() {
  const status = document.getElementById('mapa-status');
  if (!navigator.geolocation) {
    if (status) status.innerText = 'Este navegador não oferece geolocalização.';
    return;
  }
  if (status) status.innerText = 'Obtendo sua localização...';
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude, longitude, accuracy} = pos.coords;
    if (marcadorUsuario) marcadorUsuario.remove();
    marcadorUsuario = L.circleMarker([latitude, longitude], {radius:8, color:'#10b981', fillColor:'#10b981', fillOpacity:0.8}).addTo(mapaTerritorial).bindPopup(`Sua localização<br>Precisão aproximada: ${Math.round(accuracy)} m`).openPopup();
    mapaTerritorial.setView([latitude, longitude], 18);
    if (status) status.innerText = `Localização encontrada • precisão aproximada ${Math.round(accuracy)} m`;
  }, err => {
    if (status) status.innerText = err.code === 1 ? 'Permissão de localização negada.' : 'Não foi possível obter sua localização.';
  }, {enableHighAccuracy:true, timeout:12000, maximumAge:5000});
}

async function carregarLotesVisiveis() {
  if (!mapaTerritorial || !camadaLotes) return;
  const status = document.getElementById('mapa-status');
  if (mapaTerritorial.getZoom() < 16) {
    if (status) status.innerText = 'Aproxime o mapa para zoom 16 ou maior antes de carregar os lotes.';
    return;
  }
  const b = mapaTerritorial.getBounds();
  const geometry = `${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`;
  const params = new URLSearchParams({
    f:'geojson',
    where:'1=1',
    geometry,
    geometryType:'esriGeometryEnvelope',
    inSR:'4326',
    spatialRel:'esriSpatialRelIntersects',
    outFields:'tx_insct,tx_logrado,tx_nroport,tx_bairro',
    returnGeometry:'true',
    outSR:'4326',
    resultRecordCount:'2000'
  });
  try {
    if (status) status.innerText = 'Carregando lotes oficiais da Prefeitura...';
    const resp = await fetch(`${LOTES_MAPA_ENDPOINT}?${params.toString()}`);
    if (!resp.ok) throw new Error('Falha HTTP');
    const geojson = await resp.json();
    camadaLotes.clearLayers();
    camadaLotes.addData(geojson);
    const total = Array.isArray(geojson.features) ? geojson.features.length : 0;
    if (status) status.innerText = `${total} lote${total === 1 ? '' : 's'} oficial${total === 1 ? '' : 'is'} carregado${total === 1 ? '' : 's'} nesta área.`;
  } catch (erro) {
    console.error(erro);
    if (status) status.innerText = 'Não foi possível carregar os lotes oficiais agora.';
  }
}

function limparLotesMapa() {
  camadaLotes?.clearLayers();
  const status = document.getElementById('mapa-status');
  if (status) status.innerText = 'Camada de lotes limpa.';
}

(function carregarAssistenteEmLote(){
  if (document.querySelector('script[data-assistente-lotes]')) return;
  const script = document.createElement('script');
  script.src = 'js/lote-assistente.js';
  script.dataset.assistenteLotes = '1';
  script.onload = () => {
    if (document.querySelector('script[data-filtro-geografico]')) return;
    const filtro = document.createElement('script');
    filtro.src = 'js/filtro-geografico.js';
    filtro.dataset.filtroGeografico = '1';
    document.body.appendChild(filtro);
  };
  document.body.appendChild(script);
})();