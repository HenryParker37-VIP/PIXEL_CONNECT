(function () {
  const VERSION = 'ui-icons-20260809';
  const ICONS = Object.freeze({
    'chat-connect': 'chat-connect',
    'survival-status': 'survival-status',
    'work-for-xu': 'work-for-xu',
    'buy-land': 'buy-land',
    like: 'like',
    'xu-coin': 'xu-coin',
    'furniture-sprout': 'furniture-sprout',
  });

  function escapeAttribute(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function src(name, size = 64) {
    if (!ICONS[name]) throw new Error(`Unknown PixelConnect icon: ${name}`);
    return `/assets/ui-icons/${ICONS[name]}-${size}.png?v=${VERSION}`;
  }

  function markup(name, size = 32, alt = '', className = 'ui-icon') {
    const hidden = alt ? '' : ' aria-hidden="true"';
    return `<img class="${escapeAttribute(className)}" src="${src(name, size)}" width="${size}" height="${size}" alt="${escapeAttribute(alt)}"${hidden} decoding="async">`;
  }

  function create(name, { size = 32, alt = '', className = 'ui-icon' } = {}) {
    const image = document.createElement('img');
    image.className = className;
    image.src = src(name, size);
    image.width = size;
    image.height = size;
    image.alt = alt;
    image.decoding = 'async';
    if (!alt) image.setAttribute('aria-hidden', 'true');
    return image;
  }

  window.PixelIcons = { src, markup, create };
})();
