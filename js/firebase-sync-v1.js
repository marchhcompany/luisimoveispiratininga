// Sincronização em tempo real do mapeamento com Firebase/Firestore.
// As fotos existentes continuam sendo servidas pelo GitHub; o Firestore sincroniza os dados operacionais.
(() => {
  if (!window.firebase || !firebase.initializeApp || !firebase.firestore || !firebase.auth) {
    console.error('Firebase não carregou corretamente.');
    return;
  }

  const firebaseConfig = {
    apiKey: 'AIzaSyDBGWsXFacb-ikX9w0CCoPCgg0ZvBL-cp8',
    authDomain: 'luis-imoveis.firebaseapp.com',
    projectId: 'luis-imoveis',
    storageBucket: 'luis-imoveis.firebasestorage.app',
    messagingSenderId: '683878263883',
    appId: '1:683878263883:web:4aad77338be8dfbd26f1ce'
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const estadoRef = db.collection('sistema').doc('estado');

  let usuarioAtual = null;
  let remotoExiste = false;
  let aplicandoRemoto = false;
  let timerSalvar = null;
  let primeiraLeituraConcluida = false;

  const persistirLocalOriginal = typeof window.persistir === 'function' ? window.persistir : null;

  function sanitizarQuadras() {
    const origem = typeof quadras !== 'undefined' && Array.isArray(quadras) ? quadras : [];
    const dados = origem.map(q => ({
      ...q,
      casas: (q.casas || []).map(c => {
        const copia = { ...c };
        if (typeof copia.foto === 'string' && copia.foto.startsWith('data:')) copia.foto = '';
        return copia;
      })
    }));
    return JSON.parse(JSON.stringify(dados));
  }

  function setStatus(texto, tipo = 'normal') {
    let el = document.getElementById('firebase-sync-status');
    if (!el) {
      const setor = document.getElementById('setor-contagem')?.closest('section');
      if (setor) {
        el = document.createElement('div');
        el.id = 'firebase-sync-status';
        el.className = 'text-[10px] text-slate-400 mt-1 md:mt-0';
        setor.appendChild(el);
      }
    }
    if (!el) return;
    if (el.textContent !== texto) el.textContent = texto;
    const classe = `text-[10px] mt-1 md:mt-0 ${tipo === 'erro' ? 'text-rose-400' : tipo === 'ok' ? 'text-emerald-400' : 'text-slate-400'}`;
    if (el.className !== classe) el.className = classe;
  }

  function formatarData(timestamp) {
    try {
      const data = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      if (!data || Number.isNaN(data.getTime())) return '';
      return data.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch { return ''; }
  }

  function aplicarModoAcesso() {
    const autenticado = !!usuarioAtual;
    document.body.dataset.firebaseAdmin = autenticado ? '1' : '0';

    const esconderLeitor = [
      'button[onclick^="abrirGerenciadorQuadras"]',
      'button[onclick^="toggleStatus"]',
      'button[onclick^="editarQuadra"]',
      '#box-formulario',
      '#btn-excluir-quadra',
      '#btn-cancelar-edicao',
      '#modal-quadras button[type="submit"]',
      '#galeria-lista button[title="Editar"]',
      '#galeria-lista button[title="Excluir"]',
      '#galeria-lista button[title^="Mover"]',
      '#galeria-lista button:not(#btn-carregar-mais-fotos)'
    ];

    esconderLeitor.forEach(seletor => {
      document.querySelectorAll(seletor).forEach(el => {
        if (el.dataset.displayOriginal === undefined) el.dataset.displayOriginal = el.style.display || '';
        const desejado = autenticado ? el.dataset.displayOriginal : 'none';
        if (el.style.display !== desejado) el.style.display = desejado;
      });
    });

    let botao = document.getElementById('btn-firebase-login');
    if (!botao) {
      botao = document.createElement('button');
      botao.id = 'btn-firebase-login';
      botao.className = 'px-4 py-2 rounded-xl bg-[#0b1b36] hover:bg-[#14305c] border border-[#1d3d70] text-sky-300 text-sm font-semibold flex items-center gap-2 transition';
      const topo = document.querySelector('header .flex.flex-wrap.items-center.gap-3');
      if (topo) topo.appendChild(botao);
    }
    if (botao) {
      const html = autenticado ? '<span>Admin conectado</span>' : '<span>Entrar para editar</span>';
      if (botao.innerHTML !== html) botao.innerHTML = html;
      botao.onclick = autenticado ? () => auth.signOut() : abrirLogin;
    }
  }

  function mensagemErroLogin(e) {
    const codigo = e?.code || 'erro-desconhecido';
    const mapa = {
      'auth/invalid-credential': 'E-mail ou senha inválidos no Firebase Authentication.',
      'auth/user-not-found': 'Este e-mail não existe neste projeto do Firebase.',
      'auth/wrong-password': 'A senha informada não confere.',
      'auth/invalid-email': 'O formato do e-mail é inválido.',
      'auth/user-disabled': 'Este usuário está desativado no Firebase.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      'auth/network-request-failed': 'Falha de rede ao falar com o Firebase.',
      'auth/operation-not-allowed': 'O login por e-mail/senha não está habilitado no Firebase.',
      'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase Authentication.',
      'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'A chave do app Firebase não foi aceita.'
    };
    return `${mapa[codigo] || (e?.message || 'Não foi possível entrar.')} (${codigo})`;
  }

  function abrirLogin() {
    let modal = document.getElementById('modal-firebase-login');
    if (modal) return;
    modal = document.createElement('div');
    modal.id = 'modal-firebase-login';
    modal.className = 'fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="w-full max-w-sm bg-[#081427] border border-[#1b355e] rounded-2xl p-6 shadow-2xl">
        <div class="flex items-start justify-between gap-3 mb-5">
          <div><div class="text-xs font-bold uppercase tracking-wider text-sky-400">Acesso administrativo</div><h2 class="text-xl font-bold text-white mt-1">Entrar para editar</h2><p class="text-xs text-slate-400 mt-1">Use o usuário criado no Firebase Authentication.</p></div>
          <button id="firebase-login-fechar" class="text-slate-400 hover:text-white text-xl">×</button>
        </div>
        <form id="firebase-login-form" class="space-y-3">
          <input id="firebase-login-email" type="email" required autocomplete="username" placeholder="E-mail" class="w-full px-3 py-2.5 rounded-lg bg-[#050f1f] border border-[#1b355e] text-sm text-white focus:outline-none focus:border-sky-500">
          <input id="firebase-login-senha" type="password" required autocomplete="current-password" placeholder="Senha" class="w-full px-3 py-2.5 rounded-lg bg-[#050f1f] border border-[#1b355e] text-sm text-white focus:outline-none focus:border-sky-500">
          <div id="firebase-login-erro" class="hidden text-xs text-rose-400 leading-relaxed"></div>
          <button type="submit" class="w-full px-4 py-2.5 rounded-lg bg-[#0094ff] hover:bg-[#0080dd] text-white text-sm font-bold">Entrar</button>
        </form>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#firebase-login-fechar').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#firebase-login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const email = modal.querySelector('#firebase-login-email').value.trim();
      const senha = modal.querySelector('#firebase-login-senha').value;
      const erro = modal.querySelector('#firebase-login-erro');
      erro.classList.add('hidden');
      erro.textContent = '';
      try {
        await auth.signInWithEmailAndPassword(email, senha);
        modal.remove();
      } catch (e) {
        erro.textContent = mensagemErroLogin(e);
        erro.classList.remove('hidden');
        console.error('Firebase login:', e?.code, e?.message, e);
      }
    });
  }

  function salvarRemotoEmBreve() {
    if (aplicandoRemoto || !usuarioAtual || !primeiraLeituraConcluida) return;
    clearTimeout(timerSalvar);
    timerSalvar = setTimeout(async () => {
      try {
        setStatus('Salvando alterações na nuvem...');
        await estadoRef.set({
          quadras: sanitizarQuadras(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: usuarioAtual.email || usuarioAtual.uid,
          versao: 1
        }, { merge: true });
        remotoExiste = true;
        setStatus('Alterações sincronizadas', 'ok');
      } catch (e) {
        console.error('Erro ao sincronizar com Firestore', e);
        setStatus('Falha ao sincronizar. Os dados continuam salvos neste navegador.', 'erro');
      }
    }, 500);
  }

  if (persistirLocalOriginal) {
    window.persistir = function persistirComFirebase() {
      persistirLocalOriginal();
      salvarRemotoEmBreve();
    };
  }

  async function semearSeNecessario() {
    if (!usuarioAtual || remotoExiste || !primeiraLeituraConcluida) return;
    try {
      setStatus('Criando a base compartilhada pela primeira vez...');
      await estadoRef.set({
        quadras: sanitizarQuadras(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: usuarioAtual.email || usuarioAtual.uid,
        versao: 1
      });
      remotoExiste = true;
      setStatus('Base compartilhada criada e sincronizada', 'ok');
    } catch (e) {
      console.error(e);
      setStatus('Não foi possível criar a base compartilhada.', 'erro');
    }
  }

  estadoRef.onSnapshot(snapshot => {
    primeiraLeituraConcluida = true;
    remotoExiste = snapshot.exists;
    const dados = snapshot.data();

    if (snapshot.exists && Array.isArray(dados?.quadras)) {
      aplicandoRemoto = true;
      try {
        const novas = dados.quadras.map((q, i) => typeof normalizarQuadra === 'function' ? normalizarQuadra(q, i) : q);
        try { quadras = novas; } catch (_) {}
        if (persistirLocalOriginal) persistirLocalOriginal();
        if (typeof renderizar === 'function') renderizar();
        if (typeof atualizarTotais === 'function') atualizarTotais();
        const data = formatarData(dados.updatedAt);
        setStatus(data ? `Dados em tempo real • última atualização ${data}` : 'Dados em tempo real', 'ok');
      } finally {
        aplicandoRemoto = false;
      }
    } else if (!snapshot.exists) {
      setStatus(usuarioAtual ? 'Preparando base compartilhada...' : 'Base compartilhada ainda não iniciada. Entre como admin para ativar.');
      semearSeNecessario();
    }
    aplicarModoAcesso();
  }, e => {
    console.error('Erro ao ler Firestore', e);
    setStatus('Sem conexão com a base em tempo real.', 'erro');
  });

  auth.onAuthStateChanged(user => {
    usuarioAtual = user || null;
    aplicarModoAcesso();
    if (usuarioAtual) setTimeout(semearSeNecessario, 300);
  });

  const observer = new MutationObserver(() => aplicarModoAcesso());
  observer.observe(document.body, { childList: true, subtree: true });
  aplicarModoAcesso();
})();
