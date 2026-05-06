import React, { createContext, useContext, useState, useCallback } from 'react';

interface ChatContextType {
  isChatOpen: boolean;
  isChatMinimized: boolean;
  setIsChatOpen: (open: boolean) => void;
  setIsChatMinimized: (minimized: boolean) => void;
  toggleChat: () => void;
}

const ChatContext = createContext<ChatContextType>({
  isChatOpen: false,
  isChatMinimized: false,
  setIsChatOpen: () => {},
  setIsChatMinimized: () => {},
  toggleChat: () => {},
});

export const useChat = () => useContext(ChatContext);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  const toggleChat = useCallback(() => {
    setIsChatOpen(prev => !prev);
    setIsChatMinimized(false);
  }, []);

  return (
    <ChatContext.Provider value={{ 
      isChatOpen, 
      isChatMinimized, 
      setIsChatOpen, 
      setIsChatMinimized, 
      toggleChat 
    }}>
      {children}
    </ChatContext.Provider>
  );
};
