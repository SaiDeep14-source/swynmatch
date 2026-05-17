import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageCircle, Hash, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { authFetch } from '../lib/api';

interface Message {
  id: string;
  user: string;
  recipient?: string;
  text: string;
  timestamp: string;
}

export default function Chat({ currentUser }: { currentUser: string }) {
  const [globalMessages, setGlobalMessages] = useState<Message[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<{ email: string }[]>([]);
  const [activeChannel, setActiveChannel] = useState<string>('global'); // 'global' or email
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Determine socket URL. If in browser preview, it is same origin
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join', currentUser);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('message', (msg: Message) => {
      setGlobalMessages(prev => [...prev, msg]);
    });

    socket.on('private_message', (msg: Message) => {
      setPrivateMessages(prev => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [usersRes, historyRes] = await Promise.all([
          authFetch('/api/users'),
          authFetch('/api/chat/history')
        ]);
        
        if (usersRes.ok) {
          const u = await usersRes.json();
          setUsers(u.filter((user: any) => user.email !== currentUser));
        }

        if (historyRes.ok) {
          const h = await historyRes.json();
          setGlobalMessages(h.global || []);
          setPrivateMessages(h.private || []);
        }
      } catch (err) {
        console.error("Failed to fetch initial chat data");
      }
    };

    fetchInitialData();
  }, [currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalMessages, privateMessages, activeChannel]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !socketRef.current) return;

    if (activeChannel === 'global') {
      socketRef.current.emit('message', {
        user: currentUser,
        text: inputText.trim()
      });
    } else {
      socketRef.current.emit('private_message', {
        user: currentUser,
        recipient: activeChannel,
        text: inputText.trim()
      });
    }
    
    setInputText('');
  };

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()));

  const currentMessages = activeChannel === 'global' 
    ? globalMessages 
    : privateMessages.filter(m => 
        (m.user === currentUser && m.recipient === activeChannel) || 
        (m.user === activeChannel && m.recipient === currentUser)
      );

  return (
    <div className="h-[calc(100vh-100px)] flex bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      
      {/* Sidebar sidebar */}
      <div className="w-64 md:w-80 border-r border-gray-200 bg-gray-50/50 flex flex-col shrink-0 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Chat</h2>
          <div className="relative">
             <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
             <input 
               type="text" 
               placeholder="Search users..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-shadow" 
             />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-2 px-2">Channels</div>
          <button
            onClick={() => setActiveChannel('global')}
            className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
              activeChannel === 'global' ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Hash className="w-4 h-4 mr-2 text-orange-500" />
            Global Chat
          </button>
          
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-6 px-2">Direct Messages</div>
          {filteredUsers.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">No users found</div>
          ) : (
             filteredUsers.map((user) => (
                <button
                  key={user.email}
                  onClick={() => setActiveChannel(user.email)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeChannel === user.email ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold mr-2 ${activeChannel === user.email ? 'bg-orange-500' : 'bg-gray-400'}`}>
                     {user.email.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate">{user.email.split('@')[0]}</span>
                </button>
             ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center">
            {activeChannel === 'global' ? (
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center mr-4">
                <Hash className="h-5 w-5 text-orange-600" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mr-4">
                <User className="h-5 w-5 text-emerald-600" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-900 truncate max-w-[200px] md:max-w-md">
                {activeChannel === 'global' ? 'Global Chat' : activeChannel.split('@')[0]}
              </h2>
              <div className="flex items-center text-sm">
                 <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                 <span className={isConnected ? "text-emerald-600" : "text-gray-500"}>
                   {isConnected ? 'Connected' : 'Connecting...'}
                 </span>
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          <div className="space-y-6">
            {currentMessages.length === 0 ? (
              <div className="text-center py-12">
                 <MessageCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                 <h3 className="text-gray-500 font-medium">No messages yet</h3>
                 <p className="text-gray-400 text-sm mt-1">Be the first to say hello!</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {currentMessages.map((msg) => {
                  const isMe = msg.user === currentUser;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center text-xs text-gray-500 mb-1 px-1">
                        <span className="font-medium text-gray-700 mr-2">{msg.user.split('@')[0]}</span>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div 
                        className={`max-w-[85%] md:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                          isMe 
                            ? 'bg-orange-600 text-white rounded-br-sm shadow-sm' 
                            : 'bg-gray-100 border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200 shrink-0">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Message ${activeChannel === 'global' ? '#global' : activeChannel.split('@')[0]}...`}
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm transition-shadow text-gray-900"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || !isConnected}
              className="px-4 py-2 bg-orange-600 text-white rounded-xl font-medium shadow-sm hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0"
            >
              <Send className="w-5 h-5 mr-0 md:mr-2" />
              <span className="hidden md:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
