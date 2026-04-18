(function () {
  const token = localStorage.getItem('pc_token');
  if (!token) { window.location.href = '/'; return; }

  const api = async (path, opts = {}) => {
    const res = await fetch(path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = '/';
      throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  function connectWS() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}`);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
    });
    return ws;
  }

  window.Net = { api, connectWS, token };
})();
