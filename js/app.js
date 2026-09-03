const STORAGE_KEY = 'luis_territorial_quadras_v4';
const LEGACY_STORAGE_KEY = 'luis_territorial_quadras_v3';
const HIDDEN_KEY = 'luis_territorial_importados_ocultos_v1';

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
let ocultos = new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'));

function clone(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function normalizarQuadra(q, index = 0) {
  const id = Number(q.id) || Date.now() + index;
  const casas = Array.isArray(q.casas) ? q.casas : [];
  return {
    id,
    tag: q.tag || `QUADRA ${String(index + 1).padStart(2, '0')}`,
    nome: q.nome || 'Quadra sem nome',
    status: q.status === 'Captação Realizada' ? 'Captação Realizada' : 'Pendente',
    casas: casas.map((casa, casaIndex) => ({
      ...casa,
      id: casa.id || `local-q${id}-${casaIndex + 1}`,
      origem: casa.origem || 'local'
    }))
  };
}

function carregarLocal() {
  try {
    const atual = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(atual)) return atual.map(normalizarQuadra);

    const legado = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (Array.isArray(legado)) return legado.map(normalizarQuadra);
  } catch (erro) {
    console.warn('Não foi possível ler os dados locais.', erro);
  }
  return clone(quadrasPadrao).map(normalizarQuadra);
}

function obterImportados() {
  const bruto = window.IMOVEIS_IMPORTADOS || [];
  if (Array.isArray(bruto)) return bruto;
  if (bruto && typeof bruto === 'object') return [bruto];
  return [];
}

function garantirQuadrasDosImportados(quadrasBase) {
  const ids = [...new Set(obterImportados().map(item => Number(item?.quadra)).filter(Number.isFinite))];
  ids.forEach(id => {
    if (!quadrasBase.some(q => Number(q.id) === id)) {
      quadrasBase.push(normalizarQuadra({ id, tag: `QUADRA ${String(id).padStart(2, '0')}`, nome: 'Quadra importada', status: 'Pendente', casas: [] }, quadrasBase.length));
    }
  });
  return quadrasBase;
}

function mesclarImportados(quadrasBase) {
  garantirQuadrasDosImportados(quadrasBase);
  obterImportados().forEach(item => {
    if (!item || ocultos.has(item.id)) return;
    const quadra = quadrasBase.find(q => Number(q.id) === Number(item.quadra));
    if (!quadra) return;
    const jaExiste = quadra.casas.some(casa => casa.id && casa.id === item.id);
    if (!jaExiste) {
      quadra.casas.push({
        id: item.id,
        foto: item.foto,
        endereco: item.endereco || 'Endereço a preencher',
        situacao: item.situacao || 'Fechada',
        telefone: item.telefone || '',
        origem: 'github'
      });
    }
  });
  return quadrasBase;
}

let quadras = mesclarImportados(carregarLocal());

function recalcular() {
  quadras.forEach(q => {
    q.casas = Array.isArray(q.casas) ? q.casas : [];
    q.imoveis = q.casas.length;
    q.contatos = q.casas.filter(c => c.telefone && c.telefone.trim() !== '').length;
  });
}

function persistir() {
  recalcular();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quadras));
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ocultos]));
  } catch (erro) {
    alert('O armazenamento local ficou cheio. Para muitas fotos, continue usando a importação em lote pelo VS Code.');
  }
}

function salvar() {
  persistir();
  renderizar();
  atualizarTotais();
}

function proximoIdQuadra() {
  return quadras.reduce((maior, q) => Math.max(maior, Number(q.id) || 0), 0) + 1;
}

function toggleStatus(id) {
  const q = quadras.find(item => item.id === id);
  if (!q) return;
  q.status = q.status === 'Captação Realizada' ? 'Pendente' : 'Captação Realizada';
  salvar();
}

function atualizarTotais() {
  recalcular();
  const concluidas = quadras.filter(q => q.status === 'Captação Realizada').length;
  document.getElementById('stat-concluidas').innerText = `${concluidas} de ${quadras.length}`;
  document.getElementById('stat-imoveis').innerText = quadras.reduce((acc, q) => acc + q.imoveis, 0);
  document.getElementById('stat-contatos').innerText = quadras.reduce((acc, q) => acc + q.contatos, 0);
  const importadosAtivos = quadras.reduce((acc, q) => acc + q.casas.filter(c => c.origem === 'github').length, 0);
  const badge = document.getElementById('stat-importados');
  if (badge) badge.innerText = `${importadosAtivos} via GitHub`;
  const setor = document.getElementById('setor-contagem');
  if (setor) setor.innerText = `Praia de Piratininga — ${quadras.length} quadras operacionais`;
}

