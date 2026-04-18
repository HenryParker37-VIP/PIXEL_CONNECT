(function () {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tabpanel');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    panels.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById(t.dataset.tab + 'Form').classList.add('active');
  }));

  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const authCard = document.getElementById('authCard');
  const codeCard = document.getElementById('codeCard');
  const codeEl = document.getElementById('backupCode');

  function finishLogin(data) {
    localStorage.setItem('pc_token', data.token);
    localStorage.setItem('pc_user', data.username);
    window.location.href = '/game.html';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('loginErr');
    err.textContent = '';
    const body = {
      identifier: document.getElementById('loginId').value.trim(),
    };
    const pass = document.getElementById('loginPass').value;
    const code = document.getElementById('loginCode').value.trim();
    if (pass) body.password = pass;
    else if (code) body.backupCode = code;
    else { err.textContent = 'Enter password or backup code'; return; }

    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      finishLogin(data);
    } catch (e) { err.textContent = e.message; }
  });

  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('regErr');
    err.textContent = '';
    const body = {
      username: document.getElementById('regUser').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      password: document.getElementById('regPass').value,
    };
    try {
      const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      localStorage.setItem('pc_token', data.token);
      localStorage.setItem('pc_user', data.username);
      codeEl.textContent = data.backupCode;
      authCard.classList.add('hidden');
      codeCard.classList.remove('hidden');
    } catch (e) { err.textContent = e.message; }
  });

  document.getElementById('codeContinue').addEventListener('click', () => {
    window.location.href = '/game.html';
  });

  // Already logged in? Jump to game.
  if (localStorage.getItem('pc_token')) {
    // Lightweight check
    fetch('/api/me', { headers: { Authorization: 'Bearer ' + localStorage.getItem('pc_token') } })
      .then(r => { if (r.ok) window.location.href = '/game.html'; });
  }
})();
