(function () {
  function toast(msg, kind = '') {
    const wrap = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 3000);
    setTimeout(() => el.remove(), 3500);
  }

  function show(id) { document.getElementById(id).classList.remove('hidden'); }
  function hide(id) { document.getElementById(id).classList.add('hidden'); }

  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (closer) hide(closer.dataset.close);
  });

  window.UI = { toast, show, hide };
})();
