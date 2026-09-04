// Ajustes finais de apresentação: nomes oficiais das vias e status real do mapeamento.
(() => {
  const nomesOficiais = {
    1: 'Rua Dr. Wilson Vieira (antiga Rua 115)',
    2: 'Rua Prof. Fernando José de Almeida (antiga Rua 116)',
    3: 'Rua Canagé Malta (antiga Rua 117)',
    4: 'Rua Jorn. Umbelino Silva (antiga Rua 118)',
    5: 'Rua Abdo Ami-Ramia (antiga Rua 119)',
    6: 'Rua Pietro Farzout (antiga Rua 120)',
    7: 'Rua Jorn. Francisco R. de Miranda (antiga Rua 121)',
    8: 'Rua João Gomes da Silva (antiga Rua 122)'
  };

  function carregarScript(src, atributo) {
    return new Promise((resolve, reject) => {
      const existente = document.querySelector(`script[${atributo}]`);
      if (existente) {
        if (existente.dataset.carregado === '1') resolve();
        else existente.addEventListener('load', resolve, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.setAttribute(atributo, '1');
      script.onload = () => { script.dataset.carregado = '1'; resolve(); };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  async function carregarFirebaseSync() {
    if (document.querySelector('script[data-firebase-sync-v1]')) return;
    try {
      await carregarScript('https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js', 'data-firebase-app');
      await carregarScript('https://www.gstatic.com/firebasejs/12.8.0/firebase-auth-compat.js', 'data-firebase-auth');
      await carregarScript('https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore-compat.js', 'data-firebase-firestore');
      await carregarScript('js/firebase-sync-v1.js', 'data-firebase-sync-v1');
    } catch (erro) {
      console.error('Não foi possível carregar a sincronização do Firebase.', erro);
    }
  }

  function carregarAjustesV7() {
    const existente = document.querySelector('script[data-ajustes-v7]');
    if (existente) {
      carregarFirebaseSync();
      return;
    }
    const script = document.createElement('script');
    script.src = 'js/ajustes-finais-v7.js';
    script.dataset.ajustesV7 = '1';
    script.onload = carregarFirebaseSync;
    document.body.appendChild(script);
  }

  function aplicar() {
    if (!Array.isArray(quadras)) return;
    let alterou = false;
    quadras.forEach(q => {
      const id = Number(q.id);
      if (nomesOficiais[id] && q.nome !== nomesOficiais[id]) {
        q.nome = nomesOficiais[id];
        alterou = true;
      }
      const statusEsperado = id >= 1 && id <= 7 ? 'Captação Realizada' : (id === 8 ? 'Pendente' : q.status);
      if (q.status !== statusEsperado) {
        q.status = statusEsperado;
        alterou = true;
      }
    });
    if (alterou && typeof persistir === 'function') persistir();
    if (typeof renderizar === 'function') renderizar();
    if (typeof atualizarTotais === 'function') atualizarTotais();
    carregarAjustesV7();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})();
