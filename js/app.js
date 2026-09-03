const STORAGE_KEY = 'luis_territorial_quadras_v5';
const LEGACY_STORAGE_KEYS = ['luis_territorial_quadras_v4', 'luis_territorial_quadras_v3'];
const HIDDEN_KEY = 'luis_territorial_importados_ocultos_v1';
const LOTES_ENDPOINT = 'https://sig.niteroi.rj.gov.br/server/rest/services/Hosted/NGP_SMF_SEREC_A_LOTES_PUBLICO/FeatureServer/30/query';

const quadrasPadrao = [
  { id: 1, tag: 'QUADRA 01', nome: 'Entrada / Ponto Acúrcio Tôrres (Quiosques 1 a 4)', status: 'Captação Realizada', casas: [] },
  { id: 2, tag: 'QUADRA 02', nome: 'Orla — Entre R. 113 e R. 116', status: 'Captação Realizada', casas: [] },
  { id: 3, tag: 'QUADRA 03', nome: 'Orla — Miolo Nobre (Entre R. 116 e R. 120)', status: 'Pendente', casas: [] },
  { id: 4, tag: 'QUADRA 04', nome: 'Orla — Trecho Final (Entre R. 120 e R. 125)', status: 'Pendente', casas: [] },
  { id: 5, tag: 'QUADRA 05', nome: 'Prainha & Encosta do Tibau', status: 'Pendente', casas: [] },
  { id: 6, tag: 'QUADRA 06', nome: '2ª Quadra — Av. Cons. Paulo de Melo Kalle (Início)', status: 'Pendente', casas: [] },
  { id: 7, tag: 'QUADRA 07', nome: '2ª Quadra — Av. Cons. Paulo de Melo Kalle (Final)', status: 'Pendente', casas: [] },
  { id: 8, tag: 'QUADRA 08', nome: 'Eixo das Transversais (R. 115 a R. 118)', status: 'Pendente', casas: [] }
];

let quadraAbertaId = null;
let indexCasaEditando = null;
let quadraEditandoId = null;
let indiceArrastando = null;
let ocultos = new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'));

function clone(valor) { return JSON.parse(JSON.stringify(valor)); }
function textoSeguro(valor = '') {
  return String(valor).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function enderecoCasa(casa) {
  if (casa.rua) return `${casa.rua}${casa.numero ? `, nº ${casa.numero}` : ''}`;
  return casa.endereco || 'Endereço a preencher';
}
function normalizarCasa(casa, idQuadra, index) {
  return {
    ...casa,
    id: casa.id || `local-q${idQuadra}-${index + 1}`,
    origem: casa.origem || 'local',
    rua: casa.rua || casa.endereco || '',
    numero: casa.numero || '',
    lote: casa.lote || casa.inscricao || '',
    bairro: casa.bairro || '',
    latitude: casa.latitude || '',
    longitude: casa.longitude || ''
  };
}
function normalizarQuadra(q, index = 0) {
  const id = Number(q.id) || Date.now() + index;
  const casas = Array.isArray(q.casas) ? q.casas : [];
  return {
    id,
    tag: q.tag || `QUADRA ${String(index + 1).padStart(2, '0')}`,
    nome: q.nome || 'Quadra sem nome',
    status: q.status === 'Captação Realizada' ? 'Captação Realizada' : 'Pendente',
    casas: casas.map((casa, casaIndex) => normalizarCasa(casa, id, casaIndex))
  };
}
function carregarLocal() {
  try {
    const atual = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(atual)) return atual.map(normalizarQuadra);
    for (const chave of LEGACY_STORAGE_KEYS) {
      const legado = JSON.parse(localStorage.getItem(chave));
      if (Array.isArray(legado)) return legado.map(normalizarQuadra);
    }
  } catch (erro) { console.warn('Não foi possível ler os dados locais.', erro); }
  return clone(quadrasPadrao).map(normalizarQuadra);
}
function obterImportados() {
  const bruto = window.IMOVEIS_IMPORTADOS || [];
  if (Array.isArray(bruto)) return bruto;
  if (bruto && typeof bruto === 'object') return [bruto];
  return [];
}
function garantirQuadrasDosImportados(base) {
  const ids = [...new Set(obterImportados().map(item => Number(item?.quadra)).filter(Number.isFinite))];
  ids.forEach(id => {
    if (!base.some(q => Number(q.id) === id)) base.push(normalizarQuadra({ id, tag:`QUADRA ${String(id).padStart(2,'0')}`, nome:'Quadra importada', status:'Pendente', casas:[] }, base.length));
  });
  return base;
}
function mesclarImportados(base) {
  garantirQuadrasDosImportados(base);
  obterImportados().forEach(item => {
    if (!item || ocultos.has(item.id)) return;
    const q = base.find(x => Number(x.id) === Number(item.quadra));
    if (!q) return;
    if (!q.casas.some(c => c.id === item.id)) {
      q.casas.push(normalizarCasa({
        id:item.id, foto:item.foto, endereco:item.endereco || 'Endereço a preencher', situacao:item.situacao || 'Fechada', telefone:item.telefone || '', origem:'github'
      }, q.id, q.casas.length));
    }
  });
  return base;
}

