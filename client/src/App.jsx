import React, { useEffect, useRef, useState } from "react";

function App() {
  const [username, setUsername] = useState("");
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const ws = useRef(null);

  const connectWebSocket = () => {
    ws.current = new WebSocket("wss://chatwebscoket.onrender.com");


    ws.current.onopen = () => {
      setConnected(true);
      ws.current.send(JSON.stringify({ username }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "onlineCount") {
        setOnlineUsers(data.users.filter((u) => u !== username));
      } else if (data.type === "message") {
        setChatMessages((prev) => [
          ...prev,
          { from: data.from, to: username, text: data.text },
        ]);
      }
    };

    ws.current.onclose = () => {
      setConnected(false);
      console.log("Disconnected");
    };
  };

  const handleSendMessage = () => {
    if (!selectedUser || !message.trim()) return;

    const msg = {
      from: username,
      to: selectedUser,
      text: message,
    };

    ws.current.send(JSON.stringify(msg));
    setChatMessages((prev) => [...prev, msg]);
    setMessage("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      connectWebSocket();
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#00ff00] font-mono p-4 crt flex items-center justify-center">
      <div className="w-full max-w-6xl border-2 border-[#00ff00] relative bg-black z-10 shadow-[0_0_20px_rgba(0,255,0,0.2)]">
        {/* Terminal Header */}
        <div className="border-b-2 border-[#00ff00] p-2 flex justify-between items-center bg-[#003300]">
          <div className="text-glow font-bold uppercase tracking-widest">
            SYSTEM.ROOT.CHAT_INTERFACE_V1.0
          </div>
          <div className="flex space-x-4 text-xs">
            <span>[ REC ]</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </div>

        {!connected ? (
          <div className="p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
            <div className="mb-8 animate-pulse">
              <pre className="text-[10px] md:text-xs leading-none text-[#00ff00] mb-6">
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
              <h1 className="text-4xl font-bold text-glow mb-2 uppercase">
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
          <div className="flex h-[600px] flex-col md:flex-row">
            {/* Sidebar */}
            <div className="w-full md:w-80 border-b-2 md:border-b-0 md:border-r-2 border-[#00ff00] flex flex-col bg-black/90">
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

              <div className="flex-1 p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-4 border-b border-[#00ff00]/30 pb-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider">Active_Nodes</h3>
                  <span className="bg-[#003300] text-[#00ff00] text-xs font-mono px-2 py-0.5 border border-[#00ff00]">
                    COUNT: {onlineUsers.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {onlineUsers.length === 0 ? (
                    <div className="text-center py-8 opacity-50">
                      <p className="text-sm uppercase">&lt; NO_SIGNAL &gt;</p>
                      <p className="text-xs mt-2">Scanning for nearby nodes...</p>
                    </div>
                  ) : (
                    onlineUsers.map((user) => (
                      <div
                        key={user}
                        onClick={() => setSelectedUser(user)}
                        className={`cursor-pointer p-2 border border-[#00ff00] transition-all duration-100 hover:bg-[#001100] ${selectedUser === user
                            ? "bg-[#00ff00] text-black font-bold shadow-[0_0_10px_rgba(0,255,0,0.4)]"
                            : "bg-black text-[#00ff00]"
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">&gt;</span>
                          <div className="flex-1">
                            <p className="uppercase tracking-wide truncate">{user}</p>
                          </div>
                          {selectedUser === user && <span className="animate-pulse">█</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-black relative">
              {/* Grid Background Overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

              {selectedUser ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b-2 border-[#00ff00] bg-[#001100] z-10 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl animate-pulse">●</span>
                      <div>
                        <h4 className="text-lg font-bold uppercase tracking-widest text-glow">
                          TARGET: {selectedUser}
                        </h4>
                        <p className="text-xs text-[#00ff00]/70 uppercase">ENCRYPTION: AES-256 // STATUS: CONNECTED</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedUser("")}
                      className="md:hidden border border-[#00ff00] px-2 py-1 text-xs hover:bg-[#00ff00] hover:text-black"
                    >
                      [ BACK ]
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 p-6 overflow-y-auto z-10 font-mono">
                    <div className="space-y-4">
                      {chatMessages
                        .filter(
                          (msg) =>
                            (msg.from === username && msg.to === selectedUser) ||
                            (msg.from === selectedUser && msg.to === username)
                        )
                        .map((msg, idx) => (
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
                              <p className="break-words text-lg leading-relaxed mt-1">{msg.text}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t-2 border-[#00ff00] bg-black z-10">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 relative flex items-center border-2 border-[#00ff00] bg-black p-1 focus-within:bg-[#001100] transition-colors">
                        <span className="pl-2 pr-2 text-xl animate-pulse">&gt;</span>
                        <input
                          type="text"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                          placeholder="INPUT_MESSAGE..."
                          className="w-full px-2 py-2 bg-transparent border-none focus:outline-none text-[#00ff00] placeholder-[#00ff00]/30 font-mono text-lg"
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={handleSendMessage}
                        className="px-6 py-3 bg-[#00ff00] text-black font-bold border-2 border-[#00ff00] hover:bg-black hover:text-[#00ff00] transition-all uppercase tracking-wider"
                      >
                        SEND
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center z-10">
                  <div className="text-center opacity-50">
                    <div className="w-24 h-24 border-4 border-[#00ff00] rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <span className="text-4xl font-bold">?</span>
                    </div>
                    <h3 className="text-2xl font-bold uppercase tracking-widest mb-2">Awaiting Input</h3>
                    <p className="text-[#00ff00] text-lg uppercase">&lt; Select a target node to begin transmission &gt;</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;