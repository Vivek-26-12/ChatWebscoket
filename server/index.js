const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Maps
const clients = new Map(); // clientId => { username, ws }
const usernameToId = new Map(); // username => clientId
const messages = new Map(); // "user1:user2" => [ { from, to, text } ]

wss.on('connection', (ws) => {
  let clientId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // User joins
      if (data.username) {
        clientId = uuidv4();
        clients.set(clientId, { username: data.username, ws });
        usernameToId.set(data.username, clientId);
        console.log(`User connected: ${data.username} (${clientId})`);
        broadcastOnlineCount();
      }

      // Chat message: { from: "Alice", to: "Bob", text: "Hello Bob!" }
      else if (data.from && data.to && data.text) {
        const key = getMessageKey(data.from, data.to);

        if (!messages.has(key)) {
          messages.set(key, []);
        }

        messages.get(key).push({ from: data.from, to: data.to, text: data.text });

        const toClientId = usernameToId.get(data.to);
        if (toClientId && clients.has(toClientId)) {
          const targetWS = clients.get(toClientId).ws;
          if (targetWS.readyState === WebSocket.OPEN) {
            targetWS.send(JSON.stringify({
              type: 'message',
              from: data.from,
              text: data.text
            }));
          }
        }
      }

    } catch (err) {
      console.error('Invalid message received:', message);
    }
  });

  ws.on('close', () => {
    if (clientId && clients.has(clientId)) {
      const username = clients.get(clientId).username;
      console.log(`User disconnected: ${username} (${clientId})`);
      clients.delete(clientId);
      usernameToId.delete(username);
      broadcastOnlineCount();
    }
  });
});

function broadcastOnlineCount() {
  const count = clients.size;
  const userList = Array.from(clients.values()).map(client => client.username);

  const payload = JSON.stringify({
    type: 'onlineCount',
    count,
    users: userList
  });

  for (let { ws } of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Helper to generate consistent key like "Alice:Bob"
function getMessageKey(user1, user2) {
  return [user1, user2].sort().join(':');
}

const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on ws://0.0.0.0:${PORT}`);
});

