const { WebSocket } = require('ws');

setTimeout(() => process.exit(0), 5000);

const ws = new WebSocket('ws://localhost:3000');
ws.on('open', () => {
    console.log('[*] Connected');
    // First we need a token. We can't easily get one via WS, we have to register via HTTP.
});
ws.on('close', () => {
    console.log('[*] Disconnected');
});
