// V8 — fase de contato com proprietários: status do contato por imóvel, sugestões da análise das fotos,
// cobertura dos lotes oficiais da Prefeitura e exportação da lista de ligações.
(() => {
  const IGNORADAS_KEY = 'luis_sugestoes_ignoradas_v1';
  const STATUS_CORES = {
    'Não contatado': 'bg-slate-800 text-slate-300 border-slate-700',
    'Sem resposta': 'bg-orange-950/80 text-orange-300 border-orange-800',
    'Retornar': 'bg-sky-950/80 text-sky-300 border-sky-800',
    'Recusou': 'bg-rose-950/80 text-rose-300 border-rose-800',
    'Captado': 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
    'Já é da Luis': 'bg-amber-950/80 text-amber-300 border-amber-700',
    'Descartar': 'bg-black/60 text-slate-500 border-slate-800'
  };
  const FINALIZADOS = ['Recusou', 'Captado', 'Já é da Luis', 'Descartar'];

  let ignoradas = new Set();
  try { ignoradas = new Set(JSON.parse(localStorage.getItem(IGNORADAS_KEY) || '[]')); } catch (_) {}
  function salvarIgnoradas() { try { localStorage.setItem(IGNORADAS_KEY, JSON.stringify([...ignoradas])); } catch (_) {} }

  function podeEditar() {
    if (document.body.dataset.firebaseAdmin === '0') {
      alert('Entre como admin (botão "Entrar para editar") para gravar alterações.');
      return false;
    }
    return true;
  }
  function gravar() {
    persistir();
    renderizar();
    atualizarTotais();
    if (quadraAbertaId !== null) {
      const q = quadras.find(x => x.id === quadraAbertaId);
      if (q) renderizarListaGaleria(q);
    }
  }
  function acharCasa(id) {
    for (const q of quadras) {
      const index = q.casas.findIndex(c => c.id === id);
      if (index >= 0) return { q, casa: q.casas[index], index };
    }
    return null;
  }

  // ---------- Ligar / WhatsApp ----------
  const ORDEM_FILA = { 'Retornar': 0, 'Não contatado': 1, 'Sem resposta': 2 };
  function telefonesDe(casa) {
    return [...new Set((String(casa.telefone || '').match(/(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/g) || [])
      .map(t => t.replace(/\D/g, ''))
      .map(d => (d.length === 8 || d.length === 9) ? '21' + d : d)
      .filter(d => d.length === 10 || d.length === 11))];
  }
  function mensagemWhatsApp(casa) {
    const end = enderecoCasa(casa).replace(/ — rua a confirmar no local/, '');
    const semRua = /^Nº/.test(end);
    // Só cumprimenta pelo nome quando há um único proprietário (com vários, o telefone pode ser de outro).
    const prop = String(casa.proprietario || '');
    const nome = prop && !prop.includes('/') && !/\(/.test(prop) && !/LTDA|EMPREEND|S\/A|IMOBILI/i.test(prop) ? prop.trim().split(/\s+/)[0] : '';
    const saud = nome ? `Olá, ${nome.charAt(0)}${nome.slice(1).toLowerCase()}!` : 'Olá!';
    if (casa.situacao === 'Particular') return `${saud} Vi a placa no imóvel ${semRua ? end.replace('Nº', 'nº') : 'da ' + end}, em Piratininga. Sou da Luis Imóveis (CRECI 7888) e temos clientes procurando nessa região. Ainda está disponível? Posso te ligar rapidinho?`;
    return `${saud} Sou da Luis Imóveis (Piratininga, CRECI 7888). Estamos fazendo um trabalho na orla e temos clientes procurando imóveis perto ${semRua ? 'do imóvel ' + end.replace('Nº', 'nº') : 'da ' + end}. Você teria interesse em vender ou alugar? Posso fazer uma avaliação gratuita, sem compromisso.`;
  }
  function botoesContato(casa) {
    return telefonesDe(casa).map(d => `<span class="flex gap-1"><a href="tel:+55${d}" class="px-2 py-1 rounded-md bg-emerald-800 hover:bg-emerald-700 text-white text-[10px] font-bold">📞 (${d.slice(0, 2)}) ${d.slice(2)}</a><a href="https://wa.me/55${d}?text=${encodeURIComponent(mensagemWhatsApp(casa))}" target="_blank" rel="noopener" class="px-2 py-1 rounded-md bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold">WhatsApp</a></span>`).join('');
  }
  function seletorStatus(casa) {
    const atual = casa.statusContato || 'Não contatado';
    return `<select data-v8-status="${textoSeguro(casa.id)}" onclick="event.stopPropagation()" class="text-[10px] px-1.5 py-1 rounded-md bg-[#081427] border border-[#1b355e] text-slate-200">${Object.keys(STATUS_CORES).map(k => `<option ${k === atual ? 'selected' : ''}>${k}</option>`).join('')}</select>`;
  }
  // Troca de status direto no card / na fila, registrando data na observação.
  document.addEventListener('change', e => {
    const sel = e.target.closest?.('[data-v8-status]');
    if (!sel) return;
    const alvo = acharCasa(sel.dataset.v8Status);
    if (!alvo) return;
    if (!podeEditar()) { sel.value = alvo.casa.statusContato || 'Não contatado'; return; }
    const data = new Date().toLocaleDateString('pt-BR');
    alvo.casa.statusContato = sel.value;
    alvo.casa.observacoes = `${alvo.casa.observacoes ? alvo.casa.observacoes + '\n' : ''}${data}: ${sel.value}`;
    gravar();
    if (!document.getElementById('v8-modal-fila')?.classList.contains('hidden')) renderizarFila();
  });

  // ---------- Card do imóvel ----------
  window.blocoContatoCasa = function blocoContatoCasa(casa) {
    const status = casa.statusContato || 'Não contatado';
    const cor = STATUS_CORES[status] || STATUS_CORES['Não contatado'];
    const prop = casa.proprietario ? `<p class="text-[11px] text-slate-200 flex items-start gap-1.5"><i data-lucide="user" class="w-3 h-3 text-[#0094ff] shrink-0 mt-0.5"></i><span>${textoSeguro(casa.proprietario)}</span></p>` : '';
    const tel = casa.telefone ? `<p class="text-[11px] text-slate-300 flex items-start gap-1.5"><i data-lucide="phone" class="w-3 h-3 text-[#0094ff] shrink-0 mt-0.5"></i><span>${textoSeguro(casa.telefone)}</span></p>` : '';
    const obs = casa.observacoes ? `<p class="text-[10px] text-slate-400 leading-snug line-clamp-3" title="${textoSeguro(casa.observacoes)}">${textoSeguro(casa.observacoes)}</p>` : '';
    const vazio = !prop && !tel && !obs ? '<p class="text-[11px] text-slate-500 italic">Sem contato anotado</p>' : '';
    const acoes = botoesContato(casa);
    return `<div class="flex flex-wrap items-center gap-1.5"><span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${cor}">${textoSeguro(status)}</span>${seletorStatus(casa)}</div>${prop}${tel}${acoes ? `<div class="flex flex-wrap gap-1.5">${acoes}</div>` : ''}${obs}${vazio}`;
  };

  // ---------- Progresso de contato nos cards de quadra ----------
  function resumoQuadra(q) {
    const casas = q.casas.filter(c => c.statusContato !== 'Descartar');
    const cont = s => casas.filter(c => (c.statusContato || 'Não contatado') === s).length;
    const feitos = casas.filter(c => (c.statusContato || 'Não contatado') !== 'Não contatado').length;
    return { total: casas.length, feitos, captados: cont('Captado'), daLuis: cont('Já é da Luis'), retornar: cont('Retornar'), semResposta: cont('Sem resposta') };
  }
  function decorarCardsQuadras() {
    const grid = document.getElementById('grid-quadras');
    if (!grid) return;
    [...grid.children].forEach((card, i) => {
      const q = quadras[i];
      if (!q) return;
      const r = resumoQuadra(q);
      const pct = r.total ? Math.round(r.feitos / r.total * 100) : 0;
      card.querySelector('[data-v8-progresso]')?.remove();
      const html = `<div data-v8-progresso class="mt-2.5 bg-[#050f1f] border border-[#11233f] rounded-xl px-4 py-3 space-y-2"><div class="flex items-center justify-between text-xs"><span class="text-slate-300 font-medium">Contato com proprietários</span><span class="font-bold text-white">${r.feitos}/${r.total}</span></div><div class="h-1.5 rounded-full bg-[#0b1b36] overflow-hidden"><div class="h-full bg-emerald-500" style="width:${pct}%"></div></div><div class="flex flex-wrap gap-1.5 text-[10px]">${r.captados ? `<span class="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300">${r.captados} captado(s)</span>` : ''}${r.daLuis ? `<span class="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300">${r.daLuis} já da Luis</span>` : ''}${r.retornar ? `<span class="px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300">${r.retornar} retornar</span>` : ''}${r.semResposta ? `<span class="px-1.5 py-0.5 rounded bg-orange-950/80 text-orange-300">${r.semResposta} sem resposta</span>` : ''}</div></div>`;
      const alvo = card.querySelector('.space-y-2\\.5');
      if (alvo) alvo.insertAdjacentHTML('beforeend', html);
    });
  }
  const renderizarOriginal = window.renderizar;
  window.renderizar = function renderizarV8() {
    renderizarOriginal();
    decorarCardsQuadras();
  };
  const atualizarTotaisV7 = window.atualizarTotais;
  window.atualizarTotais = function atualizarTotaisV8() {
    atualizarTotaisV7();
    const stat = document.getElementById('stat-contatos');
    const desc = stat?.parentElement?.querySelector('div.text-xs');
    const total = quadras.reduce((a, q) => a + resumoQuadra(q).total, 0);
    if (desc) desc.textContent = `de ${total} imóveis com contato iniciado`;
  };

  // ---------- Separar anotações antigas do campo telefone ----------
  function formatarTelefone(bruto) {
    let d = bruto.replace(/\D/g, '');
    if (d.length === 8 || d.length === 9) d = '21' + d;
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return bruto.trim();
  }
  function separarAnotacoes(casa) {
    const texto = String(casa.telefone || '');
    if (!/[a-zA-ZÀ-ú]{3,}/.test(texto)) return false;
    const telefones = [...new Set((texto.match(/(?:\(?\d{2}\)\s*)?9?\d{4}[-\s]?\d{4}/g) || []).map(formatarTelefone))];
    const nomes = [...new Set((texto.match(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{1,})+\b/g) || []).map(s => s.trim()))];
    let status = 'Não contatado';
    if (/n[aã]o atendeu|n[aã]o consegui contato(?! pelo eemovel)/i.test(texto)) status = 'Sem resposta';
    if (/desligou|tento contato novamente|retornar/i.test(texto)) status = 'Retornar';
    casa.observacoes = casa.observacoes ? `${texto}\n${casa.observacoes}` : texto;
    casa.telefone = telefones.join(' / ');
    if (!casa.proprietario && nomes.length) casa.proprietario = nomes.join(' / ');
    if (!casa.statusContato || casa.statusContato === 'Não contatado') casa.statusContato = status;
    return true;
  }

  // ---------- Sugestões da análise das fotos ----------
  function chaveSugestao(s, i) { return `${s.casaId}#${i}`; }
  function sugestaoAplicada(s) {
    const alvo = acharCasa(s.casaId);
    if (!alvo) return true;
    const c = alvo.casa;
    if (s.tipo === 'separar-anotacoes') return !/[a-zA-ZÀ-ú]{3,}/.test(String(c.telefone || ''));
    return Object.entries(s.campos || {}).every(([k, v]) => k === 'observacoes' ? String(c.observacoes || '').includes(v) : String(c[k] ?? '') === String(v));
  }
  function aplicarSugestao(s) {
    const alvo = acharCasa(s.casaId);
    if (!alvo) return false;
    const c = alvo.casa;
    if (s.tipo === 'separar-anotacoes') return separarAnotacoes(c);
    Object.entries(s.campos || {}).forEach(([k, v]) => {
      if (k === 'observacoes') {
        if (!String(c.observacoes || '').includes(v)) c.observacoes = c.observacoes ? `${c.observacoes}\n${v}` : v;
      } else c[k] = v;
    });
    if (s.campos?.rua || s.campos?.numero) {
      if (/preencher endere/i.test(c.rua || '')) c.rua = '';
      c.endereco = c.rua ? montarEndereco(c.rua, c.numero || '') : `Nº ${c.numero} — rua a confirmar no local`;
    }
    return true;
  }
  function sugestoesPendentes() {
    return (window.SUGESTOES_ANALISE || []).map((s, i) => ({ s, chave: chaveSugestao(s, i) }))
      .filter(({ s, chave }) => !ignoradas.has(chave) && !sugestaoAplicada(s));
  }
  function descreverCampos(s, casa) {
    if (s.tipo === 'separar-anotacoes') return `<div class="text-[11px] text-slate-400">Hoje o campo telefone tem: <span class="text-slate-200">${textoSeguro(casa?.telefone || '')}</span><br>Vai virar: proprietário + telefone(s) + status + observações (o texto original fica nas observações).</div>`;
    const rotulos = { rua: 'Rua', numero: 'Número', lote: 'Inscrição', situacao: 'Situação', telefone: 'Telefone', proprietario: 'Proprietário', statusContato: 'Status do contato', observacoes: 'Observação', latitude: 'Latitude', longitude: 'Longitude' };
    return Object.entries(s.campos || {}).filter(([k]) => k !== 'endereco').map(([k, v]) => {
      const atual = casa ? String(casa[k] ?? '') : '';
      const antes = k !== 'observacoes' && atual && atual !== String(v) ? ` <span class="text-slate-500 line-through">${textoSeguro(atual)}</span>` : '';
      return `<div class="text-[11px]"><span class="text-slate-500">${rotulos[k] || k}:</span>${antes} <span class="text-slate-100">${textoSeguro(v)}</span></div>`;
    }).join('');
  }
  function renderizarSugestoes() {
    const lista = document.getElementById('v8-sugestoes-lista');
    if (!lista) return;
    const pend = sugestoesPendentes();
    document.getElementById('v8-sugestoes-contador').textContent = `${pend.length} pendente(s)`;
    atualizarBotaoSugestoes();
    if (!pend.length) { lista.innerHTML = '<div class="py-10 text-center text-sm text-emerald-300">Todas as sugestões foram aplicadas ou ignoradas. ✔</div>'; return; }
    lista.innerHTML = pend.map(({ s, chave }) => {
      const alvo = acharCasa(s.casaId);
      const casa = alvo?.casa;
      const foto = casa?.foto ? `<img src="${textoSeguro(casa.foto)}" loading="lazy" class="w-28 h-20 object-cover rounded-lg shrink-0 cursor-zoom-in" onclick="window.open(this.src,'_blank')">` : '';
      const conf = s.confianca === 'conferir' ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800">CONFERIR</span>' : '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">ALTA</span>';
      const alerta = s.alerta ? `<div class="text-[11px] text-amber-300">⚠️ ${textoSeguro(s.alerta)}</div>` : '';
      const posicao = alvo ? `${alvo.q.tag} • card #${String(alvo.index + 1).padStart(2, '0')}` : s.casaId;
      return `<div class="bg-[#050f1f] border border-[#14294b] rounded-xl p-3 flex gap-3">${foto}<div class="min-w-0 flex-1 space-y-1"><div class="flex flex-wrap items-center gap-2"><span class="text-[10px] font-bold text-sky-400 uppercase">${textoSeguro(posicao)}</span>${conf}</div><div class="text-xs font-bold text-white">${textoSeguro(s.titulo)}</div>${alerta}${descreverCampos(s, casa)}</div><div class="flex flex-col gap-1.5 shrink-0"><button data-v8-aplicar="${textoSeguro(chave)}" class="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold">Aplicar</button><button data-v8-ignorar="${textoSeguro(chave)}" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold">Ignorar</button></div></div>`;
    }).join('');
    const porChave = new Map(pend.map(p => [p.chave, p.s]));
    lista.querySelectorAll('[data-v8-aplicar]').forEach(b => b.onclick = () => {
      if (!podeEditar()) return;
      aplicarSugestao(porChave.get(b.dataset.v8Aplicar));
      gravar(); renderizarSugestoes();
    });
    lista.querySelectorAll('[data-v8-ignorar]').forEach(b => b.onclick = () => {
      ignoradas.add(b.dataset.v8Ignorar); salvarIgnoradas(); renderizarSugestoes();
    });
  }
  // As sugestões de alta confiança aparecem para todos (inclusive quem só abre o link);
  // ficam gravadas na nuvem na próxima vez que um admin salvar qualquer coisa.
  window.aplicarSugestoesAuto = function aplicarSugestoesAuto() {
    sugestoesPendentes().filter(({ s }) => s.confianca !== 'conferir').forEach(({ s }) => aplicarSugestao(s));
  };

  function aplicarTodasAltaConfianca() {
    if (!podeEditar()) return;
    const pend = sugestoesPendentes().filter(({ s }) => s.confianca !== 'conferir');
    if (!pend.length) return alert('Não há sugestões de alta confiança pendentes.');
    if (!confirm(`Aplicar ${pend.length} sugestão(ões) de alta confiança? As marcadas "CONFERIR" ficam para você revisar uma a uma.`)) return;
    pend.forEach(({ s }) => aplicarSugestao(s));
    gravar(); renderizarSugestoes();
  }

  // ---------- Lotes oficiais da Prefeitura ----------
  function dadosLotes() { return window.LOTES_PREFEITURA || { blocos: {}, lotes: [], nomesQuadras: {} }; }
  function lotesPorQuadra() {
    const { blocos, lotes } = dadosLotes();
    const mapa = new Map();
    lotes.forEach(l => {
      const qid = blocos[l.i.slice(3, 7)];
      if (!qid) return;
      if (!mapa.has(qid)) mapa.set(qid, []);
      mapa.get(qid).push(l);
    });
    return mapa;
  }
  function ordenarLotes(lista) {
    return lista.slice().sort((a, b) => a.r.localeCompare(b.r) || (parseInt(a.n) || 0) - (parseInt(b.n) || 0));
  }
  function casaDoLote(l) {
    const numero = l.n && l.n !== '0' ? l.n : '';
    return {
      id: `lote-${l.i}`, foto: '', origem: 'prefeitura', rua: l.r, numero, lote: l.i, bairro: 'PIRATININGA',
      latitude: String(l.la), longitude: String(l.lo), endereco: montarEndereco(l.r, numero), situacao: 'Fechada', telefone: '',
      proprietario: '', statusContato: 'Não contatado', observacoes: 'Lote oficial ainda não visitado — tirar foto no local.'
    };
  }
  function adicionarLote(quadraId, inscricao) {
    if (!podeEditar()) return;
    const l = dadosLotes().lotes.find(x => x.i === inscricao);
    let q = quadras.find(x => Number(x.id) === Number(quadraId));
    if (!l) return;
    if (!q) q = criarQuadra(quadraId);
    if (q.casas.some(c => c.lote === inscricao)) return;
    q.casas.push(casaDoLote(l));
    gravar(); renderizarLotes();
  }
  function criarQuadra(quadraId) {
    const nome = dadosLotes().nomesQuadras[quadraId] || `Quadra ${quadraId}`;
    const q = normalizarQuadra({ id: Number(quadraId), tag: `QUADRA ${String(quadraId).padStart(2, '0')}`, nome, status: 'Pendente', casas: [] }, quadras.length);
    quadras.push(q);
    quadras.sort((a, b) => Number(a.id) - Number(b.id));
    return q;
  }
  function adicionarTodosLotes(quadraId) {
    if (!podeEditar()) return;
    const faltando = (lotesPorQuadra().get(Number(quadraId)) || []).filter(l => !inscricoesCadastradas().has(l.i));
    if (!faltando.length) return;
    const existe = quadras.some(x => Number(x.id) === Number(quadraId));
    if (!confirm(`${existe ? 'Adicionar' : 'Criar a quadra e adicionar'} ${faltando.length} lote(s) oficiais como imóveis a visitar (sem foto)?`)) return;
    let q = quadras.find(x => Number(x.id) === Number(quadraId)) || criarQuadra(quadraId);
    ordenarLotes(faltando).forEach(l => q.casas.push(casaDoLote(l)));
    gravar(); renderizarLotes();
  }
  function inscricoesCadastradas() {
    return new Set(quadras.flatMap(q => q.casas.map(c => c.lote).filter(Boolean)));
  }
  function renderizarLotes() {
    const lista = document.getElementById('v8-lotes-lista');
    if (!lista) return;
    const cadastradas = inscricoesCadastradas();
    const porQuadra = lotesPorQuadra();
    const nomes = dadosLotes().nomesQuadras;
    lista.innerHTML = [...porQuadra.keys()].sort((a, b) => a - b).map(qid => {
      const lotes = ordenarLotes(porQuadra.get(qid));
      const q = quadras.find(x => Number(x.id) === qid);
      const faltando = lotes.filter(l => !cadastradas.has(l.i));
      const titulo = q ? `${q.tag} — ${q.nome}` : `QUADRA ${String(qid).padStart(2, '0')} — ${nomes[qid] || ''} (ainda não criada)`;
      const linhas = faltando.map(l => `<div class="flex items-center justify-between gap-2 py-1 border-b border-[#0e1d37] last:border-0"><span class="text-[11px] text-slate-300">${textoSeguro(l.r)}${l.n && l.n !== '0' ? `, nº ${textoSeguro(l.n)}` : ' <span class="text-slate-500">(sem nº)</span>'} <span class="text-slate-500">• ${textoSeguro(l.i)}</span></span><span class="flex gap-1.5 shrink-0"><a href="https://www.google.com/maps/search/?api=1&query=${l.la},${l.lo}" target="_blank" rel="noopener" class="px-2 py-1 rounded bg-[#0b1b36] text-sky-300 text-[10px]">Mapa</a><button data-v8-lote="${textoSeguro(l.i)}" data-v8-quadra="${qid}" class="px-2 py-1 rounded bg-emerald-800 hover:bg-emerald-700 text-white text-[10px] font-semibold">Adicionar</button></span></div>`).join('');
      return `<details class="bg-[#050f1f] border border-[#14294b] rounded-xl p-3" ${q && faltando.length ? 'open' : ''}><summary class="cursor-pointer flex flex-wrap items-center justify-between gap-2"><span class="text-xs font-bold text-white">${textoSeguro(titulo)}</span><span class="text-[11px] ${faltando.length ? 'text-amber-300' : 'text-emerald-300'}">${lotes.length - faltando.length}/${lotes.length} lotes no cadastro${faltando.length ? ` • ${faltando.length} sem registro` : ' ✔'}</span></summary>${faltando.length ? `<div class="mt-2">${linhas}</div><div class="mt-2 flex justify-end"><button data-v8-todos="${qid}" class="px-3 py-1.5 rounded-lg bg-[#0094ff] hover:bg-[#0080dd] text-white text-[11px] font-bold">${q ? 'Adicionar todos como "a visitar"' : 'Criar quadra com estes lotes'}</button></div>` : ''}</details>`;
    }).join('');
    lista.querySelectorAll('[data-v8-lote]').forEach(b => b.onclick = () => adicionarLote(b.dataset.v8Quadra, b.dataset.v8Lote));
    lista.querySelectorAll('[data-v8-todos]').forEach(b => b.onclick = () => adicionarTodosLotes(b.dataset.v8Todos));
  }

  // ---------- Fila de ligações ----------
  function itensFila() {
    const itens = [];
    quadras.forEach(q => q.casas.forEach((c, i) => {
      const st = c.statusContato || 'Não contatado';
      if (!(st in ORDEM_FILA) || !telefonesDe(c).length) return;
      itens.push({ q, c, i, prioridade: ORDEM_FILA[st] - (c.situacao === 'Particular' ? 0.5 : 0) });
    }));
    return itens.sort((a, b) => a.prioridade - b.prioridade || Number(a.q.id) - Number(b.q.id) || a.i - b.i);
  }
  function semTelefone() {
    let n = 0;
    quadras.forEach(q => q.casas.forEach(c => {
      const st = c.statusContato || 'Não contatado';
      if (st in ORDEM_FILA && !telefonesDe(c).length && c.situacao !== 'Terreno') n++;
    }));
    return n;
  }
  function renderizarFila() {
    const lista = document.getElementById('v8-fila-lista');
    if (!lista) return;
    const itens = itensFila();
    const aviso = `<div class="text-[11px] text-slate-400">${itens.length} imóvel(is) com telefone na fila • ${semTelefone()} ainda sem telefone (buscar proprietário pela inscrição).</div>`;
    lista.innerHTML = aviso + (itens.length ? itens.map(({ q, c, i }) => {
      const foto = c.foto ? `<img src="${textoSeguro(c.foto)}" loading="lazy" class="w-20 h-16 object-cover rounded-lg shrink-0">` : '';
      return `<div class="bg-[#050f1f] border border-[#14294b] rounded-xl p-3 flex gap-3">${foto}<div class="min-w-0 flex-1 space-y-1.5"><div class="text-[10px] font-bold text-sky-400 uppercase">${textoSeguro(q.tag)} • card #${String(i + 1).padStart(2, '0')} • ${textoSeguro(c.situacao || '')}</div><div class="text-xs font-bold text-white">${textoSeguro(enderecoCasa(c))}</div>${window.blocoContatoCasa(c)}</div></div>`;
    }).join('') : '<div class="py-10 text-center text-sm text-emerald-300">Nenhuma ligação pendente com telefone. ✔</div>');
  }
  window.abrirFilaLigacoes = function () {
    const el = modal('v8-modal-fila', 'Fila de ligações', 'Contato com proprietários', 'v8-fila-lista',
      '<span class="text-[10px] text-slate-500 hidden md:block">Ordem: retornar → placas particulares → não contatados → sem resposta</span>');
    el.classList.remove('hidden');
    renderizarFila();
    if (window.lucide) lucide.createIcons();
  };

  // ---------- Exportar lista de ligações ----------
  function exportarCSV() {
    const cab = ['Quadra', 'Card', 'Endereço', 'Inscrição', 'Situação', 'Proprietário', 'Telefone', 'Status do contato', 'Observações', 'Foto', 'Google Maps'];
    const linhas = [cab];
    const base = location.href.replace(/[^/]*$/, '');
    quadras.forEach(q => q.casas.forEach((c, i) => {
      if (c.statusContato === 'Descartar') return;
      const foto = c.foto && !c.foto.startsWith('data:') ? (c.foto.startsWith('http') ? c.foto : base + c.foto) : '';
      const mapa = c.latitude && c.longitude ? `https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}` : '';
      linhas.push([q.tag, i + 1, enderecoCasa(c), c.lote || '', c.situacao || '', c.proprietario || '', c.telefone || '', c.statusContato || 'Não contatado', (c.observacoes || '').replace(/\s*\n\s*/g, ' | '), foto, mapa]);
    }));
    const csv = '﻿' + linhas.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `ligacoes-piratininga-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- Modais e botões ----------
  function modal(id, titulo, subtitulo, corpoId, extraTopo = '') {
    if (document.getElementById(id)) return document.getElementById(id);
    const el = document.createElement('div');
    el.id = id;
    el.className = 'fixed inset-0 bg-black/85 backdrop-blur-md z-[65] hidden flex items-center justify-center p-4';
    el.innerHTML = `<div class="bg-[#081427] border border-[#1b355e] w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"><div class="p-5 border-b border-[#122543] flex flex-col md:flex-row md:items-center justify-between gap-3"><div><span class="text-xs font-bold text-[#0094ff] uppercase tracking-wider">${subtitulo}</span><h2 class="text-lg font-bold text-white">${titulo}</h2></div><div class="flex items-center gap-2">${extraTopo}<button data-fechar class="text-slate-400 hover:text-white p-2 text-2xl leading-none">×</button></div></div><div id="${corpoId}" class="p-5 overflow-y-auto space-y-3"></div></div>`;
    document.body.appendChild(el);
    el.querySelector('[data-fechar]').onclick = () => el.classList.add('hidden');
    el.addEventListener('click', e => { if (e.target === el) el.classList.add('hidden'); });
    return el;
  }
  window.abrirSugestoesAnalise = function () {
    const el = modal('v8-modal-sugestoes', 'Sugestões da análise das fotos', 'Revisão', 'v8-sugestoes-lista',
      '<span id="v8-sugestoes-contador" class="text-[11px] text-slate-400"></span><button id="v8-aplicar-todas" class="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold">Aplicar todas de alta confiança</button>');
    el.querySelector('#v8-aplicar-todas').onclick = aplicarTodasAltaConfianca;
    el.classList.remove('hidden');
    renderizarSugestoes();
  };
  window.abrirLotesPrefeitura = function () {
    const el = modal('v8-modal-lotes', 'Lotes oficiais × cadastro', 'Prefeitura de Niterói', 'v8-lotes-lista',
      '<span class="text-[10px] text-slate-500 max-w-[260px] hidden md:block">Lotes da camada pública da Prefeitura que ainda não estão no cadastro. "Sem nº" costuma ser terreno ou lote de esquina.</span>');
    el.classList.remove('hidden');
    renderizarLotes();
  };
  window.exportarListaLigacoes = exportarCSV;

  function atualizarBotaoSugestoes() {
    const b = document.getElementById('v8-btn-sugestoes');
    if (!b) return;
    const n = sugestoesPendentes().length;
    b.querySelector('span[data-n]').textContent = n;
    b.classList.toggle('hidden', n === 0 && document.body.dataset.firebaseAdmin === '0');
  }
  function criarBotoes() {
    const topo = document.querySelector('header .flex.flex-wrap.items-center.gap-3');
    if (!topo || document.getElementById('v8-btn-sugestoes')) return;
    const cls = 'px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition';
    topo.insertAdjacentHTML('afterbegin',
      `<button id="v8-btn-sugestoes" onclick="abrirSugestoesAnalise()" class="${cls} bg-amber-600 hover:bg-amber-500 text-white"><i data-lucide="sparkles" class="w-4 h-4"></i> Sugestões <span data-n class="bg-black/30 rounded-full px-1.5 text-xs">0</span></button>` +
      `<button onclick="abrirLotesPrefeitura()" class="${cls} bg-[#0b1b36] hover:bg-[#14305c] border border-[#1d3d70] text-sky-300"><i data-lucide="land-plot" class="w-4 h-4"></i> Lotes da Prefeitura</button>` +
      `<button onclick="abrirFilaLigacoes()" class="${cls} bg-emerald-700 hover:bg-emerald-600 text-white"><i data-lucide="phone-outgoing" class="w-4 h-4"></i> Fila de ligações</button>` +
      `<button onclick="exportarListaLigacoes()" class="${cls} bg-[#0b1b36] hover:bg-[#14305c] border border-[#1d3d70] text-emerald-300"><i data-lucide="download" class="w-4 h-4"></i> Planilha</button>`);
    if (window.lucide) lucide.createIcons();
  }

  criarBotoes();
  window.aplicarSugestoesAuto();
  renderizar();
  atualizarTotais();
  atualizarBotaoSugestoes();
  // O Firebase troca a lista de quadras quando chega a versão da nuvem; mantém o contador em dia.
  setInterval(atualizarBotaoSugestoes, 4000);
})();
