import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, User, Search, Hash } from 'lucide-react';

interface ChatMessage {
  id: number;
  sender: string;
  senderInitials: string;
  text: string;
  time: string;
  mine: boolean;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchUserQuery, setSearchUserQuery] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage: ChatMessage = {
      id: Date.now(),
      sender: 'You',
      senderInitials: 'YO',
      text: inputText,
      time: timeString,
      mine: true
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    // Simulate polite automated response after a brief delay
    setTimeout(() => {
      const responseMessage: ChatMessage = {
        id: Date.now() + 1,
        sender: 'SwynMatch Bot',
        senderInitials: 'SB',
        text: "Direct messaging and channels are currently in connection mode. Your message was recorded successfully in our active log.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mine: false
      };
      setMessages(prev => [...prev, responseMessage]);
    }, 1200);
  };

  return (
    <div className="h-[calc(100vh-13rem)] flex rounded-2xl border border-gray-150 bg-white overflow-hidden shadow-sm font-sans">
      
      {/* Left Chat Thread Panel - Styled Exactly like Image 1 */}
      <div className="w-80 border-r border-gray-150 flex flex-col bg-white shrink-0">
        <div className="p-6 border-b border-gray-50 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 tracking-tight">Chat</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input 
              type="text" 
              placeholder="Search users..." 
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/10 placeholder:text-gray-300 transition-all"
              value={searchUserQuery}
              onChange={(e) => setSearchUserQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable Channels & Contacts Lists */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Channels Group */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">CHANNELS</h4>
            <button 
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-orange-50 text-orange-500 font-bold text-xs shadow-sm transition-all text-left"
            >
              <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center text-orange-500 shrink-0">
                <Hash className="w-3.5 h-3.5" />
              </div>
              <span className="flex-1 truncate">Global Chat</span>
              <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
            </button>
          </div>

          {/* Direct Messages Contact Group */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">DIRECT MESSAGES</h4>
            <button 
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-gray-50 font-bold text-xs transition-style text-left border border-transparent"
            >
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-455 shrink-0 text-[10px] uppercase font-bold">
                us
              </div>
              <span className="flex-1 truncate">user</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Messages Dialogue Frame */}
      <div className="flex-1 flex flex-col bg-gray-50/20">
        
        {/* Header toolbar */}
        <div className="px-8 py-5 border-b border-gray-150 bg-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900 text-sm leading-tight"># Global Chat</h3>
            <p className="text-[10px] text-gray-400 font-bold flex items-center mt-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span>
              Active Now
            </p>
          </div>
        </div>

        {/* Messaging Area: empty state or messages list */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col">
          {messages.length === 0 ? (
            /* Empty State Container - Styled exactly like Image 1 */
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300 shadow-sm">
                <MessageSquare className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-gray-700 text-sm">No messages yet</h4>
                <p className="text-gray-450 text-xs font-semibold">Be the first to say hello!</p>
              </div>
            </div>
          ) : (
            /* Render active conversation row */
            <div className="flex-1 space-y-4 flex flex-col justify-end">
              <AnimatePresence>
                {messages.map((m) => (
                  <motion.div 
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-3.5 ${m.mine ? 'justify-end' : 'justify-start'}`}
                  >
                    {!m.mine && (
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold text-xs flex items-center justify-center shrink-0">
                        {m.senderInitials}
                      </div>
                    )}
                    <div className={`max-w-md ${m.mine ? 'text-right' : 'text-left'}`}>
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-1">
                        {m.sender} • {m.time}
                      </div>
                      <div className={`px-4 py-2.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${
                        m.mine 
                          ? 'bg-orange-500 text-white rounded-tr-none' 
                          : 'bg-white text-gray-750 border border-gray-100 rounded-tl-none'
                      }`}>
                        {m.text}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Bottom Message Input Bar - Styled exactly like Image 1 */}
        <div className="p-6 bg-white border-t border-gray-150">
          <form onSubmit={handleSend} className="flex gap-2">
            <input 
              type="text" 
              placeholder="Message #global..." 
              className="flex-1 px-4 py-2.5 bg-gray-50 text-xs font-semibold border border-gray-150 focus:border-orange-500 rounded-xl outline-none focus:bg-white placeholder:text-gray-400 transition-all"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button 
              type="submit"
              className="px-5 py-2.5 bg-[#F05A28] hover:bg-orange-600 text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center transition-all"
            >
              <Send className="w-3.5 h-3.5 mr-2 shrink-0" />
              Send
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Chat;
