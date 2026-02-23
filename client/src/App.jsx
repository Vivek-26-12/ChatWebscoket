import React, { useEffect, useRef, useState } from "react";
import EmojiPicker from 'emoji-picker-react';

function App() {
  const [username, setUsername] = useState("");
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null); // { id, name, members }

  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Mobile sidebar toggle
  const [showSidebar, setShowSidebar] = useState(true);

  // Group Creation Modal State
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMembers, setNewGroupMembers] = useState([]);

  // Unread counts or total counts
  const [messageCounts, setMessageCounts] = useState({}); // key (username or groupId) -> count

  // Live Clock
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, selectedUser, selectedGroup]);

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle Disbandment/Disconnects
  useEffect(() => {
    // If selected group is no longer in groups list, deselect
    if (selectedGroup && groups.length > 0) { // Check only if we have groups (initial load might be empty)
      // Actually if groups is empty array from server, we should deselect.
      // But initial state is empty array too. 
      // We rely on the fact that if connected and groups list updates, we sync.
    }

    // We can just check existence.
    if (connected && selectedGroup) {
      const stillExists = groups.find(g => g.id === selectedGroup.id);
      if (!stillExists) {
        setSelectedGroup(null);
        // alert("Channel disbanded.");
      }
    }

    // If selected user is no longer online, deselect
    // (userDisconnected handler already clears messages, this is a safety net)
    if (connected && selectedUser) {
      const stillOnline = onlineUsers.includes(selectedUser);
      if (!stillOnline) {
        setSelectedUser("");
      }
    }
  }, [groups, onlineUsers, selectedGroup, selectedUser, connected]);


  const connectWebSocket = () => {
    // connect to deployed server as requested
    ws.current = new WebSocket("wss://chatwebscoket.onrender.com");

    ws.current.onopen = () => {
      setConnected(true);
      ws.current.send(JSON.stringify({ type: 'join', username }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "onlineCount") {
        setOnlineUsers(data.users.filter((u) => u !== username));
      }
      else if (data.type === "groupList") {
        setGroups(data.groups);
      }
      // groupCreated is handled via groupList update in my new server logic usually, 
      // but if server pushes "groupCreated", we add it. 
      // My new server logic pushes "groupList" for everything to be stateless/sync. 
      // But legacy server parts might send groupCreated? current server sends groupCreated?
      // My updated server sends 'groupList' for everything. 
      // But I will keep 'groupCreated' handler just in case.
      else if (data.type === "groupCreated") {
        setGroups(prev => [...prev, data.group]);
      }
      else if (data.type === "message") {
        // Private message
        const key = data.from;
        setChatMessages((prev) => [
          ...prev,
          { from: data.from, to: username, text: data.text, timestamp: new Date() },
        ]);

        if (selectedUser !== key) {
          setMessageCounts(prev => ({
            ...prev,
            [key]: (prev[key] || 0) + 1
          }));
        }
      }
      else if (data.type === "groupMessage") {
        // Group message
        const key = data.groupId;
        setChatMessages((prev) => [
          ...prev,
          { ...data, to: "GROUP", timestamp: new Date() },
        ]);

        if (selectedGroup?.id !== key) {
          setMessageCounts(prev => ({
            ...prev,
            [key]: (prev[key] || 0) + 1
          }));
        }
      }
      else if (data.type === "userDisconnected") {
        const leftUser = data.username;

        // 1) Erase ALL private messages with the disconnected user
        setChatMessages(prev => prev.filter(msg => {
          // Keep group messages (but anonymize below)
          if (msg.to === "GROUP" || msg.groupId) return true;
          // Remove any private message involving the disconnected user
          if (msg.from === leftUser || msg.to === leftUser) return false;
          return true;
        }));

        // 2) Replace disconnected user's name with "IDK(Left)" in group messages
        setChatMessages(prev => prev.map(msg => {
          if ((msg.to === "GROUP" || msg.groupId) && msg.from === leftUser) {
            return { ...msg, from: "IDK(Left)" };
          }
          return msg;
        }));

        // 3) Clear unread count for this user
        setMessageCounts(prev => {
          const next = { ...prev };
          delete next[leftUser];
          return next;
        });

        // 4) If this was the selected private chat, deselect
        if (selectedUser === leftUser) {
          setSelectedUser("");
        }
      }
    };

    ws.current.onclose = () => {
      setConnected(false);
      console.log("Disconnected");
    };

    // Ensure refresh/tab close sends close frame immediately to the server
    const handleBeforeUnload = () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup listener if component unmounts without page reload
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  };

  const handleSendMessage = () => {
    if ((!selectedUser && !selectedGroup) || !message.trim()) return;

    if (selectedGroup) {
      const msg = {
        type: 'groupMessage',
        groupId: selectedGroup.id,
        text: message,
        from: username
      };
      ws.current.send(JSON.stringify(msg));
      // We do NOT add locally for groups, we wait for relay to be stateless/synced with server
      // "Show the ui of message coming" -> when it comes back.
    } else {
      const msg = {
        from: username,
        to: selectedUser,
        text: message,
      };
      ws.current.send(JSON.stringify(msg));
      // Add locally for private to feel instant, OR wait for relay?
      // My server code for private does NOT relay back to sender. 
      // So we MUST add locally for private messages.
      setChatMessages((prev) => [...prev, { ...msg, timestamp: new Date() }]);
    }

    setMessage("");
    setShowEmojiPicker(false);
  };

  const handleCreateGroup = () => {
    if (!newGroupName || newGroupMembers.length === 0) return;

    ws.current.send(JSON.stringify({
      type: 'createGroup',
      name: newGroupName,
      members: [...newGroupMembers] // Server adds current user
    }));

    setShowCreateGroup(false);
    setNewGroupName("");
    setNewGroupMembers([]);
  };

  const toggleGroupMember = (user) => {
    if (newGroupMembers.includes(user)) {
      setNewGroupMembers(prev => prev.filter(u => u !== user));
    } else {
      setNewGroupMembers(prev => [...prev, user]);
    }
  };

  const onEmojiClick = (emojiObject) => {
    setMessage(prev => prev + emojiObject.emoji);
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setSelectedGroup(null);
    setMessageCounts(prev => ({ ...prev, [user]: 0 }));
    setShowSidebar(false); // auto-hide sidebar on mobile
  };

  const selectGroup = (group) => {
    setSelectedGroup(group);
    setSelectedUser("");
    setMessageCounts(prev => ({ ...prev, [group.id]: 0 }));
    setShowSidebar(false); // auto-hide sidebar on mobile
  };

  // Filter messages for current view
  const currentMessages = chatMessages.filter(msg => {
    if (selectedGroup) {
      return msg.groupId === selectedGroup.id;
    }
    if (selectedUser) {
      return (msg.from === username && msg.to === selectedUser) ||
        (msg.from === selectedUser && msg.to === username);
    }
    return false;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      connectWebSocket();
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#00ff00] font-mono p-1 sm:p-4 crt flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-6xl h-[100dvh] sm:h-[85vh] border-2 border-[#00ff00] relative bg-black z-10 shadow-[0_0_20px_rgba(0,255,0,0.2)] flex flex-col">
        {/* Terminal Header */}
        <div className="border-b-2 border-[#00ff00] p-2 flex justify-between items-center bg-[#003300] shrink-0">
          <div className="text-glow font-bold uppercase tracking-widest text-xs sm:text-base truncate">
            <span className="hidden sm:inline">SYSTEM.ROOT.CHAT_INTERFACE_V2.0</span>
            <span className="sm:hidden">SYS.CHAT_V2.0</span>
          </div>
          <div className="flex space-x-2 sm:space-x-4 text-xs shrink-0">
            <span className="hidden sm:inline">[ REC ]</span>
            <span>{time}</span>
          </div>
        </div>

        {!connected ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-12">
            <div className="mb-8 animate-pulse text-center">
              <pre className="text-[8px] md:text-[10px] leading-none text-[#00ff00] mb-6 whitespace-pre">
                {`
   _____ _           _      _               
  / ____| |         | |    | |              
 | |    | |__   __ _| |_   | |    ___   __ _ 
 | |    | '_ \\ / _\` | __|  | |   / _ \\ / _\` |
 | |____| | | | (_| | |_   | |__| (_) | (_| |
  \\_____|_| |_|\\__,_|\\__|  |_____\\___/ \\__, |
                                        __/ |
                                       |___/ 
`}
              </pre>
              <h1 className="text-2xl sm:text-4xl font-bold text-glow mb-2 uppercase">
                &gt; Initialize Connection_
              </h1>
              <p className="text-[#00ff00]/70 text-lg">Establish secure link to server node...</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md mx-auto">
              <div className="relative group">
                <label className="block text-left mb-2 text-xs uppercase tracking-widest text-[#00ff00]/80">Enter Identity Alias:</label>
                <div className="flex items-center border-2 border-[#00ff00] bg-black p-1 focus-within:bg-[#001100] transition-colors">
                  <span className="pl-3 pr-2 text-xl">&gt;</span>
                  <input
                    type="text"
                    placeholder="USERNAME..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-2 py-3 text-xl bg-transparent border-none focus:outline-none text-[#00ff00] placeholder-[#00ff00]/30 font-mono uppercase"
                    required
                    autoFocus
                  />
                  <div className="w-3 h-6 bg-[#00ff00] animate-pulse mr-2"></div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 text-xl font-bold text-black bg-[#00ff00] border-2 border-[#00ff00] hover:bg-black hover:text-[#00ff00] transition-all duration-100 uppercase tracking-widest shadow-[0_0_15px_rgba(0,255,0,0.5)] hover:shadow-none"
              >
                [ EXECUTE LOGIN ]
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden relative">
            {/* Sidebar */}
            <div className={`absolute inset-0 z-30 md:relative md:z-auto w-full md:w-80 border-r-2 border-[#00ff00] flex flex-col bg-black/95 md:bg-black/90 shrink-0 transition-transform duration-200 ease-in-out ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
              <div className="p-4 border-b-2 border-[#00ff00] bg-[#001100]">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 border-2 border-[#00ff00] flex items-center justify-center bg-[#00ff00] text-black font-bold text-xl">
                    {username.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <h2 className="text-lg font-bold text-glow truncate uppercase">{username}</h2>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-[#00ff00] animate-pulse"></div>
                      <span className="text-xs text-[#00ff00]/80 uppercase">Online :: Secure</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Groups Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#00ff00]/80">Secure_Channels</h3>
                    <button
                      onClick={() => setShowCreateGroup(true)}
                      className="text-xs border border-[#00ff00] px-2 py-1 hover:bg-[#00ff00] hover:text-black transition-colors"
                    >
                      + NEW
                    </button>
                  </div>
                  <div className="space-y-1">
                    {groups.map(group => (
                      <div
                        key={group.id}
                        onClick={() => selectGroup(group)}
                        className={`cursor-pointer p-2 border border-[#00ff00] transition-all duration-100 hover:bg-[#001100] flex justify-between items-center ${selectedGroup?.id === group.id
                          ? "bg-[#00ff00] text-black font-bold shadow-[0_0_10px_rgba(0,255,0,0.4)]"
                          : "bg-black text-[#00ff00]"
                          }`}
                      >
                        <span className="truncate"># {group.name}</span>
                        {messageCounts[group.id] > 0 && (
                          <span className="text-xs bg-red-500 text-white px-1.5 rounded-full animate-pulse">
                            {messageCounts[group.id]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Users Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#00ff00]/80">Active_Nodes</h3>
                    <span className="text-xs bg-[#003300] border border-[#00ff00] px-1">{onlineUsers.length}</span>
                  </div>
                  <div className="space-y-1">
                    {onlineUsers.length === 0 ? (
                      <div className="text-center py-4 opacity-50 text-xs uppercase">&lt; NO_SIGNAL &gt;</div>
                    ) : (
                      onlineUsers.map((user) => (
                        <div
                          key={user}
                          onClick={() => selectUser(user)}
                          className={`cursor-pointer p-2 border border-[#00ff00] transition-all duration-100 hover:bg-[#001100] flex justify-between items-center ${selectedUser === user
                            ? "bg-[#00ff00] text-black font-bold shadow-[0_0_10px_rgba(0,255,0,0.4)]"
                            : "bg-black text-[#00ff00]"
                            }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <span>&gt;</span>
                            <span>{user}</span>
                          </div>
                          {messageCounts[user] > 0 && (
                            <span className="text-xs bg-red-500 text-white px-1.5 rounded-full animate-pulse">
                              {messageCounts[user]}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-black relative min-w-0">
              {/* Grid Background */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

              {selectedUser || selectedGroup ? (
                <>
                  {/* Chat Header */}
                  <div className="p-3 sm:p-4 border-b-2 border-[#00ff00] bg-[#001100] z-10 flex justify-between items-center shrink-0">
                    <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                      {/* Mobile Back Button */}
                      <button
                        onClick={() => setShowSidebar(true)}
                        className="md:hidden px-2 py-1 border border-[#00ff00] text-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-colors text-xs shrink-0"
                      >
                        ◄
                      </button>
                      <span className="text-xl sm:text-2xl animate-pulse text-[#00ff00] shrink-0">●</span>
                      <div className="min-w-0">
                        <h4 className="text-sm sm:text-lg font-bold uppercase tracking-widest text-glow truncate">
                          TARGET: {selectedGroup ? `# ${selectedGroup.name}` : selectedUser}
                        </h4>
                        <p className="text-[10px] sm:text-xs text-[#00ff00]/70 uppercase truncate">
                          {selectedGroup
                            ? `MEMBERS: ${selectedGroup.members.length} // MSGS: ${currentMessages.length}`
                            : `AES-256 // CONNECTED // MSGS: ${currentMessages.length}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 p-3 sm:p-6 overflow-y-auto z-10 font-mono custom-scrollbar">
                    <div className="space-y-4">
                      {currentMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.from === username ? "justify-end" : "justify-start"
                            }`}
                        >
                          <div
                            className={`max-w-[85%] md:max-w-md p-3 border ${msg.from === username
                              ? "border-[#00ff00] bg-[#001100] text-right"
                              : "border-[#00ff00] bg-black text-left"
                              }`}
                          >
                            <p className="text-xs font-bold mb-1 uppercase opacity-70 border-b border-[#00ff00]/30 pb-1 inline-block">
                              {msg.from === username ? ">> YOU" : `<< ${msg.from}`}
                            </p>
                            <p className="message-text text-lg leading-relaxed mt-1">{msg.text}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Message Input */}
                  <div className="p-2 sm:p-4 border-t-2 border-[#00ff00] bg-black z-10 shrink-0">
                    <div className="flex items-center space-x-1 sm:space-x-2 relative">
                      {showEmojiPicker && (
                        <div className="absolute bottom-full mb-2 left-0 z-50">
                          <EmojiPicker
                            onEmojiClick={onEmojiClick}
                            theme="dark"
                            width={280}
                            height={350}
                          />
                        </div>
                      )}

                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="self-end px-2 sm:px-3 py-2 sm:py-3 border-2 border-[#00ff00] hover:bg-[#001100] text-lg sm:text-xl grayscale hover:grayscale-0 transition-all shrink-0"
                      >
                        ☺
                      </button>

                      <div className="flex-1 relative flex items-start border-2 border-[#00ff00] bg-black p-1 focus-within:bg-[#001100] transition-colors min-w-0">
                        <span className="pl-1 sm:pl-2 pr-1 sm:pr-2 text-lg sm:text-xl animate-pulse mt-1">&gt;</span>
                        <textarea
                          rows="1"
                          value={message}
                          onChange={(e) => {
                            setMessage(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            } else if (e.key === "Tab") {
                              e.preventDefault();
                              const start = e.target.selectionStart;
                              const end = e.target.selectionEnd;
                              const value = e.target.value;
                              setMessage(value.substring(0, start) + "  " + value.substring(end));
                              // Note: cursor position will reset after state update in simple React, 
                              // but for this task this is a huge improvement for code sharing.
                              setTimeout(() => {
                                e.target.selectionStart = e.target.selectionEnd = start + 2;
                              }, 0);
                            }
                          }}
                          placeholder="INPUT_MESSAGE..."
                          className="w-full px-1 sm:px-2 py-2 bg-transparent border-none focus:outline-none text-[#00ff00] placeholder-[#00ff00]/30 font-mono text-base sm:text-lg resize-none max-h-32 custom-scrollbar"
                        />
                      </div>
                      <button
                        onClick={handleSendMessage}
                        className="self-end px-3 sm:px-6 py-2 sm:py-3 bg-[#00ff00] text-black font-bold border-2 border-[#00ff00] hover:bg-black hover:text-[#00ff00] transition-all uppercase tracking-wider text-sm sm:text-base shrink-0"
                      >
                        <span className="hidden sm:inline">SEND</span>
                        <span className="sm:hidden">►</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center z-10">
                  <div className="text-center opacity-50 px-4">
                    <div className="w-16 sm:w-24 h-16 sm:h-24 border-4 border-[#00ff00] rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 animate-pulse">
                      <span className="text-2xl sm:text-4xl font-bold">?</span>
                    </div>
                    <h3 className="text-lg sm:text-2xl font-bold uppercase tracking-widest mb-2">Awaiting Input</h3>
                    <p className="text-[#00ff00] text-sm sm:text-lg uppercase">&lt; Select a channel or node &gt;</p>
                    {/* Mobile hint */}
                    <button
                      onClick={() => setShowSidebar(true)}
                      className="md:hidden mt-4 px-4 py-2 border border-[#00ff00] text-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-colors text-xs uppercase"
                    >
                      ◄ Open Contacts
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Create Group Modal */}
            {showCreateGroup && (
              <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                <div className="bg-black border-2 border-[#00ff00] w-full max-w-md p-6 shadow-[0_0_50px_rgba(0,255,0,0.3)]">
                  <h2 className="text-xl font-bold uppercase mb-4 border-b border-[#00ff00] pb-2">Create New Channel</h2>

                  <div className="mb-4">
                    <label className="block text-xs uppercase mb-2 text-[#00ff00]/70">Channel Name</label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      className="w-full bg-[#001100] border border-[#00ff00] p-2 text-[#00ff00] focus:outline-none focus:shadow-[0_0_10px_rgba(0,255,0,0.3)]"
                      placeholder="ENTER_NAME"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-xs uppercase mb-2 text-[#00ff00]/70">Add Members</label>
                    <div className="max-h-40 overflow-y-auto border border-[#00ff00] p-2 bg-[#000500]">
                      {onlineUsers.map(user => (
                        <div
                          key={user}
                          onClick={() => toggleGroupMember(user)}
                          className={`flex items-center cursor-pointer p-1 hover:bg-[#002200] ${newGroupMembers.includes(user) ? "text-[#00ff00]" : "text-[#00ff00]/50"}`}
                        >
                          <div className={`w-3 h-3 border border-[#00ff00] mr-2 flex items-center justify-center`}>
                            {newGroupMembers.includes(user) && <div className="w-2 h-2 bg-[#00ff00]"></div>}
                          </div>
                          {user}
                        </div>
                      ))}
                      {onlineUsers.length === 0 && <span className="text-xs opacity-50">NO ACTIVE NODES DETECTED</span>}
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={handleCreateGroup}
                      className="flex-1 py-3 bg-[#00ff00] text-black font-bold border border-[#00ff00] hover:bg-black hover:text-[#00ff00] transition-colors uppercase"
                    >
                      Initialize
                    </button>
                    <button
                      onClick={() => setShowCreateGroup(false)}
                      className="flex-1 py-3 bg-black text-[#00ff00] font-bold border border-[#00ff00] hover:bg-[#001100] transition-colors uppercase"
                    >
                      Abort
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

export default App;