function renderizar() {
  recalcular();
  const grid = document.getElementById('grid-quadras');
  grid.innerHTML = '';

  quadras.forEach(q => {
    const concluida = q.status === 'Captação Realizada';
    const card = document.createElement('div');
    card.className = 'bg-[#081427] border border-[#122543] rounded-2xl p-5 flex flex-col justify-between hover:border-[#1c3966] transition duration-200';
    card.innerHTML = `
      <div>
        <div class="flex items-start justify-between gap-3">
          <span class="text-[11px] font-bold tracking-wider text-[#0094ff] uppercase block">${q.tag}</span>
          <button onclick="editarQuadra(${q.id})" title="Editar quadra" class="p-1.5 rounded-lg bg-[#0b1b36] hover:bg-[#14305c] text-slate-300 hover:text-white transition"><i data-lucide="settings-2" class="w-3.5 h-3.5"></i></button>
        </div>
        <h3 class="text-[15px] font-bold text-white mt-1 leading-snug min-h-[42px]">${q.nome}</h3>
        <div class="mt-2.5 mb-4">
          <button onclick="toggleStatus(${q.id})" class="text-[11px] font-semibold px-3 py-1 rounded-full cursor-pointer transition ${concluida ? 'bg-[#042c26] text-[#10b981] border border-[#064e43]' : 'bg-[#0b172d] text-[#8e9eb5] border border-[#162a4d]'}">${q.status}</button>
        </div>
      </div>
      <div class="space-y-2.5">
        <button onclick="abrirGaleria(${q.id})" class="w-full py-2.5 bg-[#0094ff]/15 hover:bg-[#0094ff]/25 border border-[#0094ff]/40 text-[#0094ff] hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer">
          <i data-lucide="images" class="w-4 h-4"></i> Ver Fotos & Casas Mapeadas (${q.casas.length})
        </button>
        <div class="bg-[#050f1f] border border-[#11233f] rounded-xl px-4 py-2.5 flex items-center justify-between"><span class="text-xs text-slate-300 font-medium">Imóveis Mapeados</span><span class="text-sm font-bold text-white">${q.imoveis}</span></div>
        <div class="bg-[#050f1f] border border-[#11233f] rounded-xl px-4 py-2.5 flex items-center justify-between"><span class="text-xs text-slate-300 font-medium">Contatos Feitos</span><span class="text-sm font-bold text-white">${q.contatos}</span></div>
      </div>`;
    grid.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

function abrirGerenciadorQuadras() {
  quadraEditandoId = null;
  limparFormularioQuadra();
  renderizarGerenciadorQuadras();
  document.getElementById('modal-quadras').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function fecharGerenciadorQuadras() {
  document.getElementById('modal-quadras').classList.add('hidden');
  quadraEditandoId = null;
  limparFormularioQuadra();
}

function renderizarGerenciadorQuadras() {
  const lista = document.getElementById('lista-gerenciar-quadras');
  if (!lista) return;
  lista.innerHTML = '';

  quadras.forEach(q => {
    lista.insertAdjacentHTML('beforeend', `
      <div class="bg-[#050f1f] border border-[#14294b] rounded-xl p-3 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[10px] font-bold text-sky-400 uppercase tracking-wider">${q.tag}</div>
          <div class="text-xs font-semibold text-white truncate">${q.nome}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">${q.casas.length} imóveis • ${q.status}</div>
        </div>
        <button onclick="editarQuadra(${q.id})" class="shrink-0 px-3 py-1.5 rounded-lg bg-[#0b1b36] hover:bg-[#14305c] text-sky-300 text-[11px] font-semibold">Editar</button>
      </div>`);
  });
  if (window.lucide) lucide.createIcons();
}

function limparFormularioQuadra() {
  quadraEditandoId = null;
  const id = proximoIdQuadra();
  const tag = document.getElementById('quadra-tag');
  const nome = document.getElementById('quadra-nome');
  const status = document.getElementById('quadra-status');
  if (tag) tag.value = `QUADRA ${String(id).padStart(2, '0')}`;
  if (nome) nome.value = '';
  if (status) status.value = 'Pendente';
  const titulo = document.getElementById('quadra-form-titulo');
  if (titulo) titulo.innerText = 'Adicionar nova quadra';
  document.getElementById('btn-excluir-quadra')?.classList.add('hidden');
  const submit = document.getElementById('quadra-submit-texto');
  if (submit) submit.innerText = 'Adicionar Quadra';
}

function editarQuadra(id) {
  const q = quadras.find(item => item.id === id);
  if (!q) return;
  if (document.getElementById('modal-quadras').classList.contains('hidden')) abrirGerenciadorQuadras();
  quadraEditandoId = id;
  document.getElementById('quadra-tag').value = q.tag;
  document.getElementById('quadra-nome').value = q.nome;
  document.getElementById('quadra-status').value = q.status;
  document.getElementById('quadra-form-titulo').innerText = `Editando ${q.tag}`;
  document.getElementById('quadra-submit-texto').innerText = 'Salvar Alterações';
  document.getElementById('btn-excluir-quadra').classList.remove('hidden');
}

function salvarQuadra(event) {
  event.preventDefault();
  const tag = document.getElementById('quadra-tag').value.trim();
  const nome = document.getElementById('quadra-nome').value.trim();
  const status = document.getElementById('quadra-status').value;
  if (!tag || !nome) return;

  if (quadraEditandoId !== null) {
    const q = quadras.find(item => item.id === quadraEditandoId);
    if (q) {
      q.tag = tag;
      q.nome = nome;
      q.status = status;
    }
  } else {
    quadras.push(normalizarQuadra({ id: proximoIdQuadra(), tag, nome, status, casas: [] }, quadras.length));
  }

  salvar();
  renderizarGerenciadorQuadras();
  limparFormularioQuadra();
}

function excluirQuadraAtual() {
  if (quadraEditandoId === null) return;
  const q = quadras.find(item => item.id === quadraEditandoId);
  if (!q) return;
  const aviso = q.casas.length ? `Esta quadra possui ${q.casas.length} imóveis. Excluir a quadra também vai removê-los desta visualização neste navegador. Continuar?` : 'Tem certeza que deseja excluir esta quadra?';
  if (!confirm(aviso)) return;
  q.casas.filter(c => c.origem === 'github' && c.id).forEach(c => ocultos.add(c.id));
  quadras = quadras.filter(item => item.id !== quadraEditandoId);
  salvar();
  renderizarGerenciadorQuadras();
  limparFormularioQuadra();
}

function abrirGaleria(id) {
  quadraAbertaId = id;
  cancelarEdicao();
  const q = quadras.find(item => item.id === id);
  if (!q) return;
  document.getElementById('modal-g-tag').innerText = q.tag;
  document.getElementById('modal-g-nome').innerText = q.nome;
  renderizarListaGaleria(q);
  document.getElementById('modal-galeria').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function fecharGaleria() {
  document.getElementById('modal-galeria').classList.add('hidden');
  quadraAbertaId = null;
  cancelarEdicao();
}

function renderizarListaGaleria(q) {
  const container = document.getElementById('galeria-lista');
  container.innerHTML = '';
  document.getElementById('badge-total-casas').innerText = q.casas.length;
  if (!q.casas.length) {
    container.innerHTML = '<div class="col-span-full py-8 text-center text-slate-500 text-xs italic">Nenhum imóvel cadastrado nesta quadra.</div>';
    return;
  }

  q.casas.forEach((casa, index) => {
    let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
    if (casa.situacao === 'Particular') badgeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
    if (casa.situacao === 'Terreno') badgeColor = 'bg-amber-950/80 text-amber-300 border-amber-800';
    if (casa.situacao === 'Concorrente') badgeColor = 'bg-blue-950/80 text-sky-300 border-blue-800';
    const origem = casa.origem === 'github' ? '<span class="absolute bottom-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded bg-black/70 text-sky-300 border border-sky-700/60">GITHUB</span>' : '';
    const cardImg = casa.foto || '';
    container.insertAdjacentHTML('beforeend', `
      <div class="bg-[#050f1f] border border-[#14294b] rounded-xl overflow-hidden flex flex-col justify-between hover:border-[#1d3d70] transition">
        <div class="relative h-44 bg-black">
          ${cardImg ? `<img src="${cardImg}" alt="Foto do imóvel" loading="lazy" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-slate-600 text-xs">Sem foto</div>'}
          <span class="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}">${casa.situacao || 'Fechada'}</span>
          ${origem}
          <div class="absolute top-2 right-2 flex items-center gap-1.5">
            <button onclick="editarCasa(${index})" title="Editar" class="p-1.5 rounded-md bg-black/70 hover:bg-[#0094ff] text-white transition"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
            <button onclick="excluirCasa(${index})" title="Excluir" class="p-1.5 rounded-md bg-black/70 hover:bg-rose-600 text-rose-300 hover:text-white transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
        </div>
        <div class="p-3.5 space-y-2">
          <p class="font-bold text-white text-xs leading-snug">${casa.endereco || 'Endereço a preencher'}</p>
          <p class="text-[11px] text-slate-300 flex items-start gap-1.5"><i data-lucide="phone" class="w-3 h-3 text-[#0094ff] shrink-0 mt-0.5"></i><span>${casa.telefone || 'Sem contato anotado'}</span></p>
          <button onclick="editarCasa(${index})" class="w-full py-1.5 bg-[#0b1b36] hover:bg-[#112a54] text-sky-400 text-[11px] font-semibold rounded-lg">Editar informações</button>
        </div>
      </div>`);
  });
  if (window.lucide) lucide.createIcons();
}

function editarCasa(index) {
  const q = quadras.find(item => item.id === quadraAbertaId);
  if (!q || !q.casas[index]) return;
  const casa = q.casas[index];
  indexCasaEditando = index;
  document.getElementById('cad-endereco').value = casa.endereco || '';
  document.getElementById('cad-situacao').value = casa.situacao || 'Fechada';
  document.getElementById('cad-telefone').value = casa.telefone || '';
  document.getElementById('cad-foto-url').value = casa.foto && casa.foto.startsWith('http') ? casa.foto : '';
  document.getElementById('cad-foto-arquivo').value = '';
  document.getElementById('form-titulo').innerHTML = '<i data-lucide="edit-3" class="w-4 h-4 text-amber-400"></i> Editando imóvel';
  document.getElementById('badge-modo-edicao').classList.remove('hidden');
  document.getElementById('btn-submit-texto').innerText = 'Salvar Alterações';
  document.getElementById('btn-cancelar-edicao').classList.remove('hidden');
  document.getElementById('galeria-scroll-area').scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

function cancelarEdicao() {
  indexCasaEditando = null;
  ['cad-endereco', 'cad-telefone', 'cad-foto-url'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const arquivo = document.getElementById('cad-foto-arquivo');
  if (arquivo) arquivo.value = '';
  const situacao = document.getElementById('cad-situacao');
  if (situacao) situacao.value = 'Fechada';
  const titulo = document.getElementById('form-titulo');
  if (titulo) titulo.innerHTML = '<i data-lucide="camera" class="w-4 h-4 text-[#0094ff]"></i> Registrar imóvel manualmente';
  document.getElementById('badge-modo-edicao')?.classList.add('hidden');
  document.getElementById('btn-cancelar-edicao')?.classList.add('hidden');
  const txt = document.getElementById('btn-submit-texto');
  if (txt) txt.innerText = 'Salvar Imóvel';
}

function salvarCasa(event) {
  event.preventDefault();
  const q = quadras.find(item => item.id === quadraAbertaId);
  if (!q) return;
  const arquivoInput = document.getElementById('cad-foto-arquivo');
  const urlInput = document.getElementById('cad-foto-url').value.trim();
  const endereco = document.getElementById('cad-endereco').value.trim();
  const situacao = document.getElementById('cad-situacao').value;
  const telefone = document.getElementById('cad-telefone').value.trim();

  function concluir(foto) {
    if (indexCasaEditando !== null) {
      const atual = q.casas[indexCasaEditando];
      atual.endereco = endereco;
      atual.situacao = situacao;
      atual.telefone = telefone;
      if (foto) atual.foto = foto;
    } else {
      q.casas.push({ id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, foto: foto || '', endereco, situacao, telefone, origem: 'local' });
    }
    cancelarEdicao();
    salvar();
    renderizarListaGaleria(q);
  }

  if (arquivoInput.files && arquivoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = evt => concluir(evt.target.result);
    reader.readAsDataURL(arquivoInput.files[0]);
  } else if (urlInput) {
    concluir(urlInput);
  } else {
    const existente = indexCasaEditando !== null ? q.casas[indexCasaEditando].foto : '';
    concluir(existente);
  }
}

function excluirCasa(index) {
  const q = quadras.find(item => item.id === quadraAbertaId);
  if (!q || !q.casas[index]) return;
  if (!confirm('Tem certeza que deseja excluir este registro?')) return;
  const casa = q.casas[index];
  if (casa.origem === 'github' && casa.id) ocultos.add(casa.id);
  q.casas.splice(index, 1);
  cancelarEdicao();
  salvar();
  renderizarListaGaleria(q);
}

recalcular();
renderizar();
atualizarTotais();