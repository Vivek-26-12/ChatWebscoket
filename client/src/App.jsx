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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-md shadow-2xl rounded-3xl w-full max-w-6xl overflow-hidden border border-white/20">
        {!connected ? (
          <div className="p-12 text-center">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                Welcome to ChatApp
              </h1>
              <p className="text-gray-600 text-lg">Connect with friends instantly</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-6 py-4 text-lg bg-white/70 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 placeholder-gray-500"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-6">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full py-4 text-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Join Chat Room
              </button>
            </form>
          </div>
        ) : (
          <div className="flex h-[600px]">
            {/* Sidebar */}
            <div className="w-80 bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-200 flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">{username.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{username}</h2>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">Online</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Active Users</h3>
                  <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {onlineUsers.length}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {onlineUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-sm">No other users online</p>
                    </div>
                  ) : (
                    onlineUsers.map((user) => (
                      <div
                        key={user}
                        onClick={() => setSelectedUser(user)}
                        className={`cursor-pointer p-3 rounded-xl transition-all duration-200 ${
                          selectedUser === user
                            ? "bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-200 shadow-md"
                            : "hover:bg-white hover:shadow-md border-2 border-transparent"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold">{user.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className={`font-medium ${selectedUser === user ? 'text-purple-800' : 'text-gray-800'}`}>
                              {user}
                            </p>
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-gray-500">Active now</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              {selectedUser ? (
                <>
                  {/* Chat Header */}
                  <div className="p-6 border-b border-gray-200 bg-white">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-lg">{selectedUser.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-gray-800">{selectedUser}</h4>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">Online</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 p-6 overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
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
                            className={`flex ${
                              msg.from === username ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                                msg.from === username
                                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-br-md"
                                  : "bg-white text-gray-800 shadow-md border border-gray-200 rounded-bl-md"
                              }`}
                            >
                              <p className="text-sm font-medium mb-1">
                                {msg.from === username ? "You" : msg.from}
                              </p>
                              <p className="break-words">{msg.text}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Message Input */}
                  <div className="p-6 border-t border-gray-200 bg-white">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                          placeholder="Type your message..."
                          className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-300 placeholder-gray-500"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-6">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m-9-4.5V8a2 2 0 012-2h6a2 2 0 012 2v2.5" />
                          </svg>
                        </div>
                      </div>
                      <button
                        onClick={handleSendMessage}
                        className="p-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Start a Conversation</h3>
                    <p className="text-gray-600 text-lg">Select a user from the sidebar to begin chatting</p>
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