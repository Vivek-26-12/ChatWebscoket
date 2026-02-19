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
const groups = new Map(); // groupId => { id, name, members: [username] }

// We DO NOT store messages history anymore. 
// "stateless... no need to store the data anywhere"

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

        if (usernameToId.has(username)) {
          const oldId = usernameToId.get(username);
          if (clients.has(oldId)) {
            clients.delete(oldId);
          }
        }

        clients.set(clientId, { username, ws });
        usernameToId.set(username, clientId);
        console.log(`User connected: ${username} (${clientId})`);

        broadcastOnlineCount();

        // Send existing groups for this user
        sendUserGroups(username, ws);
      }

      // Create Group
      else if (data.type === 'createGroup') {
        const { name, members } = data;
        const groupId = uuidv4();
        const uniqueMembers = [...new Set([...members, currentUser])]; // Ensure creator is in

        // Per "stateless", we only create if it has members.
        // If < 2, it might be disbanded immediately? 
        // User says "if all the users are removed or single user is in a group chat disband".
        // So a group must have >= 2 members to persist.
        if (uniqueMembers.length < 2) {
          // Maybe error or just don't create?
          // I'll create it, but if they disconnect it goes away.
          // Actually, "single user is in a group chat disband" -> implies existing group.
          // I'll allow creation for now.
        }

        const newGroup = { id: groupId, name, members: uniqueMembers };
        groups.set(groupId, newGroup);

        console.log(`Group created: ${name} (${groupId})`);

        // Notify all members
        uniqueMembers.forEach(member => {
          sendUserGroups(member);
        });
      }

      // Group Message
      else if (data.type === 'groupMessage') {
        const { groupId, text, from } = data;
        const group = groups.get(groupId);

        if (group) {
          if (!group.members.includes(from)) return;

          const msgPayload = {
            type: 'groupMessage',
            groupId,
            from,
            text,
            timestamp: new Date().toISOString()
          };

          // Relay to all members who are online
          group.members.forEach(member => {
            const memberId = usernameToId.get(member);
            if (memberId && clients.has(memberId)) {
              const client = clients.get(memberId);
              if (client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(msgPayload));
              }
            }
          });
          // No storage
        }
      }

      // Private Chat message
      else if (data.from && data.to && data.text) {
        const msgPayload = {
          type: 'message',
          from: data.from,
          to: data.to,
          text: data.text,
          timestamp: new Date().toISOString()
        };

        // Send to recipient
        const toClientId = usernameToId.get(data.to);
        if (toClientId && clients.has(toClientId)) {
          const targetWS = clients.get(toClientId).ws;
          if (targetWS.readyState === WebSocket.OPEN) {
            targetWS.send(JSON.stringify(msgPayload));
          }
        }
        // No storage
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

      // Handle Disconnection Logic for Groups
      handleUserDisconnectFromGroups(username);
    }
  });
});

function handleUserDisconnectFromGroups(username) {
  const affectedUsers = new Set();
  const groupsToDelete = [];

  // Iterate all groups
  for (const [groupId, group] of groups.entries()) {
    if (group.members.includes(username)) {
      // Remove user
      group.members = group.members.filter(m => m !== username);

      // "if all the users are removed or single user is in a group chat disband"
      if (group.members.length < 2) {
        groupsToDelete.push(groupId);

        // If there is 1 remaining member, they need to know group is gone
        group.members.forEach(m => affectedUsers.add(m));
      } else {
        // Group survives (>= 2 members)
        // Notify remaining members that user left (implicit via groupList update)
        group.members.forEach(m => affectedUsers.add(m));
      }
    }
  }

  // Delete disbanded groups
  groupsToDelete.forEach(gid => {
    groups.delete(gid);
    console.log(`Group ${gid} disbanded due to lack of members.`);
  });

  // Send updated group lists to all affected users
  affectedUsers.forEach(user => {
    // Only send if user is still online (we might have just deleted them from maps, but other users are there)
    sendUserGroups(user);
  });
}

function sendUserGroups(username, specificWs = null) {
  // Find all groups this user is in
  const userGroups = [];
  for (const g of groups.values()) {
    if (g.members.includes(username)) {
      userGroups.push(g);
    }
  }

  const payload = JSON.stringify({
    type: 'groupList',
    groups: userGroups
  });

  if (specificWs) {
    if (specificWs.readyState === WebSocket.OPEN) {
      specificWs.send(payload);
    }
  } else {
    const id = usernameToId.get(username);
    // Only send if online
    if (id && clients.has(id)) {
      const client = clients.get(id);
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}

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

const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on ws://0.0.0.0:${PORT}`);
});
