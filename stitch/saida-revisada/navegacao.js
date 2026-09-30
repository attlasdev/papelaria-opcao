// Navegacao do prototipo: botoes com data-ir levam a outra tela; os demais avisam que
// ainda nao tem destino, para distinguir "nao existe" de "quebrou".
(function () {
  var aviso = document.createElement('div');
  aviso.setAttribute('role', 'status');
  aviso.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;' +
    'padding:10px 16px;border-radius:8px;background:#111;color:#fff;font:500 13px/1.3 Inter,Arial,sans-serif;' +
    'box-shadow:0 4px 16px rgba(0,0,0,.18);opacity:0;pointer-events:none;transition:opacity .15s';
  document.body.appendChild(aviso);
  var tempo;

  function avisar(texto) {
    aviso.textContent = texto;
    aviso.style.opacity = '1';
    clearTimeout(tempo);
    tempo = setTimeout(function () { aviso.style.opacity = '0'; }, 1800);
  }

  document.addEventListener('click', function (evento) {
    var alvo = evento.target.closest('[data-ir], button, a');
    if (!alvo) return;
    if (alvo.hasAttribute('data-ir')) {
      evento.preventDefault();
      location.href = alvo.getAttribute('data-ir');
      return;
    }
    // Controles com comportamento proprio da tela (mostrar valores, gaveta de cliente, pagamento).
    if (alvo.id || alvo.hasAttribute('onclick') || alvo.classList.contains('pay-btn')) return;
    var href = alvo.getAttribute('href');
    if (alvo.tagName === 'A' && href && href !== '#') return;
    evento.preventDefault();
    var rotulo = (alvo.getAttribute('title') || alvo.textContent || '').replace(/\s+/g, ' ').trim();
    avisar('Sem destino neste protótipo' + (rotulo ? ': ' + rotulo.slice(0, 40) : ''));
  });

  document.querySelectorAll('[data-ir]').forEach(function (el) { el.style.cursor = 'pointer'; });
})();
