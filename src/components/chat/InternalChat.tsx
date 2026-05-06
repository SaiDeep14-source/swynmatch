import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Send, MessageCircle, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InternalChatMessage, User as UserType } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { useChat } from '../../contexts/ChatContext';

interface InternalChatProps {
  currentUser: UserType;
}

export const InternalChat: React.FC<InternalChatProps> = ({ currentUser }) => {
  const { 
    isChatOpen: isOpen, 
    setIsChatOpen: setIsOpen, 
  } = useChat();

  const [messages, setMessages] = useState<InternalChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { addNotification } = useNotifications();

  useEffect(() => {
    const messagesRef = collection(db, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InternalChatMessage[];
      
      setMessages(newMessages);

      // Scroll to bottom on new message
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }

      // Notification logic
      if (snapshot.docChanges().length > 0) {
        const lastChange = snapshot.docChanges()[snapshot.docChanges().length - 1];
        if (lastChange.type === 'added') {
          const msg = lastChange.doc.data() as InternalChatMessage;
          if (msg.senderEmail !== currentUser.email && !isOpen) {
            addNotification();
          }
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [currentUser.email, isOpen, addNotification]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const messagePayload = {
      senderEmail: currentUser.email,
      senderName: currentUser.email.split('@')[0],
      content: input.trim(),
      timestamp: Date.now(), // Using Client timestamp for sorting consistency in offline mode if needed, but rules check number type
    };

    try {
      await addDoc(collection(db, 'messages'), messagePayload);
      setInput('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-96 h-[500px] bg-white rounded-[2rem] shadow-2xl border border-slate-200 flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/90">Internal Comms</h3>
                  <p className="text-[9px] text-white/40 font-medium tracking-tighter uppercase italic">Neural Tunnel Active</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2 group"
              >
                <span className="text-[10px] font-bold text-white/40 group-hover:text-white transition-colors tracking-widest uppercase">Close</span>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
                  <User className="w-10 h-10 mb-4" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Broadcast Frequency Open</p>
                </div>
              )}
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex flex-col ${msg.senderEmail === currentUser.email ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-1 px-1">
                    {msg.senderName}
                  </span>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    msg.senderEmail === currentUser.email 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-[8px] text-slate-300 mt-1 px-1 italic">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100">
               <div className="relative">
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:ring-4 focus:ring-primary/5 focus:bg-white outline-none pr-12 transition-all"
                  />
                  <button 
                    onClick={handleSend}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-xl hover:bg-primary transition-all active:scale-95 disabled:opacity-50"
                    disabled={!input.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
