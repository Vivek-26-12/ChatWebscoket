const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Chat Server Running\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Maps
const clients = new Map(); // clientId => { username, ws }
const usernameToId = new Map(); // username => clientId
const messages = new Map(); // "user1:user2" key or "groupId" => [MsgObj]
const groups = new Map(); // groupId => { id, name, members: [username] }

wss.on('connection', (ws) => {
  let clientId = null;
  let currentUser = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // User joins
      if (data.type === 'join' || data.username) {
        const username = data.username;
        if (!username) return;

        currentUser = username;
        clientId = uuidv4();
        
        // Remove old connection if exists (simple handle)
        if (usernameToId.has(username)) {
            const oldId = usernameToId.get(username);
            if (clients.has(oldId)) {
                clients.delete(oldId);
            }
        }

        clients.set(clientId, { username, ws });
        usernameToId.set(username, clientId);
        console.log(`User connected: ${username} (${clientId})`);
        
        // specialized broadcast
        broadcastOnlineCount();

        // Send existing groups for this user
        const userGroups = [];
        for (const g of groups.values()) {
            if (g.members.includes(username)) {
                userGroups.push(g);
            }
        }
        ws.send(JSON.stringify({
            type: 'groupList',
            groups: userGroups
        }));
      }

      // Create Group
      else if (data.type === 'createGroup') {
        const { name, members } = data; // members is array of usernames
        const groupId = uuidv4();
        // Ensure creator is in members
        const uniqueMembers = [...new Set([...members, currentUser])];
        
        const newGroup = { id: groupId, name, members: uniqueMembers };
        groups.set(groupId, newGroup);
        
        console.log(`Group created: ${name} (${groupId}) with members: ${uniqueMembers.join(', ')}`);

        // Notify all members about the new group
        uniqueMembers.forEach(member => {
            const memberId = usernameToId.get(member);
            if (memberId && clients.has(memberId)) {
                const client = clients.get(memberId);
                if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.send(JSON.stringify({
                        type: 'groupCreated',
                        group: newGroup
                    }));
                }
            }
        });
      }

      // Group Message
      else if (data.type === 'groupMessage') {
        const { groupId, text, from } = data;
        const group = groups.get(groupId);

        if (group) {
            // Check if sender is member
            if (!group.members.includes(from)) return;

            const msgPayload = {
                type: 'groupMessage',
                groupId,
                from,
                text,
                timestamp: new Date().toISOString()
            };
            
            // Store
            if (!messages.has(groupId)) messages.set(groupId, []);
            messages.get(groupId).push(msgPayload);

            // Broadcast to all group members (including sender for simplicity/consistency)
            group.members.forEach(member => {
                const memberId = usernameToId.get(member);
                if (memberId && clients.has(memberId)) {
                    const client = clients.get(memberId);
                    if (client.ws.readyState === WebSocket.OPEN) {
                        client.ws.send(JSON.stringify(msgPayload));
                    }
                }
            });
        }
      }

      // Private Chat message
      else if (data.from && data.to && data.text) {
        const key = getMessageKey(data.from, data.to);

        if (!messages.has(key)) {
          messages.set(key, []);
        }

        const msgPayload = {
            type: 'message',
            from: data.from,
            to: data.to,
            text: data.text,
            timestamp: new Date().toISOString()
        };

        messages.get(key).push(msgPayload);

        // Send to recipient
        const toClientId = usernameToId.get(data.to);
        if (toClientId && clients.has(toClientId)) {
          const targetWS = clients.get(toClientId).ws;
          if (targetWS.readyState === WebSocket.OPEN) {
            targetWS.send(JSON.stringify(msgPayload));
          }
        }
        
        // Also send back to sender if they are on a different connection (or just rely on client to add their own)
        // For consistency in this specific app logic (based on previous code), 
        // the client adds its own messages to state locally. 
        // So we strictly only send to the 'to' client.
      }

    } catch (err) {
      console.error('Invalid message/JSON:', message, err);
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