let quadras = mesclarImportados(carregarLocal());

function recalcular() {
  quadras.forEach(q => {
    q.casas = Array.isArray(q.casas) ? q.casas : [];
    q.imoveis = q.casas.length;
    q.contatos = q.casas.filter(c => c.telefone && c.telefone.trim()).length;
  });
}
function persistir() {
  recalcular();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quadras));
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ocultos]));
  } catch (erro) { alert('O armazenamento local ficou cheio. Para muitas fotos, continue usando a importação em lote pelo VS Code.'); }
}
function salvar() { persistir(); renderizar(); atualizarTotais(); }
function proximoIdQuadra() { return quadras.reduce((m,q) => Math.max(m, Number(q.id)||0), 0) + 1; }
function toggleStatus(id) {
  const q = quadras.find(item => item.id === id); if (!q) return;
  q.status = q.status === 'Captação Realizada' ? 'Pendente' : 'Captação Realizada'; salvar();
}
function atualizarTotais() {
  recalcular();
  const concluidas = quadras.filter(q => q.status === 'Captação Realizada').length;
  document.getElementById('stat-concluidas').innerText = `${concluidas} de ${quadras.length}`;
  document.getElementById('stat-imoveis').innerText = quadras.reduce((a,q)=>a+q.imoveis,0);
  document.getElementById('stat-contatos').innerText = quadras.reduce((a,q)=>a+q.contatos,0);
  const importados = quadras.reduce((a,q)=>a+q.casas.filter(c=>c.origem==='github').length,0);
  document.getElementById('stat-importados').innerText = `${importados} via GitHub`;
  const setor = document.getElementById('setor-contagem'); if (setor) setor.innerText = `Praia de Piratininga — ${quadras.length} quadras operacionais`;
}
function renderizar() {
  recalcular();
  const grid = document.getElementById('grid-quadras'); grid.innerHTML = '';
  quadras.forEach(q => {
    const concluida = q.status === 'Captação Realizada';
    const card = document.createElement('div');
    card.className = 'bg-[#081427] border border-[#122543] rounded-2xl p-5 flex flex-col justify-between hover:border-[#1c3966] transition duration-200';
    card.innerHTML = `<div><div class="flex items-start justify-between gap-3"><span class="text-[11px] font-bold tracking-wider text-[#0094ff] uppercase block">${textoSeguro(q.tag)}</span><button onclick="editarQuadra(${q.id})" title="Editar quadra" class="p-1.5 rounded-lg bg-[#0b1b36] hover:bg-[#14305c] text-slate-300 hover:text-white transition"><i data-lucide="settings-2" class="w-3.5 h-3.5"></i></button></div><h3 class="text-[15px] font-bold text-white mt-1 leading-snug min-h-[42px]">${textoSeguro(q.nome)}</h3><div class="mt-2.5 mb-4"><button onclick="toggleStatus(${q.id})" class="text-[11px] font-semibold px-3 py-1 rounded-full ${concluida?'bg-[#042c26] text-[#10b981] border border-[#064e43]':'bg-[#0b172d] text-[#8e9eb5] border border-[#162a4d]'}">${q.status}</button></div></div><div class="space-y-2.5"><button onclick="abrirGaleria(${q.id})" class="w-full py-2.5 bg-[#0094ff]/15 hover:bg-[#0094ff]/25 border border-[#0094ff]/40 text-[#0094ff] hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"><i data-lucide="images" class="w-4 h-4"></i> Ver Fotos & Casas Mapeadas (${q.casas.length})</button><div class="bg-[#050f1f] border border-[#11233f] rounded-xl px-4 py-2.5 flex items-center justify-between"><span class="text-xs text-slate-300 font-medium">Imóveis Mapeados</span><span class="text-sm font-bold text-white">${q.imoveis}</span></div><div class="bg-[#050f1f] border border-[#11233f] rounded-xl px-4 py-2.5 flex items-center justify-between"><span class="text-xs text-slate-300 font-medium">Contatos Feitos</span><span class="text-sm font-bold text-white">${q.contatos}</span></div></div>`;
    grid.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

function abrirGerenciadorQuadras() { quadraEditandoId=null; limparFormularioQuadra(); renderizarGerenciadorQuadras(); document.getElementById('modal-quadras').classList.remove('hidden'); if(window.lucide)lucide.createIcons(); }
function fecharGerenciadorQuadras() { document.getElementById('modal-quadras').classList.add('hidden'); quadraEditandoId=null; limparFormularioQuadra(); }
function renderizarGerenciadorQuadras() {
  const lista=document.getElementById('lista-gerenciar-quadras'); if(!lista)return; lista.innerHTML='';
  quadras.forEach(q=>lista.insertAdjacentHTML('beforeend',`<div class="bg-[#050f1f] border border-[#14294b] rounded-xl p-3 flex items-center justify-between gap-3"><div class="min-w-0"><div class="text-[10px] font-bold text-sky-400 uppercase tracking-wider">${textoSeguro(q.tag)}</div><div class="text-xs font-semibold text-white truncate">${textoSeguro(q.nome)}</div><div class="text-[10px] text-slate-500 mt-0.5">${q.casas.length} imóveis • ${q.status}</div></div><button onclick="editarQuadra(${q.id})" class="shrink-0 px-3 py-1.5 rounded-lg bg-[#0b1b36] hover:bg-[#14305c] text-sky-300 text-[11px] font-semibold">Editar</button></div>`));
}
function limparFormularioQuadra() {
  quadraEditandoId=null; const id=proximoIdQuadra();
  document.getElementById('quadra-tag').value=`QUADRA ${String(id).padStart(2,'0')}`; document.getElementById('quadra-nome').value=''; document.getElementById('quadra-status').value='Pendente'; document.getElementById('quadra-form-titulo').innerText='Adicionar nova quadra'; document.getElementById('btn-excluir-quadra')?.classList.add('hidden'); document.getElementById('quadra-submit-texto').innerText='Adicionar Quadra';
}
function editarQuadra(id) {
  const q=quadras.find(x=>x.id===id); if(!q)return; if(document.getElementById('modal-quadras').classList.contains('hidden'))abrirGerenciadorQuadras(); quadraEditandoId=id; document.getElementById('quadra-tag').value=q.tag; document.getElementById('quadra-nome').value=q.nome; document.getElementById('quadra-status').value=q.status; document.getElementById('quadra-form-titulo').innerText=`Editando ${q.tag}`; document.getElementById('quadra-submit-texto').innerText='Salvar Alterações'; document.getElementById('btn-excluir-quadra').classList.remove('hidden');
}
function salvarQuadra(event) {
  event.preventDefault(); const tag=document.getElementById('quadra-tag').value.trim(); const nome=document.getElementById('quadra-nome').value.trim(); const status=document.getElementById('quadra-status').value; if(!tag||!nome)return;
  if(quadraEditandoId!==null){const q=quadras.find(x=>x.id===quadraEditandoId);if(q){q.tag=tag;q.nome=nome;q.status=status;}} else quadras.push(normalizarQuadra({id:proximoIdQuadra(),tag,nome,status,casas:[]},quadras.length));
  salvar(); renderizarGerenciadorQuadras(); limparFormularioQuadra();
}
function excluirQuadraAtual() {
  if(quadraEditandoId===null)return; const q=quadras.find(x=>x.id===quadraEditandoId);if(!q)return; const aviso=q.casas.length?`Esta quadra possui ${q.casas.length} imóveis. Excluir a quadra também vai removê-los desta visualização neste navegador. Continuar?`:'Tem certeza que deseja excluir esta quadra?'; if(!confirm(aviso))return; q.casas.filter(c=>c.origem==='github'&&c.id).forEach(c=>ocultos.add(c.id)); quadras=quadras.filter(x=>x.id!==quadraEditandoId); salvar(); renderizarGerenciadorQuadras(); limparFormularioQuadra();
}

function abrirGaleria(id) {
  quadraAbertaId=id; cancelarEdicao(); const q=quadras.find(x=>x.id===id); if(!q)return; document.getElementById('modal-g-tag').innerText=q.tag; document.getElementById('modal-g-nome').innerText=q.nome; renderizarListaGaleria(q); document.getElementById('modal-galeria').classList.remove('hidden'); if(window.lucide)lucide.createIcons();
}
function fecharGaleria(){document.getElementById('modal-galeria').classList.add('hidden');quadraAbertaId=null;cancelarEdicao();}
function moverCasa(origem,destino) {
  const q=quadras.find(x=>x.id===quadraAbertaId); if(!q||origem===destino||origem<0||destino<0||origem>=q.casas.length||destino>=q.casas.length)return;
  const [movida]=q.casas.splice(origem,1); q.casas.splice(destino,0,movida); persistir(); renderizarListaGaleria(q);
}
function moverCasaSeta(index,direcao){const destino=index+direcao; moverCasa(index,destino);}
function configurarDragDrop(container,q) {
  container.querySelectorAll('[data-casa-index]').forEach(card=>{
    card.addEventListener('dragstart',e=>{indiceArrastando=Number(card.dataset.casaIndex);card.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    card.addEventListener('dragend',()=>{indiceArrastando=null;card.classList.remove('dragging');container.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));});
    card.addEventListener('dragover',e=>{e.preventDefault();card.classList.add('drag-over');});
    card.addEventListener('dragleave',()=>card.classList.remove('drag-over'));
    card.addEventListener('drop',e=>{e.preventDefault();card.classList.remove('drag-over');const destino=Number(card.dataset.casaIndex);if(indiceArrastando!==null)moverCasa(indiceArrastando,destino);});
  });
}
function renderizarListaGaleria(q) {
  const container=document.getElementById('galeria-lista'); container.innerHTML=''; document.getElementById('badge-total-casas').innerText=q.casas.length;
  if(!q.casas.length){container.innerHTML='<div class="col-span-full py-8 text-center text-slate-500 text-xs italic">Nenhum imóvel cadastrado nesta quadra.</div>';return;}
  q.casas.forEach((casa,index)=>{
    let badge='bg-slate-800 text-slate-300 border-slate-700'; if(casa.situacao==='Particular')badge='bg-emerald-950/80 text-emerald-300 border-emerald-800'; if(casa.situacao==='Terreno')badge='bg-amber-950/80 text-amber-300 border-amber-800'; if(casa.situacao==='Concorrente')badge='bg-blue-950/80 text-sky-300 border-blue-800';
    const origem=casa.origem==='github'?'<span class="absolute bottom-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded bg-black/70 text-sky-300 border border-sky-700/60">GITHUB</span>':''; const foto=casa.foto||''; const endereco=textoSeguro(enderecoCasa(casa)); const lote=casa.lote?`<p class="text-[10px] text-slate-400">Lote/inscrição: <span class="text-slate-200">${textoSeguro(casa.lote)}</span></p>`:''; const gps=casa.latitude&&casa.longitude?'<span title="Localização registrada" class="text-emerald-400"><i data-lucide="map-pin" class="w-3 h-3"></i></span>':'';
    container.insertAdjacentHTML('beforeend',`<div draggable="true" data-casa-index="${index}" class="bg-[#050f1f] border border-[#14294b] rounded-xl overflow-hidden flex flex-col justify-between hover:border-[#1d3d70] transition cursor-grab active:cursor-grabbing"><div class="relative h-44 bg-black">${foto?`<img src="${textoSeguro(foto)}" alt="Foto do imóvel" loading="lazy" class="w-full h-full object-cover">`:'<div class="w-full h-full flex items-center justify-center text-slate-600 text-xs">Sem foto</div>'}<span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge}">${textoSeguro(casa.situacao||'Fechada')}</span>${origem}<div class="absolute top-2 right-2 flex items-center gap-1"><button onclick="event.stopPropagation();moverCasaSeta(${index},-1)" ${index===0?'disabled':''} title="Mover para trás" class="p-1.5 rounded-md bg-black/70 hover:bg-slate-700 text-white disabled:opacity-30"><i data-lucide="arrow-left" class="w-3.5 h-3.5"></i></button><button onclick="event.stopPropagation();moverCasaSeta(${index},1)" ${index===q.casas.length-1?'disabled':''} title="Mover para frente" class="p-1.5 rounded-md bg-black/70 hover:bg-slate-700 text-white disabled:opacity-30"><i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></button><button onclick="event.stopPropagation();editarCasa(${index})" title="Editar" class="p-1.5 rounded-md bg-black/70 hover:bg-[#0094ff] text-white"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button><button onclick="event.stopPropagation();excluirCasa(${index})" title="Excluir" class="p-1.5 rounded-md bg-black/70 hover:bg-rose-600 text-rose-300"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button></div></div><div class="p-3.5 space-y-2"><div class="flex items-center justify-between gap-2"><span class="text-[10px] text-slate-500 font-bold">#${String(index+1).padStart(2,'0')}</span>${gps}</div><p class="font-bold text-white text-xs leading-snug">${endereco}</p>${lote}<p class="text-[11px] text-slate-300 flex items-start gap-1.5"><i data-lucide="phone" class="w-3 h-3 text-[#0094ff] shrink-0 mt-0.5"></i><span>${textoSeguro(casa.telefone||'Sem contato anotado')}</span></p><button onclick="editarCasa(${index})" class="w-full py-1.5 bg-[#0b1b36] hover:bg-[#112a54] text-sky-400 text-[11px] font-semibold rounded-lg">Editar informações</button></div></div>`);
  });
  configurarDragDrop(container,q); if(window.lucide)lucide.createIcons();
}

function editarCasa(index) {
  const q=quadras.find(x=>x.id===quadraAbertaId);if(!q||!q.casas[index])return;const c=q.casas[index];indexCasaEditando=index;
  document.getElementById('cad-rua').value=c.rua||c.endereco||''; document.getElementById('cad-numero').value=c.numero||''; document.getElementById('cad-lote').value=c.lote||''; document.getElementById('cad-bairro').value=c.bairro||'Piratininga'; document.getElementById('cad-latitude').value=c.latitude||''; document.getElementById('cad-longitude').value=c.longitude||''; document.getElementById('cad-situacao').value=c.situacao||'Fechada'; document.getElementById('cad-telefone').value=c.telefone||''; document.getElementById('cad-foto-url').value=c.foto&&c.foto.startsWith('http')?c.foto:''; document.getElementById('cad-foto-arquivo').value=''; document.getElementById('form-titulo').innerHTML='<i data-lucide="edit-3" class="w-4 h-4 text-amber-400"></i> Editando imóvel'; document.getElementById('badge-modo-edicao').classList.remove('hidden'); document.getElementById('btn-submit-texto').innerText='Salvar Alterações'; document.getElementById('btn-cancelar-edicao').classList.remove('hidden'); document.getElementById('galeria-scroll-area').scrollTo({top:0,behavior:'smooth'}); if(window.lucide)lucide.createIcons();
}
function cancelarEdicao() {
  indexCasaEditando=null; ['cad-rua','cad-numero','cad-lote','cad-latitude','cad-longitude','cad-telefone','cad-foto-url'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';}); const bairro=document.getElementById('cad-bairro');if(bairro)bairro.value='Piratininga'; const arq=document.getElementById('cad-foto-arquivo');if(arq)arq.value=''; const sit=document.getElementById('cad-situacao');if(sit)sit.value='Fechada'; const st=document.getElementById('status-localizacao');if(st)st.innerText='No celular, permita o acesso ao GPS. O sistema consulta a camada pública de lotes da Prefeitura de Niterói.'; document.getElementById('form-titulo').innerHTML='<i data-lucide="map-pin" class="w-4 h-4 text-[#0094ff]"></i> Registrar imóvel'; document.getElementById('badge-modo-edicao')?.classList.add('hidden'); document.getElementById('btn-cancelar-edicao')?.classList.add('hidden'); document.getElementById('btn-submit-texto').innerText='Salvar Imóvel';
}
function montarEndereco(rua,numero){return `${rua}${numero?`, nº ${numero}`:''}`;}
function salvarCasa(event) {
  event.preventDefault(); const q=quadras.find(x=>x.id===quadraAbertaId);if(!q)return; const arquivo=document.getElementById('cad-foto-arquivo'); const url=document.getElementById('cad-foto-url').value.trim(); const rua=document.getElementById('cad-rua').value.trim(); const numero=document.getElementById('cad-numero').value.trim(); const lote=document.getElementById('cad-lote').value.trim(); const bairro=document.getElementById('cad-bairro').value.trim(); const latitude=document.getElementById('cad-latitude').value.trim(); const longitude=document.getElementById('cad-longitude').value.trim(); const situacao=document.getElementById('cad-situacao').value; const telefone=document.getElementById('cad-telefone').value.trim();
  function concluir(foto){const dados={rua,numero,lote,bairro,latitude,longitude,endereco:montarEndereco(rua,numero),situacao,telefone}; if(indexCasaEditando!==null){const atual=q.casas[indexCasaEditando];Object.assign(atual,dados);if(foto)atual.foto=foto;}else q.casas.push({id:`local-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,foto:foto||'',origem:'local',...dados}); cancelarEdicao();salvar();renderizarListaGaleria(q);}
  if(arquivo.files&&arquivo.files[0]){const reader=new FileReader();reader.onload=e=>concluir(e.target.result);reader.readAsDataURL(arquivo.files[0]);}else if(url)concluir(url);else concluir(indexCasaEditando!==null?q.casas[indexCasaEditando].foto:'');
}
function excluirCasa(index){const q=quadras.find(x=>x.id===quadraAbertaId);if(!q||!q.casas[index])return;if(!confirm('Tem certeza que deseja excluir este registro?'))return;const c=q.casas[index];if(c.origem==='github'&&c.id)ocultos.add(c.id);q.casas.splice(index,1);cancelarEdicao();salvar();renderizarListaGaleria(q);}

async function consultarLotePrefeitura(latitude,longitude) {
  const geometria=JSON.stringify({x:Number(longitude),y:Number(latitude),spatialReference:{wkid:4326}});
  async function consulta(distancia=null){const params=new URLSearchParams({f:'json',where:'1=1',geometry:geometria,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'tx_insct,tx_logrado,tx_nroport,tx_bairro',returnGeometry:'false'}); if(distancia){params.set('distance',String(distancia));params.set('units','esriSRUnit_Meter');} const r=await fetch(`${LOTES_ENDPOINT}?${params}`);if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
  let dados=await consulta(); if(!dados.features?.length)dados=await consulta(25); if(dados.error)throw new Error(dados.error.message||'Erro na consulta'); return dados.features?.[0]?.attributes||null;
}
function usarMinhaLocalizacao() {
  const status=document.getElementById('status-localizacao'); const botao=document.getElementById('btn-localizacao');
  if(!navigator.geolocation){status.innerText='Este navegador não oferece geolocalização.';return;}
  status.innerText='Obtendo GPS...';botao.disabled=true;botao.classList.add('opacity-60');
  navigator.geolocation.getCurrentPosition(async pos=>{
    const lat=pos.coords.latitude.toFixed(7), lon=pos.coords.longitude.toFixed(7); document.getElementById('cad-latitude').value=lat;document.getElementById('cad-longitude').value=lon;status.innerText='GPS encontrado. Consultando o lote na Prefeitura de Niterói...';
    try{const lote=await consultarLotePrefeitura(lat,lon);if(lote){if(lote.tx_logrado)document.getElementById('cad-rua').value=lote.tx_logrado;if(lote.tx_nroport)document.getElementById('cad-numero').value=lote.tx_nroport;if(lote.tx_insct)document.getElementById('cad-lote').value=lote.tx_insct;if(lote.tx_bairro)document.getElementById('cad-bairro').value=lote.tx_bairro;status.innerText='Lote localizado. Confira os dados e salve o imóvel.';}else status.innerText='GPS salvo, mas nenhum lote foi encontrado nesse ponto. Você pode completar o endereço manualmente.';}catch(erro){console.error(erro);status.innerText='GPS salvo. A consulta automática do lote falhou agora; os campos podem ser preenchidos manualmente.';}finally{botao.disabled=false;botao.classList.remove('opacity-60');}
  },erro=>{const mensagens={1:'Permissão de localização negada.',2:'Localização indisponível.',3:'Tempo esgotado ao buscar localização.'};status.innerText=mensagens[erro.code]||'Não foi possível obter a localização.';botao.disabled=false;botao.classList.remove('opacity-60');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
}

recalcular();renderizar();atualizarTotais();