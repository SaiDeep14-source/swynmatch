import React, { createContext, useContext, useState, useCallback } from 'react';

interface NotificationContextType {
  unreadCount: number;
  addNotification: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadCount: 0,
  addNotification: () => {},
  clearNotifications: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const addNotification = useCallback(() => {
    setUnreadCount(prev => prev + 1);
  }, []);

  const clearNotifications = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, addNotification, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};
